/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { getApiBase } from '../utils/auth';
import { dialog } from '../utils/dialog';
const projects = ref([]);
const selectedProject = ref('');
const selectedProjectMeta = ref(null);
const repos = ref([]);
const searchText = ref('');
const loadingProjects = ref(false);
const loadingRepos = ref(false);
const showPullDialog = ref(false);
const harborHost = ref('');
const userProject = ref('');
const isAdmin = ref(false);
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token');
const filteredRepos = computed(() => searchText.value
    ? repos.value.filter(r => r.name?.toLowerCase().includes(searchText.value.toLowerCase()))
    : repos.value);
const loadConfig = async () => {
    try {
        const res = await fetch(`${getApiBase()}/api/registry/config`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        const data = await res.json();
        harborHost.value = (data.harbor_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        userProject.value = data.user_project || '';
        isAdmin.value = data.isAdmin === true || data.is_admin === true;
    }
    catch { /* ignore */ }
};
const loadProjects = async () => {
    loadingProjects.value = true;
    try {
        const res = await fetch(`${getApiBase()}/api/registry/projects`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        const data = await res.json();
        projects.value = data.data || [];
    }
    catch (e) {
        dialog.error('加载项目失败: ' + e.message);
    }
    finally {
        loadingProjects.value = false;
    }
};
const selectProject = async (project) => {
    selectedProject.value = project.name;
    selectedProjectMeta.value = project;
    loadingRepos.value = true;
    repos.value = [];
    try {
        const res = await fetch(`${getApiBase()}/api/registry/projects/${project.name}/repositories`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        const data = await res.json();
        const list = data.data || [];
        // 并发加载每个 repo 的 tags
        await Promise.all(list.map(async (repo) => {
            const repoName = encodeURIComponent(shortRepoName(repo.name));
            try {
                const tr = await fetch(`${getApiBase()}/api/registry/projects/${project.name}/repositories/${repoName}/tags`, { headers: { Authorization: `Bearer ${token()}` } });
                const td = await tr.json();
                repo.tags = (td.data || []).flatMap((a) => (a.tags || []).map((t) => t.name));
            }
            catch {
                repo.tags = [];
            }
        }));
        repos.value = list;
    }
    catch (e) {
        dialog.error('加载镜像失败: ' + e.message);
    }
    finally {
        loadingRepos.value = false;
    }
};
const shortRepoName = (fullName) => {
    const parts = fullName.split('/');
    return parts[parts.length - 1];
};
const formatTime = (t) => {
    if (!t)
        return '-';
    return new Date(t).toLocaleDateString('zh-CN');
};
const copyPullCmd = (repoName) => {
    const addr = `${harborHost.value}/${selectedProject.value}/${shortRepoName(repoName)}:latest`;
    navigator.clipboard.writeText(addr);
    dialog.success('镜像地址已复制');
};
const confirmDelete = async (repo) => {
    const name = shortRepoName(repo.name);
    if (!await dialog.confirmDelete(name, '镜像'))
        return;
    try {
        const res = await fetch(`${getApiBase()}/api/registry/projects/${selectedProject.value}/repositories/${encodeURIComponent(name)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || '删除失败');
        dialog.success('删除成功');
        selectProject(selectedProjectMeta.value);
    }
    catch (e) {
        dialog.error(e.message);
    }
};
onMounted(async () => {
    await loadConfig();
    await loadProjects();
    // 默认选中用户自己的私有项目
    const own = projects.value.find(p => p.name === userProject.value);
    if (own)
        selectProject(own);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-pull']} */ ;
/** @type {__VLS_StyleScopedClasses['project-item']} */ ;
/** @type {__VLS_StyleScopedClasses['project-item']} */ ;
/** @type {__VLS_StyleScopedClasses['project-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['project-count']} */ ;
/** @type {__VLS_StyleScopedClasses['project-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-private']} */ ;
/** @type {__VLS_StyleScopedClasses['project-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-public']} */ ;
/** @type {__VLS_StyleScopedClasses['access-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['access-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['repo-card']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
/** @type {__VLS_StyleScopedClasses['code-block']} */ ;
/** @type {__VLS_StyleScopedClasses['registry-page']} */ ;
/** @type {__VLS_StyleScopedClasses['project-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['project-list']} */ ;
/** @type {__VLS_StyleScopedClasses['project-item']} */ ;
/** @type {__VLS_StyleScopedClasses['project-name']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "registry-page" },
});
/** @type {__VLS_StyleScopedClasses['registry-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "project-panel" },
});
/** @type {__VLS_StyleScopedClasses['project-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "panel-header" },
});
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "panel-title" },
});
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.loadProjects) },
    ...{ class: "btn-refresh" },
    title: "刷新",
});
/** @type {__VLS_StyleScopedClasses['btn-refresh']} */ ;
if (__VLS_ctx.loadingProjects) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['loading-tip']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "project-list" },
    });
    /** @type {__VLS_StyleScopedClasses['project-list']} */ ;
    for (const [p] of __VLS_vFor((__VLS_ctx.projects))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loadingProjects))
                        return;
                    __VLS_ctx.selectProject(p);
                    // @ts-ignore
                    [loadProjects, loadingProjects, projects, selectProject,];
                } },
            key: (p.name),
            ...{ class: (['project-item', { active: __VLS_ctx.selectedProject === p.name }]) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        /** @type {__VLS_StyleScopedClasses['project-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "project-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['project-icon']} */ ;
        (p.is_own_project ? '👤' : '🌐');
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "project-name" },
        });
        /** @type {__VLS_StyleScopedClasses['project-name']} */ ;
        (p.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "project-badges" },
        });
        /** @type {__VLS_StyleScopedClasses['project-badges']} */ ;
        if (p.is_own_project) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge-private" },
            });
            /** @type {__VLS_StyleScopedClasses['badge-private']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge-public" },
            });
            /** @type {__VLS_StyleScopedClasses['badge-public']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "project-count" },
        });
        /** @type {__VLS_StyleScopedClasses['project-count']} */ ;
        (p.repo_count || p.repository_count || 0);
        // @ts-ignore
        [selectedProject,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "repo-panel" },
});
/** @type {__VLS_StyleScopedClasses['repo-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "panel-header" },
});
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "panel-title-group" },
});
/** @type {__VLS_StyleScopedClasses['panel-title-group']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "panel-title" },
});
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
(__VLS_ctx.selectedProject ? `🗂 ${__VLS_ctx.selectedProject}` : '请选择项目');
if (__VLS_ctx.selectedProjectMeta) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (['access-badge', __VLS_ctx.selectedProjectMeta.can_write ? 'rw' : 'ro']) },
    });
    /** @type {__VLS_StyleScopedClasses['access-badge']} */ ;
    (__VLS_ctx.selectedProjectMeta.can_write ? '可读写' : '只读');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "header-actions" },
});
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "search-input" },
    placeholder: "搜索镜像...",
});
(__VLS_ctx.searchText);
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showPullDialog = true;
            // @ts-ignore
            [selectedProject, selectedProject, selectedProjectMeta, selectedProjectMeta, selectedProjectMeta, searchText, showPullDialog,];
        } },
    ...{ class: "btn-pull" },
});
/** @type {__VLS_StyleScopedClasses['btn-pull']} */ ;
if (!__VLS_ctx.selectedProject) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-tip']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else if (__VLS_ctx.loadingRepos) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-tip']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else if (__VLS_ctx.filteredRepos.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-tip']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "repo-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['repo-grid']} */ ;
    for (const [repo] of __VLS_vFor((__VLS_ctx.filteredRepos))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (repo.name),
            ...{ class: "repo-card" },
        });
        /** @type {__VLS_StyleScopedClasses['repo-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "repo-card-header" },
        });
        /** @type {__VLS_StyleScopedClasses['repo-card-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "repo-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['repo-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "repo-info" },
        });
        /** @type {__VLS_StyleScopedClasses['repo-info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "repo-name" },
        });
        /** @type {__VLS_StyleScopedClasses['repo-name']} */ ;
        (__VLS_ctx.shortRepoName(repo.name));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "repo-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['repo-meta']} */ ;
        (repo.artifact_count || 0);
        (__VLS_ctx.formatTime(repo.update_time));
        if (repo.tags && repo.tags.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "repo-tags" },
            });
            /** @type {__VLS_StyleScopedClasses['repo-tags']} */ ;
            for (const [tag] of __VLS_vFor((repo.tags.slice(0, 4)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (tag),
                    ...{ class: "tag-badge" },
                });
                /** @type {__VLS_StyleScopedClasses['tag-badge']} */ ;
                (tag);
                // @ts-ignore
                [selectedProject, loadingRepos, filteredRepos, filteredRepos, shortRepoName, formatTime,];
            }
            if (repo.tags.length > 4) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "tag-more" },
                });
                /** @type {__VLS_StyleScopedClasses['tag-more']} */ ;
                (repo.tags.length - 4);
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "repo-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['repo-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.selectedProject))
                        return;
                    if (!!(__VLS_ctx.loadingRepos))
                        return;
                    if (!!(__VLS_ctx.filteredRepos.length === 0))
                        return;
                    __VLS_ctx.copyPullCmd(repo.name);
                    // @ts-ignore
                    [copyPullCmd,];
                } },
            ...{ class: "btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        if (__VLS_ctx.selectedProjectMeta?.can_write) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.selectedProject))
                            return;
                        if (!!(__VLS_ctx.loadingRepos))
                            return;
                        if (!!(__VLS_ctx.filteredRepos.length === 0))
                            return;
                        if (!(__VLS_ctx.selectedProjectMeta?.can_write))
                            return;
                        __VLS_ctx.confirmDelete(repo);
                        // @ts-ignore
                        [selectedProjectMeta, confirmDelete,];
                    } },
                ...{ class: "btn-sm danger" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        }
        // @ts-ignore
        [];
    }
}
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.showPullDialog) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPullDialog))
                    return;
                __VLS_ctx.showPullDialog = false;
                // @ts-ignore
                [showPullDialog, showPullDialog,];
            } },
        ...{ class: "modal-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-box" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-header" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPullDialog))
                    return;
                __VLS_ctx.showPullDialog = false;
                // @ts-ignore
                [showPullDialog,];
            } },
        ...{ class: "btn-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "modal-body" },
    });
    /** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "tip-text" },
    });
    /** @type {__VLS_StyleScopedClasses['tip-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "code-block" },
    });
    /** @type {__VLS_StyleScopedClasses['code-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "code-label" },
    });
    /** @type {__VLS_StyleScopedClasses['code-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
    (__VLS_ctx.harborHost);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "code-block" },
    });
    /** @type {__VLS_StyleScopedClasses['code-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "code-label" },
    });
    /** @type {__VLS_StyleScopedClasses['code-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
    (__VLS_ctx.harborHost || '（未配置 HARBOR_URL）');
}
// @ts-ignore
[harborHost, harborHost,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
