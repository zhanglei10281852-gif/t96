<template>
  <div class="page">
    <div class="filter-bar">
      <a-select
        v-model:value="filters.canteenId"
        placeholder="选择助餐点（全部留空）"
        style="width: 200px"
        allow-clear
        v-if="userStore.userInfo?.role === 'admin'"
        @change="loadAllData"
      >
        <a-select-option v-for="c in canteens" :key="c._id" :value="c._id">
          {{ c.name }}
        </a-select-option>
      </a-select>
      <a-range-picker v-model:value="dateRange" @change="loadAllData" />
      <a-input-number
        v-model:value="filters.months"
        :min="1"
        :max="24"
        style="width: 160px"
        addon-before="趋势月数"
        @change="loadTrend"
      />
      <a-button type="primary" @click="loadAllData">
        <ReloadOutlined />
        刷新
      </a-button>
    </div>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-card class="stat-card">
          <a-statistic
            title="食材总成本"
            :value="summary.totalCost"
            :precision="2"
            prefix="¥"
            :value-style="{ color: '#1890ff' }"
          />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <a-statistic
            title="营业总额"
            :value="summary.totalRevenue"
            :precision="2"
            prefix="¥"
            :value-style="{ color: '#52c41a' }"
          />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <a-statistic
            title="整体成本率"
            :value="summary.overallCostRate"
            :precision="2"
            suffix="%"
            :value-style="{ color: summary.overallCostRate > 45 ? '#ff4d4f' : '#722ed1' }"
          />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <a-statistic
            title="高成本率助餐点"
            :value="summary.highCostCount"
            :value-style="{ color: '#fa8c16' }"
            suffix="个"
          />
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <a-col :span="12">
        <a-card title="各助餐点食材成本率对比" class="chart-card">
          <div ref="costRateChartRef" style="height: 360px"></div>
          <template #extra>
            <a-tag color="blue">成本率</a-tag>
            <a-tag color="red">>45%预警</a-tag>
          </template>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="采购/成本/营收趋势" class="chart-card">
          <div ref="trendChartRef" style="height: 360px"></div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-top: 16px">
      <a-col :span="8">
        <a-card title="各类食材采购占比" class="chart-card">
          <div ref="categoryChartRef" style="height: 320px"></div>
          <a-descriptions :column="1" size="small" style="margin-top: 12px" bordered>
            <a-descriptions-item label="采购总金额">
              ¥{{ categoryTotalAmount.toFixed(2) }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
      <a-col :span="16">
        <a-card title="食材成本TOP10" class="chart-card">
          <a-table
            :columns="topIngredientColumns"
            :data-source="topIngredients"
            :pagination="false"
            size="small"
            row-key="ingredientId"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'category'">
                {{ record.categoryName || record.category }}
              </template>
              <template v-else-if="column.key === 'amount'">
                ¥{{ Number(record.totalAmount).toFixed(2) }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>

    <a-card
      title="临期/过期食材预警"
      style="margin-top: 16px"
      class="chart-card"
    >
      <template #extra>
        <a-tag color="orange">临期: {{ expiringSummary.expiringSoonCount }}</a-tag>
        <a-tag color="red">过期: {{ expiringSummary.expiredCount }}</a-tag>
        <a-tag color="magenta">总价值: ¥{{ expiringSummary.totalValue.toFixed(2) }}</a-tag>
      </template>
      <a-alert
        v-if="expiringList.length === 0"
        type="success"
        show-icon
        message="暂无临期/过期食材预警 🎉"
      />
      <a-table
        v-else
        :columns="expiringColumns"
        :data-source="expiringList"
        :pagination="{ pageSize: 8 }"
        size="small"
        row-key="_id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'expired' ? 'red' : 'orange'">
              {{ record.status === 'expired' ? '已过期' : '临期' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'days'">
            <span :style="{ color: record.daysLeft <= 0 ? '#ff4d4f' : '#fa8c16', fontWeight: 600 }">
              {{ record.daysLeft > 0 ? `剩 ${record.daysLeft} 天` : `过期 ${-record.daysLeft} 天` }}
            </span>
          </template>
          <template v-else-if="column.key === 'date'">
            <div>生产: {{ formatDate(record.productionDate) }}</div>
            <div>到期: <span style="color: #ff4d4f">{{ formatDate(record.expiryDate) }}</span></div>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card title="各助餐点成本明细表" style="margin-top: 16px" class="chart-card">
      <a-table
        :columns="costDetailColumns"
        :data-source="costByCanteen"
        :pagination="false"
        row-key="canteenId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'cost'">¥{{ Number(record.totalCost).toFixed(2) }}</template>
          <template v-else-if="column.key === 'revenue'">¥{{ Number(record.totalRevenue).toFixed(2) }}</template>
          <template v-else-if="column.key === 'rate'">
            <a-progress
              type="line"
              :percent="record.costRate"
              :show-info="true"
              :strokeColor="record.costRate > 45 ? '#ff4d4f' : '#52c41a'"
              :format="(p: number) => `${p}%`"
            />
            <a-tag v-if="record.isHighCostRate" color="red" style="margin-top: 4px">
              成本率过高
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { ReloadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import {
  getCostByCanteen,
  getPurchaseTrend,
  getPurchaseCategoryStats,
  getExpiringWarning,
  getTopCostIngredients,
  CanteenCostItem,
  TrendItem,
  ExpiringWarningItem,
  TopCostIngredientItem,
} from '@/api/analytics'
import { getCanteenList, CanteenItem } from '@/api/canteens'

const userStore = useUserStore()

const filters = reactive({
  canteenId: '',
  months: 6,
})
const dateRange = ref<any>([
  dayjs().subtract(1, 'month').startOf('month').toDate(),
  dayjs().endOf('month').toDate(),
])

const canteens = ref<CanteenItem[]>([])

const costRateChartRef = ref<HTMLElement>()
const trendChartRef = ref<HTMLElement>()
const categoryChartRef = ref<HTMLElement>()

let costRateChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null
let categoryChart: echarts.ECharts | null = null

function formatDate(d: any) {
  return d ? dayjs(d).format('YYYY-MM-DD') : '-'
}

const summary = reactive({
  totalCost: 0,
  totalRevenue: 0,
  overallCostRate: 0,
  highCostCount: 0,
})
const costByCanteen = ref<CanteenCostItem[]>([])
const trendData = ref<TrendItem[]>([])
const categoryStats = ref<any[]>([])
const categoryTotalAmount = ref(0)
const expiringList = ref<ExpiringWarningItem[]>([])
const expiringSummary = reactive({
  total: 0, expiredCount: 0, expiringSoonCount: 0, totalValue: 0,
})
const topIngredients = ref<TopCostIngredientItem[]>([])

const costDetailColumns = [
  { title: '助餐点', dataIndex: 'canteenName', key: 'canteenName', width: 200 },
  { title: '食材成本', key: 'cost', width: 160 },
  { title: '营业额', key: 'revenue', width: 160 },
  { title: '成本率', key: 'rate', minWidth: 260 },
]

const topIngredientColumns = [
  { title: '排名', key: 'rank', width: 60,
    customRender: ({ index }: any) => index + 1 },
  { title: '食材名称', dataIndex: 'ingredientName', key: 'ingredientName', width: 160 },
  { title: '分类', key: 'category', width: 100 },
  { title: '总用量', dataIndex: 'totalQuantity', key: 'totalQuantity', width: 120 },
  { title: '成本总额', key: 'amount', width: 140 },
]

const expiringColumns = [
  { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 200 },
  { title: '助餐点', dataIndex: 'canteenName', key: 'canteenName', width: 140 },
  { title: '食材', dataIndex: 'ingredientName', key: 'ingredientName', width: 140 },
  { title: '剩余量', key: 'qty', width: 120,
    customRender: ({ record }: any) => `${record.quantity} ${record.unit}` },
  { title: '时间', key: 'date', width: 220 },
  { title: '状态', key: 'status', width: 100 },
  { title: '剩余天数', key: 'days', width: 120 },
]

function buildCostRateOption(data: CanteenCostItem[]) {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['食材成本', '营业额'] },
    grid: { left: 60, right: 80, top: 40, bottom: 80 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.canteenName),
      axisLabel: { rotate: 30 },
    },
    yAxis: [
      {
        type: 'value',
        name: '金额(元)',
        axisLabel: { formatter: (v: number) => v.toFixed(0) },
      },
      {
        type: 'value',
        name: '成本率(%)',
        axisLabel: { formatter: '{value}%' },
        max: 100,
      },
    ],
    series: [
      {
        name: '食材成本',
        type: 'bar',
        data: data.map(d => d.totalCost),
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '营业额',
        type: 'bar',
        data: data.map(d => d.totalRevenue),
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '成本率',
        type: 'line',
        yAxisIndex: 1,
        data: data.map(d => d.costRate),
        itemStyle: { color: '#722ed1' },
        lineStyle: { width: 3 },
        markLine: {
          silent: true,
          symbol: 'none',
          yAxisIndex: 1,
          data: [{ yAxis: 45, lineStyle: { color: '#ff4d4f', type: 'dashed' } }],
          label: { formatter: '警戒线 45%' },
        },
      },
    ],
  }
}

function buildTrendOption(data: TrendItem[]) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['采购金额', '领用成本', '营业收入'] },
    grid: { left: 60, right: 30, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => d.month),
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => (v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toFixed(0)) },
    },
    series: [
      {
        name: '采购金额',
        type: 'line',
        smooth: true,
        areaStyle: {},
        data: data.map(d => d.purchaseAmount),
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '领用成本',
        type: 'line',
        smooth: true,
        areaStyle: {},
        data: data.map(d => d.costAmount),
        itemStyle: { color: '#722ed1' },
      },
      {
        name: '营业收入',
        type: 'line',
        smooth: true,
        areaStyle: {},
        data: data.map(d => d.revenueAmount),
        itemStyle: { color: '#52c41a' },
      },
    ],
  }
}

