# 安装表格功能

## 步骤 1: 安装依赖包

以管理员身份打开命令提示符或 PowerShell，然后运行：

```cmd
cd D:\code\Note
npm cache clean --force
npm install quill-better-table
```

## 步骤 2: 启用表格功能

安装完成后，需要修改 `src/components/Editor.tsx` 文件：

### 2.1 取消注释导入代码（第 102-112 行附近）

将：
```typescript
/*
import QuillBetterTable from 'quill-better-table';
import 'quill-better-table/dist/quill-better-table.css';

Quill.register({
  'modules/better-table': QuillBetterTable
}, true);
console.log('✅ Table module registered');
*/
```

改为：
```typescript
import QuillBetterTable from 'quill-better-table';
import 'quill-better-table/dist/quill-better-table.css';

Quill.register({
  'modules/better-table': QuillBetterTable
}, true);
console.log('✅ Table module registered');
```

### 2.2 修改 insertTable 函数（第 935 行附近）

将：
```typescript
const insertTable = () => {
  // Table functionality disabled - requires quill-better-table package
  message.warning('表格功能需要安装 quill-better-table 包');
  setTablePopoverOpen(false);
};
```

改为：
```typescript
const insertTable = () => {
  const quill = quillRef.current?.getEditor();
  if (!quill) return;
  
  const tableModule = quill.getModule('better-table');
  if (tableModule) {
    tableModule.insertTable(tableRows, tableCols);
    setTablePopoverOpen(false);
    message.success(`已插入 ${tableRows}×${tableCols} 表格`);
  } else {
    message.error('表格模块未加载');
  }
};
```

### 2.3 更新 ReactQuill modules 配置（第 2290 行附近）

将：
```typescript
modules={{
  toolbar: {
    container: '#toolbar-container'
  }
  // table: true  // Disabled - requires quill-better-table package
}}
```

改为：
```typescript
modules={{
  toolbar: {
    container: '#toolbar-container'
  },
  'better-table': {
    operationMenu: {
      items: {
        unmergeCells: { text: '取消合并' },
        insertColumnRight: { text: '右侧插入列' },
        insertColumnLeft: { text: '左侧插入列' },
        insertRowUp: { text: '上方插入行' },
        insertRowDown: { text: '下方插入行' },
        removeColumn: { text: '删除列' },
        removeRow: { text: '删除行' },
        removeTable: { text: '删除表格' }
      }
    }
  },
  keyboard: {
    bindings: QuillBetterTable.keyboardBindings
  }
}}
```

## 步骤 3: 重启开发服务器

修改完成后，重启开发服务器：

```cmd
npm run dev
```

## 完成

现在表格功能应该可以正常使用了！
