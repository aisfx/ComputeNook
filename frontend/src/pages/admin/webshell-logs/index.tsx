import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Input, Button, Space, DatePicker, Select, Tag, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

interface WebShellLog {
  id: number
  username: string
  remote_addr: string
  action: string
  status: string
  timestamp: string
  session_id?: string
  command?: string
  duration?: number
}

export default function AdminWebShellLogs() {
  const { message } = App.useApp()
  const [logs, setLogs] = useState<WebShellLog[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs()
  ])
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/admin/logs/webshell', {
        params: {
          start_time: dateRange[0].unix(),
          end_time: dateRange[1].unix(),
          status: statusFilter || undefined,
          search: search || undefined,
        }
      })
      setLogs(res.data.data || [])
    } catch (e: any) {
      message.error(e.response?.data?.error || '加载WebShell日志失败')
    } finally {
      setLoading(false)
    }
  }, [dateRange, statusFilter, search])

  useEffect(() => {
    load()
  }, [load])

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const columns: ColumnsType<WebShellLog> = [
    { 
      title: '时间', 
      dataIndex: 'timestamp', 
      width: 160,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss')
    },
    { title: '用户', dataIndex: 'username', width: 120 },
    { title: 'IP地址', dataIndex: 'remote_addr', width: 140 },
    { 
      title: '操作', 
      dataIndex: 'action', 
      width: 120,
      render: (v) => {
        const colorMap: Record<string, string> = {
          'connect': 'blue',
          'disconnect': 'default',
          'command': 'purple',
        }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      }
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      width: 100,
      render: (v) => {
        const colorMap: Record<string, string> = {
          'success': 'success',
          'failed': 'error',
        }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      }
    },
    { title: '会话ID', dataIndex: 'session_id', width: 200, render: (v) => v || '-' },
    { 
      title: '时长', 
      dataIndex: 'duration', 
      width: 100,
      render: formatDuration
    },
    { title: '命令', dataIndex: 'command', ellipsis: true, render: (v) => v || '-' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>💻 WebShell 日志</span>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          刷新
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', flexWrap: 'wrap' }}>
          <Input
            placeholder="搜索用户名、IP"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            format="YYYY-MM-DD"
          />
          <Select
            placeholder="状态"
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={load}>
            查询
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1100 }}
          pagination={{ 
            pageSize: 20, 
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  )
}
