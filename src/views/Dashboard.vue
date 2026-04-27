<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#667eea,#764ba2)">
          <span>🖥️</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">计算节点</div>
          <div class="stat-value">{{ stats.nodes }}</div>
          <div class="stat-detail">在线: {{ stats.nodesOnline }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#f093fb,#f5576c)">
          <span>⚙️</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">CPU 核心</div>
          <div class="stat-value">{{ stats.cpuCores }}</div>
          <div class="stat-detail">使用率: {{ stats.cpuUsage }}%</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#4facfe,#00f2fe)">
          <span>🎮</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">GPU 卡数</div>
          <div class="stat-value">{{ stats.gpuCards }}</div>
          <div class="stat-detail">使用中: {{ stats.gpuInUse }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap" style="background: linear-gradient(135deg,#43e97b,#38f9d7)">
          <span>💾</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">内存总量</div>
          <div class="stat-value">{{ formatMemory(stats.memory) }}</div>
          <div class="stat-detail">可用: {{ formatMemory(stats.memoryFree) }}</div>
        </div>
      </div>
    </div>

    <!-- 三图表行 -->
    <div class="charts-row">
      <!-- 作业统计 -->
      <div class="card chart-card">
        <div class="chart-card-header">
          <h3>📊 作业统计</h3>
          <button class="btn-link-sm" @click="showJobHistory = true">历史记录 →</button>
        </div>
        <div class="chart-body">
          <div class="donut-wrap">
            <svg viewBox="0 0 200 200" class="donut-svg">
              <circle cx="100" cy="100" r="70" fill="none" stroke="#f3f4f6" stroke-width="32"/>
              <circle v-if="jobStats.completed > 0" cx="100" cy="100" r="70" fill="none"
                stroke="#10b981" stroke-width="32"
                :stroke-dasharray="`${jobStatsPercentages.completed * 4.4} 440`"
                :stroke-dashoffset="`${-(jobStatsPercentages.running + jobStatsPercentages.pending) * 4.4}`"
                transform="rotate(-90 100 100)"/>
              <circle v-if="jobStats.pending > 0" cx="100" cy="100" r="70" fill="none"
                stroke="#f59e0b" stroke-width="32"
                :stroke-dasharray="`${jobStatsPercentages.pending * 4.4} 440`"
                :stroke-dashoffset="`${-jobStatsPercentages.running * 4.4}`"
                transform="rotate(-90 100 100)"/>
              <circle v-if="jobStats.running > 0" cx="100" cy="100" r="70" fill="none"
                stroke="#3b82f6" stroke-width="32"
                :stroke-dasharray="`${jobStatsPercentages.running * 4.4} 440`"
                stroke-dashoffset="0"
                transform="rotate(-90 100 100)"/>
              <circle v-if="jobStats.failed > 0" cx="100" cy="100" r="70" fill="none"
                stroke="#ef4444" stroke-width="32"
                :stroke-dasharray="`${jobStatsPercentages.failed * 4.4} 440`"
                :stroke-dashoffset="`${-(jobStatsPercentages.running + jobStatsPercentages.pending + jobStatsPercentages.completed) * 4.4}`"
                transform="rotate(-90 100 100)"/>
              <text x="100" y="93" text-anchor="middle" class="donut-num">{{ jobStatsTotal }}</text>
              <text x="100" y="113" text-anchor="middle" class="donut-lbl">总作业</text>
            </svg>
          </div>
          <div class="legend-list">
            <div class="legend-row" @click="openJobList('RUNNING')" style="cursor:pointer">
              <span class="dot" style="background:#3b82f6"></span>
              <span class="leg-label">运行中</span>
              <span class="leg-val" style="color:#3b82f6">{{ jobStats.running }}</span>
            </div>
            <div class="legend-row" @click="openJobList('PENDING')" style="cursor:pointer">
              <span class="dot" style="background:#f59e0b"></span>
              <span class="leg-label">等待中</span>
              <span class="leg-val" style="color:#f59e0b">{{ jobStats.pending }}</span>
            </div>
            <div class="legend-row" @click="openJobList('COMPLETED')" style="cursor:pointer">
              <span class="dot" style="background:#10b981"></span>
              <span class="leg-label">已完成</span>
              <span class="leg-val" style="color:#10b981">{{ jobStats.completed }}</span>
            </div>
            <div class="legend-row" @click="openJobList('FAILED')" style="cursor:pointer">
              <span class="dot" style="background:#ef4444"></span>
              <span class="leg-label">失败</span>
              <span class="leg-val" style="color:#ef4444">{{ jobStats.failed }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 账户资源配额 -->
      <div class="card chart-card">
        <div class="chart-card-header">
          <h3>🔑 账户配额</h3>
          <select v-if="accountQuotaList.length > 1" v-model="selectedAccountIdx" class="quota-select">
            <option v-for="(a, i) in accountQuotaList" :key="i" :value="i">{{ a.account }}</option>
          </select>
        </div>
        <div class="chart-body" v-if="accountQuotaList.length > 0">
          <div class="donut-wrap">
            <svg viewBox="0 0 200 200" class="donut-svg">
              <circle cx="100" cy="100" r="70" fill="none" stroke="#f3f4f6" stroke-width="32"/>
              <!-- CPU 占比 -->
              <circle cx="100" cy="100" r="70" fill="none"
                :stroke="currentAccountQuota.cpuPct > 90 ? '#ef4444' : currentAccountQuota.cpuPct > 70 ? '#f59e0b' : '#667eea'"
                stroke-width="32"
                :stroke-dasharray="`${currentAccountQuota.cpuPct * 4.4} 440`"
                stroke-dashoffset="0"
                transform="rotate(-90 100 100)"/>
              <text x="100" y="88" text-anchor="middle" class="donut-num" style="font-size:1.6rem">{{ currentAccountQuota.cpuPct }}%</text>
              <text x="100" y="108" text-anchor="middle" class="donut-lbl">CPU 使用</text>
              <text x="100" y="124" text-anchor="middle" style="font-size:0.7rem;fill:#9ca3af">{{ currentAccountQuota.account }}</text>
            </svg>
          </div>
          <div class="legend-list">
            <div class="legend-row">
              <span class="dot" style="background:#667eea"></span>
              <span class="leg-label">CPU 限额</span>
              <span class="leg-val">{{ currentAccountQuota.maxCpus > 0 ? currentAccountQuota.maxCpus + ' 核' : '无限制' }}</span>
            </div>
            <div class="legend-row">
              <span class="dot" style="background:#10b981"></span>
              <span class="leg-label">节点限额</span>
              <span class="leg-val">{{ currentAccountQuota.maxNodes > 0 ? currentAccountQuota.maxNodes + ' 个' : '无限制' }}</span>
            </div>
            <div class="legend-row">
              <span class="dot" style="background:#f59e0b"></span>
              <span class="leg-label">作业上限</span>
              <span class="leg-val">{{ currentAccountQuota.maxJobs > 0 ? currentAccountQuota.maxJobs : '无限制' }}</span>
            </div>
            <div class="legend-row-full">
              <span class="leg-small">分区: {{ currentAccountQuota.partition || '全部' }} · QoS: {{ currentAccountQuota.qos || '-' }}</span>
            </div>
          </div>
        </div>
        <div v-else class="chart-empty">
          <div class="empty-icon">🔑</div>
          <div>暂无账户配额</div>
        </div>
      </div>

      <!-- 机时信息 -->
      <div class="card chart-card">
        <div class="chart-card-header">
          <h3>⏱️ 机时信息</h3>
          <button class="btn-link-sm" @click="showBillingHistory = true" v-if="machineTime.hasLimit">消费记录 →</button>
        </div>
        <div class="chart-body" v-if="machineTime.hasLimit">
          <div class="donut-wrap">
            <svg viewBox="0 0 200 200" class="donut-svg">
              <circle cx="100" cy="100" r="70" fill="none" stroke="#f3f4f6" stroke-width="32"/>
              <circle cx="100" cy="100" r="70" fill="none"
                :stroke="machineTime.usageRate > 90 ? '#ef4444' : machineTime.usageRate > 70 ? '#f59e0b' : '#667eea'"
                stroke-width="32"
                :stroke-dasharray="`${machineTime.usageRate * 4.4} 440`"
                stroke-dashoffset="0"
                transform="rotate(-90 100 100)"/>
              <text x="100" y="93" text-anchor="middle" class="donut-num">{{ machineTime.usageRate < 0.01 && machineTime.usageRate > 0 ? '<0.01' : machineTime.usageRate }}%</text>
              <text x="100" y="113" text-anchor="middle" class="donut-lbl">使用率</text>
            </svg>
          </div>
          <div class="legend-list">
            <div class="legend-row">
              <span class="dot" :style="{ background: machineTime.usageRate > 90 ? '#ef4444' : machineTime.usageRate > 70 ? '#f59e0b' : '#667eea' }"></span>
              <span class="leg-label">已用</span>
              <span class="leg-val">{{ machineTime.used }} 核时</span>
            </div>
            <div class="legend-row">
              <span class="dot" style="background:#10b981"></span>
              <span class="leg-label">剩余</span>
              <span class="leg-val">{{ machineTime.remaining }} 核时</span>
            </div>
            <div class="legend-row-full">
              <span class="leg-small">总配额: {{ machineTime.totalQuota.toLocaleString() }} 核时</span>
            </div>
          </div>
        </div>
        <div v-else class="chart-empty">
          <div class="empty-icon">⏱️</div>
          <div>暂无机时配额</div>
        </div>
      </div>

      <!-- 存储配额 -->
      <div class="card chart-card">
        <div class="chart-card-header">
          <h3>🗄️ 存储配额</h3>
        </div>
        <div class="chart-body">
          <div class="donut-wrap">
            <svg viewBox="0 0 200 200" class="donut-svg">
              <circle cx="100" cy="100" r="70" fill="none" stroke="#f3f4f6" stroke-width="32"/>
              <circle cx="100" cy="100" r="70" fill="none"
                :stroke="storageQuota.capacity.percentage > 90 ? '#ef4444' : storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea'"
                stroke-width="32"
                :stroke-dasharray="`${storageQuota.capacity.percentage * 4.4} 440`"
                stroke-dashoffset="0"
                transform="rotate(-90 100 100)"/>
              <text x="100" y="93" text-anchor="middle" class="donut-num">{{ storageQuota.capacity.percentage }}%</text>
              <text x="100" y="113" text-anchor="middle" class="donut-lbl">已使用</text>
            </svg>
          </div>
          <div class="legend-list">
            <div class="legend-row">
              <span class="dot" :style="{ background: storageQuota.capacity.percentage > 90 ? '#ef4444' : storageQuota.capacity.percentage > 80 ? '#f59e0b' : '#667eea' }"></span>
              <span class="leg-label">已用</span>
              <span class="leg-val">{{ storageQuota.capacity.used }}</span>
            </div>
            <div class="legend-row">
              <span class="dot" style="background:#e5e7eb"></span>
              <span class="leg-label">总量</span>
              <span class="leg-val">{{ storageQuota.capacity.total }}</span>
            </div>
            <div class="legend-row-full">
              <span class="leg-small">文件数: {{ storageQuota.files.used.toLocaleString() }} / {{ storageQuota.files.total.toLocaleString() }} ({{ storageQuota.files.percentage }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 正在运行的作业 -->
    <div class="card">
      <div class="running-jobs-header">
        <h3>▶️ 正在运行的作业</h3>
        <div class="running-jobs-meta">
          <span class="running-count">{{ runningJobs.length }} 个运行中</span>
          <button class="btn-link-sm" @click="loadJobStats" :disabled="jobStatsLoading">
            {{ jobStatsLoading ? '刷新中...' : '🔄 刷新' }}
          </button>
        </div>
      </div>

      <div v-if="runningJobs.length === 0" class="running-empty">
        <span>暂无运行中的作业</span>
      </div>
      <table v-else class="nodes-table">
        <thead>
          <tr>
            <th>作业ID</th>
            <th>作业名</th>
            <th>分区</th>
            <th>节点数</th>
            <th>CPU核</th>
            <th>已运行</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in runningJobs" :key="job.job_id" class="running-job-row">
            <td><code>{{ job.job_id }}</code></td>
            <td>{{ job.name || '-' }}</td>
            <td>{{ job.partition || '-' }}</td>
            <td>{{ job.num_nodes || '-' }}</td>
            <td>{{ job.cpus || '-' }}</td>
            <td>
              <span class="elapsed-badge">{{ formatElapsed(job.run_time) }}</span>
            </td>
            <td>
              <button class="btn-detail" @click="openJobDetail(job)">详情</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 节点状态 -->
    <div class="card">
      <h3>🖥️ 节点状态</h3>
      <table class="nodes-table">
        <thead>
          <tr>
            <th>节点名称</th><th>状态</th><th>CPU 使用率</th><th>内存使用率</th><th>GPU</th><th>运行作业</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in nodes" :key="node.name">
            <td><code>{{ node.name }}</code></td>
            <td><span :class="['status', `status-${node.status}`]">{{ node.statusText }}</span></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: node.cpuUsage + '%' }"></div>
                <span class="progress-text">{{ node.cpuUsage }}%</span>
              </div>
            </td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: node.memUsage + '%' }"></div>
                <span class="progress-text">{{ node.memUsage }}%</span>
              </div>
            </td>
            <td>{{ node.gpu }}</td>
            <td>{{ node.jobs }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 作业历史记录弹窗 -->
    <Teleport to="body">
      <div v-if="showJobHistory" class="modal-overlay" @click.self="showJobHistory = false">
        <div class="modal modal-xl">
          <div class="modal-header">
            <h3>📋 作业历史记录</h3>
            <div class="modal-header-actions">
              <!-- 时间筛选 -->
              <input type="date" v-model="jobStartDate" class="filter-select" title="开始时间" />
              <span style="color:#9ca3af;font-size:0.85rem">至</span>
              <input type="date" v-model="jobEndDate" class="filter-select" title="结束时间" />
              <!-- 状态筛选 -->
              <select v-model="jobHistoryFilter" class="filter-select">
                <option value="">全部状态</option>
                <option value="RUNNING">运行中</option>
                <option value="PENDING">等待中</option>
                <option value="COMPLETED">已完成</option>
                <option value="FAILED">失败</option>
                <option value="CANCELLED">已取消</option>
              </select>
              <button class="btn-query" @click="loadJobHistory">查询</button>
              <button class="btn-export" @click="exportJobExcel" title="导出 Excel">📥 导出</button>
              <button class="btn-close" @click="showJobHistory = false">×</button>
            </div>
          </div>
          <div class="modal-body">
            <div v-if="jobHistoryLoading" class="modal-loading">加载中...</div>
            <table v-else class="data-table">
              <thead>
                <tr>
                  <th>作业ID</th><th>作业名</th><th>提交人</th><th>状态</th><th>分区</th>
                  <th>节点数</th><th>CPU核</th><th>提交时间</th><th>运行时长</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="job in filteredJobHistory" :key="job.job_id" class="clickable-row" @click="openJobDetail(job)">
                  <td><code>{{ job.job_id }}</code></td>
                  <td>{{ job.name || '-' }}</td>
                  <td><span class="user-tag">{{ job.user_id || job.user_name || job.user || '-' }}</span></td>
                  <td><span :class="['state-badge', `state-${(job.job_state||'').toLowerCase()}`]">{{ job.job_state }}</span></td>
                  <td>{{ job.partition || '-' }}</td>
                  <td>{{ job.num_nodes || '-' }}</td>
                  <td>{{ job.cpus || '-' }}</td>
                  <td>{{ formatTime(job.submit_time) }}</td>
                  <td>{{ formatElapsed(job.run_time) }}</td>
                  <td @click.stop>
                    <button class="btn-detail" @click="openJobDetail(job)">详情</button>
                  </td>
                </tr>
                <tr v-if="filteredJobHistory.length === 0">
                  <td colspan="10" class="empty-cell">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 作业详情弹窗 -->
    <JobDetailModal
      v-if="selectedJob"
      :job="selectedJob"
      @close="selectedJob = null"
      @cancel="cancelJob"
      @pause="suspendJob"
      @resume="resumeJob"
      @open-directory="selectedJob = null"
    />

    <!-- 机时消费记录弹窗 -->
    <Teleport to="body">
      <div v-if="showBillingHistory" class="modal-overlay" @click.self="showBillingHistory = false">
        <div class="modal modal-xl">
          <div class="modal-header">
            <h3>💰 机时消费记录</h3>
            <div class="modal-header-actions">
              <input type="date" v-model="billingStartDate" class="filter-select" />
              <span style="color:#9ca3af;font-size:0.85rem">至</span>
              <input type="date" v-model="billingEndDate" class="filter-select" />
              <button class="btn-query" @click="loadBillingHistory">查询</button>
              <button class="btn-export" @click="exportBillingExcel" title="导出 Excel">📥 导出</button>
              <button class="btn-close" @click="showBillingHistory = false">×</button>
            </div>
          </div>
          <div class="modal-body">
            <div v-if="billingLoading" class="modal-loading">加载中...</div>
            <div v-else>
              <!-- 汇总卡片 -->
              <div class="billing-summary">
                <div class="bs-item">
                  <div class="bs-label">总消耗</div>
                  <div class="bs-val" style="color:#667eea">{{ billingTotalMins.toFixed(1) }} 核时</div>
                </div>
                <div class="bs-item">
                  <div class="bs-label">有效作业数</div>
                  <div class="bs-val">{{ billingValidRecords.length }}</div>
                </div>
                <div class="bs-item">
                  <div class="bs-label">CPU 小时</div>
                  <div class="bs-val">{{ billingCpuHours.toFixed(2) }}</div>
                </div>
                <div class="bs-item">
                  <div class="bs-label">GPU 小时</div>
                  <div class="bs-val">{{ billingGpuHours.toFixed(2) }}</div>
                </div>
              </div>

              <!-- 按作业展示，过滤掉 billing=0 -->
              <table class="data-table">
                <thead>
                  <tr>
                    <th>作业ID</th>
                    <th>作业名</th>
                    <th>账户</th>
                    <th>分区</th>
                    <th>QoS</th>
                    <th>状态</th>
                    <th>开始时间</th>
                    <th>运行时长</th>
                    <th>CPU 小时</th>
                    <th>GPU 小时</th>
                    <th>消耗核时</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in billingValidRecords" :key="r.job_id">
                    <td><code>{{ r.job_id || '-' }}</code></td>
                    <td>{{ r.job_name || '-' }}</td>
                    <td>{{ r.account }}</td>
                    <td>{{ r.partition || '-' }}</td>
                    <td>{{ r.qos || '-' }}</td>
                    <td>
                      <span :class="['state-badge', `state-${(r.state||'').toLowerCase()}`]">
                        {{ r.state || '-' }}
                      </span>
                    </td>
                    <td>{{ formatTime(r.start_time) }}</td>
                    <td>{{ formatElapsed(r.elapsed_secs) }}</td>
                    <td>{{ (r.cpu_hours || 0).toFixed(2) }}</td>
                    <td>{{ (r.gpu_hours || 0).toFixed(2) }}</td>
                    <td><strong style="color:#667eea">{{ ((r.billing_mins || 0) || (r.billing_hours || 0) * 60 || (r.cpu_hours || 0) * 60).toFixed(1) }}</strong></td>
                  </tr>
                  <tr v-if="billingValidRecords.length === 0">
                    <td colspan="11" class="empty-cell">暂无消费记录</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getUser, getApiBase } from '../utils/auth'
import axios from 'axios'
import { usageAPI } from '../api'
import JobDetailModal from '../components/JobDetailModal.vue'

const currentUser = ref<any>(null)
const myResources = ref<any>({ associations: [], qos_limits: [] })
const resourcesLoading = ref(false)
const selectedAccountIdx = ref(0)

// 账户资源配额列表（association + qos_limits 合并）
const accountQuotaList = computed(() => {
  const assocs: any[] = myResources.value.associations || []
  const qosList: any[] = myResources.value.qos_limits || []
  // 按 account 去重，同一账户多个分区只保留一条
  const seen = new Set<string>()
  const unique = assocs.filter((a: any) => {
    const key = a.account || '-'
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return unique.map((a: any) => {
    const qosNames: string[] = a.qos_list || (a.qos ? [a.qos] : [])
    const qosInfo = qosList.find((q: any) => qosNames.includes(q.name)) || {}
    const maxCpus = qosInfo.max_cpus || 0
    const usedCpus = runningJobs.value
      .filter((j: any) => !a.account || j.account === a.account)
      .reduce((s: number, j: any) => s + (j.cpus || 0), 0)
    const cpuPct = maxCpus > 0 ? Math.min(100, Math.round(usedCpus / maxCpus * 100)) : 0
    return {
      account: a.account || '-',
      partition: a.partition || '',
      qos: qosNames.join(', '),
      maxCpus,
      maxNodes: qosInfo.max_nodes || 0,
      maxJobs: qosInfo.max_jobs || 0,
      usedCpus,
      cpuPct,
    }
  })
})

const currentAccountQuota = computed(() =>
  accountQuotaList.value[selectedAccountIdx.value] || {
    account: '-', partition: '', qos: '-', maxCpus: 0, maxNodes: 0, maxJobs: 0, usedCpus: 0, cpuPct: 0
  }
)

// ── 作业历史弹窗 ──
const showJobHistory = ref(false)
const jobHistoryFilter = ref('')
const jobHistoryLoading = ref(false)
const jobHistoryList = ref<any[]>([])
const jobStartDate = ref('')
const jobEndDate = ref('')
const selectedJob = ref<any>(null)

const filteredJobHistory = computed(() => {
  let list = jobHistoryList.value
  if (jobHistoryFilter.value) list = list.filter(j => j.job_state === jobHistoryFilter.value)
  return list
})

const openJobList = async (state: string) => {
  jobHistoryFilter.value = state
  showJobHistory.value = true
}

// 将 API 作业数据映射为 JobDetailModal 期望的格式
const openJobDetail = (job: any) => {
  selectedJob.value = {
    id: job.job_id,
    name: job.name || `Job ${job.job_id}`,
    status: job.job_state,
    user: job.user_name || job.user_id || job.user || currentUser.value?.username,
    partition: job.partition,
    nodes: job.num_nodes || (job.nodes ? String(job.nodes).split(',').length : '-'),
    cpus: job.cpus || '-',
    memory: job.memory_per_node ? `${job.memory_per_node} MB` : '-',
    submitTime: formatTime(job.submit_time),
    startTime: formatTime(job.start_time),
    runTime: formatElapsed(job.run_time),
    directory: job.work_dir || job.directory || '-',
  }
}

const cancelJob = async (jobId: any) => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await fetch(`${getApiBase()}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || '取消失败')
    selectedJob.value = null
    await loadJobStats()
  } catch (e: any) {
    console.error('cancelJob error:', e)
    window.alert(e.message || '取消作业失败')
  }
}

const resumeJob = async (jobId: any) => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await fetch(`${getApiBase()}/api/jobs/${jobId}/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || '恢复失败')
    if (selectedJob.value) {
      selectedJob.value = { ...selectedJob.value, status: 'RUNNING' }
    }
    await loadJobStats()
  } catch (e: any) {
    console.error('resumeJob error:', e)
    window.alert(e.message || '恢复作业失败')
  }
}

const suspendJob = async (jobId: any) => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const res = await fetch(`${getApiBase()}/api/jobs/${jobId}/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || '暂停失败')
    if (selectedJob.value) {
      selectedJob.value = { ...selectedJob.value, status: 'SUSPENDED' }
    }
    await loadJobStats()
  } catch (e: any) {
    console.error('suspendJob error:', e)
    window.alert(e.message || '暂停作业失败')
  }
}

watch(showJobHistory, async (v) => {
  if (v && jobHistoryList.value.length === 0) await loadJobHistory()
})

const loadJobHistory = async () => {
  jobHistoryLoading.value = true
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const username = currentUser.value?.username || ''
    let url = `${getApiBase()}/api/jobs?page=1&page_size=500&user=${encodeURIComponent(username)}`
    // 后端需要 Unix 时间戳，把日期字符串转换
    if (jobStartDate.value) {
      url += `&start_time=${Math.floor(new Date(jobStartDate.value).getTime() / 1000)}`
    }
    if (jobEndDate.value) {
      // 结束日期取当天末尾 23:59:59
      url += `&end_time=${Math.floor(new Date(jobEndDate.value + 'T23:59:59').getTime() / 1000)}`
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const result = await res.json()
    jobHistoryList.value = result.data || []
  } catch (e) {
    console.error(e)
  } finally {
    jobHistoryLoading.value = false
  }
}

// 导出作业历史 Excel（CSV格式，Excel可直接打开）
const exportJobExcel = () => {
  const rows = filteredJobHistory.value
  if (!rows.length) return
  const headers = ['作业ID', '作业名', '提交人', '状态', '分区', '节点数', 'CPU核', '提交时间', '运行时长']
  const csvRows = [
    headers.join(','),
    ...rows.map(j => [
      j.job_id, `"${j.name || ''}"`,
      j.user_id || j.user_name || j.user || '',
      j.job_state, j.partition || '',
      j.num_nodes || '', j.cpus || '',
      formatTime(j.submit_time), formatElapsed(j.run_time)
    ].join(','))
  ]
  downloadCsv(csvRows.join('\n'), `jobs_${jobStartDate.value || 'all'}_${jobEndDate.value || 'all'}.csv`)
}

// ── 机时消费记录弹窗 ──
const showBillingHistory = ref(false)
const billingLoading = ref(false)
const billingRecords = ref<any[]>([])
const billingStartDate = ref('')
const billingEndDate = ref('')

// 过滤掉 billing=0 的记录
const billingValidRecords = computed(() =>
  billingRecords.value.filter(r => {
    const mins = (r.billing_mins || 0) + (r.billing_hours || 0) * 60 + (r.cpu_hours || 0) * 60
    return mins > 0
  })
)
const billingTotalMins = computed(() =>
  billingValidRecords.value.reduce((s, r) => {
    const mins = (r.billing_mins || 0) || (r.billing_hours || 0) * 60 || (r.cpu_hours || 0) * 60
    return s + mins
  }, 0)
)
const billingCpuHours = computed(() =>
  billingValidRecords.value.reduce((s, r) => s + (r.cpu_hours || 0), 0)
)
const billingGpuHours = computed(() =>
  billingValidRecords.value.reduce((s, r) => s + (r.gpu_hours || 0), 0)
)

watch(showBillingHistory, async (v) => {
  if (v) await loadBillingHistory()
})

const loadBillingHistory = async () => {
  billingLoading.value = true
  try {
    const user = currentUser.value?.username
    if (!user) return
    const start = billingStartDate.value || new Date().toISOString().split('T')[0]
    const end = billingEndDate.value || new Date().toISOString().split('T')[0]
    // end_time 取当天末尾，避免今天的作业被截断
    const res = await usageAPI.getUserUsage(user, start, end + 'T23:59:59')
    console.log('[billing] raw response:', res)
    console.log('[billing] res.data:', res.data)
    console.log('[billing] records count:', (res.data || []).length)
    if ((res.data || []).length > 0) {
      console.log('[billing] first record:', res.data[0])
    }
    billingRecords.value = res.data || []
  } catch (e) {
    console.error('[billing] error:', e)
  } finally {
    billingLoading.value = false
  }
}

// 导出机时消费 Excel
const exportBillingExcel = () => {
  const rows = billingValidRecords.value
  if (!rows.length) return
  const headers = ['作业ID', '作业名', '账户', '分区', 'QoS', '状态', '开始时间', '运行时长(秒)', 'CPU小时', 'GPU小时', '消耗核时']
  const csvRows = [
    headers.join(','),
    ...rows.map(r => [
      r.job_id || '',
      `"${r.job_name || ''}"`,
      r.account,
      r.partition || '',
      r.qos || '',
      r.state || '',
      formatTime(r.start_time),
      r.elapsed_secs || 0,
      (r.cpu_hours || 0).toFixed(2),
      (r.gpu_hours || 0).toFixed(2),
      (r.billing_mins || (r.billing_hours || 0) * 60).toFixed(1)
    ].join(','))
  ]
  downloadCsv(csvRows.join('\n'), `billing_${billingStartDate.value || 'all'}_${billingEndDate.value || 'all'}.csv`)
}

// ── 通用 CSV 下载（BOM 保证 Excel 中文不乱码）──
const downloadCsv = (content: string, filename: string) => {
  const bom = '\uFEFF'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── 格式化工具 ──
const formatTime = (ts: any): string => {
  if (!ts) return '-'
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const formatElapsed = (secs: any): string => {
  if (!secs || secs === 0) return '-'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const formatMemory = (memoryTB: number) => {
  if (!memoryTB) return '0 GB'
  if (memoryTB >= 1) return `${memoryTB.toFixed(1)} TB`
  return `${(memoryTB * 1024).toFixed(1)} GB`
}

// ── 数据 ──
const stats = ref({ nodes: 0, nodesOnline: 0, cpuCores: 0, cpuUsage: 0, gpuCards: 0, gpuInUse: 0, memory: 0, memoryFree: 0 })
const jobStats = ref({ running: 0, pending: 0, completed: 0, failed: 0 })
const jobStatsLoading = ref(false)
const runningJobs = ref<any[]>([])
const nodes = ref<any[]>([])
const machineTime = ref({ totalQuota: 0, used: 0, remaining: 0, usageRate: 0, hasLimit: false })
const storageQuota = ref({
  capacity: { used: '-', total: '-', percentage: 0 },
  files: { used: 0, total: 0, percentage: 0 }
})

const jobStatsTotal = computed(() => jobStats.value.running + jobStats.value.pending + jobStats.value.completed + jobStats.value.failed)
const jobStatsPercentages = computed(() => {
  const t = jobStatsTotal.value
  if (t === 0) return { running: 0, pending: 0, completed: 0, failed: 0 }
  return {
    running: (jobStats.value.running / t) * 100,
    pending: (jobStats.value.pending / t) * 100,
    completed: (jobStats.value.completed / t) * 100,
    failed: (jobStats.value.failed / t) * 100
  }
})

// ── API 加载 ──
const loadDashboardStats = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const res = await fetch(`${getApiBase()}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const { data } = await res.json()
    stats.value = {
      nodes: data.total_nodes || 0, nodesOnline: data.online_nodes || 0,
      cpuCores: data.total_cpus || 0, cpuUsage: Math.round(data.cpu_usage_percent || 0),
      gpuCards: data.total_gpus || 0, gpuInUse: data.allocated_gpus || 0,
      memory: data.total_memory_tb || 0, memoryFree: data.free_memory_tb || 0
    }
  } catch (e) { console.error(e) }
}

const loadNodes = async () => {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const res = await fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const { data } = await res.json()
    nodes.value = (data || []).map((node: any) => {
      const state = (node.state || '').toUpperCase()
      let status = 'idle', statusText = '空闲'
      if (state === 'ALLOCATED' || state === 'MIXED') { status = 'online'; statusText = '在线' }
      else if (state === 'DOWN' || state === 'DRAIN' || state === 'DRAINING') { status = 'offline'; statusText = '离线' }
      let gpuInfo = '-'
      if (node.gpu_info) {
        const m = node.gpu_info.match(/gpu:(\w+:)?(\d+)/)
        const u = node.gpu_used?.match(/gpu:(\w+:)?(\d+)/)
        if (m) gpuInfo = `${u ? parseInt(u[2]) : 0}/${parseInt(m[2])}`
      }
      return { name: node.name, status, statusText, cpuUsage: Math.round(node.cpu_usage_percent || 0), memUsage: Math.round(node.memory_usage_percent || 0), gpu: gpuInfo, jobs: node.running_jobs || 0 }
    })
  } catch (e) { console.error(e) }
}

const loadJobStats = async () => {
  jobStatsLoading.value = true
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token) return
    const username = currentUser.value?.username || ''
    // page_size=5000 + no time filter → get all jobs for stats
    const res = await fetch(
      `${getApiBase()}/api/jobs?page=1&page_size=5000&user=${encodeURIComponent(username)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return
    const result = await res.json()
    const jobs = result.data || []
    jobStats.value = {
      running:   jobs.filter((j: any) => j.job_state === 'RUNNING').length,
      pending:   jobs.filter((j: any) => j.job_state === 'PENDING').length,
      completed: jobs.filter((j: any) => j.job_state === 'COMPLETED').length,
      failed:    jobs.filter((j: any) => ['FAILED','CANCELLED','TIMEOUT','NODE_FAIL'].includes(j.job_state)).length,
    }
    runningJobs.value = jobs
      .filter((j: any) => j.job_state === 'RUNNING')
      .sort((a: any, b: any) => (b.submit_time || 0) - (a.submit_time || 0))
    jobHistoryList.value = jobs
  } catch (e) { console.error(e) } finally { jobStatsLoading.value = false }
}

const loadMyResources = async () => {
  resourcesLoading.value = true
  try {
    const res = await axios.get('/me/resources')
    myResources.value = res.data.data || {}
    const qosList: any[] = myResources.value.qos_limits || []
    const bq = qosList.find((q: any) => q.billing_limit_mins > 0)
    if (bq) {
      const total: number = bq.billing_limit_mins
      const used: number = bq.billing_used_mins || 0
      const remain = Math.max(0, total - used)
      // 精确到2位小数，避免小作业截断为0
      const toHours = (mins: number) => Math.round(mins / 60 * 100) / 100
      const usageRate = total > 0 ? parseFloat((used / total * 100).toFixed(2)) : 0
      machineTime.value = {
        totalQuota: toHours(total),
        used: toHours(used),
        remaining: toHours(remain),
        usageRate,
        hasLimit: true
      }
    } else {
      machineTime.value = { totalQuota: 0, used: 0, remaining: 0, usageRate: 0, hasLimit: false }
    }
  } catch (e) { console.error(e) } finally { resourcesLoading.value = false }
  // 同步加载存储配额（内联避免被格式化工具删除）
  try {
    const sqRes = await axios.get('/files/quota')
    const quotas: any[] = sqRes.data.quotas || []
    if (quotas.length) {
      const q = quotas[0]
      const usedKB: number = q.block_used_kb || 0
      const hardKB: number = q.block_hard_kb || 0
      const pct = hardKB > 0 ? Math.min(100, Math.round(usedKB / hardKB * 100)) : 0
      const fmtKB = (kb: number) => {
        if (kb >= 1024 * 1024 * 1024) return (kb / 1024 / 1024 / 1024).toFixed(1) + ' TB'
        if (kb >= 1024 * 1024) return (kb / 1024 / 1024).toFixed(1) + ' GB'
        if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB'
        return kb + ' KB'
      }
      const inodeUsed: number = q.inode_used || 0
      const inodeHard: number = q.inode_hard || 0
      storageQuota.value = {
        capacity: { used: fmtKB(usedKB), total: hardKB > 0 ? fmtKB(hardKB) : '无限制', percentage: pct },
        files: { used: inodeUsed, total: inodeHard, percentage: inodeHard > 0 ? Math.min(100, Math.round(inodeUsed / inodeHard * 100)) : 0 }
      }
    }
  } catch (_) { /* 配额接口失败不影响其他数据 */ }
}

onMounted(() => {
  currentUser.value = getUser()
  const now = new Date()
  billingEndDate.value = now.toISOString().split('T')[0]
  billingStartDate.value = now.toISOString().split('T')[0]
  loadDashboardStats()
  loadNodes()
  loadJobStats()
  loadMyResources()
  setInterval(() => { loadDashboardStats(); loadNodes(); loadJobStats() }, 30000)
})
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 1.5rem; }

/* 统计卡片 */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
.stat-card {
  background: white; border-radius: 14px; padding: 1.25rem 1.5rem;
  display: flex; align-items: center; gap: 1.25rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
.stat-icon-wrap {
  width: 52px; height: 52px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center; font-size: 1.6rem; flex-shrink: 0;
}
.stat-label { font-size: 0.82rem; color: #9ca3af; margin-bottom: 4px; }
.stat-value { font-size: 1.8rem; font-weight: 700; color: #1f2937; line-height: 1; margin-bottom: 4px; }
.stat-detail { font-size: 0.8rem; color: #6b7280; }

/* 图表行 */
.charts-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
.chart-card { display: flex; flex-direction: column; }
.chart-card-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;
}
.chart-card-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: #374151; }
.btn-link-sm {
  background: none; border: none; color: #667eea; font-size: 0.82rem;
  cursor: pointer; padding: 0; font-weight: 500;
}
.btn-link-sm:hover { text-decoration: underline; }

.quota-select {
  padding: 2px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.78rem;
  color: #374151;
  background: #f9fafb;
  cursor: pointer;
}

.chart-body { display: flex; align-items: center; gap: 1.5rem; }
.donut-wrap { flex-shrink: 0; }
.donut-svg { width: 160px; height: 160px; }
.donut-num { font-size: 2rem; font-weight: 700; fill: #1f2937; }
.donut-lbl { font-size: 0.85rem; fill: #9ca3af; }

.legend-list { display: flex; flex-direction: column; gap: 0.6rem; flex: 1; }
.legend-row { display: flex; align-items: center; gap: 0.6rem; cursor: default; }
.legend-row:hover .leg-label { color: #374151; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.leg-label { font-size: 0.85rem; color: #6b7280; flex: 1; }
.leg-val { font-size: 0.9rem; font-weight: 600; color: #374151; }
.legend-row-full { padding-top: 0.5rem; border-top: 1px solid #f3f4f6; }
.leg-small { font-size: 0.8rem; color: #9ca3af; }

.chart-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 160px; color: #9ca3af; gap: 0.5rem;
}
.empty-icon { font-size: 2rem; opacity: 0.4; }

/* 节点表格 */
.card { background: white; border-radius: 14px; padding: 1.5rem; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
.card h3 { margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600; color: #374151; }
.nodes-table { width: 100%; border-collapse: collapse; }
.nodes-table th { background: #f9fafb; padding: 0.75rem 1rem; text-align: left; font-size: 0.82rem; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
.nodes-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.88rem; }
.nodes-table tbody tr:hover { background: #fafafa; }
.status { padding: 2px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; }
.status-online { background: #d1fae5; color: #065f46; }
.status-idle { background: #dbeafe; color: #1e40af; }
.status-offline { background: #fee2e2; color: #991b1b; }
.progress-bar { position: relative; width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg,#667eea,#764ba2); transition: width 0.3s; }
.progress-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 0.72rem; font-weight: 600; color: #374151; }

/* 弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: white; border-radius: 16px; width: 92%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; }
.modal-lg { max-width: 900px; }
.modal-xl { max-width: 1100px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; flex-wrap: wrap; gap: 0.5rem; }
.modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.modal-header-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #9ca3af; line-height: 1; padding: 0; }
.modal-body { padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; }
.modal-loading { text-align: center; padding: 3rem; color: #9ca3af; }
.filter-select { padding: 0.4rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.85rem; }
.btn-query { padding: 0.4rem 1rem; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 0.85rem; cursor: pointer; }
.btn-query:hover { background: #5a6fd6; }
.btn-export { padding: 0.4rem 1rem; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 0.85rem; cursor: pointer; }
.btn-export:hover { background: #059669; }
.btn-detail { padding: 2px 10px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 0.78rem; cursor: pointer; color: #374151; white-space: nowrap; }
.btn-detail:hover { background: #e5e7eb; }
.clickable-row { cursor: pointer; }
.clickable-row:hover td { background: #f0f4ff !important; }

.data-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.data-table th { background: #f9fafb; padding: 0.65rem 0.9rem; text-align: left; font-size: 0.8rem; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
.data-table td { padding: 0.65rem 0.9rem; border-bottom: 1px solid #f3f4f6; }
.data-table tbody tr:hover { background: #fafafa; }
.empty-cell { text-align: center; padding: 2rem; color: #9ca3af; }

.state-badge { padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.state-running { background: #dbeafe; color: #1e40af; }
.state-pending { background: #fef3c7; color: #92400e; }
.state-completed { background: #d1fae5; color: #065f46; }
.state-failed { background: #fee2e2; color: #991b1b; }
.state-cancelled { background: #f3f4f6; color: #6b7280; }
.user-tag { font-size: 0.82rem; color: #6b7280; font-family: monospace; }

/* 机时消费汇总 */
.billing-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.25rem; }
.bs-item { background: #f9fafb; border-radius: 10px; padding: 1rem; text-align: center; }
.bs-label { font-size: 0.78rem; color: #9ca3af; margin-bottom: 0.4rem; }
.bs-val { font-size: 1.3rem; font-weight: 700; color: #1f2937; }

@media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .charts-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 900px) { .charts-row { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr; } .billing-summary { grid-template-columns: repeat(2, 1fr); } }

/* 正在运行的作业 */
.running-jobs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.running-jobs-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: #374151; }
.running-jobs-meta { display: flex; align-items: center; gap: 1rem; }
.running-count { font-size: 0.82rem; font-weight: 600; color: #3b82f6; background: #dbeafe; padding: 2px 10px; border-radius: 20px; }
.running-empty { text-align: center; padding: 2rem; color: #9ca3af; font-size: 0.9rem; }
.running-job-row { transition: background 0.15s; }
.running-job-row:hover td { background: #f0f4ff !important; }
.elapsed-badge { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; font-family: monospace; }
</style>
