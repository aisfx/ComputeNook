<template>
  <div class="fm">
    <!-- 顶部工具栏 -->
    <div class="fm-toolbar">
      <div class="fm-nav">
        <button class="fm-btn fm-btn-icon" @click="goHome" title="主目录">
          <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
        <button class="fm-btn fm-btn-icon" @click="goUp" :disabled="!canGoUp" title="上级目录">
          <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <button class="fm-btn fm-btn-icon" @click="loadDirectory" title="刷新">
          <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        </button>
        <div class="fm-path-wrap">
          <svg class="fm-path-icon" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
          <input
            v-model="currentPath"
            @keyup.enter="loadDirectory"
            class="fm-path-input"
            placeholder="输入路径..."
            spellcheck="false"
          />
        </div>
      </div>
      <div class="fm-actions">
        <!-- 挂载到本地功能暂时禁用
        <button class="fm-btn fm-btn-mount" @click="launchMount" title="通过 HPC 客户端挂载为本地盘符">
          <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 3v2h2v2h-2v2h-2v-2H11v-2h2V9h2z"/></svg>
          挂载到本地
        </button>
        -->
        <button class="fm-btn fm-btn-primary" @click="showUploadDialog">
          <svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
          上传
        </button>
        <button class="fm-btn fm-btn-secondary" @click="showCreateFolderDialog">
          <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/></svg>
          新建文件夹
        </button>
        <button class="fm-btn fm-btn-secondary" @click="showCreateFileDialog">
          <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-1 5h-2v-2h2v2zm0 4h-2v-2h2v2zm4-4h-2v-2h2v2zm0 4h-2v-2h2v2z"/></svg>
          新建文件
        </button>
      </div>
    </div>

    <!-- 面包屑 -->
    <div class="fm-breadcrumb">
      <span
        v-for="(crumb, i) in breadcrumbs"
        :key="i"
        class="fm-crumb"
      >
        <span
          :class="['fm-crumb-text', { 'fm-crumb-link': i < breadcrumbs.length - 1 }]"
          @click="i < breadcrumbs.length - 1 && navigateToCrumb(i)"
        >{{ crumb }}</span>
        <svg v-if="i < breadcrumbs.length - 1" class="fm-crumb-sep" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </span>
    </div>

    <!-- 文件列表 -->
    <div class="fm-body" @click="selectedPaths.clear(); selectedPaths = new Set(selectedPaths)">
      <div v-if="loading" class="fm-loading">
        <div class="fm-spinner"></div>
        <span>加载中...</span>
      </div>

      <template v-else>
        <div v-if="sortedFiles.length === 0" class="fm-empty">
          <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
          <p>此目录为空</p>
        </div>

        <template v-else>
          <!-- 多选操作栏 -->
          <div v-if="selectedPaths.size > 0" class="fm-selection-bar" @click.stop>
            <span class="fm-sel-count">已选 {{ selectedPaths.size }} 项</span>
            <button class="fm-btn fm-btn-secondary fm-btn-sm" @click="batchCompressDownload">
              <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              压缩下载
            </button>
            <button class="fm-btn fm-btn-danger-sm fm-btn-sm" @click="batchDelete">
              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              批量删除
            </button>
            <button class="fm-btn fm-btn-secondary fm-btn-sm" @click="selectedPaths = new Set()">
              取消选择
            </button>
          </div>

          <table class="fm-table" @click.stop>
            <thead>
              <tr>
                <th class="col-check">
                  <input type="checkbox" class="fm-checkbox"
                    :checked="selectedPaths.size === sortedFiles.length && sortedFiles.length > 0"
                    :indeterminate="selectedPaths.size > 0 && selectedPaths.size < sortedFiles.length"
                    @change="toggleSelectAll"
                  />
                </th>
                <th class="col-icon"></th>
                <th class="col-name">名称</th>
                <th class="col-size">大小</th>
                <th class="col-time">修改时间</th>
                <th class="col-perm">权限</th>
                <th class="col-ops">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="file in sortedFiles"
                :key="file.path"
                @dblclick="handleDoubleClick(file)"
                @click.stop="toggleSelect(file, $event)"
                :class="['fm-row', { 'fm-row-selected': selectedPaths.has(file.path) }]"
              >
                <td class="col-check" @click.stop>
                  <input type="checkbox" class="fm-checkbox"
                    :checked="selectedPaths.has(file.path)"
                    @change="toggleSelect(file, $event)"
                  />
                </td>
                <td class="col-icon">
                  <div :class="['fm-icon', file.is_dir ? 'fm-icon-dir' : `fm-icon-${getFileType(file.name)}`]">
                    <component :is="file.is_dir ? IconFolder : getFileIconComp(file.name)" />
                  </div>
                </td>
                <td class="col-name">
                  <span :class="['fm-name', { 'fm-name-dir': file.is_dir }]">{{ file.name }}</span>
                </td>
                <td class="col-size">{{ file.is_dir ? '—' : formatSize(file.size) }}</td>
                <td class="col-time">{{ formatTime(file.mod_time) }}</td>
                <td class="col-perm"><code class="fm-perm">{{ file.permissions }}</code></td>
                <td class="col-ops" @click.stop>
                  <div class="fm-dropdown">
                    <button class="fm-op-toggle" :data-ops="file.path" @click.stop="openOps = openOps === file.path ? null : file.path">
                      操作 ▾
                    </button>
                    <Teleport to="body">
                      <div
                        v-if="openOps === file.path"
                        class="fm-dropdown-menu"
                        :style="getDropdownStyle(file.path)"
                        @click.stop
                      >
                        <button v-if="file.is_dir" class="fm-dropdown-item" @click="openDirectory(file); openOps = null">
                          <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
                          打开
                        </button>
                        <button v-if="!file.is_dir" class="fm-dropdown-item" @click="viewFile(file); openOps = null">
                          <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                          查看
                        </button>
                        <button v-if="!file.is_dir" class="fm-dropdown-item" @click="downloadFile(file); openOps = null">
                          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                          下载
                        </button>
                        <button v-if="!file.is_dir" class="fm-dropdown-item" @click="editFile(file); openOps = null">
                          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                          编辑
                        </button>
                        <button class="fm-dropdown-item" @click="compressDownload(file); openOps = null">
                          <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-4 6h-3v3h-2v-3H8v-2h3V7h2v3h3v2z"/></svg>
                          压缩下载
                        </button>
                        <button class="fm-dropdown-item" @click="renameFile(file); openOps = null">
                          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                          重命名
                        </button>
                        <div class="fm-dropdown-divider"></div>
                        <button class="fm-dropdown-item fm-dropdown-danger" @click="deleteFile(file); openOps = null">
                          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                          删除
                        </button>
                      </div>
                    </Teleport>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </template>
    </div>

    <!-- 输入弹窗 -->
    <Teleport to="body">
      <div v-if="inputDialog.visible" class="fm-modal-overlay" @click.self="inputDialog.visible = false">
        <div class="fm-dialog" @click.stop>
          <div class="fm-dialog-header">
            <span>{{ inputDialog.title }}</span>
            <button class="fm-modal-close" @click="inputDialog.visible = false">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
          <div class="fm-dialog-body">
            <label class="fm-dialog-label">{{ inputDialog.label }}</label>
            <input
              ref="dialogInput"
              v-model="inputDialog.value"
              class="fm-dialog-input"
              :placeholder="inputDialog.placeholder"
              @keyup.enter="inputDialog.onConfirm(inputDialog.value)"
              @keyup.esc="inputDialog.visible = false"
              spellcheck="false"
            />
          </div>
          <div class="fm-dialog-footer">
            <button class="fm-btn fm-btn-secondary" @click="inputDialog.visible = false">取消</button>
            <button class="fm-btn fm-btn-confirm" @click="inputDialog.onConfirm(inputDialog.value)" :disabled="!inputDialog.value.trim()">确定</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 确认弹窗 -->
    <Teleport to="body">
      <div v-if="confirmDialog.visible" class="fm-modal-overlay" @click.self="confirmDialog.visible = false">
        <div class="fm-dialog" @click.stop>
          <div class="fm-dialog-header">
            <span>{{ confirmDialog.title }}</span>
          </div>
          <div class="fm-dialog-body">
            <p class="fm-dialog-msg">{{ confirmDialog.message }}</p>
          </div>
          <div class="fm-dialog-footer">
            <button class="fm-btn fm-btn-secondary" @click="confirmDialog.visible = false">取消</button>
            <button class="fm-btn fm-btn-danger" @click="confirmDialog.onConfirm()">确定删除</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 文件查看/编辑弹窗 -->
    <Teleport to="body">
      <div v-if="showFileViewer" class="fm-modal-overlay" @click="closeFileViewer">
        <div class="fm-modal" @click.stop>
          <div class="fm-modal-header">
            <div class="fm-modal-title">
              <div :class="['fm-icon', `fm-icon-${getFileType(viewingFile?.name || '')}`]" style="width:28px;height:28px">
                <component :is="getFileIconComp(viewingFile?.name || '')" />
              </div>
              <span>{{ viewingFile?.name }}</span>
              <span v-if="isEditing" class="fm-edit-badge">编辑中</span>
            </div>
            <button class="fm-modal-close" @click="closeFileViewer">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
          <div class="fm-modal-body">
            <pre v-if="!isEditing" class="fm-file-content">{{ fileContent }}</pre>
            <textarea v-else v-model="fileContent" class="fm-file-editor" spellcheck="false"></textarea>
          </div>
          <div class="fm-modal-footer">
            <button class="fm-btn fm-btn-secondary" @click="closeFileViewer">关闭</button>
            <button v-if="!isEditing" class="fm-btn fm-btn-secondary" @click="isEditing = true">
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              编辑
            </button>
            <button v-if="isEditing" class="fm-btn fm-btn-secondary" @click="isEditing = false">取消编辑</button>
            <button v-if="isEditing" class="fm-btn fm-btn-primary" @click="saveFile" :disabled="saving">
              {{ saving ? '保存中...' : '💾 保存' }}
            </button>
            <button v-if="!isEditing" class="fm-btn fm-btn-primary" @click="downloadFile(viewingFile)">
              <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              下载
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineComponent, h, watch } from 'vue'
import { getUser } from '../utils/auth'
import notification from '../utils/notification'
import { fileManagerApi } from '../config/api'

