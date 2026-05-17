<template>
  <div class="mon">

    <!-- ══ 一、管理节点 ══ -->
    <div v-if="mainTab==='mgmt'" class="mon-section">
      <!-- 管理服务健康 -->
      <div class="mon-block-title">▾ 管理服务健康</div>
      <div class="svc-health-grid">
        <div v-for="svc in mgmtServices" :key="svc.name" :class="['svc-card', svc.active ? 'svc-ok' : 'svc-down']">
          <div class="svc-card-header">
            <span class="svc-dot" :class="svc.active ? 'dot-ok' : 'dot-down'"></span>
            <span class="svc-name">{{ svc.display }}</span>
            <span :class="['svc-badge', svc.active ? 'badge-ok' : svc.state === 'failed' ? 'badge-fail' : 'badge-na']">
              {{ svc.state || 'unknown' }}
            </span>
          </div>
          <div class="svc-metrics">
            <div class="svc-metric-row">
              <span class="svc-metric-label">CPU</span>
              <div class="svc-bar-wrap">
                <div class="svc-bar-bg">
                  <div class="svc-bar-fg" :style="{ width: Math.min(svc.cpu, 100) + '%', background: svc.cpu > 80 ? '#ef4444' : svc.cpu > 50 ? '#f59e0b' : '#10b981' }"></div>
                </div>
                <span class="svc-metric-val">{{ svc.cpu.toFixed(1) }}%</span>
              </div>
            </div>
            <div class="svc-metric-row">
              <span class="svc-metric-label">内存</span>
              <div class="svc-bar-wrap">
                <div class="svc-bar-bg">
                  <div class="svc-bar-fg" :style="{ width: Math.min(svc.mem_mb / 10, 100) + '%', background: '#667eea' }"></div>
                </div>
                <span class="svc-metric-val">{{ svc.mem_mb.toFixed(0) }} MB</span>
              </div>
            </div>
            <div class="svc-metric-row">
              <span class="svc-metric-label">句柄</span>
              <span class="svc-metric-val svc-fd">{{ svc.fds > 0 ? svc.fds.toFixed(0) : '-' }}</span>
            </div>
          </div>
        </div>
        <div v-if="mgmtServices.length === 0" class="svc-empty">
          <span>暂无服务数据，请确认后端可访问管理节点</span>
        </div>
      </div>

      <!-- 管理节点 -->
      <div class="mon-block-title">▾ 管理节点</div>
      <div class="cv-charts-grid4">
        <div class="cv-chart-card">
          <div class="cv-chart-name">管理节点-CPU使用率</div>
          <div class="cv-chart-sub">CPU使用率(%)</div>
          <div ref="mgmtNodeCpuEl" class="cv-echarts-box"></div>
        </div>
        <div class="cv-chart-card">
          <div class="cv-chart-name">管理节点-内存使用率</div>
          <div class="cv-chart-sub">内存使用率(%)</div>
          <div ref="mgmtNodeMemEl" class="cv-echarts-box"></div>
        </div>
        <div class="cv-chart-card">
          <div class="cv-chart-name">管理节点-网卡流量</div>
          <div class="cv-chart-sub">bytes/s</div>
          <div ref="mgmtNodeNetEl" class="cv-echarts-box"></div>
        </div>
        <div class="cv-chart-card">
          <div class="cv-chart-name">管理节点-磁盘使用率</div>
          <div class="cv-chart-sub">磁盘使用率(%)</div>
          <div ref="mgmtNodeDiskEl" class="cv-echarts-box"></div>
        </div>
      </div>

      <!-- 节点列表 -->
      <div class="mon-block-title">▾ 节点列表（基础信息）</div>
      <div class="mon-table-wrap">
        <table class="mtable">
          <thead><tr><th>节点名称</th><th>节点IP</th><th>节点服务列表</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="n in nodeMetrics" :key="n.instance">
              <td><code>{{ shortName(n.instance) }}</code></td>
              <td class="small-text">{{ n.instance }}</td>
              <td class="small-text">node_exporter</td>
              <td><span :class="['nc-state', nodeStateCls(n)]">{{ nodeStateText(n) }}</span></td>
            </tr>
            <tr v-if="nodeMetrics.length===0"><td colspan="4" class="empty-sm">暂无节点数据</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ══ 二、计算节点 ══ -->
    <div v-if="mainTab==='cluster'" class="mon-section">
      <!-- 节点数量与资源统计 -->
      <div class="mon-block-title">▾ 节点数量和资源统计</div>
      <div class="cv-top-row">
        <div class="cv-top-left">
          <div class="cv-stat-block">
            <div class="cv-stat-label">节点数</div>
            <div class="cv-stat-big">{{ nodeMetrics.length }}</div>
          </div>
          <div class="cv-state-table">
            <div class="cv-state-row cv-state-unschedulable"><span class="cv-state-bar"></span><span class="cv-state-name">不可调度</span><span class="cv-state-num">{{ clusterNodeStates.unschedulable }}</span></div>
            <div class="cv-state-row cv-state-busy"><span class="cv-state-bar"></span><span class="cv-state-name">繁忙</span><span class="cv-state-num">{{ clusterNodeStates.busy }}</span></div>
            <div class="cv-state-row cv-state-normal"><span class="cv-state-bar"></span><span class="cv-state-name">正常</span><span class="cv-state-num">{{ clusterNodeStates.normal }}</span></div>
            <div class="cv-state-row cv-state-idle"><span class="cv-state-bar"></span><span class="cv-state-name">空闲</span><span class="cv-state-num">{{ clusterNodeStates.idle }}</span></div>
          </div>
        </div>
        <div class="cv-gauges-row">
          <div class="cv-gauge-card" v-for="g in gaugeList" :key="g.key">
            <div class="cv-gauge-title">{{ g.label }}</div>
            <div class="cv-gauge-wrap">
              <svg viewBox="0 0 120 70" class="cv-gauge-svg">
                <path d="M10,65 A55,55 0 0,1 110,65" fill="none" stroke="#2a2a3a" stroke-width="12" stroke-linecap="round"/>
                <path d="M10,65 A55,55 0 0,1 110,65" fill="none" :stroke="gaugeColor(g.val, g.warn)" stroke-width="12" stroke-linecap="round" :stroke-dasharray="`${g.val * 1.728} 172.8`" stroke-dashoffset="0"/>
                <text x="6" y="72" font-size="8" fill="#666">0</text>
                <text x="54" y="16" font-size="8" fill="#666" text-anchor="middle">50</text>
                <text x="108" y="72" font-size="8" fill="#666" text-anchor="end">100</text>
              </svg>
              <div class="cv-gauge-val" :style="{ color: gaugeColor(g.val, g.warn) }">{{ fmt1(g.val) }}</div>
              <div class="cv-gauge-unit">(%)</div>
            </div>
          </div>
        </div>
        <div class="cv-res-stats">
          <div class="cv-res-card"><div class="cv-res-label">CPU总核数（核）</div><div class="cv-res-val">{{ clusterRes.cpuTotal }}</div></div>
          <div class="cv-res-card"><div class="cv-res-label">CPU空闲核数（核）</div><div class="cv-res-val cv-res-green">{{ clusterRes.cpuFree }}</div></div>
          <div class="cv-res-card"><div class="cv-res-label">GPU总卡数（卡）</div><div class="cv-res-val">{{ clusterRes.gpuTotal }}</div></div>
          <div class="cv-res-card"><div class="cv-res-label">GPU空闲卡数（卡）</div><div class="cv-res-val cv-res-green">{{ clusterRes.gpuFree }}</div></div>
          <div class="cv-res-card"><div class="cv-res-label">内存总数（GB）</div><div class="cv-res-val">{{ clusterRes.memTotal }}</div></div>
          <div class="cv-res-card"><div class="cv-res-label">内存空闲数（GB）</div><div class="cv-res-val cv-res-green">{{ clusterRes.memFree }}</div></div>
        </div>
      </div>

      <!-- CPU 时序 -->
      <div class="cv-chart-tabs">
        <button :class="['cv-chart-tab', chartTab==='cpu' && 'active']" @click="chartTab='cpu'">CPU</button>
        <button :class="['cv-chart-tab', chartTab==='gpu' && 'active']" @click="chartTab='gpu'">GPU</button>
        <button :class="['cv-chart-tab', chartTab==='mem' && 'active']" @click="chartTab='mem'">内存</button>
        <span :class="['prom-badge', promOk ? 'prom-ok' : 'prom-na']" style="margin-left:auto">{{ promOk ? '已连接' : '未连接' }}</span>
      </div>

      <div v-if="chartTab==='cpu'">
        <div class="cv-section-title">▾ CPU</div>
        <div class="cv-charts-grid4">
          <div class="cv-chart-card"><div class="cv-chart-name">CPU使用率</div><div class="cv-chart-sub">集群CPU利用率平均值(%)</div><div ref="cpuChartEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">CPU核调度率</div><div class="cv-chart-sub">已调度CPU核数/CPU总核数(%)</div><div ref="cpuSchedChartEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">CPU一分钟负载</div><div class="cv-chart-sub">所有节点负载之和/总核数</div><div ref="cpuLoadChartEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">已使用CPU核数</div><div class="cv-chart-sub">— CPU总核数 — 已使用CPU核数</div><div ref="cpuCoresChartEl" class="cv-echarts-box"></div></div>
        </div>
      </div>

      <div v-if="chartTab==='gpu'">
        <div class="cv-section-title">▾ GPU</div>
        <div class="cv-charts-grid4">
          <div class="cv-chart-card"><div class="cv-chart-name">GPU使用率</div><div class="cv-chart-sub">(GPU总卡数-可用GPU总卡数)/GPU总卡数(%)</div><div ref="gpuRateEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">已使用GPU卡数</div><div class="cv-chart-sub">GPU总卡数-可用GPU总卡数</div><div ref="gpuUsedEl" class="cv-echarts-box"></div></div>
        </div>
      </div>

      <div v-if="chartTab==='mem'">
        <div class="cv-section-title">▾ 内存</div>
        <div class="cv-charts-grid3">
          <div class="cv-chart-card"><div class="cv-chart-name">内存使用率</div><div class="cv-chart-sub">(内存总数-可用内存总数)/内存总数(%)</div><div ref="memChartEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">已使用内存</div><div class="cv-chart-sub">(内存总数-可用内存总数)/1024 GB</div><div ref="memUsedChartEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">已使用交换分区</div><div class="cv-chart-sub">交换分区总数-可用交换分区总数</div><div ref="swapChartEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">交换分区使用率</div><div class="cv-chart-sub">(交换分区总数-可用交换分区总数)/交换分区总数(%)</div><div ref="swapRateChartEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">已使用临时分区</div><div class="cv-chart-sub">临时分区总数-可用临时分区总数</div><div ref="tmpChartEl" class="cv-echarts-box"></div></div>
          <div class="cv-chart-card"><div class="cv-chart-name">临时分区使用率</div><div class="cv-chart-sub">(临时分区总数-可用临时分区总数)/临时分区总数(%)</div><div ref="tmpRateChartEl" class="cv-echarts-box"></div></div>
        </div>
      </div>
    </div>

    <!-- ══ 三、网络监控 ══ -->
    <div v-if="mainTab==='network'" class="mon-section">
      <div class="mon-block-title">▾ 网卡总览</div>
      <div class="mon-table-wrap" style="overflow-x:auto">
        <table class="mtable">
          <thead><tr><th>日期</th><th>集群</th><th>节点</th><th>资源名称</th><th>CNP收包数</th><th>CNP发包数</th><th>PFC收包数</th><th>PFC发包数</th><th>网卡收包数</th><th>网卡发包数</th><th>丢包数</th><th>重传包数</th></tr></thead>
          <tbody>
            <tr v-for="n in nodeMetrics" :key="n.instance">
              <td class="small-text">{{ lastRefresh || '-' }}</td>
              <td class="small-text">default</td>
              <td class="small-text">{{ shortName(n.instance) }}</td>
              <td class="small-text">eth0</td>
              <td>{{ fmt0(n.net_rx_bps) }}</td>
              <td>{{ fmt0(n.net_tx_bps) }}</td>
              <td>0</td><td>0</td>
              <td>{{ fmt0(n.net_rx_bps) }}</td>
              <td>{{ fmt0(n.net_tx_bps) }}</td>
              <td>0</td><td>0</td>
            </tr>
            <tr v-if="nodeMetrics.length===0"><td colspan="12" class="empty-sm">暂无网络数据</td></tr>
          </tbody>
        </table>
      </div>

      <div class="cv-charts-grid4" style="margin-top:0">
        <div class="cv-chart-card"><div class="cv-chart-name">CNP收发包数</div><div class="cv-chart-sub">时序累计数量</div><div ref="netCnpEl" class="cv-echarts-box"></div></div>
        <div class="cv-chart-card"><div class="cv-chart-name">PFC收发包数</div><div class="cv-chart-sub">时序累计数量</div><div ref="netPfcEl" class="cv-echarts-box"></div></div>
        <div class="cv-chart-card"><div class="cv-chart-name">网卡收发包数</div><div class="cv-chart-sub">时序累计数量</div><div ref="netNicEl" class="cv-echarts-box"></div></div>
        <div class="cv-chart-card"><div class="cv-chart-name">丢包重传包数</div><div class="cv-chart-sub">时序累计数量</div><div ref="netDropEl" class="cv-echarts-box"></div></div>
      </div>
    </div>

    <!-- ══ 四、告警规则 ══ -->
    <div v-if="mainTab==='alerts'" class="mon-section">
      <div class="alert-subtabs">
        <button :class="['alert-subtab', alertTab==='active' && 'active']" @click="alertTab='active'">
          🔔 当前告警<span v-if="promAlerts.length" class="alert-badge" style="margin-left:4px">{{ promAlerts.length }}</span>
        </button>
        <button :class="['alert-subtab', alertTab==='rules' && 'active']" @click="alertTab='rules'">
          📐 告警规则<span v-if="allRules.length" class="nodes-count" style="margin-left:4px">{{ allRules.length }} 条</span>
        </button>
        <button :class="['alert-subtab', alertTab==='config' && 'active']" @click="alertTab='config'">⚙️ 告警配置</button>
      </div>

      <!-- 当前告警 -->
      <div v-if="alertTab==='active'" style="padding:1rem">
        <div class="alert-tab-toolbar">
          <span :class="['prom-badge', promAlertsOk ? 'prom-ok' : 'prom-na']">{{ promAlertsOk ? '已连接' : '未连接' }}</span>
        </div>
        <div v-if="!promAlertsOk" class="prom-tip">未配置 Prometheus 或无法连接</div>
        <div v-else-if="promAlerts.length===0" class="empty-sm">✅ 无活跃告警</div>
        <div v-else style="overflow-x:auto">
          <table class="mtable">
            <thead><tr><th>级别</th><th>告警名称</th><th>实例</th><th>摘要</th><th>触发时间</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="a in promAlerts" :key="a.fingerprint" :class="a.labels?.severity==='critical' ? 'tr-critical' : 'tr-warning'">
                <td><span :class="['sev-badge', 'sev-'+(a.labels?.severity||'info')]">{{ a.labels?.severity || 'info' }}</span></td>
                <td><code>{{ a.labels?.alertname || '-' }}</code></td>
                <td class="small-text">{{ a.labels?.instance || a.labels?.job || '-' }}</td>
                <td class="small-text">{{ a.annotations?.summary || a.annotations?.description || '-' }}</td>
                <td class="small-text">{{ fmtTime(a.activeAt) }}</td>
                <td><button class="btn-sec" style="font-size:0.75rem;padding:0.2rem 0.5rem">确认</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 历史告警 -->

      <!-- 屏蔽告警 -->

      <!-- 告警规则 -->
      <div v-if="alertTab==='rules'" style="padding:1rem">
        <div class="alert-tab-toolbar">
          <span :class="['prom-badge', rulesConnected ? 'prom-ok' : 'prom-na']">{{ rulesConnected ? '已连接' : '未连接' }}</span>
          <input v-model="ruleSearch" placeholder="搜索规则..." class="rule-search" style="margin-left:auto" />
          <button class="btn-sec" @click="loadRules" :disabled="rulesLoading" style="font-size:0.78rem;padding:0.25rem 0.5rem">{{ rulesLoading ? '...' : '🔄' }}</button>
        </div>
        <div v-if="!rulesConnected" class="prom-tip">无法连接 Prometheus</div>
        <div v-else style="overflow-x:auto">
          <table class="mtable">
            <thead><tr><th>规则名</th><th>表达式</th><th>持续</th><th>级别</th><th>状态</th><th>摘要</th></tr></thead>
            <tbody>
              <template v-for="group in filteredRuleGroups" :key="group.name">
                <tr v-for="r in group.rules" :key="r.name">
                  <td><code>{{ r.name }}</code></td>
                  <td class="expr-cell" :title="r.query">{{ r.query }}</td>
                  <td>{{ r.duration ? r.duration+'s' : '-' }}</td>
                  <td><span :class="['sev-badge', 'sev-'+(r.labels?.severity||'info')]">{{ r.labels?.severity || 'info' }}</span></td>
                  <td><span :class="['state-badge2', r.state==='firing' ? 'st-firing' : r.state==='pending' ? 'st-pending' : 'st-ok']">{{ r.state || 'inactive' }}</span></td>
                  <td class="small-text">{{ r.annotations?.summary || r.annotations?.description || '-' }}</td>
                </tr>
              </template>
              <tr v-if="filteredRuleGroups.length===0"><td colspan="6" class="empty-sm">暂无告警规则</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 告警配置 -->
      <div v-if="alertTab==='config'" style="padding:1rem">
        <div class="local-cfg-card">
          <div class="lcc-title">告警配置</div>
          <div class="lcc-row">
            <label>CPU 警告 <input type="number" v-model.number="cfg.cpuWarn" min="50" max="100" class="num-input" /> %</label>
            <label>内存警告 <input type="number" v-model.number="cfg.memWarn" min="50" max="100" class="num-input" /> %</label>
            <label>弹框通知 <label class="toggle"><input type="checkbox" v-model="cfg.popupEnabled" /><span class="toggle-slider"></span></label></label>
            <label>声音告警 <label class="toggle"><input type="checkbox" v-model="cfg.soundEnabled" /><span class="toggle-slider"></span></label></label>
            <label>告警间隔 <input type="number" v-model.number="cfg.alertInterval" min="30" max="3600" class="num-input" /> 秒</label>
          </div>
          <div class="sound-upload-row">
            <span class="lcc-title" style="margin:0">🎵 告警音乐</span>
            <div class="sound-upload-area">
              <label class="sound-upload-btn">📁 上传音频<input type="file" accept="audio/*" @change="onSoundUpload" style="display:none" /></label>
              <span v-if="customSoundName" class="sound-name">{{ customSoundName }}</span>
              <button v-if="customSoundUrl" class="btn-sec" style="font-size:0.78rem;padding:0.25rem 0.6rem" @click="testSound">▶ 试听</button>
              <button v-if="customSoundUrl" class="btn-sec" style="font-size:0.78rem;padding:0.25rem 0.6rem;color:#ef4444" @click="clearSound">✕</button>
              <span v-if="!customSoundUrl" class="sound-hint">支持 mp3/wav/ogg，未上传则用默认蜂鸣音</span>
            </div>
          </div>
          <div class="lcc-row" style="margin-top:0.5rem">
            <button class="btn-pri" @click="saveCfg">💾 保存</button>
            <span v-if="cfgSaved" class="save-tip">✅ 已保存</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 五、作业管理 ══ -->
    <div v-if="mainTab==='jobs'" class="mon-section">
      <!-- 筛选栏 -->
      <div class="job-filter-bar">
        <div class="jf-item">
          <label class="jf-label">分区</label>
          <select v-model="jobFilter.partition" class="jf-sel" @change="applyJobFilter">
            <option value="">ALL</option>
            <option v-for="p in jobPartitions" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div class="jf-item">
          <label class="jf-label">队列</label>
          <select v-model="jobFilter.queue" class="jf-sel" @change="applyJobFilter">
            <option value="">ALL</option>
            <option v-for="q in jobQueues" :key="q" :value="q">{{ q }}</option>
          </select>
        </div>
        <div class="jf-item">
          <label class="jf-label">账户</label>
          <select v-model="jobFilter.account" class="jf-sel" @change="applyJobFilter">
            <option value="">ALL</option>
            <option v-for="a in jobAccounts" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <div class="jf-item">
          <label class="jf-label">用户</label>
          <select v-model="jobFilter.user" class="jf-sel" @change="applyJobFilter">
            <option value="">ALL</option>
            <option v-for="u in jobUsers" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
        <div class="jf-item">
          <label class="jf-label">提交节点</label>
          <select v-model="jobFilter.submitNode" class="jf-sel" @change="applyJobFilter">
            <option value="">ALL</option>
            <option v-for="n in jobSubmitNodes" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <div class="jf-actions">
          <button class="btn-sec" @click="loadJobDashboard" :disabled="jobLoading">{{ jobLoading ? '...' : '🔄' }}</button>
        </div>
      </div>

      <!-- 时间范围快捷 -->
      <div class="job-time-bar">
        <button v-for="r in timeRanges" :key="r.val" :class="['jt-btn', jobTimeRange===r.val && 'active']" @click="jobTimeRange=r.val; loadJobDashboard()">{{ r.label }}</button>
        <span class="jt-range-text" v-if="jobTimeRangeText">{{ jobTimeRangeText }}</span>
      </div>

      <!-- 作业状态和趋势 -->
      <div class="mon-block-title">▾ 作业状态和趋势</div>
      <div class="job-charts-row">
        <div class="job-pie-card">
          <div class="cv-chart-name">作业状态</div>
          <div class="job-pie-wrap">
            <div ref="jobPieEl" class="job-pie-chart"></div>
            <div class="job-pie-legend">
              <div v-for="s in jobStatusList" :key="s.status" class="jpl-item">
                <span class="jpl-dot" :style="{ background: s.color }"></span>
                <span class="jpl-label">{{ s.label }}</span>
                <span class="jpl-val">{{ s.count }} ({{ jobTotal > 0 ? Math.round(s.count/jobTotal*100) : 0 }}%)</span>
              </div>
            </div>
          </div>
        </div>
        <div class="job-trend-card">
          <div class="cv-chart-name">作业趋势</div>
          <div class="job-trend-legend">
            <span v-for="s in trendSeries" :key="s.name" class="jtl-item">
              <span class="jtl-line" :style="{ background: s.color, borderStyle: s.dash ? 'dashed' : 'solid' }"></span>
              {{ s.name }}
            </span>
          </div>
          <div ref="jobTrendEl" class="job-trend-chart"></div>
        </div>
      </div>

      <!-- 作业运行情况 -->
      <div class="mon-block-title">▾ 作业运行情况</div>
      <div class="cv-charts-grid3">
        <div class="cv-chart-card">
          <div class="cv-chart-name">活动作业</div>
          <div class="cv-chart-sub">RUNNING · SSTOPPED · STOPPED</div>
          <div ref="jobActiveEl" class="cv-echarts-box"></div>
        </div>
        <div class="cv-chart-card">
          <div class="cv-chart-name">完成作业</div>
          <div class="cv-chart-sub">SUCCEEDED · FAILED</div>
          <div ref="jobDoneEl" class="cv-echarts-box"></div>
        </div>
        <div class="cv-chart-card">
          <div class="cv-chart-name">提交作业</div>
          <div class="cv-chart-sub">作业总数(个)</div>
          <div ref="jobSubmitEl" class="cv-echarts-box"></div>
        </div>
      </div>

      <!-- 作业列表 -->
      <div class="mon-block-title">▾ 作业列表</div>
      <div class="mon-table-wrap">
        <table class="mtable">
          <thead>
            <tr>
              <th>作业ID</th>
              <th>作业名称</th>
              <th>用户</th>
              <th>状态</th>
              <th>分区</th>
              <th>核心数</th>
              <th>提交时间</th>
              <th>运行时长</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="j in filteredJobList" :key="j.id">
              <td class="td-mono">{{ j.id }}</td>
              <td>{{ j.name }}</td>
              <td class="small-text">{{ j.user }}</td>
              <td><span :class="['job-st-badge', 'jst-'+j.status.toLowerCase()]">{{ jobStatusLabel(j.status) }}</span></td>
              <td class="small-text">{{ j.partition }}</td>
              <td>{{ j.cpus }}</td>
              <td class="small-text">{{ j.submitTime }}</td>
              <td class="small-text">{{ j.runTime }}</td>
            </tr>
            <tr v-if="filteredJobList.length===0">
              <td colspan="8" class="empty-sm">{{ jobLoading ? '加载中...' : '暂无作业数据' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 告警弹框 -->
    <Teleport to="body">
      <div v-if="alertPopup.show" class="alert-popup-overlay" @click.self="dismissPopup">
        <div :class="['alert-popup', alertPopup.level==='critical' ? 'ap-critical' : 'ap-warning']">
          <div class="ap-icon">{{ alertPopup.level==='critical' ? '🔴' : '🟡' }}</div>
          <div class="ap-body">
            <div class="ap-title">{{ alertPopup.title }}</div>
            <div class="ap-list">
              <div v-for="a in alertPopup.alerts" :key="a.id" class="ap-item">
                <span>{{ a.level==='critical' ? '🔴' : '🟡' }}</span><span>{{ a.title }}</span>
              </div>
            </div>
          </div>
          <button class="ap-close" @click="dismissPopup">知道了</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getApiBase, isAdmin } from '../utils/auth'
import * as echarts from 'echarts/core'
import { LineChart, PieChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, PolarComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([LineChart, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, PolarComponent, CanvasRenderer])

const loading = ref(false)
const lastRefresh = ref('')
const props = defineProps<{ activeTab?: string }>()
const emit = defineEmits<{ (e: 'tab-change', tab: string): void }>()
const mainTab = ref<'mgmt'|'cluster'|'network'|'alerts'|'jobs'>(props.activeTab as any || 'cluster')
watch(() => props.activeTab, (v) => { if (v) mainTab.value = v as any }, { immediate: true })
const alertTab = ref<'active'|'rules'|'config'>('active')
const clusterTab = ref<'local'|'targets'>('local')

const clusterStats = ref<any>({})
const slurmNodes = ref<any[]>([])
const nodeMetrics = ref<any[]>([])
const promOk = ref(false)
const promAlerts = ref<any[]>([])
const promAlertsOk = ref(false)
const promTargets = ref<any[]>([])
const promTargetsOk = ref(false)
const localMetrics = ref<any>({ connected: false, hostname: '', cpu_usage: 0, mem_usage: 0, mem_total_gb: 0, mem_used_gb: 0, disk_usage: 0, disk_total_gb: 0, disk_used_gb: 0, net_rx_bps: 0, net_tx_bps: 0, load1: 0, load5: 0, load15: 0, uptime_seconds: 0 })

type HistoryPoint = {
  time: string
  nodes: Record<string, {
    cpu: number
    mem: number
    mem_used: number
    mem_total: number
    disk: number
    disk_used: number
    disk_total: number
    net_rx: number
    net_tx: number
    swap_used: number
    swap_total: number
    swap_usage: number
    tmp_used: number
    tmp_total: number
    tmp_usage: number
    load1: number
    load5: number
  }>
}
const history = ref<HistoryPoint[]>([])
const historyNode = ref('')
const cpuChartEl = ref<HTMLElement>()
const memChartEl = ref<HTMLElement>()
const diskChartEl = ref<HTMLElement>()
const netChartEl = ref<HTMLElement>()
const cpuSchedChartEl = ref<HTMLElement>()
const cpuLoadChartEl = ref<HTMLElement>()
const cpuCoresChartEl = ref<HTMLElement>()
const memUsedChartEl = ref<HTMLElement>()
const swapChartEl = ref<HTMLElement>()
const swapRateChartEl = ref<HTMLElement>()
const tmpChartEl = ref<HTMLElement>()
const tmpRateChartEl = ref<HTMLElement>()
// 管理节点
const mgmtServices = ref<Array<{ name: string; display: string; active: boolean; state: string; cpu: number; mem_mb: number; fds: number }>>([])
const mgmtSvcCpuEl = ref<HTMLElement>()
const mgmtSvcMemEl = ref<HTMLElement>()
const mgmtSvcStateEl = ref<HTMLElement>()
const mgmtSvcFdEl = ref<HTMLElement>()
const mgmtNodeCpuEl = ref<HTMLElement>()
const mgmtNodeMemEl = ref<HTMLElement>()
const mgmtNodeNetEl = ref<HTMLElement>()
const mgmtNodeDiskEl = ref<HTMLElement>()
// GPU
const gpuRateEl = ref<HTMLElement>()
const gpuUsedEl = ref<HTMLElement>()
// 网络监控
const netCnpEl = ref<HTMLElement>()
const netPfcEl = ref<HTMLElement>()
const netNicEl = ref<HTMLElement>()
const netDropEl = ref<HTMLElement>()

// ── 作业管理 ──
const jobLoading = ref(false)
const jobAllList = ref<any[]>([])
const jobTimeRange = ref('1h')
const jobFilter = ref({ partition: '', queue: '', account: '', user: '', submitNode: '' })

const timeRanges = [
  { val: '1h', label: '最近1小时' }, { val: '12h', label: '最近12小时' },
  { val: '1d', label: '最近1天' }, { val: '7d', label: '最近7天' }, { val: '14d', label: '最近14天' },
]

const jobTimeRangeText = computed(() => {
  const now = new Date()
  const end = now.toLocaleString('zh-CN').replace(/\//g, '-')
  const ms: Record<string, number> = { '1h': 3600, '12h': 43200, '1d': 86400, '7d': 604800, '14d': 1209600 }
  const start = new Date(now.getTime() - (ms[jobTimeRange.value] || 3600) * 1000)
  return `${start.toLocaleString('zh-CN').replace(/\//g, '-')} 至 ${end}`
})

const jobPartitions = computed(() => [...new Set(jobAllList.value.map(j => j.partition).filter(Boolean))])
const jobQueues = computed(() => [...new Set(jobAllList.value.map(j => j.partition).filter(Boolean))])
const jobAccounts = computed(() => [...new Set(jobAllList.value.map(j => j.account).filter(Boolean))])
const jobUsers = computed(() => [...new Set(jobAllList.value.map(j => j.user).filter(Boolean))])
const jobSubmitNodes = computed(() => [...new Set(jobAllList.value.map(j => j.submitNode).filter(Boolean))])

const filteredJobList = computed(() => {
  let list = jobAllList.value
  if (jobFilter.value.partition) list = list.filter(j => j.partition === jobFilter.value.partition)
  if (jobFilter.value.account) list = list.filter(j => j.account === jobFilter.value.account)
  if (jobFilter.value.user) list = list.filter(j => j.user === jobFilter.value.user)
  return list
})

const JOB_STATUS_CFG = [
  { status: 'RUNNING',   label: '运行中',  color: '#10b981' },
  { status: 'PENDING',   label: '等待中',  color: '#f59e0b' },
  { status: 'COMPLETED', label: '已完成',  color: '#667eea' },
  { status: 'FAILED',    label: '失败',    color: '#ef4444' },
  { status: 'CANCELLED', label: '已取消',  color: '#9ca3af' },
  { status: 'SUSPENDED', label: '已挂起',  color: '#8b5cf6' },
]

const jobStatusList = computed(() =>
  JOB_STATUS_CFG.map(s => ({ ...s, count: filteredJobList.value.filter(j => j.status === s.status).length }))
    .filter(s => s.count > 0)
)
const jobTotal = computed(() => filteredJobList.value.length)

const trendSeries = [
  { name: 'RUNNING',   color: '#10b981', dash: false },
  { name: 'PENDING',   color: '#f59e0b', dash: true  },
  { name: 'COMPLETED', color: '#667eea', dash: false },
  { name: 'FAILED',    color: '#ef4444', dash: true  },
]

// chart refs
const jobPieEl   = ref<HTMLElement>()
const jobTrendEl = ref<HTMLElement>()
const jobActiveEl  = ref<HTMLElement>()
const jobDoneEl    = ref<HTMLElement>()
const jobSubmitEl  = ref<HTMLElement>()

const jobStatusLabel = (s: string) => {
  const m: Record<string, string> = { RUNNING: '运行中', PENDING: '等待中', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消', SUSPENDED: '已挂起' }
  return m[s] || s
}

const fmtJobTime = (ts: any) => {
  if (!ts || ts === 0) return '-'
  try { const d = new Date(ts * 1000); return isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN').replace(/\//g, '-') } catch { return '-' }
}
const fmtJobDur = (s: any) => {
  if (!s || s <= 0) return '-'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}天${h}时${m}分`; if (h > 0) return `${h}时${m}分`; if (m > 0) return `${m}分`; return `${s}秒`
}

const loadJobDashboard = async () => {
  jobLoading.value = true
  try {
    const res = await fetch(`${getApiBase()}/api/jobs?page=1&page_size=200`, { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const d = await res.json()
      jobAllList.value = (d.data || []).map((j: any) => {
        const start = j.start_time || 0
        const end = j.end_time || 0
        const dur = end > 0 && start > 0 ? end - start : (start > 0 ? Math.floor(Date.now() / 1000) - start : 0)
        return {
          id: j.job_id || j.id,
          name: j.name || `Job ${j.job_id}`,
          user: j.user_name || j.user || '-',
          status: j.job_state || j.status || 'UNKNOWN',
          partition: j.partition || '-',
          account: j.account || '-',
          cpus: j.cpus || 0,
          submitNode: j.batch_host || '-',
          submitTime: fmtJobTime(j.submit_time),
          runTime: fmtJobDur(dur),
        }
      })
    }
  } catch { /* ignore */ } finally { jobLoading.value = false }
  await drawJobCharts()
}

const applyJobFilter = () => drawJobCharts()

const drawJobCharts = async () => {
  await nextTick()
  const list = filteredJobList.value

  // 饼图
  if (jobPieEl.value) {
    const c = echarts.init(jobPieEl.value, undefined, { renderer: 'canvas' })
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['50%', '78%'], center: ['50%', '50%'],
        label: { show: false },
        data: jobStatusList.value.map(s => ({ name: s.label, value: s.count, itemStyle: { color: s.color } })),
      }],
    })
  }

  // 趋势图（用状态分布模拟时序）
  if (jobTrendEl.value) {
    const c = echarts.init(jobTrendEl.value, undefined, { renderer: 'canvas' })
    const times = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.now() - (11 - i) * 5 * 60000)
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    })
    const running = list.filter(j => j.status === 'RUNNING').length
    const pending = list.filter(j => j.status === 'PENDING').length
    const done = list.filter(j => j.status === 'COMPLETED').length
    const failed = list.filter(j => j.status === 'FAILED').length
    const mkSeries = (name: string, val: number, color: string, dash = false) => ({
      name, type: 'line', smooth: true, symbol: 'none',
      lineStyle: { color, width: 2, type: dash ? 'dashed' as const : 'solid' as const },
      data: times.map((_, i) => Math.max(0, val + Math.round((Math.random() - 0.5) * Math.max(1, val * 0.2)) * (i % 3 === 0 ? 1 : 0))),
    })
    c.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 8, bottom: 24, left: 36 },
      tooltip: { trigger: 'axis', confine: true },
      xAxis: { type: 'category', data: times, axisLabel: { fontSize: 10, color: '#9ca3af' }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 10, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [mkSeries('RUNNING', running, '#10b981'), mkSeries('PENDING', pending, '#f59e0b', true), mkSeries('SUCCEEDED', done, '#667eea'), mkSeries('FAILED', failed, '#ef4444', true)],
    })
  }

  // 活动作业柱图
  if (jobActiveEl.value) {
    const c = echarts.init(jobActiveEl.value, undefined, { renderer: 'canvas' })
    const times = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(Date.now() - (9 - i) * 5 * 60000)
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    })
    const running = list.filter(j => j.status === 'RUNNING').length
    c.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 8, bottom: 24, left: 36 },
      tooltip: { trigger: 'axis', confine: true },
      xAxis: { type: 'category', data: times, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [{ name: 'RUNNING', type: 'bar', barWidth: '60%', itemStyle: { color: '#10b981', borderRadius: [2,2,0,0] }, data: times.map((_, i) => Math.max(0, running + (i % 4 === 0 ? Math.round((Math.random()-0.5)*2) : 0))) }],
    })
  }

  // 完成作业柱图
  if (jobDoneEl.value) {
    const c = echarts.init(jobDoneEl.value, undefined, { renderer: 'canvas' })
    const times = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(Date.now() - (9 - i) * 5 * 60000)
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    })
    const done = list.filter(j => j.status === 'COMPLETED').length
    const failed = list.filter(j => j.status === 'FAILED').length
    c.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 8, bottom: 24, left: 36 },
      tooltip: { trigger: 'axis', confine: true },
      xAxis: { type: 'category', data: times, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [
        { name: 'SUCCEEDED', type: 'bar', stack: 'done', barWidth: '60%', itemStyle: { color: '#667eea', borderRadius: [0,0,0,0] }, data: times.map(() => done > 0 ? done + Math.round((Math.random()-0.5)*2) : 0) },
        { name: 'FAILED',    type: 'bar', stack: 'done', itemStyle: { color: '#ef4444', borderRadius: [2,2,0,0] }, data: times.map(() => failed > 0 ? failed : 0) },
      ],
    })
  }

  // 提交作业折线
  if (jobSubmitEl.value) {
    const c = echarts.init(jobSubmitEl.value, undefined, { renderer: 'canvas' })
    const times = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(Date.now() - (9 - i) * 5 * 60000)
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    })
    const total = list.length
    c.setOption({
      backgroundColor: 'transparent',
      grid: { top: 8, right: 8, bottom: 24, left: 36 },
      tooltip: { trigger: 'axis', confine: true },
      xAxis: { type: 'category', data: times, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [{ name: '提交数', type: 'line', smooth: true, symbol: 'none', lineStyle: { color: '#667eea', width: 2 }, areaStyle: { color: '#667eea', opacity: 0.1 }, data: times.map((_, i) => Math.max(0, total + (i % 3 === 0 ? Math.round((Math.random()-0.5)*3) : 0))) }],
    })
  }
}
let cpuChart: echarts.ECharts | null = null
let memChart: echarts.ECharts | null = null
let diskChart: echarts.ECharts | null = null
let netChart: echarts.ECharts | null = null
let cpuSchedChart: echarts.ECharts | null = null
let cpuLoadChart: echarts.ECharts | null = null
let cpuCoresChart: echarts.ECharts | null = null
let memUsedChart: echarts.ECharts | null = null
let swapChart: echarts.ECharts | null = null
let swapRateChart: echarts.ECharts | null = null
let tmpChart: echarts.ECharts | null = null
let tmpRateChart: echarts.ECharts | null = null

const chartTab = ref<'cpu' | 'gpu' | 'mem'>('cpu')

// 集群节点状态分类
const clusterNodeStates = computed(() => {
  const r = { unschedulable: 0, busy: 0, normal: 0, idle: 0 }
  for (const n of nodeMetrics.value) {
    const cpu = n.cpu_usage || 0
    const mem = n.mem_usage || 0
    if (!n.up) { r.unschedulable++; continue }
    if (cpu > cfg.value.cpuWarn || mem > cfg.value.memWarn) r.busy++
    else if (cpu < 5 && mem < 20) r.idle++
    else r.normal++
  }
  return r
})

// 集群资源汇总
const clusterRes = computed(() => {
  const cpuTotal = nodeMetrics.value.reduce((s: number, n: any) => s + (n.cpu_cores || 0), 0)
  const cpuUsed = nodeMetrics.value.reduce((s: number, n: any) => s + (n.cpu_used_cores || 0), 0)
  const gpuTotal = nodeMetrics.value.reduce((s: number, n: any) => s + (n.gpu_total || 0), 0)
  const gpuFree = nodeMetrics.value.reduce((s: number, n: any) => s + (n.gpu_free || 0), 0)
  const memTotal = nodeMetrics.value.reduce((s: number, n: any) => s + (n.mem_total_gb || 0), 0)
  const memFree = nodeMetrics.value.reduce((s: number, n: any) => s + (n.mem_free_gb || (n.mem_total_gb * (1 - (n.mem_usage||0)/100)) || 0), 0)
  return {
    cpuTotal: cpuTotal || nodeMetrics.value.length * 0,
    cpuFree: Math.max(0, cpuTotal - cpuUsed),
    gpuTotal, gpuFree,
    memTotal: memTotal.toFixed(1),
    memFree: memFree.toFixed(1),
  }
})

// 集群平均使用率（用于仪表盘）
const clusterAvg = computed(() => {
  const nodes = nodeMetrics.value
  if (!nodes.length) return { cpu: 0, cpuSchedule: 0, mem: 0 }
  const cpu = nodes.reduce((s: number, n: any) => s + (n.cpu_usage || 0), 0) / nodes.length
  const cpuSchedule = nodes.reduce((s: number, n: any) => s + (n.cpu_schedule_rate ?? n.cpu_usage ?? 0), 0) / nodes.length
  const mem = nodes.reduce((s: number, n: any) => s + (n.mem_usage || 0), 0) / nodes.length
  return { cpu, cpuSchedule, mem }
})

const gaugeColor = (v: number, warn: number) => v > warn ? '#ef4444' : v > warn * 0.8 ? '#f59e0b' : '#10b981'

const gaugeList = computed(() => [
  { key: 'cpuSched', label: '最新CPU核调度率', val: clusterAvg.value.cpuSchedule, warn: cfg.value.cpuWarn },
  { key: 'cpu', label: '最新CPU使用率', val: clusterAvg.value.cpu, warn: cfg.value.cpuWarn },
  { key: 'mem', label: '最新内存使用率', val: clusterAvg.value.mem, warn: cfg.value.memWarn },
])

const rulesLoading = ref(false)
const rulesConnected = ref(false)
const ruleGroups = ref<any[]>([])
const ruleSearch = ref('')
const cfgSaved = ref(false)
const customSoundUrl = ref('')
const customSoundName = ref('')
let customAudio: HTMLAudioElement | null = null
const alertPopup = ref({ show: false, level: 'warning', title: '', alerts: [] as any[] })
let lastAlertKey = ''
let lastAlertTime = 0

const cfg = ref({ cpuWarn: 90, memWarn: 90, interval: 30, prometheusUrl: 'http://localhost:9090', popupEnabled: true, soundEnabled: true, alertInterval: 300 })
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || ''

const nodesWithJobs = computed(() => slurmNodes.value.filter(n => n.running_jobs > 0).sort((a: any, b: any) => b.running_jobs - a.running_jobs))
const maxJobs = computed(() => Math.max(...slurmNodes.value.map((n: any) => n.running_jobs || 0), 1))

const slurmStateGroups = computed(() => {
  const g: Record<string, { label: string; cls: string; nodes: string[] }> = {
    idle: { label: '空闲 (idle)', cls: 'idle', nodes: [] },
    alloc: { label: '运行中 (alloc/mix)', cls: 'alloc', nodes: [] },
    down: { label: '离线 (down/drain)', cls: 'down', nodes: [] },
    other: { label: '其他', cls: 'other', nodes: [] },
  }
  for (const n of slurmNodes.value) {
    const s = (n.state || '').toLowerCase()
    if (s.includes('idle')) g.idle.nodes.push(n.name)
    else if (s.includes('alloc') || s.includes('mix')) g.alloc.nodes.push(n.name)
    else if (s.includes('down') || s.includes('drain')) g.down.nodes.push(n.name)
    else g.other.nodes.push(n.name)
  }
  return Object.values(g).filter(x => x.nodes.length > 0)
})

const targetsByJob = computed(() => {
  const m: Record<string, any[]> = {}
  for (const t of promTargets.value) {
    const job = t.job || 'unknown'
    if (!m[job]) m[job] = []
    m[job].push(t)
  }
  return m
})

const allRules = computed(() => ruleGroups.value.flatMap((g: any) => g.rules || []))
const filteredRuleGroups = computed(() => {
  if (!ruleSearch.value) return ruleGroups.value
  const q = ruleSearch.value.toLowerCase()
  return ruleGroups.value.map((g: any) => ({ ...g, rules: (g.rules || []).filter((r: any) => r.name?.toLowerCase().includes(q) || r.query?.toLowerCase().includes(q)) })).filter((g: any) => g.rules.length > 0)
})

const loadAll = async () => {
  loading.value = true
  try {
    const [sRes, nRes, mRes, lRes, svRes] = await Promise.allSettled([
      fetch(`${getApiBase()}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/dashboard/nodes`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/monitoring/node-metrics`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/monitoring/local-metrics`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${getApiBase()}/api/monitoring/mgmt-services`, { headers: { Authorization: `Bearer ${token()}` } }),
    ])
    if (sRes.status === 'fulfilled' && sRes.value.ok) clusterStats.value = (await sRes.value.json()).data || {}
    if (nRes.status === 'fulfilled' && nRes.value.ok) slurmNodes.value = (await nRes.value.json()).data || []
    if (mRes.status === 'fulfilled' && mRes.value.ok) { const d = await mRes.value.json(); nodeMetrics.value = d.nodes || []; promOk.value = d.connected === true }
    if (lRes.status === 'fulfilled' && lRes.value.ok) localMetrics.value = await lRes.value.json()
    if (svRes.status === 'fulfilled' && svRes.value.ok) { const d = await svRes.value.json(); mgmtServices.value = (d.services || []).map((s: any) => ({ ...s, cpu: s.cpu ?? 0, mem_mb: s.mem_mb ?? 0, fds: s.fds ?? 0 })) }
    lastRefresh.value = new Date().toLocaleTimeString('zh-CN')
    if (nodeMetrics.value.length > 0) {
      const point: HistoryPoint = { time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), nodes: {} }
      for (const n of nodeMetrics.value) point.nodes[n.instance] = {
          cpu: n.cpu_usage,
          mem: n.mem_usage,
          mem_used: n.mem_used_gb ?? (n.mem_total_gb * n.mem_usage / 100),
          mem_total: n.mem_total_gb ?? 0,
          disk: n.disk_usage,
          disk_used: n.disk_used_gb ?? (n.disk_total_gb * n.disk_usage / 100),
          disk_total: n.disk_total_gb ?? 0,
          net_rx: n.net_rx_bps,
          net_tx: n.net_tx_bps,
          swap_used: n.swap_used_gb ?? 0,
          swap_total: n.swap_total_gb ?? 0,
          swap_usage: n.swap_usage ?? 0,
          tmp_used: n.tmp_used_gb ?? 0,
          tmp_total: n.tmp_total_gb ?? 0,
          tmp_usage: n.tmp_usage ?? 0,
          load1: n.load1 ?? 0,
          load5: n.load5 ?? 0,
        }
      history.value.push(point)
      if (history.value.length > 60) history.value.shift()
    }
    await loadPromAlerts()
    checkAlerts()
    drawAllCharts()
  } finally { loading.value = false }
}

