/**
 * 全局远程桌面启动状态管理
 * 轮询在组件外运行，切换页面不中断
 */
import { ref } from 'vue';
import axios from 'axios';
import { desktopAPI } from '../api/index';
export const launchState = ref(null);
export const launchMinimized = ref(false);
let pollTimer = null;
let logTimer = null;
export function clearLaunch() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (logTimer) {
        clearInterval(logTimer);
        logTimer = null;
    }
    launchState.value = null;
}
export async function startDesktopLaunch(session, partition) {
    // 清理上一次
    clearLaunch();
    launchMinimized.value = false;
    launchState.value = {
        sessionId: session.id,
        sessionName: session.name,
        jobId: '',
        status: 'starting',
        progress: 0,
        logLines: [],
        logType: 'out',
        session,
    };
    try {
        const res = await desktopAPI.startSession(session.id, partition || session.partition);
        if (launchState.value) {
            launchState.value.jobId = String(res.jobId || '');
        }
        startLogPolling(session.id);
        startPollStatus(session.id);
    }
    catch (e) {
        if (launchState.value) {
            launchState.value.status = 'failed';
            launchState.value.errorMessage = e.response?.data?.error || e.message || '启动失败';
        }
    }
}
function startLogPolling(id) {
    if (logTimer)
        clearInterval(logTimer);
    const fetch = async () => {
        if (!launchState.value || launchState.value.status !== 'starting') {
            clearInterval(logTimer);
            return;
        }
        try {
            const type = launchState.value.logType;
            const res = await axios.get(`/desktop/sessions/${id}/logs`, { params: { type, lines: 200 } });
            if (res.data.exists && launchState.value) {
                launchState.value.logLines = res.data.lines.filter((l) => l !== '');
            }
        }
        catch { /* ignore */ }
    };
    fetch();
    logTimer = setInterval(fetch, 3000);
}
function startPollStatus(id) {
    if (pollTimer)
        clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
        if (!launchState.value) {
            clearInterval(pollTimer);
            return;
        }
        try {
            const s = await desktopAPI.getStatus(id);
            if (!launchState.value)
                return;
            if (s.status === 'running') {
                clearInterval(pollTimer);
                clearInterval(logTimer);
                launchState.value.status = 'ready';
                launchState.value.progress = 100;
                launchState.value.session = s;
            }
            else if (s.status === 'failed') {
                clearInterval(pollTimer);
                clearInterval(logTimer);
                launchState.value.status = 'failed';
            }
            else if (s.status === 'pending') {
                launchState.value.progress = 30;
            }
            else {
                launchState.value.progress = Math.min(90, launchState.value.progress + 2);
            }
        }
        catch { /* ignore */ }
    }, 3000);
}
