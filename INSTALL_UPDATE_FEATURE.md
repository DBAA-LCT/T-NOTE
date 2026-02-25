# 安装应用更新功能

## 当前状态

应用更新功能的 UI 和集成已经完成，但需要安装依赖才能启用。

## 已完成的工作

1. ✅ 创建了更新管理器 (`electron/services/update-manager.ts.bak`)
2. ✅ 在设置面板添加了"关于"选项
3. ✅ 创建了关于面板 (`src/components/AboutPanel.tsx`)，包含：
   - 应用版本信息
   - 检查更新按钮
   - 下载进度显示
   - 安装更新功能
4. ✅ 添加了 IPC 通信接口
5. ✅ 添加了 TypeScript 类型定义

## 安装步骤

### 1. 安装依赖

以管理员身份运行 PowerShell 或 CMD，然后执行：

```bash
npm install electron-updater electron-log
```

或者使用 yarn：

```bash
yarn add electron-updater electron-log
```

### 2. 启用更新管理器

安装完依赖后，需要重命名文件并取消注释：

#### 2.1 重命名文件

```bash
# 将 update-manager.ts.bak 重命名回 update-manager.ts
mv electron/services/update-manager.ts.bak electron/services/update-manager.ts
```

#### 2.2 在 electron/main.ts 中取消注释

找到以下被注释的代码并取消注释：

```typescript
// 文件顶部
import { updateManager } from './services/update-manager';

// app.whenReady() 中
if (mainWindow) {
  updateManager.setMainWindow(mainWindow);
  updateManager.startAutoCheck(4);
}

// IPC 处理器部分
ipcMain.handle('check-for-updates', async () => {
  try {
    await updateManager.checkForUpdates();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await updateManager.downloadUpdate();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quit-and-install', () => {
  updateManager.quitAndInstall();
});
```

### 3. 配置更新服务器

在 `package.json` 中配置发布设置：

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-github-username",
      "repo": "t-note"
    }
  }
}
```

### 4. 重新编译

```bash
npm run build
```

## 使用方法

### 在应用中使用

1. 打开应用
2. 点击左侧边栏的"设置"图标
3. 在设置侧边栏中点击"关于 T-Note"
4. 在关于面板中点击"检查更新"按钮

### 功能说明

- **自动检查**：应用启动后自动检查更新，之后每4小时检查一次
- **手动检查**：在关于面板点击"检查更新"按钮
- **后台下载**：发现新版本后自动在后台下载
- **进度显示**：下载过程中显示进度条
- **一键安装**：下载完成后点击"立即安装并重启"按钮

## 发布更新

### 使用 GitHub Releases

1. 更新 `package.json` 中的版本号
2. 运行 `npm run package` 打包应用
3. 在 GitHub 上创建新的 Release
4. 上传以下文件：
   - `T-Note Setup x.x.x.exe` - 安装包
   - `.yml` - 更新信息文件（自动生成在 release 目录）

### 版本号规则

使用语义化版本号（Semantic Versioning）：

- 主版本号：重大更新，可能不兼容旧版本
- 次版本号：新功能，向后兼容
- 修订号：Bug 修复

例如：`1.2.0` → `1.2.1` → `1.3.0` → `2.0.0`

## 测试更新功能

1. 降低当前版本号（如从 1.2.0 改为 1.1.0）
2. 打包并安装应用
3. 发布新版本到 GitHub Releases
4. 运行应用，应该会检测到更新

## 故障排查

### 更新检查失败

- 检查网络连接
- 确认 GitHub 仓库配置正确
- 查看日志文件（位于用户数据目录）

### 依赖安装失败

如果遇到权限问题：

1. 以管理员身份运行终端
2. 清理 npm 缓存：`npm cache clean --force`
3. 重新安装：`npm install electron-updater electron-log`

### 编译错误

如果编译时仍然报错：

1. 确认 `update-manager.ts.bak` 已重命名为 `update-manager.ts`
2. 确认依赖已正确安装
3. 删除 `node_modules` 和 `package-lock.json`，重新安装

## 相关文件

- `electron/services/update-manager.ts.bak` - 更新管理器（需重命名）
- `src/components/AboutPanel.tsx` - 关于面板（包含更新 UI）
- `src/components/SettingsPanel.tsx` - 设置侧边栏
- `electron/main.ts` - 主进程集成（需取消注释）
- `electron/preload.ts` - API 暴露
- `src/types/window.d.ts` - 类型定义
- `UPDATE_SETUP.md` - 详细的更新功能文档

## 注意事项

1. 更新功能需要应用有网络访问权限
2. Windows 上建议对应用进行代码签名
3. 首次发布时需要手动安装，之后可以自动更新
4. 更新服务器需要提供 HTTPS 访问
