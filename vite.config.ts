import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/renderer',
    chunkSizeWarningLimit: 1500, // 提高警告阈值到 1500KB
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 React 相关库分离
          'react-vendor': ['react', 'react-dom'],
          // 将 Ant Design 分离
          'antd-vendor': ['antd', '@ant-design/icons'],
          // 将 Quill 编辑器分离
          'editor-vendor': ['quill', 'react-quill']
        }
      }
    }
  }
});
