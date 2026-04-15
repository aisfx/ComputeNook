<template>
  <div class="monitoring">
    <div class="page-header">
      <h3>📊 集群监控</h3>
      <div class="header-actions">
        <button class="btn-secondary" @click="showConfigModal = true">⚙️ 配置</button>
        <button class="btn-secondary" @click="refreshMonitoring">🔄 刷新</button>
        <button class="btn-primary" @click="showAlertModal = true">🔔 报警规则</button>
      </div>
    </div>

    <!-- 快速状态卡片 -->
    <div class="status-cards">
      <div class="status-card">
        <div class="card-icon">🖥️</div>
        <div class="card-content">
          <div class="card-label">节点状态</div>
          <div class="card-value">{{ clusterStatus.totalNodes }} / {{ clusterStatus.activeNodes }}</div>
          <div class="card-sub">总数 / 在线</div>
        </div>
      </div>
      <div class="status-card">
        <div class="card-icon">⚡</div>
        <div class="card-content">
          <div class="card-label">CPU 使用率</div>
          <div class="card-value">{{ clusterStatus.cpuUsage }}%</div>
          <div class="card-sub">平均负载</div>
        </div>
      </div>
      <div class="status-card">
        <div class="card-icon">💾</div>
        <div class="card-content">
          <div class="card-label">内存使用率</div>
          <div class="card-value">{{ clusterStatus.memoryUsage }}%</div>
          <div class="card-sub">{{ clusterStatus.memoryUsed }} / {{ clusterStatus.memoryTotal }} GB</div>
        </div>
      </div>
      <div class="status-card alert" v-if="activeAlerts.length > 0">
        <div class="card-icon">🚨</div>
        <div class="card-content">
          <div class="card-label">活跃报警</div>
          <div class="card-value">{{ activeAlerts.length }}</div>
          <div class="card-sub">需要处理</div>
        </div>
      </div>
    </div>

    <!-- 报警列表 -->
    <div v-if="activeAlerts.length > 0" class="alerts-section">
      <h4>🔔 活跃报警</h4>
      <div class="alerts-list">
        <div v-for="alert in activeAlerts" :key="alert.id" :class="['alert-item', 'alert-' + alert.severity]">
          <div class="alert-header">
            <span class="alert-severity">{{ getSeverityLabel(alert.severity) }}</span>
            <span class="alert-time">{{ alert.time }}</span>
          </div>
          <div class="alert-title">{{ alert.title }}</div>
          <div class="alert-description">{{ alert.description }}</div>
          <div class="alert-actions">
            <button class="btn-link" @click="acknowledgeAlert(alert)">✓ 确认</button>
            <button class="btn-link" @click="viewAlertDetails(alert)">详情</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 监控面板 -->
    <div class="monitoring-panels">
      <div class="panel-tabs">
        <button 
          v-for="panel in monitoringPanels" 
          :key="panel.id"
          :class="['tab-btn', { active: activePanel === panel.id }]"
          @click="activePanel = panel.id"
        >
          {{ panel.label }}
        </button>
      </div>

      <div class="panel-content">
        <div v-if="!grafanaUrl" class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>未配置监控系统</h3>
          <p>请先配置 Grafana 的访问地址</p>
          <button class="btn-primary" @click="showConfigModal = true">立即配置</button>
        </div>

        <div v-else class="grafana-link-panel">
          <div class="grafana-info">
            <div class="grafana-icon">📊</div>
            <h3>Grafana 监控面板</h3>
            <p>由于浏览器安全限制（X-Frame-Options），Grafana 无法在此页面内嵌显示。</p>
            <p class="grafana-url-text">{{ currentPanelUrl }}</p>
            <div class="grafana-actions">
              <a :href="currentPanelUrl" target="_blank" class="btn-primary">
                🔗 在新标签页打开 Grafana
              </a>
              <button class="btn-secondary" @click="copyGrafanaUrl">
                📋 复制链接
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置模态框 -->
    <div v-if="showConfigModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>⚙️ 监控配置</h3>
          <button class="btn-close" @click="showConfigModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Prometheus 地址</label>
            <input 
              v-model="config.prometheusUrl" 
              placeholder="http://prometheus.example.com:9090"
            />
            <small class="form-hint">Prometheus 服务器的访问地址</small>
          </div>
          <div class="form-group">
            <label>Grafana 地址</label>
            <input 
              v-model="config.grafanaUrl" 
              placeholder="http://grafana.example.com:3000"
            />
            <small class="form-hint">Grafana 仪表板的访问地址</small>
          </div>
          <div class="form-group">
            <label>Grafana Dashboard ID</label>
            <input 
              v-model="config.grafanaDashboardId" 
              placeholder="例如: node-exporter-full"
            />
            <small class="form-hint">Grafana 仪表板的 ID 或 UID</small>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="config.enableAlerts" />
              启用报警功能
            </label>
          </div>
          <div class="form-group">
            <label>刷新间隔（秒）</label>
            <input 
              type="number" 
              v-model.number="config.refreshInterval" 
              min="10"
              max="300"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showConfigModal = false">取消</button>
          <button class="btn-primary" @click="saveConfig">保存配置</button>
        </div>
      </div>
    </div>

    <!-- 报警规则模态框 -->
    <div v-if="showAlertModal" class="modal-overlay">
      <div class="modal large">
        <div class="modal-header">
          <h3>🔔 报警规则管理</h3>
          <button class="btn-close" @click="showAlertModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="alert-rules-header">
            <button class="btn-primary" @click="addAlertRule">+ 添加规则</button>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>规则名称</th>
                <th>监控指标</th>
                <th>条件</th>
                <th>阈值</th>
                <th>严重程度</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in alertRules" :key="rule.id">
                <td><strong>{{ rule.name }}</strong></td>
                <td>{{ rule.metric }}</td>
                <td>{{ rule.condition }}</td>
                <td>{{ rule.threshold }}</td>
                <td>
                  <span :class="['badge', 'badge-' + rule.severity]">
                    {{ getSeverityLabel(rule.severity) }}
                  </span>
                </td>
                <td>
                  <span :class="['badge', rule.enabled ? 'badge-active' : 'badge-disabled']">
                    {{ rule.enabled ? '启用' : '禁用' }}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-link" @click="editAlertRule(rule)">编辑</button>
                    <button class="btn-link danger" @click="deleteAlertRule(rule)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showAlertModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const showConfigModal = ref(false)
