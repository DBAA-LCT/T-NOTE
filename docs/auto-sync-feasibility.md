# 自动页面同步方案可行性分析

## 方案概述

- 按页面自动同步，而不是整个笔记
- 移除手动同步按钮，编辑后自动上传
- 移除回滚功能，只保留"使用云端版本"
- 云笔记面板作为只读查看器

## 技术可行性分析

### ✅ 可行的部分

#### 1. 自动上传机制

```typescript
// 在 App.tsx 中监听页面内容变化
useEffect(() => {
  if (!note || !currentPageId) return;
  
  const currentPage = note.pages.find(p => p.id === currentPageId);
  if (!currentPage) return;
  
  // 检查笔记是否启用同步
  if (!note.syncConfig?.enabled) return;
  
  // Debounce 自动上传
  const uploadTimer = setTimeout(async () => {
    try {
      await window.electronAPI.onedrive.uploadPage(note.id, currentPageId);
      console.log('页面已自动上传到云端');
    } catch (error) {
      console.error('自动上传失败:', error);
    }
  }, 10000); // 10秒后上传
  
  return () => clearTimeout(uploadTimer);
}, [note, currentPageId, currentPage?.content]);
```

**优点**：
- 实现简单
- 用户无感知
- 减少手动操作

**挑战**：
- 需要处理频繁编辑的情况（debounce）
- 网络不稳定时的重试机制
- 上传失败的提示和恢复

#### 2. 页面级上传

```typescript
// electron/services/sync-engine.ts
async uploadPage(noteId: string, pageId: string): Promise<UploadResult> {
  // 1. 读取完整笔记
  const note = await this.fileManager.readNote(noteId);
  const page = note.pages.find(p => p.id === pageId);
  if (!page) throw new Error('Page not found');
  
  // 2. 检查云端版本
  const cloudNote = await this.downloadNote(noteId);
  const cloudPage = cloudNote?.pages.find(p => p.id === pageId);
  
  // 3. 计算diff
  if (cloudPage) {
    const diff = this.calculatePageDiff(cloudPage, page);
    // 只上传diff
    await this.uploadPageDiff(noteId, pageId, diff);
  } else {
    // 新页面，上传完整内容
    await this.uploadFullPage(noteId, page);
  }
  
  // 4. 更新本地缓存的云端版本
  page.cloudVersion = {
    content: page.content,
    updatedAt: Date.now(),
    hash: this.calculateHash(page.content)
  };
  
  await this.fileManager.writeNote(note);
  
  return { success: true };
}
```

**优点**：
- 精确控制上传内容
- 减少网络传输
- 支持增量更新

**挑战**：
- OneDrive API 不直接支持部分文件更新
- 需要自定义diff格式和应用逻辑

#### 3. 云端页面查看

```typescript
// src/components/CloudPagesPanel.tsx
interface CloudPage {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  status: 'synced' | 'syncing' | 'error' | 'cloud_newer' | 'local_newer';
  diff?: PageDiff;
}

// 点击页面查看
const handlePageClick = async (cloudPage: CloudPage) => {
  if (cloudPage.status === 'cloud_newer') {
    // 显示diff对比
    setDiffDialog({
      visible: true,
      localPage: localPages.find(p => p.id === cloudPage.id),
      cloudPage: cloudPage,
      onUseCloud: () => handleUseCloudVersion(cloudPage.id)
    });
  } else {
    // 只读查看
    setViewDialog({
      visible: true,
      page: cloudPage
    });
  }
};
```

**优点**：
- 清晰的状态展示
- 简单的交互逻辑

**挑战**：
- 需要实时检测云端变化
- 状态同步的性能问题

### ⚠️ 需要注意的部分

#### 1. OneDrive API 限制

**问题**：OneDrive 不支持部分文件更新

```
OneDrive API 只能：
- 上传完整文件（PUT /content）
- 下载完整文件（GET /content）
- 不能只更新文件的一部分
```

**解决方案**：

##### 方案1：每个页面一个文件（推荐）

```
OneDrive 结构：
/Notes/
  /我的笔记/
    /pages/
      page-1.json
      page-2.json
      page-3.json
    metadata.json  # 笔记元数据
```

**优点**：
- 真正的页面级上传
- 每个页面独立同步
- 减少冲突

