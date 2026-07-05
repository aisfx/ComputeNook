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
      title: '用户', dataIndex: 'user', width: 120,
      render: v => v ? <span style={{ fontWeight: 600 }}>{v}</span> : <Tag color="default" style={{ margin: 0 }}>账户级</Tag>,
    },
    { title: '账户', dataIndex: 'account', width: 120, render: v => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: '集群', dataIndex: 'cluster', width: 100, render: v => <span style={{ fontSize: 12, color: '#666' }}>{v || '-'}</span> },
    { title: '分区', dataIndex: 'partition', width: 100, render: v => <span style={{ fontSize: 12, color: '#666' }}>{v || '-'}</span> },
    {
      title: 'QoS', dataIndex: 'qos', width: 200,
      render: (v: string[]) => {
        if (!v || v.length === 0) return <span style={{ color: '#ccc' }}>-</span>
        return (
          <Space size={4} wrap>
            {v.slice(0, 3).map(q => <Tag key={q} color="purple" style={{ margin: 0, fontSize: 11 }}>{q}</Tag>)}
            {v.length > 3 && <Tag style={{ margin: 0, fontSize: 11 }}>+{v.length - 3}</Tag>}
          </Space>
        )
      },
    },
    {
      title: '操作', width: 80, fixed: 'right', align: 'center',
      render: (_, a) => (
        <Space size={0}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(a)} title="编辑" />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(a)} title="删除" />
        </Space>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* 页面头部 */}
      <Card size="small" bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span style={{ fontSize: 18, fontWeight: 600 }}>🔗 资源绑定管理</span>
            <Tag color="blue">{list.length} 条绑定</Tag>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>创建绑定</Button>
          </Space>
        </div>
      </Card>

      {/* 主内容区域 */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* 左侧：绑定列表 */}
        <Card 
          bordered={false} 
          style={{ 
            flex: modalOpen ? '0 0 calc(100% - 480px)' : 1,
            transition: 'flex 0.3s',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          styles={{ body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 } }}
        >
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Table 
              columns={columns} 
              dataSource={list} 
              rowKey={assocKey}
              loading={loading} 
              size="small" 
              scroll={{ x: 800 }} 
              pagination={{ 
                pageSize: 20, 
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条绑定`
              }} 
            />
          </div>
        </Card>

        {/* 右侧：添加/编辑面板 */}
        {modalOpen && (
          <Card
            bordered={false}
            style={{
              width: 460,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              animation: 'slideInRight 0.3s',
              maxHeight: '100%',
              overflow: 'hidden'
            }}
            styles={{ body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 } }}
          >
            {/* 面板头部 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #f0f0f0',
              background: '#fafafa'
            }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {isEdit ? '📝 编辑资源绑定' : '➕ 创建资源绑定'}
              </span>
              <Button
                type="text"
                size="small"
                onClick={() => { setModalOpen(false); form.resetFields() }}
                style={{ fontSize: 18 }}
              >
                ×
              </Button>
            </div>
            
            {/* 面板内容 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <Form form={form} layout="vertical">
                <Form.Item name="user" label="用户">
                  <Select 
                    placeholder="选择 Slurm 用户（留空为账户级绑定）" 
                    allowClear 
                    showSearch 
                    disabled={isEdit}
                  >
                    {users.map(u => <Select.Option key={u.name} value={u.name}>{u.name}</Select.Option>)}
                  </Select>
                </Form.Item>
                <Form.Item 
                  name="account" 
                  label="账户" 
                  rules={[{ required: true, message: '请选择账户' }]}
                >
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

            {/* 面板底部按钮 */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #f0f0f0',
              background: '#fafafa',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8
            }}>
              <Button onClick={() => { setModalOpen(false); form.resetFields() }}>
                取消
              </Button>
              <Button type="primary" onClick={handleSave} loading={saving}>
                {isEdit ? '保存' : '创建'}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
