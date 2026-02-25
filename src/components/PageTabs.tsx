import { useState } from 'react';
import { SplitCellsOutlined, CloseOutlined } from '@ant-design/icons';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import './PageTabs.css';

interface PageTab {
  id: string;
  title: string;
}

interface PageTabsProps {
  tabs: PageTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onSplitView?: (tabId: string) => void;
  onTabReorder?: (tabs: PageTab[]) => void;
  headerCollapsed?: boolean;
  onToggleHeaderCollapsed?: () => void;
}

export default function PageTabs({ tabs, activeTabId, onTabClick, onTabClose, onSplitView, onTabReorder, headerCollapsed, onToggleHeaderCollapsed }: PageTabsProps) {
  const [contextMenuTab, setContextMenuTab] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [isDraggingToSplit, setIsDraggingToSplit] = useState<boolean>(false);
  
  // 最多显示5个tab
  const visibleTabs = tabs.slice(0, 5);
  const hasMoreTabs = tabs.length > 5;

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenuTab(tabId);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenuTab(null);
    setContextMenuPosition(null);
  };

  const menuItems: ContextMenuItem[] = [
    {
      key: 'split',
      label: '分屏显示',
      icon: <SplitCellsOutlined />,
      onClick: () => contextMenuTab && onSplitView?.(contextMenuTab)
    },
    { key: 'divider', label: '', divider: true },
    {
      key: 'close',
      label: '关闭',
      icon: <CloseOutlined />,
      onClick: () => contextMenuTab && onTabClose?.(contextMenuTab)
    }
  ];

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== tabId) {
      setDragOverTab(tabId);
      setIsDraggingToSplit(false); // 在tab上时不是分屏状态
    }
  };

  // 拖拽离开
  const handleDragLeave = () => {
    setDragOverTab(null);
  };

  // 放下
  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    
    if (!draggedTab || !onTabReorder) return;

    // 排序
    const draggedIndex = tabs.findIndex(t => t.id === draggedTab);
    const targetIndex = tabs.findIndex(t => t.id === targetTabId);
    
    if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
      const newTabs = [...tabs];
      const [removed] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, removed);
      onTabReorder(newTabs);
    }
    
    setDraggedTab(null);
    setDragOverTab(null);
    setIsDraggingToSplit(false);
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedTab(null);
    setDragOverTab(null);
    setIsDraggingToSplit(false);
  };

  if (tabs.length === 0) return null;

  return (
    <>
      <div className="page-tabs">
        {visibleTabs.map(tab => (
          <div
            key={tab.id}
            className={`page-tab ${tab.id === activeTabId ? 'active' : ''} ${dragOverTab === tab.id ? 'drag-over' : ''} ${draggedTab === tab.id ? 'dragging' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabClick(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
          >
            <span className="page-tab-title">{tab.title}</span>
            {onTabClose && (
              <span
                className="page-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
              >
                ×
              </span>
            )}
          </div>
        ))}
        {hasMoreTabs && (
          <div className="page-tab more-tabs">
            +{tabs.length - 5}
          </div>
        )}
        
        {/* 折叠标题栏按钮 */}
        {onToggleHeaderCollapsed && (
          <div
            className="page-tab-collapse-btn"
            onClick={onToggleHeaderCollapsed}
            title={headerCollapsed ? '展开标题栏' : '折叠标题栏'}
          >
            {headerCollapsed ? '▼' : '▲'}
          </div>
        )}
        
        {/* 分屏拖放区域 */}
        {draggedTab && (
          <div
            className="split-drop-zone"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingToSplit(true);
            }}
            onDragLeave={() => {
              setIsDraggingToSplit(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedTab) {
                onSplitView?.(draggedTab);
              }
              setDraggedTab(null);
              setIsDraggingToSplit(false);
            }}
          >
            <div className={`split-drop-zone-content ${isDraggingToSplit ? 'active' : ''}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="18" />
                <rect x="14" y="3" width="7" height="18" />
              </svg>
              <span>拖到这里分屏</span>
            </div>
          </div>
        )}
      </div>

      <ContextMenu
        visible={!!contextMenuPosition}
        x={contextMenuPosition?.x || 0}
        y={contextMenuPosition?.y || 0}
        items={menuItems}
        onClose={closeContextMenu}
      />
    </>
  );
}
