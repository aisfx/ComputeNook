<template>
  <div class="rack-page">
    <div class="rack-toolbar">
      <div class="rack-toolbar-left">
        <div class="rack-legend">
          <span class="leg-item"><span class="leg-dot dot-compute"></span>计算节点</span>
          <span class="leg-item"><span class="leg-dot dot-gpu"></span>GPU 节点</span>
          <span class="leg-item"><span class="leg-dot dot-switch"></span>交换机</span>
          <span class="leg-item"><span class="leg-dot dot-pdu"></span>PDU</span>
          <span class="leg-item"><span class="leg-dot dot-warn"></span>告警</span>
          <span class="leg-item"><span class="leg-dot dot-down"></span>离线</span>
        </div>
      </div>
      <div class="rack-toolbar-right">
        <button class="btn-pri" @click="openNewRack">＋ 新建机柜</button>
        <button class="btn-sec" @click="autoGenRacks" :disabled="rackLoading">{{ rackLoading ? '生成中...' : ' 自动生成' }}</button>
        <button class="btn-sec" @click="loadAll" :disabled="loading"> 刷新</button>
      </div>
    </div>
    <span v-if="rackError" class="rack-err">{{ rackError }}</span>
    <div v-if="racks.length === 0 && !loading" class="empty">暂无机柜，点击「自动生成」或「新建机柜」</div>
    <div v-else class="rack-scroll-area">
      <div class="rack-list" ref="rackListRef">
        <div v-for="rack in racks" :key="rack.id" class="rack-col">
          <div class="rack-name">
            <span>{{ rack.name }}</span>
            <span class="rack-loc" v-if="rack.location">{{ rack.location }}</span>
            <div class="rack-actions">
              <button class="rack-btn" @click="openEditRack(rack)"></button>
              <button class="rack-btn rack-btn-del" @click="deleteRack(rack.id)"></button>
            </div>
          </div>
          <div class="rack-body" :style="{ height: SLOT_H * rack.units + 8 + 'px' }" :data-rack-id="rack.id">
            <!-- PDU 左侧 -->
            <div class="pdu-side pdu-left">
              <div v-for="dev in sortedDevices(rack).filter((d:any) => d.type === 'pdu' && d.unit % 2 === 1)"
                :key="'pdu-l-'+dev.id" class="pdu-bar"
                :title="dev.name" @click="openEditDevice(rack, dev)">
                <span class="pdu-label">{{ dev.name }}</span>
              </div>
              <div v-if="sortedDevices(rack).filter((d:any) => d.type === 'pdu' && d.unit % 2 === 1).length === 0"
                class="pdu-bar pdu-empty" :title="'添加 PDU'" @click="openAddPdu(rack, 1)">
                <span class="pdu-add">+</span>
              </div>
            </div>
            <!-- 主体 slots -->
            <div class="rack-inner">
              <div v-for="u in rack.units" :key="'bg-'+u" class="rack-slot slot-empty rack-bg-slot"
                :style="{ top: (rack.units - u) * SLOT_H + 'px', height: SLOT_H - 2 + 'px' }"
                @click="openAddDevice(rack, u)">
                <span class="slot-u">{{ u }}U</span>
                <span class="slot-add">+</span>
              </div>
              <div v-for="dev in sortedDevices(rack).filter((d:any) => d.type !== 'pdu')" :key="dev.id"
                class="rack-slot rack-dev-slot" :class="slotClass(rack, dev)"
                :style="{ top: (rack.units - dev.unit - dev.height + 1) * SLOT_H + 'px', height: dev.height * SLOT_H - 2 + 'px' }"
                :data-dev-id="dev.id" :data-rack-id="rack.id"
                :title="slotTitle(rack, dev)" @click="openEditDevice(rack, dev)">
                <span class="slot-u">{{ dev.unit }}U</span>
                <span class="slot-label slot-label-center">{{ dev.name }}</span>
                <template v-if="dev.type === 'switch' && dev.ports && dev.ports.length">
                  <span v-for="(port, pi) in dev.ports" :key="port.id"
                    class="port-pin" :class="{ 'port-used': isCablePort(dev.id, port.id) }"
                    :style="portPinStyle(Number(pi), dev.ports.length)"
                    :data-dev-id="dev.id" :data-rack-id="rack.id" :data-port-id="port.id"
                    :title="port.name + (port.speed ? ' ' + port.speed : '')"
                    @mousedown.stop="startCable($event, rack.id, dev.id, port.id)"
                    @mouseup.stop="endCable($event, rack.id, dev.id, port.id)">
                  </span>
                </template>
                <template v-else-if="dev.type === 'compute' || dev.type === 'gpu' || dev.type === 'storage'">
                  <span class="port-dot port-right"></span>
                  <span class="port-dot port-left"></span>
                </template>
              </div>
            </div>
            <!-- PDU 右侧 -->
            <div class="pdu-side pdu-right">
              <div v-for="dev in sortedDevices(rack).filter((d:any) => d.type === 'pdu' && d.unit % 2 === 0)"
                :key="'pdu-r-'+dev.id" class="pdu-bar"
                :title="dev.name" @click="openEditDevice(rack, dev)">
                <span class="pdu-label">{{ dev.name }}</span>
              </div>
              <div v-if="sortedDevices(rack).filter((d:any) => d.type === 'pdu' && d.unit % 2 === 0).length === 0"
                class="pdu-bar pdu-empty" :title="'添加 PDU'" @click="openAddPdu(rack, 2)">
                <span class="pdu-add">+</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showRackModal" class="overlay" @click.self="showRackModal=false">
      <div class="modal">
        <div class="modal-hd"><h4>{{ editingRack.id ? '编辑机柜' : '新建机柜' }}</h4><button @click="showRackModal=false" class="x-btn"></button></div>
        <div class="modal-bd">
          <div class="fg"><label>机柜名称 *</label><input v-model="editingRack.name" placeholder="如 A01"/></div>
          <div class="fg"><label>位置描述</label><input v-model="editingRack.location" placeholder="如 数据中心一楼"/></div>
          <div class="fg"><label>机柜 U 数</label><input type="number" v-model.number="editingRack.units" min="4" max="52"/></div>
        </div>
        <div class="modal-ft">
          <button class="btn-sec" @click="showRackModal=false">取消</button>
          <button class="btn-pri" @click="saveRack" :disabled="!editingRack.name">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showDeviceModal" class="overlay" @click.self="showDeviceModal=false">
      <div class="modal modal-lg">
        <div class="modal-hd">
          <h4>{{ editingDevice.id ? '编辑设备' : '添加设备 (' + editingDevice.unit + 'U)' }}</h4>
          <button @click="showDeviceModal=false" class="x-btn"></button>
        </div>
        <div class="dev-tabs">
          <button :class="['dev-tab', { active: devTab==='basic' }]" @click="devTab='basic'">基本信息</button>
          <button v-if="editingDevice.type==='switch'" :class="['dev-tab', { active: devTab==='ports' }]" @click="devTab='ports'">端口管理</button>
        </div>
        <div class="modal-bd">
          <template v-if="devTab==='basic'">
            <!-- CMDB 快速导入 -->
            <div class="cmdb-import-bar" v-if="cmdbHosts.length > 0">
              <span class="cmdb-import-tip">📋 从 CMDB 导入</span>
              <select v-model="cmdbImportHost" class="cmdb-import-sel">
                <option value="">选择主机...</option>
                <option v-for="h in cmdbHosts" :key="h.id" :value="h.id">
                  {{ h.hostname }}{{ h.rack ? ' [' + h.rack + ']' : '' }}{{ h.role ? ' · ' + h.role : '' }}
                </option>
              </select>
              <button class="btn-sec btn-sm" @click="importFromCmdb" :disabled="!cmdbImportHost">填充</button>
            </div>
            <div class="fg"><label>显示名称 *</label><input v-model="editingDevice.name" placeholder="如 node01"/></div>
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
            <div class="fg"><label>关联 Slurm 节点名</label><input v-model="editingDevice.node_name" placeholder="可选，如 node01"/></div>
            <div class="fg"><label>型号</label><input v-model="editingDevice.model" placeholder="可选"/></div>
            <div class="fg"><label>占用 U 数</label><input type="number" v-model.number="editingDevice.height" min="1" max="10"/></div>
          </template>
          <template v-if="devTab==='ports' && editingDevice.type==='switch'">
            <div class="port-mgr-bar">
              <span class="port-mgr-tip">配置交换机端口，每个端口可独立连线</span>
              <button class="btn-sec btn-sm" @click="addPort">＋ 添加端口</button>
              <button class="btn-sec btn-sm" @click="autoGenPorts(24)">生成24口</button>
              <button class="btn-sec btn-sm" @click="autoGenPorts(48)">生成48口</button>
            </div>
            <div class="port-list">
              <div v-for="(port, pi) in editingDevice.ports || []" :key="port.id" class="port-row">
                <span class="port-idx">{{ Number(pi)+1 }}</span>
                <input v-model="port.name" placeholder="端口名 如 Gi0/1" class="port-input"/>
                <select v-model="port.speed" class="port-speed">
                  <option value="">速率</option>
                  <option value="1G">1G</option>
                  <option value="10G">10G</option>
                  <option value="25G">25G</option>
                  <option value="100G">100G</option>
                </select>
                <input v-model="port.desc" placeholder="描述" class="port-input port-desc"/>
                <button class="port-del" @click="removePort(Number(pi))"></button>
              </div>
              <div v-if="!editingDevice.ports || editingDevice.ports.length===0" class="port-empty">暂无端口，点击「添加端口」</div>
            </div>
          </template>
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
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { getApiBase } from '../utils/auth'

