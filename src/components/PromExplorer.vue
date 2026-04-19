<template>
  <div class="pex">
    <div class="pex-topbar">
      <div class="pex-topbar-left">
        <span class="pex-topbar-count">{{ panels.length }} 个面板</span>
        <div class="pex-db-selector" @click.stop="showDbPanel = !showDbPanel">
          <span class="pex-db-icon">&#9741;</span>
          <span class="pex-db-name">{{ currentDashboard?.name || '默认看板' }}</span>
          <span class="pex-ds-caret">▾</span>
          <div v-if="showDbPanel" class="pex-db-dropdown" @click.stop>
            <div class="pex-ds-dropdown-title">我的看板</div>
            <div class="pex-ds-list">
              <div v-for="db in dashboards" :key="db.id"
                :class="['pex-ds-item', { active: db.id === currentDashboardId }]"
                @click="switchDashboard(db.id)">
                <span style="font-size:13px">&#9741;</span>
                <div class="pex-ds-item-info">
                  <div class="pex-ds-item-name">{{ db.name }}</div>
                  <div class="pex-ds-item-url">{{ db.panels.length }} 个面板</div>
                </div>
                <button class="pex-ds-del-btn" @click.stop="deleteDashboard(db.id)" title="删除">✕</button>
              </div>
              <div v-if="dashboards.length === 0" class="pex-ds-empty">暂无保存的看板</div>
            </div>
            <div class="pex-ds-add-form">
              <input v-model="newDbName" class="pex-input" placeholder="看板名称" />
              <button class="pex-run-btn" style="width:100%" @click="saveDashboard">保存当前看板</button>
              <div style="display:flex;gap:6px;margin-top:4px">
                <button class="pex-btn-outline" style="flex:1" @click="importPanels(); showDbPanel=false">导入 JSON</button>
                <button class="pex-btn-outline" style="flex:1" @click="exportPanels(); showDbPanel=false" :disabled="panels.length===0">导出 JSON</button>
              </div>
            </div>
          </div>
        </div>
        <div class="pex-ds-selector" @click.stop="showDsPanel = !showDsPanel">
          <span class="pex-ds-dot" :class="activeDs ? 'ds-ok' : 'ds-na'"></span>
          <span class="pex-ds-name">{{ activeDs?.name || '未配置数据源' }}</span>
          <span class="pex-ds-caret">▾</span>
          <div v-if="showDsPanel" class="pex-ds-dropdown" @click.stop>
            <div class="pex-ds-dropdown-title">Prometheus 数据源</div>
            <div class="pex-ds-list">
              <div v-for="ds in dataSources" :key="ds.id"
                :class="['pex-ds-item', { active: ds.id === activeDsId }]"
                @click="activeDsId = ds.id; showDsPanel = false; saveDs()">
                <span class="pex-ds-dot" :class="ds.status === 'ok' ? 'ds-ok' : ds.status === 'err' ? 'ds-err' : 'ds-na'"></span>
                <div class="pex-ds-item-info">
                  <div class="pex-ds-item-name">{{ ds.name }}</div>
                  <div class="pex-ds-item-url">{{ ds.url }}</div>
                </div>
                <button class="pex-ds-del-btn" @click.stop="removeDs(ds.id)" title="删除">✕</button>
              </div>
              <div v-if="dataSources.length === 0" class="pex-ds-empty">暂无数据源</div>
            </div>
            <div class="pex-ds-add-form">
              <input v-model="newDs.name" class="pex-input" placeholder="名称，如 本地 Prometheus" />
              <input v-model="newDs.url" class="pex-input" placeholder="地址，如 http://localhost:9090" />
              <button class="pex-run-btn" style="width:100%" @click="addDs">＋ 添加</button>
            </div>
          </div>
        </div>
      </div>
      <div class="pex-topbar-actions">
        <button class="pex-btn-outline" @click="showVarPanel = !showVarPanel">
          变量{{ templateVars.length ? ` (${templateVars.length})` : '' }}
        </button>
        <div class="pex-timerange">
          <select class="pex-tr-select" :value="globalRange" @change="setGlobalRange(($event.target as HTMLSelectElement).value)">
            <option v-for="tr in TIME_RANGES" :key="tr.value" :value="tr.value">{{ tr.label }}</option>
          </select>
        </div>
        <button class="pex-run-btn" @click="refreshAll" :disabled="refreshing || panels.length===0">
          {{ refreshing ? '刷新中...' : '全部刷新' }}
        </button>
        <button class="pex-btn-outline pex-btn-danger" @click="clearAll" :disabled="panels.length===0">清空画布</button>
        <button class="pex-run-btn pex-btn-add" @click="openAddPanel">+ 添加面板</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showVarPanel" class="pex-var-overlay" @click.self="showVarPanel = false">
        <div class="pex-var-modal">
          <div class="pex-var-header">
            <span>模板变量配置</span>
            <button class="pex-ib" @click="showVarPanel = false">✕</button>
          </div>
          <div class="pex-var-tip">
            配置 Grafana 模板变量的实际值，查询时会自动替换。<br>
            可从 Prometheus 查询 <code>label_values(up, instance)</code> 获取可用值。
          </div>
          <div class="pex-var-list">
            <div v-for="v in templateVars" :key="v.name" class="pex-var-row">
              <span class="pex-var-name">${{ v.name }}</span>
              <select v-if="v.options?.length" v-model="v.value" class="pex-sel" style="flex:1" @change="saveVars()">
                <option value="">-- 请选择 --</option>
                <option v-for="opt in v.options" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <input v-else v-model="v.value" class="pex-input" :placeholder="`${v.name} 的实际值`" @change="saveVars()" />
              <button class="pex-ib" @click="fetchVarOptions(v)" title="从 Prometheus 获取可用值" style="font-size:11px;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb"></button>
              <button class="pex-ib pex-del" @click="removeVar(v.name)" title="删除">✕</button>
            </div>
            <div v-if="templateVars.length === 0" class="pex-ds-empty">暂无变量，导入 Grafana JSON 后自动提取</div>
          </div>
          <div class="pex-var-add">
            <input v-model="newVarName" class="pex-input" placeholder="变量名，如 node" style="width:120px" />
            <input v-model="newVarValue" class="pex-input" placeholder="实际值，如 localhost:9100" style="flex:1" />
            <button class="pex-run-btn" @click="addVar">＋ 添加</button>
          </div>
          <div class="pex-var-footer">
            <button class="pex-run-btn" @click="showVarPanel = false; refreshAll()">应用并刷新</button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="pex-body">
      <div class="pex-grid-wrap">
        <div v-if="panels.length===0" class="pex-empty">
          <div class="pex-empty-icon"></div>
          <div class="pex-empty-title">暂无面板</div>
          <div class="pex-empty-sub">点击「添加面板」创建，或「导入」Grafana JSON</div>
          <button class="pex-run-btn pex-btn-add" style="margin-top:1rem" @click="openAddPanel">＋ 添加面板</button>
        </div>
        <template v-else>
          <template v-for="group in panelGroups" :key="group.name">
            <div v-if="group.name" class="pex-group-hd" @click="toggleGroup(group.name)">
              <span class="pex-group-arrow">{{ collapsedGroups.has(group.name) ? '▶' : '▼' }}</span>
              <span class="pex-group-title">{{ group.name }}</span>
              <span class="pex-group-count">{{ group.panels.length }} 个面板</span>
            </div>
            <div v-show="!collapsedGroups.has(group.name)" class="pex-canvas" :style="{ height: canvasHeight(group.panels) + 'px' }">
              <div v-for="panel in group.panels" :key="panel.id"
                class="pex-panel-card"
                :class="{selected: editingPanel?.id===panel.id}"
                :style="panel.gw != null
                  ? { left: (panel.gx!/24*100)+'%', top: panel.y+'px', width: (panel.gw/24*100)+'%', height: panel.h+'px' }
                  : { left: panel.x+'px', top: panel.y+'px', width: panel.w+'px', height: panel.h+'px' }"
                @mousedown.stop="startDrag($event, panel)">
                <div class="pex-panel-hd">
                  <span class="pex-panel-title">{{ panel.title }}</span>
                  <div class="pex-panel-acts">
                    <button class="pex-ib" @click.stop="editPanel(panels.indexOf(panel))" title="编辑">✏</button>
                    <button class="pex-ib" @click.stop="refreshPanel(panels.indexOf(panel))" title="刷新">↺</button>
                    <button class="pex-ib pex-del" @click.stop="removePanel(panels.indexOf(panel))" title="删除">✕</button>
                  </div>
                </div>
                <div v-if="panel.error" class="pex-error" style="margin:0.5rem">{{ panel.error }}</div>
                <div v-else-if="panel.loading" class="pex-loading">加载中...</div>
                <div v-else-if="panel.chartType==='stat'" class="pex-stat-panel">
                  <div class="pex-stat-val" :style="{color: statColor(panel)}">{{ panel.statVal }}</div>
                  <div v-if="panel.unit && !isBuiltinUnit(panel.unit)" class="pex-stat-unit">{{ panel.unit }}</div>
                </div>
                <div v-else-if="panel.chartType==='table'" style="overflow-x:auto;flex:1">
                  <table class="pex-table pex-table-sm">
                    <thead><tr><th v-for="k in panel.keys" :key="k">{{ k }}</th><th>值</th></tr></thead>
                    <tbody>
                      <tr v-for="(row,i) in panel.data" :key="i">
                        <td v-for="k in panel.keys" :key="k">{{ row.metric[k]||'-' }}</td>
                        <td class="pex-vc">{{ fmtVal(row.value[1]) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else :ref="el => setPanelEl(el, panel.id)" class="pex-panel-chart">
                  <div v-if="panel.data.length === 0"
                    style="height:100%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:11px">暂无数据</div>
                </div>
                <!-- resize handle -->
                <div class="pex-resize-handle" @mousedown.stop="startResize($event, panel)"></div>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="editingPanel !== null" class="pex-editor-overlay">
        <div class="pex-editor-topbar">
          <div class="pex-editor-topbar-left">
            <span class="pex-editor-panel-name">{{ editForm.title || '新面板' }}</span>
          </div>
          <div class="pex-editor-topbar-right">
            <button class="pex-editor-btn-discard" @click="closeEditor">放弃</button>
            <button class="pex-editor-btn-save" @click="applyPanel" :disabled="!editForm.title||!editForm.query">保存</button>
          </div>
        </div>
        <div class="pex-editor-main">
          <div class="pex-editor-left">
            <div class="pex-editor-preview">
              <!-- always-mounted chart containers so refs are never null -->
              <div ref="previewChartEl" class="pex-preview-chart" style="position:absolute;inset:0"
                :style="{ visibility: (!previewLoading && !previewError && previewData.length > 0 && editForm.chartType!=='stat' && editForm.chartType!=='table' && editForm.chartType!=='gauge' && editForm.chartType!=='bargauge') ? 'visible' : 'hidden' }"></div>
              <div ref="previewGaugeEl" class="pex-preview-chart" style="position:absolute;inset:0"
                :style="{ visibility: (!previewLoading && !previewError && previewData.length > 0 && (editForm.chartType==='gauge' || editForm.chartType==='bargauge')) ? 'visible' : 'hidden' }"></div>
              <!-- conditional overlays -->
              <div v-if="previewLoading" class="pex-loading" style="height:100%;display:flex;align-items:center;justify-content:center">加载中...</div>
              <div v-else-if="previewError" class="pex-error" style="margin:1rem">{{ previewError }}</div>
              <div v-else-if="previewData.length===0" class="pex-preview-empty">
                <div style="font-size:2rem;opacity:0.3"></div>
                <div>运行查询以预览图表</div>
                <div v-if="previewDebug" style="font-size:10px;color:#6b7280;margin-top:8px;max-width:90%;word-break:break-all;text-align:left;background:#f3f4f6;padding:8px;border-radius:4px">{{ previewDebug }}</div>
              </div>
              <div v-else-if="editForm.chartType==='stat'" class="pex-stat-panel" style="height:100%">
                <div class="pex-stat-val" style="font-size:4rem">{{ previewStatVal }}</div>
                <div class="pex-stat-unit">{{ editForm.unit }}</div>
              </div>
              <div v-else-if="editForm.chartType==='table'" style="overflow:auto;height:100%;padding:1rem">
                <table class="pex-table">
                  <thead><tr><th v-for="k in previewKeys" :key="k">{{ k }}</th><th>值</th></tr></thead>
                  <tbody>
                    <tr v-for="(row,i) in previewData" :key="i">
                      <td v-for="k in previewKeys" :key="k">{{ row.metric[k]||'-' }}</td>
                      <td class="pex-vc">{{ fmtVal(row.value[1]) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="pex-editor-query-area">
              <div class="pex-query-tabs">
                <button :class="['pex-qtab', {active: queryTab==='query'}]" @click="queryTab='query'">查询</button>
                <button :class="['pex-qtab', {active: queryTab==='options'}]" @click="queryTab='options'">选项</button>
              </div>
              <div v-if="queryTab==='query'" class="pex-query-body">
                <div class="pex-qrow">
                  <label>数据源</label>
                  <select v-model="editForm.dsId" class="pex-sel" style="flex:1">
                    <option v-for="ds in dataSources" :key="ds.id" :value="ds.id">{{ ds.name }}</option>
                    <option value="">默认 (/api/prometheus)</option>
                  </select>
                </div>
                <div class="pex-qrow">
                  <label>PromQL</label>
                  <div class="pex-query-input-wrap">
                    <textarea v-model="editForm.query" class="pex-code" rows="3"
                      placeholder="输入 PromQL，例如：rate(node_cpu_seconds_total{mode!='idle'}[5m])"></textarea>
                    <button class="pex-run-query-btn" @click="runPreview" :disabled="!editForm.query">▶ 运行</button>
                  </div>
                </div>
                <!-- 内联变量填写 -->
                <div v-if="queryVars.length > 0" class="pex-inline-vars">
                  <span class="pex-inline-vars-label">变量</span>
                  <div v-for="v in queryVars" :key="v.name" class="pex-inline-var">
                    <span class="pex-inline-var-name">${{ v.name }}</span>
                    <select v-model="v.value" class="pex-sel pex-inline-var-input" @change="saveVars()">
                      <option value="">-- 选择 {{ v.name }} --</option>
                      <option v-for="opt in v.options" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                  </div>
                </div>
                <div class="pex-qrow-inline">
                  <div class="pex-qfield">
                    <label>时间范围</label>
                    <select v-model="editForm.range" class="pex-sel">
                      <option value="15m">最近 15 分钟</option>
                      <option value="1h">最近 1 小时</option>
                      <option value="6h">最近 6 小时</option>
                      <option value="24h">最近 24 小时</option>
                    </select>
                  </div>
                  <div class="pex-qfield">
                    <label>步长</label>
                    <select v-model="editForm.step" class="pex-sel">
                      <option value="15">15s</option>
                      <option value="60">1m</option>
                      <option value="300">5m</option>
                    </select>
                  </div>
                </div>
              </div>
              <div v-if="queryTab==='options'" class="pex-query-body">
                <div class="pex-qrow">
                  <label>面板标题</label>
                  <input v-model="editForm.title" class="pex-input" placeholder="面板标题" />
                </div>
                <div class="pex-qrow-inline">
                  <div class="pex-qfield">
                    <label>单位</label>
                    <input v-model="editForm.unit" class="pex-input" placeholder="% / MB / req/s" />
                  </div>
                  <div class="pex-qfield">
                    <label>小数位</label>
                    <select v-model="editForm.decimals" class="pex-sel">
                      <option value="0">0</option><option value="1">1</option>
                      <option value="2">2</option><option value="4">4</option>
                    </select>
                  </div>
                </div>
                <div class="pex-qrow-inline" v-if="editForm.chartType==='stat'">
                  <div class="pex-qfield">
                    <label>警告阈值</label>
                    <input type="number" v-model.number="editForm.warnThreshold" class="pex-input" placeholder="70" />
                  </div>
                  <div class="pex-qfield">
                    <label>危险阈值</label>
                    <input type="number" v-model.number="editForm.critThreshold" class="pex-input" placeholder="90" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="pex-editor-right">
            <div class="pex-viz-search">
              <input v-model="vizSearch" class="pex-input" placeholder="搜索可视化类型..." />
            </div>
            <div class="pex-viz-list">
              <div v-for="c in filteredChartTypes" :key="c.value"
                :class="['pex-viz-item', {active: editForm.chartType===c.value}]"
                @click="editForm.chartType=c.value; runPreview()">
                <span class="pex-viz-icon">{{ c.icon }}</span>
                <div class="pex-viz-info">
                  <div class="pex-viz-name">{{ c.label }}</div>
                  <div class="pex-viz-desc">{{ c.desc }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <input ref="importInputRef" type="file" accept=".json" style="display:none" @change="onImportFile" />
  </div>
</template>


<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

// ── 类型 ──────────────────────────────────────────────────────────────────────
interface DataSource {
  id: string
  name: string
  url: string
  status: 'ok' | 'err' | 'unknown'
}

interface Panel {
  id: number; title: string; query: string; chartType: string
  range: string; step: string; unit: string; decimals: number
  warnThreshold: number | null; critThreshold: number | null
  dsId: string; group?: string
  x: number; y: number; w: number; h: number
  gx?: number; gy?: number; gw?: number; gh?: number  // Grafana grid units (out of 24)
  loading: boolean; error: string; statVal: string; data: any[]; keys: string[]; chart: any
}

interface EditForm {
  title: string; query: string; chartType: string; range: string; step: string
  unit: string; decimals: number; warnThreshold: number | null; critThreshold: number | null
  dsId: string
}

// ── 数据源状
const dataSources = ref<DataSource[]>([])
const activeDsId = ref('')
const showDsPanel = ref(false)
const newDs = ref({ name: '', url: '' })

const activeDs = computed(() => dataSources.value.find(d => d.id === activeDsId.value) || null)

function getPromBase(dsId?: string): string {
  const id = dsId ?? activeDsId.value
  const ds = dataSources.value.find(d => d.id === id)
  return ds ? ds.url.replace(/\/$/, '') : ''
}


function saveDs() {
  localStorage.setItem('pex-datasources', JSON.stringify(dataSources.value))
  localStorage.setItem('pex-active-ds', activeDsId.value)
}

function loadDs() {
  try {
    const raw = localStorage.getItem('pex-datasources')
    if (raw) dataSources.value = JSON.parse(raw)
    activeDsId.value = localStorage.getItem('pex-active-ds') || ''
    if (activeDsId.value && !dataSources.value.find(d => d.id === activeDsId.value)) {
      activeDsId.value = dataSources.value[0]?.id || ''
    }
  } catch { /* ignore */ }
}

async function addDs() {
  const name = newDs.value.name.trim()
  const url = newDs.value.url.trim()
  if (!name || !url) return
  const ds: DataSource = { id: Date.now().toString(), name, url, status: 'unknown' }
  dataSources.value.push(ds)
  activeDsId.value = ds.id
  newDs.value = { name: '', url: '' }
  showDsPanel.value = false
  saveDs()
  await testDs(ds)
}

function removeDs(id: string) {
  dataSources.value = dataSources.value.filter(d => d.id !== id)
  if (activeDsId.value === id) activeDsId.value = dataSources.value[0]?.id || ''
  saveDs()
}

async function testDs(ds: DataSource) {
  try {
    const res = await fetch(`${ds.url.replace(/\/$/, '')}/api/v1/query?query=1`, { signal: AbortSignal.timeout(5000) })
    const json = await res.json()
    ds.status = json.status === 'success' ? 'ok' : 'err'
  } catch {
    ds.status = 'err'
  }
  saveDs()
}

// ── 全局时间范围 ──────────────────────────────────────────────────────────────
const TIME_RANGES = [
  { label: 'now', value: 'now', seconds: 300 },
  { label: '1h',  value: '1h',  seconds: 3600 },
  { label: '3h',  value: '3h',  seconds: 10800 },
  { label: '5h',  value: '5h',  seconds: 18000 },
  { label: '10h', value: '10h', seconds: 36000 },
  { label: '24h', value: '24h', seconds: 86400 },
  { label: '48h', value: '48h', seconds: 172800 },
]
const globalRange = ref('1h')

// auto-calculate step targeting ~300 data points
function autoStep(rangeSeconds: number): string {
  const step = Math.max(15, Math.ceil(rangeSeconds / 300))
  return String(step)
}

function setGlobalRange(val: string) {
  globalRange.value = val
  const tr = TIME_RANGES.find(t => t.value === val)
  if (!tr) return
  const step = autoStep(tr.seconds)
  // sync all panels range/step and refresh
  panels.value.forEach(p => { p.range = val; p.step = step })
  savePanels()
  refreshAll()
}

// ── 面板状态 ──────────────────────────────────────────────────────────────────
const panels = ref<Panel[]>([])
const collapsedGroups = ref<Set<string>>(new Set())

const panelGroups = computed(() => {
  const groups: { name: string; panels: Panel[] }[] = []
  for (const p of panels.value) {
    const g = p.group || ''
    let grp = groups.find(x => x.name === g)
    if (!grp) { grp = { name: g, panels: [] }; groups.push(grp) }
    grp.panels.push(p)
  }
  return groups
})

function toggleGroup(name: string) {
  const s = new Set(collapsedGroups.value)
  if (s.has(name)) s.delete(name); else s.add(name)
  collapsedGroups.value = s
}
const editingPanel = ref<Panel | null>(null)
const refreshing = ref(false)
const importInputRef = ref<HTMLInputElement | null>(null)
const previewChartEl = ref<HTMLElement | null>(null)
const previewGaugeEl = ref<HTMLElement | null>(null)
const editForm = ref<EditForm>({ title: '', query: '', chartType: 'line', range: '1h', step: '60', unit: '', decimals: 2, warnThreshold: null, critThreshold: null, dsId: '' })
const queryTab = ref<'query' | 'options'>('query')
const vizSearch = ref('')
const previewLoading = ref(false)
const previewDebug = ref('')
const previewError = ref('')
const previewData = ref<any[]>([])
const previewKeys = ref<string[]>([])
const previewStatVal = ref('')

let panelEls: Record<number, HTMLElement> = {}
let panelCharts: Record<number, any> = {}
let editIsNew = false
let nextId = 1

// ── 自由拖拽布局 ──────────────────────────────────────────────────────────────
const GRID = 8  // snap grid px
const MIN_W = 200; const MIN_H = 150
const DEFAULT_W = 380; const DEFAULT_H = 240

function snapGrid(v: number) { return Math.round(v / GRID) * GRID }

function canvasHeight(groupPanels: Panel[]): number {
  if (!groupPanels.length) return 200
  return Math.max(200, ...groupPanels.map(p => p.y + p.h)) + 40
}

// auto-layout: arrange panels in rows of ~3, left-to-right
function autoLayout(panelList: Panel[], containerW = 1200) {
  const cols = Math.max(1, Math.floor(containerW / (DEFAULT_W + 12)))
  panelList.forEach((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    p.x = col * (DEFAULT_W + 12)
    p.y = row * (DEFAULT_H + 12)
    if (!p.w || p.w < MIN_W) p.w = DEFAULT_W
    if (!p.h || p.h < MIN_H) p.h = DEFAULT_H
  })
}

let _dragPanel: Panel | null = null
let _dragOffX = 0; let _dragOffY = 0
let _resizePanel: Panel | null = null
let _resizeStartX = 0; let _resizeStartY = 0
let _resizeStartW = 0; let _resizeStartH = 0

function startDrag(e: MouseEvent, panel: Panel) {
  if ((e.target as HTMLElement).closest('.pex-panel-acts, .pex-resize-handle')) return
  _dragPanel = panel
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  _dragOffX = e.clientX - rect.left
  _dragOffY = e.clientY - rect.top
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragUp)
}

function onDragMove(e: MouseEvent) {
  if (!_dragPanel) return
  const canvas = document.querySelector('.pex-canvas') as HTMLElement
  if (!canvas) return
  const cr = canvas.getBoundingClientRect()
  _dragPanel.x = snapGrid(Math.max(0, e.clientX - cr.left - _dragOffX))
  _dragPanel.y = snapGrid(Math.max(0, e.clientY - cr.top - _dragOffY))
}

function onDragUp() {
  _dragPanel = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragUp)
  savePanels()
}

function startResize(e: MouseEvent, panel: Panel) {
  e.preventDefault()
  _resizePanel = panel
  _resizeStartX = e.clientX; _resizeStartY = e.clientY
  _resizeStartW = panel.w; _resizeStartH = panel.h
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeUp)
}

function onResizeMove(e: MouseEvent) {
  if (!_resizePanel) return
  _resizePanel.w = snapGrid(Math.max(MIN_W, _resizeStartW + e.clientX - _resizeStartX))
  _resizePanel.h = snapGrid(Math.max(MIN_H, _resizeStartH + e.clientY - _resizeStartY))
  panelCharts[_resizePanel.id]?.resize()
}

function onResizeUp() {
  _resizePanel = null
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeUp)
  savePanels()
}

const CHART_TYPES = [
  { value: 'timeseries', label: '时序图', icon: '📈', desc: '时序趋势（Grafana）' },
  { value: 'line', label: '折线图', icon: '〰', desc: '折线' },
  { value: 'bar', label: '柱状图', icon: '', desc: '对比分布' },
  { value: 'area', label: '面积图', icon: '', desc: '堆叠趋势' },
  { value: 'gauge', label: '仪表盘', icon: '', desc: '圆形仪表' },
  { value: 'bargauge', label: '条形仪表', icon: '▬', desc: '条形仪表' },
  { value: 'stat', label: '单值', icon: '#', desc: '当前值' },
  { value: 'table', label: '表格', icon: '≡', desc: '原始数据' },
]
const filteredChartTypes = computed(() =>
  CHART_TYPES.filter(c => !vizSearch.value || c.label.includes(vizSearch.value) || c.value.includes(vizSearch.value))
)


// ── 模板变量 ──────────────────────────────────────────────────────────────────
interface TemplateVar { name: string; value: string; options?: string[] }
const templateVars = ref<TemplateVar[]>([])
const showVarPanel = ref(false)
const newVarName = ref('')
const newVarValue = ref('')

function saveVars() {
  localStorage.setItem('pex-template-vars', JSON.stringify(templateVars.value))
}

// vars referenced in the current editor query - auto-fetch options if missing
const queryVars = computed(() => {
  const vars = extractVars([editForm.value.query])
  return vars.map(name => {
    let v = templateVars.value.find(v => v.name === name)
    if (!v) { v = { name, value: "" }; templateVars.value.push(v) }
    if (!v.options?.length) fetchVarOptions(v)
    return v
  })
})

function loadVars() {
  try {
    const raw = localStorage.getItem('pex-template-vars')
    if (raw) templateVars.value = JSON.parse(raw)
  } catch { /* ignore */ }
}
function addVar() {
  const name = newVarName.value.trim()
  const value = newVarValue.value.trim()
  if (!name) return
  const existing = templateVars.value.find(v => v.name === name)
  if (existing) { existing.value = value } else { templateVars.value.push({ name, value }) }
  newVarName.value = ''; newVarValue.value = ''
  saveVars()
}
function removeVar(name: string) {
  templateVars.value = templateVars.value.filter(v => v.name !== name)
  saveVars()
}

// fetch var options from Prometheus
async function fetchVarOptions(v: TemplateVar) {
  const base = getPromBase()
  // common var name to label mapping
  const labelMap: Record<string, string> = {
    node: 'instance', instance: 'instance', job: 'job',
    nodename: 'nodename', host: 'instance', cluster: 'cluster',
  }
  const label = labelMap[v.name] || v.name
  try {
    const res = await fetch(`${base}/api/v1/label/${label}/values`)
    const json = await res.json()
    if (json.status === 'success' && json.data?.length) {
      v.options = json.data
      if (!v.value) v.value = json.data[0]
    }
  } catch { /* ignore */ }
}

// auto-fill var defaults after import
async function autoFillVars(vars: TemplateVar[]) {
  const base = getPromBase()
  const labelMap: Record<string, string> = {
    node: 'instance', instance: 'instance', job: 'job',
    nodename: 'nodename', host: 'instance', cluster: 'cluster',
  }
  await Promise.all(vars.map(async (v) => {
    const label = labelMap[v.name] || v.name
    try {
      const res = await fetch(`${base}/api/v1/label/${label}/values`)
      const json = await res.json()
      if (json.status === 'success' && json.data?.length) {
        v.options = json.data
        if (!v.value) v.value = json.data[0]
      }
    } catch { /* ignore */ }
  }))
  saveVars()
}

// extract template var names from queries
function extractVars(queries: string[]): string[] {
  const builtins = new Set(['__rate_interval', '__interval', '__range', '__from', '__to', '__dashboard', '__user'])
  const found = new Set<string>()
  for (const q of queries) {
    const matches = q.matchAll(/\$(\w+)/g)
    for (const m of matches) {
      if (!builtins.has(m[1])) found.add(m[1])
    }
  }
  return [...found]
}

// ── Grafana 变量替换 ──────────────────────────────────────────────────────────
function sanitizeQuery(query: string, step: string): string {
  let q = query
    .replace(/\$__rate_interval/g, `${step}s`)
    .replace(/\$__interval/g, `${step}s`)
    .replace(/\$__range/g, `1h`)
  for (const v of templateVars.value) {
    if (v.value) q = q.replace(new RegExp(String.raw`\$` + v.name + String.raw`(?=\W|$)`, `g`), v.value)
  }
  // unresolved $var inside label value  match-all
  q = q.replace(/(\w+)\s*=\s*"\$\w+"/g, `$1=~".*"`)
  q = q.replace(/(\w+)\s*!=\s*"\$\w+"/g, `$1=~".*"`)
  // bare $var  .*
  q = q.replace(/\$\w+/g, `.*`)
  q = q.replace(/\{\s*\}/g, ``)
  return q
}

// ── 查询 ──────────────────────────────────────────────────────────────────────
const RANGE_MAP: Record<string, number> = {
  'now': 300, '15m': 900, '1h': 3600, '3h': 10800,
  '5h': 18000, '6h': 21600, '10h': 36000, '24h': 86400, '48h': 172800
}

async function queryRange(query: string, range: string, step: string, dsId?: string): Promise<any[]> {
  const end = Math.floor(Date.now() / 1000)
  const rangeSeconds = RANGE_MAP[range] || 3600
  const start = end - rangeSeconds
  const effectiveStep = step && step !== '60' ? step : autoStep(rangeSeconds)
  const base = getPromBase(dsId)
  const q = sanitizeQuery(query, effectiveStep)
  let url: string
  let headers: Record<string, string> = {}
  if (base) {
    url = `${base}/api/v1/query_range?query=${encodeURIComponent(q)}&start=${start}&end=${end}&step=${effectiveStep}`
  } else {
    url = `/api/monitoring/promql/range?query=${encodeURIComponent(q)}&start=${start}&end=${end}&step=${effectiveStep}`
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  console.debug('[PromExplorer] queryRange url:', url)
  const res = await fetch(url, { headers })
  const json = await res.json()
  console.debug('[PromExplorer] queryRange response:', json)
  if (json.status !== 'success') throw new Error(json.error || '查询失败')
  return json.data.result
}

async function queryInstant(query: string, dsId?: string): Promise<any[]> {
  const base = getPromBase(dsId)
  const q = sanitizeQuery(query, '60')
  let url: string
  let headers: Record<string, string> = {}
  if (base) {
    url = `${base}/api/v1/query?query=${encodeURIComponent(q)}`
  } else {
    url = `/api/monitoring/promql?query=${encodeURIComponent(q)}`
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, { headers })
  const json = await res.json()
  if (json.status !== 'success') throw new Error(json.error || '查询失败')
  return json.data.result
}

function getOrInitChart(el: HTMLElement): echarts.ECharts {
  return echarts.getInstanceByDom(el) ?? echarts.init(el)
}

function renderChart(el: HTMLElement, result: any[], chartType: string, panel?: Panel) {
  const chart = getOrInitChart(el)

  // gauge/bargauge: use first instant value
  if (chartType === 'gauge' || chartType === 'bargauge') {
    const val = result.length ? parseFloat(result[0].value?.[1] ?? result[0].values?.[result[0].values.length - 1]?.[1] ?? '0') : 0
    const unit = panel?.unit || ''
    const isPercent = ['percent', 'percentunit', 'percent (0-100)', 'percent (0.0-1.0)'].includes((unit).toLowerCase())
    const displayVal = unit.toLowerCase() === 'percentunit' ? val * 100 : val
    const max = isPercent ? 100 : (panel?.warnThreshold != null ? Math.max(panel.critThreshold ?? 100, 100) : 100)
    chart.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge',
        radius: '75%',
        center: ['50%', '60%'],
        startAngle: 200, endAngle: -20,
        min: 0, max,
        splitNumber: 4,
        axisLine: {
          lineStyle: {
            width: 10,
            color: [
              [panel?.warnThreshold ? panel.warnThreshold / max : 0.7, '#10b981'],
              [panel?.critThreshold ? panel.critThreshold / max : 0.9, '#f59e0b'],
              [1, '#ef4444'],
            ],
          },
        },
        pointer: { length: '60%', width: 4, itemStyle: { color: 'auto' } },
        axisTick: { distance: -12, length: 4, lineStyle: { color: '#fff', width: 1 } },
        splitLine: { distance: -16, length: 10, lineStyle: { color: '#fff', width: 2 } },
        axisLabel: { color: '#9ca3af', distance: 16, fontSize: 9 },
        detail: {
          valueAnimation: true,
          formatter: (v: number) => fmtByUnit(v, isPercent ? 'percent' : unit, panel?.decimals ?? 1),
          color: 'auto', fontSize: 14, offsetCenter: [0, '70%'],
        },
        data: [{ value: displayVal }],
      }],
    }, true)
    return chart
  }

  // timeseries / line / bar / area
  const isRange = result[0]?.values?.length > 0

  // find which label keys actually differ across series (to keep labels short but unique)
  const allKeys = result.length ? Object.keys(result[0].metric || {}) : []
  const varyingKeys = allKeys.filter(k => new Set(result.map((r: any) => r.metric?.[k])).size > 1)
  const labelKeys = varyingKeys.length > 0 ? varyingKeys : allKeys.slice(0, 2)

  const series = result.map((r: any) => {
    const metric = r.metric || {}
    const label = labelKeys.length
      ? labelKeys.map(k => metric[k] ?? '').filter(Boolean).join(', ')
      : 'value'
    const data = isRange
      ? r.values.map((v: any) => [v[0] * 1000, parseFloat(v[1])])
      : [[Date.now(), parseFloat(r.value?.[1] ?? '0')]]
    return {
      name: label,
      type: chartType === 'bar' ? 'bar' : 'line',
      areaStyle: (chartType === 'area' || chartType === 'timeseries') ? { opacity: 0.15 } : undefined,
      data,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1.5 },
    }
  })

  chart.setOption({
    backgroundColor: 'transparent',
    animation: false,
    tooltip: { trigger: 'axis', confine: true, textStyle: { fontSize: 11 } },
    legend: series.length > 1 ? { bottom: 0, type: 'scroll', textStyle: { fontSize: 10 }, itemHeight: 8 } : { show: false },
    grid: { left: 48, right: 8, top: 8, bottom: series.length > 1 ? 36 : 8 },
    xAxis: { type: 'time', axisLabel: { fontSize: 10, color: '#6b7280' }, axisLine: { lineStyle: { color: '#e5e7eb' } }, splitLine: { show: false } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#6b7280', formatter: (v: number) => fmtNum(v) }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    dataZoom: [{ type: 'inside', start: 0, end: 100 }],
    series,
  }, true)
  return chart
}

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'G'
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toFixed(1)
}

