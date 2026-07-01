import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Space, Tag, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { groupAPI } from '@/api'

interface Group {
  groupName: string
  gid: number
  members?: string[]
}

export default function AdminGroups() {
  const { message, modal } = App.useApp()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setGroups(await groupAPI.getGroups() || []) }
    catch (e: any) { message.error(e.response?.data?.error || '加载失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = async () => {
    setIsEdit(false)
    try {
      const gid = await groupAPI.getNextGID()
      form.setFieldsValue({ gid, members: '' })
    } catch { form.setFieldsValue({ members: '' }) }
    setModalOpen(true)
  }

  const openEdit = (g: Group) => {
    setIsEdit(true)
    form.setFieldsValue({ ...g, members: (g.members || []).join('\n') })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const v = await form.validateFields()
    const members = (v.members || '').split('\n').map((s: string) => s.trim()).filter(Boolean)
    setSaving(true)
    try {
      if (isEdit) {
        await groupAPI.updateGroup(v.gid, { ...v, members })
        message.success('更新成功')
      } else {
        await groupAPI.createGroup({ ...v, members })
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = (g: Group) => {
    modal.confirm({
      title: `确认删除用户组 ${g.groupName}？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        await groupAPI.deleteGroup(g.gid)
        message.success('删除成功')
        setGroups(prev => prev.filter(x => x.gid !== g.gid))
      },
    })
  }

  const columns: ColumnsType<Group> = [
    { title: '组名', dataIndex: 'groupName', width: 160, render: v => <strong>{v}</strong> },
    { title: 'GID', dataIndex: 'gid', width: 80 },
    { title: '成员数', width: 80, render: (_, g) => g.members?.length ?? 0 },
    {
      title: '成员列表',
      render: (_, g) => (
        <Space size={4} wrap>
          {(g.members || []).slice(0, 8).map(m => <Tag key={m} color="blue">{m}</Tag>)}
          {(g.members?.length ?? 0) > 8 && <Tag>+{(g.members?.length ?? 0) - 8}</Tag>}
          {(!g.members || g.members.length === 0) && <span style={{ color: '#94a3b8' }}>无成员</span>}
        </Space>
      ),
    },
    {
      title: '操作', width: 120,
      render: (_, g) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(g)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(g)}>删除</Button>
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
      {/* 左侧：用户组列表 */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>👥 用户组管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>添加用户组</Button>
          </Space>
        </div>

        <Card>
          <Table columns={columns} dataSource={groups} rowKey="gid"
            loading={loading} size="small" pagination={{ pageSize: 20 }} />
        </Card>
      </div>

      {/* 右侧：添加/编辑面板 */}
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
              {isEdit ? '编辑用户组' : '添加用户组'}
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
              <Form.Item name="groupName" label="组名" rules={[{ required: true }]}>
                <Input disabled={isEdit} placeholder="groupname" />
              </Form.Item>
              <Form.Item name="gid" label="GID" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1000} disabled={isEdit} />
              </Form.Item>
              <Form.Item name="members" label="成员列表">
                <Input.TextArea rows={8} placeholder={'每行一个用户名\nuser1\nuser2'} />
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
