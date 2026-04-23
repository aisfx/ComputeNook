import { getApiBase, getToken } from './auth';
export async function fetchSnapshot() {
    const base = getApiBase();
    const token = getToken() || '';
    const headers = { Authorization: 'Bearer ' + token };
    const [statsRes, nodesRes, alertsRes, metricsRes] = await Promise.allSettled([
        fetch(base + '/api/dashboard/stats', { headers }),
        fetch(base + '/api/dashboard/nodes', { headers }),
        fetch(base + '/api/monitoring/prom-alerts', { headers }),
        fetch(base + '/api/monitoring/node-metrics', { headers }),
    ]);
    let stats = { totalNodes: 0, onlineNodes: 0, downNodes: 0, cpuUsage: 0, memUsage: 0, totalGPUs: 0, allocGPUs: 0 };
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const d = (await statsRes.value.json()).data || {};
        stats = {
            totalNodes: d.total_nodes ?? 0,
            onlineNodes: d.online_nodes ?? 0,
            downNodes: d.down_nodes ?? 0,
            cpuUsage: d.cpu_usage_percent ?? 0,
            memUsage: d.memory_usage_percent ?? 0,
            totalGPUs: d.total_gpus ?? 0,
            allocGPUs: d.allocated_gpus ?? 0,
        };
    }
    let downNodeNames = [];
    if (nodesRes.status === 'fulfilled' && nodesRes.value.ok) {
        const nodes = (await nodesRes.value.json()).data || [];
        downNodeNames = nodes
            .filter((n) => { const s = (n.state || '').toLowerCase(); return s.includes('down') || s.includes('drain'); })
            .map((n) => n.name);
    }
    let alerts = [];
    let promConnected = false;
    if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const d = await alertsRes.value.json();
        promConnected = d.connected !== false;
        alerts = (d.alerts || []).map((a) => ({
            name: a.labels?.alertname || 'unknown',
            severity: a.labels?.severity || 'info',
            instance: a.labels?.instance || a.labels?.job || '-',
            summary: a.annotations?.summary || a.annotations?.description || '-',
            activeAt: a.activeAt || '',
        }));
    }
    let nodeMetrics = [];
    if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
        const d = await metricsRes.value.json();
        if (d.connected && d.nodes) {
            nodeMetrics = d.nodes.map((n) => ({
                instance: n.instance || '',
                cpuUsage: Math.round(n.cpu_usage ?? 0),
                memUsage: Math.round(n.mem_usage ?? 0),
                diskUsage: Math.round(n.disk_usage ?? 0),
                load1: +(n.load1 ?? 0).toFixed(2),
                netRx: Math.round((n.net_rx_bps ?? 0) / 1024),
                netTx: Math.round((n.net_tx_bps ?? 0) / 1024),
            }));
        }
    }
    return { stats, downNodeNames, alerts, nodeMetrics, promConnected, fetchedAt: new Date().toLocaleTimeString('zh-CN') };
}
export function buildSystemPrompt(snap) {
    const s = snap.stats;
    const downList = snap.downNodeNames.length > 0 ? snap.downNodeNames.join(', ') : '无';
    const alertLines = snap.alerts.length > 0
        ? snap.alerts.map(a => `  [${a.severity}] ${a.name} | ${a.instance} | ${a.summary}`).join('\n')
        : '  无活跃告警';
    const topNodes = [...snap.nodeMetrics]
        .sort((a, b) => b.cpuUsage - a.cpuUsage)
        .slice(0, 10);
    const nodeLines = topNodes.length > 0
        ? topNodes.map(n => `  ${n.instance}: CPU ${n.cpuUsage}% | MEM ${n.memUsage}% | DISK ${n.diskUsage}% | Load ${n.load1} | Net ↓${n.netRx}KB/s ↑${n.netTx}KB/s`).join('\n')
        : '  暂无数据';
    return `你是一个专业的 HPC 集群监控分析 AI，请用中文回答，基于以下实时数据进行分析。

【集群状态 - ${snap.fetchedAt}】
节点: 总计 ${s.totalNodes} | 在线 ${s.onlineNodes} | 离线 ${s.downNodes}
CPU: ${s.cpuUsage.toFixed(1)}% | 内存: ${s.memUsage.toFixed(1)}% | GPU: ${s.allocGPUs}/${s.totalGPUs}

【离线节点】
${downList}

【活跃告警 (${snap.alerts.length} 条)】
${alertLines}

【节点实时指标 (按 CPU 排序前10)】
${nodeLines}

【Prometheus】${snap.promConnected ? '已连接' : '未连接'}

请直接基于以上数据进行分析，给出具体结论和建议。`;
}
