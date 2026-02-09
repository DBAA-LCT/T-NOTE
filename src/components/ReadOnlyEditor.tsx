import { Layout, Empty } from 'antd';
import { Page } from '../types';
import './ReadOnlyEditor.css';

const { Content } = Layout;

interface ReadOnlyEditorProps {
  page?: Page;
}

export default function ReadOnlyEditor({ page }: ReadOnlyEditorProps) {
  if (!page) {
    return (
      <Content style={{ 
        padding: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa'
      }}>
        <Empty 
          description="请选择一个页面"
          style={{ fontSize: 16 }}
        />
      </Content>
    );
  }

  return (
    <Content style={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#fff',
      overflow: 'auto'
    }}>
      <div style={{ 
        padding: '16px 24px',
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa'
      }}>
        <div style={{ 
          fontSize: 20,
          fontWeight: 600,
          marginBottom: 12,
          color: '#333'
        }}>
          {page.title || '未命名页面'}
        </div>
        
        {page.tags && page.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {page.tags.map(tag => (
              <span 
                key={tag}
                style={{
                  padding: '4px 8px',
                  background: '#e6f4ff',
                  color: '#1677ff',
                  borderRadius: '4px',
                  fontSize: 13
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div 
        className="readonly-content"
        style={{ 
          flex: 1,
          padding: '16px 24px',
          overflow: 'auto'
        }}
        dangerouslySetInnerHTML={{ __html: page.content || '<p style="color: #999;">暂无内容</p>' }}
      />
    </Content>
  );
}
