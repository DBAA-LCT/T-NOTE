# 迁移指南

本指南说明如何将现有代码迁移到新的优化结构。所有迁移都是可选的，现有代码可以继续正常工作。

## 1. 使用新的类型定义

### 之前
```typescript
import { Note, Page, TodoItem } from './types';
```

### 之后（推荐）
```typescript
import { Note, Page, TodoItem } from './types/note';
import { CloudProvider, CloudFile } from './types/cloud';
```

### 或者（保持兼容）
```typescript
import { Note, Page, TodoItem } from './types'; // 仍然有效
```

## 2. 使用 useNoteManager Hook

### 之前（App.tsx）
```typescript
const [note, setNote] = useState<Note | null>(null);
const [currentPageId, setCurrentPageId] = useState<string | null>(null);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

const addPage = (page: Page) => {
  setNote((prev) => {
    if (!prev) return null;
    return { ...prev, pages: [...prev.pages, page] };
  });
  setHasUnsavedChanges(true);
};

// ... 更多状态管理代码
```

### 之后（推荐）
```typescript
import { useNoteManager } from './hooks';

const {
  note,
  currentPageId,
  hasUnsavedChanges,
  setNote,
  setCurrentPageId,
  addPage,
  updatePage,
  deletePage,
  getCurrentPage,
  saveNote,
} = useNoteManager();

// 直接使用，无需手动管理状态
```

## 3. 使用 CloudSyncButton 组件

### 之前（OneDriveSyncButton.tsx）
```typescript
<OneDriveSyncButton onSyncComplete={handleSyncComplete} />
```

### 之后（推荐）
```typescript
import CloudSyncButton from './components/CloudSyncButton';

<CloudSyncButton 
  provider="onedrive" 
  onSyncComplete={handleSyncComplete} 
/>
```

### 百度网盘
```typescript
<CloudSyncButton 
  provider="baidupan" 
  mode="upload-only"
  getNoteData={getNoteData}
  onSyncComplete={handleSyncComplete} 
/>
```

## 4. 使用 useCloudSync Hook

### 之前
```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [isSyncing, setIsSyncing] = useState(false);

useEffect(() => {
  window.electronAPI.onedrive.isAuthenticated().then(setIsAuthenticated);
  
  const removeProgress = window.electronAPI.onedrive.onSyncProgress((progress) => {
    setIsSyncing(true);
  });
  
  // ... 更多监听器
}, []);
```

### 之后（推荐）
```typescript
import { useCloudSync } from './hooks';

const {
  isAuthenticated,
  isSyncing,
  syncProgress,
  lastSyncTime,
  checkAuthStatus,
  startSync,
} = useCloudSync('onedrive');

// 所有状态自动管理
```

## 5. 重构认证管理器（Electron 主进程）

### 之前（auth-manager.ts）
```typescript
export class AuthManager {
  private authWindow: BrowserWindow | null = null;
  private tokenData: TokenData | null = null;
  
  async authenticate(): Promise<UserInfo> {
    // 大量重复的 OAuth 代码
  }
  
  async refreshAccessToken(): Promise<string> {
    // 重复的刷新逻辑
  }
  
  // ... 更多重复代码
}
```

### 之后（推荐）
```typescript
import { BaseAuthManager, OAuthConfig, TokenData } from './base-auth-manager';
import { CONFIG } from '../config';

interface OneDriveTokenData extends TokenData {
  // OneDrive 特定的字段
}

export class AuthManager extends BaseAuthManager<UserInfo, OneDriveTokenData> {
  protected config: OAuthConfig = CONFIG.oauth.onedrive;
  
  protected getProviderName(): string {
    return 'OneDrive';
  }
  
  async getUserInfo(): Promise<UserInfo> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(CONFIG.api.onedrive.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  }
  
  protected parseTokenResponse(data: any): OneDriveTokenData {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }
}
```

**代码减少**: 从 400+ 行减少到约 50 行

## 6. 使用通用 IPC 处理器（Electron 主进程）

