# OneDrive 快速配置指南

## 快速开始（5分钟）

### 1. 注册 Azure 应用

访问：
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

- 点击 "新注册"
- 名称：`T-Note`
- 账户类型：选择 "任何组织目录中的帐户和个人 Microsoft 帐户"
- 重定向 URI：暂时留空
- 点击 "注册"
- **如果看到验证提示，直接关闭即可（验证是可选的）**

### 2. 配置重定向 URI

- 左侧菜单 → "身份验证"
- "添加平台" → "移动和桌面应用程序"
- 自定义重定向 URI：`http://localhost:3000/auth/callback`
- 点击 "配置"

### 3. 配置权限

在应用页面：
- 左侧菜单 → "API 权限"
- "添加权限" → "Microsoft Graph" → "委托的权限"
- 添加：
  - `Files.ReadWrite`
  - `offline_access`
  - `User.Read`
- 点击 "添加权限"

### 4. 获取客户端 ID

- 左侧菜单 → "概述"
- 复制 "应用程序(客户端) ID"

### 5. 配置 T-Note

在项目根目录创建 `.env` 文件：

```
ONEDRIVE_CLIENT_ID=你复制的客户端ID
```

### 6. 重新构建并运行

```bash
npm run build
npm run dev
```

## 完成！

现在你可以在应用中点击 OneDrive 同步按钮进行登录和同步了。

详细文档请查看：[docs/onedrive-setup.md](docs/onedrive-setup.md)