function buildCategoryOption(data: any[]) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}元 ({d}%)' },
    legend: { orient: 'horizontal', bottom: 0 },
    series: [
      {
        name: '采购占比',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: true, formatter: '{b}\n{d}%' },
        data: data.map(d => ({
          name: d.categoryName,
          value: Number(d.totalAmount.toFixed(2)),
        })),
      },
    ],
  }
}

async function loadCostByCanteen() {
  const params: any = {}
  if (dateRange.value && dateRange.value.length === 2) {
    params.startDate = dayjs(dateRange.value[0]).format('YYYY-MM-DD')
    params.endDate = dayjs(dateRange.value[1]).format('YYYY-MM-DD')
  }
  const res = await getCostByCanteen(params)
  costByCanteen.value = res.list
  summary.totalCost = res.summary.totalCost
  summary.totalRevenue = res.summary.totalRevenue
  summary.overallCostRate = res.summary.overallCostRate
  summary.highCostCount = res.summary.highCostCount
  await nextTick()
  if (costRateChartRef.value) {
    if (!costRateChart) costRateChart = echarts.init(costRateChartRef.value)
    costRateChart.setOption(buildCostRateOption(res.list))
  }
}

async function loadTrend() {
  const params: any = { months: filters.months }
  if (filters.canteenId) params.canteenId = filters.canteenId
  const res = await getPurchaseTrend(params)
  trendData.value = res
  await nextTick()
  if (trendChartRef.value) {
    if (!trendChart) trendChart = echarts.init(trendChartRef.value)
    trendChart.setOption(buildTrendOption(res))
  }
}

