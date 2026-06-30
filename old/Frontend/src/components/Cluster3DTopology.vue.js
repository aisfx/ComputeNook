/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="D:/workspace/go-dev/ComputeNook/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
const props = defineProps();
const chartEl = ref();
const bgCanvas = ref();
let chart = null;
let animationId = null;
// 绘制小房子背景
const initBackground = () => {
    if (!bgCanvas.value)
        return;
    const canvas = bgCanvas.value;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    // 绘制房子结构
    const drawHouse = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const houseWidth = Math.min(canvas.width * 0.8, 700);
        const houseHeight = Math.min(canvas.height * 0.75, 450);
        const houseX = centerX - houseWidth / 2;
        const houseY = centerY - houseHeight / 2 + 30;
        // 房子主体
        ctx.strokeStyle = props.isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 3;
        ctx.fillStyle = props.isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(248, 250, 252, 0.5)';
        ctx.beginPath();
        ctx.rect(houseX, houseY, houseWidth, houseHeight);
        ctx.fill();
        ctx.stroke();
        // 屋顶
        ctx.fillStyle = props.isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)';
        ctx.strokeStyle = props.isDark ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(houseX - 30, houseY);
        ctx.lineTo(centerX, houseY - 60);
        ctx.lineTo(houseX + houseWidth + 30, houseY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 烟囱
        ctx.fillStyle = props.isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)';
        ctx.strokeStyle = props.isDark ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(houseX + houseWidth * 0.7, houseY - 80, 30, 50);
        ctx.fill();
        ctx.stroke();
        // 房间分隔线
        ctx.strokeStyle = props.isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        // 垂直分隔线
        ctx.beginPath();
        ctx.moveTo(centerX, houseY);
        ctx.lineTo(centerX, houseY + houseHeight);
        ctx.stroke();
        // 水平分隔线
        ctx.beginPath();
        ctx.moveTo(houseX, centerY);
        ctx.lineTo(houseX + houseWidth, centerY);
        ctx.stroke();
        ctx.setLineDash([]);
        // 房间标签
        ctx.font = props.isDark ? 'bold 14px sans-serif' : 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        // 左上 - 计算节点房间
        ctx.fillStyle = props.isDark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.5)';
        ctx.fillText('🖥️ 计算机房', houseX + houseWidth * 0.25, houseY + 15);
        // 右上 - GPU房间
        ctx.fillStyle = props.isDark ? 'rgba(139, 92, 246, 0.6)' : 'rgba(139, 92, 246, 0.5)';
        ctx.fillText('🎮 GPU加速室', houseX + houseWidth * 0.75, houseY + 15);
        // 左下 - 存储房间
        ctx.fillStyle = props.isDark ? 'rgba(245, 158, 11, 0.6)' : 'rgba(245, 158, 11, 0.5)';
        ctx.fillText('💾 存储仓库', houseX + houseWidth * 0.25, centerY + 15);
        // 右下 - 建筑房间
        ctx.fillStyle = props.isDark ? 'rgba(6, 182, 212, 0.6)' : 'rgba(6, 182, 212, 0.5)';
        ctx.fillText('🏗️ 建筑工坊', houseX + houseWidth * 0.75, centerY + 15);
        // 中心 - 核心控制室
        ctx.font = props.isDark ? 'bold 16px sans-serif' : 'bold 15px sans-serif';
        ctx.fillStyle = props.isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.6)';
        ctx.fillText('⚡ 核心控制室', centerX, centerY - 10);
        // 门
        ctx.fillStyle = props.isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.25)';
        ctx.strokeStyle = props.isDark ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(centerX - 25, houseY + houseHeight - 60, 50, 60);
        ctx.fill();
        ctx.stroke();
        // 门把手
        ctx.fillStyle = props.isDark ? 'rgba(245, 158, 11, 0.8)' : 'rgba(245, 158, 11, 0.7)';
        ctx.beginPath();
        ctx.arc(centerX + 15, houseY + houseHeight - 30, 4, 0, Math.PI * 2);
        ctx.fill();
        // 窗户装饰
        const drawWindow = (x, y) => {
            ctx.fillStyle = props.isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(96, 165, 250, 0.15)';
            ctx.strokeStyle = props.isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(96, 165, 250, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(x, y, 40, 35);
            ctx.fill();
            ctx.stroke();
            // 窗框
            ctx.beginPath();
            ctx.moveTo(x + 20, y);
            ctx.lineTo(x + 20, y + 35);
            ctx.moveTo(x, y + 17.5);
            ctx.lineTo(x + 40, y + 17.5);
            ctx.stroke();
        };
        drawWindow(houseX + 50, houseY + 60);
        drawWindow(houseX + houseWidth - 90, houseY + 60);
    };
    const resize = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        drawHouse();
    };
    resize();
    window.addEventListener('resize', resize);
};
const initChart = () => {
    if (!chartEl.value)
        return;
    chart = echarts.init(chartEl.value);
    updateChart();
};
const updateChart = () => {
    if (!chart)
        return;
    // 统计不同类型的节点
    const cpuNodes = props.nodes.filter(n => !n.name?.toLowerCase().includes('gpu'));
    const gpuNodes = props.nodes.filter(n => n.name?.toLowerCase().includes('gpu'));
    const storageNodes = props.nodes.filter(n => n.name?.toLowerCase().includes('storage') || n.name?.toLowerCase().includes('nfs'));
    const cpuCount = cpuNodes.length || 1024;
    const gpuCount = gpuNodes.length || 16;
    const storageCount = storageNodes.length || 8;
    const buildingCount = 2;
    // 计算运行状态
    const cpuRunning = cpuNodes.filter(n => {
        const s = (n.state || '').toLowerCase();
        return s.includes('alloc') || s.includes('mix');
    }).length || 882;
    const cpuIdle = cpuCount - cpuRunning;
    const gpuRunning = gpuNodes.filter(n => {
        const s = (n.state || '').toLowerCase();
        return s.includes('alloc') || s.includes('mix');
    }).length || 12;
    const gpuIdle = gpuCount - gpuRunning;
    const storageRunning = storageNodes.filter(n => {
        const s = (n.state || '').toLowerCase();
        return s.includes('alloc') || s.includes('mix');
    }).length || 7;
    const storageIdle = storageCount - storageRunning;
    // 房子布局 - 将节点放置在对应的房间中
    const centerX = 400;
    const centerY = 250;
    const roomWidth = 175;
    const roomHeight = 110;
    // 准备2D节点数据
    const data2D = [];
    const links2D = [];
    // 中心核心控制室
    data2D.push({
        name: '算力小筑',
        x: centerX,
        y: centerY,
        symbol: 'diamond',
        symbolSize: 70,
        itemStyle: {
            color: '#3b82f6',
            borderColor: '#60a5fa',
            borderWidth: 3,
            shadowBlur: 25,
            shadowColor: 'rgba(59, 130, 246, 0.6)'
        },
        label: {
            show: true,
            formatter: '⚡ {b}\nHPC',
            color: props.isDark ? '#60a5fa' : '#1e40af',
            fontSize: 14,
            fontWeight: 'bold',
            lineHeight: 18
        }
    });
    // 左上 - 计算节点房间
    data2D.push({
        name: '计算节点',
        x: centerX - roomWidth / 2,
        y: centerY - roomHeight / 2,
        symbol: 'rect',
        symbolSize: [80, 50],
        itemStyle: {
            color: '#10b981',
            borderColor: '#34d399',
            borderWidth: 2,
            shadowBlur: 15,
            shadowColor: 'rgba(16, 185, 129, 0.5)'
        },
        label: {
            show: true,
            formatter: `🖥️ 计算节点\n${cpuCount}台 | 运行${cpuRunning}`,
            color: props.isDark ? '#34d399' : '#047857',
            fontSize: 11,
            lineHeight: 16
        }
    });
    links2D.push({
        source: 0,
        target: 1,
        lineStyle: {
            color: '#10b981',
            width: 2.5,
            type: 'solid',
            shadowBlur: 8,
            shadowColor: 'rgba(16, 185, 129, 0.3)'
        }
    });
    // 右上 - GPU节点房间
    data2D.push({
        name: 'GPU节点',
        x: centerX + roomWidth / 2,
        y: centerY - roomHeight / 2,
        symbol: 'rect',
        symbolSize: [80, 50],
        itemStyle: {
            color: '#8b5cf6',
            borderColor: '#a78bfa',
            borderWidth: 2,
            shadowBlur: 15,
            shadowColor: 'rgba(139, 92, 246, 0.5)'
        },
        label: {
            show: true,
            formatter: `🎮 GPU节点\n${gpuCount}台 | 运行${gpuRunning}`,
            color: props.isDark ? '#a78bfa' : '#6d28d9',
            fontSize: 11,
            lineHeight: 16
        }
    });
    links2D.push({
        source: 0,
        target: 2,
        lineStyle: {
            color: '#8b5cf6',
            width: 2.5,
            type: 'solid',
            shadowBlur: 8,
            shadowColor: 'rgba(139, 92, 246, 0.3)'
        }
    });
    // 左下 - 存储节点房间
    data2D.push({
        name: '存储节点',
        x: centerX - roomWidth / 2,
        y: centerY + roomHeight / 2,
        symbol: 'rect',
        symbolSize: [80, 50],
        itemStyle: {
            color: '#f59e0b',
            borderColor: '#fbbf24',
            borderWidth: 2,
            shadowBlur: 15,
            shadowColor: 'rgba(245, 158, 11, 0.5)'
        },
        label: {
            show: true,
            formatter: `💾 存储节点\n${storageCount}台 | 运行${storageRunning}`,
            color: props.isDark ? '#fbbf24' : '#b45309',
            fontSize: 11,
            lineHeight: 16
        }
    });
    links2D.push({
        source: 0,
        target: 3,
        lineStyle: {
            color: '#f59e0b',
            width: 2.5,
            type: 'solid',
            shadowBlur: 8,
            shadowColor: 'rgba(245, 158, 11, 0.3)'
        }
    });
    // 右下 - 建筑节点房间
    data2D.push({
        name: '建筑节点',
        x: centerX + roomWidth / 2,
        y: centerY + roomHeight / 2,
        symbol: 'rect',
        symbolSize: [80, 50],
        itemStyle: {
            color: '#06b6d4',
            borderColor: '#22d3ee',
            borderWidth: 2,
            shadowBlur: 15,
            shadowColor: 'rgba(6, 182, 212, 0.5)'
        },
        label: {
            show: true,
            formatter: `🏗️ 建筑节点\n${buildingCount}台 | 运行${buildingCount}`,
            color: props.isDark ? '#22d3ee' : '#0e7490',
            fontSize: 11,
            lineHeight: 16
        }
    });
    links2D.push({
        source: 0,
        target: 4,
        lineStyle: {
            color: '#06b6d4',
            width: 2.5,
            type: 'solid',
            shadowBlur: 8,
            shadowColor: 'rgba(6, 182, 212, 0.3)'
        }
    });
    chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
            show: true,
            trigger: 'item',
            formatter: (params) => {
                if (params.dataType === 'node') {
                    return params.data.label.formatter.replace(/\n/g, '<br/>');
                }
                return '';
            },
            backgroundColor: props.isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: props.isDark ? '#475569' : '#e2e8f0',
            borderWidth: 1,
            textStyle: {
                color: props.isDark ? '#e2e8f0' : '#1e293b'
            }
        },
        series: [{
                type: 'graph',
                layout: 'none',
                data: data2D,
                links: links2D,
                roam: true,
                draggable: true,
                itemStyle: {
                    borderWidth: 2
                },
                lineStyle: {
                    width: 3,
                    curveness: 0.2
                },
                emphasis: {
                    focus: 'adjacency',
                    label: {
                        show: true,
                        fontSize: 14
                    },
                    itemStyle: {
                        borderWidth: 4,
                        shadowBlur: 25
                    },
                    lineStyle: {
                        width: 5
                    }
                },
                animation: true,
                animationDuration: 1000,
                animationEasing: 'cubicOut'
            }]
    });
};
watch(() => [props.nodes, props.isDark], () => {
    updateChart();
}, { deep: true });
onMounted(() => {
    initBackground();
    initChart();
    window.addEventListener('resize', () => chart?.resize());
});
onUnmounted(() => {
    if (animationId)
        cancelAnimationFrame(animationId);
    chart?.dispose();
    window.removeEventListener('resize', () => chart?.resize());
});
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['cluster-2d-topo']} */ ;
/** @type {__VLS_StyleScopedClasses['cluster-2d-topo']} */ ;
/** @type {__VLS_StyleScopedClasses['cluster-2d-topo']} */ ;
/** @type {__VLS_StyleScopedClasses['cluster-2d-topo']} */ ;
/** @type {__VLS_StyleScopedClasses['light']} */ ;
/** @type {__VLS_StyleScopedClasses['cluster-2d-topo']} */ ;
/** @type {__VLS_StyleScopedClasses['light']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['cluster-2d-topo', { light: !__VLS_ctx.isDark }]) },
});
/** @type {__VLS_StyleScopedClasses['light']} */ ;
/** @type {__VLS_StyleScopedClasses['cluster-2d-topo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.canvas, __VLS_intrinsics.canvas)({
    ref: "bgCanvas",
    ...{ class: "tech-bg" },
});
/** @type {__VLS_StyleScopedClasses['tech-bg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "chartEl",
    ...{ class: "chart-layer" },
});
/** @type {__VLS_StyleScopedClasses['chart-layer']} */ ;
// @ts-ignore
[isDark,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