// ── SVG 图标组件 ──────────────────────────────────────────────
const svg = (d: string) => defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24' }, [h('path', { d })]) })

const IconFolder   = svg('M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z')
const IconCode     = svg('M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z')
const IconImage    = svg('M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z')
const IconVideo    = svg('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z')
const IconAudio    = svg('M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z')
const IconArchive  = svg('M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 9h-2v2h-2v-2H8v-2h2v-2h2v2h2v2z')
const IconPdf      = svg('M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z')
const IconText     = svg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z')
const IconFile     = svg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z')

type FileType = 'dir'|'code'|'image'|'video'|'audio'|'archive'|'pdf'|'text'|'file'

const EXT_MAP: Record<string, FileType> = {
  py:'code', js:'code', ts:'code', go:'code', c:'code', cpp:'code', java:'code',
  sh:'code', bash:'code', html:'code', css:'code', json:'code', xml:'code', yaml:'code', yml:'code',
  jpg:'image', jpeg:'image', png:'image', gif:'image', svg:'image', webp:'image', bmp:'image',
  mp4:'video', avi:'video', mov:'video', mkv:'video',
  mp3:'audio', wav:'audio', flac:'audio', ogg:'audio',
  zip:'archive', tar:'archive', gz:'archive', bz2:'archive', xz:'archive', rar:'archive',
  pdf:'pdf',
  txt:'text', md:'text', log:'text', csv:'text',
}

