import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { associationAPI, slurmUserAPI, slurmAccountAPI, configAPI } from '@/api'

interface Association {
  user?: string
  account: string
  cluster?: string
  partition?: string
  qos?: string[]
  is_default?: boolean
}

function assocKey(a: Association) {
  return `${a.account}-${a.user ?? ''}-${a.cluster ?? ''}-${a.partition ?? ''}`
}

export default function AdminAssociations() {
  const { message, modal } = App.useApp()
  const [list, setList] = useState<Association[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [original, setOriginal] = useState<Association | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [clusterName, setClusterName] = useState('cluster')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await associationAPI.getAll()
      const data: any[] = res.data?.data ?? []
      setList(data.map(a => ({
        user: a.user || a.User || '',
        account: a.account || a.Account || '',
        cluster: a.cluster || a.Cluster || 'cluster',
        partition: a.partition || a.Partition || '',
        qos: Array.isArray(a.qos) ? a.qos : String(a.qos || '').split(',').map((s: string) => s.trim()).filter(Boolean),
        is_default: a.is_default || false,
      })))
    } catch (e: any) { message.error(e.response?.data?.error || '加载失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { 
    load()
    // Fetch cluster name from config
    configAPI.getSystemConfig().then(config => {
      if (config?.cluster_name) {
        setClusterName(config.cluster_name)
      }
    }).catch(() => {
      // Silently fail, use default value
    })
  }, [load])

  const openAdd = async () => {
    setIsEdit(false)
    setOriginal(null)
    form.resetFields()
    form.setFieldsValue({ cluster: clusterName })
    try {
      const [u, a] = await Promise.all([slurmUserAPI.getUsers(), slurmAccountAPI.getAccounts()])
      setUsers(u || [])
      setAccounts(a || [])
    } catch { /**/ }
    setModalOpen(true)
  }

  const openEdit = async (a: Association) => {
    setIsEdit(true)
    setOriginal(a)
    form.setFieldsValue({
      ...a,
      qos: (a.qos || []).join(', '),
    })
    try {
      const [u, acc] = await Promise.all([slurmUserAPI.getUsers(), slurmAccountAPI.getAccounts()])
      setUsers(u || [])
      setAccounts(acc || [])
    } catch { /**/ }
    setModalOpen(true)
  }

  const handleSave = async () => {
    const v = await form.validateFields()
    const qosList = String(v.qos || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    const data = { ...v, cluster: v.cluster || 'cluster', qos: qosList.length ? qosList : undefined }
    setSaving(true)
    try {
      if (isEdit && original) {
        await associationAPI.update(original.account, original.user || '', original.cluster || '', data)
        message.success('更新成功')
      } else {
        await associationAPI.create(data)
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      setTimeout(load, 800)
    } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = (a: Association) => {
    modal.confirm({
      title: `确认删除 ${a.user || '账户级'} → ${a.account} 的绑定？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        try {
          await associationAPI.delete(a.account, a.user || '', a.cluster || '', a.partition)
          message.success('删除成功')
          load()
        } catch (e: any) { message.error(e.response?.data?.error || '删除失败') }
      },
    })
  }

  const columns: ColumnsType<Association> = [
    {
      title: '用户', dataIndex: 'user', width: 130,
      render: v => v ? <strong>{v}</strong> : <Tag color="default">账户级</Tag>,
    },
    { title: '账户', dataIndex: 'account', width: 130 },
    { title: '集群', dataIndex: 'cluster', width: 100, render: v => v || '-' },
    { title: '分区', dataIndex: 'partition', width: 100, render: v => v || '-' },
    {
      title: 'QoS', dataIndex: 'qos',
      render: (v: string[]) => (v || []).length
        ? <Space size={4} wrap>{(v || []).map(q => <Tag key={q} color="purple">{q}</Tag>)}</Space>
        : '-',
    },
    {
      title: '操作', width: 120, fixed: 'right',
      render: (_, a) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(a)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(a)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      gap: 16,
      overflow: 'hidden'
    }}>
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>🔗 资源绑定管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>创建绑定</Button>
          </Space>
        </div>
        <Card>
          <Table columns={columns} dataSource={list} rowKey={assocKey}
            loading={loading} size="small" scroll={{ x: 800 }} pagination={{ pageSize: 20 }} />
        </Card>
      </div>

      {modalOpen && (
        <div style={{
          width: 440,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          overflow: 'hidden',
          height: 'fit-content',
          maxHeight: '100%'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #d9d9d9',
            flexShrink: 0
          }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {isEdit ? '编辑资源绑定' : '创建资源绑定'}
            </span>
            <Button
              type="text"
              size="small"
              onClick={() => { setModalOpen(false); form.resetFields() }}
              style={{ fontSize: '1rem', padding: '4px 8px' }}
            >
              ✕
            </Button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <Form form={form} layout="vertical">
              <Form.Item name="user" label="用户">
                <Select placeholder="选择 Slurm 用户" allowClear showSearch disabled={isEdit}>
                  {users.map(u => <Select.Option key={u.name} value={u.name}>{u.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="account" label="账户" rules={[{ required: true }]}>
                <Select placeholder="选择账户" showSearch disabled={isEdit}>
                  {accounts.map(a => <Select.Option key={a.name} value={a.name}>{a.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="cluster" label="集群" style={{ flex: 1 }}>
                  <Input placeholder="cluster" disabled={isEdit} />
                </Form.Item>
                <Form.Item name="partition" label="分区（可选）" style={{ flex: 1 }}>
                  <Input placeholder="留空表示全部" />
                </Form.Item>
              </Space>
              <Form.Item name="qos" label="QoS（逗号分隔）">
                <Input placeholder="normal, high, gpu" />
              </Form.Item>
            </Form>
          </div>

          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #d9d9d9',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            flexShrink: 0
          }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>
              取消
            </Button>
            <Button type="primary" onClick={handleSave} loading={saving}>
              保存
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
