import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { slurmUserAPI, slurmAccountAPI } from '@/api'

interface SlurmUser { name: string; default_account?: string; admin_level?: string }

export default function AdminSlurmUsers() {
  const { message, modal } = App.useApp()
  const [users, setUsers] = useState<SlurmUser[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, a] = await Promise.all([slurmUserAPI.getUsers(), slurmAccountAPI.getAccounts()])
      setUsers(u || [])
      setAccounts(a || [])
    } catch (e: any) { message.error(e.response?.data?.error || '加载失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setIsEdit(false); form.resetFields(); setModalOpen(true) }
  const openEdit = (u: SlurmUser) => { setIsEdit(true); form.setFieldsValue(u); setModalOpen(true) }

  const handleSave = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      if (isEdit) {
        await slurmUserAPI.updateUser(v.name, v)
        message.success('更新成功')
      } else {
        await slurmUserAPI.createUser(v)
        message.success('创建成功')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = (u: SlurmUser) => {
    modal.confirm({
      title: `确认删除 Slurm 用户 ${u.name}？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        await slurmUserAPI.deleteUser(u.name)
        message.success('删除成功')
        setUsers(prev => prev.filter(x => x.name !== u.name))
      },
    })
  }

  const columns: ColumnsType<SlurmUser> = [
    { title: '用户名', dataIndex: 'name', width: 160, render: v => <strong>{v}</strong> },
    { title: '默认账户', dataIndex: 'default_account', width: 160, render: v => v || '-' },
    { title: '管理级别', dataIndex: 'admin_level', width: 120, render: v => v || 'None' },
    {
      title: '操作', width: 120,
      render: (_, u) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(u)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(u)}>删除</Button>
        </Space>
      ),
    },
  ]

  const filtered = users.filter(u => !search || u.name.includes(search))

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
          <span style={{ fontSize: 16, fontWeight: 600 }}>🧑 Slurm 用户管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>添加用户</Button>
          </Space>
        </div>
        <Card>
          <Input.Search placeholder="搜索用户名" style={{ maxWidth: 260, marginBottom: 12 }}
            value={search} onChange={e => setSearch(e.target.value)} allowClear />
          <Table columns={columns} dataSource={filtered} rowKey="name"
            loading={loading} size="small" pagination={{ pageSize: 20 }} />
        </Card>
      </div>

      {modalOpen && (
        <div style={{
          width: 420,
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
              {isEdit ? '编辑 Slurm 用户' : '添加 Slurm 用户'}
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
              <Form.Item name="name" label="用户名" rules={[{ required: true }]}>
                <Input disabled={isEdit} />
              </Form.Item>
              <Form.Item name="default_account" label="默认账户">
                <Select placeholder="选择账户" allowClear showSearch>
                  {accounts.map(a => <Select.Option key={a.name} value={a.name}>{a.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="admin_level" label="管理级别">
                <Select defaultValue="None">
                  <Select.Option value="None">None</Select.Option>
                  <Select.Option value="Operator">Operator</Select.Option>
                  <Select.Option value="Administrator">Administrator</Select.Option>
                </Select>
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
