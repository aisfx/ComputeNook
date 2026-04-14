<template>
  <div class="reports-page">
    <div class="page-header">
      <h3>📊 报表中心</h3>
      <button class="btn-primary" @click="showGenerateModal = true">+ 生成报表</button>
    </div>

    <!-- 报表筛选 -->
    <div class="card filters-card">
      <div class="filters-row">
        <div class="filter-group">
          <label>报表类型</label>
          <select v-model="filters.type">
            <option value="">全部类型</option>
            <option value="usage">资源使用报表</option>
            <option value="job">作业统计报表</option>
            <option value="machine-time">机时消耗报表</option>
            <option value="user">用户统计报表</option>
            <option value="node">节点运行报表</option>
          </select>
        </div>
        <div class="filter-group">
          <label>时间范围</label>
          <select v-model="filters.timeRange">
            <option value="today">今日</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
            <option value="quarter">本季度</option>
            <option value="year">本年</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div class="filter-group" v-if="filters.timeRange === 'custom'">
          <label>开始日期</label>
          <input type="date" v-model="filters.startDate" />
        </div>
        <div class="filter-group" v-if="filters.timeRange === 'custom'">
          <label>结束日期</label>
          <input type="date" v-model="filters.endDate" />
        </div>
        <button class="btn-secondary" @click="applyFilters">🔍 查询</button>
      </div>
    </div>

    <!-- 报表列表 -->
    <div class="card">
      <table class="reports-table">
        <thead>
          <tr>
            <th>报表名称</th>
            <th>报表类型</th>
            <th>时间范围</th>
            <th>生成时间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="report in filteredReports" :key="report.id">
            <td>
              <div class="report-name">
                <span class="report-icon">{{ getReportIcon(report.type) }}</span>
                <span>{{ report.name }}</span>
              </div>
            </td>
            <td>{{ getReportTypeName(report.type) }}</td>
            <td>{{ report.timeRange }}</td>
            <td>{{ report.createTime }}</td>
            <td>
              <span :class="['status-badge', `status-${report.status}`]">
                {{ getStatusText(report.status) }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-link" @click="viewReport(report)">👁️ 查看</button>
                <button class="btn-link" @click="downloadReport(report)">📥 下载</button>
                <button class="btn-link danger" @click="deleteReport(report.id)">🗑️ 删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredReports.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <p>暂无报表数据</p>
        <p class="empty-hint">点击"生成报表"创建新的统计报表</p>
      </div>
    </div>

    <!-- 生成报表弹窗 -->
    <div v-if="showGenerateModal" class="modal-overlay" @click="showGenerateModal = false">
      <div class="modal-content generate-modal" @click.stop>
        <div class="modal-header">
          <h2>生成报表</h2>
          <button @click="showGenerateModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="generateReport" class="generate-form">
            <div class="form-group">
              <label>报表名称 *</label>
              <input v-model="generateForm.name" type="text" placeholder="例如: 2026年2月资源使用报表" required />
            </div>

            <div class="form-group">
              <label>报表类型 *</label>
              <select v-model="generateForm.type" required>
                <option value="">请选择报表类型</option>
                <option value="usage">资源使用报表</option>
                <option value="job">作业统计报表</option>
                <option value="machine-time">机时消耗报表</option>
                <option value="user">用户统计报表</option>
                <option value="node">节点运行报表</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>开始日期 *</label>
                <input v-model="generateForm.startDate" type="date" required />
              </div>
              <div class="form-group">
                <label>结束日期 *</label>
                <input v-model="generateForm.endDate" type="date" required />
              </div>
            </div>

            <div class="form-group">
              <label>报表格式</label>
              <div class="format-options">
                <label class="format-option">
                  <input type="checkbox" v-model="generateForm.formats" value="pdf" />
                  <span>PDF</span>
                </label>
                <label class="format-option">
                  <input type="checkbox" v-model="generateForm.formats" value="excel" />
                  <span>Excel</span>
                </label>
                <label class="format-option">
                  <input type="checkbox" v-model="generateForm.formats" value="csv" />
                  <span>CSV</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>包含内容</label>
              <div class="content-options">
                <label class="content-option">
                  <input type="checkbox" v-model="generateForm.includeCharts" />
                  <span>包含图表</span>
                </label>
                <label class="content-option">
                  <input type="checkbox" v-model="generateForm.includeDetails" />
                  <span>包含详细数据</span>
                </label>
                <label class="content-option">
                  <input type="checkbox" v-model="generateForm.includeSummary" />
                  <span>包含汇总信息</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>备注</label>
              <textarea v-model="generateForm.notes" rows="3" placeholder="可选的备注信息..."></textarea>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="showGenerateModal = false">取消</button>
              <button type="submit" class="btn-primary" :disabled="generating">
                {{ generating ? '生成中...' : '生成报表' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 查看报表弹窗 -->
    <div v-if="showViewModal" class="modal-overlay" @click="showViewModal = false">
      <div class="modal-content view-modal" @click.stop>
        <div class="modal-header">
          <h2>{{ currentReport?.name }}</h2>
          <button @click="showViewModal = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="report-info">
            <div class="info-row">
              <span class="info-label">报表类型:</span>
              <span class="info-value">{{ getReportTypeName(currentReport?.type) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">时间范围:</span>
              <span class="info-value">{{ currentReport?.timeRange }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">生成时间:</span>
              <span class="info-value">{{ currentReport?.createTime }}</span>
            </div>
          </div>

          <div class="report-summary">
            <h4>报表摘要</h4>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="summary-label">总作业数</span>
                <span class="summary-value">{{ reportData.totalJobs }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">成功作业</span>
                <span class="summary-value success">{{ reportData.successJobs }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">失败作业</span>
                <span class="summary-value failed">{{ reportData.failedJobs }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">总机时</span>
                <span class="summary-value">{{ reportData.totalMachineTime }} 核时</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">平均 CPU 使用率</span>
                <span class="summary-value">{{ reportData.avgCpuUsage }}%</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">平均内存使用率</span>
                <span class="summary-value">{{ reportData.avgMemUsage }}%</span>
              </div>
            </div>
          </div>

          <div class="report-chart">
            <h4>作业趋势</h4>
            <canvas ref="reportChartRef" width="700" height="300"></canvas>
          </div>

          <div class="modal-actions">
            <button class="btn-primary" @click="downloadReport(currentReport)">📥 下载报表</button>
            <button class="btn-secondary" @click="showViewModal = false">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const showGenerateModal = ref(false)
const showViewModal = ref(false)
const generating = ref(false)
const currentReport = ref<any>(null)
const reportChartRef = ref<HTMLCanvasElement>()

const filters = ref({
  type: '',
  timeRange: 'month',
  startDate: '',
  endDate: ''
})

const generateForm = ref({
  name: '',
  type: '',
  startDate: '',
  endDate: '',
  formats: ['pdf'],
  includeCharts: true,
  includeDetails: true,
  includeSummary: true,
  notes: ''
})

const reports = ref([
  {
    id: 1,
    name: '2026年2月资源使用报表',
    type: 'usage',
    timeRange: '2026-02-01 ~ 2026-02-28',
    createTime: '2026-02-14 15:30:00',
    status: 'completed'
  },
  {
    id: 2,
    name: '本周作业统计报表',
    type: 'job',
    timeRange: '2026-02-10 ~ 2026-02-16',
    createTime: '2026-02-14 10:20:00',
    status: 'completed'
  },
  {
    id: 3,
    name: '2026年Q1机时消耗报表',
    type: 'machine-time',
    timeRange: '2026-01-01 ~ 2026-03-31',
    createTime: '2026-02-13 14:15:00',
    status: 'generating'
  },
  {
    id: 4,
    name: '用户统计月报',
    type: 'user',
    timeRange: '2026-01-01 ~ 2026-01-31',
    createTime: '2026-02-01 09:00:00',
    status: 'completed'
  }
])

const reportData = ref({
  totalJobs: 1250,
  successJobs: 1180,
  failedJobs: 70,
  totalMachineTime: 45680,
  avgCpuUsage: 72,
  avgMemUsage: 68
})

const filteredReports = computed(() => {
  let result = reports.value
  
  if (filters.value.type) {
    result = result.filter(r => r.type === filters.value.type)
  }
  
  return result
})

const getReportIcon = (type: string) => {
  const icons: Record<string, string> = {
    usage: '📊',
    job: '📋',
    'machine-time': '⏱️',
    user: '👥',
    node: '🖥️'
  }
  return icons[type] || '📄'
}

const getReportTypeName = (type: string) => {
  const names: Record<string, string> = {
    usage: '资源使用报表',
    job: '作业统计报表',
    'machine-time': '机时消耗报表',
    user: '用户统计报表',
    node: '节点运行报表'
  }
  return names[type] || type
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    completed: '已完成',
    generating: '生成中',
    failed: '失败'
  }
  return texts[status] || status
}

const applyFilters = () => {
  console.log('应用筛选:', filters.value)
}

const generateReport = () => {
  generating.value = true
  
  setTimeout(() => {
    const newReport = {
      id: Date.now(),
      name: generateForm.value.name,
      type: generateForm.value.type,
      timeRange: `${generateForm.value.startDate} ~ ${generateForm.value.endDate}`,
      createTime: new Date().toLocaleString(),
      status: 'completed'
    }
    
    reports.value.unshift(newReport)
    showGenerateModal.value = false
    generating.value = false
    
    alert(`报表"${newReport.name}"已生成！`)
    
    // 重置表单
    generateForm.value = {
      name: '',
      type: '',
      startDate: '',
      endDate: '',
      formats: ['pdf'],
      includeCharts: true,
      includeDetails: true,
      includeSummary: true,
      notes: ''
    }
  }, 2000)
}

const viewReport = (report: any) => {
  currentReport.value = report
  showViewModal.value = true
  
  // 延迟绘制图表
  setTimeout(() => {
    drawReportChart()
  }, 100)
}

const drawReportChart = () => {
  const canvas = reportChartRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const width = canvas.width
  const height = canvas.height
  const padding = 50
  
  // 清空画布
  ctx.clearRect(0, 0, width, height)
  
  // 绘制背景
  ctx.fillStyle = '#f9fafb'
  ctx.fillRect(0, 0, width, height)
  
  // 模拟数据
  const data = [120, 150, 180, 160, 200, 190, 220]
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const maxValue = Math.max(...data) * 1.2
  
  // 绘制网格线
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  
  for (let i = 0; i <= 4; i++) {
    const y = padding + (height - padding * 2) * i / 4
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
  }
  
  // 绘制柱状图
  const barWidth = (width - padding * 2) / data.length * 0.6
  const barSpacing = (width - padding * 2) / data.length
  
  data.forEach((value, index) => {
    const x = padding + index * barSpacing + (barSpacing - barWidth) / 2
    const barHeight = (value / maxValue) * (height - padding * 2)
    const y = height - padding - barHeight
    
    // 绘制柱子
    const gradient = ctx.createLinearGradient(0, y, 0, height - padding)
    gradient.addColorStop(0, '#667eea')
    gradient.addColorStop(1, '#764ba2')
    
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, barWidth, barHeight)
    
    // 绘制数值
    ctx.fillStyle = '#333'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(value.toString(), x + barWidth / 2, y - 5)
    
    // 绘制标签
    ctx.fillStyle = '#666'
    ctx.font = '12px sans-serif'
    ctx.fillText(labels[index], x + barWidth / 2, height - padding + 20)
  })
}

const downloadReport = (report: any) => {
  alert(`下载报表: ${report.name}\n格式: PDF, Excel, CSV`)
}

const deleteReport = (id: number) => {
  if (confirm('确定要删除此报表吗？')) {
    const index = reports.value.findIndex(r => r.id === id)
    if (index > -1) {
      reports.value.splice(index, 1)
      alert('报表已删除')
    }
  }
}
</script>

<style scoped>
.reports-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #333;
}

.filters-card {
  padding: 1.5rem;
}

.filters-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 150px;
}

.filter-group label {
  font-size: 0.9rem;
  color: #666;
  font-weight: 600;
}

.filter-group select,
.filter-group input {
  padding: 0.625rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.95rem;
}

.filter-group select:focus,
.filter-group input:focus {
  outline: none;
  border-color: #667eea;
}

.reports-table {
  width: 100%;
  border-collapse: collapse;
}

.reports-table thead {
  background: #f9fafb;
}

.reports-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
}

.reports-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  color: #333;
}

.reports-table tbody tr:hover {
  background: #f9fafb;
}

.report-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.report-icon {
  font-size: 1.5rem;
}

.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-completed {
  background: #d1fae5;
  color: #065f46;
}

.status-generating {
  background: #fef3c7;
  color: #92400e;
}

.status-failed {
  background: #fee2e2;
  color: #991b1b;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #999;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-hint {
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

/* 生成报表弹窗 */
.generate-modal {
  max-width: 600px;
}

.generate-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.format-options,
.content-options {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.format-option,
.content-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.format-option input,
.content-option input {
  cursor: pointer;
}

/* 查看报表弹窗 */
.view-modal {
  max-width: 900px;
  max-height: 90vh;
}

.report-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.info-row {
  display: flex;
  gap: 1rem;
}

.info-label {
  font-weight: 600;
  color: #666;
  min-width: 100px;
}

.info-value {
  color: #333;
}

.report-summary {
  margin-bottom: 2rem;
}

.report-summary h4 {
  margin: 0 0 1rem 0;
  color: #667eea;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.summary-label {
  font-size: 0.85rem;
  color: #666;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #333;
}

.summary-value.success {
  color: #10b981;
}

.summary-value.failed {
  color: #ef4444;
}

.report-chart {
  margin-bottom: 2rem;
}

.report-chart h4 {
  margin: 0 0 1rem 0;
  color: #667eea;
}

.report-chart canvas {
  width: 100%;
  border-radius: 8px;
  background: #f9fafb;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

@media (max-width: 768px) {
  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    width: 100%;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