// ── 面板操作 ──────────────────────────────────────────────────────────────────
const panelResizeObservers: Record<number, ResizeObserver> = {}

function setPanelEl(el: any, id: number) {
  if (el) {
    panelEls[id] = el as HTMLElement
    // observe resize to update echarts
    if (panelResizeObservers[id]) panelResizeObservers[id].disconnect()
    panelResizeObservers[id] = new ResizeObserver(() => {
      panelCharts[id]?.resize()
    })
    panelResizeObservers[id].observe(el as HTMLElement)
  } else {
    panelResizeObservers[id]?.disconnect()
    delete panelResizeObservers[id]
    delete panelEls[id]
  }
}

function openAddPanel() {
  editIsNew = true
  editForm.value = { title: '', query: '', chartType: 'line', range: '1h', step: '60', unit: '', decimals: 2, warnThreshold: null, critThreshold: null, dsId: activeDsId.value }
  queryTab.value = 'query'
  previewData.value = []; previewError.value = ''; previewStatVal.value = ''
  editingPanel.value = { id: -1 } as any
}

function editPanel(pi: number) {
  editIsNew = false
  const p = panels.value[pi]
  editingPanel.value = p
  editForm.value = { title: p.title, query: p.query, chartType: p.chartType, range: p.range, step: p.step, unit: p.unit, decimals: p.decimals, warnThreshold: p.warnThreshold, critThreshold: p.critThreshold, dsId: p.dsId || activeDsId.value }
  queryTab.value = 'query'
  previewData.value = []; previewError.value = ''; previewStatVal.value = ''
}

