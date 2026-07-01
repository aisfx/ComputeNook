import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Space, App, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { qosAPI } from '@/api'

interface QoS {
  name: string
  description?: string
  max_cpus_pu?: number
  max_nodes_pu?: number
  max_gpus_pu?: number
  max_jobs_pu?: number
  max_wall_pj?: number   // 分钟
  limits?: any
}

function extractLimit(qos: QoS, type: string): number {
  const arr = qos.limits?.max?.tres?.per?.user
  if (Array.isArray(arr)) {
    const t = arr.find((x: any) => x.type === type)
    if (t && !t.infinite) return t.count
  }
  if (type === 'cpu' && qos.max_cpus_pu) return qos.max_cpus_pu
  if (type === 'node' && qos.max_nodes_pu) return qos.max_nodes_pu
  return 0
}

function extractGPU(qos: QoS): number {
  const arr = qos.limits?.max?.tres?.per?.user
  if (Array.isArray(arr)) {
    const g = arr.find((x: any) => x.type === 'gres/gpu' || x.type === 'gpu')
    if (g && !g.infinite) return g.count
  }
  if (qos.max_gpus_pu) return qos.max_gpus_pu
  return 0
}

function extractJobs(qos: QoS): number {
  const v = qos.limits?.max?.jobs?.per?.user
  if (v?.set && !v.infinite) return v.number
  if (qos.max_jobs_pu) return qos.max_jobs_pu
  return 0
}

function extractWall(qos: QoS): number {
  const v = qos.limits?.max?.wall_clock?.per?.job
  if (v?.set && !v.infinite) return v.number
  if (qos.max_wall_pj) return qos.max_wall_pj
  return 0
}

function fmtLimit(v: number) { return v > 0 ? String(v) : '无限制' }
function fmtWall(mins: number) {
  if (!mins) return '无限制'
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`
}

export default function AdminQoS() {
  const { message, modal } = App.useApp()
  const [list, setList] = useState<QoS[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setList(await qosAPI.getQoSList() || []) }
    catch (e: any) { setError(e.response?.data?.error || '加载 QoS 列表失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setIsEdit(false)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (q: QoS) => {
    setIsEdit(true)
    form.setFieldsValue({
      name: q.name,
      description: q.description || '',
      max_cpus: extractLimit(q, 'cpu'),
      max_nodes: extractLimit(q, 'node'),
      max_gpus: extractGPU(q),
      max_jobs_pu: extractJobs(q),
      max_wall_hours: Math.floor(extractWall(q) / 60),
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const v = await form.validateFields()
    const payload: any = {
      name: v.name,
      description: v.description,
      max_jobs_pu: v.max_jobs_pu || 0,
      max_cpus_pu: v.max_cpus || 0,
      max_nodes_pu: v.max_nodes || 0,
      max_wall_pj: (v.max_wall_hours || 0) * 60,
    }
    if (v.max_gpus > 0) payload.max_tres_pu = `gres/gpu=${v.max_gpus}`
    setSaving(true)
    try {
      if (isEdit) { await qosAPI.updateQoS(v.name, payload); message.success('更新成功') }
      else { await qosAPI.createQoS(payload); message.success('创建成功') }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.response?.data?.error || '保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = (q: QoS) => {
    modal.confirm({
      title: `确认删除 QoS ${q.name}？`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => { await qosAPI.deleteQoS(q.name); message.success('删除成功'); load() },
    })
  }

  const columns: ColumnsType<QoS> = [
    { title: '名称', dataIndex: 'name', width: 140, render: v => <strong>{v}</strong> },
    { title: '描述', dataIndex: 'description', render: v => v || '-' },
    { title: 'CPU核', width: 90, render: (_, q) => fmtLimit(extractLimit(q, 'cpu')) },
    { title: 'GPU卡', width: 80, render: (_, q) => fmtLimit(extractGPU(q)) },
    { title: '节点数', width: 80, render: (_, q) => fmtLimit(extractLimit(q, 'node')) },
    { title: '作业数', width: 80, render: (_, q) => fmtLimit(extractJobs(q)) },
    { title: '运行时间', width: 100, render: (_, q) => fmtWall(extractWall(q)) },
    {
      title: '操作', width: 120,
      render: (_, q) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(q)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(q)}>删除</Button>
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
          <span style={{ fontSize: 16, fontWeight: 600 }}>⚡ QoS 管理</span>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}>添加 QoS</Button>
          </Space>
        </div>
        {error && <Alert message={error} type="warning" showIcon />}
        <Card>
          <Table columns={columns} dataSource={list} rowKey="name"
            loading={loading} size="small" pagination={{ pageSize: 20 }} scroll={{ x: 800 }} />
        </Card>
      </div>

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
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #d9d9d9',
            flexShrink: 0
          }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {isEdit ? '编辑 QoS' : '添加 QoS'}
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
              <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                <Input disabled={isEdit} placeholder="normal" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input placeholder="QoS 描述" />
              </Form.Item>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="max_cpus" label="CPU 核数限制" style={{ flex: 1 }}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="0=无限制" />
                </Form.Item>
                <Form.Item name="max_gpus" label="GPU 数量限制" style={{ flex: 1 }}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="0=无限制" />
                </Form.Item>
              </Space>
              <Space style={{ width: '100%' }} align="start">
                <Form.Item name="max_nodes" label="节点数限制" style={{ flex: 1 }}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="0=无限制" />
                </Form.Item>
                <Form.Item name="max_jobs_pu" label="最大作业数" style={{ flex: 1 }}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="0=无限制" />
                </Form.Item>
              </Space>
              <Form.Item name="max_wall_hours" label="最长运行时间（小时）">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0=无限制" />
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
