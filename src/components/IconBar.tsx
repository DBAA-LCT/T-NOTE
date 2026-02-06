import { useState } from 'react';
import { Tooltip } from 'antd';
import { 
  FileTextOutlined, 
  SearchOutlined, 
  CheckSquareOutlined,
  BookOutlined
} from '@ant-design/icons';
import './IconBar.css';

export type IconBarTab = 'pages' | 'search' | 'todo' | 'bookmarks' | null;

interface IconBarProps {
  activeTab: IconBarTab;
  onTabChange: (tab: IconBarTab) => void;
}

export default function IconBar({ activeTab, onTabChange }: IconBarProps) {
  const handleIconClick = (tab: IconBarTab) => {
    // 如果点击的是当前激活的图标，则关闭
    if (activeTab === tab) {
      onTabChange(null);
    } else {
      onTabChange(tab);
    }
  };

  return (
    <div className="icon-bar">
      <Tooltip title="页面" placement="right">
        <div 
          className={`icon-item ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => handleIconClick('pages')}
        >
          <FileTextOutlined />
        </div>
      </Tooltip>

      <Tooltip title="搜索" placement="right">
        <div 
          className={`icon-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => handleIconClick('search')}
        >
          <SearchOutlined />
        </div>
      </Tooltip>

      <Tooltip title="TODO" placement="right">
        <div 
          className={`icon-item ${activeTab === 'todo' ? 'active' : ''}`}
          onClick={() => handleIconClick('todo')}
        >
          <CheckSquareOutlined />
        </div>
      </Tooltip>

      <Tooltip title="书签" placement="right">
        <div 
          className={`icon-item ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => handleIconClick('bookmarks')}
        >
          <BookOutlined />
        </div>
      </Tooltip>
    </div>
  );
}