function closeEditor() { editingPanel.value = null }

async function applyPanel() {
  const f = editForm.value
  if (editIsNew) {
    const existing = panels.value
    const col = existing.length % 3
    const row = Math.floor(existing.length / 3)
    const p: Panel = { id: nextId++, title: f.title, query: f.query, chartType: f.chartType, range: f.range, step: f.step, unit: f.unit, decimals: f.decimals, warnThreshold: f.warnThreshold, critThreshold: f.critThreshold, dsId: f.dsId, x: col*(DEFAULT_W+12), y: row*(DEFAULT_H+12), w: DEFAULT_W, h: DEFAULT_H, loading: false, error: '', statVal: '', data: [], keys: [], chart: null }
    panels.value.push(p)
    editingPanel.value = null
    await nextTick()
    loadPanel(panels.value.length - 1)
  } else {
    const p = editingPanel.value!
    Object.assign(p, { title: f.title, query: f.query, chartType: f.chartType, range: f.range, step: f.step, unit: f.unit, decimals: f.decimals, warnThreshold: f.warnThreshold, critThreshold: f.critThreshold, dsId: f.dsId })
    editingPanel.value = null
    await nextTick()
    const pi = panels.value.findIndex(x => x.id === p.id)
    if (pi >= 0) loadPanel(pi)
  }
  savePanels()
}

