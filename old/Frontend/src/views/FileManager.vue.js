/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, onUnmounted, defineComponent, h, watch } from 'vue';
import { getUser } from '../utils/auth';
import notification from '../utils/notification';
import { fileManagerApi } from '../config/api';
import { enqueueUpload, clearFinishedUploads } from '../utils/uploadManager';
// ── SVG 图标组件 ──────────────────────────────────────────────
const svg = (d) => defineComponent({ render: () => h('svg', { viewBox: '0 0 24 24' }, [h('path', { d })]) });
const IconFolder = svg('M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z');
const IconCode = svg('M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z');
const IconImage = svg('M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z');
const IconVideo = svg('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z');
const IconAudio = svg('M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z');
const IconArchive = svg('M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 9h-2v2h-2v-2H8v-2h2v-2h2v2h2v2z');
const IconPdf = svg('M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z');
const IconText = svg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z');
const IconFile = svg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z');
const EXT_MAP = {
    py: 'code', js: 'code', ts: 'code', go: 'code', c: 'code', cpp: 'code', java: 'code',
    sh: 'code', bash: 'code', html: 'code', css: 'code', json: 'code', xml: 'code', yaml: 'code', yml: 'code',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image', webp: 'image', bmp: 'image',
    mp4: 'video', avi: 'video', mov: 'video', mkv: 'video',
    mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio',
    zip: 'archive', tar: 'archive', gz: 'archive', bz2: 'archive', xz: 'archive', rar: 'archive',
    pdf: 'pdf',
    txt: 'text', md: 'text', log: 'text', csv: 'text',
};
const TYPE_ICONS = {
    dir: IconFolder, code: IconCode, image: IconImage, video: IconVideo,
    audio: IconAudio, archive: IconArchive, pdf: IconPdf, text: IconText, file: IconFile
};
const getFileType = (name) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return EXT_MAP[ext] || 'file';
};
const getFileIconComp = (name) => TYPE_ICONS[getFileType(name)];
// ── 状态 ──────────────────────────────────────────────────────
const currentPath = ref('');
const files = ref([]);
const loading = ref(false);
const currentUser = ref(null);
const showFileViewer = ref(false);
const viewingFile = ref(null);
const fileContent = ref('');
const openOps = ref(null);
const isEditing = ref(false);
const saving = ref(false);
const dialogInput = ref(null);
// 多选
let selectedPaths = ref(new Set());
const toggleSelect = (file, e) => {
    const newSet = new Set(selectedPaths.value);
    if (newSet.has(file.path))
        newSet.delete(file.path);
    else
        newSet.add(file.path);
    selectedPaths.value = newSet;
};
const toggleSelectAll = () => {
    if (selectedPaths.value.size === sortedFiles.value.length) {
        selectedPaths.value = new Set();
    }
    else {
        selectedPaths.value = new Set(sortedFiles.value.map((f) => f.path));
    }
};
const batchCompressDownload = () => {
    const paths = [...selectedPaths.value];
    if (!paths.length)
        return;
    const params = paths.map(p => `path=${encodeURIComponent(p)}`).join('&');
    const url = `${fileManagerApi.compress()}?${params}&token=${token()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch.zip';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notification.success(`开始压缩下载 ${paths.length} 个文件`);
};
const batchDelete = async () => {
    const paths = [...selectedPaths.value];
    if (!paths.length)
        return;
    const names = sortedFiles.value
        .filter((f) => paths.includes(f.path))
        .map((f) => f.name);
    if (!await showConfirmDialog('批量删除', `确定删除选中的 ${paths.length} 个文件/文件夹？此操作不可恢复！`))
        return;
    let failed = 0;
    for (const path of paths) {
        try {
            const res = await fetch(`${fileManagerApi.delete()}?path=${encodeURIComponent(path)}`, {
                method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
            });
            if (!res.ok)
                failed++;
        }
        catch {
            failed++;
        }
    }
    selectedPaths.value = new Set();
    if (failed === 0)
        notification.success(`已删除 ${paths.length} 个文件`);
    else
        notification.error(`${paths.length - failed} 个成功，${failed} 个失败`);
    await loadDirectory();
};
// 输入弹窗
const inputDialog = ref({
    visible: false, title: '', label: '', placeholder: '', value: '',
    onConfirm: (_v) => { }
});
// 确认弹窗
const confirmDialog = ref({
    visible: false, title: '', message: '',
    onConfirm: () => { }
});
const showInputDialog = (title, label, defaultVal = '', placeholder = '') => new Promise(resolve => {
    inputDialog.value = {
        visible: true, title, label, placeholder, value: defaultVal,
        onConfirm: (v) => {
            if (!v.trim())
                return;
            inputDialog.value.visible = false;
            resolve(v.trim());
        }
    };
    // 自动聚焦
    setTimeout(() => dialogInput.value?.focus(), 50);
    // 监听关闭（取消）
    const stop = watch(() => inputDialog.value.visible, (v) => {
        if (!v) {
            stop();
            resolve(null);
        }
    });
});
const showConfirmDialog = (title, message) => new Promise(resolve => {
    confirmDialog.value = {
        visible: true, title, message,
        onConfirm: () => { confirmDialog.value.visible = false; resolve(true); }
    };
    const stop = watch(() => confirmDialog.value.visible, (v) => {
        if (!v) {
            stop();
            resolve(false);
        }
    });
});
// 计算下拉菜单的绝对定位位置
const getDropdownStyle = (filePath) => {
    const btn = document.querySelector(`[data-ops="${CSS.escape(filePath)}"]`);
    if (!btn)
        return {};
    const rect = btn.getBoundingClientRect();
    return {
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        right: `${window.innerWidth - rect.right}px`,
        zIndex: 9999
    };
};
// 点击外部关闭
const handleGlobalClick = () => { openOps.value = null; };
// ── 面包屑 ────────────────────────────────────────────────────
const breadcrumbs = computed(() => {
    const parts = currentPath.value.split('/').filter(Boolean);
    return ['/', ...parts];
});
const navigateToCrumb = (index) => {
    if (index === 0) {
        currentPath.value = '/';
        loadDirectory();
        return;
    }
    const parts = currentPath.value.split('/').filter(Boolean);
    currentPath.value = '/' + parts.slice(0, index).join('/');
    loadDirectory();
};
// ── 导航 ──────────────────────────────────────────────────────
const canGoUp = computed(() => {
    const home = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
    return currentPath.value !== home && currentPath.value !== '/';
});
const sortedFiles = computed(() => [...files.value].sort((a, b) => {
    if (a.is_dir !== b.is_dir)
        return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
}));
const goHome = () => {
    currentPath.value = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
    loadDirectory();
};
const goUp = () => {
    if (!canGoUp.value)
        return;
    const parts = currentPath.value.split('/').filter(Boolean);
    parts.pop();
    currentPath.value = '/' + parts.join('/');
    loadDirectory();
};
const navigateToPath = (path) => {
    if (!path || path === '-') {
        notification.error('无效的路径');
        return;
    }
    currentPath.value = path;
    loadDirectory();
};
const __VLS_exposed = { navigateToPath };
defineExpose(__VLS_exposed);
// ── API ───────────────────────────────────────────────────────
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || '';
const loadDirectory = async () => {
    loading.value = true;
    selectedPaths.value = new Set();
    try {
        const res = await fetch(`${fileManagerApi.list()}?path=${encodeURIComponent(currentPath.value)}`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (!res.ok)
            throw new Error((await res.json()).error || '读取目录失败');
        const data = await res.json();
        files.value = data.files || [];
        currentPath.value = data.path || currentPath.value;
    }
    catch (e) {
        notification.error(e.message || '读取目录失败');
        files.value = [];
    }
    finally {
        loading.value = false;
    }
};
const openDirectory = (file) => { currentPath.value = file.path; loadDirectory(); };
const handleDoubleClick = (file) => file.is_dir ? openDirectory(file) : viewFile(file);
const viewFile = async (file) => {
    try {
        const res = await fetch(`${fileManagerApi.read()}?path=${encodeURIComponent(file.path)}`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (!res.ok)
            throw new Error((await res.json()).error || '读取文件失败');
        const data = await res.json();
        fileContent.value = data.content || '';
        viewingFile.value = file;
        showFileViewer.value = true;
    }
    catch (e) {
        notification.error(e.message);
    }
};
const closeFileViewer = () => { showFileViewer.value = false; viewingFile.value = null; fileContent.value = ''; isEditing.value = false; };
const editFile = async (file) => {
    await viewFile(file);
    isEditing.value = true;
};
const saveFile = async () => {
    if (!viewingFile.value)
        return;
    saving.value = true;
    try {
        const res = await fetch(fileManagerApi.write(), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: viewingFile.value.path, content: fileContent.value })
        });
        if (!res.ok)
            throw new Error((await res.json()).error || '保存失败');
        notification.success('保存成功');
        isEditing.value = false;
    }
    catch (e) {
        notification.error(e.message);
    }
    finally {
        saving.value = false;
    }
};
const compressDownload = (file) => {
    const url = `${fileManagerApi.compress()}?path=${encodeURIComponent(file.path)}&token=${token()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name + '.zip';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notification.success('开始压缩下载');
};
const downloadFile = (file) => {
    const url = `${fileManagerApi.download()}?path=${encodeURIComponent(file.path)}&token=${token()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notification.success('开始下载');
};
const deleteFile = async (file) => {
    if (!await showConfirmDialog('确认删除', `确定删除 "${file.name}"？此操作不可恢复！`))
        return;
    try {
        const res = await fetch(`${fileManagerApi.delete()}?path=${encodeURIComponent(file.path)}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
        });
        if (!res.ok)
            throw new Error((await res.json()).error || '删除失败');
        notification.success('删除成功');
        await loadDirectory();
    }
    catch (e) {
        notification.error(e.message);
    }
};
const renameFile = async (file) => {
    const newName = await showInputDialog(`重命名`, '新名称', file.name, file.name);
    if (!newName || newName === file.name)
        return;
    try {
        const parts = file.path.split('/');
        parts[parts.length - 1] = newName;
        const res = await fetch(fileManagerApi.rename(), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_path: file.path, new_path: parts.join('/') })
        });
        if (!res.ok)
            throw new Error((await res.json()).error || '重命名失败');
        notification.success('重命名成功');
        await loadDirectory();
    }
    catch (e) {
        notification.error(e.message);
    }
};
const showCreateFolderDialog = async () => {
    const name = await showInputDialog('新建文件夹', '文件夹名称', '', '请输入文件夹名称');
    if (!name)
        return;
    try {
        const res = await fetch(fileManagerApi.mkdir(), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: `${currentPath.value}/${name}` })
        });
        if (!res.ok)
            throw new Error((await res.json()).error || '创建失败');
        notification.success('文件夹创建成功');
        await loadDirectory();
    }
    catch (e) {
        notification.error(e.message);
    }
};
const showCreateFileDialog = async () => {
    const name = await showInputDialog('新建文件', '文件名称', '', '请输入文件名称');
    if (!name)
        return;
    try {
        const res = await fetch(fileManagerApi.write(), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: `${currentPath.value}/${name}`, content: '' })
        });
        if (!res.ok)
            throw new Error((await res.json()).error || '创建失败');
        notification.success('文件创建成功');
        await loadDirectory();
    }
    catch (e) {
        notification.error(e.message);
    }
};
// 通过 hpcc:// 拉起客户端挂载 WebDAV 为本地盘符/挂载点
const launchMount = async () => {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    if (!t) {
        notification.error('请先登录');
        return;
    }
    // 根据系统给出默认挂载点提示
    const ua = navigator.userAgent;
    let defaultMount = '/mnt/hpc';
    if (ua.includes('Windows'))
        defaultMount = 'Z:';
    else if (ua.includes('Mac'))
        defaultMount = '/Volumes/HPC';
    const mountPoint = await showInputDialog('挂载到本地', `挂载点（Windows: Z:，macOS: /Volumes/HPC，Linux: /mnt/hpc）`, defaultMount, defaultMount);
    if (mountPoint === null)
        return; // 用户取消
    const uri = `hpcc://mount?server=${encodeURIComponent(location.origin)}&token=${encodeURIComponent(t)}&mountpoint=${encodeURIComponent(mountPoint)}&port=18080`;
    window.location.href = uri;
    notification.success(`正在启动挂载，挂载点: ${mountPoint}`);
};
// 上传任务队列（全局状态，切换页面不中断）
// uploadTasks / showUploadPanel 来自 uploadManager.ts
let uploadTaskId = 0;
const showUploadDialog = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0)
            return;
        enqueueUpload(files, currentPath.value, () => loadDirectory());
    };
    input.click();
};
const clearUploadTasks = () => clearFinishedUploads();
// ── 格式化 ────────────────────────────────────────────────────
const formatSize = (b) => {
    if (!b)
        return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
};
const formatTime = (s) => {
    try {
        return new Date(s).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    catch {
        return s;
    }
};
onMounted(() => {
    currentUser.value = getUser();
    currentPath.value = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
    loadDirectory();
    document.addEventListener('click', handleGlobalClick);
});
onUnmounted(() => { document.removeEventListener('click', handleGlobalClick); });
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-mount']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-path-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-crumb-link']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-table']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-table']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-table']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-row']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-row']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon-dir']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon-code']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon-image']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon-video']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon-audio']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon-archive']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon-pdf']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-icon-text']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-name-dir']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-op-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-dropdown-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-modal-close']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-modal-close']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-dialog-input']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-confirm']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-confirm']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-danger']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-row-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-danger-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-danger-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-upload-close']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-upload-item']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-upload-status']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "fm" },
});
/** @type {__VLS_StyleScopedClasses['fm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "fm-toolbar" },
});
/** @type {__VLS_StyleScopedClasses['fm-toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "fm-nav" },
});
/** @type {__VLS_StyleScopedClasses['fm-nav']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goHome) },
    ...{ class: "fm-btn fm-btn-icon" },
    title: "主目录",
});
/** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goUp) },
    ...{ class: "fm-btn fm-btn-icon" },
    disabled: (!__VLS_ctx.canGoUp),
    title: "上级目录",
});
/** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadDirectory) },
    ...{ class: "fm-btn fm-btn-icon" },
    title: "刷新",
});
/** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "fm-path-wrap" },
});
/** @type {__VLS_StyleScopedClasses['fm-path-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ class: "fm-path-icon" },
    viewBox: "0 0 24 24",
});
/** @type {__VLS_StyleScopedClasses['fm-path-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onKeyup: (__VLS_ctx.loadDirectory) },
    ...{ class: "fm-path-input" },
    placeholder: "输入路径...",
    spellcheck: "false",
});
(__VLS_ctx.currentPath);
/** @type {__VLS_StyleScopedClasses['fm-path-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "fm-actions" },
});
/** @type {__VLS_StyleScopedClasses['fm-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.showUploadDialog) },
    ...{ class: "fm-btn fm-btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.showCreateFolderDialog) },
    ...{ class: "fm-btn fm-btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.showCreateFileDialog) },
    ...{ class: "fm-btn fm-btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-1 5h-2v-2h2v2zm0 4h-2v-2h2v2zm4-4h-2v-2h2v2zm0 4h-2v-2h2v2z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "fm-breadcrumb" },
});
/** @type {__VLS_StyleScopedClasses['fm-breadcrumb']} */ ;
for (const [crumb, i] of __VLS_vFor((__VLS_ctx.breadcrumbs))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (i),
        ...{ class: "fm-crumb" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-crumb']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ onClick: (...[$event]) => {
                i < __VLS_ctx.breadcrumbs.length - 1 && __VLS_ctx.navigateToCrumb(i);
                // @ts-ignore
                [goHome, goUp, canGoUp, loadDirectory, loadDirectory, currentPath, showUploadDialog, showCreateFolderDialog, showCreateFileDialog, breadcrumbs, breadcrumbs, navigateToCrumb,];
            } },
        ...{ class: (['fm-crumb-text', { 'fm-crumb-link': i < __VLS_ctx.breadcrumbs.length - 1 }]) },
    });
    /** @type {__VLS_StyleScopedClasses['fm-crumb-text']} */ ;
    /** @type {__VLS_StyleScopedClasses['fm-crumb-link']} */ ;
    (crumb);
    if (i < __VLS_ctx.breadcrumbs.length - 1) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            ...{ class: "fm-crumb-sep" },
            viewBox: "0 0 24 24",
        });
        /** @type {__VLS_StyleScopedClasses['fm-crumb-sep']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
        });
    }
    // @ts-ignore
    [breadcrumbs, breadcrumbs,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.selectedPaths.clear();
            __VLS_ctx.selectedPaths = new Set(__VLS_ctx.selectedPaths);
            // @ts-ignore
            [selectedPaths, selectedPaths, selectedPaths,];
        } },
    ...{ class: "fm-body" },
});
/** @type {__VLS_StyleScopedClasses['fm-body']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-loading" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-loading']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-spinner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
else {
    if (__VLS_ctx.sortedFiles.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fm-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['fm-empty']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            viewBox: "0 0 24 24",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
    else {
        if (__VLS_ctx.selectedPaths.size > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: () => { } },
                ...{ class: "fm-selection-bar" },
            });
            /** @type {__VLS_StyleScopedClasses['fm-selection-bar']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "fm-sel-count" },
            });
            /** @type {__VLS_StyleScopedClasses['fm-sel-count']} */ ;
            (__VLS_ctx.selectedPaths.size);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.batchCompressDownload) },
                ...{ class: "fm-btn fm-btn-secondary fm-btn-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
            /** @type {__VLS_StyleScopedClasses['fm-btn-sm']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                viewBox: "0 0 24 24",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.batchDelete) },
                ...{ class: "fm-btn fm-btn-danger-sm fm-btn-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['fm-btn-danger-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['fm-btn-sm']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                viewBox: "0 0 24 24",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.sortedFiles.length === 0))
                            return;
                        if (!(__VLS_ctx.selectedPaths.size > 0))
                            return;
                        __VLS_ctx.selectedPaths = new Set();
                        // @ts-ignore
                        [selectedPaths, selectedPaths, selectedPaths, loading, sortedFiles, batchCompressDownload, batchDelete,];
                    } },
                ...{ class: "fm-btn fm-btn-secondary fm-btn-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
            /** @type {__VLS_StyleScopedClasses['fm-btn-sm']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ onClick: () => { } },
            ...{ class: "fm-table" },
        });
        /** @type {__VLS_StyleScopedClasses['fm-table']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "col-check" },
        });
        /** @type {__VLS_StyleScopedClasses['col-check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: (__VLS_ctx.toggleSelectAll) },
            type: "checkbox",
            ...{ class: "fm-checkbox" },
            checked: (__VLS_ctx.selectedPaths.size === __VLS_ctx.sortedFiles.length && __VLS_ctx.sortedFiles.length > 0),
            indeterminate: (__VLS_ctx.selectedPaths.size > 0 && __VLS_ctx.selectedPaths.size < __VLS_ctx.sortedFiles.length),
        });
        /** @type {__VLS_StyleScopedClasses['fm-checkbox']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "col-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['col-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "col-name" },
        });
        /** @type {__VLS_StyleScopedClasses['col-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "col-size" },
        });
        /** @type {__VLS_StyleScopedClasses['col-size']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "col-time" },
        });
        /** @type {__VLS_StyleScopedClasses['col-time']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "col-perm" },
        });
        /** @type {__VLS_StyleScopedClasses['col-perm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "col-ops" },
        });
        /** @type {__VLS_StyleScopedClasses['col-ops']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [file] of __VLS_vFor((__VLS_ctx.sortedFiles))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                ...{ onDblclick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.sortedFiles.length === 0))
                            return;
                        __VLS_ctx.handleDoubleClick(file);
                        // @ts-ignore
                        [selectedPaths, selectedPaths, selectedPaths, sortedFiles, sortedFiles, sortedFiles, sortedFiles, toggleSelectAll, handleDoubleClick,];
                    } },
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.sortedFiles.length === 0))
                            return;
                        __VLS_ctx.toggleSelect(file, $event);
                        // @ts-ignore
                        [toggleSelect,];
                    } },
                key: (file.path),
                ...{ class: (['fm-row', { 'fm-row-selected': __VLS_ctx.selectedPaths.has(file.path) }]) },
            });
            /** @type {__VLS_StyleScopedClasses['fm-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['fm-row-selected']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ onClick: () => { } },
                ...{ class: "col-check" },
            });
            /** @type {__VLS_StyleScopedClasses['col-check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.sortedFiles.length === 0))
                            return;
                        __VLS_ctx.toggleSelect(file, $event);
                        // @ts-ignore
                        [selectedPaths, toggleSelect,];
                    } },
                type: "checkbox",
                ...{ class: "fm-checkbox" },
                checked: (__VLS_ctx.selectedPaths.has(file.path)),
            });
            /** @type {__VLS_StyleScopedClasses['fm-checkbox']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "col-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['col-icon']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: (['fm-icon', file.is_dir ? 'fm-icon-dir' : `fm-icon-${__VLS_ctx.getFileType(file.name)}`]) },
            });
            /** @type {__VLS_StyleScopedClasses['fm-icon']} */ ;
            const __VLS_0 = (file.is_dir ? __VLS_ctx.IconFolder : __VLS_ctx.getFileIconComp(file.name));
            // @ts-ignore
            const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
            const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "col-name" },
            });
            /** @type {__VLS_StyleScopedClasses['col-name']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: (['fm-name', { 'fm-name-dir': file.is_dir }]) },
            });
            /** @type {__VLS_StyleScopedClasses['fm-name']} */ ;
            /** @type {__VLS_StyleScopedClasses['fm-name-dir']} */ ;
            (file.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "col-size" },
            });
            /** @type {__VLS_StyleScopedClasses['col-size']} */ ;
            (file.is_dir ? '—' : __VLS_ctx.formatSize(file.size));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "col-time" },
            });
            /** @type {__VLS_StyleScopedClasses['col-time']} */ ;
            (__VLS_ctx.formatTime(file.mod_time));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "col-perm" },
            });
            /** @type {__VLS_StyleScopedClasses['col-perm']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
                ...{ class: "fm-perm" },
            });
            /** @type {__VLS_StyleScopedClasses['fm-perm']} */ ;
            (file.permissions);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ onClick: () => { } },
                ...{ class: "col-ops" },
            });
            /** @type {__VLS_StyleScopedClasses['col-ops']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "fm-dropdown" },
            });
            /** @type {__VLS_StyleScopedClasses['fm-dropdown']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.sortedFiles.length === 0))
                            return;
                        __VLS_ctx.openOps = __VLS_ctx.openOps === file.path ? null : file.path;
                        // @ts-ignore
                        [selectedPaths, getFileType, IconFolder, getFileIconComp, formatSize, formatTime, openOps, openOps,];
                    } },
                ...{ class: "fm-op-toggle" },
                'data-ops': (file.path),
            });
            /** @type {__VLS_StyleScopedClasses['fm-op-toggle']} */ ;
            let __VLS_5;
            /** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
            Teleport;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
                to: "body",
            }));
            const __VLS_7 = __VLS_6({
                to: "body",
            }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            const { default: __VLS_10 } = __VLS_8.slots;
            if (__VLS_ctx.openOps === file.path) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ onClick: () => { } },
                    ...{ class: "fm-dropdown-menu" },
                    ...{ style: (__VLS_ctx.getDropdownStyle(file.path)) },
                });
                /** @type {__VLS_StyleScopedClasses['fm-dropdown-menu']} */ ;
                if (file.is_dir) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.sortedFiles.length === 0))
                                    return;
                                if (!(__VLS_ctx.openOps === file.path))
                                    return;
                                if (!(file.is_dir))
                                    return;
                                __VLS_ctx.openDirectory(file);
                                __VLS_ctx.openOps = null;
                                // @ts-ignore
                                [openOps, openOps, getDropdownStyle, openDirectory,];
                            } },
                        ...{ class: "fm-dropdown-item" },
                    });
                    /** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        viewBox: "0 0 24 24",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
                    });
                }
                if (!file.is_dir) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.sortedFiles.length === 0))
                                    return;
                                if (!(__VLS_ctx.openOps === file.path))
                                    return;
                                if (!(!file.is_dir))
                                    return;
                                __VLS_ctx.viewFile(file);
                                __VLS_ctx.openOps = null;
                                // @ts-ignore
                                [openOps, viewFile,];
                            } },
                        ...{ class: "fm-dropdown-item" },
                    });
                    /** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        viewBox: "0 0 24 24",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
                    });
                }
                if (!file.is_dir) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.sortedFiles.length === 0))
                                    return;
                                if (!(__VLS_ctx.openOps === file.path))
                                    return;
                                if (!(!file.is_dir))
                                    return;
                                __VLS_ctx.downloadFile(file);
                                __VLS_ctx.openOps = null;
                                // @ts-ignore
                                [openOps, downloadFile,];
                            } },
                        ...{ class: "fm-dropdown-item" },
                    });
                    /** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        viewBox: "0 0 24 24",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
                    });
                }
                if (!file.is_dir) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.sortedFiles.length === 0))
                                    return;
                                if (!(__VLS_ctx.openOps === file.path))
                                    return;
                                if (!(!file.is_dir))
                                    return;
                                __VLS_ctx.editFile(file);
                                __VLS_ctx.openOps = null;
                                // @ts-ignore
                                [openOps, editFile,];
                            } },
                        ...{ class: "fm-dropdown-item" },
                    });
                    /** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        viewBox: "0 0 24 24",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
                    });
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.sortedFiles.length === 0))
                                return;
                            if (!(__VLS_ctx.openOps === file.path))
                                return;
                            __VLS_ctx.compressDownload(file);
                            __VLS_ctx.openOps = null;
                            // @ts-ignore
                            [openOps, compressDownload,];
                        } },
                    ...{ class: "fm-dropdown-item" },
                });
                /** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                    viewBox: "0 0 24 24",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                    d: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-4 6h-3v3h-2v-3H8v-2h3V7h2v3h3v2z",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.sortedFiles.length === 0))
                                return;
                            if (!(__VLS_ctx.openOps === file.path))
                                return;
                            __VLS_ctx.renameFile(file);
                            __VLS_ctx.openOps = null;
                            // @ts-ignore
                            [openOps, renameFile,];
                        } },
                    ...{ class: "fm-dropdown-item" },
                });
                /** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                    viewBox: "0 0 24 24",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                    d: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "fm-dropdown-divider" },
                });
                /** @type {__VLS_StyleScopedClasses['fm-dropdown-divider']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.sortedFiles.length === 0))
                                return;
                            if (!(__VLS_ctx.openOps === file.path))
                                return;
                            __VLS_ctx.deleteFile(file);
                            __VLS_ctx.openOps = null;
                            // @ts-ignore
                            [openOps, deleteFile,];
                        } },
                    ...{ class: "fm-dropdown-item fm-dropdown-danger" },
                });
                /** @type {__VLS_StyleScopedClasses['fm-dropdown-item']} */ ;
                /** @type {__VLS_StyleScopedClasses['fm-dropdown-danger']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                    viewBox: "0 0 24 24",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                    d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
                });
            }
            // @ts-ignore
            [];
            var __VLS_8;
            // @ts-ignore
            [];
        }
    }
}
let __VLS_11;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
    to: "body",
}));
const __VLS_13 = __VLS_12({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const { default: __VLS_16 } = __VLS_14.slots;
if (__VLS_ctx.inputDialog.visible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.inputDialog.visible))
                    return;
                __VLS_ctx.inputDialog.visible = false;
                // @ts-ignore
                [inputDialog, inputDialog,];
            } },
        ...{ class: "fm-modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "fm-dialog" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-dialog-header" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.inputDialog.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.inputDialog.visible))
                    return;
                __VLS_ctx.inputDialog.visible = false;
                // @ts-ignore
                [inputDialog, inputDialog,];
            } },
        ...{ class: "fm-modal-close" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-dialog-body" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "fm-dialog-label" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog-label']} */ ;
    (__VLS_ctx.inputDialog.label);
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeyup: (...[$event]) => {
                if (!(__VLS_ctx.inputDialog.visible))
                    return;
                __VLS_ctx.inputDialog.onConfirm(__VLS_ctx.inputDialog.value);
                // @ts-ignore
                [inputDialog, inputDialog, inputDialog,];
            } },
        ...{ onKeyup: (...[$event]) => {
                if (!(__VLS_ctx.inputDialog.visible))
                    return;
                __VLS_ctx.inputDialog.visible = false;
                // @ts-ignore
                [inputDialog,];
            } },
        ref: "dialogInput",
        ...{ class: "fm-dialog-input" },
        placeholder: (__VLS_ctx.inputDialog.placeholder),
        spellcheck: "false",
    });
    (__VLS_ctx.inputDialog.value);
    /** @type {__VLS_StyleScopedClasses['fm-dialog-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-dialog-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.inputDialog.visible))
                    return;
                __VLS_ctx.inputDialog.visible = false;
                // @ts-ignore
                [inputDialog, inputDialog, inputDialog,];
            } },
        ...{ class: "fm-btn fm-btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.inputDialog.visible))
                    return;
                __VLS_ctx.inputDialog.onConfirm(__VLS_ctx.inputDialog.value);
                // @ts-ignore
                [inputDialog, inputDialog,];
            } },
        ...{ class: "fm-btn fm-btn-confirm" },
        disabled: (!__VLS_ctx.inputDialog.value.trim()),
    });
    /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['fm-btn-confirm']} */ ;
}
// @ts-ignore
[inputDialog,];
var __VLS_14;
let __VLS_17;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    to: "body",
}));
const __VLS_19 = __VLS_18({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
const { default: __VLS_22 } = __VLS_20.slots;
if (__VLS_ctx.confirmDialog.visible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.confirmDialog.visible))
                    return;
                __VLS_ctx.confirmDialog.visible = false;
                // @ts-ignore
                [confirmDialog, confirmDialog,];
            } },
        ...{ class: "fm-modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "fm-dialog" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-dialog-header" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.confirmDialog.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-dialog-body" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "fm-dialog-msg" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog-msg']} */ ;
    (__VLS_ctx.confirmDialog.message);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-dialog-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-dialog-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.confirmDialog.visible))
                    return;
                __VLS_ctx.confirmDialog.visible = false;
                // @ts-ignore
                [confirmDialog, confirmDialog, confirmDialog,];
            } },
        ...{ class: "fm-btn fm-btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.confirmDialog.visible))
                    return;
                __VLS_ctx.confirmDialog.onConfirm();
                // @ts-ignore
                [confirmDialog,];
            } },
        ...{ class: "fm-btn fm-btn-danger" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['fm-btn-danger']} */ ;
}
// @ts-ignore
[];
var __VLS_20;
let __VLS_23;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent1(__VLS_23, new __VLS_23({
    to: "body",
}));
const __VLS_25 = __VLS_24({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
const { default: __VLS_28 } = __VLS_26.slots;
if (__VLS_ctx.showFileViewer) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.closeFileViewer) },
        ...{ class: "fm-modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "fm-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-modal-title" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (['fm-icon', `fm-icon-${__VLS_ctx.getFileType(__VLS_ctx.viewingFile?.name || '')}`]) },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['fm-icon']} */ ;
    const __VLS_29 = (__VLS_ctx.getFileIconComp(__VLS_ctx.viewingFile?.name || ''));
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({}));
    const __VLS_31 = __VLS_30({}, ...__VLS_functionalComponentArgsRest(__VLS_30));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.viewingFile?.name);
    if (__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "fm-edit-badge" },
        });
        /** @type {__VLS_StyleScopedClasses['fm-edit-badge']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeFileViewer) },
        ...{ class: "fm-modal-close" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-body']} */ ;
    if (!__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
            ...{ class: "fm-file-content" },
        });
        /** @type {__VLS_StyleScopedClasses['fm-file-content']} */ ;
        (__VLS_ctx.fileContent);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
            value: (__VLS_ctx.fileContent),
            ...{ class: "fm-file-editor" },
            spellcheck: "false",
        });
        /** @type {__VLS_StyleScopedClasses['fm-file-editor']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fm-modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeFileViewer) },
        ...{ class: "fm-btn fm-btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
    if (!__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showFileViewer))
                        return;
                    if (!(!__VLS_ctx.isEditing))
                        return;
                    __VLS_ctx.isEditing = true;
                    // @ts-ignore
                    [getFileType, getFileIconComp, showFileViewer, closeFileViewer, closeFileViewer, closeFileViewer, viewingFile, viewingFile, viewingFile, isEditing, isEditing, isEditing, isEditing, fileContent, fileContent,];
                } },
            ...{ class: "fm-btn fm-btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            viewBox: "0 0 24 24",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
        });
    }
    if (__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showFileViewer))
                        return;
                    if (!(__VLS_ctx.isEditing))
                        return;
                    __VLS_ctx.isEditing = false;
                    // @ts-ignore
                    [isEditing, isEditing,];
                } },
            ...{ class: "fm-btn fm-btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['fm-btn-secondary']} */ ;
    }
    if (__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveFile) },
            ...{ class: "fm-btn fm-btn-primary" },
            disabled: (__VLS_ctx.saving),
        });
        /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['fm-btn-primary']} */ ;
        (__VLS_ctx.saving ? '保存中...' : '💾 保存');
    }
    if (!__VLS_ctx.isEditing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showFileViewer))
                        return;
                    if (!(!__VLS_ctx.isEditing))
                        return;
                    __VLS_ctx.downloadFile(__VLS_ctx.viewingFile);
                    // @ts-ignore
                    [downloadFile, viewingFile, isEditing, isEditing, saveFile, saving, saving,];
                } },
            ...{ class: "fm-btn fm-btn-primary" },
        });
        /** @type {__VLS_StyleScopedClasses['fm-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['fm-btn-primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            viewBox: "0 0 24 24",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
        });
    }
}
// @ts-ignore
[];
var __VLS_26;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
});
export default {};