const containerH = ref(600)
const racks = ref<any[]>([])
const nodes = ref<any[]>([])
const nodeMetrics = ref<any[]>([])  // Prometheus 实时指标
const cmdbHosts = ref<any[]>([])    // CMDB 主机列表
const loading = ref(false)
const rackLoading = ref(false)
const rackError = ref('')
const showRackModal = ref(false)
const showDeviceModal = ref(false)
const showCmdb = ref(false)
const devTab = ref('basic')
const editingRack = ref<any>({ name: '', location: '', units: 42, devices: [] })
const editingDevice = ref<any>({ name: '', type: 'compute', node_name: '', model: '', height: 2, unit: 1, ports: [] })
const editingRackId = ref('')
const cmdbSyncNode = ref('')
const cmdbSearch = ref('')
const cmdbTypeFilter = ref('')
const cmdbScanning = ref(false)
const cmdbImportHost = ref('')  // 从 CMDB 导入时选中的主机

interface Cable { id: string; fromRack: string; fromDev: string; fromPort: string; toRack: string; toDev: string; toPort: string }
const cables = ref<Cable[]>(JSON.parse(localStorage.getItem('rack-cables') || '[]'))
const draggingCable = ref(false)
const dragFrom = ref<{ rackId: string; devId: string; portId: string } | null>(null)
const draggingPath = ref('')
const svgRef = ref<SVGSVGElement | null>(null)
const rackListRef = ref<HTMLElement | null>(null)
const svgWidth = ref(2000)
const svgHeight = ref(1000)

