import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Button, Alert, Steps, Spin } from 'antd'
import { mfaAPI } from '@/api'
import { getUser } from '@/utils/auth'

export default function MFASetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const user = getUser()

  useEffect(() => {
    mfaAPI.setup().then((data) => {
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function verify() {
    if (code.length !== 6) return
    setVerifying(true)
    setError('')
    try {
      await mfaAPI.confirm(code)
      setStep(2)
    } catch (err: any) {
      setError(err.response?.data?.error || '验证码错误，请重试')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 440, borderRadius: 16 }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>设置双因子认证</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            {user?.username}
          </div>
        </div>

        <Steps current={step} style={{ marginBottom: 32 }} items={[
          { title: '扫码' },
          { title: '验证' },
          { title: '完成' },
        ]} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : step === 0 ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              使用 Google Authenticator 或 Microsoft Authenticator 扫描下方二维码
            </p>
            {qrCode && (
              <img src={qrCode} alt="MFA QR Code" style={{ width: 200, height: 200, margin: '16px auto', display: 'block' }} />
            )}
            {secret && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 16px', fontFamily: 'monospace', fontSize: 13, color: '#475569', marginBottom: 16 }}>
                手动输入密钥：{secret}
              </div>
            )}
            <Button type="primary" size="large" block onClick={() => setStep(1)}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>
              已扫码，下一步
            </Button>
          </div>
        ) : step === 1 ? (
          <div>
            {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center' }}>
              输入 Authenticator 应用中的 6 位验证码
            </p>
            <Input
              size="large"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onPressEnter={verify}
              style={{ textAlign: 'center', fontSize: 22, letterSpacing: 10, marginBottom: 16 }}
            />
            <Button type="primary" size="large" block loading={verifying} onClick={verify}
              disabled={code.length !== 6}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>
              验证
            </Button>
            <Button type="link" block style={{ marginTop: 8 }} onClick={() => setStep(0)}>
              返回上一步
            </Button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>绑定成功</div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              双因子认证已启用，下次登录将需要验证码
            </p>
            <Button type="primary" size="large" block
              onClick={() => navigate(user?.isAdmin ? '/admin' : '/dashboard', { replace: true })}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>
              进入系统
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
