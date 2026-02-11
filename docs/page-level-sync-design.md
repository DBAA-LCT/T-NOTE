# 页面级同步设计方案（最终版）

## 核心设计

### 1. 同步模式

- **手动提交**（默认）：用户点击页面上的"提交"按钮上传
- **自动提交**（可选）：编辑后自动上传到云端
- 通过设置面板切换模式

### 2. 页面级提交

每个页面独立提交到云端，而不是整个笔记。

### 3. 云笔记面板

- 显示当前笔记在云端的所有页面
- 点击页面查看云端版本（只读）
- 可以"使用云端版本"覆盖本地

### 4. 无回滚功能

只提供"使用云端版本"，不提供复杂的回滚或合并。

## 用户界面设计

### 编辑器页面

```
┌─────────────────────────────────────────┐
│ 第1页 ▼  [未提交] [提交到云端]          │
├─────────────────────────────────────────┤
│                                         │
│  编辑器内容...                          │
│                                         │
└─────────────────────────────────────────┘
```

- 页面标题旁显示状态标签
- "提交到云端"按钮（手动模式）
- 自动模式下显示"自动同步中..."

### 云笔记面板

```
┌─────────────────────────┐
│ 云端页面 - 我的笔记     │
├─────────────────────────┤
│ ✓ 第1页  已同步         │
│   2024-02-11 10:30      │
├─────────────────────────┤
│ ⚠ 第2页  云端较新       │
│   2024-02-11 10:25      │
├─────────────────────────┤
│ ⏱ 第3页  未提交         │
│   本地修改              │
└─────────────────────────┘
```

点击页面后弹出对话框：
- 左侧：本地版本
- 右侧：云端版本
- 按钮："使用云端版本"

### 设置面板

```
┌─────────────────────────┐
│ OneDrive 设置           │
├─────────────────────────┤
│ □ 自动提交到云端        │
│   编辑后自动上传页面    │
│                         │
│ □ 仅WiFi同步            │
│                         │
│ 同步文件夹：            │
│ /Notes                  │
│ [选择文件夹]            │
└─────────────────────────┘
```

## 技术实现

### 存储结构（推荐方案）


#### 方案A：每个页面一个文件（推荐）

```
OneDrive 结构：
/Notes/
  /我的笔记_abc123/
    metadata.json      # 笔记元数据
    page-1.json        # 第1页
    page-2.json        # 第2页
    page-3.json        # 第3页
```

**metadata.json**:
```json
{
  "id": "abc123",
  "name": "我的笔记",
  "createdAt": 1234567890,
  "updatedAt": 1234567890,
  "pages": [
    { "id": "page-1", "title": "第1页", "order": 0 },
    { "id": "page-2", "title": "第2页", "order": 1 },
    { "id": "page-3", "title": "第3页", "order": 2 }
  ]
}
```

**page-1.json**:
```json
{
  "id": "page-1",
  "title": "第1页",
  "content": "页面内容...",
  "tags": ["标签1"],
  "bookmarks": [],
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

**优点**：
- 真正的页面级同步
- 每个页面独立上传/下载
- 减少冲突
- 支持并发编辑不同页面

**缺点**：
- 需要重构存储逻辑
- 文件数量增多

### 数据结构

#### Note 类型扩展

```typescript
interface Note {
  id: string;
  name: string;
  pages: Page[];
  todos?: TodoItem[];
  trash?: any[];
  createdAt: number;
  updatedAt: number;
  
  // 同步配置
  syncConfig?: {
    enabled: boolean;           // 是否启用同步
    autoCommit: boolean;        // 是否自动提交（默认false）
    oneDrivePath: string;       // OneDrive路径
    lastSyncAt: number;         // 最后同步时间
  };
}
```

#### Page 类型扩展

```typescript
interface Page {
  id: string;
  title: string;
  content: string;
  tags: string[];
  bookmarks?: Bookmark[];
  createdAt: number;
  updatedAt: number;
  