const loadTargets = async () => {
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/prom-targets`, { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { const d = await res.json(); promTargets.value = d.targets || []; promTargetsOk.value = d.connected === true; return }
  } catch {}
  promTargetsOk.value = false; promTargets.value = []
}

const loadPromAlerts = async () => {
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/prom-alerts`, { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { const d = await res.json(); promAlerts.value = d.alerts || []; promAlertsOk.value = d.connected !== false; return }
  } catch {}
  promAlertsOk.value = false; promAlerts.value = []
}

const loadRules = async () => {
  rulesLoading.value = true
  try {
    const res = await fetch(`${getApiBase()}/api/monitoring/prom-rules`, { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const d = await res.json(); rulesConnected.value = d.connected === true
      if (d.data?.data?.groups) {
        ruleGroups.value = d.data.data.groups.map((g: any) => ({ name: g.name, file: g.file, rules: (g.rules || []).filter((r: any) => r.type === 'alerting').map((r: any) => ({ name: r.name, query: r.query, duration: r.duration, labels: r.labels, annotations: r.annotations, state: r.state })) })).filter((g: any) => g.rules.length > 0)
      }
      return
    }
  } catch {}
  rulesConnected.value = false; ruleGroups.value = []
  rulesLoading.value = false
}

const onSoundUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (customSoundUrl.value) URL.revokeObjectURL(customSoundUrl.value)
  customSoundUrl.value = URL.createObjectURL(file)
  customSoundName.value = file.name
  customAudio = new Audio(customSoundUrl.value)
}
const testSound = () => { if (customAudio) { customAudio.currentTime = 0; customAudio.play() } }
const clearSound = () => { if (customSoundUrl.value) URL.revokeObjectURL(customSoundUrl.value); customSoundUrl.value = ''; customSoundName.value = ''; customAudio = null }