const maxUnits = computed(() => Math.max(...racks.value.map((r:any) => r.units || 42), 42))
const SLOT_H = computed(() => Math.max(12, Math.floor((containerH.value - 8) / maxUnits.value)))
const saveCables = () => localStorage.setItem('rack-cables', JSON.stringify(cables.value))
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''
const CABLE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']
const cableColor = (idx: number) => CABLE_COLORS[idx % CABLE_COLORS.length]

const getPortEl = (rackId: string, devId: string, portId: string): HTMLElement | null =>
  document.querySelector(`[data-dev-id="${devId}"][data-rack-id="${rackId}"][data-port-id="${portId}"]`) as HTMLElement | null

const getPortPos = (rackId: string, devId: string, portId: string, side: 'right'|'left'): {x:number;y:number}|null => {
  const el = getPortEl(rackId, devId, portId) || (document.querySelector(`[data-dev-id="${devId}"][data-rack-id="${rackId}"]`) as HTMLElement | null)
  if (!el || !svgRef.value) return null
  const sr = svgRef.value.getBoundingClientRect()
  const er = el.getBoundingClientRect()
  return { x: side === 'right' ? er.right - sr.left : er.left - sr.left, y: er.top + er.height/2 - sr.top }
}

const cableEndpoints = (cable: Cable) => ({
  from: getPortPos(cable.fromRack, cable.fromDev, cable.fromPort, 'right'),
  to: getPortPos(cable.toRack, cable.toDev, cable.toPort, 'left'),
})

const cablePath = (cable: Cable) => {
  const from = getPortPos(cable.fromRack, cable.fromDev, cable.fromPort, 'right')
  const to = getPortPos(cable.toRack, cable.toDev, cable.toPort, 'left')
  if (!from || !to) return ''
  const dx = to.x - from.x
  if (Math.abs(dx) < 30) {
    const bulge = Math.max(50, Math.abs(to.y - from.y) * 0.4 + 40)
    return `M${from.x},${from.y} C${from.x+bulge},${from.y} ${to.x+bulge},${to.y} ${to.x},${to.y}`
  }
  const cx = Math.abs(dx) * 0.5
  return `M${from.x},${from.y} C${from.x+cx},${from.y} ${to.x-cx},${to.y} ${to.x},${to.y}`
}

const cableLabel = (cable: Cable) => {
  const fromDev = racks.value.flatMap((r:any) => r.devices||[]).find((d:any) => d.id === cable.fromDev)
  const toDev = racks.value.flatMap((r:any) => r.devices||[]).find((d:any) => d.id === cable.toDev)
  return `${fromDev?.name||'?'}:${cable.fromPort}  ${toDev?.name||'?'}:${cable.toPort}`
}

const isCablePort = (devId: string, portId: string) =>
  cables.value.some(c => (c.fromDev===devId && c.fromPort===portId) || (c.toDev===devId && c.toPort===portId))

const portPinStyle = (pi: number, total: number) => {
  const pct = total <= 1 ? 50 : (pi / (total-1)) * 80 + 10
  return { top: pct + '%', right: '-5px', transform: 'translateY(-50%)' }
}
const startCable = (e: MouseEvent, rackId: string, devId: string, portId: string) => {
  draggingCable.value = true
  dragFrom.value = { rackId, devId, portId }
  e.preventDefault()
}

const onMouseMove = (e: MouseEvent) => {
  if (!draggingCable.value || !dragFrom.value || !svgRef.value) return
  const sr = svgRef.value.getBoundingClientRect()
  const mx = e.clientX - sr.left, my = e.clientY - sr.top
  const from = getPortPos(dragFrom.value.rackId, dragFrom.value.devId, dragFrom.value.portId, 'right')
  if (!from) return
  const dx = mx - from.x
  const cx = Math.max(Math.abs(dx)*0.5, 40)
  draggingPath.value = `M${from.x},${from.y} C${from.x+cx},${from.y} ${mx-cx},${my} ${mx},${my}`
}

const onMouseUp = () => { draggingCable.value = false; dragFrom.value = null; draggingPath.value = '' }

