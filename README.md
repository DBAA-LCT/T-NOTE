# 富文本笔记编辑器

Windows 桌面端本地笔记应用

## 功能特性

- 📝 富文本编辑（基于 Quill）
- 📄 多页面管理
- 🏷️ 标签系统
- 🔍 按标签搜索
- 💾 本地文件保存（.note 格式）

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm run dev
```

## 打包应用

```bash
npm run build
npm run package
```

## 数据结构

每个 .note 文件包含：
- 笔记名称
- 多个页面
- 每个页面有标题、内容和标签
