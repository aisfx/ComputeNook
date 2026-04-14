/// <reference types="../../node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { getUser } from '../utils/auth';
import notification from '../utils/notification';
import { fileManagerApi } from '../config/api';
const currentPath = ref('');
const files = ref([]);
const loading = ref(false);
const currentUser = ref(null);
const showFileViewer = ref(false);
const viewingFile = ref(null);
const fileContent = ref('');
// 导航到指定目录（供外部调用）
const navigateToPath = (path) => {
    if (!path || path === '-') {
        notification.error('无效的路径');
        return;
    }
    currentPath.value = path;
    loadDirectory();
};
// 暴露方法给父组件
const __VLS_exposed = {
    navigateToPath
};
defineExpose(__VLS_exposed);
const canGoUp = computed(() => {
    const homePath = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
    return currentPath.value !== homePath && currentPath.value !== '/';
});
const sortedFiles = computed(() => {
    return [...files.value].sort((a, b) => {
        // 文件夹排在前面
        if (a.is_dir && !b.is_dir)
            return -1;
        if (!a.is_dir && b.is_dir)
            return 1;
        // 按名称排序
        return a.name.localeCompare(b.name);
    });
});
const goHome = () => {
    currentPath.value = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
    loadDirectory();
};
const goUp = () => {
    if (!canGoUp.value)
        return;
    const parts = currentPath.value.split('/').filter(p => p);
    parts.pop();
    currentPath.value = '/' + parts.join('/');
    loadDirectory();
};
const loadDirectory = async () => {
    loading.value = true;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const url = `${fileManagerApi.list()}?path=${encodeURIComponent(currentPath.value)}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '读取目录失败');
        }
        const result = await response.json();
        files.value = result.files || [];
        currentPath.value = result.path || currentPath.value;
    }
    catch (err) {
        notification.error(err.message || '读取目录失败');
        files.value = [];
    }
    finally {
        loading.value = false;
    }
};
const openDirectory = (file) => {
    currentPath.value = file.path;
    loadDirectory();
};
const handleDoubleClick = (file) => {
    if (file.is_dir) {
        openDirectory(file);
    }
    else {
        viewFile(file);
    }
};
const viewFile = async (file) => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const url = `${fileManagerApi.read()}?path=${encodeURIComponent(file.path)}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '读取文件失败');
        }
        const result = await response.json();
        fileContent.value = result.content || '';
        viewingFile.value = file;
        showFileViewer.value = true;
    }
    catch (err) {
        notification.error(err.message || '读取文件失败');
    }
};
const closeFileViewer = () => {
    showFileViewer.value = false;
    viewingFile.value = null;
    fileContent.value = '';
};
const downloadFile = (file) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const url = `${fileManagerApi.download()}?path=${encodeURIComponent(file.path)}`;
    // 创建一个隐藏的 a 标签来触发下载
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.style.display = 'none';
    // 添加 Authorization header（通过在 URL 中添加 token）
    link.href = `${url}&token=${token}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notification.success('开始下载文件');
};
const deleteFile = async (file) => {
    const confirmed = confirm(`🗑️ 删除${file.is_dir ? '文件夹' : '文件'}\n\n确定要删除 "${file.name}" 吗？\n\n此操作不可恢复！`);
    if (!confirmed)
        return;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const url = `${fileManagerApi.delete()}?path=${encodeURIComponent(file.path)}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '删除失败');
        }
        notification.success('删除成功');
        await loadDirectory();
    }
    catch (err) {
        notification.error(err.message || '删除失败');
    }
};
const renameFile = async (file) => {
    const newName = prompt(`重命名 "${file.name}"\n\n请输入新名称：`, file.name);
    if (!newName || newName === file.name)
        return;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const parts = file.path.split('/');
        parts[parts.length - 1] = newName;
        const newPath = parts.join('/');
        const response = await fetch(fileManagerApi.rename(), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                old_path: file.path,
                new_path: newPath
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '重命名失败');
        }
        notification.success('重命名成功');
        await loadDirectory();
    }
    catch (err) {
        notification.error(err.message || '重命名失败');
    }
};
const showCreateFolderDialog = async () => {
    const folderName = prompt('新建文件夹\n\n请输入文件夹名称：');
    if (!folderName)
        return;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const newPath = `${currentPath.value}/${folderName}`;
        const response = await fetch(fileManagerApi.mkdir(), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: newPath
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '创建文件夹失败');
        }
        notification.success('文件夹创建成功');
        await loadDirectory();
    }
    catch (err) {
        notification.error(err.message || '创建文件夹失败');
    }
};
const showCreateFileDialog = async () => {
    const fileName = prompt('新建文件\n\n请输入文件名称：');
    if (!fileName)
        return;
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const newPath = `${currentPath.value}/${fileName}`;
        const response = await fetch(fileManagerApi.write(), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: newPath,
                content: ''
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '创建文件失败');
        }
        notification.success('文件创建成功');
        await loadDirectory();
    }
    catch (err) {
        notification.error(err.message || '创建文件失败');
    }
};
const showUploadDialog = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0)
            return;
        for (const file of files) {
            await uploadFile(file);
        }
        await loadDirectory();
    };
    input.click();
};
const uploadFile = async (file) => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            throw new Error('请先登录系统');
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath.value);
        const response = await fetch(fileManagerApi.upload(), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '上传失败');
        }
        notification.success(`文件 "${file.name}" 上传成功`);
    }
    catch (err) {
        notification.error(`上传 "${file.name}" 失败: ${err.message}`);
    }
};
const formatSize = (bytes) => {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
const formatTime = (timeStr) => {
    try {
        const date = new Date(timeStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    catch {
        return timeStr;
    }
};
const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap = {
        'txt': '📄',
        'pdf': '📕',
        'doc': '📘',
        'docx': '📘',
        'xls': '📗',
        'xlsx': '📗',
        'ppt': '📙',
        'pptx': '📙',
        'zip': '📦',
        'tar': '📦',
        'gz': '📦',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'mp4': '🎬',
        'avi': '🎬',
        'mp3': '🎵',
        'wav': '🎵',
        'py': '🐍',
        'js': '📜',
        'ts': '📜',
        'html': '🌐',
        'css': '🎨',
        'json': '📋',
        'xml': '📋',
        'sh': '⚙️',
        'c': '⚙️',
        'cpp': '⚙️',
        'java': '☕',
        'go': '🐹'
    };
    return iconMap[ext || ''] || '📄';
};
onMounted(() => {
    currentUser.value = getUser();
    currentPath.value = currentUser.value?.homeDir || `/home/${currentUser.value?.username || ''}`;
    loadDirectory();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['file-header']} */ ;
/** @type {__VLS_StyleScopedClasses['path-input']} */ ;
/** @type {__VLS_StyleScopedClasses['files-table']} */ ;
/** @type {__VLS_StyleScopedClasses['files-table']} */ ;
/** @type {__VLS_StyleScopedClasses['files-table']} */ ;
/** @type {__VLS_StyleScopedClasses['files-table']} */ ;
/** @type {__VLS_StyleScopedClasses['file-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "file-manager" },
});
/** @type {__VLS_StyleScopedClasses['file-manager']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "file-header" },
});
/** @type {__VLS_StyleScopedClasses['file-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "path-bar" },
});
/** @type {__VLS_StyleScopedClasses['path-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goHome) },
    ...{ class: "btn-secondary" },
    title: "返回主目录",
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goUp) },
    ...{ class: "btn-secondary" },
    disabled: (!__VLS_ctx.canGoUp),
    title: "上级目录",
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "current-path" },
});
/** @type {__VLS_StyleScopedClasses['current-path']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "path-label" },
});
/** @type {__VLS_StyleScopedClasses['path-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onKeyup: (__VLS_ctx.loadDirectory) },
    ...{ class: "path-input" },
    placeholder: "输入路径...",
});
(__VLS_ctx.currentPath);
/** @type {__VLS_StyleScopedClasses['path-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadDirectory) },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "file-actions" },
});
/** @type {__VLS_StyleScopedClasses['file-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.showUploadDialog) },
    ...{ class: "btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.showCreateFolderDialog) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.showCreateFileDialog) },
    ...{ class: "btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
if (!__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "file-list" },
    });
    /** @type {__VLS_StyleScopedClasses['file-list']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "files-table" },
    });
    /** @type {__VLS_StyleScopedClasses['files-table']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [file] of __VLS_vFor((__VLS_ctx.sortedFiles))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            ...{ onDblclick: (...[$event]) => {
                    if (!(!__VLS_ctx.loading))
                        return;
                    __VLS_ctx.handleDoubleClick(file);
                    // @ts-ignore
                    [goHome, goUp, canGoUp, loadDirectory, loadDirectory, currentPath, showUploadDialog, showCreateFolderDialog, showCreateFileDialog, loading, sortedFiles, handleDoubleClick,];
                } },
            key: (file.path),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "file-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['file-icon']} */ ;
        (file.is_dir ? '📁' : __VLS_ctx.getFileIcon(file.name));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "file-name" },
        });
        /** @type {__VLS_StyleScopedClasses['file-name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: ({ 'is-dir': file.is_dir }) },
        });
        /** @type {__VLS_StyleScopedClasses['is-dir']} */ ;
        (file.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "file-size" },
        });
        /** @type {__VLS_StyleScopedClasses['file-size']} */ ;
        (file.is_dir ? '-' : __VLS_ctx.formatSize(file.size));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "file-time" },
        });
        /** @type {__VLS_StyleScopedClasses['file-time']} */ ;
        (__VLS_ctx.formatTime(file.mod_time));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "file-permissions" },
        });
        /** @type {__VLS_StyleScopedClasses['file-permissions']} */ ;
        (file.permissions);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "file-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['file-actions']} */ ;
        if (file.is_dir) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.loading))
                            return;
                        if (!(file.is_dir))
                            return;
                        __VLS_ctx.openDirectory(file);
                        // @ts-ignore
                        [getFileIcon, formatSize, formatTime, openDirectory,];
                    } },
                ...{ class: "btn-link" },
                title: "打开",
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        }
        if (!file.is_dir) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.loading))
                            return;
                        if (!(!file.is_dir))
                            return;
                        __VLS_ctx.viewFile(file);
                        // @ts-ignore
                        [viewFile,];
                    } },
                ...{ class: "btn-link" },
                title: "查看",
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        }
        if (!file.is_dir) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.loading))
                            return;
                        if (!(!file.is_dir))
                            return;
                        __VLS_ctx.downloadFile(file);
                        // @ts-ignore
                        [downloadFile,];
                    } },
                ...{ class: "btn-link" },
                title: "下载",
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.loading))
                        return;
                    __VLS_ctx.renameFile(file);
                    // @ts-ignore
                    [renameFile,];
                } },
            ...{ class: "btn-link" },
            title: "重命名",
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.loading))
                        return;
                    __VLS_ctx.deleteFile(file);
                    // @ts-ignore
                    [deleteFile,];
                } },
            ...{ class: "btn-link danger" },
            title: "删除",
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.files.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "empty-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading-state" },
    });
    /** @type {__VLS_StyleScopedClasses['loading-state']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['spinner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
if (__VLS_ctx.showFileViewer) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.closeFileViewer) },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.viewingFile?.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeFileViewer) },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "file-content" },
    });
    /** @type {__VLS_StyleScopedClasses['file-content']} */ ;
    (__VLS_ctx.fileContent);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeFileViewer) },
        ...{ class: "btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showFileViewer))
                    return;
                __VLS_ctx.downloadFile(__VLS_ctx.viewingFile);
                // @ts-ignore
                [loading, downloadFile, files, showFileViewer, closeFileViewer, closeFileViewer, closeFileViewer, viewingFile, viewingFile, fileContent,];
            } },
        ...{ class: "btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
});
export default {};