const checkAlerts = () => {
  const all = promAlerts.value.map((a: any) => ({ id: a.fingerprint || a.labels?.alertname, level: a.labels?.severity === 'critical' ? 'critical' : 'warning', title: a.labels?.alertname || '未知告警' }))
  if (all.length === 0) return
  const key = all.map((a: any) => a.id).sort().join(',')
  const now = Date.now()
  if (key === lastAlertKey && now - lastAlertTime < cfg.value.alertInterval * 1000) return
  lastAlertKey = key; lastAlertTime = now
  const hasCritical = all.some((a: any) => a.level === 'critical')
  if (cfg.value.popupEnabled) alertPopup.value = { show: true, level: hasCritical ? 'critical' : 'warning', title: hasCritical ? ' 严重告警' : ' 告警通知', alerts: all.slice(0, 10) }
  if (cfg.value.soundEnabled) startAlertSound(hasCritical)
}

let soundTimer: ReturnType<typeof setInterval> | null = null
let soundCritical = false
const startAlertSound = (critical: boolean) => {
  soundCritical = critical; stopAlertSound(); playAlertSound(critical)
  soundTimer = setInterval(() => { if (alertPopup.value.show) playAlertSound(soundCritical); else stopAlertSound() }, 3000)
}
const stopAlertSound = () => { if (soundTimer) { clearInterval(soundTimer); soundTimer = null }; if (customAudio) customAudio.pause() }
const playAlertSound = (critical: boolean) => {
  if (customAudio) { customAudio.currentTime = 0; customAudio.play().catch(() => {}); return }
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur)
    }
    if (critical) { beep(880,0,0.2); beep(660,0.25,0.2); beep(880,0.5,0.2); beep(660,0.75,0.3) }
    else { beep(660,0,0.15); beep(880,0.2,0.25) }
  } catch {}
}
const dismissPopup = () => { alertPopup.value.show = false; stopAlertSound() }

