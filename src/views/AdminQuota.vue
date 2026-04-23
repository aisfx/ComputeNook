<template>
  <div class="quota-page">
    <div class="page-header">
      <h3>💾 存储配额管理</h3>
      <div class="header-actions">
        <button class="btn-secondary" @click="loadAll" :disabled="loading">🔄 刷新</button>
        <button class="btn-primary" @click="openSet()">⚙️ 设置配额</button>
      </div>
    </div>

    <!-- 配置提示 -->
    <div v-if="configError" class="config-warn">
      ⚠️ {{ configError }}
      <span class="config-hint">请在 .env 中配置 <code>QUOTA_FS_TYPE</code> 和 <code>QUOTA_PATH</code></span>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-cards" v-if="quotaList.length">
      <div class="stat-card">
        <div class="stat-num">{{ quotaList.length }}</div>
        <div class="stat-label">用户总数</div>
      </div>
      <div class="stat-card stat-warn">
        <div class="stat-num">{{ quotaList.filter(q => usagePct(q) >= 90).length }}</div>
        <div class="stat-label">超限用户 (≥90%)</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ formatSize(quotaList.reduce((s, q) => s + (q.quotas?.[0]?.block_used_kb || 0), 0)) }}</div>
        <div class="stat-label">总已用空间</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ formatSize(quotaList.reduce((s, q) => s + (q.quotas?.[0]?.block_hard_kb || 0), 0)) }}</div>
        <div class="stat-label">总配额上限</div>
      </div>
    </div>

    <!-- 过滤 -->
    <div class="filter-bar">
      <input v-model="search" placeholder="🔍 搜索用户名..." class="filter-input" />
      <select v-model="filterStatus" class="filter-select">
        <option value="">全部状态</option>
        <option value="warn">警告 (≥75%)</option>
        <option value="crit">超限 (≥90%)</option>
        <option value="ok">正常</option>
        <option value="noset">未设置</option>
      </select>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!quotaList.length" class="empty">
      暂无配额数据。请确认 QUOTA_FS_TYPE 和 QUOTA_PATH 已配置，且后端有权限执行 quota 命令。
    </div>
    <div v-else class="table-wrap">
      <table class="quota-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>文件系统</th>
            <th>已用空间</th>
            <th>软限制</th>
            <th>硬限制</th>
            <th>使用率</th>
            <th>已用文件数</th>
            <th>文件硬限</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filtered" :key="item.username"
            :class="{ 'row-crit': usagePct(item) >= 90, 'row-warn': usagePct(item) >= 75 && usagePct(item) < 90 }">
            <td class="user-cell">{{ item.username }}</td>
            <td class="fs-cell">
              <span v-if="item.quotas?.[0]">
                <code>{{ item.quotas[0].filesystem }}</code>
                <span class="fs-type">{{ item.quotas[0].type }}</span>
              </span>
              <span v-else class="no-data">-</span>
            </td>
            <td>{{ item.quotas?.[0] ? formatSize(item.quotas[0].block_used_kb) : '-' }}</td>
            <td>{{ item.quotas?.[0]?.block_soft_kb ? formatSize(item.quotas[0].block_soft_kb) : '无' }}</td>
            <td>{{ item.quotas?.[0]?.block_hard_kb ? formatSize(item.quotas[0].block_hard_kb) : '无限制' }}</td>
            <td>
              <div v-if="item.quotas?.[0]?.block_hard_kb" class="usage-cell">
                <div class="prog-bg">
                  <div class="prog-fill" :style="{ width: usagePct(item) + '%' }"
                    :class="usagePct(item) >= 90 ? 'fill-crit' : usagePct(item) >= 75 ? 'fill-warn' : 'fill-ok'">
                  </div>
                </div>
                <span class="pct-text" :class="usagePct(item) >= 90 ? 'text-crit' : usagePct(item) >= 75 ? 'text-warn' : ''">
                  {{ usagePct(item) }}%
                </span>
              </div>
              <span v-else class="no-data">未设置</span>
            </td>
            <td>{{ item.quotas?.[0]?.inode_used?.toLocaleString() || '-' }}</td>
            <td>{{ item.quotas?.[0]?.inode_hard ? item.quotas[0].inode_hard.toLocaleString() : '无限制' }}</td>
            <td>
              <button class="btn-link" @click="openSet(item.username, item.quotas?.[0])">⚙️ 设置</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- 设置配额弹窗 -->
  <Teleport to="body">
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>⚙️ 设置存储配额</h3>
          <button class="btn-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>用户名 *</label>
            <input v-model="form.username" placeholder="输入用户名" :disabled="!!form._prefill" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>空间软限制</label>
              <div class="input-unit">
                <input v-model.number="form.blockSoftGB" type="number" min="0" placeholder="0" />
                <span class="unit">GB</span>
              </div>
              <div class="form-hint">超过软限制后有宽限期</div>
            </div>
            <div class="form-group">
              <label>空间硬限制 *</label>
              <div class="input-unit">
                <input v-model.number="form.blockHardGB" type="number" min="0" placeholder="100" />
                <span class="unit">GB</span>
              </div>
              <div class="form-hint">0 = 无限制</div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>文件数软限制</label>
              <input v-model.number="form.inodeSoft" type="number" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label>文件数硬限制</label>
              <input v-model.number="form.inodeHard" type="number" min="0" placeholder="0" />
              <div class="form-hint">0 = 无限制</div>
            </div>
          </div>
          <div class="preset-bar">
            <span class="preset-label">快速预设：</span>
            <button class="preset-btn" @click="applyPreset(50)">50GB</button>
            <button class="preset-btn" @click="applyPreset(100)">100GB</button>
            <button class="preset-btn" @click="applyPreset(200)">200GB</button>
            <button class="preset-btn" @click="applyPreset(500)">500GB</button>
            <button class="preset-btn" @click="applyPreset(1024)">1TB</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showModal = false">取消</button>
          <button class="btn-primary" @click="submitQuota" :disabled="saving">
            {{ saving ? '设置中...' : '确认设置' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import notification from '../utils/notification'

const loading = ref(false)
const saving = ref(false)
const search = ref('')
const filterStatus = ref('')
const configError = ref('')
const quotaList = ref<any[]>([])
const showModal = ref(false)

const form = ref({ username: '', blockSoftGB: 0, blockHardGB: 100, inodeSoft: 0, inodeHard: 0, _prefill: false })

const usagePct = (item: any) => {
  const q = item.quotas?.[0]
  if (!q || !q.block_hard_kb) return 0
  return Math.min(100, Math.round((q.block_used_kb / q.block_hard_kb) * 100))
}

const formatSize = (kb: number) => {
  if (!kb) return '0'
  if (kb >= 1024 * 1024 * 1024) return (kb / 1024 / 1024 / 1024).toFixed(1) + ' TB'
  if (kb >= 1024 * 1024) return (kb / 1024 / 1024).toFixed(1) + ' GB'
  if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB'
  return kb + ' KB'
}

const filtered = computed(() => {
  let list = quotaList.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(i => i.username.toLowerCase().includes(q))
  }
  if (filterStatus.value === 'crit') list = list.filter(i => usagePct(i) >= 90)
  else if (filterStatus.value === 'warn') list = list.filter(i => usagePct(i) >= 75 && usagePct(i) < 90)
  else if (filterStatus.value === 'ok') list = list.filter(i => usagePct(i) < 75 && i.quotas?.[0]?.block_hard_kb)
  else if (filterStatus.value === 'noset') list = list.filter(i => !i.quotas?.[0]?.block_hard_kb)
  return list
})

async function loadAll() {
  loading.value = true
  configError.value = ''
  try {
    const res = await axios.get('/files/quota/all')
    quotaList.value = res.data.data || []
    // 检查是否有配置错误
    const errItem = quotaList.value.find(i => i.error)
    if (errItem) configError.value = errItem.error
  } catch (e: any) {
    const msg = e.response?.data?.error || e.message
    if (msg.includes('QUOTA_FS_TYPE') || msg.includes('文件系统')) {
      configError.value = msg
    } else {
      notification.error(msg, '加载失败')
    }
  } finally {
    loading.value = false
  }
}

function openSet(username = '', quota?: any) {
  form.value = {
    username,
    blockSoftGB: quota?.block_soft_kb ? Math.round(quota.block_soft_kb / 1024 / 1024) : 0,
    blockHardGB: quota?.block_hard_kb ? Math.round(quota.block_hard_kb / 1024 / 1024) : 100,
    inodeSoft: quota?.inode_soft || 0,
    inodeHard: quota?.inode_hard || 0,
    _prefill: !!username,
  }
  showModal.value = true
}

function applyPreset(gb: number) {
  form.value.blockHardGB = gb
  form.value.blockSoftGB = Math.round(gb * 0.9)
}

async function submitQuota() {
  if (!form.value.username.trim()) {
    notification.error('请输入用户名')
    return
  }
  saving.value = true
  try {
    await axios.post('/files/quota', {
      username: form.value.username,
      block_hard_kb: form.value.blockHardGB * 1024 * 1024,
      block_soft_kb: form.value.blockSoftGB * 1024 * 1024,
      inode_hard: form.value.inodeHard,
      inode_soft: form.value.inodeSoft,
    })
    notification.success(`用户 ${form.value.username} 配额设置成功`)
    showModal.value = false
    loadAll()
  } catch (e: any) {
    notification.error(e.response?.data?.error || e.message, '设置失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.quota-page { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h3 { margin: 0; font-size: 1.3rem; }
.header-actions { display: flex; gap: 0.5rem; }

.config-warn { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 10px 14px; font-size: 0.85rem; color: #92400e; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.config-hint { color: #6b7280; }
.config-hint code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 0.82rem; }

.stat-cards { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.6rem 1.2rem; text-align: center; min-width: 100px; }
.stat-card.stat-warn { background: #fef2f2; border-color: #fca5a5; }
.stat-num { font-size: 1.4rem; font-weight: 700; color: #1e293b; }
.stat-label { font-size: 0.7rem; color: #64748b; }

.filter-bar { display: flex; gap: 0.5rem; }
.filter-input { padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; min-width: 200px; outline: none; }
.filter-input:focus { border-color: #667eea; }
.filter-select { padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; background: #fff; }

.loading { text-align: center; padding: 2rem; color: #64748b; }
.empty { text-align: center; padding: 3rem; color: #94a3b8; font-size: 0.9rem; background: #f8fafc; border-radius: 10px; border: 1px dashed #e2e8f0; }

.table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.quota-table { width: 100%; border-collapse: collapse; min-width: 900px; }
.quota-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 0.8rem; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.quota-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.83rem; }
.row-warn { background: #fffbeb; }
.row-crit { background: #fef2f2; }
.user-cell { font-weight: 600; font-family: monospace; }
.fs-cell { display: flex; align-items: center; gap: 6px; }
.fs-type { font-size: 0.7rem; background: #e0e7ff; color: #4338ca; padding: 1px 6px; border-radius: 10px; }
.no-data { color: #94a3b8; }

.usage-cell { display: flex; align-items: center; gap: 8px; }
.prog-bg { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; min-width: 80px; }
.prog-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.fill-ok { background: #22c55e; }
.fill-warn { background: #f59e0b; }
.fill-crit { background: #ef4444; }
.pct-text { font-size: 0.78rem; font-weight: 600; color: #475569; width: 36px; }
.text-warn { color: #d97706; }
.text-crit { color: #dc2626; }

.btn-link { background: none; border: none; cursor: pointer; color: #667eea; font-size: 0.82rem; padding: 2px 6px; border-radius: 4px; }
.btn-link:hover { background: #eff6ff; }
.btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; padding: 7px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: #f1f5f9; color: #374151; border: 1px solid #e2e8f0; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
.btn-secondary:hover:not(:disabled) { background: #e2e8f0; }

/* 弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 14px; width: 90%; max-width: 480px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
.modal-header h3 { margin: 0; font-size: 1rem; }
.btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8; }
.modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; }

.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 0.78rem; font-weight: 600; color: #475569; }
.form-group input { padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 7px; font-size: 0.83rem; outline: none; }
.form-group input:focus { border-color: #667eea; }
.form-group input:disabled { background: #f8fafc; color: #64748b; }
.form-hint { font-size: 0.72rem; color: #94a3b8; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.input-unit { display: flex; align-items: center; border: 1px solid #e2e8f0; border-radius: 7px; overflow: hidden; }
.input-unit input { border: none; flex: 1; padding: 7px 10px; font-size: 0.83rem; outline: none; }
.unit { padding: 0 10px; background: #f8fafc; color: #64748b; font-size: 0.82rem; border-left: 1px solid #e2e8f0; white-space: nowrap; }

.preset-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.preset-label { font-size: 0.78rem; color: #64748b; }
.preset-btn { padding: 3px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.78rem; background: #f8fafc; cursor: pointer; }
.preset-btn:hover { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }
</style>
