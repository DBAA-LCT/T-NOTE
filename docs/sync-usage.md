# OneDrive 同步使用说明

## 当前状态

OneDrive 同步功能已经实现了基础架构，但需要注意以下几点：

### 笔记存储说明

T-Note 目前有两个笔记存储系统：

1. **本地文件系统** - 你通过"打开"和"另存为"保存的笔记
   - 位置：用户选择的任意位置
   - 格式：.note 文件

2. **OneDrive 同步系统** - 专门用于云同步的笔记
   - 位置：OneDrive 中你选择的同步文件夹
   - 格式：.note 文件

### 如何使用同步功能

#### 方法 1: 上传当前笔记（推荐）

1. 在编辑器中打开或创建一个笔记
2. 确保已连接 OneDrive 并选择了同步文件夹
3. 使用 `window.electronAPI.onedrive.uploadNoteContent()` 上传当前笔记

```javascript
// 在浏览器控制台中执行
const noteContent = JSON.stringify(yourNoteObject);
await window.electronAPI.onedrive.uploadNoteContent(noteContent, '笔记名称');
```

#### 方法 2: 手动复制到同步文件夹

1. 将你的 .note 文件复制到 OneDrive 的同步文件夹
2. 点击同步按钮
3. 文件会自动同步

#### 方法 3: 从云端下载

1. 打开"云端笔记"面板
2. 查看 OneDrive 中的笔记列表
3. 点击"下载"按钮下载到本地

### 查看同步状态

- 点击 OneDrive 图标查看同步状态
- 绿色：已同步
- 蓝色：正在同步
- 红色：同步失败
- 灰色：未连接

### 常见问题

**Q: 为什么点击同步后云端没有笔记？**

A: 同步功能会同步应用数据目录中的笔记，而不是你通过"另存为"保存的笔记。你需要：
1. 手动将笔记文件复制到 OneDrive 同步文件夹，或
2. 使用 `uploadNoteContent` API 上传当前编辑的笔记

**Q: 如何让应用自动同步我的笔记？**

A: 未来版本会添加：
- 自动上传当前笔记的按钮
- 统一的笔记存储系统
- 自动同步选项

### 技术说明

同步引擎已完全实现，包括：
- ✅ 双向同步
- ✅ 冲突检测
- ✅ 增量上传/下载
- ✅ 文件完整性验证
- ✅ 备份和恢复

需要改进的部分：
- 🔄 统一笔记存储系统
- 🔄 UI 集成（添加上传按钮）
- 🔄 自动同步触发器

## 开发者注意事项

如果你想完善同步功能，可以：

1. **统一存储系统**：修改 App.tsx 使用 FileManager 保存笔记
2. **添加上传按钮**：在 TopBar 中添加"上传到 OneDrive"按钮
3. **自动同步**：在保存笔记时自动触发上传

参考代码位置：
- 同步引擎：`electron/services/sync-engine.ts`
- 文件管理：`electron/services/file-manager.ts`
- IPC 处理：`electron/ipc/handlers.ts`
