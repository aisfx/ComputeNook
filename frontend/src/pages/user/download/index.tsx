import { Card, Button, Space, Tag, Divider } from 'antd'
import { DownloadOutlined, WindowsOutlined, AppleOutlined, LinuxOutlined } from '@ant-design/icons'
import { getApiBase } from '@/utils/auth'

const clients = [
  { os: 'Windows', icon: <WindowsOutlined />, file: 'hpc-client-windows.exe', color: '#0078d4' },
  { os: 'macOS (Apple Silicon)', icon: <AppleOutlined />, file: 'hpc-client-mac-arm64', color: '#555' },
  { os: 'macOS (Intel)', icon: <AppleOutlined />, file: 'hpc-client-mac-amd64', color: '#555' },
  { os: 'Linux', icon: <LinuxOutlined />, file: 'hpc-client-linux', color: '#e67e22' },
]

export default function DownloadPage() {
  const base = getApiBase()

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>⬇️ 客户端下载</span>

      <Card title="HPC 客户端">
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
          下载桌面客户端，可在本地建立到计算节点的隧道，用于远程桌面和端口转发。
        </p>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {clients.map(c => (
            <div key={c.file} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 8,
            }}>
              <Space>
                <span style={{ fontSize: 18, color: c.color }}>{c.icon}</span>
                <span style={{ fontWeight: 500 }}>{c.os}</span>
              </Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="small"
                style={{ background: '#6366f1', borderColor: '#6366f1' }}
                onClick={() => window.open(`${base}/api/download/client/${c.file}`, '_blank')}
              >
                下载
              </Button>
            </div>
          ))}
        </Space>

        <Divider />

        <div style={{ fontSize: 13, color: '#64748b' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>使用说明</div>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li>下载对应系统的客户端</li>
            <li>macOS / Linux 用户需要先赋予执行权限：<code>chmod +x hpc-client-*</code></li>
            <li>启动后在浏览器访问远程桌面，客户端会自动建立隧道</li>
            <li>Windows 用户直接双击运行</li>
          </ul>
        </div>
      </Card>

      <Card title="WebDAV 挂载">
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
          将家目录挂载为本地磁盘，直接在文件管理器中访问。
        </p>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#64748b' }}>WebDAV 地址：</span>
            <code>{base}/api/webdav</code>
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#64748b' }}>用户名：</span>你的 LDAP 用户名
          </div>
          <div>
            <span style={{ color: '#64748b' }}>密码：</span>你的 LDAP 密码
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
          Windows：在文件资源管理器地址栏输入地址 → 右键"映射网络驱动器"<br />
          macOS：Finder → 前往 → 连接服务器 → 输入地址
        </div>
      </Card>
    </div>
  )
}