async function loadPanel(pi: number) {
  const p = panels.value[pi]
  p.loading = true; p.error = ''
  try {
    const dsId = p.dsId || activeDsId.value
    // if saved dsId no longer exists in dataSources, fall back to active
    const resolvedDsId = getPromBase(dsId) ? dsId : activeDsId.value
    console.debug(`[loadPanel] "${p.title}" dsId=${dsId} resolved=${resolvedDsId} base="${getPromBase(resolvedDsId)}" chartType=${p.chartType}`)
    if (p.chartType === 'stat' || p.chartType === 'gauge' || p.chartType === 'bargauge') {
      const result = await queryInstant(p.query, resolvedDsId)
      p.data = result; p.statVal = result.length ? fmtVal(result[0].value[1], p.unit, p.decimals) : 'N/A'
      if (p.chartType === 'gauge' || p.chartType === 'bargauge') {
        p.loading = false
        await nextTick()
        await nextTick()
        const el = panelEls[p.id]
        if (el) { const chart = renderChart(el, result, p.chartType, p); if (chart) { chart.resize(); panelCharts[p.id] = chart } }
        return
      }
    } else if (p.chartType === 'table') {
      const result = await queryInstant(p.query, resolvedDsId)
      p.data = result; p.keys = result.length ? Object.keys(result[0].metric) : []
    } else {
      const result = await queryRange(p.query, p.range, p.step, resolvedDsId)
      console.debug(`[PromExplorer] panel "${p.title}" queryRange result count:`, result.length)
      p.data = result
      p.loading = false  // set loading false first so v-else DOM renders
      await nextTick()
      await nextTick()
      const el = panelEls[p.id]
      if (el) {
        const chart = renderChart(el, result, p.chartType, p)
        if (chart) setTimeout(() => chart.resize(), 50)
        if (chart) panelCharts[p.id] = chart
      }
      return  // skip finally setting loading=false again
    }
  } catch (e: any) { p.error = e.message || '加载失败' }
  finally { p.loading = false }
}

