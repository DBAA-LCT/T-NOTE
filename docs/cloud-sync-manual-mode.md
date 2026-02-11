# 云端同步手动模式实现说明

## 概述

根据需求，实现了以下功能：

1. **上传云端按钮**：如果笔记在云端不存在，显示"上传到云端"按钮
2. **手动同步**：只有手动点击同步按钮才会上传，不自动同步
3. **下载云端笔记**：可以从云端选择笔记下载到本地并打开
4. **取消重命名同步**：修改笔记名时不再同步修改文件名
5. **保持唯一性**：笔记与云端连接后，点击同步就上传本地内容到云端

## 实现的功能

### 1. 取消笔记名与文件名同步

**文件**: `src/App.tsx`

修改了 `updateNoteName` 函数，现在只更新笔记名，不再尝试重命名文件：

```typescript
const updateNoteName = async (name: string) => {
  if (!note) return;
  
  // 只更新笔记名，不再同步修改文件名
  setNote(prev => prev ? ({
    ...prev,
    name,
    updatedAt: Date.now()
  }) : null);
  setHasUnsavedChanges(true);
  message.success('笔记名已更新');
};
```

### 2. 云端笔记列表组件

**文件**: `src/components/CloudNotesPanel.tsx`

新建的组件，用于显示云端所有笔记，并支持下载到本地：

- 显示云端笔记列表
- 显示笔记的更新时间和大小
- 标记已在本地存在的笔记
- 点击"下载"按钮可以选择保存位置并下载笔记

### 3. 上传到云端按钮组件

**文件**: `src/components/UploadToCloudButton.tsx`

新建的组件，用于将当前笔记上传到云端：

- 显示"上传到云端"按钮
- 点击后弹出对话框，可以选择云端文件夹
- 上传笔记内容到 OneDrive

### 4. TopBar 修改

**文件**: `src/components/TopBar.tsx`

修改了顶部栏，根据笔记的云端同步状态显示不同的按钮：

- 如果笔记未启用云端同步（`!currentNote.syncConfig?.enabled`），显示"上传到云端"按钮
- 如果笔记已启用云端同步（`currentNote.syncConfig?.enabled`），显示"同步"按钮

### 5. IconBar 修改

**文件**: `src/components/IconBar.tsx`

添加了新的图标：

- "云端页面"：显示当前笔记在云端的所有页面
- "云端笔记"：显示云端所有笔记列表

### 6. IPC 接口

**文件**: `electron/ipc/handlers.ts`

已经实现了以下接口：

- `onedrive:sync:uploadNoteContent`：上传笔记内容到云端
- `onedrive:get-cloud-pages`：获取云端页面列表
- `onedrive:commit-page`：提交单个页面到云端
- `onedrive:use-cloud-version`：使用云端版本覆盖本地

## 使用流程

### 上传笔记到云端

1. 打开一个本地笔记
2. 如果笔记未连接云端，顶部会显示"上传到云端"按钮
3. 点击按钮，选择云端文件夹路径（如 `/Notes`）
4. 点击"上传"，笔记将被上传到 OneDrive

### 下载云端笔记

1. 点击左侧的"云端笔记"图标
2. 查看云端笔记列表
3. 点击"下载"按钮
4. 选择保存位置
5. 笔记将被下载到本地

### 手动同步

1. 打开已连接云端的笔记
2. 修改笔记内容
3. 点击顶部的"同步"按钮
4. 本地内容将上传到云端

## 注意事项

1. **手动同步**：目前只支持手动点击同步按钮，不会自动同步
2. **文件名独立**：修改笔记名不会影响文件名
3. **唯一性**：每个笔记通过 ID 与云端关联，保证唯一性
4. **页面级同步**：支持单独同步某个页面，而不是整个笔记

## 待完善功能

1. **文件夹浏览器**：目前文件夹选择需要手动输入路径，可以添加可视化的文件夹浏览器
2. **同步状态显示**：可以添加更详细的同步状态指示
3. **冲突处理**：当本地和云端都有修改时的冲突处理
4. **批量操作**：支持批量上传或下载笔记

## 技术细节

### 笔记的云端同步配置

每个笔记都有一个 `syncConfig` 属性：

```typescript
syncConfig?: {
  enabled: boolean;           // 是否启用同步
  autoCommit: boolean;        // 是否自动提交（目前设为 false）
  oneDrivePath: string;       // OneDrive 路径
  lastSyncAt: number;         // 最后同步时间
}
```

### 页面的同步状态

每个页面都有一个 `syncStatus` 属性：

```typescript
syncStatus?: {
  status: 'not_synced' | 'synced' | 'pending' | 'syncing' | 'error' | 'cloud_newer' | 'local_newer';
  lastSyncAt?: number;        // 最后同步时间
  cloudUpdatedAt?: number;    // 云端更新时间
  contentHash?: string;       // 内容哈希
  error?: string;             // 错误信息
}
```

## 测试建议

1. 测试上传新笔记到云端
2. 测试从云端下载笔记
3. 测试修改笔记名（确认文件名不变）
4. 测试手动同步功能
5. 测试页面级同步
