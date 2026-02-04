import { Page } from '../types';

interface SidebarProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  searchTag: string;
  onSearchTagChange: (tag: string) => void;
}

export default function Sidebar({
  pages, currentPageId, onSelectPage, onAddPage, onDeletePage,
  onSave, onSaveAs, onOpen, searchTag, onSearchTagChange
}: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button onClick={onOpen}>打开</button>
        <button onClick={onSave}>保存</button>
        <button onClick={onSaveAs}>另存为</button>
      </div>
      <div className="sidebar-header">
        <button onClick={onAddPage}>新建页面</button>
      </div>
      
      <input
        type="text"
        placeholder="按标签搜索..."
        value={searchTag}
        onChange={(e) => onSearchTagChange(e.target.value)}
        className="search-input"
      />

      <div className="pages-list">
        {pages.map(page => (
          <div
            key={page.id}
            className={`page-item ${currentPageId === page.id ? 'active' : ''}`}
            onClick={() => onSelectPage(page.id)}
          >
            <div className="page-title">{page.title}</div>
            <div className="page-tags">
              {page.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); }}>
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
