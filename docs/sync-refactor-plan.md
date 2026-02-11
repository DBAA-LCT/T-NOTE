# OneDrive 同步功能重构方案

## 需求概述

将当前的全局同步模式改为按笔记同步模式，增加页级diff和增量同步功能。

## 核心变更

### 1. 同步模式变更

**当前**：全局同步所有笔记
**新模式**：按笔记同步，每个笔记独立管理

#### 实现要点

- 打开/新建笔记时弹出提示："是否将此笔记同步到OneDrive？"
  - 点击"是"：选择OneDrive目录，标记笔记为已同步
  - 点击"否"：笔记保持本地状态
- 笔记元数据中添加 `syncEnabled: boolean` 字段
- 同步按钮行为：
  - 如果笔记未启用同步：首次点击选择目录并启用同步
  - 如果笔记已启用同步：执行同步操作

### 2. 云笔记面板重构

**当前**：显示所有云端笔记列表
**新模式**：显示当前笔记在云端的页列表

#### 实现要点

```typescript
// 新的云笔记面板接口
interface CloudPagesPanelProps {
  currentNote: Note | null;  // 当前打开的笔记
  onCompare: (pageId: string) => void;  // 比较页面差异
  onRollback: (pageId: string, cloudVersion: Page) => void;  // 回滚到云端版本
}
```

- 面板标题：`云端页面 - ${note.name}`
- 列表项显示：
  - 页面标题
  - 最后修改时间
  - 状态标签：已同步/有差异/仅云端/仅本地
- 点击页面：打开diff视图对比框

### 3. Diff 视图功能

#### 实现要点

```typescript
interface PageDiffDialogProps {
  localPage: Page | null;
  cloudPage: Page | null;
  onRollback: () => void;  // 回滚本地到云端版本
  onClose: () => void;
}
```

- 使用 `diff` 库计算文本差异
- 左右对比视图：
  - 左侧：本地版本（可回滚）
  - 右侧：云端版本（只读）
- 差异高亮：
  - 绿色：新增内容
  - 红色：删除内容
  - 黄色：修改内容
- 操作按钮：
  - "回滚到云端版本"：用云端内容覆盖本地
  - "保持本地版本"：关闭对话框
  - "上传本地版本"：将本地版本上传到云端

### 4. 增量同步（Diff-based Sync）

**当前**：上传/下载整个笔记文件
**新模式**：只传输修改的部分

#### 技术方案

##### 方案A：使用 OneDrive Delta API（推荐）

```typescript
// OneDrive 提供的增量同步API
async getDelta(itemId: string, deltaToken?: string): Promise<{
  changes: DriveItem[];
  deltaToken: string;
}> {
  const endpoint = deltaToken 
    ? `/me/drive/items/${itemId}/delta?token=${deltaToken}`
    : `/me/drive/items/${itemId}/delta`;
  return await this.get(endpoint);
}
```

优点：
- OneDrive原生支持
- 自动处理冲突
- 网络传输最小化

缺点：
- 需要维护deltaToken
- 只能检测文件级变化，不能检测内容级变化

##### 方案B：自定义Diff算法（更精细）

```typescript
interface PageDiff {
  pageId: string;
  changes: {
    type: 'insert' | 'delete' | 'modify';
    position: number;
    oldContent?: string;
    newContent?: string;
  }[];
}

// 计算页面差异
function calculatePageDiff(oldPage: Page, newPage: Page): PageDiff {
  // 使用 diff-match-patch 库
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(oldPage.content, newPage.content);
  dmp.diff_cleanupSemantic(diffs);
  
  return {
    pageId: newPage.id,
    changes: diffs.map(([type, text], index) => ({
      type: type === 1 ? 'insert' : type === -1 ? 'delete' : 'modify',
      position: index,
      oldContent: type === -1 ? text : undefined,
      newContent: type === 1 ? text : undefined
    }))
  };
}

// 应用差异
function applyPageDiff(page: Page, diff: PageDiff): Page {
  // 应用diff到页面内容
  // ...
}
```

优点：
- 精确到内容级别
- 可以显示详细的修改内容
- 减少网络传输

缺点：
- 实现复杂度高
- 需要额外的存储空间保存diff历史

##### 推荐方案：混合模式

1. **文件级**：使用OneDrive Delta API检测哪些笔记文件有变化
2. **内容级**：对变化的笔记使用自定义Diff算法计算具体修改

```typescript
async syncNoteIncremental(noteId: string): Promise<SyncResult> {
  // 1. 检查文件是否有变化（使用Delta API）
  const hasChanges = await this.checkFileChanges(noteId);
  if (!hasChanges) {
    return { status: 'no_changes' };
  }
  
  // 2. 下载云端版本
  const cloudNote = await this.downloadNote(noteId);
  const localNote = await this.fileManager.readNote(noteId);
  
  // 3. 计算每个页面的diff
  const pageDiffs = localNote.pages.map(localPage => {
    const cloudPage = cloudNote.pages.find(p => p.id === localPage.id);
    if (!cloudPage) return null;
    return calculatePageDiff(cloudPage, localPage);
  }).filter(Boolean);
  
  // 4. 只上传有变化的页面
  for (const diff of pageDiffs) {
    await this.uploadPageDiff(noteId, diff);
  }
  
  return { status: 'success', changedPages: pageDiffs.length };
}
```

