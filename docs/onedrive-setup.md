# OneDrive 同步配置指南

本文档介绍如何配置 T-Note 的 OneDrive 同步功能。

## 前提条件

- 拥有 Microsoft 账户（个人账户或工作/学校账户）
- 访问 Azure Portal 的权限

## 步骤 1: 在 Azure Portal 注册应用

1. 访问 [Azure Portal - 应用注册](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)

2. 点击 "新注册"

3. 填写应用信息：
   - **名称**: T-Note（或你喜欢的名称）
   - **支持的账户类型**: 选择 "任何组织目录(任何 Azure AD 目录 - 多租户)中的帐户和个人 Microsoft 帐户(例如，Skype、Xbox)"
   - **重定向 URI**: 暂时留空，稍后配置

4. 点击 "注册"

5. **重要**：如果看到"注册此应用程序"的验证提示，直接点击右上角的 "X" 关闭即可。发布者验证是可选的，不影响个人使用。

## 步骤 2: 配置重定向 URI

1. 在应用页面左侧菜单中，点击 "身份验证"

2. 点击 "添加平台"

3. 选择 "移动和桌面应用程序"

4. 在"自定义重定向 URI"中输入：`http://localhost:3000/auth/callback`

5. 点击 "配置"

## 步骤 3: 配置 API 权限

1. 在应用页面左侧菜单中，点击 "API 权限"

2. 点击 "添加权限"

3. 选择 "Microsoft Graph"

4. 选择 "委托的权限"

5. 添加以下权限：
   - `Files.ReadWrite` - 读写用户文件
   - `offline_access` - 维持数据访问权限
   - `User.Read` - 读取用户基本信息

6. 点击 "添加权限"

7. **注意**：个人账户不需要管理员同意，用户首次登录时会自动授权

## 步骤 4: 获取客户端 ID

1. 在应用页面左侧菜单中，点击 "概述"

2. 复制 "应用程序(客户端) ID"（格式类似：`12345678-1234-1234-1234-123456789abc`）

## 步骤 5: 配置 T-Note

### 方法 1: 使用环境变量（推荐）

1. 在项目根目录创建 `.env` 文件：

```bash
ONEDRIVE_CLIENT_ID=你的客户端ID
```

2. 重新启动应用

### 方法 2: 直接修改代码

1. 打开 `electron/services/auth-manager.ts`

2. 找到 `OAUTH_CONFIG` 配置：

```typescript
const OAUTH_CONFIG = {
  clientId: process.env.ONEDRIVE_CLIENT_ID || 'YOUR_CLIENT_ID',
  // ...
};
```

3. 将 `'YOUR_CLIENT_ID'` 替换为你的实际客户端 ID：

```typescript
const OAUTH_CONFIG = {
  clientId: process.env.ONEDRIVE_CLIENT_ID || '你的客户端ID',
  // ...
};
```

4. 重新构建应用：

```bash
npm run build
```

## 步骤 6: 测试连接

1. 启动应用

2. 点击 OneDrive 同步按钮

3. 在弹出的浏览器窗口中登录你的 Microsoft 账户

4. 授权应用访问你的 OneDrive

5. 完成后，应用将自动获取访问令牌并开始同步

## 常见问题

### Q: 为什么看到"注册此应用程序"的验证提示？

A: 这是 Azure 的发布者验证功能，用于验证应用发布者的身份。对于个人使用的桌面应用，这个验证是**完全可选的**，不影响任何功能。直接关闭提示即可。

### Q: 需要验证发布者域吗？

A: 不需要。发布者验证主要用于：
- 商业应用
- 需要在 Microsoft 应用商店发布的应用
- 企业级应用

个人使用的桌面应用不需要验证，用户在首次登录时会看到"未验证"的提示，点击"接受"即可正常使用。

### Q: 可以使用工作/学校账户吗？

A: 可以，只要你的组织允许用户授权第三方应用。

### Q: 令牌存储在哪里？

A: 令牌使用 Electron 的 `safeStorage` API 加密存储在用户数据目录中：
- Windows: `%APPDATA%\t-note\onedrive-tokens.enc`
- macOS: `~/Library/Application Support/t-note/onedrive-tokens.enc`
- Linux: `~/.config/t-note/onedrive-tokens.enc`

### Q: 如何撤销应用访问权限？

A: 访问 [Microsoft 账户安全设置](https://account.microsoft.com/privacy/app-access)，找到 T-Note 并撤销权限。

## 安全建议

1. **不要将客户端 ID 提交到公共代码仓库**（如果你计划开源）
2. **使用环境变量**而不是硬编码客户端 ID
3. **定期检查**授权的应用列表
4. **不要共享**你的令牌文件

## 开发者注意事项

如果你要分发应用，建议：

1. 使用你自己的 Azure 应用注册
2. 在构建时通过环境变量注入客户端 ID
3. 考虑使用 PKCE（Proof Key for Code Exchange）增强安全性
4. 实现令牌刷新机制（已实现）

## 参考资料

- [Microsoft Identity Platform 文档](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Microsoft Graph API 文档](https://docs.microsoft.com/en-us/graph/)
- [OAuth 2.0 授权码流程](https://oauth.net/2/grant-types/authorization-code/)
