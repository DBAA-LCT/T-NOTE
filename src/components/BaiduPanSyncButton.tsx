import { useState, useEffect } from 'react';
import { Button, Tooltip, message } from 'antd';
import { CloudUploadOutlined, LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { BaiduSyncProgress } from '../types/baidupan-sync';

interface BaiduPanSyncButtonProps {
  /** 获取当前笔记内容和名称的回调 */
  getNoteData: () => { noteContent: string; noteName: string } | null;
  onSyncComplete?: () => void;
}

export default function BaiduPanSyncButton({ getNoteData, onSyncComplete }: BaiduPanSyncButtonProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncOk, setLastSyncOk] = useState(false);

  useEffect(() => {
    window.electronAPI.baidupan.isAuthenticated().then(setIsAuthenticated).catch(() => {});

    const removeProgress = window.electronAPI.baidupan.onSyncProgress((_data: BaiduSyncProgress) => {
      setIsSyncing(true);
    });
    const removeComplete = window.electronAPI.baidupan.onSyncComplete(() => {
      setIsSyncing(false);
      setLastSyncOk(true);
      setTimeout(() => setLastSyncOk(false), 3000);
      onSyncComplete?.();
    });
    const removeError = window.electronAPI.baidupan.onSyncError((data) => {
      setIsSyncing(false);
      message.error(`百度网盘同步失败: ${data.error}`);
    });

    return () => { removeProgress(); removeComplete(); removeError(); };
  }, []);

  const handleUpload = async () => {
    const data = getNoteData();
    if (!data) {
      message.warning('没有可上传的笔记');
      return;
    }
    setIsSyncing(true);
    try {
      await window.electronAPI.baidupan.uploadNote(data);
      message.success('已上传到百度网盘');
    } catch (err) {
      message.error('上传失败: ' + (err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isAuthenticated) return null;

  const icon = isSyncing ? <LoadingOutlined spin /> : lastSyncOk ? <CheckCircleOutlined /> : <CloudUploadOutlined />;

  return (
    <Tooltip title="上传到百度网盘">
      <Button
        type="text"
        size="small"
        icon={icon}
        onClick={handleUpload}
        disabled={isSyncing}
      />
    </Tooltip>
  );
}
