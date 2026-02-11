# 云同步功能修复说明

## 修复的问题

### 1. 上传文件名与本地文件名一致

**问题描述：**
之前上传到云端的文件名总是使用笔记ID（如 `abc123.note`），而不是本地实际的文件名。

**修复方案：**
- 修改上传逻辑，从 `currentFilePath` 提取本地文件名
- 如果有本地文件路径，使用 `path.basename(currentFilePath)` 获取文件名
- 如果没有本地文件路径（新建未保存的笔记），则使用笔记ID作为文件名

**修改文件：**
- `electron/ipc/handlers.ts` - 上传处理器
- `src/components/UploadToCloudButton.tsx` - 传递 currentFilePath
- `src/components/TopBar.tsx` - 传递 currentFilePath 给上传按钮

**代码示例：**
```typescript
// 确定文件名
let fileName: string;
if (currentFilePath) {
  fileName = path.basename(currentFilePath);
} else {
  fileName = `${noteId}.note`;
}
```

### 2. 本地改文件名后同步到云端

**问题描述：**
当用户在本地重命名笔记文件时，云端的文件名不会同步更新。

**修复方案：**
- 修改 `rename-file` IPC 处理器
- 在本地重命名成功后，检查笔记是否启用了云端同步
- 如果启用了同步，将新文件名的笔记重新上传到云端
- 云端会自动覆盖旧文件名的文件

**修改文件：**
- `electron/main.ts` - rename-file 处理器

**代码示例：**
```typescript
// 本地重命名成功后
await fs.rename(oldPath, newPath);

// 检查是否需要同步到云端
if (note.syncConfig?.enabled && note.syncMetadata?.cloudId) {
  const newFileName = path.basename(newPath);
  const remotePath = `${syncFolder}/${newFileName}`;
  await client.uploadFile(tempFilePath, remotePath);
}
```

### 3. 上传后按钮变成同步按钮

**问题描述：**
上传成功后，"上传到云端"按钮应该变成"同步"按钮，但没有自动切换。

**修复方案：**
- 上传成功后，更新笔记的 `syncConfig.enabled` 为 `true`
- TopBar 根据 `currentNote.syncConfig?.enabled` 判断显示哪个按钮
- 上传成功后重新加载笔记，触发按钮切换

**修改文件：**
- `electron/ipc/handlers.ts` - 上传成功后更新 syncConfig
- `src/components/TopBar.tsx` - 条件渲染按钮
- `src/App.tsx` - 上传成功后重新加载笔记

**代码示例：**
```typescript
// 上传成功后更新配置
updatedNote.syncConfig = {
  enabled: true,
  autoCommit: false,
  oneDrivePath: syncFolder,
  lastSyncAt: Date.now()
};

// TopBar 中的条件渲染
{!currentNote.syncConfig?.enabled && <UploadToCloudButton />}
{currentNote.syncConfig?.enabled && <OneDriveSyncButton />}
```

### 4. 上传的笔记没有内容

**问题描述：**
上传到云端的笔记文件可能缺少内容或内容不完整。

**修复方案：**
- 添加内容验证和日志
- 在前端验证笔记内容格式
- 在后端验证临时文件写入是否成功
- 添加详细的日志记录每个步骤

**修改文件：**
- `src/components/UploadToCloudButton.tsx` - 添加前端验证
- `electron/ipc/handlers.ts` - 添加后端验证和日志

**验证步骤：**
```typescript
// 前端验证
const note = JSON.parse(noteContent);
if (!note.pages || note.pages.length === 0) {
  message.warning('笔记没有任何页面');
}

// 后端验证
const tempFileContent = await fs.readFile(tempFilePath, 'utf-8');
logger.info('Temp file created', { 
  originalLength: noteContent.length,
  tempFileLength: tempFileContent.length,
  match: noteContent === tempFileContent
});
```

## 修改的文件列表

1. **electron/ipc/handlers.ts**
   - 修改 `onedrive:sync:uploadNoteContent` 处理器
   - 添加文件名提取逻辑
   - 添加同步配置更新
   - 添加详细日志

2. **electron/main.ts**
   - 修改 `rename-file` 处理器
   - 添加云端同步重命名逻辑

3. **src/components/UploadToCloudButton.tsx**
   - 添加 `currentFilePath` 参数
   - 添加前端内容验证
   - 添加上传日志

4. **src/components/TopBar.tsx**
   - 添加 `currentFilePath` 参数
   - 传递给 UploadToCloudButton

5. **src/App.tsx**
   - 传递 `currentFilePath` 给 TopBar

6. **src/types/window.d.ts**
   - 更新 `uploadNoteContent` 类型定义
   - 添加 `fileName` 返回值

7. **src/types/onedrive-sync.ts**
   - 更新 `UploadResult` 类型
   - 添加 `fileName` 字段

## 测试建议

### 测试场景 1：上传新笔记
1. 创建一个新笔记，添加几个页面和内容
2. 保存笔记到本地（如 `my-note.note`）
3. 点击"上传到云端"
4. 验证：
   - 云端文件名是 `my-note.note`
   - 文件包含所有页面和内容
   - 按钮变成"同步"按钮

### 测试场景 2：重命名本地文件
1. 打开一个已上传的笔记
2. 在文件管理器中重命名文件（如改为 `renamed-note.note`）
3. 在应用中重新打开笔记
4. 验证：
   - 云端出现新文件名 `renamed-note.note`
   - 文件内容完整

### 测试场景 3：验证内容完整性
1. 创建一个包含多个页面的笔记
2. 每个页面添加不同的内容
3. 上传到云端
4. 从云端下载
5. 验证：
   - 所有页面都存在
   - 所有内容都完整
   - 标签、书签等元数据都保留

### 测试场景 4：按钮状态切换
1. 创建新笔记（显示"上传到云端"按钮）
2. 上传到云端
3. 验证按钮变成"同步"按钮
4. 关闭并重新打开笔记
5. 验证按钮仍然是"同步"按钮

## 调试日志

如果遇到问题，可以查看以下日志：

### 前端日志（浏览器控制台）
```
准备上传笔记: {
  id: "...",
  name: "...",
  pagesCount: 3,
  contentLength: 1234
}
```

### 后端日志（Electron 日志）
```
[sync] IPC: Uploading note content { noteName: "...", noteId: "...", contentLength: 1234 }
[sync] Note parsed successfully { id: "...", name: "...", pagesCount: 3 }
[sync] Using filename from local path { fileName: "my-note.note", currentFilePath: "..." }
[sync] Temp file created { tempFilePath: "...", originalLength: 1234, tempFileLength: 1234, match: true }
[sync] Uploading to OneDrive { remotePath: "/Notes/my-note.note" }
[sync] IPC: Note content uploaded successfully { noteId: "...", cloudId: "...", fileName: "my-note.note", size: 1234 }
```

## 已知限制

1. **重命名同步延迟**
   - 本地重命名后，云端同步可能需要几秒钟
   - 如果网络较慢，可能需要更长时间

2. **文件名冲突**
   - 如果云端已存在同名文件，会被覆盖
   - 建议使用唯一的文件名

3. **大文件上传**
   - 非常大的笔记文件可能需要较长时间上传
   - 建议将大笔记拆分成多个小笔记

## 后续改进建议

1. **进度显示**
   - 添加上传进度条
   - 显示上传速度和剩余时间

2. **冲突检测**
   - 检测文件名冲突
   - 提供重命名或覆盖选项

3. **批量操作**
   - 支持批量上传多个笔记
   - 支持批量重命名

4. **自动同步选项**
   - 添加自动同步开关
   - 文件修改后自动上传
