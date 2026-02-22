<template>
  <div class="job-management">
    <JobInfo v-if="currentTab === 'info'" @view-detail="handleViewDetail" />
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

const currentTab = inject('jobManagementTab', ref('info'))
const selectedJob = ref<any>(null)
const jobSubmitRef = ref<any>(null)

const handleViewDetail = (job: any) => {
  selectedJob.value = job
}

const handleUseTemplate = (template: any) => {
  // 切换到提交作业页面
  currentTab.value = 'submit'
  // 等待组件渲染后应用模板
  setTimeout(() => {
    if (jobSubmitRef.value && jobSubmitRef.value.handleTemplateSelect) {
      jobSubmitRef.value.handleTemplateSelect(template)
    }
  }, 100)
}

const handlePause = (jobId: string) => {
  console.log('暂停作业:', jobId)
  alert(`作业 ${jobId} 已暂停`)
  selectedJob.value = null
}

const handleCancel = (jobId: string) => {
  if (confirm(`确定要取消作业 ${jobId} 吗？`)) {
    console.log('取消作业:', jobId)
    alert(`作业 ${jobId} 已取消`)
    selectedJob.value = null
  }
}

const handleOpenDirectory = (jobId: string, directory: string) => {
  console.log('打开作业目录:', directory)
  alert(`打开作业目录: ${directory}`)
}
</script>

<style scoped>
.job-management {
  display: flex;
  flex-direction: column;
}
</style>