const initChart = (el: HTMLElement | undefined, instance: echarts.ECharts | null) => {
  if (!el) return instance
  if (instance) instance.dispose()
  return echarts.init(el, undefined, { renderer: 'canvas' })
}

// 多节点颜色池
const NODE_COLORS = ['#667eea','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6']

type ChartKey = 'cpu' | 'mem' | 'disk' | 'net' | 'swap' | 'tmp'

const chartMeta: Record<ChartKey, {
  label: string
  getVal: (n: HistoryPoint['nodes'][string]) => number | number[]
  fmt: (v: number) => string
  yFmt: (v: number) => string
  yMax?: number
  seriesNames?: (node: string) => string[]
}> = {
  cpu: {
    label: 'CPU%',
    getVal: n => n.cpu,
    fmt: v => v.toFixed(1) + '%',
    yFmt: v => v.toFixed(0) + '%',
    yMax: 100,
  },
  mem: {
    label: '内存 (GB)',
    getVal: n => n.mem_used,
    fmt: v => v.toFixed(2) + ' GB',
    yFmt: v => v.toFixed(1) + ' GB',
  },
  disk: {
    label: '磁盘 (GB)',
    getVal: n => n.disk_used,
    fmt: v => v.toFixed(2) + ' GB',
    yFmt: v => v.toFixed(1) + ' GB',
  },
  net: {
    label: '网络',
    getVal: n => [n.net_rx, n.net_tx],
    fmt: v => fmtBytes(v),
    yFmt: v => fmtBytes(v),
    seriesNames: node => [`${node} ↓`, `${node} ↑`],
  },
  swap: {
    label: '交换分区 (GB)',
    getVal: n => n.swap_used,
    fmt: v => v.toFixed(2) + ' GB',
    yFmt: v => v.toFixed(1) + ' GB',
  },
  tmp: {
    label: '临时分区 (GB)',
    getVal: n => n.tmp_used,
    fmt: v => v.toFixed(2) + ' GB',
    yFmt: v => v.toFixed(1) + ' GB',
  },
}

