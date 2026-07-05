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
    { 
      title: '用户名', 
      dataIndex: 'username', 
      width: 140,
      fixed: 'left',
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1890ff' }}>{v}</span>
    },
    { 
      title: 'UID', 
      dataIndex: 'uid', 
      width: 80,
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>{v}</span>
    },
    { 
      title: '中文名', 
      dataIndex: 'cnName', 
      width: 100,
      render: (v) => <span style={{ fontWeight: 500 }}>{v || '-'}</span>
    },
    { 
      title: '邮箱', 
      dataIndex: 'email', 
      width: 180, 
      render: (v) => <span style={{ fontSize: 12, color: '#666' }}>{v || '-'}</span>
    },
    { 
      title: '电话', 
      dataIndex: 'phone', 
      width: 120, 
      render: (v) => <span style={{ fontSize: 12, color: '#666' }}>{v || '-'}</span>
    },
    {
      title: '角色',
      dataIndex: 'isAdmin',
      width: 90,
      render: (v) => v ? <Tag color="purple" icon={<LockOutlined />}>管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '账号状态',
      width: 180,
      render: (_, u) => (
        <Space size={4}>
          {u.disabled ? (
            <Tag color="error" icon={<LockOutlined />}>已禁用</Tag>
          ) : (
            <Tag color="success" icon={<UnlockOutlined />}>正常</Tag>
          )}
          {u.passwordMustChange && <Tag color="warning" icon={<KeyOutlined />}>需改密</Tag>}
        </Space>
      ),
    },
    {
      title: 'MFA',
      width: 100,
      render: (_, u) =>
        mfaStatus[u.username]?.confirmed ? (
          <Tag color="blue">✓ 已绑定</Tag>
        ) : (
          <Tag color="default">未绑定</Tag>
        ),
    },
    {
      title: '操作',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, u) => (
        <Space size={0}>
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />} 
            onClick={() => openEdit(u)}
            title="编辑"
          />
          <Dropdown menu={{ items: getRowMenu(u) }} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ]

  const filtered = users.filter(
    (u) => !search || u.username.includes(search) || (u.cnName || '').includes(search)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* 页面头部 */}
      <Card size="small" bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span style={{ fontSize: 18, fontWeight: 600 }}>👥 用户账号管理</span>
            <Tag color="blue">{filtered.length} 个用户</Tag>
          </Space>
          <Space>
            <Input.Search
              placeholder="搜索用户名、中文名"
              style={{ width: 240 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={openAdd}
            >
              添加用户
            </Button>
          </Space>
        </div>
      </Card>

      {/* 主内容区域 */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* 左侧：用户列表 */}
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
              dataSource={filtered}
              rowKey="username"
              loading={loading}
              size="small"
              scroll={{ x: 1100 }}
              pagination={{ 
                pageSize: 20, 
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个用户`
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
                {isEdit ? '📝 编辑用户' : '➕ 添加用户'}
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
                <Form.Item 
                  name="username" 
                  label="用户名" 
                  rules={[
                    { required: true, message: '请输入用户名' },
                    { pattern: /^[a-z_][a-z0-9_-]*$/, message: '只能包含小写字母、数字、下划线和连字符，且以字母或下划线开头' }
                  ]}
                >
                  <Input disabled={isEdit} placeholder="login_name" />
                </Form.Item>
                
                <Form.Item 
                  name="cnName" 
                  label="中文名" 
                  rules={[{ required: true, message: '请输入中文名' }]}
                >
                  <Input placeholder="张三" />
                </Form.Item>
                
                <Space style={{ width: '100%' }} align="start">
                  <Form.Item 
                    name="uid" 
                    label="UID" 
                    rules={[{ required: true, message: '请输入UID' }]} 
                    style={{ flex: 1 }}
                  >
                    <InputNumber style={{ width: '100%' }} min={1000} placeholder="1000" />
                  </Form.Item>
                  <Form.Item 
                    name="gid" 
                    label="GID" 
                    rules={[{ required: true, message: '请输入GID' }]} 
                    style={{ flex: 1 }}
                  >
                    <InputNumber style={{ width: '100%' }} min={1000} placeholder="1000" />
                  </Form.Item>
                </Space>
                
                <Form.Item 
                  name="email" 
                  label="邮箱"
                  rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
                >
                  <Input type="email" placeholder="user@example.com" />
                </Form.Item>
                
                <Form.Item name="phone" label="电话">
                  <Input placeholder="138xxxx" />
                </Form.Item>
                
                <Form.Item name="shell" label="Shell">
                  <Input placeholder="/bin/bash" />
                </Form.Item>
                
                <Form.Item 
                  name="homeDir" 
                  label="家目录" 
                  rules={[{ required: true, message: '请输入家目录路径' }]}
                >
                  <Input placeholder="/home/username" />
                </Form.Item>
                
                {!isEdit && (
                  <Form.Item 
                    name="password" 
                    label="初始密码" 
                    rules={[
                      { required: true, message: '请输入初始密码' }, 
                      { min: 6, message: '至少 6 位' }
                    ]}
                  >
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

      {/* 重置密码弹窗保持Modal */}
      <Modal
        title={
          <span>
            <KeyOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            重置密码 — <span style={{ color: '#1890ff' }}>{pwdTarget}</span>
          </span>
        }
        open={pwdModalOpen}
        onCancel={() => setPwdModalOpen(false)}
        onOk={handleResetPwd}
        confirmLoading={pwdSaving}
        okText="重置"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item 
            name="newPassword" 
            label="新密码" 
            rules={[
              { required: true, message: '请输入新密码' }, 
              { min: 6, message: '至少 6 位' }
            ]}
          >
            <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

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
