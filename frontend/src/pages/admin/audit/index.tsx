import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Table, Button, Modal, Select, Input, Tag, Space, Descriptions, App, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import axios from 'axios'

interface AuditLog {
  id: number
  timestamp: string
  username: string
  user_role: string
  action: string
  resource: string
  resource_id?: string
  status: 'success' | 'failed'
  ip_address?: string
  duration?: number
  details?: string
  error_msg?: string
  user_agent?: string
  access_host?: string
}

const ACTION_LABELS: Record<string, string> = {
  create: '创建', update: '更新', delete: '删除', read: '读取',
  login: '登录', logout: '登出', reset_password: '重置密码',
  change_password: '修改密码', set_disabled: '禁用/启用',
  shell_command: 'Shell命令', shell_blocked: '⛔被拦截', page_view: '页面访问',
}
const RESOURCE_LABELS: Record<string, string> = {
  user: '用户', group: '用户组', account: '账户', association: '关联',
  qos: 'QoS', job: '作业', file: '文件', auth: '认证',
}

export default function AdminAudit() {
  const { message } = App.useApp()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ username: '', action: '', resource: '', status: '', timeRange: '24h' })
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const buildParams = useCallback(() => {
    const p: any = { limit: 1000 }
    if (filters.username) p.username = filters.username
    if (filters.action) p.action = filters.action
    if (filters.resource) p.resource = filters.resource
    if (filters.status) p.status = filters.status
    if (filters.timeRange) {
      const now = new Date()
      const ranges: Record<string, number> = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 }
      const hours = ranges[filters.timeRange]
      if (hours) {
        p.start_time = new Date(now.getTime() - hours * 3600000).toISOString()
        p.end_time = now.toISOString()
      }
    }
    return p
  }, [filters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/audit/logs', { params: buildParams() })
      setLogs(res.data.data || [])
    } catch (e: any) { message.error(e.response?.data?.error || '加载失败') }
    finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { load() }, [load])

  const setFilter = (key: string, val: string) => {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  // 防抖用户名搜索
  const handleUsernameChange = (val: string) => {
    setFilters(prev => ({ ...prev, username: val }))
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(load, 500)
  }

  const columns: ColumnsType<AuditLog> = [
    {
      title: '时间', dataIndex: 'timestamp', width: 150,
      render: v => dayjs(v).format('MM-DD HH:mm:ss'),
    },
    { title: '用户', dataIndex: 'username', width: 100 },
    {
      title: '操作', dataIndex: 'action', width: 110,
      render: v => <Tag>{ACTION_LABELS[v] || v}</Tag>,
    },
    {
      title: '资源', dataIndex: 'resource', width: 90,
      render: v => RESOURCE_LABELS[v] || v,
    },
    { title: '资源ID', dataIndex: 'resource_id', width: 120, render: v => v || '-' },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: v => v === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>,
    },
    { title: 'IP', dataIndex: 'ip_address', width: 130 },
    { title: '耗时', dataIndex: 'duration', width: 70, render: v => v ? `${v}ms` : '-' },
    {
      title: '操作', width: 70, fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelected(row)}>详情</Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>📋 审计日志</span>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>

      <Card>
        {/* 过滤栏 */}
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search placeholder="用户名" style={{ width: 160 }}
            value={filters.username} onChange={e => handleUsernameChange(e.target.value)} allowClear />
          <Select value={filters.action} onChange={v => setFilter('action', v)} style={{ width: 140 }}
            placeholder="操作类型" allowClear onClear={() => setFilter('action', '')}>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
          </Select>
          <Select value={filters.resource} onChange={v => setFilter('resource', v)} style={{ width: 120 }}
            placeholder="资源类型" allowClear onClear={() => setFilter('resource', '')}>
            {Object.entries(RESOURCE_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
          </Select>
          <Select value={filters.status} onChange={v => setFilter('status', v)} style={{ width: 100 }}
            placeholder="状态" allowClear onClear={() => setFilter('status', '')}>
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <Select value={filters.timeRange} onChange={v => setFilter('timeRange', v)} style={{ width: 130 }}>
            <Select.Option value="">全部时间</Select.Option>
            <Select.Option value="1h">最近1小时</Select.Option>
            <Select.Option value="24h">最近24小时</Select.Option>
            <Select.Option value="7d">最近7天</Select.Option>
            <Select.Option value="30d">最近30天</Select.Option>
          </Select>
          <Button onClick={() => { setFilters({ username: '', action: '', resource: '', status: '', timeRange: '24h' }) }}>重置</Button>
        </Space>

        <Table columns={columns} dataSource={logs} rowKey="id"
          loading={loading} size="small" scroll={{ x: 900 }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          rowClassName={row => row.status === 'failed' ? 'ant-table-row-failed' : ''}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal title="审计日志详情" open={!!selected} onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>关闭</Button>} width={600}>
        {selected && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="日志ID">{selected.id}</Descriptions.Item>
            <Descriptions.Item label="时间">{dayjs(selected.timestamp).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="用户">{selected.username} ({selected.user_role})</Descriptions.Item>
            <Descriptions.Item label="操作">{ACTION_LABELS[selected.action] || selected.action}</Descriptions.Item>
            <Descriptions.Item label="资源">{RESOURCE_LABELS[selected.resource] || selected.resource}</Descriptions.Item>
            <Descriptions.Item label="资源ID">{selected.resource_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {selected.status === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>}
            </Descriptions.Item>
            {selected.error_msg && <Descriptions.Item label="错误信息"><span style={{ color: '#ef4444' }}>{selected.error_msg}</span></Descriptions.Item>}
            <Descriptions.Item label="IP">{selected.ip_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="耗时">{selected.duration ? `${selected.duration}ms` : '-'}</Descriptions.Item>
            {selected.details && (
              <Descriptions.Item label="操作详情">
                <pre style={{ margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>{selected.details}</pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