  // 同步状态
  syncStatus?: {
    status: 'not_synced' | 'synced' | 'pending' | 'syncing' | 'error' | 'cloud_newer';
    lastSyncAt?: number;        // 最后同步时间
    cloudUpdatedAt?: number;    // 云端更新时间
    contentHash?: string;       // 内容哈希，用于快速比较
    error?: string;             // 错误信息
  };
}
```

### 核心 API

#### 1. 提交页面到云端

```typescript
// electron/services/sync-engine.ts
async commitPage(noteId: string, pageId: string): Promise<CommitResult> {
  logger.info('sync', 'Committing page to cloud', { noteId, pageId });
  
  try {
    // 1. 读取笔记和页面
    const note = await this.fileManager.readNote(noteId);
    const page = note.pages.find(p => p.id === pageId);
    if (!page) throw new Error('Page not found');
    
    // 2. 检查同步配置
    if (!note.syncConfig?.enabled) {
      throw new Error('Sync not enabled for this note');
    }
    
    // 3. 计算内容哈希
    const contentHash = this.calculateHash(page.content);
    
    // 4. 检查是否需要上传（内容未变化则跳过）
    if (page.syncStatus?.contentHash === contentHash) {
      logger.info('sync', 'Page content unchanged, skipping upload');
      return { success: true, skipped: true };
    }
    
    // 5. 上传页面到 OneDrive
    const remotePath = `${note.syncConfig.oneDrivePath}/${noteId}/${pageId}.json`;
    const pageData = {
      id: page.id,
      title: page.title,
      content: page.content,
      tags: page.tags,
      bookmarks: page.bookmarks,
      createdAt: page.createdAt,
      updatedAt: Date.now()
    };
    
    const tempFile = await this.createTempFile(JSON.stringify(pageData, null, 2));
    await this.oneDriveClient.uploadFile(tempFile, remotePath);
    await this.deleteTempFile(tempFile);
    
    // 6. 更新页面同步状态
    page.syncStatus = {
      status: 'synced',
      lastSyncAt: Date.now(),
      cloudUpdatedAt: Date.now(),
      contentHash: contentHash
    };
    
    await this.fileManager.writeNote(note);
    
    logger.info('sync', 'Page committed successfully', { noteId, pageId });
    
    return { success: true, skipped: false };
  } catch (error) {
    logger.error('sync', 'Failed to commit page', error as Error, { noteId, pageId });
    
    // 更新错误状态
    const note = await this.fileManager.readNote(noteId);
    const page = note.pages.find(p => p.id === pageId);
    if (page) {
      page.syncStatus = {
        status: 'error',
        error: (error as Error).message
      };
      await this.fileManager.writeNote(note);
    }
    
    throw error;
  }
}
```

#### 2. 获取云端页面列表

```typescript
async getCloudPages(noteId: string): Promise<CloudPage[]> {
  logger.info('sync', 'Fetching cloud pages', { noteId });
  
  try {
    const note = await this.fileManager.readNote(noteId);
    
    if (!note.syncConfig?.enabled) {
      return [];
    }
    
    // 列出云端文件夹中的所有页面文件
    const folderPath = `${note.syncConfig.oneDrivePath}/${noteId}`;
    const items = await this.oneDriveClient.listFiles(folderPath);
    
    // 过滤出页面文件
    const pageFiles = items.filter(item => 
      item.file && item.name.endsWith('.json') && item.name !== 'metadata.json'
    );
    
    // 构建云端页面列表
    const cloudPages: CloudPage[] = [];
    
    for (const file of pageFiles) {
      const pageId = file.name.replace('.json', '');
      const localPage = note.pages.find(p => p.id === pageId);
      
      cloudPages.push({
        id: pageId,
        name: file.name,
        updatedAt: new Date(file.lastModifiedDateTime).getTime(),
        size: file.size,
        existsLocally: !!localPage,
        status: this.determinePageStatus(localPage, new Date(file.lastModifiedDateTime).getTime())
      });
    }
    
    return cloudPages;
  } catch (error) {
    logger.error('sync', 'Failed to fetch cloud pages', error as Error, { noteId });
    throw error;
  }
}