async function loadCategoryStats() {
  const params: any = {}
  if (filters.canteenId) params.canteenId = filters.canteenId
  if (dateRange.value && dateRange.value.length === 2) {
    params.startDate = dayjs(dateRange.value[0]).format('YYYY-MM-DD')
    params.endDate = dayjs(dateRange.value[1]).format('YYYY-MM-DD')
  }
  const res = await getPurchaseCategoryStats(params)
  categoryStats.value = res.list
  categoryTotalAmount.value = res.totalAmount
  await nextTick()
  if (categoryChartRef.value) {
    if (!categoryChart) categoryChart = echarts.init(categoryChartRef.value)
    categoryChart.setOption(buildCategoryOption(res.list))
  }
}

async function loadExpiringWarning() {
  const params: any = {}
  if (filters.canteenId) params.canteenId = filters.canteenId
  const res = await getExpiringWarning(params)
  expiringList.value = res.list
  Object.assign(expiringSummary, res.summary)
}

async function loadTopIngredients() {
  const params: any = { limit: 10 }
  if (filters.canteenId) params.canteenId = filters.canteenId
  if (dateRange.value && dateRange.value.length === 2) {
    params.startDate = dayjs(dateRange.value[0]).format('YYYY-MM-DD')
    params.endDate = dayjs(dateRange.value[1]).format('YYYY-MM-DD')
  }
  topIngredients.value = await getTopCostIngredients(params)
}

async function loadAllData() {
  await Promise.all([
    loadCostByCanteen(),
    loadTrend(),
    loadCategoryStats(),
    loadExpiringWarning(),
    loadTopIngredients(),
  ])
}

const handleResize = () => {
  costRateChart?.resize()
  trendChart?.resize()
  categoryChart?.resize()
}

onMounted(async () => {
  if (userStore.userInfo?.role === 'admin') {
    canteens.value = await getCanteenList()
  }
  if (userStore.userInfo?.role === 'canteen') {
    filters.canteenId = userStore.userInfo.canteenId || ''
  }
  await loadAllData()
  window.addEventListener('resize', handleResize)
})

watch(() => filters.canteenId, () => loadAllData())
</script>

<style scoped>
.page { padding: 24px; }
.filter-bar {
  display: flex; gap: 12px; margin-bottom: 16px; align-items: center;
}
.stat-card { text-align: center; }
.chart-card { height: 100%; }
</style>
