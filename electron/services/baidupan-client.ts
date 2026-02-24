/**
 * 百度网盘 API 客户端
 *
 * 封装百度网盘开放平台的文件操作 API，包括：
 * - 文件列表、上传（预创建 + 分片上传 + 创建文件）、下载、删除
 * - 网盘容量查询
 * - 目录创建
 *
 * 参考文档: https://pan.baidu.com/union/doc/nksg0sbfs
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaiduPanAuth } from './baidupan-auth';
import { logger } from '../utils/logger';
import type {
  BaiduFileItem,
  BaiduQuotaInfo,
  PrecreateResult,
  CreateFileResult,
} from '../../src/types/baidupan-sync';

const BASE_URL = 'https://pan.baidu.com';
const UPLOAD_URL = 'https://d.pcs.baidu.com';
const SLICE_SIZE = 4 * 1024 * 1024; // 4MB 分片

const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelays: [1000, 3000, 5000],
};

export class BaiduPanClient {
  private auth: BaiduPanAuth;

  constructor(auth: BaiduPanAuth) {
    this.auth = auth;
  }

  // ============================================================================
  // 网盘容量
  // ============================================================================

  async getQuota(): Promise<BaiduQuotaInfo> {
    const token = await this.auth.getAccessToken();
    const url = `${BASE_URL}/api/quota?access_token=${token}&checkfree=1&checkexpire=1`;
    const data = await this.fetchJson(url);
    return {
      total: data.total,
      free: data.free,
      used: data.used,
      expire: data.expire,
    };
  }

  // ============================================================================
  // 文件列表
  // ============================================================================

  /** 获取指定目录下的文件列表 */
  async listFiles(dir: string, page = 1, limit = 100): Promise<BaiduFileItem[]> {
    const token = await this.auth.getAccessToken();
    const url = `${BASE_URL}/rest/2.0/xpan/file?method=list&access_token=${token}&dir=${encodeURIComponent(dir)}&start=${(page - 1) * limit}&limit=${limit}&order=time&desc=1`;
    const data = await this.fetchJson(url);
    if (data.errno !== 0) {
      throw new Error(`获取文件列表失败: errno=${data.errno}`);
    }
    return (data.list || []).map((item: any) => this.mapFileItem(item));
  }

  // ============================================================================
  // 文件上传 (预创建 -> 分片上传 -> 创建文件)
  // ============================================================================

  /**
   * 上传文件到百度网盘
   * @param localFilePath 本地文件路径
   * @param remotePath 网盘目标路径，如 /apps/TNote/myfile.note
   * @param onProgress 进度回调
   */
  async uploadFile(
    localFilePath: string,
    remotePath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<CreateFileResult> {
    const fileBuffer = await fs.readFile(localFilePath);
    const fileSize = fileBuffer.length;

    logger.info('sync', `百度网盘: 开始上传 ${remotePath}, 大小=${fileSize} bytes`);

    if (fileSize === 0) {
      throw new Error('文件内容为空，无法上传');
    }

    // 1. 计算分片 MD5
    const slices = this.splitBuffer(fileBuffer, SLICE_SIZE);
    const blockMd5List = slices.map(s => this.md5(s));
    logger.debug('api', `百度网盘: 分片数=${slices.length}, MD5列表=${JSON.stringify(blockMd5List)}`);

    // 2. 预创建
    const precreateData = await this.precreate(remotePath, fileSize, blockMd5List);
    const { uploadid, blockList: needUploadBlocks } = this.parsePrecreateResult(precreateData);
    logger.debug('api', `百度网盘: uploadid=${uploadid}, 需上传分片=${JSON.stringify(needUploadBlocks)}`);

    // 3. 分片上传
    const blocksToUpload = needUploadBlocks.length > 0 ? needUploadBlocks : [0];
    for (let i = 0; i < blocksToUpload.length; i++) {
      const idx = blocksToUpload[i];
      await this.uploadSlice(remotePath, uploadid, idx, slices[idx]);
      onProgress?.(i + 1, blocksToUpload.length);
    }

    // 4. 创建文件
    const result = await this.createFile(remotePath, fileSize, uploadid, blockMd5List);
    logger.info('sync', `百度网盘: 文件上传完成 ${remotePath}, fsId=${result.fsId}, size=${result.size}`);
    return result;
  }

  /** 直接上传内容字符串 */
  async uploadContent(
    content: string,
    remotePath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<CreateFileResult> {
    const tmpDir = require('os').tmpdir();
    const tmpFile = path.join(tmpDir, `baidupan_upload_${Date.now()}.tmp`);
    try {
      await fs.writeFile(tmpFile, content, 'utf-8');
      return await this.uploadFile(tmpFile, remotePath, onProgress);
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  private async precreate(remotePath: string, size: number, blockMd5List: string[]): Promise<any> {
    const token = await this.auth.getAccessToken();
    const url = `${BASE_URL}/rest/2.0/xpan/file?method=precreate&access_token=${token}`;

    const body = new URLSearchParams({
      path: remotePath,
      size: String(size),
      isdir: '0',
      autoinit: '1',
      rtype: '3', // 覆盖同名文件
      block_list: JSON.stringify(blockMd5List),
    });

    const resp = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'pan.baidu.com',
      },
      body: body.toString(),
    });
    const data = await resp.json();
    logger.debug('api', '百度网盘: precreate 结果', { errno: data.errno, uploadid: data.uploadid, blockList: data.block_list });
    return data;
  }

  private async uploadSlice(
    remotePath: string,
    uploadid: string,
    partseq: number,
    data: Buffer
  ): Promise<void> {
    const token = await this.auth.getAccessToken();
    const url = `${UPLOAD_URL}/rest/2.0/pcs/superfile2?method=upload&access_token=${token}&type=tmpfile&path=${encodeURIComponent(remotePath)}&uploadid=${encodeURIComponent(uploadid)}&partseq=${partseq}`;

    // 使用 FormData 风格的 multipart 构造
    const boundary = `----BaiduPanBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
    const CRLF = '\r\n';
    const headerPart = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="chunk_${partseq}"`,
      `Content-Type: application/octet-stream`,
      '',
      '',
    ].join(CRLF);
    const footerPart = `${CRLF}--${boundary}--${CRLF}`;

    const body = Buffer.concat([
      Buffer.from(headerPart, 'utf-8'),
      data,
      Buffer.from(footerPart, 'utf-8'),
    ]);

    const resp = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'User-Agent': 'pan.baidu.com',
      },
      body: new Uint8Array(body) as any,
    });

    const result = await resp.json();
    if (result.error_code || result.errno) {
      throw new Error(`分片上传失败: partseq=${partseq}, error=${JSON.stringify(result)}`);
    }
    logger.debug('api', `百度网盘: 分片 ${partseq} 上传成功, md5=${result.md5 || 'unknown'}`);
  }

  private async createFile(
    remotePath: string,
    size: number,
    uploadid: string,
    blockMd5List: string[]
  ): Promise<CreateFileResult> {
    const token = await this.auth.getAccessToken();
    const url = `${BASE_URL}/rest/2.0/xpan/file?method=create&access_token=${token}`;

    const body = new URLSearchParams({
      path: remotePath,
      size: String(size),
      isdir: '0',
      rtype: '3',
      uploadid,
      block_list: JSON.stringify(blockMd5List),
    });

    const resp = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'pan.baidu.com',
      },
      body: body.toString(),
    });

    const data = await resp.json();
    if (data.errno !== 0) {
      throw new Error(`创建文件失败: errno=${data.errno}`);
    }
    return {
      errno: data.errno,
      fsId: data.fs_id,
      md5: data.md5,
      path: data.path,
      size: data.size,
      ctime: data.ctime,
      mtime: data.mtime,
      isdir: data.isdir,
    };
  }

  // ============================================================================
  // 文件下载
  // ============================================================================

  /** 获取文件下载链接 */
  async getDownloadLink(fsIds: number[]): Promise<{ dlink: string; filename: string }[]> {
    const token = await this.auth.getAccessToken();
    const url = `${BASE_URL}/rest/2.0/xpan/multimedia?method=filemetas&access_token=${token}&fsids=${JSON.stringify(fsIds)}&dlink=1`;
    const data = await this.fetchJson(url);
    if (data.errno !== 0) {
      throw new Error(`获取下载链接失败: errno=${data.errno}`);
    }
    return (data.list || []).map((item: any) => ({
      dlink: item.dlink,
      filename: item.filename,
    }));
  }

  /** 下载文件内容 */
  async downloadFile(fsId: number): Promise<Buffer> {
    const links = await this.getDownloadLink([fsId]);
    if (links.length === 0) throw new Error('未找到下载链接');

    const token = await this.auth.getAccessToken();
    const dlink = `${links[0].dlink}&access_token=${token}`;

    const resp = await this.fetchWithRetry(dlink, {
      headers: { 'User-Agent': 'pan.baidu.com' },
    });
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ============================================================================
  // 文件删除
  // ============================================================================

  async deleteFile(filePaths: string[]): Promise<void> {
    const token = await this.auth.getAccessToken();
    const url = `${BASE_URL}/rest/2.0/xpan/file?method=filemanager&access_token=${token}&opera=delete`;

    const body = new URLSearchParams({
      async: '0',
      filelist: JSON.stringify(filePaths),
    });

    const resp = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'pan.baidu.com',
      },
      body: body.toString(),
    });
    const data = await resp.json();
    if (data.errno !== 0) {
      throw new Error(`删除文件失败: errno=${data.errno}`);
    }
  }

  // ============================================================================
  // 目录创建
  // ============================================================================

  async createFolder(remotePath: string): Promise<void> {
    const token = await this.auth.getAccessToken();
    const url = `${BASE_URL}/rest/2.0/xpan/file?method=create&access_token=${token}`;

    const body = new URLSearchParams({
      path: remotePath,
      size: '0',
      isdir: '1',
      rtype: '0',  // 0 = 不重命名，如果已存在则报错（errno=-8），避免创建时间戳命名的重复目录
    });

    const resp = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'pan.baidu.com',
      },
      body: body.toString(),
    });
    const data = await resp.json();
    // errno=0 成功, errno=-8 目录已存在
    if (data.errno !== 0 && data.errno !== -8) {
      throw new Error(`创建目录失败: errno=${data.errno}`);
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private splitBuffer(buf: Buffer, chunkSize: number): Buffer[] {
    const chunks: Buffer[] = [];
    for (let i = 0; i < buf.length; i += chunkSize) {
      chunks.push(buf.subarray(i, Math.min(i + chunkSize, buf.length)));
    }
    return chunks.length > 0 ? chunks : [Buffer.alloc(0)];
  }

  private md5(data: Buffer): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private parsePrecreateResult(data: any): PrecreateResult {
    if (data.errno !== 0) {
      throw new Error(`预创建失败: errno=${data.errno}`);
    }
    return {
      errno: data.errno,
      path: data.path,
      uploadid: data.uploadid,
      returnType: data.return_type,
      blockList: data.block_list || [0],
    };
  }

  private mapFileItem(item: any): BaiduFileItem {
    return {
      fsId: item.fs_id,
      path: item.path,
      filename: item.server_filename,
      size: item.size,
      isdir: item.isdir,
      md5: item.md5,
      serverMtime: item.server_mtime,
      serverCtime: item.server_ctime,
      localMtime: item.local_mtime,
      localCtime: item.local_ctime,
      category: item.category,
    };
  }

  private async fetchJson(url: string): Promise<any> {
    const resp = await this.fetchWithRetry(url, {
      headers: { 'User-Agent': 'pan.baidu.com' },
    });
    return resp.json();
  }

  private async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const resp = await fetch(url, options);
        if (resp.ok || resp.status < 500) return resp;
        lastError = new Error(`HTTP ${resp.status}`);
      } catch (err) {
        lastError = err as Error;
      }
      if (attempt < RETRY_CONFIG.maxRetries) {
        await new Promise(r => setTimeout(r, RETRY_CONFIG.retryDelays[attempt]));
      }
    }
    throw lastError || new Error('请求失败');
  }
}

// 单例
let clientInstance: BaiduPanClient | null = null;
export function getBaiduPanClient(): BaiduPanClient {
  if (!clientInstance) {
    const { getBaiduPanAuth } = require('./baidupan-auth');
    clientInstance = new BaiduPanClient(getBaiduPanAuth());
  }
  return clientInstance;
}