### 之前（handlers.ts）
```typescript
ipcMain.handle(IPC_CHANNELS.AUTH_AUTHENTICATE, async () => {
  try {
    logger.info('auth', 'IPC: Starting authentication');
    const authManager = getAuthManager();
    const userInfo = await authManager.authenticate();
    logger.info('auth', 'IPC: Authentication successful');
    return userInfo;
  } catch (error) {
    logger.error('auth', 'IPC: Authentication failed', error as Error);
    throw error;
  }
});

// ... 重复的模式用于其他认证处理器
```

### 之后（推荐）
```typescript
import { registerAuthHandlers } from './base-ipc-handlers';
import { IPC_CHANNELS } from './sync-channels';
import { getAuthManager } from '../services/auth-manager';

registerAuthHandlers(
  IPC_CHANNELS,
  {
    authenticate: () => getAuthManager().authenticate(),
    disconnect: () => getAuthManager().disconnect(),
    getUserInfo: () => getAuthManager().getUserInfo(),
    isAuthenticated: () => getAuthManager().isAuthenticated(),
  },
  'OneDrive'
);
```

**代码减少**: 从 100+ 行减少到约 15 行

## 7. 使用集中配置

### 之前（分散在各个文件中）
```typescript
// auth-manager.ts
const OAUTH_CONFIG = {
  clientId: 'b734699f-3727-49ec-8016-12122c78c0a2',
  redirectUri: 'http://localhost:3000/auth/callback',
  // ...
};

// onedrive-client.ts
const API_BASE_URL = 'https://graph.microsoft.com/v1.0';
```

### 之后（推荐）
```typescript
import { CONFIG } from '../config';

// 使用配置
const clientId = CONFIG.oauth.onedrive.clientId;
const apiUrl = CONFIG.api.onedrive.baseUrl;
const defaultFolder = CONFIG.sync.defaultFolder.onedrive;
```

## 迁移优先级

### 立即可用（无需修改现有代码）
- ✅ 新的类型定义（通过 `src/types.ts` 自动导出）
- ✅ CloudSyncButton 组件（可以在新功能中使用）
- ✅ useCloudSync Hook（可以在新组件中使用）

### 建议逐步迁移
1. **App.tsx** - 使用 `useNoteManager` Hook（减少约 200 行）
2. **认证管理器** - 继承 `BaseAuthManager`（减少约 400 行）
3. **IPC 处理器** - 使用 `registerAuthHandlers`（减少约 200 行）
4. **同步按钮** - 替换为 `CloudSyncButton`（减少约 150 行）

### 可选迁移
- 配置管理 - 使用 `CONFIG` 对象
- 其他组件 - 根据需要逐步重构

## 测试迁移

每次迁移后，请测试以下功能：

### 基本功能
- [ ] 创建、编辑、保存笔记
- [ ] 页面管理（添加、删除、切换）
- [ ] Tab 栏和分屏功能

### 云同步功能
- [ ] OneDrive 认证和同步
- [ ] 百度网盘认证和上传
- [ ] 同步进度显示
- [ ] 错误处理

### 其他功能
- [ ] TODO 管理
- [ ] 书签功能
- [ ] 搜索功能
- [ ] 设置面板

## 回滚方案

如果迁移后出现问题，可以轻松回滚：

1. **类型定义**: 继续使用 `import from './types'`
2. **组件**: 恢复使用原有的组件
3. **Hooks**: 恢复原有的状态管理代码

所有新文件都是独立的，删除它们不会影响现有功能。

## 获取帮助

如果在迁移过程中遇到问题：

1. 查看 `OPTIMIZATION_SUMMARY.md` 了解优化详情
2. 参考新文件中的注释和类型定义
3. 对比新旧代码的实现方式
4. 保持现有代码不变，在新功能中使用新组件

## 总结

- ✅ 所有迁移都是可选的
- ✅ 现有代码可以继续正常工作
- ✅ 可以逐步迁移，不需要一次性完成
- ✅ 每个迁移步骤都可以独立进行
- ✅ 随时可以回滚到原有实现
