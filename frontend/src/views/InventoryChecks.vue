<template>
  <div class="page">
    <div class="page-header">
      <div class="filter-bar">
        <a-select
          v-model:value="filters.canteenId"
          placeholder="选择助餐点"
          style="width: 200px"
          allow-clear
          v-if="userStore.userInfo?.role === 'admin'"
          @change="loadCheckList"
        >
          <a-select-option v-for="c in canteens" :key="c._id" :value="c._id">
            {{ c.name }}
          </a-select-option>
        </a-select>
        <a-date-picker
          v-model:value="filters.checkMonth"
          picker="month"
          placeholder="选择月份"
          style="width: 160px"
          format="YYYY-MM"
          @change="loadCheckList"
        />
        <a-select
          v-model:value="filters.status"
          placeholder="盘点状态"
          style="width: 140px"
          allow-clear
          @change="loadCheckList"
        >
          <a-select-option value="draft">草稿</a-select-option>
          <a-select-option value="confirmed">已确认</a-select-option>
        </a-select>
        <a-button type="primary" @click="loadCheckList">
          <SearchOutlined />
          查询
        </a-button>
      </div>
      <a-button type="primary" @click="handleGenerate">
        <FileSearchOutlined />
        生成当月盘点单
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="checkList"
      :pagination="false"
      :loading="loading"
      row-key="_id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'canteen'">
          {{ record.canteenId?.name || '-' }}
        </template>
        <template v-else-if="column.key === 'month'">
          {{ record.checkMonth }}
        </template>
        <template v-else-if="column.key === 'date'">
          {{ formatDate(record.checkDate) }}
        </template>
        <template v-else-if="column.key === 'summary'">
          <div>
            <a-tag color="blue">账面: ¥{{ Number(record.totalSystemAmount).toFixed(2) }}</a-tag>
            <a-tag color="green">实际: ¥{{ Number(record.totalActualAmount).toFixed(2) }}</a-tag>
          </div>
          <div style="marginTop: 4px">
            <a-tag
              :color="record.totalDifferenceAmount > 0 ? 'green' : record.totalDifferenceAmount < 0 ? 'red' : 'default'"
            >
              差异: {{ record.totalDifferenceAmount > 0 ? '+' : '' }}¥{{ Number(record.totalDifferenceAmount).toFixed(2) }}
            </a-tag>
          </div>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 'confirmed' ? 'green' : 'orange'">
            {{ CHECK_STATUS_MAP[record.status] }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'info'">
          <div style="fontSize: 12px">
            <div>创建: {{ record.createdBy?.name || '-' }} @ {{ formatDateTime(record.createdAt) }}</div>
            <div v-if="record.confirmedBy">
              确认: {{ record.confirmedBy?.name || '-' }} @ {{ formatDateTime(record.confirmedAt) }}
            </div>
          </div>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button type="link" size="small" @click="handleView(record)">
            查看
          </a-button>
          <template v-if="record.status === 'draft'">
            <a-button type="link" size="small" @click="handleEdit(record)">
              编辑
            </a-button>
            <a-button type="primary" size="small" @click="handleConfirm(record)">
              确认盘点
            </a-button>
          </template>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="detailVisible"
      title="盘点单详情"
      width="900px"
      :footer="detailFooter"
    >
      <template v-if="currentDetail">
        <a-descriptions :column="3" bordered size="small" style="marginBottom: 16px">
          <a-descriptions-item label="盘点单号">{{ currentDetail.checkNo }}</a-descriptions-item>
          <a-descriptions-item label="月份">{{ currentDetail.checkMonth }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="currentDetail.status === 'confirmed' ? 'green' : 'orange'">
              {{ CHECK_STATUS_MAP[currentDetail.status] }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="助餐点">{{ currentDetail.canteenId?.name }}</a-descriptions-item>
          <a-descriptions-item label="盘点日期">{{ formatDate(currentDetail.checkDate) }}</a-descriptions-item>
          <a-descriptions-item label="食材项数">{{ currentDetail.items.length }} 项</a-descriptions-item>
        </a-descriptions>

        <a-alert
          v-if="currentDetail.status === 'draft'"
          type="warning"
          show-icon
          message="此盘点单为草稿，您可以修改实际盘点数量"
          style="marginBottom: 12px"
        />

        <a-table
          :columns="detailColumns"
          :data-source="currentDetail.items"
          :pagination="{ pageSize: 10 }"
          row-key="ingredientId"
          size="small"
          :scroll="{ x: 900 }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'name'">
              {{ record.ingredientId?.name || record.ingredientName || '-' }}
              <span style="color: #999; marginLeft: 4px">
                ({{ record.ingredientId?.unit || record.unit || '' }})
              </span>
            </template>
            <template v-else-if="column.key === 'actual'">
              <template v-if="isEditing">
                <a-input-number
                  v-model:value="checkItems[index].actualQuantity"
                  :min="0"
                  :precision="3"
                  style="width: 100%"
                  @change="onActualChange(index)"
                />
              </template>
              <template v-else>
                {{ record.actualQuantity }}
              </template>
            </template>
            <template v-else-if="column.key === 'diff'">
              <span :style="{ color: checkDiffColor(checkItems[index] || record) }">
                {{ (checkItems[index]?.difference ?? record.difference) > 0 ? '+' : '' }}
                {{ checkItems[index]?.difference ?? record.difference }}
              </span>
            </template>
            <template v-else-if="column.key === 'diffAmount'">
              <span :style="{ color: checkDiffColor(checkItems[index] || record) }">
                {{ (checkItems[index]?.differenceAmount ?? record.differenceAmount) > 0 ? '+' : '' }}
                ¥{{ Number(checkItems[index]?.differenceAmount ?? record.differenceAmount).toFixed(2) }}
              </span>
            </template>
            <template v-else-if="column.key === 'reason'">
              <template v-if="isEditing">
                <a-input
                  v-model:value="checkItems[index].reason"
                  placeholder="差异原因"
                />
              </template>
              <template v-else>
                {{ record.reason || '-' }}
              </template>
            </template>
          </template>
        </a-table>

        <a-row :gutter="16" style="marginTop: 16px">
          <a-col :span="8">
            <a-card size="small" title="账面金额">
              <strong style="fontSize: 20px; color: #1890ff">
                ¥{{ detailTotalSystem.toFixed(2) }}
              </strong>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card size="small" title="实际金额">
              <strong style="fontSize: 20px; color: #52c41a">
                ¥{{ detailTotalActual.toFixed(2) }}
              </strong>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card size="small" title="差异金额">
              <strong :style="{ fontSize: '20px', color: checkDiffColor({ differenceAmount: detailTotalDiff }) }">
                {{ detailTotalDiff > 0 ? '+' : '' }}¥{{ detailTotalDiff.toFixed(2) }}
              </strong>
            </a-card>
          </a-col>
        </a-row>

        <a-form-item label="备注" style="marginTop: 16px" v-if="isEditing">
          <a-textarea v-model:value="formRemark" :rows="2" />
        </a-form-item>
        <p v-else-if="currentDetail.remark" style="marginTop: 12px">
          <strong>备注:</strong> {{ currentDetail.remark }}
        </p>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { SearchOutlined, FileSearchOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import {
  getInventoryCheckList,
  getInventoryCheckDetail,
  generateCheckData,
  createInventoryCheck,
  confirmInventoryCheck,
  InventoryCheck,
  CHECK_STATUS_MAP,
} from '@/api/stockOps'
import { getCanteenList, CanteenItem } from '@/api/canteens'

const userStore = useUserStore()

function formatDate(d: any) {
  return d ? dayjs(d).format('YYYY-MM-DD') : '-'
}
function formatDateTime(d: any) {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
}
function checkDiffColor(r: any) {
  const diff = r.differenceAmount ?? r.difference ?? 0
  if (diff > 0) return '#52c41a'
  if (diff < 0) return '#ff4d4f'
  return '#666'
}

const filters = reactive({
  canteenId: '',
  checkMonth: dayjs().toDate(),
  status: '',
})
const canteens = ref<CanteenItem[]>([])
const loading = ref(false)
const checkList = ref<InventoryCheck[]>([])

const columns = [
  { title: '盘点单号', dataIndex: 'checkNo', key: 'checkNo', width: 220 },
  { title: '助餐点', key: 'canteen', width: 160 },
  { title: '月份', key: 'month', width: 100 },
  { title: '盘点日期', key: 'date', width: 120 },
  { title: '盈亏汇总', key: 'summary', width: 280 },
  { title: '状态', key: 'status', width: 100 },
  { title: '信息', key: 'info', width: 220 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' as const },
]

const detailColumns = [
  { title: '食材', key: 'name', width: 200 },
  { title: '账面数量', dataIndex: 'systemQuantity', key: 'systemQuantity', width: 100 },
  { title: '实际数量', key: 'actual', width: 140 },
  { title: '差异数量', key: 'diff', dataIndex: 'difference', width: 100 },
  { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 100,
    customRender: ({ text }: any) => `¥${Number(text).toFixed(2)}` },
  { title: '差异金额', key: 'diffAmount', width: 120 },
  { title: '差异原因', key: 'reason', minWidth: 180 },
]

async function loadCheckList() {
  loading.value = true
  try {
    const params: any = {
      status: filters.status || undefined,
    }
    if (filters.checkMonth) {
      params.checkMonth = dayjs(filters.checkMonth).format('YYYY-MM')
    }
    if (userStore.userInfo?.role === 'canteen') {
      params.canteenId = userStore.userInfo.canteenId
    } else if (filters.canteenId) {
      params.canteenId = filters.canteenId
    }
    const list = await getInventoryCheckList(params)
    checkList.value = list as any
  } finally {
    loading.value = false
  }
}

const detailVisible = ref(false)
const currentDetail = ref<InventoryCheck | null>(null)
const isEditing = ref(false)
const editingId = ref('')
const checkItems = reactive<any[]>([])
const formRemark = ref('')

const detailTotalSystem = computed(() =>
  checkItems.reduce((s, i) => s + Number(i.systemQuantity || 0) * Number(i.unitPrice || 0), 0)
)
const detailTotalActual = computed(() =>
  checkItems.reduce((s, i) => s + Number(i.actualQuantity || 0) * Number(i.unitPrice || 0), 0)
)
const detailTotalDiff = computed(() => detailTotalActual.value - detailTotalSystem.value)

const detailFooter = computed(() => {
  if (!currentDetail.value) return null
  if (!isEditing.value) {
    return h('div', null, [
      h('a-button', { onClick: () => (detailVisible.value = false) }, () => '关闭'),
      h('a-button', {
        type: 'primary',
        style: 'marginLeft: 8px',
        onClick: () => startEdit(),
      }, () => '编辑'),
    ])
  }
  return h('div', null, [
    h('a-button', { onClick: () => cancelEdit() }, () => '取消'),
    h('a-button', {
      type: 'primary',
      style: 'marginLeft: 8px',
      onClick: () => saveEdit(false),
    }, () => '保存草稿'),
    h('a-button', {
      type: 'primary',
      danger: true,
      style: 'marginLeft: 8px',
      onClick: () => saveEdit(true),
    }, () => '保存并确认'),
  ])
})

function syncCheckItemsFromDetail() {
  checkItems.length = 0
  if (!currentDetail.value) return
  currentDetail.value.items.forEach((item: any) => {
    checkItems.push({
      ingredientId: typeof item.ingredientId === 'object' ? item.ingredientId._id : item.ingredientId,
      ingredientName: item.ingredientName || item.ingredientId?.name,
      unit: item.unit || item.ingredientId?.unit,
      systemQuantity: item.systemQuantity,
      actualQuantity: item.actualQuantity,
      difference: item.difference,
      unitPrice: item.unitPrice,
      differenceAmount: item.differenceAmount,
      reason: item.reason || '',
    })
  })
  formRemark.value = currentDetail.value.remark || ''
}

function onActualChange(index: number) {
  const item = checkItems[index]
  item.difference = Number(item.actualQuantity) - Number(item.systemQuantity)
  item.differenceAmount = Number((item.difference * Number(item.unitPrice)).toFixed(2))
}

async function handleView(record: InventoryCheck) {
  try {
    currentDetail.value = await getInventoryCheckDetail(record._id)
    editingId.value = record._id
    isEditing.value = false
    syncCheckItemsFromDetail()
    detailVisible.value = true
  } catch (e) {
    console.error(e)
  }
}

async function handleEdit(record: InventoryCheck) {
  try {
    currentDetail.value = await getInventoryCheckDetail(record._id)
    editingId.value = record._id
    isEditing.value = true
    syncCheckItemsFromDetail()
    detailVisible.value = true
  } catch (e) {
    console.error(e)
  }
}

function startEdit() {
  isEditing.value = true
  syncCheckItemsFromDetail()
}
function cancelEdit() {
  isEditing.value = false
  syncCheckItemsFromDetail()
}

async function saveEdit(confirmNow: boolean) {
  if (!currentDetail.value) return
  try {
    const canteenId = typeof currentDetail.value.canteenId === 'object'
      ? (currentDetail.value.canteenId as any)._id
      : currentDetail.value.canteenId

    await createInventoryCheck({
      canteenId,
      checkDate: currentDetail.value.checkDate,
      items: checkItems,
      remark: formRemark.value,
      confirmNow,
    })
    message.success(confirmNow ? '已确认盘点' : '已保存草稿')
    detailVisible.value = false
    loadCheckList()
  } catch (e) {
    console.error(e)
  }
}

async function handleConfirm(record: InventoryCheck) {
  Modal.confirm({
    title: '确认盘点',
    content: '确认后不可修改，是否确定？',
    okText: '确认',
    onOk: async () => {
      try {
        await confirmInventoryCheck(record._id)
        message.success('已确认')
        loadCheckList()
      } catch (e) {
        console.error(e)
      }
    },
  })
}

async function handleGenerate() {
  const canteenId = userStore.userInfo?.role === 'canteen'
    ? (userStore.userInfo?.canteenId || '')
    : filters.canteenId
  if (!canteenId) {
    message.warning('请选择助餐点')
    return
  }
  try {
    const data = await generateCheckData({ canteenId })
    editingId.value = ''
    currentDetail.value = {
      _id: 'new',
      checkNo: '新建盘点单',
      canteenId: canteens.value.find(c => c._id === canteenId) || canteenId as any,
      checkDate: dayjs(filters.checkMonth).endOf('month').toDate(),
      checkMonth: dayjs(filters.checkMonth).format('YYYY-MM'),
      items: data.items as any,
      totalSystemAmount: data.items.reduce((s, i: any) => s + i.systemQuantity * i.unitPrice, 0),
      totalActualAmount: data.items.reduce((s, i: any) => s + i.systemQuantity * i.unitPrice, 0),
      totalDifferenceAmount: 0,
      status: 'draft',
      createdBy: userStore.userInfo as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any
    isEditing.value = true
    syncCheckItemsFromDetail()
    detailVisible.value = true
  } catch (e) {
    console.error(e)
  }
}

onMounted(async () => {
  if (userStore.userInfo?.role === 'admin') {
    canteens.value = await getCanteenList()
  } else if (userStore.userInfo?.role === 'canteen') {
    filters.canteenId = userStore.userInfo.canteenId || ''
  }
  loadCheckList()
})
</script>

<style scoped>
.page { padding: 24px; }
.page-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.filter-bar { display: flex; gap: 12px; align-items: center; }
</style>
