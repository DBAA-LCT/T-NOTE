import { Layout, Typography, Empty } from 'antd';
import { CheckSquareOutlined } from '@ant-design/icons';

const { Sider } = Layout;
const { Text } = Typography;

export default function TodoPanel() {
  return (
    <Sider 
      width={280} 
      style={{ 
        background: '#fafafa',
        borderRight: '1px solid #e8e8e8',
        height: '100vh',
        overflow: 'auto'
      }}
    >
      <div style={{ padding: '16px' }}>
        <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
          待办事项
        </Text>

        <Empty 
          image={<CheckSquareOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
          description="TODO 功能即将推出"
          style={{ marginTop: 60 }}
        />
      </div>
    </Sider>
  );
}
