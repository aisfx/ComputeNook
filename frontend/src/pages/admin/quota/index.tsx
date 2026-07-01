import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Progress, Tag, Button, Space, App, Statistic, Row, Col } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'

interface QuotaItem {
  username: string
  used_bytes: number
  hard_bytes: number
  used_files: number
  hard_files: number
  path?: string
}

function fmtBytes(b: number): string {
  if (!b) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = b
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

function pct(used: number, hard: number): number {
  if (!hard) return 0
  return Math.min(100, Math.round((used / hard) * 100))
}

export default function AdminQuota() {
  const { message } = App.useApp()
  const [list, setList] = useState<QuotaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/quota/all')
      setList(res.data.data || [])
    } catch (e: any) {
      message.error(e.response?.data?.error || '加载存储配额失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalUsed = list.reduce((s, i) => s + i.used_bytes, 0)
  const totalHard = list.reduce((s, i) => s + i.hard_bytes, 0)

  const columns: ColumnsType<QuotaItem> = [
    { title: '用户名', dataIndex: 'username', width: 140, render: v => <strong>{v}</strong> },
    {
      title: '存储用量',
      render: (_, q) => {
        const p = pct(q.used_bytes, q.hard_bytes)
        return (
          <div style={{ minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span>{fmtBytes(q.used_bytes)}</span>
              <span style={{ color: '#94a3b8' }}>/ {q.hard_bytes ? fmtBytes(q.hard_bytes) : '无限制'}</span>
            </div>
            <Progress percent={p} size="small" strokeColor={p >= 90 ? '#ef4444' : p >= 70 ? '#f59e0b' : '#6366f1'}
              style={{ marginBottom: 0 }} />
          </div>
        )
      },
    },
    {
      title: '文件数',
      render: (_, q) => {
        const p = pct(q.used_files, q.hard_files)
        return (
          <div style={{ minWidth: 160 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span>{q.used_files?.toLocaleString()}</span>
              <span style={{ color: '#94a3b8' }}>/ {q.hard_files ? q.hard_files.toLocaleString() : '无限制'}</span>
            </div>
            {q.hard_files > 0 && (
              <Progress percent={p} size="small" strokeColor={p >= 90 ? '#ef4444' : '#10b981'}
                style={{ marginBottom: 0 }} />
            )}
          </div>
        )
      },
    },
    {
      title: '状态', width: 90,
      render: (_, q) => {
        const p = pct(q.used_bytes, q.hard_bytes)
        if (p >= 100) return <Tag color="error">已超额</Tag>
        if (p >= 80) return <Tag color="warning">即将用完</Tag>
        return <Tag color="success">正常</Tag>
      },
    },
    { title: '路径', dataIndex: 'path', render: v => v ? <code style={{ fontSize: 11 }}>{v}</code> : '-' },
  ]

  const filtered = list.filter(q => !search || q.username.includes(search))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>💾 存储配额</span>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10 }}>
            <Statistic title="总用量" value={fmtBytes(totalUsed)} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10 }}>
            <Statistic title="总配额" value={totalHard ? fmtBytes(totalHard) : '未设置'} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10 }}>
            <Statistic title="用户数" value={list.length} suffix="人" valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 12 }}>
          <input
            placeholder="搜索用户名"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '4px 10px', border: '1px solid #d9d9d9', borderRadius: 6, outline: 'none', width: 200 }}
          />
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="username"
          loading={loading} size="small" pagination={{ pageSize: 20 }}
          locale={{ emptyText: '暂无配额数据' }} />
      </Card>
    </div>
  )
}
