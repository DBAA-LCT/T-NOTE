# 快速参考指南

## 新增文件速查

### 类型定义
```typescript
// 笔记相关类型
import { Note, Page, TodoItem, Bookmark, DeletedItem, CloudSource } from './types/note';

// 云存储相关类型
import { CloudProvider, CloudFile, CloudQuota, CloudUserInfo, CloudSyncProgress, CloudSyncResult } from './types/cloud';

// 或者使用统一导出（推荐）
import { Note, Page, CloudProvider } from './types';
```

### React Hooks
```typescript
// 笔记管理
import { useNoteManager } from './hooks';

const {
  note,                    // 当前笔记
  currentPageId,           // 当前页面 ID
  currentFilePath,         // 当前文件路径
  hasUnsavedChanges,       // 是否有未保存的更改
  setNote,                 // 设置笔记
  setCurrentPageId,        // 设置当前页面
  setCurrentFilePath,      // 设置文件路径
  setHasUnsavedChanges,    // 设置未保存状态
  addPage,                 // 添加页面
  updatePage,              // 更新页面
  deletePage,              // 删除页面
  getCurrentPage,          // 获取当前页面
  saveNote,                // 保存笔记
} = useNoteManager();

// 云同步
import { useCloudSync } from './hooks';

const {
  isAuthenticated,         // 是否已认证
  isSyncing,              // 是否正在同步
  syncProgress,           // 同步进度 { current, total }
  lastSyncTime,           // 最后同步时间
  checkAuthStatus,        // 检查认证状态
  startSync,              // 开始同步
} = useCloudSync('onedrive'); // 或 'baidupan'
```

### React 组件
```typescript
// 通用云同步按钮
import CloudSyncButton from './components/CloudSyncButton';

// OneDrive 完整同步
<CloudSyncButton 
  provider="onedrive" 
  onSyncComplete={() => console.log('同步完成')} 
/>

// 百度网盘仅上传
<CloudSyncButton 
  provider="baidupan" 
  mode="upload-only"
  getNoteData={() => ({ noteContent: '...', noteName: '...' })}
  onSyncComplete={() => console.log('上传完成')} 
/>
```

### Electron 配置
```typescript
// 集中配置管理
import { CONFIG } from '../config';

// OAuth 配置
CONFIG.oauth.onedrive.clientId
CONFIG.oauth.baidupan.clientId

// API 端点
CONFIG.api.onedrive.baseUrl
CONFIG.api.baidupan.baseUrl

// 同步设置
CONFIG.sync.defaultFolder.onedrive
CONFIG.sync.defaultFolder.baidupan
```

### Electron 认证管理器基类
```typescript
import { BaseAuthManager, OAuthConfig, TokenData } from './base-auth-manager';

// 创建自定义认证管理器
class MyAuthManager extends BaseAuthManager<UserInfo, MyTokenData> {
  protected config: OAuthConfig = {
    clientId: '...',
    redirectUri: '...',
    authUrl: '...',
    tokenUrl: '...',
    scope: '...',
  };
  
  protected getProviderName(): string {
    return 'MyProvider';
  }
  
  async getUserInfo(): Promise<UserInfo> {
    // 实现获取用户信息
  }
  
  protected parseTokenResponse(data: any): MyTokenData {
    // 解析 Token 响应
  }
}
```

### Electron IPC 处理器
```typescript
import { registerAuthHandlers, createIpcHandler } from './base-ipc-handlers';

// 注册认证处理器
registerAuthHandlers(
  IPC_CHANNELS,
  {
    authenticate: () => authManager.authenticate(),
    disconnect: () => authManager.disconnect(),
    getUserInfo: () => authManager.getUserInfo(),
    isAuthenticated: () => authManager.isAuthenticated(),
  },
  'ProviderName'
);

// 创建带错误处理的 IPC 处理器
const handler = createIpcHandler(
  async (arg1, arg2) => {
    // 处理逻辑
  },
  'category',
  'operationName'
);
```

## 常见使用场景

### 场景 1: 创建新页面
```typescript
const { addPage } = useNoteManager();

const handleCreatePage = () => {
  const newPage: Page = {
    id: Date.now().toString(),
    title: '新页面',
    content: '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  addPage(newPage);
};
```

### 场景 2: 更新页面内容
```typescript
const { updatePage } = useNoteManager();

const handleUpdateContent = (pageId: string, content: string) => {
  updatePage(pageId, { content });
};
```

