<template>
  <div class="job-management" :class="{ 'panel-open': submitOpen }">
    <!-- 左：作业列表 -->
    <div class="job-list-pane">
      <JobInfo
        ref="jobInfoRef"
        @view-detail="handleViewDetail"
        @open-directory="handleOpenDirectory"
        @submit-job="submitOpen = true; activePanel = 'submit'"
      />
    </div>

    <!-- 右：提交/模板面板 -->
    <transition name="slide">
      <div class="submit-pane" v-if="submitOpen">
        <!-- 面板 header with tabs -->
        <div class="submit-pane-header">
          <div class="pane-tabs">
            <button :class="['pane-tab', { active: activePanel === 'submit' }]" @click="activePanel = 'submit'">提交作业</button>
            <button :class="['pane-tab', { active: activePanel === 'templates' }]" @click="activePanel = 'templates'">模板管理</button>
          </div>
          <button class="close-btn" @click="submitOpen = false">✕</button>
        </div>

        <!-- 提交面板 -->
        <template v-if="activePanel === 'submit'">
          <div class="template-bar">
            <div class="template-bar-label">快速模板</div>
            <div class="template-grid">
              <button
                v-for="tpl in allTemplates"
                :key="tpl.id"
                class="tpl-card"
                @click="applyTemplate(tpl)"
              >
                <span class="tpl-icon">{{ tpl.icon }}</span>
                <span class="tpl-name">{{ tpl.name }}</span>
                <span class="tpl-meta">{{ tpl.cpus }}核 · {{ tpl.memory }}GB</span>
              </button>
            </div>
          </div>
          <JobSubmit ref="jobSubmitRef" @job-submitted="handleJobSubmitted" @go-registry="emit('go-registry')" />
        </template>

        <!-- 模板管理面板 -->
        <div v-else class="templates-pane">
          <JobTemplates @use-template="handleUseTemplate" />
        </div>
      </div>
    </transition>

    <!-- 作业详情弹窗 -->
    <JobDetailModal
      v-if="selectedJob"
      :job="selectedJob"
      @close="selectedJob = null"
      @pause="handlePause"
      @cancel="handleCancel"
      @open-directory="handleOpenDirectory"
      @exec-container="handleExecContainer"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import JobInfo from '../components/JobInfo.vue'
import JobSubmit from '../components/JobSubmit.vue'
import JobTemplates from '../components/JobTemplates.vue'
import JobDetailModal from '../components/JobDetailModal.vue'
import { jobTemplates } from '../data/jobTemplates'
import { getApiBase } from '../utils/auth'

const emit = defineEmits(['open-directory', 'go-registry', 'exec-container'])
inject('jobManagementTab', ref('info'))

const submitOpen = ref(false)
const activePanel = ref<'submit' | 'templates'>('submit')
const selectedJob = ref<any>(null)
const jobSubmitRef = ref<any>(null)
const jobInfoRef = ref<any>(null)
const allTemplates = ref([...jobTemplates])

const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token')

const applyTemplate = (tpl: any) => {
  activePanel.value = 'submit'
  setTimeout(() => { jobSubmitRef.value?.handleTemplateSelect?.(tpl) }, 50)
}

const handleUseTemplate = (tpl: any) => {
  activePanel.value = 'submit'
  setTimeout(() => { jobSubmitRef.value?.handleTemplateSelect?.(tpl) }, 50)
}

const handleViewDetail = (job: any) => { selectedJob.value = job }
const handleJobSubmitted = () => {
  submitOpen.value = false
  jobInfoRef.value?.loadJobs()
}

const handleCancel = async (jobId: string | number) => {
  if (!confirm(`确定要取消作业 ${jobId} 吗？`)) return
  try {
    const res = await fetch(`${getApiBase()}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '取消失败')
    alert(`作业 ${jobId} 已取消`)
    selectedJob.value = null
  } catch (e: any) { alert(`取消失败: ${e.message}`) }
}

const handlePause = async (jobId: string | number) => {
  if (!confirm(`确定要暂停作业 ${jobId} 吗？`)) return
  try {
    const res = await fetch(`${getApiBase()}/api/jobs/${jobId}/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '暂停失败')
    alert(`作业 ${jobId} 已暂停`)
    selectedJob.value = null
  } catch (e: any) { alert(`暂停失败: ${e.message}`) }
}

const handleOpenDirectory = (path: string) => { emit('open-directory', path) }

const handleExecContainer = (payload: { node: string; jobId: number; initCommand: string }) => {
  // 存入 sessionStorage，WebShell 挂载时读取并自动连接
  sessionStorage.setItem('webshell_auto_connect', JSON.stringify(payload))
  emit('exec-container')
}
</script>

<style scoped>
.job-management {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 1.25rem;
  box-sizing: border-box;
  gap: 1rem;
  overflow: hidden;
}

.job-list-pane {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.submit-pane {
  width: 460px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.submit-pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
}

.pane-tabs {
  display: flex;
  background: hsl(var(--muted));
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.pane-tab {
  padding: 4px 14px;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 5px;
  transition: all 0.15s;
  white-space: nowrap;
}
.pane-tab.active {
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.close-btn {
  background: none;
  border: none;
  font-size: 0.9rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
}
.close-btn:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }

.template-bar {
  padding: 10px 14px;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
  background: hsl(var(--muted) / 0.3);
}
.template-bar-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 7px;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}
.tpl-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 7px 9px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.tpl-card:hover {
  border-color: hsl(var(--foreground) / 0.25);
  background: hsl(var(--accent));
}
.tpl-icon { font-size: 0.95rem; line-height: 1; }
.tpl-name { font-size: 0.73rem; font-weight: 600; color: hsl(var(--foreground)); line-height: 1.2; }
.tpl-meta { font-size: 0.67rem; color: hsl(var(--muted-foreground)); }

.templates-pane {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.templates-pane::-webkit-scrollbar { width: 3px; }
.templates-pane::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 2px; }

.slide-enter-active, .slide-leave-active { transition: all 0.22s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(20px); width: 0; min-width: 0; }
</style>