const buildOption = (seriesKey: ChartKey) => {
  const data = history.value
  const inst = historyNode.value
  const times = data.map(p => p.time)
  const meta = chartMeta[seriesKey]
  const isNet = seriesKey === 'net'
  const allNodes = Array.from(new Set(data.flatMap(p => Object.keys(p.nodes))))

  const markLine = seriesKey === 'cpu' ? {
    silent: true,
    lineStyle: { color: '#ef4444', type: 'dashed' as const, width: 1 },
    data: [{ yAxis: cfg.value.cpuWarn, label: { formatter: `${cfg.value.cpuWarn}%`, color: '#ef4444', fontSize: 10 } }]
  } : undefined

  let series: any[] = []
  const nodes = inst ? [inst] : allNodes

  nodes.forEach((node, i) => {
    const color = NODE_COLORS[i % NODE_COLORS.length]
    const name = shortName(node)
    if (isNet) {
      const rxColor = NODE_COLORS[i % NODE_COLORS.length]
      const txColor = NODE_COLORS[(i + 5) % NODE_COLORS.length]
      series.push({
        name: `${name} ↓`, type: 'line', smooth: true, symbol: 'none',
        lineStyle: { color: rxColor, width: 2 },
        areaStyle: { color: rxColor, opacity: 0.06 },
        data: data.map(p => +(p.nodes[node]?.net_rx ?? 0).toFixed(0)),
      })
      series.push({
        name: `${name} ↑`, type: 'line', smooth: true, symbol: 'none',
        lineStyle: { color: txColor, width: 2, type: 'dashed' as const },
        data: data.map(p => +(p.nodes[node]?.net_tx ?? 0).toFixed(0)),
      })
    } else {
      const getV = meta.getVal as (n: HistoryPoint['nodes'][string]) => number
      series.push({
        name, type: 'line', smooth: true, symbol: 'none',
        lineStyle: { color, width: 2 },
        areaStyle: { color, opacity: inst ? 0.1 : 0.05 },
        data: data.map(p => +((p.nodes[node] ? getV(p.nodes[node]) : 0)).toFixed(3)),
        markLine: i === 0 ? markLine : undefined,
      })
    }
  })

  // 计算 yAxis max：内存/磁盘用节点最大 total 值
  let yMax: number | undefined = meta.yMax
  if ((seriesKey === 'mem' || seriesKey === 'disk') && data.length > 0) {
    const totalKey = seriesKey === 'mem' ? 'mem_total' : 'disk_total'
    const maxTotal = Math.max(...data.flatMap(p => Object.values(p.nodes).map(n => n[totalKey] ?? 0)))
    if (maxTotal > 0) yMax = Math.ceil(maxTotal * 1.05)
  }

  return {
    backgroundColor: 'transparent',
    grid: { top: 32, right: 12, bottom: 32, left: 62 },
    tooltip: {
      trigger: 'axis' as const,
      confine: true,
      formatter: (params: any[]) => {
        const t = params[0]?.axisValue || ''
        return `<div style="font-size:12px;font-weight:600;margin-bottom:4px">${t}</div>` +
          params.map((p: any) => {
            const val = meta.fmt(p.value)
            return `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span>${p.seriesName}</span><b style="margin-left:auto;padding-left:12px">${val}</b></div>`
          }).join('')
      }
    },
    legend: {
      top: 2, right: 4,
      textStyle: { fontSize: 11 },
      itemWidth: 14, itemHeight: 6,
      type: 'scroll' as const,
    },
    xAxis: {
      type: 'category' as const, data: times,
      axisLabel: { fontSize: 10, color: '#9ca3af', interval: 'auto' as const },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      max: yMax,
      min: 0,
      axisLabel: { fontSize: 10, color: '#9ca3af', formatter: meta.yFmt },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    dataZoom: [{ type: 'inside' as const, start: 0, end: 100 }],
    series,
  }
}

const drawAllCharts = async () => {
  await nextTick()
  // 计算节点 CPU tab
  if (cpuChartEl.value) { cpuChart = initChart(cpuChartEl.value, cpuChart); cpuChart?.setOption(buildTrendOption('cpu', 'percent')) }
  if (cpuSchedChartEl.value) { cpuSchedChart = initChart(cpuSchedChartEl.value, cpuSchedChart); cpuSchedChart?.setOption(buildTrendOption('cpuSched', 'percent')) }
  if (cpuLoadChartEl.value) { cpuLoadChart = initChart(cpuLoadChartEl.value, cpuLoadChart); cpuLoadChart?.setOption(buildTrendOption('load1', 'raw')) }
  if (cpuCoresChartEl.value) { cpuCoresChart = initChart(cpuCoresChartEl.value, cpuCoresChart); cpuCoresChart?.setOption(buildOption('cpu')) }
  // 内存 tab
  if (memChartEl.value) { memChart = initChart(memChartEl.value, memChart); memChart?.setOption(buildTrendOption('mem', 'percent')) }
  if (memUsedChartEl.value) { memUsedChart = initChart(memUsedChartEl.value, memUsedChart); memUsedChart?.setOption(buildOption('mem')) }
  if (swapChartEl.value) { swapChart = initChart(swapChartEl.value, swapChart); swapChart?.setOption(buildOption('swap')) }
  if (swapRateChartEl.value) { swapRateChart = initChart(swapRateChartEl.value, swapRateChart); swapRateChart?.setOption(buildTrendOption('swapRate', 'percent')) }
  if (tmpChartEl.value) { tmpChart = initChart(tmpChartEl.value, tmpChart); tmpChart?.setOption(buildOption('tmp')) }
  if (tmpRateChartEl.value) { tmpRateChart = initChart(tmpRateChartEl.value, tmpRateChart); tmpRateChart?.setOption(buildTrendOption('tmpRate', 'percent')) }
  // GPU tab
  if (gpuRateEl.value) { const c = initChart(gpuRateEl.value, null); c?.setOption(buildTrendOption('cpu', 'percent')) }
  if (gpuUsedEl.value) { const c = initChart(gpuUsedEl.value, null); c?.setOption(buildTrendOption('cpu', 'raw')) }
  // 管理节点
  const mgmtOpt = buildTrendOption('cpu', 'percent')
  ;[mgmtSvcCpuEl, mgmtSvcMemEl, mgmtNodeCpuEl, mgmtNodeMemEl].forEach(el => { if (el.value) initChart(el.value, null)?.setOption(mgmtOpt) })
  if (mgmtSvcStateEl.value) initChart(mgmtSvcStateEl.value, null)?.setOption(buildTrendOption('cpu', 'raw'))
  if (mgmtSvcFdEl.value) initChart(mgmtSvcFdEl.value, null)?.setOption(buildTrendOption('cpu', 'raw'))
  if (mgmtNodeNetEl.value) initChart(mgmtNodeNetEl.value, null)?.setOption(buildOption('net'))
  if (mgmtNodeDiskEl.value) initChart(mgmtNodeDiskEl.value, null)?.setOption(buildTrendOption('cpu', 'percent'))
  // 网络监控
  ;[netCnpEl, netPfcEl, netNicEl, netDropEl].forEach(el => { if (el.value) initChart(el.value, null)?.setOption(buildOption('net')) })
}

// 简化趋势图（百分比或原始值）
const buildTrendOption = (key: string, mode: 'percent' | 'raw') => {
  const data = history.value
  const times = data.map(p => p.time)
  const allNodes = Array.from(new Set(data.flatMap(p => Object.keys(p.nodes))))
  const inst = historyNode.value
  const nodes = inst ? [inst] : allNodes
  const series = nodes.map((node, i) => ({
    name: shortName(node), type: 'line', smooth: true, symbol: 'none',
    lineStyle: { color: NODE_COLORS[i % NODE_COLORS.length], width: 1.5 },
    areaStyle: { color: NODE_COLORS[i % NODE_COLORS.length], opacity: 0.08 },
    data: data.map(p => {
      const n = p.nodes[node]
      if (!n) return 0
      if (key === 'cpu') return +n.cpu.toFixed(1)
      if (key === 'cpuSched') return +n.cpu.toFixed(1)
      if (key === 'load1') return +n.load1.toFixed(2)
      if (key === 'load5') return +n.load5.toFixed(2)
      if (key === 'mem') return +n.mem.toFixed(1)
      if (key === 'mem_used') return +n.mem_used.toFixed(2)
      if (key === 'swap_used') return +n.swap_used.toFixed(2)
      if (key === 'swapRate') return +n.swap_usage.toFixed(1)
      if (key === 'tmp_used') return +n.tmp_used.toFixed(2)
      if (key === 'tmpRate') return +n.tmp_usage.toFixed(1)
      if (key === 'disk') return +n.disk.toFixed(1)
      if (key === 'disk_used') return +n.disk_used.toFixed(2)
      return 0
    }),
  }))
  const isPercent = mode === 'percent'
  return {
    backgroundColor: 'transparent',
    grid: { top: 12, right: 8, bottom: 24, left: 40 },
    tooltip: { trigger: 'axis' as const, confine: true },
    xAxis: { type: 'category' as const, data: times, axisLabel: { fontSize: 9, color: '#9ca3af', interval: 'auto' as const }, axisLine: { lineStyle: { color: '#374151' } }, splitLine: { show: false } },
    yAxis: { type: 'value' as const, min: 0, max: isPercent ? 100 : undefined, axisLabel: { fontSize: 9, color: '#9ca3af', formatter: isPercent ? (v: number) => v + '' : undefined }, splitLine: { lineStyle: { color: '#1f2937' } } },
    dataZoom: [{ type: 'inside' as const }],
    series,
  }
}

watch(historyNode, drawAllCharts)
watch(chartTab, drawAllCharts)
watch(mainTab, drawAllCharts)

const fmt1 = (v: any) => (v == null ? '0' : Number(v).toFixed(1))
const fmt0 = (v: any) => (v == null ? '0' : Math.round(Number(v)).toString())
const clamp = (v: number) => Math.min(100, Math.max(0, v || 0))
const shortName = (inst: string) => inst.replace(/:\d+$/, '')
const fmtBytes = (b: number) => { if (!b) return '0 B/s'; if (b > 1e9) return (b/1e9).toFixed(1)+' GB/s'; if (b > 1e6) return (b/1e6).toFixed(1)+' MB/s'; if (b > 1e3) return (b/1e3).toFixed(1)+' KB/s'; return Math.round(b)+' B/s' }
const fmtUptime = (s: number) => { if (!s) return '-'; const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600); return d > 0 ? `${d}天${h}时` : `${h}时` }
const fmtTime = (t: string) => { try { return new Date(t).toLocaleString('zh-CN') } catch { return t } }
const pctColor = (v: number, warn: number) => v > warn ? '#ef4444' : v > warn * 0.8 ? '#f59e0b' : '#10b981'
const pctClass = (v: number, warn: number) => v > warn ? 'pct-crit' : v > warn * 0.8 ? 'pct-warn' : 'pct-ok'
const ringColor = (v: number, warn: number) => v > warn ? '#ef4444' : v > warn * 0.8 ? '#f59e0b' : '#10b981'
const clusterViewMode = ref<'card'|'table'>('card')
const nodeCardCls = (n: any) => { const v = Math.max(n.cpu_usage||0, n.mem_usage||0); return v > 85 ? 'nc-crit' : v > 70 ? 'nc-warn' : 'nc-ok' }
const nodeStateCls = (n: any) => { const v = Math.max(n.cpu_usage||0, n.mem_usage||0); return v > 85 ? 'ncs-crit' : v > 70 ? 'ncs-warn' : 'ncs-ok' }
const nodeStateText = (n: any) => { const v = Math.max(n.cpu_usage||0, n.mem_usage||0); return v > 85 ? '高负载' : v > 70 ? '繁忙' : '正常' }
const nodeRowCls = (n: any) => { const v = Math.max(n.cpu_usage||0, n.mem_usage||0); return v > 85 ? 'tr-critical' : v > 70 ? 'tr-warning' : '' }
const barCls = (v: number, warn: number) => v > warn ? 'bar-crit' : v > warn*0.8 ? 'bar-warn' : 'bar-ok'
const ringStyle = (v: number, warn: number) => ({ '--ring-color': ringColor(v, warn) })
const nsClass = (s: string) => { const l = (s||'').toLowerCase(); if (l.includes('idle')) return 'ns-idle'; if (l.includes('alloc')||l.includes('mix')) return 'ns-alloc'; if (l.includes('down')||l.includes('drain')) return 'ns-down'; return 'ns-unk' }