### 5. 数据结构变更

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
  
  // 新增字段
  syncConfig?: {
    enabled: boolean;           // 是否启用同步
    oneDrivePath: string;       // OneDrive路径
    lastSyncAt: number;         // 最后同步时间
    deltaToken?: string;        // Delta API token
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
  
  // 新增字段
  cloudVersion?: {
    content: string;            // 云端内容
    updatedAt: number;          // 云端更新时间
    hash: string;               // 内容哈希，用于快速比较
  };
}
```

## 实现步骤

### 阶段1：基础架构调整（1-2天）

1. ✅ 修改 Note 和 Page 类型定义
2. ✅ 创建 PageDiffDialog 组件
3. ✅ 重构 CloudNotesPanel 为 CloudPagesPanel
4. ✅ 添加同步提示对话框组件

### 阶段2：同步逻辑重构（2-3天）

1. ✅ 实现按笔记同步逻辑
2. ✅ 添加首次同步目录选择
3. ✅ 实现页面级diff计算
4. ✅ 修改上传/下载逻辑支持增量同步

### 阶段3：UI集成（1-2天）

1. ✅ 集成同步提示到打开/新建笔记流程
2. ✅ 更新同步按钮行为
3. ✅ 实现diff视图UI
4. ✅ 更新云笔记面板UI

### 阶段4：测试和优化（1-2天）

1. ✅ 单元测试
2. ✅ 集成测试
3. ✅ 性能优化
4. ✅ 用户体验优化

## 技术依赖

```json
{
  "dependencies": {
    "diff-match-patch": "^1.0.5",  // Diff算法库
    "react-diff-viewer": "^3.1.1"   // Diff视图组件（可选）
  }
}
```

## 注意事项

1. **向后兼容**：需要处理旧版本笔记的迁移
2. **冲突处理**：增量同步可能导致更复杂的冲突场景
3. **性能考虑**：大文件的diff计算可能耗时
4. **网络优化**：考虑批量上传多个页面的diff
5. **错误恢复**：增量同步失败时的回滚机制

## 用户体验流程

### 新建笔记流程

```
用户点击"新建笔记" 
  → 选择保存位置
  → 创建笔记成功
  → 弹出提示："是否将此笔记同步到OneDrive？"
    → 点击"是"
      → 选择OneDrive目录
      → 标记笔记为已同步
      → 显示同步状态图标
    → 点击"否"
      → 笔记保持本地状态
      → 可以后续通过同步按钮启用
```

### 打开笔记流程

```
用户打开笔记
  → 检查笔记是否已启用同步
    → 已启用
      → 显示同步状态
      → 云笔记面板显示云端页面
    → 未启用
      → 弹出提示："是否将此笔记同步到OneDrive？"
      → （同新建笔记流程）
```

### 同步按钮流程

```
用户点击同步按钮
  → 检查笔记同步状态
    → 未启用同步
      → 弹出目录选择对话框
      → 选择目录后启用同步
      → 执行首次同步
    → 已启用同步
      → 执行增量同步
      → 显示同步进度
      → 完成后更新状态
```

### 云笔记面板流程

```
用户打开云笔记面板
  → 显示当前笔记的云端页面列表
  → 用户点击某个页面
    → 打开Diff对话框
    → 左侧显示本地版本
    → 右侧显示云端版本
    → 高亮显示差异
    → 用户可以选择：
      - 回滚到云端版本
      - 保持本地版本
      - 上传本地版本
```

## API 变更

### 新增 IPC 接口

```typescript
// electron/ipc/handlers.ts

// 启用笔记同步
ipcMain.handle('onedrive:enable-note-sync', async (event, noteId: string, oneDrivePath: string) => {
  // 实现逻辑
});

// 获取页面差异
ipcMain.handle('onedrive:get-page-diff', async (event, noteId: string, pageId: string) => {
  // 实现逻辑
});

// 回滚页面到云端版本
ipcMain.handle('onedrive:rollback-page', async (event, noteId: string, pageId: string) => {
  // 实现逻辑
});

// 获取当前笔记的云端页面列表
ipcMain.handle('onedrive:get-cloud-pages', async (event, noteId: string) => {
  // 实现逻辑
});
```

### 前端 API 扩展

```typescript
// src/types/window.d.ts

interface OneDriveAPI {
  // ... 现有方法
  
  // 新增方法
  enableNoteSync: (noteId: string, oneDrivePath: string) => Promise<void>;
  getPageDiff: (noteId: string, pageId: string) => Promise<PageDiff>;
  rollbackPage: (noteId: string, pageId: string) => Promise<void>;
  getCloudPages: (noteId: string) => Promise<CloudPage[]>;
}
```

## 总结

这个重构方案将同步功能从全局模式改为按笔记模式，增加了页级diff和增量同步功能。主要优势：

1. **更灵活**：用户可以选择哪些笔记需要同步
2. **更精细**：页级diff让用户清楚看到具体修改
3. **更高效**：增量同步减少网络传输
4. **更安全**：可以回滚单个页面的修改

实现难度：中等偏高
预计工期：6-9天
