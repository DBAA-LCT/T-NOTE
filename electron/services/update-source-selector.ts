/**
 * 更新源选择器
 * 
 * 根据用户网络环境自动选择最优的更新下载源
 */

import log from 'electron-log';

export interface UpdateSource {
  name: string;
  url: string;
  region: 'china' | 'global';
  priority: number;
}

export class UpdateSourceSelector {
  private readonly sources: UpdateSource[] = [
    {
      name: 'GitHub',
      url: 'https://github.com/DBAA-LCT/T-NOTE/releases/download',
      region: 'global',
      priority: 1,
    },
    {
      name: 'GitHub Proxy (ghproxy.com)',
      url: 'https://ghproxy.com/https://github.com/DBAA-LCT/T-NOTE/releases/download',
      region: 'china',
      priority: 2,
    },
    {
      name: 'GitHub Mirror (mirror.ghproxy.com)',
      url: 'https://mirror.ghproxy.com/https://github.com/DBAA-LCT/T-NOTE/releases/download',
      region: 'china',
      priority: 3,
    },
  ];

  /**
   * 检测是否在中国大陆
   */
  async isInChina(): Promise<boolean> {
    try {
      // 方法1：检测时区
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (
        timezone.includes('Asia/Shanghai') ||
        timezone.includes('Asia/Chongqing') ||
        timezone.includes('Asia/Urumqi') ||
        timezone.includes('Asia/Hong_Kong')
      ) {
        log.info('检测到中国时区:', timezone);
        return true;
      }

      // 方法2：检测系统语言
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      if (locale.startsWith('zh-CN')) {
        log.info('检测到简体中文环境:', locale);
        return true;
      }

      return false;
    } catch (error) {
      log.error('检测地区失败:', error);
      return false;
    }
  }

  /**
   * 测试下载源的响应速度
   */
  private async testSourceSpeed(url: string): Promise<number> {
    const start = Date.now();
    try {
      // 使用 HEAD 请求测试连接速度
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      const response = await fetch(url.replace('/releases/download', ''), {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const duration = Date.now() - start;
        log.info(`测试 ${url} 响应时间: ${duration}ms`);
        return duration;
      }

      return 999999;
    } catch (error) {
      log.warn(`测试 ${url} 失败:`, error);
      return 999999;
    }
  }

  /**
   * 选择最优的更新源
   */
  async selectBestSource(): Promise<string> {
    const isChina = await this.isInChina();
    
    log.info('用户地区:', isChina ? '中国' : '国际');

    // 根据地区筛选合适的源
    const candidateSources = this.sources.filter((source) => {
      if (isChina) {
        // 中国用户优先使用国内源，但也包含 GitHub 作为备选
        return source.region === 'china' || source.priority === 1;
      } else {
        // 国际用户只使用 GitHub
        return source.region === 'global';
      }
    });

    // 如果在中国，测试各个源的速度
    if (isChina && candidateSources.length > 1) {
      log.info('测试各个下载源的速度...');
      
      const speedTests = await Promise.all(
        candidateSources.map(async (source) => ({
          source,
          speed: await this.testSourceSpeed(source.url),
        }))
      );

      // 按速度排序，选择最快的
      speedTests.sort((a, b) => a.speed - b.speed);
      
      const fastest = speedTests[0];
      if (fastest.speed < 999999) {
        log.info(`选择最快的源: ${fastest.source.name} (${fastest.speed}ms)`);
        return fastest.source.url;
      }
    }

    // 按优先级选择
    candidateSources.sort((a, b) => a.priority - b.priority);
    const selected = candidateSources[0];
    
    log.info(`选择更新源: ${selected.name}`);
    return selected.url;
  }

  /**
   * 获取所有可用的下载源（供用户手动选择）
   */
  getAllSources(): UpdateSource[] {
    return [...this.sources];
  }

  /**
   * 获取手动下载链接
   */
  getManualDownloadLinks(version: string): Array<{ name: string; url: string }> {
    return this.sources.map((source) => ({
      name: source.name,
      url: `${source.url}/v${version}/T-Note-Setup-${version}.exe`,
    }));
  }
}

// 导出单例
export const updateSourceSelector = new UpdateSourceSelector();