const endCable = (e: MouseEvent, rackId: string, devId: string, portId: string) => {
  if (!draggingCable.value || !dragFrom.value) return
  if (dragFrom.value.devId === devId && dragFrom.value.portId === portId) return
  const exists = cables.value.find(c =>
    (c.fromDev===dragFrom.value!.devId && c.fromPort===dragFrom.value!.portId && c.toDev===devId && c.toPort===portId) ||
    (c.fromDev===devId && c.fromPort===portId && c.toDev===dragFrom.value!.devId && c.toPort===dragFrom.value!.portId)
  )
  if (!exists) {
    cables.value.push({ id:`cable-${Date.now()}`, fromRack:dragFrom.value.rackId, fromDev:dragFrom.value.devId, fromPort:dragFrom.value.portId, toRack:rackId, toDev:devId, toPort:portId })
    saveCables()
  }
  draggingCable.value = false; dragFrom.value = null; draggingPath.value = ''
}

const removeCable = (id: string) => {
  if (!confirm('删除该连线？')) return
  cables.value = cables.value.filter(c => c.id !== id)
  saveCables()
}
const updateSvgSize = () => nextTick(() => {
  if (rackListRef.value) { svgWidth.value = rackListRef.value.scrollWidth+100; svgHeight.value = rackListRef.value.scrollHeight+100 }
})

const updateContainerH = () => {
  const el = rackListRef.value?.closest('.rack-scroll-area') as HTMLElement|null
  containerH.value = el ? el.clientHeight - 4 : window.innerHeight - 160
}

const loadAll = async () => {
  loading.value = true
  try {
    const [rRes, nRes, mRes, cRes] = await Promise.allSettled([
      fetch(`${getApiBase()}/api/monitoring/rack`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/monitoring/node-metrics`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/cmdb/hosts`, { headers: { Authorization: `Bearer ${token()}` } }),
    ])
    if (rRes.status==='fulfilled' && rRes.value.ok) racks.value = (await rRes.value.json()).data || []
    if (nRes.status==='fulfilled' && nRes.value.ok) nodes.value = (await nRes.value.json()).data || []
    if (mRes.status==='fulfilled' && mRes.value.ok) {
      const d = await mRes.value.json()
      nodeMetrics.value = d.nodes || []
    }
    if (cRes.status==='fulfilled' && cRes.value.ok) cmdbHosts.value = (await cRes.value.json()).data || []
  } finally { loading.value = false; updateContainerH(); updateSvgSize() }
}

const nodeStateLabel = (nodeName: string) => {
  const n = nodes.value.find((x:any) => x.name === nodeName)
  if (!n) return ''
  const s = (n.state||'').toLowerCase()
  if (s.includes('down')||s.includes('drain')) return '🔴'
  if (s.includes('alloc')||s.includes('mix')) return '🟡'
  return '🟢'
}

// 从 Prometheus nodeMetrics 里查找设备对应的指标（按 node_name 或 IP 匹配）
const getDevMetrics = (dev: any) => {
  if (!nodeMetrics.value.length) return null
  // 优先按 node_name 匹配
  if (dev.node_name) {
    const m = nodeMetrics.value.find((n:any) =>
      n.instance && (n.instance.includes(dev.node_name) || dev.node_name.includes(n.instance.split(':')[0]))
    )
    if (m) return m
  }
  // 按 IP 匹配
  if (dev.ip) {
    const m = nodeMetrics.value.find((n:any) => n.instance && n.instance.includes(dev.ip))
    if (m) return m
  }
  return null
}

const sortedDevices = (rack: any) => [...(rack.devices||[])].sort((a:any,b:any) => b.unit - a.unit)

const slotClass = (rack: any, dev: any) => {
  const node = dev.node_name ? nodes.value.find((n:any) => n.name===dev.node_name) : null
  const isDown = node?.state?.toLowerCase().includes('down') || node?.state?.toLowerCase().includes('drain')
  if (isDown) return 'slot-down'
  if (dev.type==='gpu') return 'slot-gpu'
  if (dev.type==='switch') return 'slot-switch'
  if (dev.type==='compute') return 'slot-compute'
  if (dev.type==='pdu') return 'slot-pdu'
  return 'slot-empty'
}

const slotTitle = (rack: any, dev: any) => {
  const n = dev.node_name ? nodes.value.find((x:any) => x.name===dev.node_name) : null
  const m = getDevMetrics(dev)
  const base = dev.name + (dev.ip ? ` | IP: ${dev.ip}` : '')
  const slurmInfo = n ? ` | Slurm: ${n.state||'-'}` : ''
  const promInfo = m ? ` | CPU: ${Math.round(m.cpu_usage||0)}% | 内存: ${Math.round(m.mem_usage||0)}% | Load: ${m.load1||0}` : ''
  return base + slurmInfo + promInfo
}
const openNewRack = () => { editingRack.value = { name:'', location:'', units:42, devices:[] }; showRackModal.value = true }
const openEditRack = (rack: any) => { editingRack.value = { ...rack, devices:[...(rack.devices||[])] }; showRackModal.value = true }