### 场景 3: 保存笔记
```typescript
const { saveNote, hasUnsavedChanges } = useNoteManager();

const handleSave = async () => {
  if (!hasUnsavedChanges) return;
  
  try {
    await saveNote();
    message.success('保存成功');
  } catch (error) {
    message.error('保存失败');
  }
};
```

### 场景 4: 云同步
```typescript
const { startSync, isSyncing } = useCloudSync('onedrive');

const handleSync = async () => {
  if (isSyncing) return;
  
  try {
    await startSync();
    message.success('同步完成');
  } catch (error) {
    message.error('同步失败');
  }
};
```

### 场景 5: 显示同步进度
```typescript
const { syncProgress } = useCloudSync('onedrive');

{syncProgress && (
  <Progress 
    percent={Math.round((syncProgress.current / syncProgress.total) * 100)} 
  />
)}
```

## 代码优化对比

### 优化前
```typescript
// App.tsx - 状态管理（约 50 行）
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

const updatePage = (pageId: string, updates: Partial<Page>) => {
  setNote((prev) => {
    if (!prev) return null;
    return {
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
    };
  });
  setHasUnsavedChanges(true);
};

// ... 更多代码
```

### 优化后
```typescript
// App.tsx - 使用 Hook（约 5 行）
const {
  note,
  currentPageId,
  hasUnsavedChanges,
  addPage,
  updatePage,
  saveNote,
} = useNoteManager();

// 直接使用，无需额外代码
```

**代码减少**: 90%

### 优化前
```typescript
// OneDriveSyncButton.tsx（约 150 行）
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [isSyncing, setIsSyncing] = useState(false);
const [syncProgress, setSyncProgress] = useState(null);

useEffect(() => {
  checkAuthStatus();
  
  const removeProgress = window.electronAPI.onedrive.onSyncProgress((progress) => {
    setSyncProgress({ current: progress.current, total: progress.total });
  });
  
  const removeComplete = window.electronAPI.onedrive.onSyncComplete(() => {
    setIsSyncing(false);
    setSyncProgress(null);
  });
  
  // ... 更多监听器
}, []);

// ... 更多代码
```

### 优化后
```typescript
// 使用 CloudSyncButton（1 行）
<CloudSyncButton provider="onedrive" onSyncComplete={handleComplete} />
```

**代码减少**: 99%

## 性能提示

### 1. 使用 memo 优化组件
```typescript
import { memo } from 'react';

const CloudSyncButton = memo(({ provider, onSyncComplete }) => {
  // 组件实现
});
```

### 2. 使用 useCallback 优化回调
```typescript
const handleSync = useCallback(async () => {
  await startSync();
}, [startSync]);
```

### 3. 使用 useMemo 优化计算
```typescript
const currentPage = useMemo(() => {
  return note?.pages.find(p => p.id === currentPageId);
}, [note, currentPageId]);
```

## 调试技巧

### 1. 查看 Hook 状态
```typescript
const noteManager = useNoteManager();
console.log('Note Manager State:', noteManager);
```

### 2. 监听同步事件
```typescript
const { isSyncing, syncProgress } = useCloudSync('onedrive');

useEffect(() => {
  console.log('Sync Status:', { isSyncing, syncProgress });
}, [isSyncing, syncProgress]);
```

### 3. 检查认证状态
```typescript
const { isAuthenticated } = useCloudSync('onedrive');

useEffect(() => {
  console.log('Auth Status:', isAuthenticated);
}, [isAuthenticated]);
```

## 常见问题

### Q: 如何添加新的云存储服务？
A: 
1. 在 `electron/config.ts` 添加配置
2. 创建继承 `BaseAuthManager` 的认证管理器
3. 使用 `registerAuthHandlers` 注册 IPC 处理器
4. 在 `CloudSyncButton` 中添加新的 provider 类型

### Q: 如何自定义同步按钮样式？
A: 
```typescript
<CloudSyncButton 
  provider="onedrive"
  style={{ color: 'red' }}
/>
```

### Q: 如何处理同步错误？
A: 
```typescript
const { startSync } = useCloudSync('onedrive');

try {
  await startSync();
} catch (error) {
  console.error('Sync error:', error);
  message.error(error.message);
}
```

### Q: 如何获取当前页面？
A: 
```typescript
const { getCurrentPage } = useNoteManager();
const currentPage = getCurrentPage();
```

## 更多资源

- `OPTIMIZATION_SUMMARY.md` - 详细的优化总结
- `MIGRATION_GUIDE.md` - 完整的迁移指南
- 各文件的注释 - 详细的 API 文档
