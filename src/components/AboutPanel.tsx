import { useState, useEffect } from 'react';
import { Button, Typography, Space, Divider, Card, Progress, message, Spin, Tag, Modal } from 'antd';
import { 
  CloudDownloadOutlined, 
  CheckCircleOutlined, 
  SyncOutlined,
  InfoCircleOutlined,
  GithubOutlined,
  CopyOutlined,
  QqOutlined,
  MailOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function AboutPanel() {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);

  useEffect(() => {
    // 获取应用版本号
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((version: string) => {
        setCurrentVersion(version);
      }).catch((error: any) => {
        console.error('获取版本号失败:', error);
        setCurrentVersion('未知');
      });
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.update) return;

    const removeListener = window.electronAPI.update.onUpdateStatus((data) => {
      const { event, data: eventData } = data;

      switch (event) {
        case 'checking-for-update':
          setChecking(true);
          break;

        case 'update-available':
          setChecking(false);
          setUpdateAvailable(true);
          setUpdateInfo(eventData);
          setDownloading(true);
          // 不再显示消息提示，只在设置菜单显示红点
          break;

        case 'update-not-available':
          setChecking(false);
          message.success('当前已是最新版本');
          break;

        case 'download-progress':
          setDownloadProgress(Math.round(eventData.percent));
          break;

        case 'update-downloaded':
          setDownloading(false);
          setUpdateAvailable(true); // 保持 updateAvailable 为 true
          setUpdateInfo(eventData);
          // 不再显示消息提示，用户可以在关于页面看到更新状态
          break;

        case 'update-error':
          setChecking(false);
          setDownloading(false);
          message.error(`更新失败: ${eventData}`);
          break;
      }
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  const handleCheckUpdate = async () => {
    if (!window.electronAPI?.update) {
      message.warning('更新功能不可用');
      return;
    }

    setChecking(true);
    try {
      await window.electronAPI.update.checkForUpdates();
    } catch (error) {
      console.error('检查更新失败:', error);
      message.error('检查更新失败');
      setChecking(false);
    }
  };

  const handleInstallUpdate = () => {
    if (!window.electronAPI?.update) return;
    window.electronAPI.update.quitAndInstall();
  };

  const handleCopyQQ = () => {
    navigator.clipboard.writeText('518446027').then(() => {
      message.success('QQ群号已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败，请手动复制');
    });
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('good_luck_lct@163.com').then(() => {
      message.success('邮箱地址已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败，请手动复制');
    });
  };

  return (
    <div style={{ 
      padding: '24px',
      height: '100%',
      overflow: 'auto',
      background: '#fff'
    }}>
      {/* 应用信息 */}
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: 48, 
              marginBottom: 16,
              color: '#1677ff'
            }}>
              📝
            </div>
            <Title level={3} style={{ margin: 0 }}>T-Note</Title>
            <Text type="secondary">本地富文本笔记编辑器</Text>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">当前版本</Text>
                <Text strong>{currentVersion}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">开发者</Text>
                <Text>DBAA-LCT</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">许可证</Text>
                <Text>MIT License</Text>
              </div>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 更新检测 */}
      <Card 
        title={
          <Space>
            <CloudDownloadOutlined />
            <span>应用更新</span>
          </Space>
        }
        bordered={false}
        style={{ marginBottom: 24 }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {!updateAvailable && !downloading && (
            <div>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                定期检查更新以获取最新功能和安全修复
              </Paragraph>
              <Button 
                type="primary"
                icon={checking ? <SyncOutlined spin /> : <CloudDownloadOutlined />}
                onClick={handleCheckUpdate}
                loading={checking}
                block
              >
                {checking ? '正在检查更新...' : '检查更新'}
              </Button>
            </div>
          )}

          {downloading && (
            <div>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>正在下载新版本 {updateInfo?.version}</Text>
                  <Tag color="processing">下载中</Tag>
                </div>
                <Progress 
                  percent={downloadProgress} 
                  status="active"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  下载完成后会自动提示您安装
                </Text>
              </Space>
            </div>
          )}

          {updateAvailable && !downloading && updateInfo && (
            <div>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ 
                  padding: '12px',
                  background: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: '6px'
                }}>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    <div>
                      <Text strong style={{ color: '#52c41a' }}>
                        新版本 {updateInfo.version} 已下载完成
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        点击下方按钮立即安装更新
                      </Text>
                    </div>
                  </Space>
                </div>
                
                <Button 
                  type="primary"
                  size="large"
                  icon={<CloudDownloadOutlined />}
                  onClick={handleInstallUpdate}
                  block
                >
                  立即安装并重启
                </Button>
              </Space>
            </div>
          )}
        </Space>
      </Card>

      {/* 项目信息 */}
      <Card 
        title={
          <Space>
            <InfoCircleOutlined />
            <span>项目信息</span>
          </Space>
        }
        bordered={false}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            T-Note 是一款功能强大的本地笔记应用，支持富文本编辑、云端同步、多账号管理等功能。
          </Paragraph>
          
          <div>
            <Button 
              icon={<GithubOutlined />}
              href="https://github.com/DBAA-LCT/T-NOTE"
              target="_blank"
              style={{ marginRight: 8 }}
            >
              GitHub
            </Button>
            <Button
              onClick={() => setFeedbackModalVisible(true)}
            >
              反馈问题
            </Button>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              © 2026 T-Note  All rights reserved by DBAA-LCT.
            </Text>
          </div>
        </Space>
      </Card>

      {/* 反馈问题弹窗 */}
      <Modal
        title="开发者信息"
        open={feedbackModalVisible}
        onCancel={() => setFeedbackModalVisible(false)}
        footer={null}
        width={480}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>
                <QqOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                QQ交流群
              </Text>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#f5f5f5',
              borderRadius: '6px'
            }}>
              <Text copyable={false} style={{ fontSize: 16 }}>518446027</Text>
              <Button 
                type="primary" 
                icon={<CopyOutlined />}
                onClick={handleCopyQQ}
                size="small"
              >
                复制
              </Button>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>
                <MailOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                开发者邮箱
              </Text>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#f5f5f5',
              borderRadius: '6px'
            }}>
              <Text copyable={false} style={{ fontSize: 14 }}>good_luck_lct@163.com</Text>
              <Button 
                type="primary" 
                icon={<CopyOutlined />}
                onClick={handleCopyEmail}
                size="small"
              >
                复制
              </Button>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              欢迎加入QQ交流群与其他用户交流，或通过邮箱向开发者反馈问题和建议。
            </Text>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
