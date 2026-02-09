# 图标文件说明

## 使用方法

1. 在浏览器中打开项目根目录的 `build-icon.html` 文件
2. 点击"下载所有图标"按钮，会自动下载各个尺寸的图标
3. 将下载的图标文件放到这个 `build` 文件夹中
4. 更新 `package.json` 配置（见下方）

## 配置 package.json

在 `package.json` 的 `build` 部分添加图标配置：

```json
"build": {
  "appId": "com.noteapp.editor",
  "productName": "富文本笔记编辑器",
  "icon": "build/icon-256x256.png",
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "directories": {
    "output": "release"
  },
  "win": {
    "target": "nsis",
    "icon": "build/icon-256x256.png"
  }
}
```

## 图标尺寸说明

- **16x16**: 任务栏小图标
- **32x32**: 任务栏标准图标
- **48x48**: 快捷方式图标
- **64x64**: 高分辨率快捷方式
- **128x128**: 中等尺寸显示
- **256x256**: 标准应用图标（推荐用于 Windows）
- **512x512**: 高分辨率应用图标

## 图标设计说明

图标采用现代扁平化设计风格：
- 蓝色渐变背景（#1890ff → #096dd9）代表专业和科技感
- 白色笔记本元素体现笔记应用的核心功能
- 装订线和装订孔增加真实感
- 蓝色文本线条表示富文本编辑
- 黄色铅笔元素强调编辑功能
- 整体简洁明了，易于识别

## 在线转换 ICO（可选）

如果需要 .ico 格式的图标文件，可以使用以下在线工具：
- https://convertio.co/zh/png-ico/
- https://www.aconvert.com/cn/icon/png-to-ico/
- https://icoconvert.com/

上传 256x256 的 PNG 图标即可转换。
