import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Checkbox, Space } from 'antd'
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import { authAPI, mfaAPI } from '@/api'
import { isAuthenticated, saveSession } from '@/utils/auth'
import type { UserInfo } from '@/utils/auth'
import { useTheme } from '@/hooks/useTheme'
import { usePageTitle } from '@/hooks/usePageTitle'
import axios from 'axios'
import './login.css'

interface CaptchaData {
  captchaId: string
  captchaImage: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { mode } = useTheme()
  usePageTitle('登录')
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  
  // MFA 第二步
  const [mfaStep, setMfaStep] = useState<'none' | 'verify' | 'setup'>('none')
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) navigate('/dashboard', { replace: true })
    else loadCaptcha()
  }, [])

  async function loadCaptcha() {
    try {
      const data = await authAPI.getCaptcha()
      if (data?.captchaId) setCaptcha(data)
    } catch {
      // 验证码可选，失败不影响登录
    }
  }

  async function onFinish(values: any) {
    setLoading(true)
    setError('')
    try {
      const res = await authAPI.login(
        values.username,
        values.password,
        captcha?.captchaId,
        values.captcha
      )

      if (res.mfaRequired) {
        setMfaToken(res.tempToken)
        setMfaStep(res.mfaSetupRequired ? 'setup' : 'verify')
        setLoading(false)
        return
      }

      saveSession(res.token, res.user as UserInfo, rememberMe)

      if (res.user?.passwordMustChange) {
        navigate('/force-change-password', { replace: true })
      } else {
        navigate(res.user?.isAdmin ? '/admin' : '/dashboard', { replace: true })
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || '登录失败，请检查用户名和密码'
      setError(msg)
      loadCaptcha()
      form.setFieldValue('captcha', '')
    } finally {
      setLoading(false)
    }
  }

  async function onMFAVerify() {
    if (!mfaCode.trim() || mfaCode.length !== 6) return
    setMfaLoading(true)
    setError('')
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${mfaToken}`
      const res = await mfaAPI.verifyLogin(mfaToken, mfaCode)
      saveSession(res.token, res.user as UserInfo, false)
      navigate(res.user?.isAdmin ? '/admin' : '/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'MFA 验证失败')
      setMfaCode('')
    } finally {
      setMfaLoading(false)
    }
  }

  function goToSetup() {
    sessionStorage.setItem('mfa_temp_token', mfaToken)
    navigate('/mfa-setup')
  }

  return (
    <div className="login-root" data-theme={mode}>
      {/* 左侧：品牌展示 */}
      <div className="login-left">
        <div className="login-brand">
          <div className="brand-logo">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" fill="white" opacity="0.15"/>
              <path d="M3 10.5L12 3l9 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 10.5V21h16V10.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="7.5" y="12.5" width="9" height="7" rx="1" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.1"/>
              <rect x="10" y="14.5" width="4" height="3" rx="0.5" fill="white"/>
              <line x1="9.5" y1="12.5" x2="9.5" y2="11.2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="12" y1="12.5" x2="12" y2="11.2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="14.5" y1="12.5" x2="14.5" y2="11.2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1>算力小筑</h1>
          <p className="brand-tagline">算力触手可及</p>
          <p className="brand-desc">不大，但够用。<br/>一个人也能管好一整个集群。</p>
          <div className="brand-divider"></div>
          <div className="brand-features">
            <div className="feature-card">
              <span className="feature-icon">📊</span>
              <div className="feature-text">
                <div className="feature-title">实时集群监控与调度</div>
                <div className="feature-desc">节点状态、资源利用率一览无余</div>
              </div>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🚀</span>
              <div className="feature-text">
                <div className="feature-title">作业提交与管理</div>
                <div className="feature-desc">Slurm 作业全生命周期管理</div>
              </div>
            </div>
            <div className="feature-card">
              <span className="feature-icon">💻</span>
              <div className="feature-text">
                <div className="feature-title">Web Shell 终端访问</div>
                <div className="feature-desc">浏览器直连，无需额外客户端</div>
              </div>
            </div>
            <div className="feature-card">
              <span className="feature-icon">📁</span>
              <div className="feature-text">
                <div className="feature-title">文件管理与传输</div>
                <div className="feature-desc">在线浏览、上传下载轻松搞定</div>
              </div>
            </div>
          </div>
          <div className="status-bar">
            <span className="status-dot"></span>系统运行中
          </div>
        </div>
      </div>

      {/* 右侧：登录表单 */}
      <div className="login-right">
        <div className="login-box">
          {mfaStep === 'none' ? (
            <>
              <div className="login-header">
                <h2>欢迎回来</h2>
                <p>使用 LDAP 账户登录系统</p>
              </div>

              {error && <div className="error-alert">{error}</div>}

              <Form form={form} onFinish={onFinish} layout="vertical" requiredMark={false}>
                <div className="field">
                  <label htmlFor="username">用户名</label>
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]} noStyle>
                    <input
                      id="username"
                      type="text"
                      placeholder="请输入用户名"
                      disabled={loading}
                      autoComplete="username"
                    />
                  </Form.Item>
                </div>

                <div className="field">
                  <label htmlFor="password">密码</label>
                  <div className="password-wrap">
                    <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]} noStyle>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码"
                        disabled={loading}
                        autoComplete="current-password"
                      />
                    </Form.Item>
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                {captcha && (
                  <div className="field">
                    <label>验证码</label>
                    <div className="captcha-row">
                      <Form.Item name="captcha" rules={[{ required: true, message: '请输入验证码' }]} noStyle>
                        <input type="text" placeholder="请输入验证码" maxLength={6} disabled={loading} />
                      </Form.Item>
                      <img
                        src={captcha.captchaImage}
                        alt="验证码"
                        className="captcha-img"
                        onClick={loadCaptcha}
                        title="点击刷新验证码"
                      />
                    </div>
                  </div>
                )}

                <div className="field-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>记住我</span>
                  </label>
                </div>

                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading && <span className="btn-spinner"></span>}
                  {loading ? '登录中...' : '登 录'}
                </button>
              </Form>
            </>
          ) : mfaStep === 'verify' ? (
            <>
              <div className="login-header">
                <h2>双因子验证</h2>
                <p>请输入 Authenticator 应用中显示的 6 位验证码</p>
              </div>

              {error && <div className="error-alert">{error}</div>}

              <div className="field">
                <label htmlFor="mfa-code">验证码</label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  onKeyUp={(e) => e.key === 'Enter' && onMFAVerify()}
                  disabled={mfaLoading}
                  className="mfa-input"
                  autoComplete="one-time-code"
                />
              </div>

              <button
                className="submit-btn"
                onClick={onMFAVerify}
                disabled={mfaLoading || mfaCode.length !== 6}
              >
                {mfaLoading && <span className="btn-spinner"></span>}
                {mfaLoading ? '验证中...' : '验 证'}
              </button>

              <button
                className="back-btn"
                onClick={() => { setMfaStep('none'); setMfaCode(''); setError('') }}
              >
                返回
              </button>
            </>
          ) : (
            <>
              <div className="login-header">
                <h2>MFA 绑定</h2>
                <p>系统要求启用双因子认证，请先完成绑定</p>
              </div>

              {error && <div className="error-alert">{error}</div>}

              <button className="submit-btn" onClick={goToSetup}>
                前往绑定
              </button>

              <button
                className="back-btn"
                onClick={() => { setMfaStep('none'); setError('') }}
              >
                返回
              </button>
            </>
          )}

          <div className="login-footer">算力小筑 v0.1</div>
        </div>
      </div>
    </div>
  )
}
