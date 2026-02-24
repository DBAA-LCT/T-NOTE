# T-Note 发布指南

## 自动更新功能说明

T-Note 使用 `electron-updater` 实现自动更新功能，从 GitHub Releases 获取更新。

## 发布新版本步骤

### 1. 更新版本号
编辑 `package.json`，修改 `version` 字段：
```json
{
  "version": "2.1.1"
}
```

### 2. 构建应用
```bash
npm run package
```

这会在 `release` 目录生成：
- `T-Note Setup x.x.x.exe` - 安装程序
- `T-Note Setup x.x.x.exe.blockmap` - 增量更新文件
- `latest.yml` - 更新配置文件

### 3. 在 GitHub 创建 Release

1. 访问 https://github.com/DBAA-LCT/T-NOTE/releases/new
2. 填写信息：
   - **Tag version**: `v2.1.1` (必须以 v 开头)
   - **Release title**: 版本名称，如 "v2.1.1 - 功能更新"
   - **Description**: 更新说明
3. 上传文件（必须）：
   - `T-Note Setup 2.1.1.exe`
   - `T-Note Setup 2.1.1.exe.blockmap`
   - `latest.yml`
4. **重要**：
   - ✅ 勾选 "Set as the latest release"
   - ❌ 不要勾选 "Set as a pre-release"（除非是测试版本）
5. 点击 "Publish release"

### 4. 验证更新

发布后，在应用中点击"检查更新"，应该能检测到新版本。

## 当前配置

- **仓库**: https://github.com/DBAA-LCT/T-NOTE
- **当前版本**: 2.1.0
- **更新检查间隔**: 每 4 小时自动检查一次
- **允许预发布版本**: 是（可以检测 pre-release）

## 常见问题

### Q: 提示"Unable to find latest version on GitHub"
**A**: 确保 GitHub 上有至少一个正式发布的 release（不是 pre-release），并且上传了必要的文件。

### Q: 更新检测到但下载失败
**A**: 检查 GitHub Release 中是否上传了 `.exe` 和 `.blockmap` 文件。

### Q: 想要发布测试版本
**A**: 创建 release 时勾选 "Set as a pre-release"，应用会检测到（因为已启用 `allowPrerelease`）。

## 文件命名规范

- 安装程序: `T-Note Setup x.x.x.exe`
- Blockmap: `T-Note Setup x.x.x.exe.blockmap`
- 配置文件: `latest.yml`

版本号必须与 `package.json` 中的 `version` 一致。
