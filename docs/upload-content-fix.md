# 上传内容为空问题修复

## 问题描述

上传笔记到 OneDrive 时，文件名正确但内容为空或不完整。

## 根本原因

在 `onedrive-client.ts` 的 `request` 方法中，所有非字符串的 body 都会被 `JSON.stringify()` 处理。但是对于文件上传，我们需要发送原始的 Buffer 数据，而不是 JSON 字符串。

### 问题代码

```typescript
// 错误的处理方式
if (options.body) {
  if (typeof options.body === 'string') {
    fetchOptions.body = options.body;
  } else {
    fetchOptions.body = JSON.stringify(options.body); // ❌ Buffer 被转换成 JSON
  }
}
```

当 Buffer 被 `JSON.stringify()` 时，会变成类似这样的对象：
```json
{
  "type": "Buffer",
  "data": [123, 34, 105, 100, ...]
}
```

这不是有效的文件内容，导致上传的文件为空或损坏。

## 修复方案

### 1. 修复 body 处理逻辑

在 `request` 方法中，正确处理不同类型的 body：

```typescript
if (options.body) {
  if (typeof options.body === 'string') {
    fetchOptions.body = options.body;
  } else if (Buffer.isBuffer(options.body)) {
    // ✅ 转换为 Uint8Array（fetch API 兼容）
    fetchOptions.body = new Uint8Array(options.body);
  } else if (options.body instanceof Uint8Array) {
    // ✅ 直接发送二进制数据
    fetchOptions.body = options.body;
  } else {
    // 只有非 Buffer 对象才 JSON 化
    fetchOptions.body = JSON.stringify(options.body);
  }
}
```

**注意：** Buffer 被转换为 Uint8Array 是为了 TypeScript 类型兼容性。Uint8Array 和 Buffer 在底层都是二进制数据，不会影响上传的内容。

### 2. 修复 Content-Type 设置

默认的 `Content-Type: application/json` 会覆盖文件上传时设置的 `application/octet-stream`。

**修复前：**
```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json', // ❌ 总是设置为 JSON
  ...options.headers,
};
```

**修复后：**
```typescript
const headers: Record<string, string> = {
  ...options.headers,
};

// 只在没有设置时才使用默认值
if (!headers['Content-Type'] && !headers['content-type']) {
  headers['Content-Type'] = 'application/json';
}
```

### 3. 添加调试日志

添加详细的日志来追踪上传过程：

```typescript
// 在 simpleUpload 中
logger.info('api', `Read file for upload`, { 
  localFilePath, 
  fileSize: fileContent.length,
  isBuffer: Buffer.isBuffer(fileContent)
});

// 在 request 中
if (Buffer.isBuffer(options.body)) {
  logger.debug('api', 'Body type: Buffer', { length: options.body.length });
}
```

## 修改的文件

1. **electron/services/onedrive-client.ts**
   - 修复 `request` 方法的 body 处理
   - 修复 `request` 方法的 headers 设置
   - 在 `simpleUpload` 中添加日志

## 测试步骤

### 1. 创建测试笔记

```javascript
{
  "id": "test-123",
  "name": "测试笔记",
  "pages": [
    {
      "id": "page-1",
      "title": "第一页",
      "content": "这是测试内容，包含中文和特殊字符 !@#$%",
      "tags": ["测试"],
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ],
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

### 2. 上传笔记

1. 打开测试笔记
2. 点击"上传到云端"
3. 选择云端文件夹
4. 点击"上传"

### 3. 验证上传

查看日志输出：

```
[api] Read file for upload { 
  localFilePath: "C:\\temp\\test-123.note", 
  fileSize: 456,
  isBuffer: true 
}
[api] Body type: Buffer { length: 456 }
[api] Successfully uploaded file: /Notes/test-123.note { 
  uploadedSize: 456,
  driveItemId: "01ABC..." 
}
```

### 4. 下载验证

1. 从云端笔记列表下载该笔记
2. 打开下载的文件
3. 验证内容完整：
   - 所有页面都存在
   - 内容完全一致
   - 中文和特殊字符正确

## 预期结果

- ✅ 文件大小正确（不为 0）
- ✅ 内容完整（包含所有页面）
- ✅ 中文和特殊字符正确
- ✅ JSON 格式正确
- ✅ 可以正常下载和打开

## 常见问题

### Q: 如何确认文件内容是否正确上传？

A: 查看日志中的 `uploadedSize`，应该与本地文件大小一致：

```
[sync] Temp file created { 
  originalLength: 456,
  tempFileLength: 456,
  match: true 
}
[api] Successfully uploaded file { 
  uploadedSize: 456  // ✅ 大小一致
}
```

### Q: 如果上传后文件大小为 0 怎么办？

A: 检查日志中的 body 类型：

```
[api] Body type: Buffer { length: 456 }  // ✅ 正确
[api] Body type: JSON { length: 1234 }   // ❌ 错误，Buffer 被 JSON 化了
```

### Q: 如何验证 Content-Type 是否正确？

A: 在上传时，应该看到：

```
headers: {
  'Content-Type': 'application/octet-stream',  // ✅ 正确
  'Authorization': 'Bearer ...'
}
```

而不是：

```
headers: {
  'Content-Type': 'application/json',  // ❌ 错误
  'Authorization': 'Bearer ...'
}
```

## 技术细节

### Buffer vs JSON

**Buffer（正确）：**
- 原始二进制数据
- 直接发送到 OneDrive
- 保持文件完整性

**JSON.stringify(Buffer)（错误）：**
```json
{
  "type": "Buffer",
  "data": [123, 34, 105, 100, 34, 58, ...]
}
```
- 变成了 JSON 对象
- 不是有效的文件内容
- 导致文件损坏

### fetch API 的 body 类型

fetch API 支持多种 body 类型：
- `string` - 文本数据
- `Buffer` - Node.js Buffer
- `Uint8Array` - 二进制数组
- `Blob` - 浏览器中的二进制对象
- `FormData` - 表单数据

对于文件上传，应该使用 `Buffer` 或 `Uint8Array`。

## 相关问题

如果遇到其他上传问题：

1. **网络错误** - 检查网络连接和 OneDrive 状态
2. **权限错误** - 确认已正确授权
3. **存储空间不足** - 检查 OneDrive 剩余空间
4. **文件名冲突** - 检查是否有同名文件

## 总结

这个问题的核心是：**不要对 Buffer 使用 JSON.stringify()**

修复后，文件上传流程：
1. 读取本地文件 → Buffer
2. 设置正确的 Content-Type
3. 直接发送 Buffer 到 OneDrive
4. 验证上传的文件大小
