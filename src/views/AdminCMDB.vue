<template>
  <div class="cmdb-page">
    <div class="page-header">
      <h3>🖥️ 主机资产 (CMDB)</h3>
      <div class="header-actions">
        <button class="btn-secondary" @click="downloadTemplate">⬇️ 下载模板</button>
        <label class="btn-import">
          📥 导入 Excel
          <input type="file" accept=".xlsx,.xls" @change="handleImport" style="display:none" ref="fileInput" />
        </label>
        <button class="btn-secondary" @click="exportHosts">📤 导出</button>
        <button class="btn-sync" @click="syncToRack" :disabled="syncing" title="将有机柜信息的主机同步到机柜图">
          {{ syncing ? '同步中...' : '🗄️ 同步到机柜图' }}
        </button>
        <button class="btn-primary" @click="openCreate">➕ 新增主机</button>
      </div>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <input v-model="filters.q" placeholder="🔍 搜索主机名/IP/机柜..." class="filter-input" @input="loadHosts" />
      <select v-model="filters.role" class="filter-select" @change="loadHosts">
        <option value="">全部角色</option>
        <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
      </select>
      <select v-model="filters.status" class="filter-select" @change="loadHosts">
        <option value="">全部状态</option>
        <option value="online">在线</option>
        <option value="offline">离线</option>
        <option value="maintenance">维护中</option>
      </select>
      <button class="btn-secondary" @click="resetFilters">🔄 重置</button>
      <span class="total-badge">共 {{ hosts.length }} 台</span>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card" v-for="s in stats" :key="s.label" :class="s.cls">
        <div class="stat-num">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- 表格 -->
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="table-wrap">
      <table class="host-table">
        <thead>
          <tr>
            <th>主机名</th>
            <th>IP 地址</th>
            <th>操作系统</th>
            <th>CPU</th>
            <th>内存</th>
            <th>角色</th>
            <th>机柜</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in hosts" :key="h.id" @click="viewHost(h)" class="host-row">
            <td class="hostname-cell">{{ h.hostname }}</td>
            <td class="ip-cell">
              <span v-for="ip in h.ips" :key="ip.address" class="ip-tag" :title="ip.type">
                {{ ip.address }}
              </span>
            </td>
            <td>{{ h.os || '-' }}</td>
            <td class="cpu-cell">
              <span v-if="h.cpu_cores">{{ h.cpu_cores }}核</span>
              <span v-if="h.cpu_model" class="cpu-model" :title="h.cpu_model">{{ shortCPU(h.cpu_model) }}</span>
            </td>
            <td>{{ h.memory_gb ? h.memory_gb + 'GB' : '-' }}</td>
            <td><span class="role-badge" :class="roleClass(h.role)">{{ h.role || '-' }}</span></td>
            <td>{{ h.rack || '-' }}{{ h.rack_unit ? ' ' + h.rack_unit : '' }}</td>
            <td><span class="status-dot" :class="'status-' + h.status" :title="statusLabel(h.status)"></span> {{ statusLabel(h.status) }}</td>
            <td @click.stop>
              <button class="btn-link" @click="openEdit(h)">✏️</button>
              <button class="btn-link danger" @click="confirmDelete(h)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="hosts.length === 0" class="empty-state">暂无主机数据，请导入 Excel 或手动添加</div>
    </div>

    <!-- 导入结果提示 -->
    <div v-if="importMsg" class="import-msg" :class="importMsg.type">{{ importMsg.text }}</div>
  </div>

  <!-- 详情/编辑弹窗 -->
  <Teleport to="body">
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editMode ? '编辑主机' : (viewMode ? '主机详情' : '新增主机') }}</h3>
          <button class="btn-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>主机名 *</label>
              <input v-model="form.hostname" :disabled="viewMode" placeholder="cn001" />
            </div>
            <div class="form-group">
              <label>操作系统</label>
              <input v-model="form.os" :disabled="viewMode" placeholder="CentOS 7.9" />
            </div>
            <div class="form-group full">
              <label>IP 地址列表</label>
              <div class="ip-list">
                <div v-for="(ip, i) in form.ips" :key="i" class="ip-row">
                  <input v-model="ip.address" :disabled="viewMode" placeholder="192.168.1.1" class="ip-input" />
                  <input v-model="ip.type" :disabled="viewMode" placeholder="业务口" class="ip-type-input" />
                  <button v-if="!viewMode" class="btn-rm" @click="form.ips.splice(i,1)">×</button>
                </div>
                <button v-if="!viewMode" class="btn-add-ip" @click="form.ips.push({address:'',type:'业务口'})">+ 添加 IP</button>
              </div>
            </div>
            <div class="form-group">
              <label>CPU 型号</label>
              <input v-model="form.cpu_model" :disabled="viewMode" placeholder="Intel Xeon Gold 6248R" />
            </div>
            <div class="form-group">
              <label>CPU 核数</label>
              <input v-model.number="form.cpu_cores" :disabled="viewMode" type="number" placeholder="40" />
            </div>
            <div class="form-group">
              <label>内存 (GB)</label>
              <input v-model.number="form.memory_gb" :disabled="viewMode" type="number" placeholder="256" />
            </div>
            <div class="form-group">
              <label>磁盘描述</label>
              <input v-model="form.disk_desc" :disabled="viewMode" placeholder="2×960GB SSD" />
            </div>
            <div class="form-group">
              <label>角色/用途</label>
              <select v-model="form.role" :disabled="viewMode">
                <option value="">请选择</option>
                <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>状态</label>
              <select v-model="form.status" :disabled="viewMode">
                <option value="online">在线</option>
                <option value="offline">离线</option>
                <option value="maintenance">维护中</option>
              </select>
            </div>
            <div class="form-group">
              <label>机柜编号</label>
              <input v-model="form.rack" :disabled="viewMode" placeholder="A01" />
            </div>
            <div class="form-group">
              <label>机柜位置</label>
              <input v-model="form.rack_unit" :disabled="viewMode" placeholder="U12-U13" />
            </div>
            <div class="form-group">
              <label>厂商</label>
              <input v-model="form.vendor" :disabled="viewMode" placeholder="浪潮" />
            </div>
            <div class="form-group">
              <label>服务器型号</label>
              <input v-model="form.model" :disabled="viewMode" placeholder="NF5280M6" />
            </div>
            <div class="form-group">
              <label>序列号</label>
              <input v-model="form.sn" :disabled="viewMode" placeholder="SN123456" />
            </div>
            <div class="form-group">
              <label>采购日期</label>
              <input v-model="form.purchase_date" :disabled="viewMode" type="date" />
            </div>
            <div class="form-group">
              <label>保修到期</label>
              <input v-model="form.warranty_date" :disabled="viewMode" type="date" />
            </div>
            <div class="form-group full">
              <label>备注</label>
              <textarea v-model="form.remark" :disabled="viewMode" rows="2" placeholder="备注信息"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer" v-if="!viewMode">
          <button class="btn-secondary" @click="showModal = false">取消</button>
          <button class="btn-primary" @click="saveHost" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
        <div class="modal-footer" v-else>
          <button class="btn-secondary" @click="showModal = false">关闭</button>
          <button class="btn-primary" @click="viewMode = false; editMode = true">编辑</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import notification from '../utils/notification'

