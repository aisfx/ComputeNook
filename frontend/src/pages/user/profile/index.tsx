import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Alert, Modal, Steps, Tag } from 'antd'
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { authAPI, mfaAPI } from '@/api'
import { getUser, saveSession, getToken } from '@/utils/auth'
import axios from 'axios'

export default function Profile() {
  const user = getUser()
  const [editOpen, setEditOpen] = useState(false)
  const [editForm] = Form.useForm()
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [pwdForm] = Form.useForm()
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')

  const [mfaStatus, setMfaStatus] = useState<any>(null)
  const [mfaMode, setMfaMode] = useState('false')
  const [mfaBindOpen, setMfaBindOpen] = useState(false)
  const [mfaStep, setMfaStep] = useState(0)
  const [mfaQr, setMfaQr] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBindLoading, setMfaBindLoading] = useState(false)
  const [mfaBindError, setMfaBindError] = useState('')
  const [mfaDisableCode, setMfaDisableCode] = useState('')
  const [mfaDisabling, setMfaDisabling] = useState(false)
  const [mfaDisableError, setMfaDisableError] = useState('')

  const [localUser, setLocalUser] = useState(user)

  useEffect(() => {
    mfaAPI.getStatus().then(s => { setMfaStatus(s); setMfaMode(String(s.mode)) }).catch(() => { })
  }, [])

  // 编辑个人信息
  const openEdit = () => {
    editForm.setFieldsValue({ cnName: localUser?.cnName, email: localUser?.email, phone: localUser?.phone })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    const v = await editForm.validateFields()
    setEditSaving(true); setEditError('')
    try {
      await authAPI.updateProfile(v)
      // 更新本地存储
      const newUser = { ...localUser, ...v } as any
      setLocalUser(newUser)
      const storage = localStorage.getItem('token') ? localStorage : sessionStorage
      storage.setItem('user', JSON.stringify(newUser))
      setEditOpen(false)
    } catch (e: any) { setEditError(e.response?.data?.error || '更新失败') }
    finally { setEditSaving(false) }
  }

  // 修改密码
  const handleChangePwd = async () => {
    const v = await pwdForm.validateFields()
    if (v.newPassword !== v.confirmPassword) { setPwdError('两次密码不一致'); return }
    setPwdSaving(true); setPwdError(''); setPwdSuccess('')
    try {
      await authAPI.changePassword(v.oldPassword, v.newPassword)
      setPwdSuccess('密码修改成功！')
      pwdForm.resetFields()
    } catch (e: any) { setPwdError(e.response?.data?.error || '修改失败') }
    finally { setPwdSaving(false) }
  }

  // MFA 绑定
  const startMFABind = async () => {
    setMfaStep(0); setMfaQr(''); setMfaCode(''); setMfaBindError('')
    setMfaBindOpen(true)
    try {
      const data = await mfaAPI.setupAuth()
      setMfaQr(data.qrCode || '')
    } catch (e: any) { setMfaBindError(e.response?.data?.error || '获取二维码失败') }
  }

  const confirmMFABind = async () => {
    setMfaBindLoading(true); setMfaBindError('')
    try {
      await mfaAPI.confirmAuth(mfaCode)
      setMfaStep(2)
      const s = await mfaAPI.getStatus()
      setMfaStatus(s)
    } catch (e: any) { setMfaBindError(e.response?.data?.error || '验证失败') }
    finally { setMfaBindLoading(false) }
  }

  const handleDisableMFA = async () => {
    setMfaDisabling(true); setMfaDisableError('')
    try {
      await mfaAPI.disable(mfaDisableCode)
      setMfaDisableCode('')
      const s = await mfaAPI.getStatus()
      setMfaStatus(s)
    } catch (e: any) { setMfaDisableError(e.response?.data?.error || '解绑失败') }
    finally { setMfaDisabling(false) }
  }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>👤 个人信息</span>

      {/* 基本信息 */}
      <Card title="个人资料" extra={<Button size="small" onClick={openEdit}>✏️ 编辑</Button>}>
        {[
          ['用户名', localUser?.username],
          ['显示名称', localUser?.cnName],
          ['邮箱', localUser?.email || '-'],
          ['手机', localUser?.phone || '-'],
          ['管理员', localUser?.isAdmin ? <Tag color="purple">是</Tag> : <Tag>否</Tag>],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ minWidth: 90, color: '#64748b', fontWeight: 500 }}>{label}</span>
            <span>{value as any}</span>
          </div>
        ))}
      </Card>

      {/* MFA */}
      {mfaMode !== 'false' && (
        <Card title={<span>🔐 双因子认证 {mfaStatus?.confirmed ? <Tag color="green">已启用</Tag> : <Tag>未绑定</Tag>}</span>}>
          {mfaMode === 'global' && (
            <Alert message="系统已开启强制双因子认证" type="info" showIcon style={{ marginBottom: 12 }} />
          )}
          {mfaStatus?.confirmed ? (
            <div>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>MFA 已启用，登录时需要输入验证码。</p>
              {mfaDisableError && <Alert message={mfaDisableError} type="error" showIcon style={{ marginBottom: 8 }} />}
              <Input
                placeholder="输入当前验证码以解绑（6位）"
                maxLength={6}
                value={mfaDisableCode}
                onChange={e => setMfaDisableCode(e.target.value.replace(/\D/g, ''))}
                style={{ width: 240, marginRight: 8 }}
              />
              <Button danger loading={mfaDisabling} disabled={mfaDisableCode.length !== 6} onClick={handleDisableMFA}>
                解绑 MFA
              </Button>
            </div>
          ) : (
            <div>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>绑定后登录需额外输入 6 位验证码，提升账户安全性。</p>
              <Button type="primary" onClick={startMFABind} style={{ background: '#6366f1', borderColor: '#6366f1' }}>
                绑定 MFA →
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* 修改密码 */}
      <Card title="🔒 修改密码">
        {pwdError && <Alert message={pwdError} type="error" showIcon style={{ marginBottom: 12 }} />}
        {pwdSuccess && <Alert message={pwdSuccess} type="success" showIcon style={{ marginBottom: 12 }} />}
        <Form form={pwdForm} layout="vertical" onFinish={handleChangePwd} style={{ maxWidth: 400 }}>
          <Form.Item name="oldPassword" label="旧密码" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true }, { min: 8 }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={pwdSaving}
            style={{ background: '#6366f1', borderColor: '#6366f1' }}>
            修改密码
          </Button>
        </Form>
      </Card>

      {/* 编辑信息弹窗 */}
      <Modal title="编辑个人信息" open={editOpen} onCancel={() => setEditOpen(false)}
        onOk={handleEditSave} confirmLoading={editSaving} okText="保存" cancelText="取消" destroyOnClose>
        {editError && <Alert message={editError} type="error" showIcon style={{ marginBottom: 12 }} />}
        <Form form={editForm} layout="vertical">
          <Form.Item name="cnName" label="显示名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* MFA 绑定弹窗 */}
      <Modal title="绑定双因子认证" open={mfaBindOpen}
        onCancel={() => setMfaBindOpen(false)}
        footer={
          mfaStep === 0 ? [
            <Button key="cancel" onClick={() => setMfaBindOpen(false)}>取消</Button>,
            <Button key="next" type="primary" disabled={!mfaQr} onClick={() => setMfaStep(1)}
              style={{ background: '#6366f1' }}>已扫码，下一步 →</Button>,
          ] : mfaStep === 1 ? [
            <Button key="back" onClick={() => setMfaStep(0)}>← 返回</Button>,
            <Button key="confirm" type="primary" loading={mfaBindLoading} disabled={mfaCode.length !== 6}
              onClick={confirmMFABind} style={{ background: '#6366f1' }}>确认绑定</Button>,
          ] : [
            <Button key="close" type="primary" onClick={() => setMfaBindOpen(false)} style={{ background: '#6366f1' }}>完成</Button>,
          ]
        }
        destroyOnClose width={420}>
        <Steps current={mfaStep} style={{ marginBottom: 24 }}
          items={[{ title: '扫码' }, { title: '验证' }, { title: '完成' }]} />
        {mfaStep === 0 && (
          <div style={{ textAlign: 'center' }}>
            {mfaBindError && <Alert message={mfaBindError} type="error" showIcon style={{ marginBottom: 12 }} />}
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>使用 Authenticator App 扫描下方二维码</p>
            {mfaQr && <img src={mfaQr} alt="QR" style={{ width: 200, height: 200, borderRadius: 8, display: 'block', margin: '0 auto' }} />}
            {!mfaQr && !mfaBindError && <div style={{ color: '#94a3b8', padding: 40 }}>生成中...</div>}
          </div>
        )}
        {mfaStep === 1 && (
          <div>
            {mfaBindError && <Alert message={mfaBindError} type="error" showIcon style={{ marginBottom: 12 }} />}
            <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginBottom: 12 }}>输入 App 显示的 6 位验证码</p>
            <Input size="large" placeholder="000000" maxLength={6}
              value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
              onPressEnter={confirmMFABind}
              style={{ textAlign: 'center', fontSize: 22, letterSpacing: 10 }} />
          </div>
        )}
        {mfaStep === 2 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>绑定成功</div>
          </div>
        )}
      </Modal>
    </div>
  )
}
