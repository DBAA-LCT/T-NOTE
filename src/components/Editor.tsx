import { useState, useMemo, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Page } from '../types';

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
    return <div className="editor-empty">请选择或创建一个页面</div>;
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
    <div className="editor">
      <div className="editor-header">
        <input
          type="text"
          value={page.title}
          onChange={(e) => onUpdatePage({ title: e.target.value })}
          className="title-input"
        />
        
        <div className="tags-section">
          <div className="tags">
            {page.tags.map(tag => (
              <span key={tag} className="tag">
                {tag}
                <button onClick={() => removeTag(tag)}>×</button>
              </span>
            ))}
          </div>
          <div className="tag-input-group">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              placeholder="添加标签..."
            />
            <button onClick={addTag}>添加</button>
          </div>
        </div>
      </div>

      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={page.content}
        onChange={(content) => onUpdatePage({ content })}
        modules={modules}
        className="quill-editor"
      />
    </div>
  );
}