const ROLES = ['登录节点', '计算节点', 'GPU节点', '存储节点', '管理节点', '监控节点', '网络设备', '其他']

const hosts = ref<any[]>([])
const loading = ref(false)
const showModal = ref(false)
const editMode = ref(false)
const viewMode = ref(false)
const saving = ref(false)
const fileInput = ref<HTMLInputElement>()
const importMsg = ref<{ text: string; type: string } | null>(null)

const filters = ref({ q: '', role: '', status: '' })

const emptyForm = () => ({
  hostname: '', ips: [{ address: '', type: '业务口' }], os: '',
  cpu_model: '', cpu_cores: 0, memory_gb: 0, disk_desc: '',
  role: '', rack: '', rack_unit: '', status: 'online',
  vendor: '', model: '', sn: '', purchase_date: '', warranty_date: '', remark: '',
})
const form = ref<any>(emptyForm())
const editId = ref('')

const stats = computed(() => {
  const all = hosts.value
  return [
    { label: '总主机', value: all.length, cls: '' },
    { label: '在线', value: all.filter(h => h.status === 'online').length, cls: 'stat-ok' },
    { label: '离线', value: all.filter(h => h.status === 'offline').length, cls: all.some(h => h.status === 'offline') ? 'stat-err' : '' },
    { label: '维护中', value: all.filter(h => h.status === 'maintenance').length, cls: 'stat-warn' },
    { label: '计算节点', value: all.filter(h => h.role === '计算节点').length, cls: '' },
    { label: 'GPU节点', value: all.filter(h => h.role === 'GPU节点').length, cls: '' },
  ]
})

