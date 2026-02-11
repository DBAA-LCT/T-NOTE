# 页面级同步功能实现总结

## 已完成的工作

### 1. 类型定义更新

- ✅ `src/types.ts`: 添加 `Page.syncStatus` 和 `Note.syncConfig`
- ✅ `src/types/onedrive-sync.ts`: 添加 `CloudPage`, `CommitResult`, `PageData`
- ✅ `src/types/window.d.ts`: 添加页面级同步 API 接口

### 2. 后端实现

- ✅ `electron/services/sync-engine.ts`: 实现三个核心方法
  - `commitPage()`: 提交单个页面到云端
  - `getCloudPages()`: 获取云端页面列表
  - `useCloudVersion()`: 使用云端版本覆盖本地
- ✅ `electron/ipc/handlers.ts`: 添加 IPC 处理器
- ✅ `electron/preload.ts`: 暴露新的 API

### 3. 前端组件

- ✅ `src/components/PageCommitButton.tsx`: 页面提交按钮
- ✅ `src/components/CloudPagesPanel.tsx`: 云端页面面板
- ✅ `src/components/EnableSyncDialog.tsx`: 启用同步对话框
- ✅ `src/components/Editor.tsx`: 集成提交按钮
- ✅ `src/App.tsx`: 集成所有组件和自动提交逻辑

## 功能说明

### 核心特性

1. **手动提交（默认）**
   - 每个页面显示同步状态标签
   - 点击"提交到云端"按钮上传
   - 状态：已同步、未提交、提交中、提交失败、云端较新

2. **自动提交（可选）**
   - 在笔记的同步配置中启用
   - 编辑后10秒自动上传
   - 显示"自动同步"标签

3. **页面级存储**
   - OneDrive 中每个页面一个 JSON 文件
   - 结构：`/同步文件夹/笔记ID/页面ID.json`
   - 减少冲突，支持并发编辑不同页面

4. **云端页面查看**
   - 显示当前笔记的所有云端页面
   - 点击查看页面信息
   - 云端较新时可以"使用云端版本"

### 使用流程

#### 启用笔记同步

1. 打开或新建笔记
2. 连接 OneDrive 账号
3. 在设置中为笔记启用同步
4. 选择 OneDrive 文件夹
5. 笔记的 `syncConfig.enabled` 设置为 `true`

#### 提交页面

**手动模式（默认）：**
1. 编辑页面内容
2. 页面标题旁显示"未提交"标签
3. 点击"提交到云端"按钮
4. 上传成功后显示"已同步"

**自动模式：**
1. 在设置中启用"自动提交"
2. 编辑页面内容
3. 10秒后自动上传
4. 显示"自动同步"标签

#### 查看云端页面

1. 打开"云端页面"面板
2. 查看当前笔记的所有云端页面
3. 页面状态：
   - ✓ 已同步（绿色）
   - ⚠ 云端较新（黄色）
   - ⏱ 本地较新（蓝色）
4. 点击页面查看详情
5. 如果云端较新，可以"使用云端版本"

## 技术实现细节

### 内容哈希

使用 SHA-256 哈希快速判断内容是否变化：

