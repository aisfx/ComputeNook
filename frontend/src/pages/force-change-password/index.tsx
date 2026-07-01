import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Alert } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { authAPI } from '@/api'
import { getUser, logout } from '@/utils/auth'

export default function ForceChangePasswordPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const user = getUser()

  async function onFinish(values: any) {
    if (values.newPassword !== values.confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    setError('')
    try {
      await authAPI.changePassword(values.oldPassword, values.newPassword)
      navigate(user?.isAdmin ? '/admin' : '/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || '修改密码失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 400, borderRadius: 16 }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>修改密码</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            您的账户需要修改初始密码才能继续使用
          </div>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form form={form} onFinish={onFinish} layout="vertical" requiredMark={false}>
          <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="当前密码" size="large" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少 8 位' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 8 位）" size="large" />
          </Form.Item>
          <Form.Item name="confirm" label="确认新密码" rules={[{ required: true, message: '请确认新密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>
              修改密码
            </Button>
          </Form.Item>
        </Form>

        <Button type="link" block style={{ marginTop: 8 }} onClick={async () => {
          await logout(); navigate('/login')
        }}>
          退出登录
        </Button>
      </Card>
    </div>
  )
}