const showAlertModal = ref(false)
const activePanel = ref('overview')
const iframeLoading = ref(true)

const config = ref({
  prometheusUrl: '',
  grafanaUrl: '',
  grafanaDashboardId: '',
  enableAlerts: true,
  refreshInterval: 30
})

const prometheusUrl = ref('')
const grafanaUrl = ref('')

const clusterStatus = ref({
  totalNodes: 10,
  activeNodes: 9,
  cpuUsage: 65,
  memoryUsage: 72,
  memoryUsed: 360,
  memoryTotal: 500
})

const activeAlerts = ref([
  {
    id: 1,
    severity: 'critical',
    title: '节点 node01 离线',
    description: '节点 node01 在过去 5 分钟内无响应',
    time: '2分钟前'
  },
  {
    id: 2,
    severity: 'warning',
    title: 'CPU 使用率过高',
    description: '节点 node03 的 CPU 使用率超过 90%',
    time: '10分钟前'
  }
])

const alertRules = ref([
  { id: 1, name: '节点离线检测', metric: 'node_up', condition: '==', threshold: '0', severity: 'critical', enabled: true },
  { id: 2, name: 'CPU 使用率告警', metric: 'cpu_usage', condition: '>', threshold: '90%', severity: 'warning', enabled: true },
  { id: 3, name: '内存使用率告警', metric: 'memory_usage', condition: '>', threshold: '85%', severity: 'warning', enabled: true },
  { id: 4, name: '磁盘空间告警', metric: 'disk_usage', condition: '>', threshold: '90%', severity: 'critical', enabled: true },
])

const monitoringPanels = [
  { id: 'overview', label: '总览' },
  { id: 'nodes', label: '节点监控' },
  { id: 'jobs', label: '作业监控' },
  { id: 'network', label: '网络监控' },
  { id: 'storage', label: '存储监控' }
]

const currentPanelUrl = computed(() => {
  if (!grafanaUrl.value) return ''
  
  const baseUrl = grafanaUrl.value
  const dashboardId = config.value.grafanaDashboardId || 'default'
  
  // 根据不同面板返回不同的 Grafana URL
  return `${baseUrl}/d/${dashboardId}?orgId=1&refresh=30s&kiosk=tv`
})

const getSeverityLabel = (severity: string) => {
  const labels: any = {
    critical: '🔴 严重',
    warning: '🟡 警告',
    info: '🔵 信息'
  }
  return labels[severity] || severity
}

