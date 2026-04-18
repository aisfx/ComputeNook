<template>
  <div class="job-management">
    <JobInfo v-if="currentTab === 'info'" @view-detail="handleViewDetail" @open-directory="handleOpenDirectory" />
    <JobSubmit v-else-if="currentTab === 'submit'" ref="jobSubmitRef" />
    <JobTemplates v-else-if="currentTab === 'templates'" @use-template="handleUseTemplate" />

    <!-- 作业详情弹窗 -->
    <JobDetailModal 
      v-if="selectedJob" 
      :job="selectedJob" 
      @close="selectedJob = null"
      @pause="handlePause"
      @cancel="handleCancel"
      @open-directory="handleOpenDirectory"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import JobInfo from '../components/JobInfo.vue'
import JobSubmit from '../components/JobSubmit.vue'
import JobTemplates from '../components/JobTemplates.vue'
import JobDetailModal from '../components/JobDetailModal.vue'
import { getApiBase } from '../utils/auth'

const emit = defineEmits(['open-directory'])

const currentTab = inject('jobManagementTab', ref('info'))
const selectedJob = ref<any>(null)
const jobSubmitRef = ref<any>(null)

const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token')

const handleViewDetail = (job: any) => {
  selectedJob.value = job
}

const handleUseTemplate = (template: any) => {
  currentTab.value = 'submit'
  setTimeout(() => {
    if (jobSubmitRef.value?.handleTemplateSelect) {
      jobSubmitRef.value.handleTemplateSelect(template)
    }
  }, 100)
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
  } catch (e: any) {
    alert(`取消失败: ${e.message}`)
  }
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
  } catch (e: any) {
    alert(`暂停失败: ${e.message}`)
  }
}

const handleOpenDirectory = (path: string) => {
  emit('open-directory', path)
}
</script>

<style scoped>
.job-management {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 1.5rem;
  box-sizing: border-box;
}
</style>