```typescript
private calculateHash(content: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### 状态判断

```typescript
private determinePageStatus(
  localPage: any | undefined,
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

### 自动提交

```typescript
useEffect(() => {
  if (!note?.syncConfig?.enabled) return;
  if (!note?.syncConfig?.autoCommit) return;
  if (!currentPageId) return;
  if (!hasUnsavedChanges) return;

  const timer = setTimeout(async () => {
    try {
      await window.electronAPI.onedrive.commitPage(note.id, currentPageId);
      console.log('页面已自动提交到云端');
    } catch (error) {
      console.error('自动提交失败:', error);
    }
  }, 10000);

  return () => clearTimeout(timer);
}, [note, currentPageId, hasUnsavedChanges]);
```

## 数据结构

### Note 类型

```typescript
interface Note {
  id: string;
  name: string;
  pages: Page[];
  // ...
  syncConfig?: {
    enabled: boolean;           // 是否启用同步
    autoCommit: boolean;        // 是否自动提交
    oneDrivePath: string;       // OneDrive路径
    lastSyncAt: number;         // 最后同步时间
  };
}
```

### Page 类型

```typescript
interface Page {
  id: string;
  title: string;
  content: string;
  // ...
  syncStatus?: {
    status: 'not_synced' | 'synced' | 'pending' | 'syncing' | 'error' | 'cloud_newer' | 'local_newer';
    lastSyncAt?: number;
    cloudUpdatedAt?: number;
    contentHash?: string;
    error?: string;
  };
}
```

### OneDrive 文件结构

```
/OneDrive/Notes/
  /笔记ID-abc123/
    页面ID-1.json
    页面ID-2.json
    页面ID-3.json
```

每个页面文件内容：

```json
{
  "id": "页面ID-1",
  "title": "第1页",
  "content": "<p>页面内容...</p>",
  "tags": ["标签1"],
  "bookmarks": [],
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

## 待完成的工作

### 必需功能

1. ⏳ 在打开/新建笔记时提示启用同步
   - 检查是否已连接 OneDrive
   - 弹出对话框询问是否启用同步
   - 选择 OneDrive 文件夹

2. ⏳ 在 OneDriveSettingsPanel 中添加当前笔记的同步设置
   - 显示当前笔记的同步状态
   - 切换"自动提交"开关
   - 显示同步统计信息

### 可选优化

1. 批量提交多个页面
2. 提交历史记录
3. 冲突智能合并
4. 离线队列管理
5. 同步进度显示
6. 错误重试机制

## 测试清单

### 基础功能测试

- [ ] 启用笔记同步
- [ ] 手动提交页面
- [ ] 自动提交页面
- [ ] 查看云端页面列表
- [ ] 使用云端版本覆盖本地
- [ ] 切换自动提交开关

### 边界情况测试

- [ ] 网络断开时提交
- [ ] 提交失败后重试
- [ ] 云端文件被删除
- [ ] 多设备同时编辑
- [ ] 大文件上传
- [ ] 特殊字符处理

### 性能测试

- [ ] 大量页面的笔记
- [ ] 频繁编辑时的性能
- [ ] 自动提交的延迟
- [ ] 云端列表加载速度

## 使用示例

### 启用同步

```typescript
// 用户打开笔记后
const note = loadedNote;

// 检查是否已启用同步
if (!note.syncConfig?.enabled) {
  // 显示启用同步对话框
  showEnableSyncDialog(note.id, note.name);
}
```

### 手动提交

```typescript
// 用户点击"提交到云端"按钮
const result = await window.electronAPI.onedrive.commitPage(noteId, pageId);

if (result.success) {
  if (result.skipped) {
    message.info('页面内容未变化');
  } else {
    message.success('页面已提交到云端');
  }
}
```

### 查看云端页面

```typescript
// 打开云端页面面板
const cloudPages = await window.electronAPI.onedrive.getCloudPages(noteId);

// 显示页面列表
cloudPages.forEach(page => {
  console.log(`${page.name}: ${page.status}`);
});
```

### 使用云端版本

```typescript
// 用户点击"使用云端版本"
await window.electronAPI.onedrive.useCloudVersion(noteId, pageId);

// 重新加载笔记
reloadNote();
```

## 注意事项

1. **数据安全**
   - 使用云端版本前会创建本地备份
   - 备份保存在 `userData/backups/` 目录

2. **网络要求**
   - 需要稳定的网络连接
   - 支持离线编辑，恢复网络后手动提交

3. **存储限制**
   - 受 OneDrive 存储空间限制
   - 单个文件不超过 4MB（使用简单上传）

4. **并发控制**
   - 不支持实时协作
   - 多设备编辑可能导致冲突
   - 建议一次只在一个设备上编辑

## 总结

页面级同步功能已基本实现，核心功能包括：

1. ✅ 手动/自动提交模式
2. ✅ 页面级存储和同步
3. ✅ 云端页面查看
4. ✅ 使用云端版本
5. ✅ 同步状态展示

下一步需要完善启用同步的用户流程和设置界面。
