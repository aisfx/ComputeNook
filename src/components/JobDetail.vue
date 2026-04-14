<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>任务详情</h2>
        <button @click="$emit('close')" class="btn-close">✕</button>
      </div>
      
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item">
            <label>任务 ID</label>
            <span><code>{{ job.id }}</code></span>
          </div>
          <div class="detail-item">
            <label>任务名称</label>
            <span>{{ job.name }}</span>
          </div>
          <div class="detail-item">
            <label>状态</label>
            <span :class="['status', `status-${job.status.toLowerCase()}`]">{{ job.status }}</span>
          </div>
          <div class="detail-item">
            <label>分区</label>
            <span>{{ job.partition }}</span>
          </div>
          <div class="detail-item">
            <label>节点数</label>
            <span>{{ job.nodes }}</span>
          </div>
          <div class="detail-item">
            <label>CPU 核心数</label>
            <span>{{ job.cpus }}</span>
          </div>
          <div class="detail-item">
            <label>提交时间</label>
            <span>{{ job.submitTime }}</span>
          </div>
          <div class="detail-item" v-if="job.startTime">
            <label>开始时间</label>
            <span>{{ job.startTime }}</span>
          </div>
          <div class="detail-item" v-if="job.endTime">
            <label>结束时间</label>
            <span>{{ job.endTime }}</span>
          </div>
        </div>

        <div class="detail-actions">
          <button class="btn-danger" v-if="job.status === 'RUNNING' || job.status === 'PENDING'">取消任务</button>
          <button class="btn-secondary">查看日志</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  job: any
}>()

defineEmits(['close'])
</script>
