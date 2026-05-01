<template>
  <div class="quota-page">
    <div class="page-header">
      <div>
        <h3>存储配额管理</h3>
        <p class="page-desc">监控和管理用户磁盘配额使用情况</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="loadAll" :disabled="loading">🔄 刷新</button>
        <button class="btn btn-primary" @click="openSet()">⚙️ 设置配额</button>
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
    <div v-if="showModal" class="modal-overlay">
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
          <button class="btn btn-secondary" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="submitQuota" :disabled="saving">
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
.quota-page { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.page-desc { margin: 3px 0 0; color: hsl(var(--muted-foreground)); font-size: 0.82rem; }
.header-actions { display: flex; gap: 0.5rem; }

.config-warn {
  background: #fffbeb; border: 1px solid #fcd34d;
  border-radius: 10px; padding: 10px 14px; font-size: 0.85rem; color: #92400e;
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
}
.config-hint { color: #78716c; }
.config-hint code { background: #fef3c7; padding: 1px 5px; border-radius: 3px; font-size: 0.82rem; }

/* 统计卡片 */
.stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
.stat-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  padding: 1rem 1.25rem;
  position: relative; overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}
.stat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 14px 14px 0 0;
}
.stat-card.stat-warn::before { background: linear-gradient(90deg, #ef4444, #f97316); }
.stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
.stat-num { font-size: 1.6rem; font-weight: 700; color: hsl(var(--foreground)); line-height: 1.2; }
.stat-label { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin-top: 4px; font-weight: 500; }

/* 过滤栏 */
.filter-bar {
  display: flex; gap: 0.6rem; align-items: center;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 12px; padding: 0.6rem 0.9rem;
}
.filter-input {
  padding: 6px 12px; border: 1.5px solid hsl(var(--border)); border-radius: 8px;
  font-size: 0.85rem; min-width: 200px; outline: none;
  background: hsl(var(--background)); color: hsl(var(--foreground));
  transition: border-color 0.15s, box-shadow 0.15s;
}
.filter-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.filter-select {
  padding: 6px 10px; border: 1.5px solid hsl(var(--border)); border-radius: 8px;
  font-size: 0.85rem; background: hsl(var(--background)); color: hsl(var(--foreground));
  outline: none; cursor: pointer;
}
.filter-select:focus { border-color: #6366f1; }

.empty {
  text-align: center; padding: 3rem; color: hsl(var(--muted-foreground)); font-size: 0.9rem;
  background: hsl(var(--muted)/0.3); border-radius: 12px; border: 1px dashed hsl(var(--border));
}

/* 表格 */
.table-wrap {
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 1px 6px rgba(0,0,0,0.04);
}
.quota-table { width: 100%; border-collapse: collapse; min-width: 900px; }
.quota-table th {
  background: hsl(var(--muted)/0.4); padding: 11px 14px; text-align: left;
  font-size: 0.75rem; font-weight: 600; color: hsl(var(--muted-foreground));
  border-bottom: 1px solid hsl(var(--border)); white-space: nowrap;
  letter-spacing: 0.03em; text-transform: uppercase;
}
.quota-table td {
  padding: 11px 14px; border-bottom: 1px solid hsl(var(--border));
  font-size: 0.84rem; color: hsl(var(--foreground));
}
.quota-table tbody tr:last-child td { border-bottom: none; }
.quota-table tbody tr:hover { background: hsl(var(--muted)/0.25); }
.row-warn td:first-child { border-left: 3px solid #f59e0b; }
.row-crit td:first-child { border-left: 3px solid #ef4444; }
.user-cell { font-weight: 700; font-family: monospace; font-size: 0.85rem; color: hsl(var(--foreground)); }
.fs-cell { display: flex; align-items: center; gap: 6px; }
.fs-type {
  font-size: 0.68rem; background: rgba(99,102,241,0.1); color: #6366f1;
  padding: 1px 7px; border-radius: 999px; font-weight: 600;
}
.no-data { color: hsl(var(--muted-foreground)); }

.usage-cell { display: flex; align-items: center; gap: 8px; }
.prog-bg { flex: 1; height: 6px; background: hsl(var(--border)); border-radius: 999px; overflow: hidden; min-width: 80px; }
.prog-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
.fill-ok   { background: linear-gradient(90deg, #10b981, #34d399); }
.fill-warn { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.fill-crit { background: linear-gradient(90deg, #ef4444, #f97316); }
.pct-text { font-size: 0.78rem; font-weight: 700; color: hsl(var(--muted-foreground)); width: 38px; text-align: right; }
.text-warn { color: #d97706; }
.text-crit { color: #dc2626; }

/* 弹窗 */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(15,23,42,0.55);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
  animation: ov-in 0.15s ease;
}
@keyframes ov-in { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  border-radius: 18px; width: 92%; max-width: 500px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.15);
  animation: modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes modal-in { from { opacity:0; transform:scale(0.94) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.3rem 1.6rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
}
.modal-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: hsl(var(--foreground)); }
.btn-close {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: hsl(var(--muted)); border: none; border-radius: 8px;
  font-size: 1rem; cursor: pointer; color: hsl(var(--muted-foreground)); transition: all 0.15s;
}
.btn-close:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
.modal-body { padding: 1.4rem 1.6rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 0.75rem;
  padding: 1rem 1.6rem; border-top: 1px solid hsl(var(--border));
}

.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group label { font-size: 0.78rem; font-weight: 600; color: hsl(var(--foreground)); }
.form-group input, .form-group select, .form-group textarea {
  padding: 8px 11px; border: 1.5px solid hsl(var(--border)); border-radius: 9px;
  font-size: 0.85rem; outline: none;
  background: hsl(var(--background)); color: hsl(var(--foreground));
  transition: border-color 0.15s, box-shadow 0.15s;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
  border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
}
.form-group input:disabled { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }
.form-hint { font-size: 0.72rem; color: hsl(var(--muted-foreground)); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.input-unit {
  display: flex; align-items: center;
  border: 1.5px solid hsl(var(--border)); border-radius: 9px; overflow: hidden;
  background: hsl(var(--background));
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input-unit:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
.input-unit input { border: none; flex: 1; padding: 8px 11px; font-size: 0.85rem; outline: none; background: transparent; color: hsl(var(--foreground)); }
.unit {
  padding: 0 12px; background: hsl(var(--muted)); color: hsl(var(--muted-foreground));
  font-size: 0.82rem; border-left: 1px solid hsl(var(--border)); white-space: nowrap;
  font-weight: 500;
}

.preset-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 0.5rem 0.75rem; background: hsl(var(--muted)/0.3); border-radius: 9px; }
.preset-label { font-size: 0.75rem; color: hsl(var(--muted-foreground)); font-weight: 500; }
.preset-btn {
  padding: 4px 12px; border: 1.5px solid hsl(var(--border)); border-radius: 999px;
  font-size: 0.76rem; font-weight: 600;
  background: hsl(var(--background)); cursor: pointer;
  color: hsl(var(--foreground)); transition: all 0.15s;
}
.preset-btn:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.4); color: #6366f1; }

/* 通用按钮 */
.btn { padding: 7px 16px; border-radius: 9px; font-size: 0.84rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
.btn-secondary { background: hsl(var(--muted)); color: hsl(var(--foreground)); border: 1.5px solid hsl(var(--border)); }
.btn-secondary:hover { background: hsl(var(--accent)); }
.btn-link { background: none; border: none; font-size: 0.8rem; cursor: pointer; color: #6366f1; padding: 3px 8px; border-radius: 6px; transition: background 0.15s; }
.btn-link:hover { background: rgba(99,102,241,0.08); }
</style>