const saveConfig = () => {
  prometheusUrl.value = config.value.prometheusUrl
  grafanaUrl.value = config.value.grafanaUrl
  
  // 保存到 localStorage
  localStorage.setItem('monitoring_config', JSON.stringify(config.value))
  
  showConfigModal.value = false
  alert('配置保存成功！')
}

const loadConfig = () => {
  const saved = localStorage.getItem('monitoring_config')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      config.value = { ...config.value, ...parsed }
      prometheusUrl.value = config.value.prometheusUrl
      grafanaUrl.value = config.value.grafanaUrl
    } catch (e) {
      console.error('Failed to load config:', e)
    }
  }
}

const refreshMonitoring = () => {
  iframeLoading.value = true
  const iframe = document.querySelector('iframe')
  if (iframe) {
    iframe.src = iframe.src
  }
}

const onIframeLoad = () => {
  iframeLoading.value = false
}

const copyGrafanaUrl = () => {
  navigator.clipboard.writeText(currentPanelUrl.value)
  alert('链接已复制到剪贴板')
}

const acknowledgeAlert = (alert: any) => {
  if (confirm(`确认已处理报警：${alert.title}？`)) {
    activeAlerts.value = activeAlerts.value.filter(a => a.id !== alert.id)
    alert('报警已确认')
  }
}

const viewAlertDetails = (alert: any) => {
  alert(`报警详情：\n\n${alert.title}\n${alert.description}\n时间：${alert.time}`)
}

const addAlertRule = () => {
  alert('添加报警规则功能开发中...')
}

const editAlertRule = (rule: any) => {
  alert(`编辑规则：${rule.name}`)
}

const deleteAlertRule = (rule: any) => {
  if (confirm(`确定要删除规则 ${rule.name} 吗？`)) {
    alertRules.value = alertRules.value.filter(r => r.id !== rule.id)
    alert('规则已删除')
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.monitoring {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h3 {
  margin: 0;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.status-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-card.alert {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border: 2px solid #ef4444;
}

.card-icon {
  font-size: 2.5rem;
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.card-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
}

.card-sub {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.alerts-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.alerts-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-item {
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid;
}

.alert-item.alert-critical {
  background: #fee2e2;
  border-color: #ef4444;
}

.alert-item.alert-warning {
  background: #fef3c7;
  border-color: #f59e0b;
}

.alert-item.alert-info {
  background: #dbeafe;
  border-color: #3b82f6;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.alert-severity {
  font-weight: 600;
  font-size: 0.85rem;
}

.alert-time {
  font-size: 0.85rem;
  color: #6b7280;
}

.alert-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.alert-description {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.alert-actions {
  display: flex;
  gap: 1rem;
}

.monitoring-panels {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  border-bottom: 2px solid #e5e7eb;
  background: #f9fafb;
}

.tab-btn {
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 600;
  color: #6b7280;
  transition: all 0.3s;
  border-bottom: 3px solid transparent;
}

.tab-btn:hover {
  color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.tab-btn.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: white;
}

.panel-content {
  position: relative;
  min-height: 600px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #374151;
}

.empty-state p {
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.iframe-container {
  position: relative;
  width: 100%;
  height: 600px;
}

.iframe-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.iframe-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.grafana-link-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 3rem;
}

.grafana-info {
  text-align: center;
  max-width: 520px;
}

.grafana-icon { font-size: 4rem; margin-bottom: 1rem; }
.grafana-info h3 { font-size: 1.4rem; color: #1a1a2e; margin: 0 0 0.75rem; }
.grafana-info p { color: #6b7280; font-size: 0.95rem; margin: 0 0 0.5rem; }

.grafana-url-text {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.625rem 1rem;
  font-family: monospace;
  font-size: 0.85rem;
  color: #374151;
  word-break: break-all;
  margin: 1rem 0 1.5rem;
}

.grafana-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.grafana-actions a.btn-primary { text-decoration: none; }

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-link.danger {
  color: #ef4444;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal.large {
  max-width: 1000px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #9ca3af;
  line-height: 1;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group input:not([type="checkbox"]) {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input[type="checkbox"] {
  margin-right: 0.5rem;
}

.form-hint {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #6b7280;
}

.alert-rules-header {
  margin-bottom: 1rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e5e7eb;
}

.data-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.badge-critical {
  background: #fee2e2;
  color: #991b1b;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.badge-info {
  background: #dbeafe;
  color: #1e40af;
}

.badge-active {
  background: #d1fae5;
  color: #065f46;
}

.badge-disabled {
  background: #e5e7eb;
  color: #6b7280;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}
</style>