// 从 CMDB 主机填充设备信息
const importFromCmdb = () => {
  if (!cmdbImportHost.value) return
  const h = cmdbHosts.value.find((x:any) => x.id === cmdbImportHost.value)
  if (!h) return
  const role = (h.role || '').toLowerCase()
  let devType = 'compute'
  if (role.includes('gpu')) devType = 'gpu'
  else if (role.includes('存储') || role.includes('storage')) devType = 'storage'
  else if (role.includes('交换') || role.includes('switch')) devType = 'switch'
  // 解析 U 数
  const unitMatch = (h.rack_unit || '').match(/[Uu](\d+)/)
  const unitEnd = (h.rack_unit || '').match(/[Uu]\d+-[Uu](\d+)/)
  const startU = unitMatch ? parseInt(unitMatch[1]) : editingDevice.value.unit
  const endU = unitEnd ? parseInt(unitEnd[1]) : startU + 1
  const height = Math.max(1, endU - startU + 1)
  // 主 IP
  const mainIP = h.ips?.find((ip:any) => ip.type === '业务口' || ip.type === '管理口')?.address || h.ips?.[0]?.address || ''
  editingDevice.value = {
    ...editingDevice.value,
    name: h.hostname,
    type: devType,
    model: h.model || '',
    height,
    ip: mainIP,
  }
  cmdbImportHost.value = ''
}

const saveRack = async () => {
  rackError.value = ''
  try {
    const base = `${getApiBase()}/api/monitoring/rack`
    const headers = { Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' }
    if (editingRack.value.id) {
      const res = await fetch(`${base}/${editingRack.value.id}`, { method:'PUT', headers, body:JSON.stringify(editingRack.value) })
      if (!res.ok) throw new Error((await res.json()).error||'保存失败')
      const data = await res.json()
      const idx = racks.value.findIndex((r:any) => r.id===editingRack.value.id)
      if (idx>=0) racks.value[idx] = data.data
    } else {
      const res = await fetch(base, { method:'POST', headers, body:JSON.stringify(editingRack.value) })
      if (!res.ok) throw new Error((await res.json()).error||'创建失败')
      racks.value.push((await res.json()).data)
    }
    showRackModal.value = false; updateSvgSize()
  } catch(e:any) { rackError.value = e.message }
}

const deleteRack = async (id: string) => {
  if (!confirm('确认删除该机柜？')) return
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/rack/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token()}` } })
    if (!res.ok) throw new Error((await res.json()).error||'删除失败')
    racks.value = racks.value.filter((r:any) => r.id!==id)
    cables.value = cables.value.filter(c => c.fromRack!==id && c.toRack!==id); saveCables()
  } catch(e:any) { rackError.value = e.message }
}

const autoGenRacks = async () => {
  if (!confirm('自动生成将覆盖现有机柜布局，确认继续？')) return
  rackLoading.value = true; rackError.value = ''
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/rack/auto`, { method:'POST', headers:{ Authorization:`Bearer ${token()}` } })
    if (!res.ok) throw new Error((await res.json()).error||'自动生成失败')
    racks.value = (await res.json()).data || []; updateSvgSize()
  } catch(e:any) { rackError.value = e.message } finally { rackLoading.value = false }
}
const openAddDevice = (rack: any, unit: number) => {
  editingRackId.value = rack.id
  editingDevice.value = { name:'', type:'compute', node_name:'', model:'', height:2, unit, ports:[] }
  devTab.value = 'basic'; showDeviceModal.value = true
}
const openAddPdu = (rack: any, unit: number) => {
  editingRackId.value = rack.id
  editingDevice.value = { name: unit === 1 ? 'PDU-01' : 'PDU-02', type:'pdu', node_name:'', model:'', height:1, unit, ports:[] }
  devTab.value = 'basic'; showDeviceModal.value = true
}
const openEditDevice = (rack: any, dev: any) => {
  editingRackId.value = rack.id
  editingDevice.value = { ...dev, ports: dev.ports ? [...dev.ports] : [] }
  devTab.value = 'basic'; showDeviceModal.value = true
}

