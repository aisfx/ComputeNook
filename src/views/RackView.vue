<template>
  <div class="rack-page">
    <div class="rack-page-header">
      <h3>🗄️ 机柜管理</h3>
      <div class="rack-page-actions">
        <button class="btn-pri" @click="openNewRack">＋ 新建机柜</button>
        <button class="btn-sec" @click="autoGenRacks" :disabled="rackLoading">
          {{ rackLoading ? '生成中...' : '🤖 自动生成' }}
        </button>
        <button class="btn-sec" @click="loadAll" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <span v-if="rackError" class="rack-err">{{ rackError }}</span>

    <div v-if="racks.length === 0 && !loading" class="empty">暂无机柜，点击「自动生成」或「新建机柜」</div>
    <div v-else class="rack-grid">
      <div v-for="rack in racks" :key="rack.id" class="rack-box">
        <div class="rack-name">
          {{ rack.name }}
          <span class="rack-loc" v-if="rack.location">{{ rack.location }}</span>
          <div class="rack-actions">
            <button class="rack-btn" @click="openEditRack(rack)" title="编辑机柜">✏️</button>
            <button class="rack-btn rack-btn-del" @click="deleteRack(rack.id)" title="删除机柜">🗑️</button>
          </div>
        </div>
        <div class="rack-body" :style="{ minHeight: Math.min(rack.units, 20) * 22 + 8 + 'px' }">
          <div v-for="u in rack.units" :key="'bg-'+u"
            class="rack-slot slot-empty rack-bg-slot"
            :style="{ top: (rack.units - u) * 22 + 'px' }"
            @click="openAddDevice(rack, u)"
          >
            <span class="slot-u">{{ u }}U</span>
            <span class="slot-add">+</span>
          </div>
          <div v-for="dev in sortedDevices(rack)" :key="dev.id"
            class="rack-slot rack-dev-slot"
            :class="slotClass(rack, dev)"
            :style="{ top: (rack.units - dev.unit - dev.height + 1) * 22 + 'px', height: dev.height * 22 - 2 + 'px' }"
            :title="slotTitle(rack, dev)"
            @click="openEditDevice(rack, dev)"
          >
            <span class="slot-u">{{ dev.unit }}U</span>
            <span class="slot-label">{{ dev.name }}</span>
            <span v-if="dev.node_name" class="slot-state">
              {{ nodeStateLabel(dev.node_name) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="rack-legend">
      <span class="leg-item"><span class="leg-dot dot-compute"></span>计算节点</span>
      <span class="leg-item"><span class="leg-dot dot-gpu"></span>GPU 节点</span>
      <span class="leg-item"><span class="leg-dot dot-switch"></span>交换机</span>
      <span class="leg-item"><span class="leg-dot dot-warn"></span>告警</span>
      <span class="leg-item"><span class="leg-dot dot-down"></span>离线</span>
    </div>

    <!-- 机柜编辑弹窗 -->
    <div v-if="showRackModal" class="overlay" @click.self="showRackModal=false">
      <div class="modal">
        <div class="modal-hd">
          <h4>{{ editingRack.id ? '编辑机柜' : '新建机柜' }}</h4>
          <button @click="showRackModal=false" class="x-btn">×</button>
        </div>
        <div class="modal-bd">
          <div class="fg"><label>机柜名称 *</label><input v-model="editingRack.name" placeholder="如 A01" /></div>
          <div class="fg"><label>位置描述</label><input v-model="editingRack.location" placeholder="如 数据中心一楼" /></div>
          <div class="fg"><label>机柜 U 数</label><input type="number" v-model.number="editingRack.units" min="4" max="52" /></div>
        </div>
        <div class="modal-ft">
          <button class="btn-sec" @click="showRackModal=false">取消</button>
          <button class="btn-pri" @click="saveRack" :disabled="!editingRack.name">保存</button>
        </div>
      </div>
    </div>

    <!-- 设备编辑弹窗 -->
    <div v-if="showDeviceModal" class="overlay" @click.self="showDeviceModal=false">
      <div class="modal">
        <div class="modal-hd">
          <h4>{{ editingDevice.id ? '编辑设备' : `添加设备 (${editingDevice.unit}U)` }}</h4>
          <button @click="showDeviceModal=false" class="x-btn">×</button>
        </div>
        <div class="modal-bd">
          <div class="fg"><label>显示名称 *</label><input v-model="editingDevice.name" placeholder="如 node01" /></div>
          <div class="fg">
            <label>设备类型</label>
            <select v-model="editingDevice.type">
              <option value="compute">计算节点</option>
              <option value="gpu">GPU 节点</option>
              <option value="storage">存储节点</option>
              <option value="switch">交换机</option>
              <option value="pdu">PDU</option>
              <option value="empty">空设备</option>
            </select>
          </div>
          <div class="fg"><label>关联 Slurm 节点名</label><input v-model="editingDevice.node_name" placeholder="可选，如 node01" /></div>
          <div class="fg"><label>型号</label><input v-model="editingDevice.model" placeholder="可选" /></div>
          <div class="fg"><label>占用 U 数</label><input type="number" v-model.number="editingDevice.height" min="1" max="10" /></div>
        </div>
        <div class="modal-ft">
          <button v-if="editingDevice.id" class="btn-sec" style="color:#ef4444" @click="removeDevice">删除设备</button>
          <button class="btn-sec" @click="showDeviceModal=false">取消</button>
          <button class="btn-pri" @click="saveDevice" :disabled="!editingDevice.name">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getApiBase } from '../utils/auth'

const loading = ref(false)
const rackLoading = ref(false)
const rackError = ref('')
const racks = ref<any[]>([])
const nodes = ref<any[]>([])

const showRackModal = ref(false)
const showDeviceModal = ref(false)
const editingRack = ref<any>({ name: '', location: '', units: 42, devices: [] })
const editingDevice = ref<any>({ name: '', type: 'compute', node_name: '', model: '', height: 2, unit: 1 })
const editingRackId = ref('')

const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''

const loadAll = async () => {
  loading.value = true
  try {
    const [rRes, nRes] = await Promise.allSettled([
      fetch(`${getApiBase()}/api/monitoring/rack`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token()}` } }),
    ])
    if (rRes.status === 'fulfilled' && rRes.value.ok) racks.value = (await rRes.value.json()).data || []
    if (nRes.status === 'fulfilled' && nRes.value.ok) nodes.value = (await nRes.value.json()).data || []
  } finally {
    loading.value = false
  }
}

const nodeStateLabel = (nodeName: string) => {
  const n = nodes.value.find(x => x.name === nodeName)
  if (!n) return ''
  const s = (n.state || '').toLowerCase()
  if (s.includes('down') || s.includes('drain')) return '⚠️'
  if (s.includes('alloc') || s.includes('mix')) return '▶'
  return ''
}

const sortedDevices = (rack: any) =>
  [...(rack.devices || [])].sort((a, b) => b.unit - a.unit)

const slotClass = (rack: any, dev: any) => {
  const node = dev.node_name ? nodes.value.find(n => n.name === dev.node_name) : null
  const isDown = node?.state?.toLowerCase().includes('down') || node?.state?.toLowerCase().includes('drain')
  if (isDown) return 'slot-down'
  if (dev.type === 'gpu') return 'slot-gpu'
  if (dev.type === 'switch') return 'slot-switch'
  if (dev.type === 'compute') return 'slot-compute'
  return 'slot-empty'
}

const slotTitle = (rack: any, dev: any) => {
  const n = dev.node_name ? nodes.value.find(x => x.name === dev.node_name) : null
  if (!n) return dev.name || ''
  return `${dev.node_name} | 状态: ${n.state || '-'} | CPU: ${Math.round(n.cpu_usage_percent || 0)}% | 内存: ${Math.round(n.memory_usage_percent || 0)}%`
}

const openNewRack = () => {
  editingRack.value = { name: '', location: '', units: 42, devices: [] }
  showRackModal.value = true
}

const openEditRack = (rack: any) => {
  editingRack.value = { ...rack, devices: [...(rack.devices || [])] }
  showRackModal.value = true
}

const saveRack = async () => {
  rackError.value = ''
  try {
    const base = `${getApiBase()}/api/monitoring/rack`
    const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }
    if (editingRack.value.id) {
      const res = await fetch(`${base}/${editingRack.value.id}`, { method: 'PUT', headers, body: JSON.stringify(editingRack.value) })
      if (!res.ok) throw new Error((await res.json()).error || '保存失败')
      const data = await res.json()
      const idx = racks.value.findIndex(r => r.id === editingRack.value.id)
      if (idx >= 0) racks.value[idx] = data.data
    } else {
      const res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(editingRack.value) })
      if (!res.ok) throw new Error((await res.json()).error || '创建失败')
      const data = await res.json()
      racks.value.push(data.data)
    }
    showRackModal.value = false
  } catch (e: any) { rackError.value = e.message }
}

const deleteRack = async (id: string) => {
  if (!confirm('确认删除该机柜？')) return
  rackError.value = ''
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/rack/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || '删除失败')
    racks.value = racks.value.filter(r => r.id !== id)
  } catch (e: any) { rackError.value = e.message }
}

const autoGenRacks = async () => {
  if (!confirm('自动生成将覆盖现有机柜布局，确认继续？')) return
  rackLoading.value = true
  rackError.value = ''
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/rack/auto`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || '自动生成失败')
    racks.value = (await res.json()).data || []
  } catch (e: any) { rackError.value = e.message }
  finally { rackLoading.value = false }
}

const openAddDevice = (rack: any, unit: number) => {
  editingRackId.value = rack.id
  editingDevice.value = { name: '', type: 'compute', node_name: '', model: '', height: 2, unit }
  showDeviceModal.value = true
}

const openEditDevice = (rack: any, dev: any) => {
  editingRackId.value = rack.id
  editingDevice.value = { ...dev }
  showDeviceModal.value = true
}

const saveDevice = async () => {
  rackError.value = ''
  const rack = racks.value.find(r => r.id === editingRackId.value)
  if (!rack) return
  const devices = [...(rack.devices || [])]
  const dev = editingDevice.value
  if (dev.id) {
    const idx = devices.findIndex((d: any) => d.id === dev.id)
    if (idx >= 0) devices[idx] = { ...dev }
  } else {
    devices.push({ ...dev, id: `dev-${Date.now()}` })
  }
  const updated = { ...rack, devices }
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/rack/${rack.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    if (!res.ok) throw new Error((await res.json()).error || '保存失败')
    const data = await res.json()
    const idx = racks.value.findIndex(r => r.id === rack.id)
    if (idx >= 0) racks.value[idx] = data.data
    showDeviceModal.value = false
  } catch (e: any) { rackError.value = e.message }
}

const removeDevice = async () => {
  if (!confirm('确认删除该设备？')) return
  const rack = racks.value.find(r => r.id === editingRackId.value)
  if (!rack) return
  const devices = (rack.devices || []).filter((d: any) => d.id !== editingDevice.value.id)
  const updated = { ...rack, devices }
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/rack/${rack.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    if (!res.ok) throw new Error((await res.json()).error || '删除失败')
    const data = await res.json()
    const idx = racks.value.findIndex(r => r.id === rack.id)
    if (idx >= 0) racks.value[idx] = data.data
    showDeviceModal.value = false
  } catch (e: any) { rackError.value = e.message }
}

onMounted(loadAll)
</script>

<style scoped>
.rack-page {
  display: flex; flex-direction: column;
  height: calc(100vh - 56px - 48px); /* 100vh - topbar - padding*2 */
  gap: 0.75rem;
  overflow: hidden;
}
.rack-page-header { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.rack-page-header h3 { margin: 0; font-size: 1.3rem; }
.rack-page-actions { display: flex; gap: 0.6rem; }
.rack-err { color: #ef4444; font-size: 0.82rem; flex-shrink: 0; }
.empty { text-align: center; padding: 3rem; color: #9ca3af; }

.rack-grid {
  display: flex; gap: 1.25rem; flex-wrap: nowrap;
  align-items: stretch;
  overflow-x: auto; overflow-y: hidden;
  flex: 1; min-height: 0;
  padding-bottom: 0.25rem;
}
.rack-box { display: flex; flex-direction: column; flex-shrink: 0; min-height: 0; }
.rack-name {
  font-size: 0.82rem; font-weight: 700; color: #374151; margin-bottom: 0.4rem;
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; width: 160px;
  flex-shrink: 0;
}
.rack-loc { font-size: 0.7rem; color: #9ca3af; font-weight: 400; }
.rack-actions { display: flex; gap: 0.25rem; margin-left: auto; }
.rack-btn { background: none; border: none; cursor: pointer; font-size: 0.82rem; padding: 0.1rem 0.3rem; border-radius: 4px; opacity: 0.7; }
.rack-btn:hover { opacity: 1; background: #f3f4f6; }
.rack-btn-del:hover { background: #fee2e2; }

.rack-body {
  border: 2px solid #cbd5e1; border-radius: 6px;
  background: #f1f5f9; padding: 4px;
  position: relative; width: 160px;
  flex: 1; min-height: 0;
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}
.rack-slot {
  height: 20px; border-radius: 4px; display: flex; align-items: center;
  padding: 0 6px; gap: 4px; cursor: pointer; transition: filter 0.15s; font-size: 0.65rem;
}
.rack-bg-slot { position: absolute; left: 4px; right: 4px; height: 20px !important; z-index: 1; }
.rack-dev-slot { position: absolute; left: 4px; right: 4px; z-index: 2; }
.rack-slot:hover { filter: brightness(0.92); }
.slot-u { color: rgba(0,0,0,0.3); min-width: 20px; font-size: 0.58rem; }
.slot-label { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slot-state { font-size: 0.62rem; margin-left: auto; }
.slot-add { color: #cbd5e1; font-size: 0.75rem; margin-left: auto; }

.slot-compute { background: #dbeafe; border: 1px solid #93c5fd; }
.slot-compute .slot-label { color: #1d4ed8; }
.slot-gpu { background: #ede9fe; border: 1px solid #c4b5fd; }
.slot-gpu .slot-label { color: #6d28d9; }
.slot-switch { background: #e2e8f0; border: 1px solid #94a3b8; }
.slot-switch .slot-label { color: #334155; }
.slot-empty { background: #f8fafc; border: 1px dashed #e2e8f0; }
.slot-empty:hover { background: #f0f9ff; border-color: #bae6fd; }
.slot-down { background: #f3f4f6; border: 1px solid #d1d5db; opacity: 0.55; }
.slot-down .slot-label { color: #6b7280; }

.rack-legend { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; color: #6b7280; }
.leg-item { display: flex; align-items: center; gap: 0.35rem; }
.leg-dot { width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid rgba(0,0,0,.1); }
.dot-compute { background: #dbeafe; border-color: #93c5fd; }
.dot-gpu { background: #ede9fe; border-color: #c4b5fd; }
.dot-switch { background: #e2e8f0; border-color: #94a3b8; }
.dot-warn { background: #fef3c7; border-color: #fcd34d; }
.dot-down { background: #f3f4f6; border-color: #d1d5db; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 12px; width: 90%; max-width: 480px; }
.modal-hd { display: flex; justify-content: space-between; align-items: center; padding: 1.1rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
.modal-hd h4 { margin: 0; }
.x-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #9ca3af; }
.modal-bd { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-ft { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; }
.fg { display: flex; flex-direction: column; gap: 0.35rem; }
.fg label { font-size: 0.85rem; font-weight: 600; color: #374151; }
.fg input, .fg select { padding: 0.55rem 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; }
.fg input:focus, .fg select:focus { outline: none; border-color: #667eea; }

.btn-pri { background: linear-gradient(135deg,#667eea,#764ba2); color:#fff; border:none; padding:0.55rem 1.2rem; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.88rem; }
.btn-sec { background:#f3f4f6; color:#374151; border:none; padding:0.55rem 1.2rem; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.88rem; }
.btn-sec:disabled { opacity:0.5; cursor:not-allowed; }
</style>