**缺点**：
- 文件数量增多
- 需要重构存储结构

##### 方案2：智能全文件上传

```typescript
// 虽然上传整个文件，但只在必要时上传
async uploadPage(noteId: string, pageId: string): Promise<void> {
  const note = await this.fileManager.readNote(noteId);
  const page = note.pages.find(p => p.id === pageId);
  
  // 检查是否真的需要上传
  if (page.cloudVersion?.hash === this.calculateHash(page.content)) {
    console.log('页面内容未变化，跳过上传');
    return;
  }
  
  // 上传整个笔记文件（但用户感知是页面级）
  await this.uploadNote(noteId);
  
  // 更新页面的云端版本缓存
  page.cloudVersion = {
    content: page.content,
    updatedAt: Date.now(),
    hash: this.calculateHash(page.content)
  };
}
```

**优点**：
- 实现简单
- 不改变现有存储结构
- 用户感知是页面级

**缺点**：
- 实际还是上传整个文件
- 多页面同时编辑时可能冲突

#### 2. 网络状态处理

```typescript
// 需要处理的场景
const networkScenarios = {
  // 1. 离线编辑
  offline: {
    behavior: '本地保存，标记为待上传',
    recovery: '网络恢复后自动上传'
  },
  
  // 2. 上传失败
  uploadFailed: {
    behavior: '显示错误提示，保留本地更改',
    recovery: '用户可以手动重试或忽略'
  },
  
  // 3. 云端较新
  cloudNewer: {
    behavior: '显示警告，阻止自动上传',
    recovery: '用户查看diff后决定'
  },
  
  // 4. 并发编辑
  concurrent: {
    behavior: '检测到冲突，暂停自动上传',
    recovery: '提示用户解决冲突'
  }
};
```

#### 3. 性能考虑

```typescript
// 优化策略
const optimizations = {
  // 1. 批量上传
  batchUpload: {
    description: '收集多个页面的更改，一次性上传',
    implementation: '使用队列机制，每30秒批量处理'
  },
  
  // 2. 智能检测
  smartDetection: {
    description: '使用内容哈希快速判断是否需要上传',
    implementation: 'SHA-256哈希，O(1)比较'
  },
  
  // 3. 后台同步
  backgroundSync: {
    description: '不阻塞用户操作',
    implementation: 'Web Worker 或 Electron 后台进程'
  },
  
  // 4. 增量下载
  incrementalDownload: {
    description: '只下载变化的页面',
    implementation: '使用 OneDrive Delta API'
  }
};
```

### ❌ 不可行的部分

#### 1. 真正的实时同步

**问题**：OneDrive 不支持 WebSocket 或实时推送

```
OneDrive 限制：
- 没有实时通知 API
- 只能通过轮询检测变化
- Delta API 有调用频率限制（每分钟最多60次）
```

**影响**：
- 无法实现类似 Google Docs 的实时协作
- 云端变化有延迟（需要轮询）
- 多设备同时编辑容易冲突

**解决方案**：
- 定期轮询（每30秒检查一次）
- 用户手动刷新云笔记面板
- 明确告知用户这不是实时同步

#### 2. 完全无感知的冲突解决

**问题**：自动同步必然会遇到冲突

```
冲突场景：
1. 设备A编辑页面1，正在上传
2. 设备B同时编辑页面1，也在上传
3. 后上传的会覆盖先上传的
```

**影响**：
- 可能丢失数据
- 用户困惑

**解决方案**：
- 检测到冲突时暂停自动上传
- 显示明确的冲突提示
- 提供"使用云端版本"或"强制上传本地版本"选项

## 推荐的实现方案

### 方案：渐进式自动同步

