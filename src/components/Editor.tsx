import { useState, useMemo, useRef, useEffect } from 'react';
import { Layout, Input, Tag, Space, Button, Typography, Empty } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Page } from '../types';

const { Content } = Layout;
const { Title } = Typography;

interface EditorProps {
  page?: Page;
  onUpdatePage: (updates: Partial<Page>) => void;
}

export default function Editor({ page, onUpdatePage }: EditorProps) {
  const [tagInput, setTagInput] = useState('');
  const quillRef = useRef<ReactQuill>(null);

  useEffect(() => {
    // 为工具栏按钮添加中文提示
    const toolbar = document.querySelector('.ql-toolbar');
    if (toolbar) {
      const tooltips: { [key: string]: string } = {
        '.ql-header[value="1"]': '标题 1',
        '.ql-header[value="2"]': '标题 2',
        '.ql-header[value="3"]': '标题 3',
        '.ql-header[value="false"]': '正文',
        '.ql-bold': '粗体',
        '.ql-italic': '斜体',
        '.ql-underline': '下划线',
        '.ql-strike': '删除线',
        '.ql-list[value="ordered"]': '有序列表',
        '.ql-list[value="bullet"]': '无序列表',
        '.ql-color': '文字颜色',
        '.ql-background': '背景颜色',
        '.ql-align': '对齐方式',
        '.ql-link': '插入链接',
        '.ql-image': '插入图片',
        '.ql-code-block': '代码块',
        '.ql-clean': '清除格式'
      };

      Object.entries(tooltips).forEach(([selector, title]) => {
        const element = toolbar.querySelector(selector);
        if (element) {
          element.setAttribute('title', title);
        }
      });
    }
  }, [page]);

  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['code-block'],
      ['clean']
    ]
  }), []);

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
          description="请选择或创建一个页面"
          style={{ fontSize: 16 }}
        />
      </Content>
    );
  }

  const addTag = () => {
    if (tagInput.trim() && !page.tags.includes(tagInput.trim())) {
      onUpdatePage({ tags: [...page.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    onUpdatePage({ tags: page.tags.filter(t => t !== tag) });
  };

  return (
    <Content style={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#fff'
    }}>
      <div style={{ 
        padding: '24px 32px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa'
      }}>
        <Input
          value={page.title}
          onChange={(e) => onUpdatePage({ title: e.target.value })}
          placeholder="输入页面标题..."
          bordered={false}
          style={{ 
            fontSize: 24,
            fontWeight: 600,
            marginBottom: 16,
            padding: 0
          }}
        />
        
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Space size={[8, 8]} wrap>
              {page.tags.map(tag => (
                <Tag 
                  key={tag} 
                  color="blue"
                  closable
                  onClose={() => removeTag(tag)}
                  style={{ fontSize: 13, padding: '4px 8px' }}
                >
                  {tag}
                </Tag>
              ))}
            </Space>
          </div>
          
          <Space.Compact style={{ maxWidth: 300 }}>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onPressEnter={addTag}
              placeholder="添加标签..."
              size="small"
            />
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={addTag}
              size="small"
            >
              添加
            </Button>
          </Space.Compact>
        </Space>
      </div>

      <div style={{ 
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px'
      }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={page.content}
          onChange={(content) => onUpdatePage({ content })}
          modules={modules}
          style={{ 
            height: 'calc(100% - 42px)',
            border: 'none'
          }}
        />
      </div>
    </Content>
  );
}
