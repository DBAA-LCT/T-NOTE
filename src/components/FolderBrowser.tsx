import { useState, useEffect } from 'react';
import { Modal, Tree, Spin, message, Button, Input, Space } from 'antd';
import { FolderOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';

interface FolderBrowserProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (folderPath: string) => void;
  initialPath?: string;
}

export default function FolderBrowser({ visible, onClose, onSelect, initialPath }: FolderBrowserProps) {
  const [folderTree, setFolderTree] = useState<DataNode[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    if (visible) {
      loadRootFolders();
      if (initialPath) {
        setSelectedKeys([initialPath]);
      }
    }
  }, [visible, initialPath]);

  const loadFolders = async (parentPath?: string): Promise<DataNode[]> => {
    try {
      const folders = await window.electronAPI.onedrive.browseFolders(parentPath);
      return folders.map(folder => ({
        title: folder.name,
        key: folder.path,
        isLeaf: folder.childCount === 0,
        icon: ({ expanded }: any) => expanded ? <FolderOpenOutlined /> : <FolderOutlined />
      }));
    } catch (error: any) {
      message.error(error.message || '加载文件夹失败');
      return [];
    }
  };

  const loadRootFolders = async () => {
    setLoadingFolders(true);
    try {
      const rootFolders = await loadFolders();
      setFolderTree(rootFolders);
    } catch (error: any) {
      message.error(error.message || '加载根文件夹失败');
    } finally {
      setLoadingFolders(false);
    }
  };

  const onLoadData = async (treeNode: any): Promise<void> => {
    const { key } = treeNode;
    const children = await loadFolders(key as string);
    
    setFolderTree(prevTree => {
      const updateTreeData = (list: DataNode[]): DataNode[] => {
        return list.map(node => {
          if (node.key === key) {
            return { ...node, children };
          }
          if (node.children) {
            return { ...node, children: updateTreeData(node.children) };
          }
          return node;
        });
      };
      return updateTreeData(prevTree);
    });
  };

  const handleFolderSelect = (keys: React.Key[]) => {
    setSelectedKeys(keys);
  };

  const handleConfirm = () => {
    if (selectedKeys.length > 0) {
      onSelect(selectedKeys[0] as string);
      onClose();
    } else {
      message.warning('请选择一个文件夹');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.warning('请输入文件夹名称');
      return;
    }

    setCreatingFolder(true);
    try {
      const parentPath = selectedKeys.length > 0 ? (selectedKeys[0] as string) : undefined;
      const newFolder = await window.electronAPI.onedrive.createFolder(newFolderName.trim(), parentPath);
      
      message.success('文件夹创建成功');
      setNewFolderName('');
      setShowCreateFolder(false);
      
      // 刷新文件夹树
      if (parentPath) {
        // 重新加载父文件夹的子文件夹
        const children = await loadFolders(parentPath);
        setFolderTree(prevTree => {
          const updateTreeData = (list: DataNode[]): DataNode[] => {
            return list.map(node => {
              if (node.key === parentPath) {
                return { ...node, children };
              }
              if (node.children) {
                return { ...node, children: updateTreeData(node.children) };
              }
              return node;
            });
          };
          return updateTreeData(prevTree);
        });
        
        // 展开父文件夹
        if (!expandedKeys.includes(parentPath)) {
          setExpandedKeys([...expandedKeys, parentPath]);
        }
      } else {
        // 重新加载根文件夹
        loadRootFolders();
      }
      
      // 选中新创建的文件夹
      setSelectedKeys([newFolder.path]);
    } catch (error: any) {
      message.error(error.message || '创建文件夹失败');
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <Modal
      title="选择云端文件夹"
      open={visible}
      onCancel={onClose}
      onOk={handleConfirm}
      okText="确定"
      cancelText="取消"
      width={600}
      footer={[
        <Button key="create" icon={<PlusOutlined />} onClick={() => setShowCreateFolder(!showCreateFolder)}>
          新建文件夹
        </Button>,
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="ok" type="primary" onClick={handleConfirm}>
          确定
        </Button>
      ]}
    >
      {showCreateFolder && (
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            placeholder="输入新文件夹名称"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onPressEnter={handleCreateFolder}
          />
          <Button 
            type="primary" 
            loading={creatingFolder}
            onClick={handleCreateFolder}
          >
            创建
          </Button>
        </Space.Compact>
      )}
      
      <Spin spinning={loadingFolders}>
        <div style={{ 
          minHeight: 300, 
          maxHeight: 400, 
          overflow: 'auto',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          padding: 8
        }}>
          {folderTree.length > 0 ? (
            <Tree
              showIcon
              loadData={onLoadData}
              treeData={folderTree}
              onSelect={handleFolderSelect}
              selectedKeys={selectedKeys}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys)}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              {loadingFolders ? '加载中...' : '暂无文件夹'}
            </div>
          )}
        </div>
      </Spin>
      
      {selectedKeys.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>已选择：</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedKeys[0]}</div>
        </div>
      )}
    </Modal>
  );
}
