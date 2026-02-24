import { useEffect, useState } from 'react';
import { Modal, Progress, Button, Typography, Space } from 'antd';
import { CloudDownloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.update) return;

    const removeListener = window.electronAPI.update.onUpdateStatus((data) => {
      const { event, data: eventData } = data;

      switch (event) {
        case 'checking-for-update':
          console.log('正在检查更新...');
          break;

        case 'update-available':
          setUpdateAvailable(true);
          setUpdateInfo(eventData);
          setDownloading(true);
          break;

        case 'update-not-available':
          console.log('当前已是最新版本');
          break;

        case 'download-progress':
          setDownloadProgress(Math.round(eventData.percent));
          break;

        case 'update-downloaded':
          setDownloading(false);
          setUpdateDownloaded(true);
          setUpdateInfo(eventData);
          break;

        case 'update-error':
          setError(eventData);
          setDownloading(false);
          break;
      }
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  const handleInstallNow = () => {
    window.electronAPI.update.quitAndInstall();
  };

  const handleInstallLater = () => {
    setUpdateDownloaded(false);
  };

  const handleCheckUpdate = async () => {
    try {
      await window.electronAPI.update.checkForUpdates();
    } catch (error) {
      console.error('检查更新失败:', error);
    }
  };

  return (
    <>
      {/* 下载中的进度提示 */}
      <Modal
        open={downloading}
        title="正在下载更新"
        footer={null}
        closable={false}
        centered
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>新版本 {updateInfo?.version} 正在下载中...</Text>
          <Progress percent={downloadProgress} status="active" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            下载完成后会自动提示您安装
          </Text>
        </Space>
      </Modal>

      {/* 下载完成的安装提示 */}
      <Modal
        open={updateDownloaded}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            更新已下载
          </Space>
        }
        onOk={handleInstallNow}
        onCancel={handleInstallLater}
        okText="立即安装"
        cancelText="稍后安装"
        centered
      >
        <Space direction="vertical">
          <Text>新版本 {updateInfo?.version} 已下载完成</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            点击"立即安装"将重启应用并安装更新
          </Text>
        </Space>
      </Modal>

      {/* 错误提示 */}
      <Modal
        open={!!error}
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            更新失败
          </Space>
        }
        onOk={() => setError(null)}
        onCancel={() => setError(null)}
        okText="确定"
        cancelButtonProps={{ style: { display: 'none' } }}
        centered
      >
        <Text>{error}</Text>
      </Modal>
    </>
  );
}