private determinePageStatus(
  localPage: Page | undefined, 
  cloudUpdatedAt: number
): 'synced' | 'cloud_newer' | 'local_newer' | 'not_synced' {
  if (!localPage) return 'not_synced';
  
  const localUpdatedAt = localPage.updatedAt;
  const lastSyncAt = localPage.syncStatus?.lastSyncAt || 0;
  
  if (cloudUpdatedAt > lastSyncAt && cloudUpdatedAt > localUpdatedAt) {
    return 'cloud_newer';
  }
  
  if (localUpdatedAt > lastSyncAt) {
    return 'local_newer';
  }
  
  return 'synced';
}
```

#### 3. 使用云端版本

```typescript
async useCloudVersion(noteId: string, pageId: string): Promise<void> {
  logger.info('sync', 'Using cloud version', { noteId, pageId });
  
  try {
    const note = await this.fileManager.readNote(noteId);
    
    if (!note.syncConfig?.enabled) {
      throw new Error('Sync not enabled');
    }
    
    // 1. 下载云端页面
    const remotePath = `${note.syncConfig.oneDrivePath}/${noteId}/${pageId}.json`;
    const tempFile = await this.createTempFile('');
    
    // 获取文件ID
    const items = await this.oneDriveClient.listFiles(`${note.syncConfig.oneDrivePath}/${noteId}`);
    const pageFile = items.find(item => item.name === `${pageId}.json`);
    if (!pageFile) throw new Error('Cloud page not found');
    
    await this.oneDriveClient.downloadFile(pageFile.id, tempFile);
    
    // 2. 读取云端内容
    const cloudPageData = JSON.parse(await fs.readFile(tempFile, 'utf-8'));
    await this.deleteTempFile(tempFile);
    
    // 3. 创建本地备份
    const localPage = note.pages.find(p => p.id === pageId);
    if (localPage) {
      await this.fileManager.createBackup(noteId);
    }
    
    // 4. 更新本地页面
    const pageIndex = note.pages.findIndex(p => p.id === pageId);
    if (pageIndex >= 0) {
      note.pages[pageIndex] = {
        ...cloudPageData,
        syncStatus: {
          status: 'synced',
          lastSyncAt: Date.now(),
          cloudUpdatedAt: cloudPageData.updatedAt,
          contentHash: this.calculateHash(cloudPageData.content)
        }
      };
    } else {
      // 页面不存在，添加新页面
      note.pages.push({
        ...cloudPageData,
        syncStatus: {
          status: 'synced',
          lastSyncAt: Date.now(),
          cloudUpdatedAt: cloudPageData.updatedAt,
          contentHash: this.calculateHash(cloudPageData.content)
        }
      });
    }
    
    note.updatedAt = Date.now();
    await this.fileManager.writeNote(note);
    
    logger.info('sync', 'Cloud version applied successfully', { noteId, pageId });
  } catch (error) {
    logger.error('sync', 'Failed to use cloud version', error as Error, { noteId, pageId });
    throw error;
  }
}
```

#### 4. 自动提交（可选）

```typescript
// 在 App.tsx 中
useEffect(() => {
  if (!note?.syncConfig?.enabled) return;
  if (!note?.syncConfig?.autoCommit) return;
  if (!currentPageId) return;
  
  const currentPage = note.pages.find(p => p.id === currentPageId);
  if (!currentPage) return;
  
  // Debounce 自动提交
  const timer = setTimeout(async () => {
    try {
      await window.electronAPI.onedrive.commitPage(note.id, currentPageId);
      console.log('页面已自动提交');
    } catch (error) {
      console.error('自动提交失败:', error);
      message.error('自动提交失败');
    }
  }, 10000); // 10秒后提交
  
  return () => clearTimeout(timer);
}, [note, currentPageId, currentPage?.content]);
```

### IPC 接口

```typescript
// electron/ipc/handlers.ts

