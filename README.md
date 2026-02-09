# T-Note

Windows 桌面端本地笔记应用，提供富文本编辑、多页面管理、标签系统、Tab 栏、分屏编辑、书签、TODO 等功能。

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发运行
```bash
npm run dev
```

### 打包应用
```bash
npm run build
npm run package
```

## 核心功能

### 📝 富文本编辑
- 基于 Quill 编辑器，支持丰富的文本格式
- 支持标题（H1/H2/H3）
- 文本样式：粗体、斜体、下划线、删除线
- 列表：有序列表、无序列表
- 颜色：文字颜色、背景色
- 对齐方式、链接、图片、代码块、引用

### 📄 多页面管理
- 支持在一个笔记中创建多个页面
- 每个页面独立的标题、内容和标签
- 页面列表显示标题、标签和更新时间
- 页面删除功能（带确认对话框）

### 🏷️ 标签系统
- 为每个页面添加多个标签
- 彩色标签显示，易于识别
- 支持按标签搜索和过滤页面

### 📑 Tab 栏和分屏功能
- 显示已打开的页面，最多显示 5 个 Tab
- 点击 Tab 切换页面，关闭 Tab（不删除页面）
- **拖拽操作**：水平拖动排序、拖到分屏区域、向右拖动分屏
- **IDEA 风格双 Tab 栏**：左右两侧各有独立的 Tab 栏
- **焦点切换机制**：同一时间只有一个编辑器可编辑
- **分屏编辑**：左右分屏显示两个页面，独立编辑

### 🔖 书签功能
- 在编辑器中添加书签标记
- 书签面板显示所有书签
- 点击书签快速定位到对应位置

### 🔍 搜索功能
- 按标签搜索页面
- 实时过滤显示结果

### ✅ TODO 功能
- 添加待办事项（标题、描述、优先级、分类、截止日期）
- 完成/取消完成、编辑、删除
- 按状态和优先级过滤
- 优先级标识（高/中/低）
- 截止日期提醒
- 自动排序

### 💾 文件操作
- 打开已保存的笔记文件（.note 格式）
- 保存笔记（Ctrl+S 快捷键）
- 另存为新文件
- 本地文件存储，数据安全

## 技术栈

- **前端框架**：React 18
- **UI 组件库**：Ant Design 6.0
- **图标库**：@ant-design/icons
- **富文本编辑器**：React Quill 2.0
- **桌面框架**：Electron 28
- **构建工具**：Vite 5
- **语言**：TypeScript 5
- **日期处理**：dayjs

## 数据结构

### 笔记文件（.note）
```typescript
interface Note {
  name: string;
  pages: Page[];
  todos?: TodoItem[];
}
```

### 页面
```typescript
interface Page {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: number;
}
```

### TODO 项
```typescript
interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: number;
  createdAt: number;
  updatedAt: number;
}
```

## 使用指南

### 快速开始
1. 启动应用
2. 点击"新建页面"创建第一个页面
3. 输入标题和内容
4. 使用 Ctrl+S 或点击"保存"按钮保存

### Tab 栏操作
1. **打开 Tab**：从左侧页面列表点击页面
2. **切换页面**：点击 Tab 栏中的任意 Tab
3. **关闭 Tab**：点击 Tab 右侧的 × 按钮
4. **分屏显示**：
   - 右键点击 Tab，选择"分屏显示"
   - 拖动 Tab 到右侧的"拖到这里分屏"区域
   - 将 Tab 向右拖动超过 100px 后松开
5. **关闭分屏**：点击右上角的"关闭分屏"按钮

### 快捷键
- **Ctrl+S**：保存笔记

## 注意事项

1. Tab 栏最多显示 5 个，建议及时关闭不需要的 Tab
2. 分屏时两个编辑器独立工作，修改会实时保存
3. 删除页面会自动关闭对应的 Tab 和分屏
4. TODO 数据存储在笔记文件中
5. 建议定期备份重要笔记

## 故障排除

### 分屏白屏
- 检查控制台错误
- 清除缓存重新构建

### 样式显示不正常
- 清除缓存后重新运行 `npm run dev`

### 保存失败
- 检查文件路径是否有写入权限

## 更多信息

详细的功能说明和版本更新历史，请查看 `修改日志.md`
