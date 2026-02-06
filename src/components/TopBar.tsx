import { Button, Space, Typography } from 'antd';
import { 
  FolderOpenOutlined, 
  SaveOutlined, 
  SaveFilled,
  FileTextOutlined
} from '@ant-design/icons';

const { Title } = Typography;

interface TopBarProps {
  noteName: string;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
}

export default function TopBar({ noteName, onSave, onSaveAs, onOpen }: TopBarProps) {
  return (
    <div style={{ 
      height: 50,
      background: '#fafafa',
      borderBottom: '1px solid #e8e8e8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }}>
      <Title level={5} style={{ margin: 0 }}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        {noteName}
      </Title>
      
      <Space>
        <Button icon={<FolderOpenOutlined />} onClick={onOpen}>
          打开
        </Button>
        <Button icon={<SaveOutlined />} onClick={onSave} type="primary">
          保存
        </Button>
        <Button icon={<SaveFilled />} onClick={onSaveAs}>
          另存为
        </Button>
      </Space>
    </div>
  );
}