```typescript
// 1. 基础架构
interface PageSyncState {
  pageId: string;
  status: 'idle' | 'pending' | 'syncing' | 'synced' | 'error' | 'conflict';
  lastSyncAt: number;
  error?: string;
}

// 2. 自动上传队列
class AutoSyncQueue {
  private queue: Map<string, PageSyncState> = new Map();
  private isProcessing = false;
  
  // 添加页面到队列
  enqueue(noteId: string, pageId: string) {
    this.queue.set(pageId, {
      pageId,
      status: 'pending',
      lastSyncAt: 0
    });
    
    // 延迟处理（debounce）
    this.scheduleProcess();
  }
  
  // 处理队列
  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    for (const [pageId, state] of this.queue) {
      if (state.status !== 'pending') continue;
      
      try {
        state.status = 'syncing';
        await this.uploadPage(pageId);
        state.status = 'synced';
        state.lastSyncAt = Date.now();
        this.queue.delete(pageId);
      } catch (error) {
        state.status = 'error';
        state.error = error.message;
      }
    }
    
    this.isProcessing = false;
  }
}

// 3. 在 App.tsx 中使用
const syncQueue = useRef(new AutoSyncQueue());

useEffect(() => {
  if (!note?.syncConfig?.enabled) return;
  if (!currentPageId) return;
  
  // 页面内容变化时加入队列
  syncQueue.current.enqueue(note.id, currentPageId);
}, [currentPage?.content]);
```

### 用户体验流程

```
1. 打开笔记
   ↓
2. 检查是否启用同步
   ├─ 是 → 显示同步状态图标
   └─ 否 → 提示"是否启用同步？"
   
3. 编辑页面
   ↓
4. 自动保存到本地（3秒）
   ↓
5. 如果启用同步
   ├─ 加入上传队列
   ├─ 10秒后批量上传
   └─ 显示上传状态
   
6. 打开云笔记面板
   ↓
7. 显示所有页面状态
   ├─ 已同步（绿色勾）
   ├─ 正在同步（蓝色转圈）
   ├─ 同步失败（红色叉）
   └─ 云端较新（黄色感叹号）
   
8. 点击云端较新的页面
   ↓
9. 显示diff对比
   ├─ 左侧：本地版本
   ├─ 右侧：云端版本
   └─ 按钮："使用云端版本"
   
10. 点击"使用云端版本"
    ↓
11. 覆盖本地内容
    ↓
12. 自动保存
```

## 风险和缓解措施

### 风险1：数据丢失

**场景**：自动上传覆盖了重要内容

**缓解**：
- 本地保留最近10个版本的备份
- 云端使用 OneDrive 的版本历史（30天）
- 提供"恢复历史版本"功能

### 风险2：网络消耗

**场景**：频繁上传消耗流量

**缓解**：
- 智能检测内容是否真的变化（哈希比较）
- 批量上传，减少请求次数
- 提供"仅WiFi同步"选项

### 风险3：冲突频繁

**场景**：多设备编辑导致频繁冲突

**缓解**：
- 明确告知用户这不是实时协作工具
- 建议"一次只在一个设备上编辑"
- 提供清晰的冲突解决界面

### 风险4：性能问题

**场景**：大笔记本上传慢

**缓解**：
- 每个页面独立文件（推荐）
- 压缩内容后上传
- 显示上传进度

## 结论

### ✅ 可行

按页面自动同步的方案是可行的，但需要：

1. **采用"每个页面一个文件"的存储结构**（推荐）
   - 或者接受"上传整个笔记但用户感知是页面级"

2. **实现智能上传队列**
   - Debounce 机制
   - 批量处理
   - 错误重试

3. **清晰的状态展示**
   - 同步状态图标
   - 云笔记面板状态列表
   - 冲突提示

4. **简化的冲突处理**
   - 只提供"使用云端版本"
   - 不提供复杂的合并功能

### ⚠️ 需要权衡

- **实时性 vs 性能**：不能做到真正实时，需要轮询
- **自动化 vs 控制**：自动上传可能让用户失去控制感
- **简单 vs 功能**：移除回滚功能可能让高级用户不满

### 📋 建议

1. **第一阶段**：实现基础自动同步
   - 编辑后自动上传
   - 云笔记面板查看
   - 简单的"使用云端版本"

2. **第二阶段**：优化体验
   - 批量上传
   - 智能检测
   - 性能优化

3. **第三阶段**：高级功能
   - 版本历史
   - 冲突智能合并
   - 协作提示

## 需要确认的问题

1. **存储结构**：是否接受"每个页面一个文件"？
2. **自动化程度**：是否完全自动，还是需要某种确认？
3. **冲突处理**：只提供"使用云端版本"够用吗？
4. **离线支持**：离线编辑后如何处理？
5. **多设备**：如何提示用户避免多设备同时编辑？