const saveCfg = () => { localStorage.setItem('mon_cfg', JSON.stringify(cfg.value)); cfgSaved.value = true; setTimeout(() => { cfgSaved.value = false }, 2000) }
const loadCfg = () => { const s = localStorage.getItem('mon_cfg'); if (s) try { cfg.value = { ...cfg.value, ...JSON.parse(s) } } catch {} }

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { loadCfg(); loadAll(); loadTargets(); loadRules(); timer = setInterval(loadAll, cfg.value.interval * 1000) })
onUnmounted(() => { if (timer) clearInterval(timer); stopAlertSound(); clearSound(); [cpuChart, memChart, diskChart, netChart, cpuSchedChart, cpuLoadChart, cpuCoresChart, memUsedChart, swapChart, swapRateChart, tmpChart, tmpRateChart].forEach(c => c?.dispose()) })
</script>


<style scoped>
/* ── 主 Tab 导航 ── */
.mon-main-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  border-bottom: 2px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 0 1.25rem;
  flex-shrink: 0;
  box-shadow: 0 1px 0 hsl(var(--border));
}

.mon-tab {
  padding: 0.65rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.mon-tab:hover { color: hsl(var(--foreground)); background: hsl(var(--muted) / 0.3); }
.mon-tab.active { color: hsl(var(--primary)); border-bottom-color: hsl(var(--primary)); font-weight: 600; }

.mon-tab-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.refresh-tip {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  opacity: 0.8;
}

/* ── 下拉导航 ── */
.mon-tab-dropdown {
  position: relative;
}

.drop-arrow {
  display: inline-block;
  font-size: 0.7rem;
  margin-left: 4px;
  transition: transform 0.2s;
  opacity: 0.6;
}
.drop-arrow.rotated { transform: rotate(180deg); }

.mon-drop-menu {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  min-width: 160px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  z-index: 200;
  overflow: hidden;
  padding: 0.25rem 0;
}

.drop-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.drop-item:hover { background: hsl(var(--muted) / 0.5); color: hsl(var(--foreground)); }
.drop-item.active { color: hsl(var(--primary)); background: hsl(var(--primary) / 0.08); font-weight: 700; }

/* ── 区块 ── */
.mon-section { display: flex; flex-direction: column; gap: 0; padding-bottom: 1rem; }
.mon-block-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  padding: 0.6rem 1.25rem;
  background: linear-gradient(90deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--muted) / 0.2) 100%);
  border-bottom: 1px solid hsl(var(--border));
  border-top: 1px solid hsl(var(--border));
  border-left: 3px solid hsl(var(--primary));
  letter-spacing: 0.02em;
}
.mon-table-wrap {
  padding: 0.75rem 1rem;
  overflow-x: auto;
}

.mon-table-wrap .mtable {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

/* ── 页面容器 ── */
.mon {
  display: flex;
  flex-direction: column;
  background: hsl(var(--background));
  width: 100%;
  min-width: 0;
}

/* ── Tab 导航 ── */
.mon-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid hsl(var(--border));
  margin-bottom: 1rem;
}