const TYPE_ICONS: Record<FileType, any> = {
  dir: IconFolder, code: IconCode, image: IconImage, video: IconVideo,
  audio: IconAudio, archive: IconArchive, pdf: IconPdf, text: IconText, file: IconFile
}

const getFileType = (name: string): FileType => {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return EXT_MAP[ext] || 'file'
}

const getFileIconComp = (name: string) => TYPE_ICONS[getFileType(name)]

// ── 状态 ──────────────────────────────────────────────────────
const currentPath = ref('')
const files = ref<any[]>([])
const loading = ref(false)
const currentUser = ref<any>(null)
const showFileViewer = ref(false)
const viewingFile = ref<any>(null)
const fileContent = ref('')
const openOps = ref<string | null>(null)
const isEditing = ref(false)
const saving = ref(false)
const dialogInput = ref<HTMLInputElement | null>(null)

// 多选
let selectedPaths = ref<Set<string>>(new Set())

const toggleSelect = (file: any, e: Event) => {
  const newSet = new Set(selectedPaths.value)
  if (newSet.has(file.path)) newSet.delete(file.path)
  else newSet.add(file.path)
  selectedPaths.value = newSet
}

const toggleSelectAll = () => {
  if (selectedPaths.value.size === sortedFiles.value.length) {
    selectedPaths.value = new Set()
  } else {
    selectedPaths.value = new Set(sortedFiles.value.map((f: any) => f.path))
  }
}

const batchCompressDownload = () => {
  const paths = [...selectedPaths.value]
  if (!paths.length) return
  const params = paths.map(p => `path=${encodeURIComponent(p)}`).join('&')
  const url = `${fileManagerApi.compress()}?${params}&token=${token()}`
  const a = document.createElement('a')
  a.href = url; a.download = 'batch.zip'; a.style.display = 'none'
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  notification.success(`开始压缩下载 ${paths.length} 个文件`)
}

