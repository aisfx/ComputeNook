import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Space, Tag, App, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons'
import axios from 'axios'

interface Partition {
  id: number
  name: string
  nodes: string
  over_subscribe: string
  is_default: boolean
  max_time: string
  state: string
  allow_groups?: string
  allow_accounts?: string
  tres_billing_weights?: string
}

const STATE_COLOR: Record<string, string> = { UP: 'success', DOWN: 'error', DRAIN: 'warning', INACTIVE: 'default' }

export default function AdminPartitions() {
  const { message, modal } = App.useApp()
  const [list, setList] = useState<Partition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await axios.get('/partitions')
      setList(res.data.data || [])
    } catch (e: any) { setError(e.response?.data?.error || '加载失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setIsEdit(false)
    form.setFieldsValue({ nodes: 'ALL', over_subscribe: 'Exclusive', is_default: false, max_time: 'INFINITE', state: 'UP' })
    setModalOpen(true)
  }

  const openEdit = (p: Partition) => {
    setIsEdit(true)
    form.setFieldsValue(p)
    setModalOpen(true)
  }

  const handleSave = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      if (isEdit) {
        await axios.put(`/partitions/${v.name}`, v)
        message.success('更新成功')
      } else {
        await axios.post('/partitions', v)
        message.success('创建成功')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = (p: Partition) => {
    modal.confirm({
      title: `确认删除分区 ${p.name}？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        await axios.delete(`/partitions/${p.name}`)
        message.success('删除成功')
        load()
      },
    })
  }

  const handleApply = () => {
    modal.confirm({
      title: '应用分区配置',
      content: '将生成 partition.conf 并重新加载 Slurm 服务，确认继续？',
      okText: '应用', cancelText: '取消',
      onOk: async () => {
        setApplying(true)
        try {
          const res = await axios.post('/partitions/apply')
          message.success(res.data?.message || '应用成功')
        } catch (e: any) { message.error(e.response?.data?.error || '应用失败') }
        finally { setApplying(false) }
      },
    })
  }

  const columns: ColumnsType<Partition> = [
    {
      title: '分区名称', dataIndex: 'name', width: 130,
      render: (v, p) => <span>{v}{p.is_default && <Tag color="blue" style={{ marginLeft: 6 }}>默认</Tag>}</span>,
    },
    { title: '节点', dataIndex: 'nodes', width: 160 },
    { title: '超额订阅', dataIndex: 'over_subscribe', width: 110 },
    { title: '最大时间', dataIndex: 'max_time', width: 120 },
    {
      title: '状态', dataIndex: 'state', width: 90,
      render: v => <Tag color={STATE_COLOR[v] || 'default'}>{v}</Tag>,
    },
    { title: '允许组', dataIndex: 'allow_groups', render: v => v || '-' },
    { title: '允许账户', dataIndex: 'allow_accounts', render: v => v || '-' },
    {
      title: '操作', width: 120, fixed: 'right',
      render: (_, p) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(p)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(p)}>删除</Button>
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
          <span style={{ fontSize: 16, fontWeight: 600 }}>🗂️ 分区管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            <Button icon={<CheckOutlined />} loading={applying} onClick={handleApply}>应用配置</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>添加分区</Button>
          </Space>
        </div>
        {error && <Alert message={error} type="error" showIcon />}
        <Card>
          <Table columns={columns} dataSource={list} rowKey="id"
            loading={loading} size="small" scroll={{ x: 900 }} pagination={{ pageSize: 20 }} />
        </Card>
      </div>

      {modalOpen && (
        <div style={{
          width: 460,
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
              {isEdit ? '编辑分区' : '添加分区'}
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
              <Form.Item name="name" label="分区名称" rules={[{ required: true }]}>
                <Input disabled={isEdit} placeholder="all / gpu / high" />
              </Form.Item>
              <Form.Item name="nodes" label="节点列表" rules={[{ required: true }]}>
                <Input placeholder="ALL 或 node[01-10]" />
              </Form.Item>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="over_subscribe" label="超额订阅" style={{ flex: 1 }}>
                  <Select>
                    {['Exclusive', 'NO', 'YES', 'FORCE'].map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                  </Select>
                </Form.Item>
                <Form.Item name="state" label="状态" style={{ flex: 1 }}>
                  <Select>
                    {['UP', 'DOWN', 'DRAIN', 'INACTIVE'].map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Space>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="max_time" label="最大时间" style={{ flex: 1 }}>
                  <Input placeholder="INFINITE 或 7-00:00:00" />
                </Form.Item>
                <Form.Item name="is_default" label="默认分区" valuePropName="checked" style={{ flex: 1 }}>
                  <Switch />
                </Form.Item>
              </Space>
              <Form.Item name="allow_groups" label="允许的用户组（可选）">
                <Input placeholder="root,test1（逗号分隔）" />
              </Form.Item>
              <Form.Item name="allow_accounts" label="允许的账户（可选）">
                <Input placeholder="account1,account2（逗号分隔）" />
              </Form.Item>
              <Form.Item name="tres_billing_weights" label="TRES 计费权重（可选）">
                <Input placeholder="CPU=1.0,mem=1.0G,gres/gpu=10.0" />
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