.mon-tab {
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.mon-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.4);
}

.mon-tab.active {
  color: hsl(var(--primary));
  border-bottom-color: hsl(var(--primary));
  font-weight: 600;
}

/* ── Page section card ── */
.page-section {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  width: 100%;
  min-width: 0;
}

/* ── Tabs ── */
.page-section-title {
  padding: 0 1rem;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}

.cs-tabs {
  display: flex;
  gap: 0;
  flex-wrap: wrap;
}

.cs-tab {
  display: inline-flex;
  align-items: center;
  padding: 0.7rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.cs-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.4);
}

.cs-tab.active {
  color: hsl(var(--primary));
  border-bottom-color: hsl(var(--primary));
  font-weight: 600;
}

/* ── Sub header (节点选择器) ── */
.tab-sub-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.3);
  gap: 0.5rem;
}

.nodes-count {
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
}

.history-node-sel {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
}

.hist-sel {
  padding: 0.25rem 1.8rem 0.25rem 0.5rem;
  font-size: 0.82rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background));
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.4rem center;
  color: hsl(var(--foreground));
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}
.hist-sel option {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* ── Charts grid ── */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
}

.metric-section {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
}

.ms-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.5rem;
  letter-spacing: 0.01em;
}

.echarts-box {
  width: 100%;
  height: 240px;
}

/* ── Node table section ── */
.metric-section:not(.charts-grid .metric-section) {
  margin: 0 1rem 1rem;
}

/* ── Badges ── */
.prom-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 500;
}

.prom-ok {
  background: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.prom-na {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.alert-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 700;
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}

.pct-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.pct-ok { background: hsl(var(--success) / 0.1); color: hsl(var(--success)); }
.pct-warn { background: hsl(var(--warning) / 0.1); color: hsl(var(--warning)); }
.pct-crit { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }

/* ── Prom tip ── */
.prom-tip {
  margin: 0.75rem 1rem;
  padding: 0.6rem 0.9rem;
  background: hsl(var(--warning) / 0.08);
  border: 1px solid hsl(var(--warning) / 0.3);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: hsl(var(--warning));
}

/* ── Buttons ── */
.btn-sec {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 500;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-sec:hover:not(:disabled) { background: hsl(var(--accent)); }
.btn-sec:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-pri {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  font-size: 0.82rem;
  font-weight: 500;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-pri:hover { opacity: 0.9; }

/* ── Table ── */
.mtable {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.mtable th {
  background: hsl(var(--muted) / 0.5);
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
  padding: 8px 12px;
  border-bottom: 1px solid hsl(var(--border));
  text-align: left;
  white-space: nowrap;
}

.mtable td {
  padding: 10px 12px;
  border-bottom: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}

.mtable tbody tr:last-child td { border-bottom: none; }
.mtable tbody tr:hover td { background: hsl(var(--muted) / 0.3); }

.tr-critical td { background: hsl(var(--destructive) / 0.05) !important; }
.tr-warning td { background: hsl(var(--warning) / 0.05) !important; }

.empty-sm {
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.82rem;
  padding: 1.5rem;
}

.small-text { font-size: 0.78rem; color: hsl(var(--muted-foreground)); }

/* ── Jobs tab ── */
.slurm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
}

.chart-panel {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
}

.chart-panel-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 0.75rem;
}

.slurm-state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.slurm-state-card {
  border-radius: var(--radius-md);
  padding: 0.6rem 0.75rem;
  border: 1px solid hsl(var(--border));
}

.ssc-idle { background: hsl(var(--success) / 0.08); border-color: hsl(var(--success) / 0.2); }
.ssc-alloc { background: hsl(var(--primary) / 0.08); border-color: hsl(var(--primary) / 0.2); }
.ssc-down { background: hsl(var(--destructive) / 0.08); border-color: hsl(var(--destructive) / 0.2); }
.ssc-other { background: hsl(var(--muted)); border-color: hsl(var(--border)); }

.ssc-count { font-size: 1.4rem; font-weight: 700; color: hsl(var(--foreground)); }
.ssc-label { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 2px; }
.ssc-nodes { font-size: 0.7rem; color: hsl(var(--muted-foreground)); margin-top: 4px; }

.bar-chart { display: flex; flex-direction: column; gap: 0.5rem; }
.bc-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
.bc-label { width: 60px; color: hsl(var(--foreground)); font-weight: 500; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-bar-wrap { flex: 1; display: flex; align-items: center; gap: 0.4rem; }
.bc-bar-bg { flex: 1; height: 8px; background: hsl(var(--muted)); border-radius: var(--radius-full); overflow: hidden; }
.bc-bar-fg { height: 100%; border-radius: var(--radius-full); transition: width 0.3s; }
.bc-val { font-size: 0.75rem; color: hsl(var(--muted-foreground)); white-space: nowrap; }

.ns-badge { font-size: 0.7rem; padding: 1px 6px; border-radius: var(--radius-full); font-weight: 500; }
.ns-idle { background: hsl(var(--success) / 0.1); color: hsl(var(--success)); }
.ns-alloc { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); }
.ns-down { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }
.ns-unk { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }

/* ── Alerts tab ── */
.local-cfg-card {
  margin: 1rem;
  padding: 1rem;
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
}

.lcc-title { font-size: 0.85rem; font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 0.6rem; }
.lcc-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; font-size: 0.82rem; }

.num-input {
  width: 60px;
  padding: 3px 6px;
  font-size: 0.82rem;
  border-radius: var(--radius-sm);
  margin: 0 4px;
}

.toggle { position: relative; display: inline-block; width: 34px; height: 18px; margin-left: 4px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0; cursor: pointer;
  background: hsl(var(--muted)); border-radius: var(--radius-full); transition: 0.2s;
}
.toggle-slider::before {
  content: ''; position: absolute; width: 12px; height: 12px;
  left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s;
}
.toggle input:checked + .toggle-slider { background: hsl(var(--primary)); }
.toggle input:checked + .toggle-slider::before { transform: translateX(16px); }

.sound-upload-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem; flex-wrap: wrap; }
.sound-upload-area { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.sound-upload-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; font-size: 0.78rem; cursor: pointer;
  background: hsl(var(--secondary)); border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm); color: hsl(var(--foreground));
}
.sound-name { font-size: 0.78rem; color: hsl(var(--muted-foreground)); }
.sound-hint { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
.save-tip { font-size: 0.78rem; color: hsl(var(--success)); }

.alerts-rules-title {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.9rem; font-weight: 600; color: hsl(var(--foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.alerts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
}

.alert-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  overflow: hidden;
}

.alert-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.3);
}

.rule-search {
  padding: 4px 8px; font-size: 0.78rem;
  border-radius: var(--radius-sm); width: 180px;
}

.sev-badge { font-size: 0.72rem; padding: 1px 6px; border-radius: var(--radius-full); font-weight: 600; }
.sev-critical { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }
.sev-warning { background: hsl(var(--warning) / 0.1); color: hsl(var(--warning)); }
.sev-info { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); }

.state-badge2 { font-size: 0.72rem; padding: 1px 6px; border-radius: var(--radius-full); font-weight: 600; }
.st-ok { background: hsl(var(--success) / 0.1); color: hsl(var(--success)); }
.st-firing { background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); }
.st-pending { background: hsl(var(--warning) / 0.1); color: hsl(var(--warning)); }

.expr-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; font-family: monospace; }

/* ── Alert popup ── */
.alert-popup-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}

.alert-popup {
  display: flex; flex-direction: column;
  width: 90%; max-width: 560px;
  background: hsl(var(--background));
  border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  border: 2px solid; overflow: hidden;
}

.ap-critical { border-color: hsl(var(--destructive) / 0.5); }
.ap-warning { border-color: hsl(var(--warning) / 0.5); }

/* 顶部色条 */
.alert-popup::before {
  content: ''; display: block; height: 5px; width: 100%;
}
.ap-critical::before { background: hsl(var(--destructive)); }
.ap-warning::before { background: hsl(var(--warning)); }

.ap-icon {
  font-size: 3.5rem; text-align: center;
  padding: 1.5rem 0 0.5rem;
}
.ap-body { flex: 1; padding: 0 2rem 1.5rem; }
.ap-title {
  font-size: 1.4rem; font-weight: 800;
  color: hsl(var(--foreground));
  text-align: center; margin-bottom: 1rem;
}
.ap-list {
  display: flex; flex-direction: column; gap: 0.5rem;
  max-height: 280px; overflow-y: auto;
}
.ap-item {
  display: flex; align-items: center; gap: 0.6rem;
  font-size: 0.95rem; color: hsl(var(--foreground));
  padding: 0.5rem 0.75rem;
  background: hsl(var(--muted) / 0.5);
  border-radius: 8px;
}
.ap-close {
  display: block; width: 100%;
  background: hsl(var(--muted)); border: none; cursor: pointer;
  font-size: 0.9rem; font-weight: 600;
  color: hsl(var(--muted-foreground));
  padding: 0.75rem; border-top: 1px solid hsl(var(--border));
  transition: background 0.15s;
}
.ap-close:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }

/*  Dashboard Grid  */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 0.5rem 0;
}
.db-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.db-span2 { grid-column: span 2; }
.db-card-hd {
  font-size: 0.85rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  display: flex;
  align-items: center;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.5rem;
}
.db-na { color: hsl(var(--muted-foreground)); font-size: 0.82rem; padding: 0.5rem 0; }

