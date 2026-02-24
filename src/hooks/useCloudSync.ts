/**
 * 云同步 Hook
 * 
 * 封装云同步状态和操作
 */

import { useState, useEffect, useCallback } from 'react';
import { CloudProvider, CloudSyncProgress } from '../types/cloud';

export interface UseCloudSyncReturn {
  isAuthenticated: boolean;
  isSyncing: boolean;
  syncProgress: { current: number; total: number } | null;
  lastSyncTime: number | null;
  checkAuthStatus: () => Promise<void>;
  startSync: () => Promise<void>;
}

export function useCloudSync(provider: CloudProvider): UseCloudSyncReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const api = provider === 'onedrive' 
    ? window.electronAPI.onedrive 
    : window.electronAPI.baidupan;

  const checkAuthStatus = useCallback(async () => {
    try {
      const authenticated = await api.isAuthenticated();
      setIsAuthenticated(authenticated);
    } catch {
      setIsAuthenticated(false);
    }
  }, [api]);

  useEffect(() => {
    checkAuthStatus();

    const removeProgress = api.onSyncProgress((progress: CloudSyncProgress) => {
      setSyncProgress({ current: progress.current, total: progress.total });
      setIsSyncing(true);
    });

    const removeComplete = api.onSyncComplete(() => {
      setIsSyncing(false);
      setSyncProgress(null);
      setLastSyncTime(Date.now());
    });

    const removeError = api.onSyncError(() => {
      setIsSyncing(false);
      setSyncProgress(null);
    });

    return () => {
      removeProgress();
      removeComplete();
      removeError();
    };
  }, [api, checkAuthStatus]);

  const startSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      if (provider === 'onedrive') {
        await window.electronAPI.onedrive.sync();
      }
      // 百度网盘暂不支持全量同步，仅支持单笔记上传/下载
    } catch (error) {
      setIsSyncing(false);
      throw error;
    }
  }, [provider]);

  return {
    isAuthenticated,
    isSyncing,
    syncProgress,
    lastSyncTime,
    checkAuthStatus,
    startSync,
  };
}