const batchDelete = async () => {
  const paths = [...selectedPaths.value]
  if (!paths.length) return
  const names = sortedFiles.value
    .filter((f: any) => paths.includes(f.path))
    .map((f: any) => f.name)
  if (!await showConfirmDialog('批量删除', `确定删除选中的 ${paths.length} 个文件/文件夹？此操作不可恢复！`)) return
  let failed = 0
  for (const path of paths) {
    try {
      const res = await fetch(`${fileManagerApi.delete()}?path=${encodeURIComponent(path)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
      })
      if (!res.ok) failed++
    } catch { failed++ }
  }
  selectedPaths.value = new Set()
  if (failed === 0) notification.success(`已删除 ${paths.length} 个文件`)
  else notification.error(`${paths.length - failed} 个成功，${failed} 个失败`)
  await loadDirectory()
}

// 输入弹窗
const inputDialog = ref({
  visible: false, title: '', label: '', placeholder: '', value: '',
  onConfirm: (_v: string) => {}
})

// 确认弹窗
const confirmDialog = ref({
  visible: false, title: '', message: '',
  onConfirm: () => {}
})

const showInputDialog = (title: string, label: string, defaultVal = '', placeholder = '') =>
  new Promise<string | null>(resolve => {
    inputDialog.value = {
      visible: true, title, label, placeholder, value: defaultVal,
      onConfirm: (v: string) => {
        if (!v.trim()) return
        inputDialog.value.visible = false
        resolve(v.trim())
      }
    }
    // 自动聚焦
    setTimeout(() => dialogInput.value?.focus(), 50)
    // 监听关闭（取消）
    const stop = watch(() => inputDialog.value.visible, (v) => {
      if (!v) { stop(); resolve(null) }
    })
  })

const showConfirmDialog = (title: string, message: string) =>
  new Promise<boolean>(resolve => {
    confirmDialog.value = {
      visible: true, title, message,
      onConfirm: () => { confirmDialog.value.visible = false; resolve(true) }
    }
    const stop = watch(() => confirmDialog.value.visible, (v) => {
      if (!v) { stop(); resolve(false) }
    })
  })

// 计算下拉菜单的绝对定位位置
const getDropdownStyle = (filePath: string) => {
  const btn = document.querySelector(`[data-ops="${CSS.escape(filePath)}"]`) as HTMLElement
  if (!btn) return {}
  const rect = btn.getBoundingClientRect()
  return {
    position: 'fixed' as const,
    top: `${rect.bottom + 4}px`,
    right: `${window.innerWidth - rect.right}px`,
    zIndex: 9999
  }
}

// 点击外部关闭
const handleGlobalClick = () => { openOps.value = null }

// ── 面包屑 ────────────────────────────────────────────────────
const breadcrumbs = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  return ['/', ...parts]
})

const navigateToCrumb = (index: number) => {
  if (index === 0) { currentPath.value = '/'; loadDirectory(); return }
  const parts = currentPath.value.split('/').filter(Boolean)
  currentPath.value = '/' + parts.slice(0, index).join('/')
  loadDirectory()
}

// ── 导航 ──────────────────────────────────────────────────────
const canGoUp = computed(() => {
  const home = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  return currentPath.value !== home && currentPath.value !== '/'
})

const sortedFiles = computed(() =>
  [...files.value].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
)

const goHome = () => {
  currentPath.value = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  loadDirectory()
}

const goUp = () => {
  if (!canGoUp.value) return
  const parts = currentPath.value.split('/').filter(Boolean)
  parts.pop()
  currentPath.value = '/' + parts.join('/')
  loadDirectory()
}

const navigateToPath = (path: string) => {
  if (!path || path === '-') { notification.error('无效的路径'); return }
  currentPath.value = path
  loadDirectory()
}

defineExpose({ navigateToPath })

// ── API ───────────────────────────────────────────────────────
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''

const loadDirectory = async () => {
  loading.value = true
  selectedPaths.value = new Set()
  try {
    const res = await fetch(`${fileManagerApi.list()}?path=${encodeURIComponent(currentPath.value)}`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || '读取目录失败')
    const data = await res.json()
    files.value = data.files || []
    currentPath.value = data.path || currentPath.value
  } catch (e: any) {
    notification.error(e.message || '读取目录失败')
    files.value = []
  } finally {
    loading.value = false
  }
}

const openDirectory = (file: any) => { currentPath.value = file.path; loadDirectory() }
const handleDoubleClick = (file: any) => file.is_dir ? openDirectory(file) : viewFile(file)

const viewFile = async (file: any) => {
  try {
    const res = await fetch(`${fileManagerApi.read()}?path=${encodeURIComponent(file.path)}`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || '读取文件失败')
    const data = await res.json()
    fileContent.value = data.content || ''
    viewingFile.value = file
    showFileViewer.value = true
  } catch (e: any) { notification.error(e.message) }
}

const closeFileViewer = () => { showFileViewer.value = false; viewingFile.value = null; fileContent.value = ''; isEditing.value = false }

const editFile = async (file: any) => {
  await viewFile(file)
  isEditing.value = true
}

const saveFile = async () => {
  if (!viewingFile.value) return
  saving.value = true
  try {
    const res = await fetch(fileManagerApi.write(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: viewingFile.value.path, content: fileContent.value })
    })
    if (!res.ok) throw new Error((await res.json()).error || '保存失败')
    notification.success('保存成功')
    isEditing.value = false
  } catch (e: any) { notification.error(e.message) }
  finally { saving.value = false }
}

const compressDownload = (file: any) => {
  const url = `${fileManagerApi.compress()}?path=${encodeURIComponent(file.path)}&token=${token()}`
  const a = document.createElement('a')
  a.href = url; a.download = file.name + '.zip'; a.style.display = 'none'
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  notification.success('开始压缩下载')
}

const downloadFile = (file: any) => {
  const url = `${fileManagerApi.download()}?path=${encodeURIComponent(file.path)}&token=${token()}`
  const a = document.createElement('a')
  a.href = url; a.download = file.name; a.style.display = 'none'
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  notification.success('开始下载')
}

const deleteFile = async (file: any) => {
  if (!await showConfirmDialog('确认删除', `确定删除 "${file.name}"？此操作不可恢复！`)) return
  try {
    const res = await fetch(`${fileManagerApi.delete()}?path=${encodeURIComponent(file.path)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || '删除失败')
    notification.success('删除成功'); await loadDirectory()
  } catch (e: any) { notification.error(e.message) }
}

const renameFile = async (file: any) => {
  const newName = await showInputDialog(`重命名`, '新名称', file.name, file.name)
  if (!newName || newName === file.name) return
  try {
    const parts = file.path.split('/'); parts[parts.length - 1] = newName
    const res = await fetch(fileManagerApi.rename(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_path: file.path, new_path: parts.join('/') })
    })
    if (!res.ok) throw new Error((await res.json()).error || '重命名失败')
    notification.success('重命名成功'); await loadDirectory()
  } catch (e: any) { notification.error(e.message) }
}