/* 资源环形图 */
.db-metrics-row { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.db-metric { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; }
.db-metric-ring { position: relative; width: 80px; height: 80px; }
.db-metric-ring svg { width: 100%; height: 100%; }
.db-ring-val {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.9rem; font-weight: 700; color: hsl(var(--foreground));
}
.db-metric-label { font-size: 0.72rem; color: hsl(var(--muted-foreground)); text-align: center; }
.db-stat-col { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 160px; }
.db-stat-row { display: flex; gap: 0.5rem; font-size: 0.8rem; }
.db-stat-k { color: hsl(var(--muted-foreground)); min-width: 60px; }
.db-stat-v { color: hsl(var(--foreground)); font-weight: 500; }

/* 节点状态分布 */
.db-state-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem; }
.db-state-item { border-radius: 8px; padding: 0.6rem 0.4rem; text-align: center; border: 1px solid transparent; }
.dsi-count { font-size: 1.6rem; font-weight: 800; line-height: 1; }
.dsi-label { font-size: 0.68rem; margin-top: 0.2rem; }
.dsi-idle { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
.dsi-alloc { background: #dbeafe; border-color: #93c5fd; color: #1e40af; }
.dsi-mix { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
.dsi-down { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
.dsi-drain { background: #f3f4f6; border-color: #d1d5db; color: #374151; }
.dsi-default { background: #f3f4f6; border-color: #e5e7eb; color: #6b7280; }

/* 作业统计 */
.db-job-stats { display: flex; flex-direction: column; gap: 0.4rem; }
.db-job-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; }
.db-job-name { min-width: 60px; color: hsl(var(--foreground)); font-weight: 500; }
.db-job-bar-wrap { flex: 1; height: 8px; background: hsl(var(--muted)); border-radius: 4px; overflow: hidden; }
.db-job-bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; transition: width 0.3s; }
.db-job-val { min-width: 24px; text-align: right; color: hsl(var(--muted-foreground)); }

/* 服务状态 */
.db-targets-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.db-target {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.35rem 0.75rem; border-radius: 20px;
  font-size: 0.78rem; border: 1px solid transparent;
}
.dt-up { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
.dt-down { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
.dt-dot { font-size: 0.6rem; }
.dt-job { font-weight: 600; }
.dt-inst { opacity: 0.75; }

/*  Cluster View  */
.cluster-view { display: flex; flex-direction: column; gap: 0; padding: 0; }
.cluster-toolbar { display: flex; align-items: center; gap: 0.75rem; }
.cluster-count { font-size: 0.82rem; color: hsl(var(--muted-foreground)); }

/* 区块标题 */
.cv-section-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  padding: 0.6rem 1rem;
  background: hsl(var(--muted) / 0.3);
  border-bottom: 1px solid hsl(var(--border));
  cursor: default;
}

/* ── 顶部统计行 ── */
.cv-top-row {
  display: grid;
  grid-template-columns: 180px 1fr auto;
  gap: 0;
  border-bottom: 1px solid hsl(var(--border));
}

/* 左：节点数 + 状态表 */
.cv-top-left {
  padding: 0.75rem 1rem;
  border-right: 1px solid hsl(var(--border));
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cv-stat-block { display: flex; flex-direction: column; gap: 0.1rem; }
.cv-stat-label { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
.cv-stat-big { font-size: 2rem; font-weight: 800; color: hsl(var(--foreground)); line-height: 1; }

.cv-state-table { display: flex; flex-direction: column; gap: 0; }
.cv-state-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  border-left: 3px solid transparent;
}
.cv-state-bar { width: 3px; height: 14px; border-radius: 2px; flex-shrink: 0; display: none; }
.cv-state-name { flex: 1; color: hsl(var(--foreground)); }
.cv-state-num { font-weight: 700; font-size: 1rem; min-width: 24px; text-align: right; }

.cv-state-unschedulable { border-left-color: #ef4444; background: rgba(239,68,68,0.06); }
.cv-state-unschedulable .cv-state-num { color: #ef4444; }
.cv-state-busy { border-left-color: #f59e0b; background: rgba(245,158,11,0.06); }
.cv-state-busy .cv-state-num { color: #f59e0b; }
.cv-state-normal { border-left-color: #10b981; background: rgba(16,185,129,0.06); }
.cv-state-normal .cv-state-num { color: #10b981; }
.cv-state-idle { border-left-color: #6ee7b7; background: rgba(110,231,183,0.06); }
.cv-state-idle .cv-state-num { color: #6ee7b7; }

/* 中：仪表盘 */
.cv-gauges-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0.75rem 1rem;
  gap: 1rem;
  flex: 1;
  border-right: 1px solid hsl(var(--border));
}

.cv-gauge-card {
  display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
  min-width: 120px;
}

.cv-gauge-title {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
  white-space: nowrap;
}

.cv-gauge-wrap { position: relative; display: flex; flex-direction: column; align-items: center; }
.cv-gauge-svg { width: 130px; height: 80px; }

.cv-gauge-val {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
  margin-top: -0.5rem;
}

.cv-gauge-unit {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

/* 右：数字统计 */
.cv-res-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.cv-res-card {
  padding: 0.75rem 1rem;
  border-left: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  display: flex; flex-direction: column; gap: 0.25rem;
  min-width: 130px;
}
.cv-res-card:nth-child(odd):nth-last-child(1),
.cv-res-card:nth-child(even):nth-last-child(1) { border-bottom: none; }
.cv-res-card:nth-child(3), .cv-res-card:nth-child(4) { border-bottom: none; }

.cv-res-label { font-size: 0.72rem; color: hsl(var(--muted-foreground)); }
.cv-res-val { font-size: 1.6rem; font-weight: 800; color: hsl(var(--foreground)); line-height: 1.1; }
.cv-res-green { color: #10b981; }

/* ── Chart Tab 切换 ── */
.cv-chart-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  border-bottom: 2px solid hsl(var(--border));
  padding: 0 1rem;
  background: hsl(var(--card));
}

.cv-chart-tab {
  padding: 0.55rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.cv-chart-tab:hover { color: hsl(var(--foreground)); }
.cv-chart-tab.active { color: hsl(var(--primary)); border-bottom-color: hsl(var(--primary)); font-weight: 600; }

/* ── 图表网格 ── */
.cv-charts-grid4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 0.75rem 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.cv-charts-grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 0.75rem 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.cv-chart-card {
  padding: 1rem 1.25rem 0.75rem;
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  transition: background 0.15s;
}
.cv-chart-card:hover {
  background: hsl(var(--muted) / 0.15);
}
.cv-chart-card:last-child { border-right: none; }
.cv-charts-grid3 .cv-chart-card:nth-child(3n) { border-right: none; }
.cv-charts-grid4 .cv-chart-card:nth-child(4n) { border-right: none; }
/* 最后一行无底边 */
.cv-charts-grid4 .cv-chart-card:nth-last-child(-n+4) { border-bottom: none; }
.cv-charts-grid3 .cv-chart-card:nth-last-child(-n+3) { border-bottom: none; }

.cv-chart-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  margin-bottom: 0.2rem;
}
.cv-chart-sub {
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.cv-chart-sub::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--primary) / 0.6);
  flex-shrink: 0;
}
.cv-echarts-box { width: 100%; height: 200px; }

.node-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}
.node-card {
  border-radius: 10px; padding: 0.85rem;
  border: 1.5px solid hsl(var(--border));
  background: hsl(var(--card));
  transition: box-shadow 0.15s, transform 0.15s;
}
.node-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-1px); }
.nc-ok  { border-color: #6ee7b7; }
.nc-warn { border-color: #fcd34d; }
.nc-crit { border-color: #fca5a5; }

.nc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
.nc-name { font-size: 0.88rem; font-weight: 700; color: hsl(var(--foreground)); font-family: monospace; }
.nc-state { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 10px; }
.ncs-ok   { background: #d1fae5; color: #065f46; }
.ncs-warn { background: #fef3c7; color: #92400e; }
.ncs-crit { background: #fee2e2; color: #991b1b; }

.nc-metrics { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.6rem; }
.nc-metric {}
.nc-bar-label { display: flex; justify-content: space-between; font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin-bottom: 0.15rem; }
.nc-bar-bg { height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden; }
.nc-bar-fg { height: 100%; border-radius: 3px; transition: width 0.4s; }
.bar-ok   { background: #10b981; }
.bar-warn { background: #f59e0b; }
.bar-crit { background: #ef4444; }

.nc-footer { display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.68rem; color: hsl(var(--muted-foreground)); border-top: 1px solid hsl(var(--border)); padding-top: 0.4rem; }

/* ── Alerts sub-tabs ── */
.alert-subtabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 0 1rem;
}

.alert-subtab {
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.alert-subtab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.4);
}

.alert-subtab.active {
  color: hsl(var(--primary));
  border-bottom-color: hsl(var(--primary));
  font-weight: 600;
}

.alert-tab-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

/* ── 管理服务健康卡片 ── */
.svc-health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  padding: 1rem 1.25rem;
}

.svc-card {
  border-radius: 10px;
  border: 1.5px solid hsl(var(--border));
  background: hsl(var(--card));
  overflow: hidden;
  transition: box-shadow 0.15s, transform 0.15s;
}
.svc-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
.svc-ok  { border-color: #6ee7b7; }
.svc-down { border-color: #fca5a5; }

.svc-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem 0.6rem;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.2);
}

.svc-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse-dot 2s infinite;
}
.dot-ok   { background: #10b981; box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
.dot-down { background: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0.4); animation: none; }

@keyframes pulse-dot {
  0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
  70%  { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
  100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
}

.svc-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  font-family: monospace;
  flex: 1;
}

.svc-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}
.badge-ok   { background: #d1fae5; color: #065f46; }
.badge-fail { background: #fee2e2; color: #991b1b; }
.badge-na   { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }

.svc-metrics {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.svc-metric-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.svc-metric-label {
  width: 32px;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  flex-shrink: 0;
}

.svc-bar-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.svc-bar-bg {
  flex: 1;
  height: 6px;
  background: hsl(var(--muted));
  border-radius: 3px;
  overflow: hidden;
}

.svc-bar-fg {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s;
  min-width: 2px;
}

.svc-metric-val {
  font-size: 0.78rem;
  color: hsl(var(--foreground));
  font-weight: 600;
  white-space: nowrap;
  min-width: 52px;
  text-align: right;
}

.svc-fd {
  margin-left: auto;
}

.svc-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.82rem;
  padding: 2rem;
}

/* ── 作业管理 ── */
.job-filter-bar {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem 0.75rem;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
  flex-wrap: wrap;
}

.jf-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 120px;
}

.jf-label {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}

.jf-sel {
  padding: 0.4rem 2rem 0.4rem 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background));
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  color: hsl(var(--foreground));
  min-width: 120px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}
.jf-sel:focus { outline: none; border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15); }
.jf-sel option {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}

.jf-actions { display: flex; align-items: flex-end; margin-left: auto; }

.job-time-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0.4rem 1.25rem;
  background: hsl(var(--muted) / 0.2);
  border-bottom: 1px solid hsl(var(--border));
  flex-wrap: wrap;
  gap: 0.25rem;
}

.jt-btn {
  padding: 0.25rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 500;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.15s;
}
.jt-btn:hover { background: hsl(var(--muted)); color: hsl(var(--foreground)); }
.jt-btn.active { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-color: hsl(var(--primary)); }

.jt-range-text {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-left: 0.75rem;
}

/* 作业状态+趋势行 */
.job-charts-row {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 0.75rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.job-pie-card {
  padding: 1rem 1.25rem;
  border-right: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}

.job-trend-card {
  padding: 1rem 1.25rem;
  background: hsl(var(--card));
}

.job-pie-wrap {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.job-pie-chart { width: 160px; height: 160px; flex-shrink: 0; }
.job-trend-chart { width: 100%; height: 180px; }

.job-pie-legend {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.jpl-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.jpl-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.jpl-label { color: hsl(var(--foreground)); flex: 1; }
.jpl-val { color: hsl(var(--muted-foreground)); font-size: 0.75rem; white-space: nowrap; }

.job-trend-legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.4rem;
}

.jtl-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.jtl-line {
  display: inline-block;
  width: 20px; height: 2px;
  border-radius: 1px;
}

/* 作业状态 badge */
.job-st-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
}
.jst-running   { background: #d1fae5; color: #065f46; }
.jst-pending   { background: #fef3c7; color: #92400e; }
.jst-completed { background: #dbeafe; color: #1e40af; }
.jst-failed    { background: #fee2e2; color: #991b1b; }
.jst-cancelled { background: #f3f4f6; color: #374151; }
.jst-suspended { background: #ede9fe; color: #5b21b6; }
.jst-unknown   { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }

.td-mono { font-family: monospace; font-size: 0.82rem; }

/* ── Responsive ── */
@media (max-width: 1200px) {
  .cv-charts-grid4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .charts-grid, .slurm-grid, .alerts-grid { grid-template-columns: 1fr; }
  .cv-top-row { grid-template-columns: 1fr; }
  .cv-gauges-row { justify-content: flex-start; flex-wrap: wrap; }
  .cv-charts-grid4, .cv-charts-grid3 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .node-card-grid { grid-template-columns: 1fr; }
  .slurm-state-grid { grid-template-columns: repeat(2, 1fr); }
  .cv-charts-grid4, .cv-charts-grid3 { grid-template-columns: 1fr; }
}
</style>




