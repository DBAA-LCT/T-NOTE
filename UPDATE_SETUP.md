# 应用自动更新功能设置指南

## 概述

T-Note 现在支持应用内自动更新检测和安装功能，基于 `electron-updater` 实现。

## 安装依赖

```bash
npm install electron-updater electron-log
```

## 功能特性

1. **自动检查更新**：应用启动后自动检查更新，之后每4小时检查一次
2. **后台下载**：发现新版本后在后台自动下载
3. **用户通知**：下载完成后提示用户安装
4. **手动检查**：用户可以手动触发更新检查

## 更新流程

1. 应用启动时自动检查更新
2. 如果有新版本，显示通知并开始下载
3. 下载过程中显示进度条
4. 下载完成后询问用户是否立即安装
5. 用户确认后，应用重启并安装更新

## 发布更新

### 1. 使用 GitHub Releases

在 `package.json` 中配置：

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "t-note"
    }
  }
}
```

发布步骤：
1. 更新 `package.json` 中的版本号
2. 运行 `npm run package` 打包应用
3. 在 GitHub 上创建新的 Release
4. 上传打包生成的安装包和 `latest.yml` 文件

### 2. 使用自定义服务器

```json
{
  "build": {
    "publish": {
      "provider": "generic",
      "url": "https://your-server.com/updates"
    }
  }
}
```

服务器需要提供：
- `latest.yml` - 更新信息文件
- 安装包文件（.exe）

## 在应用中使用

### 1. 在 App.tsx 中添加更新组件

```tsx
import UpdateNotification from './components/UpdateNotification';

function App() {
  return (
    <>
      <UpdateNotification />
      {/* 其他组件 */}
    </>
  );
}
```

### 2. 手动检查更新

```tsx
const handleCheckUpdate = async () => {
  const result = await window.electronAPI.update.checkForUpdates();
  if (result.success) {
    message.info('正在检查更新...');
  }
};
```

### 3. 监听更新状态

```tsx
useEffect(() => {
  const removeListener = window.electronAPI.update.onUpdateStatus((data) => {
    console.log('更新状态:', data.event, data.data);
  });
  
  return () => removeListener();
}, []);
```

## 更新事件

- `checking-for-update` - 开始检查更新
- `update-available` - 发现新版本
- `update-not-available` - 已是最新版本
- `download-progress` - 下载进度
- `update-downloaded` - 下载完成
- `update-error` - 更新出错

## 配置选项

在 `electron/services/update-manager.ts` 中可以配置：

```typescript
// 修改自动检查间隔（小时）
updateManager.startAutoCheck(4); // 每4小时检查一次

// 配置更新服务器
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-username',
  repo: 'your-repo'
});
```

## 测试更新功能

1. 修改 `package.json` 中的版本号（降低版本）
2. 打包应用
3. 发布新版本到 GitHub Releases
4. 运行旧版本应用
5. 应用会检测到新版本并提示更新

## 注意事项

1. **代码签名**：Windows 上建议对应用进行代码签名，否则可能被 SmartScreen 拦截
2. **版本号格式**：使用语义化版本号（如 1.0.0）
3. **网络环境**：确保用户可以访问更新服务器
4. **测试**：在发布前充分测试更新流程

## 禁用自动更新

如果需要禁用自动更新，在 `electron/main.ts` 中注释掉：

```typescript
// updateManager.startAutoCheck(4);
```

## 故障排查

### 更新检查失败

- 检查网络连接
- 确认更新服务器配置正确
- 查看日志文件（位于用户数据目录）

### 下载失败

- 检查磁盘空间
- 确认防火墙设置
- 尝试手动下载安装包

### 安装失败

- 确保应用有写入权限
- 关闭杀毒软件重试
- 手动安装新版本

## 相关文件

- `electron/services/update-manager.ts` - 更新管理器
- `src/components/UpdateNotification.tsx` - 更新通知组件
- `electron/main.ts` - 主进程集成
- `electron/preload.ts` - API 暴露
- `src/types/window.d.ts` - 类型定义
