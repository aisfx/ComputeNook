<template>
  <div class="registry-page">
    <!-- 左侧项目列表 -->
    <div class="project-panel">
      <div class="panel-header">
        <span class="panel-title">📦 项目</span>
        <button class="btn-refresh" @click="loadProjects" title="刷新">↻</button>
      </div>
      <div v-if="loadingProjects" class="loading-tip">加载中...</div>
      <div v-else class="project-list">
        <div
          v-for="p in projects"
          :key="p.name"
          :class="['project-item', { active: selectedProject === p.name }]"
          @click="selectProject(p)"
        >
          <span class="project-icon">{{ p.is_own_project ? '👤' : '🌐' }}</span>
          <span class="project-name">{{ p.name }}</span>
          <div class="project-badges">
            <span v-if="p.is_own_project" class="badge-private">私有</span>
            <span v-else class="badge-public">公开</span>
            <span class="project-count">{{ p.repo_count || p.repository_count || 0 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧镜像列表 -->
    <div class="repo-panel">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-title">
            {{ selectedProject ? `🗂 ${selectedProject}` : '请选择项目' }}
          </span>
          <span v-if="selectedProjectMeta" :class="['access-badge', selectedProjectMeta.can_write ? 'rw' : 'ro']">
            {{ selectedProjectMeta.can_write ? '可读写' : '只读' }}
          </span>
        </div>
        <div class="header-actions">
          <input v-model="searchText" class="search-input" placeholder="搜索镜像..." />
          <button class="btn-pull" @click="showPullDialog = true">📥 使用说明</button>
        </div>
      </div>

      <div v-if="!selectedProject" class="empty-tip">
        <div class="empty-icon">🗄️</div>
        <p>从左侧选择一个项目</p>
      </div>
      <div v-else-if="loadingRepos" class="empty-tip">
        <div class="empty-icon">⏳</div>
        <p>加载中...</p>
      </div>
      <div v-else-if="filteredRepos.length === 0" class="empty-tip">
        <div class="empty-icon">📭</div>
        <p>暂无镜像</p>
      </div>
      <div v-else class="repo-grid">
        <div v-for="repo in filteredRepos" :key="repo.name" class="repo-card">
          <div class="repo-card-header">
            <span class="repo-icon">🐳</span>
            <div class="repo-info">
              <div class="repo-name">{{ shortRepoName(repo.name) }}</div>
              <div class="repo-meta">
                {{ repo.artifact_count || 0 }} 个版本
                · 更新于 {{ formatTime(repo.update_time) }}
              </div>
            </div>
          </div>
          <div class="repo-tags" v-if="repo.tags && repo.tags.length">
            <span v-for="tag in repo.tags.slice(0, 4)" :key="tag" class="tag-badge">{{ tag }}</span>
            <span v-if="repo.tags.length > 4" class="tag-more">+{{ repo.tags.length - 4 }}</span>
          </div>
          <div class="repo-actions">
            <button class="btn-sm" @click="copyPullCmd(repo.name)">📋 复制地址</button>
            <button
              v-if="selectedProjectMeta?.can_write"
              class="btn-sm danger"
              @click="confirmDelete(repo)"
            >🗑 删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用镜像说明弹窗 -->
    <Teleport to="body">
      <div v-if="showPullDialog" class="modal-overlay" @click="showPullDialog = false">
        <div class="modal-box" @click.stop>
          <div class="modal-header">
            <h3>📥 如何使用镜像</h3>
            <button @click="showPullDialog = false" class="btn-close">✕</button>
          </div>
          <div class="modal-body">
            <p class="tip-text">在提交作业时选择"容器作业"，填入镜像地址即可。Slurm 通过 Pyxis/Enroot 自动拉取并运行。</p>
            <div class="code-block">
              <div class="code-label">示例 sbatch 脚本</div>
              <pre>#!/bin/bash
#SBATCH -J container_job
#SBATCH -p compute
#SBATCH -N 1
#SBATCH -c 4
#SBATCH --container-image={{ harborHost }}/library/pytorch:latest
#SBATCH --container-mounts=/home/$USER:/workspace

python /workspace/train.py</pre>
            </div>
            <div class="code-block">
              <div class="code-label">Harbor 地址</div>
              <pre>{{ harborHost || '（未配置 HARBOR_URL）' }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- 提交容器作业弹窗已移至作业提交页面 -->
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getApiBase } from '../utils/auth'
import notification from '../utils/notification'

const projects = ref<any[]>([])
const selectedProject = ref('')
const selectedProjectMeta = ref<any>(null)
const repos = ref<any[]>([])
const searchText = ref('')
const loadingProjects = ref(false)
const loadingRepos = ref(false)
const showPullDialog = ref(false)
const harborHost = ref('')
const userProject = ref('')
const isAdmin = ref(false)

const token = () => localStorage.getItem('token') || sessionStorage.getItem('token')

const filteredRepos = computed(() =>
  searchText.value
    ? repos.value.filter(r => r.name?.toLowerCase().includes(searchText.value.toLowerCase()))
    : repos.value
)

const loadConfig = async () => {
  try {
    const res = await fetch(`${getApiBase()}/api/registry/config`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
    const data = await res.json()
    harborHost.value = (data.harbor_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
    userProject.value = data.user_project || ''
    isAdmin.value = data.is_admin || false
  } catch { /* ignore */ }
}

const loadProjects = async () => {
  loadingProjects.value = true
  try {
    const res = await fetch(`${getApiBase()}/api/registry/projects`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
    const data = await res.json()
    projects.value = data.data || []
  } catch (e: any) {
    notification.error('加载项目失败: ' + e.message)
  } finally {
    loadingProjects.value = false
  }
}

const selectProject = async (project: any) => {
  selectedProject.value = project.name
  selectedProjectMeta.value = project
  loadingRepos.value = true
  repos.value = []
  try {
    const res = await fetch(`${getApiBase()}/api/registry/projects/${project.name}/repositories`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
    const data = await res.json()
    const list: any[] = data.data || []
    // 并发加载每个 repo 的 tags
    await Promise.all(list.map(async (repo) => {
      const repoName = encodeURIComponent(shortRepoName(repo.name))
      try {
        const tr = await fetch(
          `${getApiBase()}/api/registry/projects/${project.name}/repositories/${repoName}/tags`,
          { headers: { Authorization: `Bearer ${token()}` } }
        )
        const td = await tr.json()
        repo.tags = (td.data || []).flatMap((a: any) => (a.tags || []).map((t: any) => t.name))
      } catch { repo.tags = [] }
    }))
    repos.value = list
  } catch (e: any) {
    notification.error('加载镜像失败: ' + e.message)
  } finally {
    loadingRepos.value = false
  }
}

const shortRepoName = (fullName: string) => {
  const parts = fullName.split('/')
  return parts[parts.length - 1]
}

const formatTime = (t: string) => {
  if (!t) return '-'
  return new Date(t).toLocaleDateString('zh-CN')
}

const copyPullCmd = (repoName: string) => {
  const addr = `${harborHost.value}/${selectedProject.value}/${shortRepoName(repoName)}:latest`
  navigator.clipboard.writeText(addr)
  notification.success('镜像地址已复制')
}

const confirmDelete = async (repo: any) => {
  const name = shortRepoName(repo.name)
  if (!confirm(`确定删除镜像 ${name} 吗？此操作不可恢复。`)) return
  try {
    const res = await fetch(
      `${getApiBase()}/api/registry/projects/${selectedProject.value}/repositories/${encodeURIComponent(name)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '删除失败')
    notification.success('删除成功')
    selectProject(selectedProjectMeta.value)
  } catch (e: any) {
    notification.error(e.message)
  }
}

onMounted(async () => {
  await loadConfig()
  await loadProjects()
  // 默认选中用户自己的私有项目
  const own = projects.value.find(p => p.name === userProject.value)
  if (own) selectProject(own)
})
</script>

<style scoped>
.registry-page {
  display: flex;
  gap: 1rem;
  height: 100%;
  overflow: hidden;
}

.project-panel {
  width: 200px;
  flex-shrink: 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.repo-panel {
  flex: 1;
  min-width: 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
  gap: 8px;
}

.panel-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  padding: 5px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  font-size: 0.82rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  width: 180px;
}
.search-input:focus { border-color: hsl(var(--ring)); }

.btn-refresh {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: hsl(var(--muted-foreground));
  padding: 2px 6px;
  border-radius: 4px;
}
.btn-refresh:hover { background: hsl(var(--accent)); }

.btn-pull {
  padding: 5px 12px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  color: hsl(var(--foreground));
}
.btn-pull:hover { background: hsl(var(--accent)); }

.loading-tip, .empty-tip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
  gap: 8px;
  padding: 2rem;
}
.empty-icon { font-size: 2.5rem; opacity: 0.4; }

.project-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 0.82rem;
  color: hsl(var(--foreground));
  transition: background 0.15s;
}
.project-item:hover { background: hsl(var(--accent)); }
.project-item.active { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }

.project-icon { font-size: 0.9rem; }
.project-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.project-count {
  font-size: 0.7rem;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  padding: 1px 6px;
  border-radius: 10px;
}
.project-item.active .project-count {
  background: hsl(var(--primary-foreground) / 0.2);
  color: hsl(var(--primary-foreground));
}
.badge-private {
  font-size: 0.62rem;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(239,68,68,0.12);
  color: #ef4444;
  font-weight: 600;
}
.badge-public {
  font-size: 0.62rem;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(16,185,129,0.12);
  color: #10b981;
  font-weight: 600;
}
.project-item.active .badge-private,
.project-item.active .badge-public {
  background: hsl(var(--primary-foreground) / 0.2);
  color: hsl(var(--primary-foreground));
}

.panel-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.access-badge {
  font-size: 0.68rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.access-badge.rw {
  background: rgba(59,130,246,0.1);
  color: #3b82f6;
}
.access-badge.ro {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.repo-grid {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  align-content: start;
}

.repo-card {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.15s;
}
.repo-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }

.repo-card-header { display: flex; align-items: flex-start; gap: 10px; }
.repo-icon { font-size: 1.5rem; line-height: 1; }
.repo-info { flex: 1; min-width: 0; }
.repo-name { font-size: 0.88rem; font-weight: 600; color: hsl(var(--foreground)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.repo-meta { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin-top: 2px; }

.repo-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tag-badge {
  padding: 2px 8px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  border-radius: 10px;
  font-size: 0.72rem;
  font-family: monospace;
}
.tag-more { font-size: 0.72rem; color: hsl(var(--muted-foreground)); padding: 2px 4px; }

.repo-actions { display: flex; gap: 5px; flex-wrap: wrap; }

.btn-sm {
  padding: 4px 10px;
  font-size: 0.75rem;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  cursor: pointer;
  color: hsl(var(--foreground));
  transition: background 0.15s;
  white-space: nowrap;
}
.btn-sm:hover { background: hsl(var(--accent)); }
.btn-sm.primary { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-color: transparent; }
.btn-sm.primary:hover { opacity: 0.9; }
.btn-sm.danger { color: #ef4444; border-color: rgba(239,68,68,0.25); }
.btn-sm.danger:hover { background: #fef2f2; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 1.5rem;
}
.modal-box {
  background: hsl(var(--card));
  border-radius: 12px;
  width: 100%; max-width: 680px;
  max-height: 85vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  overflow: hidden;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid hsl(var(--border));
}
.modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.btn-close {
  background: none; border: none; font-size: 1rem;
  color: hsl(var(--muted-foreground)); cursor: pointer;
  padding: 4px 8px; border-radius: 4px;
}
.btn-close:hover { background: hsl(var(--accent)); }
.modal-body { padding: 18px; overflow-y: auto; flex: 1; }

.tip-text { font-size: 0.85rem; color: hsl(var(--muted-foreground)); margin-bottom: 14px; }
.code-block { margin-bottom: 14px; }
.code-label { font-size: 0.72rem; font-weight: 600; color: hsl(var(--muted-foreground)); text-transform: uppercase; margin-bottom: 6px; }
.code-block pre {
  background: #1e293b; color: #e2e8f0;
  padding: 12px 14px; border-radius: 8px;
  font-size: 0.82rem; line-height: 1.6;
  overflow-x: auto; margin: 0;
}
</style>