// 提交页面
ipcMain.handle('onedrive:commit-page', async (event, noteId: string, pageId: string) => {
  const syncEngine = getSyncEngine();
  return await syncEngine.commitPage(noteId, pageId);
});

// 获取云端页面列表
ipcMain.handle('onedrive:get-cloud-pages', async (event, noteId: string) => {
  const syncEngine = getSyncEngine();
  return await syncEngine.getCloudPages(noteId);
});

// 使用云端版本
ipcMain.handle('onedrive:use-cloud-version', async (event, noteId: string, pageId: string) => {
  const syncEngine = getSyncEngine();
  return await syncEngine.useCloudVersion(noteId, pageId);
});

// 启用笔记同步
ipcMain.handle('onedrive:enable-note-sync', async (event, noteId: string, oneDrivePath: string) => {
  const fileManager = getFileManager();
  const note = await fileManager.readNote(noteId);
  
  note.syncConfig = {
    enabled: true,
    autoCommit: false,  // 默认不自动提交
    oneDrivePath: oneDrivePath,
    lastSyncAt: Date.now()
  };
  
  await fileManager.writeNote(note);
  
  // 创建云端文件夹
  const oneDriveClient = getOneDriveClient();
  await oneDriveClient.createFolder(noteId, oneDrivePath);
  
  return { success: true };
});

// 更新同步设置
ipcMain.handle('onedrive:update-sync-settings', async (event, noteId: string, settings: Partial<SyncConfig>) => {
  const fileManager = getFileManager();
  const note = await fileManager.readNote(noteId);
  
  if (!note.syncConfig) {
    throw new Error('Sync not enabled for this note');
  }
  
  note.syncConfig = {
    ...note.syncConfig,
    ...settings
  };
  
  await fileManager.writeNote(note);
  
  return { success: true };
});
```

### 前端组件

#### 1. 页面提交按钮

```typescript
// src/components/PageCommitButton.tsx
interface PageCommitButtonProps {
  noteId: string;
  pageId: string;
  syncStatus?: Page['syncStatus'];
  autoCommit: boolean;
}

export default function PageCommitButton({ 
  noteId, 
  pageId, 
  syncStatus,
  autoCommit 
}: PageCommitButtonProps) {
  const [committing, setCommitting] = useState(false);
  
  const handleCommit = async () => {
    setCommitting(true);
    try {
      await window.electronAPI.onedrive.commitPage(noteId, pageId);
      message.success('页面已提交到云端');
    } catch (error: any) {
      message.error(error.message || '提交失败');
    } finally {
      setCommitting(false);
    }
  };
  
  if (autoCommit) {
    return (
      <Tag icon={<SyncOutlined spin={syncStatus?.status === 'syncing'} />} color="blue">
        自动同步中
      </Tag>
    );
  }
  
  const getStatusTag = () => {
    switch (syncStatus?.status) {
      case 'synced':
        return <Tag icon={<CheckCircleOutlined />} color="success">已同步</Tag>;
      case 'pending':
      case 'local_newer':
        return <Tag icon={<ExclamationCircleOutlined />} color="warning">未提交</Tag>;
      case 'syncing':
        return <Tag icon={<SyncOutlined spin />} color="processing">提交中</Tag>;
      case 'error':
        return <Tag icon={<CloseCircleOutlined />} color="error">提交失败</Tag>;
      case 'cloud_newer':
        return <Tag icon={<CloudDownloadOutlined />} color="orange">云端较新</Tag>;
      default:
        return <Tag>未同步</Tag>;
    }
  };
  
  return (
    <Space>
      {getStatusTag()}
      {syncStatus?.status !== 'synced' && syncStatus?.status !== 'syncing' && (
        <Button
          type="primary"
          size="small"
          icon={<CloudUploadOutlined />}
          onClick={handleCommit}
          loading={committing}
        >
          提交到云端
        </Button>
      )}
    </Space>
  );
}
```

#### 2. 云端页面面板

```typescript
// src/components/CloudPagesPanel.tsx
interface CloudPagesPanelProps {
  currentNote: Note | null;
  onPageUpdate: () => void;
}