async function refreshPanel(pi: number) { await loadPanel(pi) }
async function refreshAll() { refreshing.value = true; await Promise.all(panels.value.map((_, i) => loadPanel(i))); refreshing.value = false }

function removePanel(pi: number) {
  const p = panels.value[pi]
  if (panelCharts[p.id]) { panelCharts[p.id].dispose(); delete panelCharts[p.id] }
  delete panelEls[p.id]; panels.value.splice(pi, 1); savePanels()
}

function clearAll() { Object.values(panelCharts).forEach(c => c.dispose()); panelCharts = {}; panelEls = {}; panels.value = []; savePanels() }

async function runPreview() {
  const f = editForm.value
  console.debug('[PromExplorer] runPreview called, query:', f.query, 'dsId:', f.dsId, 'chartType:', f.chartType)
  if (!f.query) return
  previewLoading.value = true; previewError.value = ''; previewData.value = []; previewStatVal.value = ''; previewDebug.value = ''
  try {
    const dsId = f.dsId || activeDsId.value
    if (f.chartType === 'stat' || f.chartType === 'gauge' || f.chartType === 'bargauge') {
      const result = await queryInstant(f.query, dsId)
      previewData.value = result
      previewStatVal.value = result.length ? fmtVal(result[0].value[1], editForm.value.unit, editForm.value.decimals) : 'N/A'
      if (f.chartType === 'gauge' || f.chartType === 'bargauge') {
        await nextTick()
        if (previewGaugeEl.value) renderChart(previewGaugeEl.value, result, f.chartType)
      }
    } else if (f.chartType === 'table') {
      const result = await queryInstant(f.query, dsId)
      previewData.value = result; previewKeys.value = result.length ? Object.keys(result[0].metric) : []
    } else {
      const base = getPromBase(dsId)
      const effectiveStep = f.step && f.step !== '60' ? f.step : autoStep(RANGE_MAP[f.range] || 3600)
      const q = sanitizeQuery(f.query, effectiveStep)
      previewDebug.value = `dsId=${dsId} base="${base}" sanitized: ${q}`
      const result = await queryRange(f.query, f.range, f.step, dsId)
      previewDebug.value = `结果: ${result.length} 条 | ${previewDebug.value}`
      previewData.value = result
      await nextTick()
      if (previewChartEl.value) {
        const chart = renderChart(previewChartEl.value, result, f.chartType)
        if (chart) setTimeout(() => chart.resize(), 50)
      }
    }
  } catch (e: any) { previewError.value = e.message || '查询失败' }
  finally { previewLoading.value = false }
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

// format value by Grafana unit
function fmtByUnit(v: number, unit: string, decimals = 2): string {
  if (isNaN(v)) return 'N/A'
  const d = decimals ?? 2
  const u = (unit || '').trim().toLowerCase()
  // bytes/s variants - check with startsWith to cover all Grafana unit IDs
  if (u === 'bytes' || u === 'decbytes') {
    if (v >= 1073741824) return (v / 1073741824).toFixed(d) + ' GB'
    if (v >= 1048576) return (v / 1048576).toFixed(d) + ' MB'
    if (v >= 1024) return (v / 1024).toFixed(d) + ' KB'
    return v.toFixed(0) + ' B'
  }
  if (u.includes('bps') && !u.includes('bytes') && !u.includes('_b') && !u.includes('_k') && !u.includes('_m') && !u.includes('_g') && !u.includes('_t') && !u.includes('_s') && !u.includes('kib') && !u.includes('mib')) {
    if (v >= 1e9) return (v / 1e9).toFixed(d) + ' Gbps'
    if (v >= 1e6) return (v / 1e6).toFixed(d) + ' Mbps'
    if (v >= 1e3) return (v / 1e3).toFixed(d) + ' Kbps'
    return v.toFixed(d) + ' bps'
  }
  if (u.includes('bps') || u === 'binbps' || u === 'decbps') {
    if (v >= 1073741824) return (v / 1073741824).toFixed(d) + ' GB/s'
    if (v >= 1048576) return (v / 1048576).toFixed(d) + ' MB/s'
    if (v >= 1024) return (v / 1024).toFixed(d) + ' KB/s'
    return v.toFixed(d) + ' B/s'
  }
  switch (u) {
    // percentage
    case 'percent': case 'percent (0-100)': return v.toFixed(d) + '%'
    case 'percentunit': case 'percent (0.0-1.0)': return (v * 100).toFixed(d) + '%'
    // 时间
    case 's': {
      if (v >= 86400) return Math.floor(v / 86400) + 'd ' + Math.floor((v % 86400) / 3600) + 'h'
      if (v >= 3600) return Math.floor(v / 3600) + 'h ' + Math.floor((v % 3600) / 60) + 'm'
      if (v >= 60) return Math.floor(v / 60) + 'm ' + Math.floor(v % 60) + 's'
      return v.toFixed(d) + 's'
    }
    case 'ms':
      if (v >= 1000) return (v / 1000).toFixed(d) + 's'
      return v.toFixed(d) + 'ms'
    case 'μs': case 'us':
      if (v >= 1e6) return (v / 1e6).toFixed(d) + 's'
      if (v >= 1000) return (v / 1000).toFixed(d) + 'ms'
      return v.toFixed(d) + 'μs'
    case 'ns':
      if (v >= 1e9) return (v / 1e9).toFixed(d) + 's'
      if (v >= 1e6) return (v / 1e6).toFixed(d) + 'ms'
      return v.toFixed(d) + 'ns'
    case 'iops': return v.toFixed(d) + ' IOPS'
    case 'ops': case 'eps': return v.toFixed(d) + ' ops/s'
    case 'pps': return v.toFixed(d) + ' pps'
    case 'rotrpm': return v.toFixed(0) + ' RPM'
    case 'celsius': return v.toFixed(d) + '°C'
    case 'fahrenheit': return v.toFixed(d) + '°F'
    case 'hertz': {
      if (v >= 1e9) return (v / 1e9).toFixed(d) + ' GHz'
      if (v >= 1e6) return (v / 1e6).toFixed(d) + ' MHz'
      if (v >= 1e3) return (v / 1e3).toFixed(d) + ' KHz'
      return v.toFixed(d) + ' Hz'
    }
    case 'bool_yes_no': return v ? 'Yes' : 'No'
    case 'bool': return v ? '1' : '0'
    case 'short': case 'none': case '': {
      if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(d) + 'G'
      if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(d) + 'M'
      if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(d) + 'K'
      return v.toFixed(d)
    }
    default: {
      if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(d) + 'G'
      if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(d) + 'M'
      if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(d) + 'K'
      return v.toFixed(d)
    }
  }
}

function fmtVal(v: string | number, unit?: string, decimals?: number): string {
  const n = parseFloat(String(v))
  if (isNaN(n)) return String(v)
  const u = unit ?? ''
  const d = decimals ?? editForm.value?.decimals ?? 2
  return fmtByUnit(n, u, d)
}

function isBuiltinUnit(unit: string): boolean {
  return ['bytes','decbytes','Bps','binBps','bps','percent','percentunit','s','ms','μs','us','ns',
    'iops','ops','eps','pps','rotrpm','celsius','fahrenheit','hertz','bool_yes_no','bool','short','none',''].includes(unit)
}


function statColor(panel: Panel): string {
  const raw = panel.data?.[0]?.value?.[1]
  const n = parseFloat(String(raw ?? panel.statVal))
  if (panel.critThreshold != null && n >= panel.critThreshold) return '#ef4444'
  if (panel.warnThreshold != null && n >= panel.warnThreshold) return '#f59e0b'
  return '#10b981'
}

// ── 导入导出 ──────────────────────────────────────────────────────────────────
function exportPanels() {
  const blob = new Blob([JSON.stringify(panels.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'prom-panels.json'; a.click()
}
function importPanels() { importInputRef.value?.click() }
function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const raw = JSON.parse(ev.target?.result as string)
      let imported: Panel[] = []
      if (Array.isArray(raw)) {
        imported = raw.map((p: any, i: number) => ({
          id: p.id ?? (nextId + i), title: p.title || '面板', query: p.query || '',
          chartType: p.chartType || 'line', range: p.range || '1h', step: p.step || '60',
          unit: p.unit || '', decimals: p.decimals ?? 2,
          warnThreshold: p.warnThreshold ?? null, critThreshold: p.critThreshold ?? null,
          dsId: p.dsId || activeDsId.value,
          x: p.x ?? 0, y: p.y ?? 0, w: p.w || DEFAULT_W, h: p.h || DEFAULT_H,
          loading: false, error: '', statVal: '', data: [], keys: [], chart: null
        }))
      } else if (raw && typeof raw === 'object') {
        const grafanaPanels: any[] = raw.panels || []
        // parse rows: row panels contain nested panels or act as group separators
        let currentGroup = ''
        const flatPanels: any[] = []
        for (const p of grafanaPanels) {
          if (p.type === 'row') {
            currentGroup = p.title || ''
            // collapsed rows have nested panels
            if (p.collapsed && p.panels?.length) {
              for (const cp of p.panels) flatPanels.push({ ...cp, _group: currentGroup })
            }
          } else {
            flatPanels.push({ ...p, _group: currentGroup })
          }
        }
        // convert Grafana gridPos (24-col grid) to pixel coords
        // canvas width ~1200px → each grid unit = 1200/24 = 50px
        // height grid unit in Grafana is ~30px
        const GU_W = 50  // width grid unit
        const GU_H = 30  // height grid unit
        imported = flatPanels
          .filter((p: any) => p.targets?.length)
          .map((p: any, i: number) => {
            const gp = p.gridPos || {}
            return {
              id: nextId + i, title: p.title || '面板',
              query: p.targets?.[0]?.expr || p.targets?.[0]?.query || '',
              chartType: p.type === 'stat' ? 'stat'
                : p.type === 'table' ? 'table'
                : p.type === 'gauge' ? 'gauge'
                : p.type === 'bargauge' ? 'bargauge'
                : p.type === 'bar' ? 'bar'
                : 'timeseries',
              range: '1h', step: '60', unit: p.fieldConfig?.defaults?.unit || '',
              decimals: p.fieldConfig?.defaults?.decimals ?? 2,
              warnThreshold: null, critThreshold: null, dsId: activeDsId.value,
              group: p._group || '',
              x: gp.x != null ? gp.x * GU_W : 0,
              y: gp.y != null ? gp.y * GU_H : 0,
              w: gp.w != null ? Math.max(MIN_W, gp.w * GU_W) : DEFAULT_W,
              h: gp.h != null ? Math.max(MIN_H, gp.h * GU_H) : DEFAULT_H,
              gx: gp.x ?? undefined, gy: gp.y ?? undefined,
              gw: gp.w ?? undefined, gh: gp.h ?? undefined,
              loading: false, error: '', statVal: '', data: [], keys: [], chart: null
            }
          })
      }
      if (imported.length > 0) {
        // normalize y per group so each group starts at y=0
        const groups = [...new Set(imported.map(p => p.group || ''))]
        for (const g of groups) {
          const gPanels = imported.filter(p => (p.group || '') === g)
          const minY = Math.min(...gPanels.map(p => p.y))
          gPanels.forEach(p => { p.y -= minY })
        }
        // auto-layout only if all panels have no gridPos (x=0,y=0,w=DEFAULT_W,h=DEFAULT_H)
        const hasGridPos = imported.some(p => p.x !== 0 || p.w !== DEFAULT_W)
        if (!hasGridPos) autoLayout(imported)
        console.debug('[import] sample panel positions:', imported.slice(0,3).map(p => `${p.title}: x=${p.x} y=${p.y} w=${p.w} h=${p.h} group=${p.group}`))
        const dbName = file.name.replace(/\.(json)$/i, '') || `导入 ${new Date().toLocaleDateString('zh-CN')}`
        const panelData = imported.map(p => ({
          id: p.id, title: p.title, query: p.query, chartType: p.chartType,
          range: p.range, step: p.step, unit: p.unit, decimals: p.decimals,
          warnThreshold: p.warnThreshold, critThreshold: p.critThreshold, dsId: p.dsId,
          group: p.group || '', x: p.x, y: p.y, w: p.w, h: p.h,
          gx: p.gx, gy: p.gy, gw: p.gw, gh: p.gh
        }))

        // 提取变量
        const allQueries = imported.map(p => p.query)
        const found = extractVars(allQueries)
        const newVarList: TemplateVar[] = found.map(name => ({ name, value: '' }))

        const db: Dashboard = {
          id: Date.now().toString(), name: dbName,
          panels: panelData, vars: newVarList, createdAt: Date.now()
        }
        dashboards.value.push(db)
        currentDashboardId.value = db.id
        saveDashboards()

        // 切换到新看板
        panelCharts = {}; panelEls = {}
        panels.value = imported
        nextId = Math.max(0, ...imported.map(p => p.id)) + 1
        templateVars.value = newVarList
        saveVars()
        savePanels()

        if (newVarList.length > 0) {
          autoFillVars(newVarList).then(() => {
            // 同步变量到看板
            const d = dashboards.value.find(x => x.id === db.id)
            if (d) { d.vars = JSON.parse(JSON.stringify(templateVars.value)); saveDashboards() }
            showVarPanel.value = true
            nextTick(() => panels.value.forEach((_, i) => loadPanel(i)))
          })
        } else {
          nextTick(() => panels.value.forEach((_, i) => loadPanel(i)))
        }
      } else {
        alert('No importable panels found, check JSON format')
      }
    } catch {
      alert('JSON parse failed, check file format')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

// ── Dashboard 管理 ────────────────────────────────────────────────────────────
interface Dashboard {
  id: string
  name: string
  panels: any[]
  vars: TemplateVar[]
  createdAt: number
}

const dashboards = ref<Dashboard[]>([])
const currentDashboardId = ref('')
const newDbName = ref('')
const showDbPanel = ref(false)

const currentDashboard = computed(() => dashboards.value.find(d => d.id === currentDashboardId.value) || null)

function saveDashboards() {
  localStorage.setItem('pex-dashboards', JSON.stringify(dashboards.value))
  localStorage.setItem('pex-current-db', currentDashboardId.value)
}

function loadDashboards() {
  try {
    const raw = localStorage.getItem('pex-dashboards')
    if (raw) dashboards.value = JSON.parse(raw)
    currentDashboardId.value = localStorage.getItem('pex-current-db') || ''
  } catch { /* ignore */ }
}

function saveDashboard() {
  const name = newDbName.value.trim() || `看板 ${new Date().toLocaleDateString('zh-CN')}`
  const panelData = panels.value.map(p => ({
    id: p.id, title: p.title, query: p.query, chartType: p.chartType,
    range: p.range, step: p.step, unit: p.unit, decimals: p.decimals,
    warnThreshold: p.warnThreshold, critThreshold: p.critThreshold, dsId: p.dsId,
    group: p.group || '', x: p.x, y: p.y, w: p.w, h: p.h, gx: p.gx, gy: p.gy, gw: p.gw, gh: p.gh
  }))
  const existing = dashboards.value.find(d => d.id === currentDashboardId.value)
  if (existing && currentDashboardId.value) {
    existing.name = name
    existing.panels = panelData
    existing.vars = JSON.parse(JSON.stringify(templateVars.value))
  } else {
    const db: Dashboard = {
      id: Date.now().toString(), name, panels: panelData,
      vars: JSON.parse(JSON.stringify(templateVars.value)), createdAt: Date.now()
    }
    dashboards.value.push(db)
    currentDashboardId.value = db.id
  }
  newDbName.value = ''
  showDbPanel.value = false
  saveDashboards()
}

function switchDashboard(id: string) {
  const db = dashboards.value.find(d => d.id === id)
  if (!db) return
  currentDashboardId.value = id
  showDbPanel.value = false
  saveDashboards()
  // load panels and vars
  panelCharts = {}; panelEls = {}
  panels.value = db.panels.map((p: any, i: number) => ({ ...p, x: p.x ?? (i%3)*(DEFAULT_W+12), y: p.y ?? Math.floor(i/3)*(DEFAULT_H+12), w: p.w || DEFAULT_W, h: p.h || DEFAULT_H, loading: false, error: '', statVal: '', data: [], keys: [], chart: null }))
  nextId = Math.max(0, ...db.panels.map((p: any) => p.id)) + 1
  templateVars.value = JSON.parse(JSON.stringify(db.vars || []))
  saveVars()
  nextTick(() => panels.value.forEach((_, i) => loadPanel(i)))
}

function deleteDashboard(id: string) {
  dashboards.value = dashboards.value.filter(d => d.id !== id)
  if (currentDashboardId.value === id) {
    currentDashboardId.value = ''
    // clear canvas when deleting current dashboard
    Object.values(panelCharts).forEach(c => c.dispose())
    panelCharts = {}; panelEls = {}; panels.value = []
    savePanels()
  }
  saveDashboards()
}

// ── 持久
function savePanels() {
  try {
    localStorage.setItem('prom-explorer-panels', JSON.stringify(
      panels.value.map(p => ({ id: p.id, title: p.title, query: p.query, chartType: p.chartType, range: p.range, step: p.step, unit: p.unit, decimals: p.decimals, warnThreshold: p.warnThreshold, critThreshold: p.critThreshold, dsId: p.dsId, group: p.group || '', x: p.x, y: p.y, w: p.w, h: p.h, gx: p.gx, gy: p.gy, gw: p.gw, gh: p.gh }))
    ))
  } catch { /* ignore */ }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem('prom-explorer-panels')
    if (!raw) return
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      panels.value = data.map((p: any) => ({ ...p, loading: false, error: '', statVal: '', data: [], keys: [], chart: null }))
      nextId = Math.max(0, ...data.map((p: any) => p.id)) + 1
      nextTick(() => panels.value.forEach((_, i) => loadPanel(i)))
    }
  } catch { /* ignore */ }
}

// close panels on outside click

function onDocClick() { showDsPanel.value = false; showDbPanel.value = false }

onMounted(() => {
  loadDs()
  loadVars()
  loadDashboards()
  loadSaved()
  document.addEventListener('click', onDocClick)
  dataSources.value.forEach(ds => testDs(ds))
})
onUnmounted(() => {
  Object.values(panelCharts).forEach(c => c.dispose())
  document.removeEventListener('click', onDocClick)
})
</script>

<style scoped>
.pex { display: flex; flex-direction: column; background: #fff; color: #1f2937; font-size: 13px; min-height: 100%; }

/* ── 顶部工具栏 ── */
.pex-topbar { display: flex; align-items: center; justify-content: flex-start; padding: 8px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; gap: 8px; min-width: 0; overflow: visible; flex-wrap: wrap; }
.pex-topbar-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.pex-topbar-count { color: #6b7280; font-size: 12px; white-space: nowrap; }
.pex-topbar-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; white-space: nowrap; }
.pex-btn-group { display: flex; gap: 0; }
.pex-btn-group .pex-btn-outline:first-child { border-radius: 4px 0 0 4px; border-right: none; }
.pex-btn-group .pex-btn-outline:last-child { border-radius: 0 4px 4px 0; }

/* ── 时间范围选择器 ── */
.pex-timerange {
  display: flex;
  align-items: center;
  gap: 4px;
}
.pex-timerange-icon { font-size: 13px; }
.pex-tr-select {
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  outline: none;
}
.pex-tr-select:focus { border-color: hsl(var(--primary)); }

/*  Dashboard 选择器  */
.pex-db-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #374151;
  user-select: none;
  transition: border-color 0.15s;
}
.pex-db-selector:hover { border-color: #6366f1; }
.pex-db-icon { font-size: 13px; }
.pex-db-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.pex-db-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 200;
  width: 280px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  overflow: hidden;
}

/*  数据源选择器  */
.pex-ds-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #374151;
  user-select: none;
  transition: border-color 0.15s;
}
.pex-ds-selector:hover { border-color: #6366f1; }
.pex-ds-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pex-ds-caret { color: #9ca3af; font-size: 10px; }

.pex-ds-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ds-ok { background: #10b981; }
.ds-err { background: #ef4444; }
.ds-na { background: #d1d5db; }

/*  数据源下拉面板  */
.pex-ds-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 200;
  width: 320px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  overflow: hidden;
}
.pex-ds-dropdown-title { padding: 10px 14px 6px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
.pex-ds-list { max-height: 200px; overflow-y: auto; border-bottom: 1px solid #f3f4f6; }
.pex-ds-empty { padding: 12px 14px; color: #9ca3af; font-size: 12px; text-align: center; }

.pex-ds-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.pex-ds-item:hover { background: #f9fafb; }
.pex-ds-item.active { background: #ede9fe; }
.pex-ds-item-info { flex: 1; min-width: 0; }
.pex-ds-item-name { font-size: 12px; font-weight: 600; color: #111827; }
.pex-ds-item-url { font-size: 11px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pex-ds-del-btn { background: none; border: none; color: #d1d5db; cursor: pointer; padding: 2px 4px; border-radius: 3px; font-size: 12px; }
.pex-ds-del-btn:hover { color: #ef4444; background: #fef2f2; }

.pex-ds-add-form { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }

/* ── 按钮 ── */
.pex-btn-outline { padding: 5px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; color: #374151; cursor: pointer; font-size: 12px; transition: border-color 0.2s, background 0.2s; }
.pex-btn-outline:hover { border-color: #6366f1; background: #f5f3ff; color: #4f46e5; }
.pex-btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }
.pex-btn-danger { border-color: #fca5a5; color: #dc2626; }
.pex-btn-danger:hover { border-color: #ef4444; background: #fef2f2; }

.pex-run-btn { padding: 5px 14px; border: none; border-radius: 4px; background: #6366f1; color: #fff; cursor: pointer; font-size: 12px; transition: background 0.2s; }
.pex-run-btn:hover { background: #4f46e5; }
.pex-run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pex-btn-add { background: #10b981; }
.pex-btn-add:hover { background: #059669; }

/* ── 主体 ── */
.pex-body { flex: 1; overflow: auto; padding: 16px; }
.pex-grid-wrap { height: 100%; }

.pex-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; color: #9ca3af; gap: 8px; }
.pex-empty-icon { font-size: 3rem; }
.pex-empty-title { font-size: 1.1rem; color: #6b7280; }
.pex-empty-sub { font-size: 12px; }

.pex-panel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; align-items: start; margin-bottom: 8px; }

.pex-group-hd { display: flex; align-items: center; gap: 8px; padding: 8px 4px; cursor: pointer; user-select: none; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px; }
.pex-group-hd:hover { background: #f9fafb; border-radius: 4px; }
.pex-group-arrow { font-size: 11px; color: #6b7280; width: 14px; }
.pex-group-title { font-size: 13px; font-weight: 600; color: #374151; }
.pex-group-count { font-size: 11px; color: #9ca3af; margin-left: auto; }
.pex-canvas { position: relative; width: 100%; }
.pex-panel-card { position: absolute; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.2s, box-shadow 0.2s; cursor: default; box-sizing: border-box; }
.pex-panel-card:hover { border-color: #c7d2fe; box-shadow: 0 2px 8px rgba(99,102,241,0.08); }
.pex-panel-card.selected { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
.pex-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: se-resize; background: linear-gradient(135deg, transparent 50%, #d1d5db 50%); border-radius: 0 0 8px 0; }

.pex-panel-hd { cursor: move; display: flex; align-items: center; justify-content: space-between; padding: 3px 6px; background: transparent; min-height: 22px; }
.pex-panel-title { font-size: 11px; font-weight: 600; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.pex-panel-acts { display: flex; gap: 0; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.pex-panel-card:hover .pex-panel-acts { opacity: 1; }

.pex-ib { background: transparent; border: none; color: #9ca3af; cursor: pointer; padding: 1px 4px; border-radius: 3px; font-size: 11px; transition: color 0.15s, background 0.15s; }
.pex-ib:hover { color: #374151; background: #f3f4f6; }
.pex-del:hover { color: #ef4444 !important; background: #fef2f2 !important; }

.pex-panel-chart { flex: 1; width: 100%; min-height: 80px; }

.pex-stat-panel { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px; min-height: 60px; }
.pex-stat-val { font-size: 1.8rem; font-weight: 700; line-height: 1; }
.pex-stat-unit { font-size: 11px; color: #6b7280; margin-top: 2px; }

.pex-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.pex-table th, .pex-table td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; text-align: left; }
.pex-table th { color: #6b7280; font-weight: 500; background: #f9fafb; }
.pex-table-sm th, .pex-table-sm td { padding: 3px 6px; }
.pex-vc { text-align: right; font-variant-numeric: tabular-nums; }

.pex-error { color: #ef4444; font-size: 12px; }
.pex-loading { color: #9ca3af; font-size: 12px; padding: 8px; text-align: center; }

/* ── 编辑器覆盖层 ── */
.pex-editor-overlay { position: fixed; inset: 0; z-index: 1000; background: #fff; display: flex; flex-direction: column; }
.pex-editor-topbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
.pex-editor-topbar-left, .pex-editor-topbar-right { display: flex; align-items: center; gap: 10px; }
.pex-editor-panel-name { font-size: 14px; font-weight: 600; color: #111827; }

.pex-editor-btn-discard { padding: 5px 14px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; color: #6b7280; cursor: pointer; font-size: 12px; }
.pex-editor-btn-discard:hover { border-color: #9ca3af; color: #374151; }
.pex-editor-btn-save { padding: 5px 14px; border: none; border-radius: 4px; background: #6366f1; color: #fff; cursor: pointer; font-size: 12px; }
.pex-editor-btn-save:hover { background: #4f46e5; }
.pex-editor-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

.pex-editor-main { display: flex; flex: 1; overflow: hidden; }
.pex-editor-left { flex: 1; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid #e5e7eb; }
.pex-editor-preview { flex: 1; overflow: hidden; background: #f9fafb; position: relative; }
.pex-preview-chart { width: 100%; height: 100%; }
.pex-preview-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #9ca3af; gap: 8px; }

.pex-editor-query-area { flex-shrink: 0; border-top: 1px solid #e5e7eb; background: #fff; max-height: 320px; overflow-y: auto; }
.pex-query-tabs { display: flex; border-bottom: 1px solid #e5e7eb; }
.pex-qtab { padding: 8px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; color: #6b7280; cursor: pointer; font-size: 12px; transition: color 0.15s, border-color 0.15s; }
.pex-qtab:hover { color: #374151; }
.pex-qtab.active { color: #6366f1; border-bottom-color: #6366f1; }

.pex-query-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
.pex-qrow { display: flex; align-items: flex-start; gap: 12px; }
.pex-qrow label { width: 70px; flex-shrink: 0; color: #6b7280; font-size: 12px; padding-top: 6px; }
.pex-qrow-inline { display: flex; gap: 16px; }
.pex-qfield { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.pex-qfield label { color: #6b7280; font-size: 11px; }
.pex-inline-vars { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 10px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; }
.pex-inline-vars-label { font-size: 11px; font-weight: 600; color: #0369a1; white-space: nowrap; }
.pex-inline-var { display: flex; align-items: center; gap: 4px; }
.pex-inline-var-name { font-size: 11px; font-weight: 600; color: #6366f1; background: #ede9fe; padding: 2px 6px; border-radius: 4px; font-family: monospace; white-space: nowrap; }
.pex-inline-var-input { width: 140px; font-size: 12px; }

.pex-query-input-wrap { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.pex-code { width: 100%; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; color: #111827; font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px; padding: 8px; resize: vertical; box-sizing: border-box; }
.pex-code:focus { outline: none; border-color: #6366f1; }

.pex-run-query-btn { align-self: flex-end; padding: 5px 14px; border: none; border-radius: 4px; background: #10b981; color: #fff; cursor: pointer; font-size: 12px; }
.pex-run-query-btn:hover { background: #059669; }
.pex-run-query-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.pex-input { width: 100%; background: #fff; border: 1px solid #d1d5db; border-radius: 4px; color: #111827; font-size: 12px; padding: 5px 8px; box-sizing: border-box; }
.pex-input:focus { outline: none; border-color: #6366f1; }

.pex-sel { background: #fff; border: 1px solid #d1d5db; border-radius: 4px; color: #111827; font-size: 12px; padding: 5px 8px; width: 100%; }
.pex-sel:focus { outline: none; border-color: #6366f1; }

.pex-editor-right { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; background: #fff; border-left: 1px solid #e5e7eb; overflow: hidden; }
.pex-viz-search { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
.pex-viz-list { flex: 1; overflow-y: auto; padding: 6px; }

.pex-viz-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 5px; cursor: pointer; transition: background 0.15s; border: 1px solid transparent; }
.pex-viz-item:hover { background: #f5f3ff; }
.pex-viz-item.active { background: #ede9fe; border-color: #6366f1; }
.pex-viz-icon { font-size: 1.4rem; }
.pex-viz-name { font-size: 12px; font-weight: 600; color: #374151; }
.pex-viz-desc { font-size: 11px; color: #9ca3af; }

/* ── 变量配置面板 ── */
.pex-var-overlay {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
}
.pex-var-modal {
  background: #fff; border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
  width: 520px; max-width: 95vw;
  display: flex; flex-direction: column; gap: 0;
  overflow: hidden;
}
.pex-var-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid #e5e7eb;
  font-size: 14px; font-weight: 600; color: #111827;
}
.pex-var-tip {
  padding: 10px 18px; background: #f0f9ff;
  font-size: 12px; color: #0369a1; line-height: 1.6;
  border-bottom: 1px solid #e0f2fe;
}
.pex-var-tip code { background: #dbeafe; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
.pex-var-list { padding: 10px 18px; max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.pex-var-row { display: flex; align-items: center; gap: 8px; }
.pex-var-name {
  width: 100px; flex-shrink: 0; font-size: 12px; font-weight: 600;
  color: #6366f1; background: #ede9fe; padding: 4px 8px; border-radius: 4px;
  font-family: monospace;
}
.pex-var-add {
  display: flex; gap: 8px; padding: 10px 18px;
  border-top: 1px solid #f3f4f6;
}
.pex-var-footer {
  padding: 12px 18px; border-top: 1px solid #e5e7eb;
  display: flex; justify-content: flex-end;
}
</style>