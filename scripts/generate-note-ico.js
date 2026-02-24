/**
 * 将 note-icon PNG 转换为 ICO 格式
 * 
 * ICO 文件格式：
 * - 6 字节头部
 * - 每个图像 16 字节目录条目
 * - 每个图像的 BMP 数据（不含文件头）
 * 
 * 用法: node scripts/generate-note-ico.js
 */

const fs = require('fs');
const path = require('path');

// 使用 PNG 嵌入方式生成 ICO（Windows Vista+ 原生支持）
async function generateIcoFromPng() {
  const pngPath = path.join(__dirname, '..', 'build', 'note-icon-256x256.png');
  
  if (!fs.existsSync(pngPath)) {
    console.error('错误: 找不到 build/note-icon-256x256.png');
    console.log('请先用浏览器打开 build-note-icon.html 生成图标 PNG');
    process.exit(1);
  }

  const pngData = fs.readFileSync(pngPath);
  
  // ICO 文件格式（使用 PNG 嵌入方式，Windows Vista+ 支持）
  // 头部: 6 字节
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // 保留，必须为 0
  header.writeUInt16LE(1, 2);      // 类型: 1 = ICO
  header.writeUInt16LE(1, 4);      // 图像数量: 1

  // 目录条目: 16 字节
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);          // 宽度: 0 = 256
  entry.writeUInt8(0, 1);          // 高度: 0 = 256
  entry.writeUInt8(0, 2);          // 调色板颜色数: 0
  entry.writeUInt8(0, 3);          // 保留
  entry.writeUInt16LE(1, 4);       // 颜色平面数
  entry.writeUInt16LE(32, 6);      // 每像素位数
  entry.writeUInt32LE(pngData.length, 8);  // 图像数据大小
  entry.writeUInt32LE(22, 12);     // 图像数据偏移 (6 + 16 = 22)

  // 合并
  const ico = Buffer.concat([header, entry, pngData]);
  
  // 输出到 build 目录，方便 electron-builder 打包时使用
  const outputPath = path.join(__dirname, '..', 'build', 'note-icon.ico');
  
  fs.writeFileSync(outputPath, ico);
  console.log(`✅ 已生成 .note 文件图标: ${outputPath}`);
  console.log(`   大小: ${ico.length} 字节`);
  console.log(`   PNG 源: ${pngPath}`);
}

generateIcoFromPng().catch(err => {
  console.error('生成失败:', err);
  process.exit(1);
});
