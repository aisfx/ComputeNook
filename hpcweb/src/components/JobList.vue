<template>
  <div class="card job-list">
    <div class="list-header">
      <h2>📋 任务列表</h2>
      <button @click="$emit('refresh')" class="btn-secondary" :disabled="loading">
        {{ loading ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else-if="jobs.length === 0" class="empty">暂无任务</div>

    <table v-else class="jobs-table">
      <thead>
        <tr>
          <th>任务 ID</th>
          <th>任务名称</th>
          <th>状态</th>
          <th>分区</th>
          <th>节点/CPU</th>
          <th>提交时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="job in jobs" :key="job.id">
          <td><code>{{ job.id }}</code></td>
          <td>{{ job.name }}</td>
          <td><span :class="['status', `status-${job.status.toLowerCase()}`]">{{ job.status }}</span></td>
          <td>{{ job.partition }}</td>
          <td>{{ job.nodes }}N / {{ job.cpus }}C</td>
          <td>{{ job.submitTime }}</td>
          <td>
            <button @click="$emit('view-detail', job)" class="btn-link">查看</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  jobs: any[]
  loading: boolean
}>()

defineEmits(['view-detail', 'refresh'])
</script>
