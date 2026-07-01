import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { slurmAccountAPI, groupAPI } from '@/api'

interface SlurmAccount { name: string; description?: string; organization?: string }

export default function AdminSlurmAccounts() {
  const { message, modal } = App.useApp()
  const [accounts, setAccounts] = useState<SlurmAccount[]>([])
  const [ldapGroups, setLdapGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setAccounts(await slurmAccountAPI.getAccounts() || []) }
    catch (e: any) { message.error(e.response?.data?.error || '加载失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = async () => {
    setIsEdit(false)
    form.resetFields()
    try { setLdapGroups(await groupAPI.getGroups() || []) } catch { /**/ }
    setModalOpen(true)
  }

  const openEdit = (a: SlurmAccount) => {
    setIsEdit(true)
    form.setFieldsValue(a)
    setModalOpen(true)
  }

  const handleSave = async () => {
    const v = await form.validateFields()
    if (!v.description) v.description = v.name
    if (!v.organization) v.organization = 'Default'
    setSaving(true)
    try {
      if (isEdit) {
        await slurmAccountAPI.updateAccount(v.name, v)
        message.success('更新成功')
      } else {
        await slurmAccountAPI.createAccount(v)
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = (a: SlurmAccount) => {
    modal.confirm({
      title: `确认删除账户 ${a.name}？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        await slurmAccountAPI.deleteAccount(a.name)
        message.success('删除成功')
        setAccounts(prev => prev.filter(x => x.name !== a.name))
      },
    })
  }

  const columns: ColumnsType<SlurmAccount> = [
    { title: 'Account', dataIndex: 'name', width: 160, render: v => <strong>{v}</strong> },
    { title: '描述', dataIndex: 'description', render: v => v || <span style={{ color: '#94a3b8' }}>未设置</span> },
    { title: '组织', dataIndex: 'organization', width: 160, render: v => v || <span style={{ color: '#94a3b8' }}>未设置</span> },
    {
      title: '操作', width: 120,
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
          <span style={{ fontSize: 16, fontWeight: 600 }}>🏢 Slurm 账户管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>添加账户</Button>
          </Space>
        </div>
        <Card>
          <Table columns={columns} dataSource={accounts} rowKey="name"
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
              {isEdit ? '编辑账户' : '添加账户'}
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
              <Form.Item name="name" label={isEdit ? 'Account' : 'Account（选择 LDAP 用户组）'} rules={[{ required: true }]}>
                {isEdit ? <Input disabled /> : (
                  <Select placeholder="选择 LDAP 用户组" showSearch>
                    {ldapGroups.map(g => (
                      <Select.Option key={g.groupName} value={g.groupName}>
                        {g.groupName} (GID: {g.gid})
                      </Select.Option>
                    ))}
                  </Select>
                )}
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input placeholder="留空则使用账户名" />
              </Form.Item>
              <Form.Item name="organization" label="组织">
                <Input placeholder="留空则使用 Default" />
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
