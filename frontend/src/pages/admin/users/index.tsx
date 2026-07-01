import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Switch,
  Tag, Space, Dropdown, App,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
  PlusOutlined, ReloadOutlined,
  EditOutlined, KeyOutlined, DeleteOutlined, MoreOutlined,
  LockOutlined, UnlockOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { userAPI, mfaAPI } from '@/api'

interface User {
  username: string
  uid: number
  gid: number
  cnName?: string
  email?: string
  phone?: string
  shell?: string
  homeDir?: string
  isAdmin?: boolean
  disabled?: boolean
  passwordMustChange?: boolean
}

interface MFAStatus {
  confirmed: boolean
  enabled: boolean
}

export default function AdminUsers() {
  const { message, modal } = App.useApp()
  const [users, setUsers] = useState<User[]>([])
  const [mfaStatus, setMfaStatus] = useState<Record<string, MFAStatus>>({})
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // 弹窗
  const [modalOpen, setModalOpen] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // 重置密码弹窗
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [pwdTarget, setPwdTarget] = useState('')
  const [pwdForm] = Form.useForm()
  const [pwdSaving, setPwdSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await userAPI.getUsers()
      setUsers(data || [])
    } catch (err: any) {
      message.error(err.response?.data?.error || '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMFAStatus = useCallback(async () => {
    try {
      const res = await axios.get('/mfa/admin/list')
      const map: Record<string, MFAStatus> = {}
      for (const item of res.data.data || []) map[item.username] = item
      setMfaStatus(map)
    } catch { /* MFA list optional */ }
  }, [])

  useEffect(() => {
    loadUsers()
    loadMFAStatus()
  }, [loadUsers, loadMFAStatus])

  const openAdd = async () => {
    setIsEdit(false)
    try {
      const uid = await userAPI.getNextUID()
      form.setFieldsValue({ uid, gid: uid, shell: '/bin/bash', isAdmin: false })
    } catch {
      form.setFieldsValue({ shell: '/bin/bash', isAdmin: false })
    }
    setModalOpen(true)
  }

  const openEdit = (u: User) => {
    setIsEdit(true)
    form.setFieldsValue({ ...u })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (isEdit) {
        await userAPI.updateUser(values.username, values)
        message.success('用户更新成功')
      } else {
        await userAPI.createUser(values)
        message.success('用户创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      loadUsers()
    } catch (err: any) {
      message.error(err.response?.data?.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPwd = async () => {
    const values = await pwdForm.validateFields()
    setPwdSaving(true)
    try {
      await userAPI.resetPassword(pwdTarget, values.newPassword)
      message.success('密码重置成功')
      setPwdModalOpen(false)
      pwdForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.error || '重置失败')
    } finally {
      setPwdSaving(false)
    }
  }

  const handleDelete = (u: User) => {
    modal.confirm({
      title: `确认删除用户 ${u.username}？`,
      content: '此操作不可恢复',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await userAPI.deleteUser(u.username)
        message.success('删除成功')
        setUsers((prev) => prev.filter((x) => x.username !== u.username))
      },
    })
  }

  const toggleDisabled = async (u: User) => {
    const action = u.disabled ? '启用' : '禁用'
    modal.confirm({
      title: `确认${action}用户 ${u.username}？`,
      onOk: async () => {
        await userAPI.setUserDisabled(u.username, !u.disabled)
        message.success(`${action}成功`)
        setUsers((prev) => prev.map((x) => x.username === u.username ? { ...x, disabled: !x.disabled } : x))
      },
    })
  }

  const resetMFA = (u: User) => {
    modal.confirm({
      title: `重置 ${u.username} 的 MFA？`,
      content: '该用户下次登录需重新绑定 Authenticator',
      onOk: async () => {
        await mfaAPI.adminReset(u.username)
        message.success('MFA 已重置')
        setMfaStatus((prev) => { const n = { ...prev }; delete n[u.username]; return n })
      },
    })
  }

  const getRowMenu = (u: User): MenuProps['items'] => [
    { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => openEdit(u) },
    { key: 'pwd', icon: <KeyOutlined />, label: '重置密码', onClick: () => { setPwdTarget(u.username); pwdForm.resetFields(); setPwdModalOpen(true) } },
    { type: 'divider' },
    {
      key: 'disable',
      icon: u.disabled ? <UnlockOutlined /> : <LockOutlined />,
      label: u.disabled ? '启用账户' : '禁用账户',
      onClick: () => toggleDisabled(u),
    },
    { key: 'forcePwd', label: u.passwordMustChange ? '取消强制改密' : '强制改密', onClick: async () => {
      await userAPI.setPasswordMustChange(u.username, !u.passwordMustChange)
      message.success('设置成功')
      setUsers((prev) => prev.map((x) => x.username === u.username ? { ...x, passwordMustChange: !x.passwordMustChange } : x))
    }},
    { type: 'divider' },
    { key: 'mfa', label: '重置 MFA', onClick: () => resetMFA(u) },
    { type: 'divider' },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => handleDelete(u) },
  ]

  const columns: ColumnsType<User> = [
    { title: '用户名', dataIndex: 'username', width: 120, render: (v) => <strong>{v}</strong> },
    { title: 'UID', dataIndex: 'uid', width: 70 },
    { title: '中文名', dataIndex: 'cnName', width: 100 },
    { title: '邮箱', dataIndex: 'email', width: 160, render: (v) => v || '-' },
    { title: '电话', dataIndex: 'phone', width: 120, render: (v) => v || '-' },
    {
      title: '管理员',
      dataIndex: 'isAdmin',
      width: 80,
      render: (v) => v ? <Tag color="purple">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '状态',
      width: 140,
      render: (_, u) => (
        <Space size={4}>
          {u.disabled ? <Tag color="error">已禁用</Tag> : <Tag color="success">正常</Tag>}
          {u.passwordMustChange && <Tag color="warning">需改密码</Tag>}
        </Space>
      ),
    },
    {
      title: 'MFA',
      width: 80,
      render: (_, u) =>
        mfaStatus[u.username]?.confirmed ? (
          <Tag color="blue">已绑定</Tag>
        ) : (
          <Tag>未绑定</Tag>
        ),
    },
    {
      title: '操作',
      width: 70,
      fixed: 'right',
      render: (_, u) => (
        <Dropdown menu={{ items: getRowMenu(u) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ]

  const filtered = users.filter(
    (u) => !search || u.username.includes(search) || (u.cnName || '').includes(search)
  )

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      gap: 16,
      overflow: 'hidden'
    }}>
      {/* 左侧：用户列表 */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>👥 用户管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>
              添加用户
            </Button>
          </Space>
        </div>

        <Card>
          <div style={{ marginBottom: 12 }}>
            <Input.Search
              placeholder="搜索用户名、中文名"
              style={{ maxWidth: 280 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </div>
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="username"
            loading={loading}
            size="small"
            scroll={{ x: 900 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </Card>
      </div>

      {/* 右侧：添加/编辑面板 */}
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
          {/* 面板头部 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #d9d9d9',
            flexShrink: 0
          }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {isEdit ? '编辑用户' : '添加用户'}
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
          
          {/* 面板内容 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <Form form={form} layout="vertical">
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                <Input disabled={isEdit} placeholder="login_name" />
              </Form.Item>
              <Form.Item name="cnName" label="中文名" rules={[{ required: true, message: '请输入中文名' }]}>
                <Input placeholder="张三" />
              </Form.Item>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="uid" label="UID" rules={[{ required: true }]} style={{ flex: 1 }}>
                  <InputNumber style={{ width: '100%' }} min={1000} />
                </Form.Item>
                <Form.Item name="gid" label="GID" rules={[{ required: true }]} style={{ flex: 1 }}>
                  <InputNumber style={{ width: '100%' }} min={1000} />
                </Form.Item>
              </Space>
              <Form.Item name="email" label="邮箱">
                <Input type="email" placeholder="user@example.com" />
              </Form.Item>
              <Form.Item name="phone" label="电话">
                <Input placeholder="138xxxx" />
              </Form.Item>
              <Form.Item name="shell" label="Shell">
                <Input placeholder="/bin/bash" />
              </Form.Item>
              <Form.Item name="homeDir" label="家目录" rules={[{ required: true }]}>
                <Input placeholder="/home/username" />
              </Form.Item>
              {!isEdit && (
                <Form.Item name="password" label="初始密码" rules={[{ required: true }, { min: 6, message: '至少 6 位' }]}>
                  <Input.Password placeholder="至少 6 位" />
                </Form.Item>
              )}
              <Form.Item name="isAdmin" label="管理员权限" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Form>
          </div>

          {/* 面板底部按钮 */}
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

      {/* 重置密码弹窗保持Modal */}
      <Modal
        title={`重置密码 — ${pwdTarget}`}
        open={pwdModalOpen}
        onCancel={() => setPwdModalOpen(false)}
        onOk={handleResetPwd}
        confirmLoading={pwdSaving}
        okText="重置"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true }, { min: 6 }]}>
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
