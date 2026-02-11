import { useState, useEffect } from 'react';
import { List, Typography, Space, Button, Tag, Spin, Empty, message, Modal } from 'antd';
import {
  CloudOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { Note } from '../types';
import type { CloudPage } from '../types/onedrive-sync';

const { Text } = Typography;

interface CloudPagesPanelProps {
  currentNote: Note | null;
  onPageUpdate: () => void;
}

export default function CloudPagesPanel({ currentNote, onPageUpdate }: CloudPagesPanelProps) {
  const [cloudPages, setCloudPages] = useState<CloudPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewDialog, setViewDialog] = useState<{
    visible: boolean;
    page?: CloudPage;
    localPage?: any;
  }>({ visible: false });

  useEffect(() => {
    if (currentNote?.syncConfig?.enabled) {
      loadCloudPages();
    }
  }, [currentNote?.id, currentNote?.syncConfig?.enabled]);

  const loadCloudPages = async () => {
    if (!currentNote) return;

    setLoading(true);
    try {
      const pages = await window.electronAPI.onedrive.getCloudPages(currentNote.id);
      setCloudPages(pages);
    } catch (error: any) {
      message.error(error.message || '加载云端页面失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePageClick = (cloudPage: CloudPage) => {
    const localPage = currentNote?.pages.find(p => p.id === cloudPage.id);
    setViewDialog({
      visible: true,
      page: cloudPage,
      localPage
    });
  };

  const handleUseCloudVersion = async () => {
    if (!currentNote || !viewDialog.page) return;

    Modal.confirm({
      title: '使用云端版本',
      content: '确定要用云端版本覆盖本地内容吗？此操作不可撤销。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await window.electronAPI.onedrive.useCloudVersion(currentNote.id, viewDialog.page!.id);
          message.success('已使用云端版本');
          setViewDialog({ visible: false });
          onPageUpdate();
          loadCloudPages();
        } catch (error: any) {
          message.error(error.message || '操作失败');
        }
      }
    });
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays} 天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  const getStatusIcon = (status: CloudPage['status']) => {
    switch (status) {
      case 'synced':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'cloud_newer':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'local_newer':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return null;
    }
  };

  const getStatusText = (status: CloudPage['status']) => {
    switch (status) {
      case 'synced':
        return '已同步';
      case 'cloud_newer':
        return '云端较新';
      case 'local_newer':
        return '本地较新';
      case 'not_synced':
        return '未同步';
      default:
        return '';
    }
  };

  if (!currentNote?.syncConfig?.enabled) {
    return (
      <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            <CloudOutlined style={{ marginRight: 8 }} />
            云端页面
          </Text>
        </div>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="此笔记未启用同步"
          style={{ marginTop: 60 }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            <CloudOutlined style={{ marginRight: 8 }} />
            云端页面
          </Text>
          <Tag color="blue">{cloudPages.length} 个</Tag>
        </Space>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={loadCloudPages}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        <List
          dataSource={cloudPages}
          locale={{ emptyText: '云端暂无页面' }}
          renderItem={(page) => (
            <List.Item
              onClick={() => handlePageClick(page)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                background: '#fff',
                border: '1px solid #e8e8e8',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8e8e8';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Text strong>{page.name.replace('.json', '')}</Text>
                    {getStatusIcon(page.status)}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {getStatusText(page.status)}
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDate(page.updatedAt)}
                </Text>
              </div>
            </List.Item>
          )}
        />
      </Spin>

      <Modal
        title="云端页面"
        open={viewDialog.visible}
        onCancel={() => setViewDialog({ visible: false })}
        footer={[
          <Button key="cancel" onClick={() => setViewDialog({ visible: false })}>
            关闭
          </Button>,
          viewDialog.page?.status === 'cloud_newer' && (
            <Button key="use" type="primary" onClick={handleUseCloudVersion}>
              使用云端版本
            </Button>
          )
        ]}
        width={600}
      >
        {viewDialog.page && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong>页面名称：</Text>
              <Text>{viewDialog.page.name.replace('.json', '')}</Text>
            </div>
            <div>
              <Text strong>更新时间：</Text>
              <Text>{new Date(viewDialog.page.updatedAt).toLocaleString('zh-CN')}</Text>
            </div>
            <div>
              <Text strong>状态：</Text>
              <Space>
                {getStatusIcon(viewDialog.page.status)}
                <Text>{getStatusText(viewDialog.page.status)}</Text>
              </Space>
            </div>
            {viewDialog.page.status === 'cloud_newer' && (
              <div style={{
                padding: 12,
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: 4
              }}>
                <Text type="warning">
                  云端版本较新，点击"使用云端版本"将覆盖本地内容
                </Text>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