export default function CloudPagesPanel({ currentNote, onPageUpdate }: CloudPagesPanelProps) {
  const [cloudPages, setCloudPages] = useState<CloudPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [diffDialog, setDiffDialog] = useState<{
    visible: boolean;
    localPage?: Page;
    cloudPage?: CloudPage;
  }>({ visible: false });
  
  useEffect(() => {
    if (currentNote?.syncConfig?.enabled) {
      loadCloudPages();
    }
  }, [currentNote]);
  
  const loadCloudPages = async () => {
    if (!currentNote) return;
    
    setLoading(true);
    try {
      const pages = await window.electronAPI.onedrive.getCloudPages(currentNote.id);
      setCloudPages(pages);
    } catch (error: any) {
      message.error(error.message || '加载云端页面失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePageClick = async (cloudPage: CloudPage) => {
    const localPage = currentNote?.pages.find(p => p.id === cloudPage.id);
    setDiffDialog({
      visible: true,
      localPage,
      cloudPage
    });
  };
  
  const handleUseCloudVersion = async (pageId: string) => {
    if (!currentNote) return;
    
    try {
      await window.electronAPI.onedrive.useCloudVersion(currentNote.id, pageId);
      message.success('已使用云端版本');
      setDiffDialog({ visible: false });
      onPageUpdate();
      loadCloudPages();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };
  
  if (!currentNote?.syncConfig?.enabled) {
    return (
      <Empty description="此笔记未启用同步" />
    );
  }
  
  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text strong>云端页面 - {currentNote.name}</Text>
        <Button icon={<ReloadOutlined />} size="small" onClick={loadCloudPages} loading={loading}>
          刷新
        </Button>
      </div>
      
      <List
        loading={loading}
        dataSource={cloudPages}
        renderItem={(page) => (
          <List.Item
            onClick={() => handlePageClick(page)}
            style={{ cursor: 'pointer' }}
          >
            <List.Item.Meta
              title={
                <Space>
                  {page.name}
                  {page.status === 'synced' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  {page.status === 'cloud_newer' && <ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                  {page.status === 'local_newer' && <ClockCircleOutlined style={{ color: '#1890ff' }} />}
                </Space>
              }
              description={new Date(page.updatedAt).toLocaleString('zh-CN')}
            />
          </List.Item>
        )}
      />
      
      <PageDiffDialog
        visible={diffDialog.visible}
        localPage={diffDialog.localPage}
        cloudPage={diffDialog.cloudPage}
        onUseCloud={() => handleUseCloudVersion(diffDialog.cloudPage!.id)}
        onClose={() => setDiffDialog({ visible: false })}
      />
    </div>
  );
}
```

## 实现步骤

### 阶段1：基础架构（2天）

1. 修改 Note 和 Page 类型定义
2. 实现"每个页面一个文件"的存储逻辑
3. 创建基础 IPC 接口

### 阶段2：核心功能（3天）

1. 实现 commitPage 方法
2. 实现 getCloudPages 方法
3. 实现 useCloudVersion 方法
4. 添加自动提交逻辑（可选）

### 阶段3：UI 集成（2天）

1. 创建 PageCommitButton 组件
2. 重构 CloudNotesPanel 为 CloudPagesPanel
3. 创建 PageDiffDialog 组件
4. 在设置面板添加"自动提交"开关

### 阶段4：测试优化（2天）

1. 单元测试
2. 集成测试
3. 性能优化
4. 用户体验优化

## 总结

这个方案的核心特点：

1. **灵活的提交模式**：手动提交（默认）+ 自动提交（可选）
2. **页面级同步**：每个页面独立提交，减少冲突
3. **简单的云端查看**：只读查看 + 使用云端版本
4. **清晰的状态展示**：每个页面的同步状态一目了然

预计工期：7-9天