async function loadHosts() {
  loading.value = true
  try {
    const params: any = {}
    if (filters.value.q) params.q = filters.value.q
    if (filters.value.role) params.role = filters.value.role
    if (filters.value.status) params.status = filters.value.status
    const res = await axios.get('/cmdb/hosts', { params })
    hosts.value = res.data.data || []
  } catch (e: any) {
    notification.error(e.response?.data?.error || e.message, '加载失败')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.value = { q: '', role: '', status: '' }
  loadHosts()
}

function openCreate() {
  form.value = emptyForm()
  editMode.value = false
  viewMode.value = false
  editId.value = ''
  showModal.value = true
}

function openEdit(h: any) {
  form.value = JSON.parse(JSON.stringify(h))
  if (!form.value.ips?.length) form.value.ips = [{ address: '', type: '业务口' }]
  editMode.value = true
  viewMode.value = false
  editId.value = h.id
  showModal.value = true
}

function viewHost(h: any) {
  form.value = JSON.parse(JSON.stringify(h))
  editMode.value = false
  viewMode.value = true
  editId.value = h.id
  showModal.value = true
}

async function saveHost() {
  if (!form.value.hostname.trim()) {
    notification.error('主机名不能为空')
    return
  }
  saving.value = true
  try {
    const payload = { ...form.value }
    payload.ips = payload.ips.filter((ip: any) => ip.address.trim())
    if (editMode.value) {
      await axios.put(`/cmdb/hosts/${editId.value}`, payload)
      notification.success('更新成功')
    } else {
      await axios.post('/cmdb/hosts', payload)
      notification.success('新增成功')
    }
    showModal.value = false
    loadHosts()
  } catch (e: any) {
    notification.error(e.response?.data?.error || e.message, '保存失败')
  } finally {
    saving.value = false
  }
}

async function confirmDelete(h: any) {
  if (!confirm(`确定删除主机 ${h.hostname}？`)) return
  try {
    await axios.delete(`/cmdb/hosts/${h.id}`)
    notification.success('已删除')
    loadHosts()
  } catch (e: any) {
    notification.error(e.response?.data?.error || e.message, '删除失败')
  }
}

async function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  importMsg.value = null
  try {
    const res = await axios.post('/cmdb/hosts/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    importMsg.value = { text: res.data.message, type: 'msg-ok' }
    loadHosts()
  } catch (e: any) {
    importMsg.value = { text: e.response?.data?.error || '导入失败', type: 'msg-err' }
  } finally {
    if (fileInput.value) fileInput.value.value = ''
    setTimeout(() => { importMsg.value = null }, 5000)
  }
}

const syncing = ref(false)

// 把 CMDB 主机同步到机柜图
async function syncToRack() {
  // 只处理有机柜信息的主机
  const withRack = hosts.value.filter(h => h.rack && h.rack_unit)
  if (withRack.length === 0) {
    notification.error('没有填写机柜信息的主机，请先在主机记录中填写机柜编号和机柜位置')
    return
  }
  if (!confirm(`将把 ${withRack.length} 台有机柜信息的主机同步到机柜图，已存在的设备会更新，确认继续？`)) return

  syncing.value = true
  try {
    // 获取现有机柜列表
    const rackRes = await axios.get('/monitoring/rack')
    const existingRacks: any[] = rackRes.data.data || []

    // 按机柜名分组
    const rackMap = new Map<string, any[]>()
    for (const h of withRack) {
      if (!rackMap.has(h.rack)) rackMap.set(h.rack, [])
      rackMap.get(h.rack)!.push(h)
    }

    let created = 0, updated = 0

    for (const [rackName, rackHosts] of rackMap) {
      // 找或创建机柜
      let rack = existingRacks.find(r => r.name === rackName)
      if (!rack) {
        const res = await axios.post('/monitoring/rack', {
          name: rackName, location: '数据中心', units: 42, devices: []
        })
        rack = res.data.data
        existingRacks.push(rack)
        created++
      }

      const devices: any[] = [...(rack.devices || [])]

      for (const h of rackHosts) {
        // 解析 U 位，如 "U12-U13" → unit=12, height=2；"U5" → unit=5, height=2
        const unitMatch = h.rack_unit.match(/[Uu](\d+)/)
        const unit = unitMatch ? parseInt(unitMatch[1]) : 1
        const unitEndMatch = h.rack_unit.match(/[Uu]\d+-[Uu](\d+)/)
        const unitEnd = unitEndMatch ? parseInt(unitEndMatch[1]) : unit + 1
        const height = Math.max(1, unitEnd - unit + 1)

        // 判断设备类型
        const role = (h.role || '').toLowerCase()
        let devType = 'compute'
        if (role.includes('gpu')) devType = 'gpu'
        else if (role.includes('存储') || role.includes('storage')) devType = 'storage'
        else if (role.includes('交换') || role.includes('switch')) devType = 'switch'
        else if (role.includes('管理') || role.includes('登录')) devType = 'compute'

        // 主 IP
        const mainIP = h.ips?.find((ip: any) => ip.type === '业务口' || ip.type === '管理口')?.address
          || h.ips?.[0]?.address || ''

        const devData = {
          name: h.hostname,
          type: devType,
          unit,
          height,
          ip: mainIP,
          cpu_model: h.cpu_model || '',
          mem_total: h.memory_gb ? h.memory_gb + 'GB' : '',
          os: h.os || '',
          sn: h.sn || '',
          model: h.model || '',
          remark: h.remark || '',
          purchase_date: h.purchase_date || '',
        }

        // 按主机名找已有设备，有则更新，无则新增
        const existIdx = devices.findIndex(d => d.name === h.hostname)
        if (existIdx >= 0) {
          devices[existIdx] = { ...devices[existIdx], ...devData }
          updated++
        } else {
          devices.push({ ...devData, id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
          updated++
        }
      }

      await axios.put(`/monitoring/rack/${rack.id}`, { ...rack, devices })
    }

    notification.success(`同步完成：新建机柜 ${created} 个，更新/新增设备 ${updated} 台`)
  } catch (e: any) {
    notification.error(e.response?.data?.error || e.message, '同步失败')
  } finally {
    syncing.value = false
  }
}

function downloadTemplate() {
  window.open(axios.defaults.baseURL + '/cmdb/hosts/template', '_blank')
}

function exportHosts() {
  window.open(axios.defaults.baseURL + '/cmdb/hosts/export', '_blank')
}

const shortCPU = (s: string) => s.length > 16 ? s.slice(0, 16) + '…' : s
const statusLabel = (s: string) => ({ online: '在线', offline: '离线', maintenance: '维护中' }[s] || s)
const roleClass = (r: string) => ({
  '计算节点': 'role-compute', 'GPU节点': 'role-gpu', '登录节点': 'role-login',
  '存储节点': 'role-storage', '管理节点': 'role-mgmt',
}[r] || '')

onMounted(loadHosts)
</script>

<style scoped>
.cmdb-page { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }

.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h3 { margin: 0; font-size: 1.3rem; }
.header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.filter-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.filter-input { padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; min-width: 220px; outline: none; }
.filter-input:focus { border-color: #94a3b8; }
.filter-select { padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; background: #fff; cursor: pointer; }
.total-badge { margin-left: auto; font-size: 0.82rem; color: #64748b; }

/* 统计卡片 */
.stat-cards { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.6rem 1.2rem; text-align: center; min-width: 80px; }
.stat-card.stat-ok { background: #f0fdf4; border-color: #86efac; }
.stat-card.stat-err { background: #fef2f2; border-color: #fca5a5; }
.stat-card.stat-warn { background: #fffbeb; border-color: #fcd34d; }
.stat-num { font-size: 1.4rem; font-weight: 700; color: #1e293b; }
.stat-label { font-size: 0.7rem; color: #64748b; }

/* 表格 */
.table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.host-table { width: 100%; border-collapse: collapse; min-width: 900px; }
.host-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 0.8rem; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.host-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.83rem; }
.host-row { cursor: pointer; transition: background 0.1s; }
.host-row:hover { background: #f8fafc; }
.hostname-cell { font-weight: 600; font-family: monospace; color: #1e293b; }
.ip-cell { display: flex; flex-wrap: wrap; gap: 4px; }
.ip-tag { background: #eff6ff; color: #1d4ed8; border-radius: 4px; padding: 1px 6px; font-size: 0.75rem; font-family: monospace; white-space: nowrap; }
.cpu-cell { display: flex; flex-direction: column; gap: 2px; }
.cpu-model { font-size: 0.72rem; color: #64748b; }

.status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
.status-online { background: #22c55e; }
.status-offline { background: #ef4444; }
.status-maintenance { background: #f59e0b; }

.role-badge { padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 500; background: #e2e8f0; color: #475569; }
.role-compute { background: #dbeafe; color: #1e40af; }
.role-gpu { background: #fae8ff; color: #7e22ce; }
.role-login { background: #dcfce7; color: #166534; }
.role-storage { background: #fef3c7; color: #92400e; }
.role-mgmt { background: #fee2e2; color: #991b1b; }

.empty-state { text-align: center; padding: 3rem; color: #94a3b8; font-size: 0.9rem; }
.loading { text-align: center; padding: 2rem; color: #64748b; }

.import-msg { padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; }
.msg-ok { background: #f0fdf4; color: #166534; border: 1px solid #86efac; }
.msg-err { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }

/* 按钮 */
.btn-primary { background: #fff; color: #1e293b; border: 1px solid #e2e8f0; padding: 7px 16px; border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.15s; }
.btn-primary:hover:not(:disabled) { background: #f1f5f9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: #fff; color: #1e293b; border: 1px solid #e2e8f0; padding: 7px 14px; border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 500; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.15s; }
.btn-secondary:hover { background: #f1f5f9; }
.btn-import { background: #f0fdf4; color: #166534; border: 1px solid #86efac; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.btn-import:hover { background: #dcfce7; }
.btn-sync { background: #eff6ff; color: #1d4ed8; border: 1px solid #93c5fd; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.btn-sync:hover:not(:disabled) { background: #dbeafe; }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-link { background: none; border: none; cursor: pointer; font-size: 1rem; padding: 2px 6px; border-radius: 4px; }
.btn-link:hover { background: #f1f5f9; }
.btn-link.danger:hover { background: #fef2f2; }

/* 弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 14px; width: 90%; max-width: 760px; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
.modal-header h3 { margin: 0; font-size: 1.05rem; }
.btn-close { background: none; border: none; font-size: 1.6rem; cursor: pointer; color: #94a3b8; line-height: 1; }
.modal-body { padding: 1.5rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group.full { grid-column: 1 / -1; }
.form-group label { font-size: 0.78rem; font-weight: 600; color: #475569; }
.form-group input, .form-group select, .form-group textarea {
  padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 7px;
  font-size: 0.83rem; outline: none; font-family: inherit;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #94a3b8; box-shadow: 0 0 0 2px rgba(0,0,0,0.08); }
.form-group input:disabled, .form-group select:disabled, .form-group textarea:disabled { background: #f8fafc; color: #64748b; }

.ip-list { display: flex; flex-direction: column; gap: 6px; }
.ip-row { display: flex; gap: 6px; align-items: center; }
.ip-input { flex: 2; }
.ip-type-input { flex: 1; }
.btn-rm { background: #fef2f2; border: 1px solid #fca5a5; color: #ef4444; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 0.85rem; }
.btn-add-ip { background: #eff6ff; border: 1px dashed #93c5fd; color: #1d4ed8; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 0.82rem; width: fit-content; }
.btn-add-ip:hover { background: #dbeafe; }
</style>