const showCreateFolderDialog = async () => {
  const name = await showInputDialog('新建文件夹', '文件夹名称', '', '请输入文件夹名称')
  if (!name) return
  try {
    const res = await fetch(fileManagerApi.mkdir(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `${currentPath.value}/${name}` })
    })
    if (!res.ok) throw new Error((await res.json()).error || '创建失败')
    notification.success('文件夹创建成功'); await loadDirectory()
  } catch (e: any) { notification.error(e.message) }
}

const showCreateFileDialog = async () => {
  const name = await showInputDialog('新建文件', '文件名称', '', '请输入文件名称')
  if (!name) return
  try {
    const res = await fetch(fileManagerApi.write(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `${currentPath.value}/${name}`, content: '' })
    })
    if (!res.ok) throw new Error((await res.json()).error || '创建失败')
    notification.success('文件创建成功'); await loadDirectory()
  } catch (e: any) { notification.error(e.message) }
}

// 通过 hpcc:// 拉起客户端挂载 WebDAV 为本地盘符/挂载点
const launchMount = async () => {
  const t = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  if (!t) { notification.error('请先登录'); return }
  // 根据系统给出默认挂载点提示
  const ua = navigator.userAgent
  let defaultMount = '/mnt/hpc'
  if (ua.includes('Windows')) defaultMount = 'Z:'
  else if (ua.includes('Mac')) defaultMount = '/Volumes/HPC'

  const mountPoint = await showInputDialog(
    '挂载到本地',
    `挂载点（Windows: Z:，macOS: /Volumes/HPC，Linux: /mnt/hpc）`,
    defaultMount,
    defaultMount
  )
  if (mountPoint === null) return // 用户取消

  const uri = `hpcc://mount?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(t)}&mountpoint=${encodeURIComponent(mountPoint)}&port=18080`
  window.location.href = uri
  notification.success(`正在启动挂载，挂载点: ${mountPoint}`)
}

