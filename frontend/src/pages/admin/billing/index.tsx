import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Space,
  Tag, Progress, Statistic, Row, Col, App, Tabs, Typography, Alert,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ReloadOutlined,
  PlusOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { billingAPI, qosAPI } from '@/api'

const { Text } = Typography

// ─── 类型 ─────────────────────────────────────────────────
interface BillingAccount {
  qos_name: string
  total_recharged: number
  current_balance: number
  actual_used: number
}

interface RechargeRecord {
  id: number
  qos_name: string
  amount: number
  before_total: number
  after_total: number
  operator: string
  notes: string
  created_at: string
}

// ─── 工具函数 ─────────────────────────────────────────────
function usagePct(account: BillingAccount): number {
  const total = account.total_recharged
  if (!total) return 0
  const used = total - account.current_balance
  return Math.min(100, Math.round((used / total) * 100))
}

function progressColor(pct: number): string {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#6366f1'
}

function statusTag(pct: number) {
  if (pct >= 100) return <Tag color="error">已超额</Tag>
  if (pct >= 80) return <Tag color="warning">即将用完</Tag>
  return <Tag color="success">正常</Tag>
}

// ─── 主组件 ──────────────────────────────────────────────
export default function AdminBilling() {
  const { message, modal } = App.useApp()
  const [activeTab, setActiveTab] = useState('accounts')

  // 账户列表
  const [accounts, setAccounts] = useState<BillingAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // 充值记录
  const [history, setHistory] = useState<RechargeRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyQos, setHistoryQos] = useState('')

  // 充值弹窗
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [rechargeTarget, setRechargeTarget] = useState<BillingAccount | null>(null)
  const [slurmBalance, setSlurmBalance] = useState<number>(-1)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const amountWatch = Form.useWatch('amount', form) as number | undefined

  // 同步
  const [syncing, setSyncing] = useState(false)

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    try {
      const data = await billingAPI.getAccounts()
      setAccounts(data || [])
    } catch (err: any) {
      message.error(err.response?.data?.error || '加载机时账户失败')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async (qosName = '') => {
    setHistoryLoading(true)
    try {
      const data = await billingAPI.getRechargeHistory(qosName || undefined, 200)
      setHistory(data || [])
    } catch (err: any) {
      message.error(err.response?.data?.error || '加载充值历史失败')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    if (activeTab === 'history') loadHistory(historyQos)
  }, [activeTab, historyQos, loadHistory])

  // 打开充值弹窗
  const openRecharge = async (account: BillingAccount) => {
    setRechargeTarget(account)
    setSlurmBalance(-1)
    form.setFieldsValue({ amount: undefined, notes: '' })
    setRechargeOpen(true)
    // 获取 Slurm 实际 billing 值
    try {
      const qos = await qosAPI.getQoS(account.qos_name)
      let val = -1
      const minutesTotal = qos?.limits?.max?.tres?.minutes?.total
      if (Array.isArray(minutesTotal)) {
        const billing = minutesTotal.find((t: any) => t.type === 'billing')
        if (billing && billing.count > 0) val = billing.count / 60
      }
      setSlurmBalance(val)
    } catch {
      // 读取失败不影响充值
    }
  }

  const handleRecharge = async () => {
    const values = await form.validateFields()
    if (!rechargeTarget) return
    setSaving(true)
    try {
      await billingAPI.recharge({
        qos_name: rechargeTarget.qos_name,
        amount: values.amount,
        notes: values.notes,
      })
      message.success('充值成功')
      setRechargeOpen(false)
      loadAccounts()
    } catch (err: any) {
      message.error(err.response?.data?.error || '充值失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await billingAPI.syncFromSlurm()
      message.success(`同步完成！已同步 ${res.synced} 条，跳过 ${res.skipped} 条`)
      loadAccounts()
    } catch (err: any) {
      message.error(err.response?.data?.error || '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  // ─── 账户列表列 ────────────────────────────────────────
  const accountColumns: ColumnsType<BillingAccount> = [
    {
      title: 'QoS 名称',
      dataIndex: 'qos_name',
      width: 160,
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: '累计充值（小时）',
      dataIndex: 'total_recharged',
      width: 160,
      render: (v) => <Text>{v?.toLocaleString() ?? '-'}</Text>,
    },
    {
      title: '已使用（小时）',
      width: 160,
      render: (_, a) => {
        const used = a.total_recharged - a.current_balance
        return <Text type={used > a.total_recharged * 0.8 ? 'warning' : undefined}>{Math.max(0, used).toLocaleString()}</Text>
      },
    },
    {
      title: '当前余额（小时）',
      dataIndex: 'current_balance',
      width: 160,
      render: (v) => <Text style={{ color: '#6366f1', fontWeight: 600 }}>{v?.toLocaleString() ?? '-'}</Text>,
    },
    {
      title: '使用率',
      width: 200,
      render: (_, a) => {
        const pct = usagePct(a)
        return (
          <Space size={8}>
            <Progress
              percent={pct}
              size="small"
              strokeColor={progressColor(pct)}
              style={{ width: 100, marginBottom: 0 }}
            />
            {statusTag(pct)}
          </Space>
        )
      },
    },
    {
      title: '操作',
      width: 100,
      render: (_, a) => (
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={() => openRecharge(a)}
        >
          充值
        </Button>
      ),
    },
  ]

  // ─── 充值历史列 ────────────────────────────────────────
  const historyColumns: ColumnsType<RechargeRecord> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    { title: 'QoS', dataIndex: 'qos_name', width: 120 },
    {
      title: '充值金额（小时）',
      dataIndex: 'amount',
      width: 140,
      render: (v) => <Text style={{ color: '#10b981', fontWeight: 600 }}>+{v?.toLocaleString()}</Text>,
    },
    {
      title: '充值前（小时）',
      dataIndex: 'before_total',
      width: 130,
      render: (v) => v?.toLocaleString(),
    },
    {
      title: '充值后（小时）',
      dataIndex: 'after_total',
      width: 130,
      render: (v) => v?.toLocaleString(),
    },
    { title: '操作人', dataIndex: 'operator', width: 100 },
    {
      title: '备注',
      dataIndex: 'notes',
      ellipsis: true,
      render: (v) => v || <Text type="secondary">-</Text>,
    },
  ]

  // ─── 汇总卡片 ──────────────────────────────────────────
  const totalRecharged = accounts.reduce((s, a) => s + (a.total_recharged || 0), 0)
  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance || 0), 0)
  const totalUsed = totalRecharged - totalBalance

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>⏱️ 机时管理</span>
        <Space>
          <Button icon={<SyncOutlined />} loading={syncing} onClick={handleSync}>
            从 Slurm 同步
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAccounts} loading={accountsLoading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 汇总统计 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="累计充值总量"
              value={totalRecharged}
              suffix="小时"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#6366f1', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="已消耗机时"
              value={Math.max(0, totalUsed)}
              suffix="小时"
              valueStyle={{ color: '#f59e0b', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10 }}>
            <Statistic
              title="当前总余额"
              value={totalBalance}
              suffix="小时"
              valueStyle={{ color: '#10b981', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主内容 Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'accounts',
              label: <Space><ClockCircleOutlined />机时账户</Space>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Input.Search
                    placeholder="搜索 QoS 名称"
                    style={{ maxWidth: 280 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                  />
                  <Table
                    columns={accountColumns}
                    dataSource={accounts.filter((a) =>
                      !search || a.qos_name.toLowerCase().includes(search.toLowerCase())
                    )}
                    rowKey="qos_name"
                    loading={accountsLoading}
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 800 }}
                    locale={{ emptyText: '暂无机时账户数据' }}
                  />
                </div>
              ),
            },
            {
              key: 'history',
              label: <Space><HistoryOutlined />充值历史</Space>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Input.Search
                    placeholder="按 QoS 名称筛选"
                    style={{ maxWidth: 280 }}
                    value={historyQos}
                    onSearch={(v) => setHistoryQos(v)}
                    onChange={(e) => !e.target.value && setHistoryQos('')}
                    allowClear
                  />
                  <Table
                    columns={historyColumns}
                    dataSource={history}
                    rowKey="id"
                    loading={historyLoading}
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: '暂无充值记录' }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 充值弹窗 */}
      <Modal
        title={`充值机时 — ${rechargeTarget?.qos_name}`}
        open={rechargeOpen}
        onCancel={() => setRechargeOpen(false)}
        onOk={handleRecharge}
        confirmLoading={saving}
        okText="确认充值"
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        {rechargeTarget && (
          <div>
            {/* 当前余额信息 */}
            <Card
              size="small"
              style={{
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                border: '1.5px solid #bae6fd',
                borderRadius: 10,
                marginBottom: 20,
              }}
              bordered={false}
            >
              <Row gutter={0}>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#0369a1' }}>累计充值</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0c4a6e' }}>
                    {rechargeTarget.total_recharged.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>小时</div>
                </Col>
                <Col span={8} style={{ textAlign: 'center', borderLeft: '1px dashed #7dd3fc', borderRight: '1px dashed #7dd3fc' }}>
                  <div style={{ fontSize: 12, color: '#ea580c' }}>已使用</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#c2410c' }}>
                    {Math.max(0, rechargeTarget.total_recharged - rechargeTarget.current_balance).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>小时</div>
                </Col>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#0369a1' }}>当前余额</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0891b2' }}>
                    {rechargeTarget.current_balance.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>小时</div>
                </Col>
              </Row>
              {slurmBalance >= 0 && Math.abs(slurmBalance - rechargeTarget.current_balance) > 1 && (
                <Alert
                  style={{ marginTop: 12 }}
                  message={`Slurm 实际余额：${slurmBalance.toLocaleString()} 小时（与记录不一致）`}
                  type="warning"
                  showIcon
                  banner
                />
              )}
            </Card>

            <Form form={form} layout="vertical">
              <Form.Item
                name="amount"
                label="充值金额（小时）"
                rules={[
                  { required: true, message: '请输入充值金额' },
                  { type: 'number', min: 1, message: '充值金额必须大于 0' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="例如：1000"
                  min={1}
                  step={100}
                />
              </Form.Item>

              {amountWatch && amountWatch > 0 && (
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 8, padding: '8px 14px', marginTop: -8, marginBottom: 16,
                  fontSize: 13, color: '#15803d',
                }}>
                  充值后余额：{(rechargeTarget.current_balance + amountWatch).toLocaleString()} 小时
                </div>
              )}

              <Form.Item name="notes" label="备注（可选）">
                <Input.TextArea
                  rows={3}
                  placeholder="记录充值原因或相关说明"
                  maxLength={500}
                  showCount
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
