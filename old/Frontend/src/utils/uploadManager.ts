/**
 * 全局文件上传状态管理
 * 上传任务在组件外运行，切换页面不中断
 */
import { ref } from 'vue'
import { fileManagerApi } from '../config/api'

export interface UploadTask {
  id: number
  file: File
  path: string       // 上传目标目录
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export const uploadTasks = ref<UploadTask[]>([])
export const showUploadPanel = ref(false)

let taskIdSeq = 0
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''

/** 添加文件到上传队列并立即开始上传 */
export function enqueueUpload(files: File[], targetPath: string, onAllDone?: () => void) {
  const tasks: UploadTask[] = files.map(file => ({
    id: ++taskIdSeq,
    file,
    path: targetPath,
    progress: 0,
    status: 'pending',
  }))
  uploadTasks.value.unshift(...tasks)
  showUploadPanel.value = true

  const uploadOne = (task: UploadTask) =>
    new Promise<void>((resolve) => {
      task.status = 'uploading'
      const fd = new FormData()
      fd.append('file', task.file)
      fd.append('path', task.path)

      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          task.progress = Math.round((ev.loaded / ev.total) * 100)
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          task.status = 'done'
          task.progress = 100
        } else {
          task.status = 'error'
          try {
            task.error = JSON.parse(xhr.responseText).error || '上传失败'
          } catch { task.error = '上传失败' }
        }
        resolve()
      }
      xhr.onerror = () => {
        task.status = 'error'
        task.error = '网络错误'
        resolve()
      }
      xhr.open('POST', fileManagerApi.upload())
      xhr.setRequestHeader('Authorization', `Bearer ${token()}`)
      xhr.send(fd)
    })

  Promise.all(tasks.map(uploadOne)).then(() => {
    onAllDone?.()
    // 3 秒后自动清除已完成的任务
    setTimeout(() => {
      uploadTasks.value = uploadTasks.value.filter(t => t.status !== 'done')
      if (uploadTasks.value.length === 0) showUploadPanel.value = false
    }, 3000)
  })
}

/** 清除已完成/失败的任务 */
export function clearFinishedUploads() {
  uploadTasks.value = uploadTasks.value.filter(t => t.status === 'uploading')
  if (uploadTasks.value.length === 0) showUploadPanel.value = false
}