const showUploadDialog = () => {  const input = document.createElement('input')
  input.type = 'file'; input.multiple = true
  input.onchange = async (e: any) => {
    for (const file of e.target.files) {
      const fd = new FormData(); fd.append('file', file); fd.append('path', currentPath.value)
      try {
        const res = await fetch(fileManagerApi.upload(), {
          method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd
        })
        if (!res.ok) throw new Error((await res.json()).error || '上传失败')
        notification.success(`"${file.name}" 上传成功`)
      } catch (e: any) { notification.error(`上传 "${file.name}" 失败: ${e.message}`) }
    }
    await loadDirectory()
  }
  input.click()
}

// ── 格式化 ────────────────────────────────────────────────────
const formatSize = (b: number) => {
  if (!b) return '0 B'
  const u = ['B','KB','MB','GB','TB'], i = Math.floor(Math.log(b) / Math.log(1024))
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i]
}

const formatTime = (s: string) => {
  try { return new Date(s).toLocaleString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) }
  catch { return s }
}

onMounted(() => {
  currentUser.value = getUser()
  currentPath.value = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`
  loadDirectory()
  document.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => { document.removeEventListener('click', handleGlobalClick) })
</script>

<style scoped>
/* ── 布局 ── */
.fm { display: flex; flex-direction: column; height: 100%; background: hsl(var(--background)); }

/* ── 工具栏 ── */
.fm-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding: 0.75rem 1.25rem;
  background: hsl(var(--card)); border-bottom: 1px solid hsl(var(--border));
  flex-wrap: wrap;
}
.fm-nav { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }

.fm-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border: none; border-radius: 7px;
  font-size: 0.82rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.fm-btn svg { width: 16px; height: 16px; fill: currentColor; flex-shrink: 0; }

.fm-btn-icon {
  padding: 0.45rem;
  background: hsl(var(--muted)); color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
}
.fm-btn-icon:hover:not(:disabled) { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
.fm-btn-icon:disabled { opacity: 0.35; cursor: not-allowed; }

.fm-btn-primary {
  background: hsl(var(--card)); color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border)); box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.fm-btn-primary:hover { background: hsl(var(--accent)); }

.fm-btn-secondary {
  background: hsl(var(--card)); color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border)); box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.fm-btn-secondary:hover { background: hsl(var(--accent)); }

.fm-btn-mount {
  background: hsl(var(--card)); color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border)); box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.fm-btn-mount:hover { background: hsl(var(--accent)); }

.fm-path-wrap {
  display: flex; align-items: center; gap: 0.5rem;
  flex: 1; min-width: 0;
  background: hsl(var(--muted)); border: 1.5px solid hsl(var(--border));
  border-radius: 8px; padding: 0 0.75rem; transition: border-color 0.15s;
}
.fm-path-wrap:focus-within { border-color: hsl(var(--ring)); background: hsl(var(--background)); }
.fm-path-icon { width: 16px; height: 16px; fill: hsl(var(--muted-foreground)); flex-shrink: 0; }

.fm-path-input {
  flex: 1; border: none; background: transparent;
  font-size: 0.85rem; font-family: 'SF Mono', 'Fira Code', monospace;
  color: hsl(var(--foreground)); padding: 0.45rem 0; outline: none;
}

.fm-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

/* ── 面包屑 ── */
.fm-breadcrumb {
  display: flex; align-items: center; flex-wrap: wrap;
  padding: 0.5rem 1.25rem;
  background: hsl(var(--card)); border-bottom: 1px solid hsl(var(--border));
  font-size: 0.82rem; color: hsl(var(--muted-foreground));
}
.fm-crumb { display: flex; align-items: center; }
.fm-crumb-text { padding: 0.15rem 0.3rem; border-radius: 4px; }
.fm-crumb-link { color: hsl(var(--sidebar-primary)); cursor: pointer; }
.fm-crumb-link:hover { background: hsl(var(--accent)); }
.fm-crumb-sep { width: 14px; height: 14px; fill: hsl(var(--border)); }

/* ── 主体 ── */
.fm-body { flex: 1; overflow: auto; padding: 1rem 1.25rem; }

/* ── 加载 ── */
.fm-loading {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.75rem; padding: 4rem;
  color: hsl(var(--muted-foreground)); font-size: 0.9rem;
}
.fm-spinner {
  width: 32px; height: 32px;
  border: 3px solid hsl(var(--border)); border-top-color: hsl(var(--sidebar-primary));
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── 空状态 ── */
.fm-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.75rem; padding: 4rem;
  color: hsl(var(--muted-foreground));
}
.fm-empty svg { width: 48px; height: 48px; fill: hsl(var(--border)); }
.fm-empty p { margin: 0; font-size: 0.9rem; }

/* ── 表格 ── */
.fm-table {
  width: 100%; border-collapse: collapse;
  background: hsl(var(--card)); border-radius: 10px;
  overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.fm-table thead { background: hsl(var(--muted) / 0.5); }
.fm-table th {
  padding: 0.7rem 1rem; text-align: left;
  font-size: 0.78rem; font-weight: 700;
  color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: .04em;
  border-bottom: 1.5px solid hsl(var(--border));
}
.fm-table td { padding: 0.6rem 1rem; border-bottom: 1px solid hsl(var(--border) / 0.5); }
.fm-row { transition: background 0.1s; cursor: default; }
.fm-row:hover { background: hsl(var(--accent) / 0.5); }
.fm-row:last-child td { border-bottom: none; }

.col-icon  { width: 44px; }
.col-size  { width: 90px; color: hsl(var(--muted-foreground)); font-size: 0.82rem; }
.col-time  { width: 160px; color: hsl(var(--muted-foreground)); font-size: 0.82rem; }
.col-perm  { width: 110px; }
.col-ops   { width: 140px; }

/* ── 文件图标 ── */
.fm-icon {
  width: 34px; height: 34px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.fm-icon svg { width: 18px; height: 18px; fill: currentColor; }

.fm-icon-dir     { background: #fff3e0; color: #f59e0b; }
.fm-icon-code    { background: #e8f5e9; color: #22c55e; }
.fm-icon-image   { background: #fce4ec; color: #ec4899; }
.fm-icon-video   { background: #e3f2fd; color: #3b82f6; }
.fm-icon-audio   { background: #f3e5f5; color: #a855f7; }
.fm-icon-archive { background: #fff8e1; color: #d97706; }
.fm-icon-pdf     { background: #ffebee; color: #ef4444; }
.fm-icon-text    { background: #e8eaf6; color: #6366f1; }
.fm-icon-file    { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }

[data-theme="dark"] .fm-icon-dir     { background: rgba(245,158,11,0.15); }
[data-theme="dark"] .fm-icon-code    { background: rgba(34,197,94,0.15); }
[data-theme="dark"] .fm-icon-image   { background: rgba(236,72,153,0.15); }
[data-theme="dark"] .fm-icon-video   { background: rgba(59,130,246,0.15); }
[data-theme="dark"] .fm-icon-audio   { background: rgba(168,85,247,0.15); }
[data-theme="dark"] .fm-icon-archive { background: rgba(217,119,6,0.15); }
[data-theme="dark"] .fm-icon-pdf     { background: rgba(239,68,68,0.15); }
[data-theme="dark"] .fm-icon-text    { background: rgba(99,102,241,0.15); }

/* ── 文件名 ── */
.fm-name { font-size: 0.88rem; color: hsl(var(--foreground)); }
.fm-name-dir { font-weight: 600; color: hsl(var(--sidebar-primary)); cursor: pointer; }
.fm-name-dir:hover { text-decoration: underline; }

/* ── 权限 ── */
.fm-perm {
  font-family: 'SF Mono', monospace; font-size: 0.75rem;
  background: hsl(var(--muted)); color: hsl(var(--muted-foreground));
  padding: 0.15rem 0.4rem; border-radius: 4px;
}

/* ── 操作下拉 ── */
.fm-dropdown { position: relative; display: inline-block; }

.fm-op-toggle {
  padding: 0.3rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: all 0.15s;
}
.fm-op-toggle:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }

.fm-dropdown-menu {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  min-width: 130px; overflow: hidden;
}

.fm-dropdown-item {
  display: flex; align-items: center; gap: 0.5rem;
  width: 100%; padding: 0.55rem 0.9rem;
  background: none; border: none; text-align: left;
  font-size: 0.85rem; color: hsl(var(--foreground));
  cursor: pointer; transition: background 0.12s;
}
.fm-dropdown-item svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }
.fm-dropdown-item:hover { background: hsl(var(--accent)); }
.fm-dropdown-danger { color: hsl(var(--destructive)); }
.fm-dropdown-danger:hover { background: hsl(var(--destructive) / 0.08); }
.fm-dropdown-divider { height: 1px; background: hsl(var(--border)); margin: 0.25rem 0; }

/* ── 弹窗 ── */
.fm-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 1.5rem;
}
.fm-modal {
  background: hsl(var(--card)); border-radius: 12px;
  width: 100%; max-width: 820px; max-height: 85vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,.2); overflow: hidden;
  border: 1px solid hsl(var(--border));
}
.fm-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; border-bottom: 1px solid hsl(var(--border));
}
.fm-modal-title {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.95rem; font-weight: 600; color: hsl(var(--foreground));
}
.fm-modal-close {
  width: 32px; height: 32px; border: none; border-radius: 6px;
  background: transparent; color: hsl(var(--muted-foreground)); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.fm-modal-close svg { width: 18px; height: 18px; fill: currentColor; }
.fm-modal-close:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }

.fm-modal-body { flex: 1; overflow: auto; padding: 1.25rem; }
.fm-file-content {
  margin: 0; padding: 1rem 1.25rem;
  background: #1e1e2e; color: #cdd6f4;
  border-radius: 8px; font-family: 'SF Mono','Fira Code',monospace;
  font-size: 0.85rem; line-height: 1.65;
  white-space: pre-wrap; word-break: break-all;
}
.fm-file-editor {
  width: 100%; height: 100%; min-height: 400px;
  padding: 1rem 1.25rem; box-sizing: border-box;
  background: #1e1e2e; color: #cdd6f4;
  border: none; border-radius: 8px;
  font-family: 'SF Mono','Fira Code',monospace;
  font-size: 0.85rem; line-height: 1.65;
  resize: vertical; outline: none;
}
.fm-edit-badge {
  font-size: 0.72rem; font-weight: 600;
  background: #fef3c7; color: #d97706;
  padding: 0.15rem 0.5rem; border-radius: 4px; margin-left: 0.5rem;
}
.fm-modal-footer {
  display: flex; justify-content: flex-end; gap: 0.75rem;
  padding: 1rem 1.25rem; border-top: 1px solid hsl(var(--border));
}

/* ── 输入/确认弹窗 ── */
.fm-dialog {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  width: 100%; max-width: 420px;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
  overflow: hidden;
}
.fm-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.9rem 1.25rem; border-bottom: 1px solid hsl(var(--border));
  font-size: 0.95rem; font-weight: 600; color: hsl(var(--foreground));
}
.fm-dialog-body { padding: 1.25rem; }
.fm-dialog-label {
  display: block; font-size: 0.82rem; font-weight: 500;
  color: hsl(var(--muted-foreground)); margin-bottom: 0.5rem;
}
.fm-dialog-input {
  width: 100%; padding: 0.55rem 0.75rem; box-sizing: border-box;
  border: 1.5px solid hsl(var(--border)); border-radius: 8px;
  background: hsl(var(--background)); color: hsl(var(--foreground));
  font-size: 0.875rem; outline: none; transition: border-color 0.15s;
}
.fm-dialog-input:focus { border-color: hsl(var(--ring)); }
.fm-dialog-msg { margin: 0; font-size: 0.875rem; color: hsl(var(--foreground)); line-height: 1.6; }
.fm-dialog-footer {
  display: flex; justify-content: flex-end; gap: 0.75rem;
  padding: 0.9rem 1.25rem; border-top: 1px solid hsl(var(--border));
}
.fm-btn-confirm {
  background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
  border: none; padding: 0.45rem 1.1rem; border-radius: 7px;
  font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
}
.fm-btn-confirm:hover:not(:disabled) { opacity: 0.88; }
.fm-btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.fm-btn-danger {
  background: hsl(var(--destructive)); color: hsl(var(--destructive-foreground));
  border: none; padding: 0.45rem 1.1rem; border-radius: 7px;
  font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
}
.fm-btn-danger:hover { opacity: 0.88; }

/* ── 多选 ── */
.col-check { width: 36px; }
.fm-checkbox { width: 15px; height: 15px; cursor: pointer; accent-color: hsl(var(--primary)); }
.fm-row-selected { background: hsl(var(--primary) / 0.07) !important; }
.fm-row-selected:hover { background: hsl(var(--primary) / 0.12) !important; }

.fm-selection-bar {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 1rem; margin-bottom: 0.75rem;
  background: hsl(var(--primary) / 0.08);
  border: 1px solid hsl(var(--primary) / 0.2);
  border-radius: 8px;
}
.fm-sel-count { font-size: 0.82rem; font-weight: 600; color: hsl(var(--primary)); flex: 1; }
.fm-btn-sm { padding: 0.3rem 0.75rem; font-size: 0.78rem; }
.fm-btn-danger-sm {
  background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive));
  border: 1px solid hsl(var(--destructive) / 0.3);
  border-radius: 7px; font-weight: 600; cursor: pointer; transition: all 0.15s;
  display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap;
}
.fm-btn-danger-sm svg { width: 14px; height: 14px; fill: currentColor; }
.fm-btn-danger-sm:hover { background: hsl(var(--destructive)); color: #fff; }
</style>