const saveDevice = async () => {
  rackError.value = ''
  const rack = racks.value.find((r:any) => r.id===editingRackId.value)
  if (!rack) return
  const devices = [...(rack.devices||[])]
  const dev = editingDevice.value
  if (dev.id) { const idx = devices.findIndex((d:any) => d.id===dev.id); if (idx>=0) devices[idx]={...dev} }
  else devices.push({ ...dev, id:`dev-${Date.now()}` })
  const updated = { ...rack, devices }
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/rack/${rack.id}`, { method:'PUT', headers:{ Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' }, body:JSON.stringify(updated) })
    if (!res.ok) throw new Error((await res.json()).error||'保存失败')
    const idx = racks.value.findIndex((r:any) => r.id===rack.id)
    if (idx>=0) racks.value[idx] = (await res.json()).data
    showDeviceModal.value = false
  } catch(e:any) { rackError.value = e.message }
}

const removeDevice = async () => {
  if (!confirm('确认删除该设备？')) return
  const rack = racks.value.find((r:any) => r.id===editingRackId.value)
  if (!rack) return
  const devices = (rack.devices||[]).filter((d:any) => d.id!==editingDevice.value.id)
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/rack/${rack.id}`, { method:'PUT', headers:{ Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' }, body:JSON.stringify({...rack,devices}) })
    if (!res.ok) throw new Error((await res.json()).error||'删除失败')
    const idx = racks.value.findIndex((r:any) => r.id===rack.id)
    if (idx>=0) racks.value[idx] = (await res.json()).data
    cables.value = cables.value.filter(c => c.fromDev!==editingDevice.value.id && c.toDev!==editingDevice.value.id); saveCables()
    showDeviceModal.value = false
  } catch(e:any) { rackError.value = e.message }
}
const addPort = () => {
  if (!editingDevice.value.ports) editingDevice.value.ports = []
  const n = editingDevice.value.ports.length + 1
  editingDevice.value.ports.push({ id:`port-${Date.now()}`, name:`Gi0/${n}`, speed:'1G', desc:'' })
}
const autoGenPorts = (count: number) => {
  editingDevice.value.ports = Array.from({length:count}, (_,i) => ({ id:`port-${Date.now()}-${i}`, name:`Gi0/${i+1}`, speed:'1G', desc:'' }))
}
const removePort = (pi: number) => { editingDevice.value.ports.splice(pi, 1) }

const syncFromNode = () => {
  const n = nodes.value.find((x:any) => x.name===cmdbSyncNode.value)
  if (!n) return
  editingDevice.value.node_name = n.name
  if (n.ip) editingDevice.value.ip = n.ip
  if (n.cpu_model) editingDevice.value.cpu_model = n.cpu_model
  if (n.mem_total_gb) editingDevice.value.mem_total = n.mem_total_gb + 'GB'
  if (n.os) editingDevice.value.os = n.os
}

const cmdbList = computed(() => racks.value.flatMap((rack:any) =>
  (rack.devices||[]).filter((d:any) => d.type!=='empty').map((d:any) => ({ ...d, devId:d.id, rackName:rack.name }))
))
const cmdbFiltered = computed(() => cmdbList.value.filter((item:any) => {
  const q = cmdbSearch.value.toLowerCase()
  const matchQ = !q || [item.name,item.ip,item.model,item.mac,item.sn,item.cpu_model].some(v => v && String(v).toLowerCase().includes(q))
  const matchT = !cmdbTypeFilter.value || item.type===cmdbTypeFilter.value
  return matchQ && matchT
}))

const typeLabel = (t: string) => ({ compute:'计算节点', gpu:'GPU节点', storage:'存储', switch:'交换机', pdu:'PDU' }[t] || t)

const jumpToDevice = (item: any) => { showCmdb.value = false }

const cmdbAutoScan = async () => {
  cmdbScanning.value = true
  try {
    await loadAll()
    const nodeMap = Object.fromEntries(nodes.value.map((n:any) => [n.name, n]))
    for (const rack of racks.value) {
      let changed = false
      for (const dev of (rack.devices||[])) {
        if (dev.node_name && nodeMap[dev.node_name]) {
          const n = nodeMap[dev.node_name]
          if (n.ip && !dev.ip) { dev.ip = n.ip; changed = true }
          if (n.cpu_model && !dev.cpu_model) { dev.cpu_model = n.cpu_model; changed = true }
          if (n.mem_total_gb && !dev.mem_total) { dev.mem_total = n.mem_total_gb+'GB'; changed = true }
          if (n.os && !dev.os) { dev.os = n.os; changed = true }
        }
      }
      if (changed) {
        await fetch(`${getApiBase()}/api/monitoring/rack/${rack.id}`, { method:'PUT', headers:{ Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' }, body:JSON.stringify(rack) })
      }
    }
    await loadAll()
  } finally { cmdbScanning.value = false }
}

onMounted(() => { loadAll(); updateContainerH(); window.addEventListener('resize', updateContainerH); window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp) })
onUnmounted(() => { window.removeEventListener('resize', updateContainerH); window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) })
</script>
<style scoped>
.rack-page { display:flex; flex-direction:column; height:100%; gap:0.6rem; overflow:hidden; }
.rack-toolbar { display:flex; justify-content:space-between; align-items:center; flex-shrink:0; gap:1rem; }
.rack-toolbar-right { display:flex; gap:0.6rem; }
.rack-legend { display:flex; gap:0.75rem; flex-wrap:wrap; font-size:0.78rem; color:#6b7280; }
.leg-item { display:flex; align-items:center; gap:0.3rem; }
.leg-dot { width:11px; height:11px; border-radius:3px; border:1.5px solid rgba(0,0,0,.1); }
.dot-compute{background:#dbeafe;border-color:#93c5fd}.dot-gpu{background:#ede9fe;border-color:#c4b5fd}
.dot-switch{background:#e2e8f0;border-color:#94a3b8}.dot-pdu{background:#fef3c7;border-color:#fbbf24}.dot-warn{background:#fef3c7;border-color:#fcd34d}
.dot-down{background:#f3f4f6;border-color:#d1d5db}
.rack-err{color:#ef4444;font-size:0.82rem;flex-shrink:0}
.empty{text-align:center;padding:3rem;color:#9ca3af}
.rack-scroll-area{flex:1;min-height:0;overflow-x:auto;overflow-y:hidden;position:relative}
.cable-svg{position:absolute;top:0;left:0;pointer-events:none;z-index:10}
.cable-line{pointer-events:stroke;cursor:pointer;transition:stroke-width 0.15s}
.cable-line:hover{stroke-width:4}
.cable-group{pointer-events:none}
.cable-group .cable-line{pointer-events:stroke}
.rack-list{display:flex;gap:1.25rem;align-items:flex-start;padding:4px 4px 8px;width:max-content}
.rack-col{display:flex;flex-direction:column;flex-shrink:0}
.rack-name{font-size:0.82rem;font-weight:700;color:#374151;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.4rem;width:180px}
.rack-loc{font-size:0.7rem;color:#9ca3af;font-weight:400}
.rack-actions{display:flex;gap:0.2rem;margin-left:auto}
.rack-btn{background:none;border:none;cursor:pointer;font-size:0.78rem;padding:0.1rem 0.25rem;border-radius:4px;opacity:0.7}
.rack-btn:hover{opacity:1;background:#f3f4f6}
.rack-btn-del:hover{background:#fee2e2}
.rack-body{border:2px solid #cbd5e1;border-radius:6px;background:#f1f5f9;padding:4px;position:relative;width:180px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);flex-shrink:0;display:flex;flex-direction:row;gap:2px}
.rack-inner{flex:1;position:relative;min-width:0;height:100%}
.pdu-side{width:12px;flex-shrink:0;display:flex;flex-direction:column;gap:2px;border-radius:3px;overflow:hidden}
.pdu-bar{flex:1;background:#fef3c7;border:1px solid #fbbf24;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:20px;transition:filter 0.15s}
.pdu-bar:hover{filter:brightness(0.9)}
.pdu-bar.pdu-empty{background:#f1f5f9;border:1px dashed #e2e8f0;cursor:pointer}
.pdu-bar.pdu-empty:hover{background:#eff6ff;border-color:#93c5fd}
.pdu-add{font-size:0.7rem;color:#94a3b8}
.pdu-label{font-size:0.45rem;color:#92400e;font-weight:700;writing-mode:vertical-rl;text-orientation:mixed;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-height:60px}
.rack-slot{border-radius:3px;display:flex;align-items:center;padding:0 5px;gap:3px;cursor:pointer;transition:filter 0.15s;font-size:0.6rem;position:relative}
.rack-bg-slot{position:absolute;left:0;right:0;z-index:1}
.rack-dev-slot{position:absolute;left:0;right:0;z-index:2}
.rack-slot:hover{filter:brightness(0.92)}
.slot-u{color:rgba(0,0,0,0.3);min-width:18px;font-size:0.55rem}
.slot-label{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slot-label-center{text-align:center;justify-content:center}
.slot-ip{font-size:0.55rem;color:#6b7280;margin-left:2px}
.slot-state{font-size:0.62rem;margin-left:auto}
.slot-add{color:#cbd5e1;font-size:0.75rem;margin-left:auto}
.slot-compute{background:#dbeafe;border:1px solid #93c5fd}.slot-compute .slot-label{color:#1d4ed8}
.slot-gpu{background:#ede9fe;border:1px solid #c4b5fd}.slot-gpu .slot-label{color:#6d28d9}
.slot-switch{background:#e2e8f0;border:1px solid #94a3b8}.slot-switch .slot-label{color:#334155}
.slot-pdu{background:#fef3c7;border:1px solid #fbbf24}.slot-pdu .slot-label{color:#92400e}
.slot-empty{background:#f8fafc;border:1px dashed #e2e8f0}
.slot-empty:hover{background:#f0f9ff;border-color:#bae6fd}
/* 负载进度条 */
.slot-metrics{width:100%;display:flex;flex-direction:column;gap:1px;margin-top:2px}
.slot-bar-row{display:flex;align-items:center;gap:2px;height:5px}
.slot-bar-label{font-size:0.5rem;color:#6b7280;width:8px;flex-shrink:0}
.slot-bar-bg{flex:1;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;overflow:hidden}
.slot-bar-fill{height:100%;border-radius:2px;transition:width 0.3s;background:#22c55e}
.slot-bar-fill.bar-warn{background:#f59e0b}
.slot-bar-fill.bar-crit{background:#ef4444}
.slot-bar-val{font-size:0.48rem;color:#6b7280;width:20px;text-align:right;flex-shrink:0}
/* CMDB 导入栏 */
.cmdb-import-bar{display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;margin-bottom:0.75rem}
.cmdb-import-tip{font-size:0.8rem;color:#1d4ed8;flex-shrink:0}
.cmdb-import-sel{flex:1;padding:0.3rem 0.5rem;border:1px solid #bfdbfe;border-radius:6px;font-size:0.82rem;background:#fff}
.slot-down{background:#f3f4f6;border:1px solid #d1d5db;opacity:0.55}
.port-dot{position:absolute;width:8px;height:8px;border-radius:50%;background:#f59e0b;border:1.5px solid #d97706;cursor:crosshair;z-index:20;transition:transform 0.1s}
.port-dot:hover{transform:scale(1.5)}
.port-right{right:-5px;top:50%;transform:translateY(-50%)}
.port-right:hover{transform:translateY(-50%) scale(1.5)}
.port-left{left:-5px;top:50%;transform:translateY(-50%)}
.port-left:hover{transform:translateY(-50%) scale(1.5)}
.port-pin{position:absolute;right:-5px;width:7px;height:7px;border-radius:50%;background:#94a3b8;border:1.5px solid #64748b;cursor:crosshair;z-index:20;transition:transform 0.1s,background 0.1s}
.port-pin:hover{transform:translateY(-50%) scale(1.6);background:#6366f1}
.port-used{background:#6366f1;border-color:#4f46e5}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000}
.modal{background:#fff;border-radius:12px;width:90%;max-width:480px;max-height:90vh;display:flex;flex-direction:column}
.modal-lg{max-width:600px}
.modal-xl{max-width:1100px;width:95%}
.modal-hd{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid #e5e7eb;flex-shrink:0}
.modal-hd h4{margin:0}
.x-btn{background:none;border:none;font-size:1.5rem;cursor:pointer;color:#9ca3af}
.dev-tabs{display:flex;gap:0;border-bottom:1px solid #e5e7eb;flex-shrink:0}
.dev-tab{padding:0.6rem 1.2rem;border:none;background:none;font-size:0.85rem;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.dev-tab.active{color:#6366f1;border-bottom-color:#6366f1}
.modal-bd{padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;overflow-y:auto;flex:1}
.modal-ft{display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.5rem;border-top:1px solid #e5e7eb;flex-shrink:0}
.fg{display:flex;flex-direction:column;gap:0.3rem}
.fg label{font-size:0.82rem;font-weight:600;color:#374151}
.fg input,.fg select,.fg textarea{padding:0.5rem 0.7rem;border:2px solid #e5e7eb;border-radius:8px;font-size:0.88rem}
.fg input:focus,.fg select:focus,.fg textarea:focus{outline:none;border-color:#667eea}
.fg-row{display:flex;gap:0.75rem}
.fg-row .fg{flex:1}
.cmdb-sync-bar{display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.cmdb-sync-tip{font-size:0.8rem;color:#6b7280;flex:1}
.cmdb-sel{padding:0.35rem 0.6rem;border:1.5px solid #e2e8f0;border-radius:6px;font-size:0.82rem}
.port-mgr-bar{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap}
.port-mgr-tip{font-size:0.8rem;color:#6b7280;flex:1}
.port-list{display:flex;flex-direction:column;gap:0.4rem;max-height:280px;overflow-y:auto}
.port-row{display:flex;align-items:center;gap:0.4rem}
.port-idx{font-size:0.75rem;color:#9ca3af;min-width:20px;text-align:right}
.port-input{flex:1;padding:0.3rem 0.5rem;border:1.5px solid #e2e8f0;border-radius:6px;font-size:0.8rem}
.port-speed{padding:0.3rem 0.4rem;border:1.5px solid #e2e8f0;border-radius:6px;font-size:0.78rem}
.port-desc{flex:1.5}
.port-del{background:none;border:none;color:#ef4444;cursor:pointer;font-size:1rem;padding:0 0.3rem}
.port-empty{text-align:center;color:#9ca3af;font-size:0.82rem;padding:1rem}
.cmdb-filter-bar{display:flex;gap:0.75rem;padding:0.75rem 1rem;border-bottom:1px solid #e5e7eb}
.cmdb-search{flex:1;padding:0.45rem 0.75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:0.85rem}
.cmdb-table{width:100%;border-collapse:collapse;font-size:0.8rem}
.cmdb-table th{padding:0.5rem 0.75rem;background:#f8fafc;font-weight:600;color:#374151;text-align:left;border-bottom:1px solid #e5e7eb;white-space:nowrap}
.cmdb-table td{padding:0.45rem 0.75rem;border-bottom:1px solid #f1f5f9;color:#374151}
.cmdb-row{cursor:pointer;transition:background 0.1s}
.cmdb-row:hover{background:#f0f9ff}
.cmdb-name{font-weight:600;color:#1d4ed8}
.mono{font-family:monospace;font-size:0.75rem}
.type-badge{padding:0.15rem 0.5rem;border-radius:4px;font-size:0.72rem;font-weight:600}
.type-compute{background:#dbeafe;color:#1d4ed8}.type-gpu{background:#ede9fe;color:#6d28d9}
.type-storage{background:#d1fae5;color:#065f46}.type-switch{background:#e2e8f0;color:#334155}
.empty-sm{text-align:center;color:#9ca3af;padding:1.5rem}
.btn-pri{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;padding:0.5rem 1.1rem;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem}
.btn-sec{background:#f3f4f6;color:#374151;border:none;padding:0.5rem 1.1rem;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem}
.btn-ghost{background:none;border:1.5px solid #e2e8f0;color:#374151;padding:0.5rem 1rem;border-radius:8px;cursor:pointer;font-size:0.85rem}
.btn-ghost:hover{background:#f3f4f6}
.btn-sm{padding:0.3rem 0.7rem;font-size:0.78rem}
.btn-sec:disabled,.btn-pri:disabled{opacity:0.5;cursor:not-allowed}
</style>

