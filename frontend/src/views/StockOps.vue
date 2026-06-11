<template>
  <div class="page">
    <a-tabs v-model:activeKey="activeTab" type="card">
      <a-tab-pane key="transactions" tab="出入库流水">
        <div class="page-header">
          <div class="filter-bar">
            <a-select
              v-model:value="trFilters.canteenId"
              placeholder="选择助餐点"
              style="width: 180px"
              allow-clear
              v-if="userStore.userInfo?.role === 'admin'"
            >
              <a-select-option v-for="c in canteens" :key="c._id" :value="c._id">
                {{ c.name }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="trFilters.type"
              placeholder="类型"
              style="width: 120px"
              allow-clear
            >
              <a-select-option value="in">入库</a-select-option>
              <a-select-option value="out">出库</a-select-option>
            </a-select>
            <a-range-picker v-model:value="trDateRange" />
            <a-button type="primary" @click="loadTransactions">
              <SearchOutlined />
              查询
            </a-button>
          </div>
        </div>

        <a-table
          :columns="trColumns"
          :data-source="transactions"
          :pagination="trPagination"
          :loading="trLoading"
          row-key="orderNo"
          @change="handleTrPageChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <a-tag :color="record.type === 'in' ? 'green' : 'blue'">
                {{ TRANSACTION_TYPE_MAP[record.type] }}
                <span v-if="record.outType"> - {{ STOCK_OUT_TYPE_MAP[record.outType] || '' }}</span>
              </a-tag>
            </template>
            <template v-else-if="column.key === 'date'">
              {{ formatDateTime(record.date) }}
            </template>
            <template v-else-if="column.key === 'quantity'">
              <span :style="{ color: record.type === 'in' ? '#52c41a' : '#ff4d4f', fontWeight: 600 }">
                {{ record.type === 'in' ? '+' : '-' }}{{ record.quantity }} {{ record.unit }}
              </span>
            </template>
            <template v-else-if="column.key === 'amount'">
              <span :style="{ color: record.type === 'in' ? '#52c41a' : '#ff4d4f' }">
                {{ record.type === 'in' ? '+' : '-' }}¥{{ Number(record.amount).toFixed(2) }}
              </span>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="stock-out" tab="领用出库">
        <div class="page-header">
          <div class="filter-bar">
            <a-select
              v-model:value="outFilters.canteenId"
              placeholder="选择助餐点"
              style="width: 180px"
              allow-clear
              v-if="userStore.userInfo?.role === 'admin'"
            >
              <a-select-option v-for="c in canteens" :key="c._id" :value="c._id">
                {{ c.name }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="outFilters.type"
              placeholder="出库类型"
              style="width: 140px"
              allow-clear
            >
              <a-select-option v-for="(label, value) in STOCK_OUT_TYPE_MAP" :key="value" :value="value">
                {{ label }}
              </a-select-option>
            </a-select>
            <a-range-picker v-model:value="outDateRange" />
            <a-button type="primary" @click="loadStockOutList">
              <SearchOutlined />
              查询
            </a-button>
          </div>
          <a-button type="primary" @click="handleAddStockOut">
            <PlusOutlined />
            新增领用单
          </a-button>
        </div>

        <a-table
          :columns="outColumns"
          :data-source="stockOutList"
          :pagination="outPagination"
          :loading="outLoading"
          row-key="_id"
          @change="handleOutPageChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'canteen'">
              {{ record.canteenId?.name || '-' }}
            </template>
            <template v-else-if="column.key === 'type'">
              <a-tag color="blue">
                {{ STOCK_OUT_TYPE_MAP[record.type] }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'date'">
              {{ formatDate(record.outDate) }}
            </template>
            <template v-else-if="column.key === 'items'">
              <a-list size="small" bordered>
              <template #header>
                <span style="fontSize: 12px; color: #666">
                  共{{ record.items.length }}项，合计：¥{{ record.totalAmount.toFixed(2) }}
                </span>
              </template>
              <a-list-item v-for="item in record.items" :key="(item as any).ingredientId._id">
                <a-list-item-meta>
                  <a-list-item-meta-title>
                    {{ (item as any).ingredientId?.name || '-' }}
                  </a-list-item-meta-title>
                  <a-list-item-meta-description>
                    {{ (item as any).quantity }} {{ (item as any).ingredientId?.unit }} × ¥{{ (item as any).unitPrice.toFixed(2) }}
                    = ¥{{ (item as any).amount.toFixed(2) }}
                  </a-list-item-meta-description>
                </a-list-item-meta>
              </a-list-item>
            </a-list>
            </template>
            <template v-else-if="column.key === 'use'">
              <div><strong>领用人:</strong> {{ record.receiver }}</div>
              <div style="color: #666; fontSize: 12px">用途: {{ record.purpose }}</div>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <a-modal
      v-model:open="outModalVisible"
      title="新增领用出库"
      width="760px"
      @ok="handleOutSubmit"
      @cancel="outModalVisible = false"
      :confirmLoading="outSubmitLoading"
    >
      <a-form :model="outForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12" v-if="userStore.userInfo?.role === 'admin'">
            <a-form-item label="助餐点" :rules="[{ required: true, message: '请选择助餐点' }]">
              <a-select v-model:value="outForm.canteenId" placeholder="请选择助餐点" style="width: 100%">
                <a-select-option v-for="c in canteens" :key="c._id" :value="c._id">
                  {{ c.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="出库类型">
              <a-select v-model:value="outForm.type" style="width: 100%">
                <a-select-option v-for="(label, value) in STOCK_OUT_TYPE_MAP" :key="value" :value="value">
                  {{ label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="领用人" :rules="[{ required: true, message: '请输入领用人' }]">
              <a-input v-model:value="outForm.receiver" placeholder="请输入领用人姓名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="出库日期">
              <a-date-picker v-model:value="outForm.outDate" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="用途" :rules="[{ required: true, message: '请输入用途' }]">
          <a-input v-model:value="outForm.purpose" placeholder="如：午餐备餐等" />
        </a-form-item>

        <a-divider>食材明细（先进先出自动扣减）</a-divider>
        <div style="margin-bottom: 12px">
          <a-button type="dashed" @click="addOutItem" style="width: 100%">
            <PlusOutlined /> 添加食材
          </a-button>
        </div>
        <a-table
          :columns="outItemColumns"
          :data-source="outForm.items"
          :pagination="false"
          row-key="__key"
          size="small"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'ingredient'">
              <a-select
                v-model:value="record.ingredientId"
                placeholder="选择食材"
                style="width: 100%"
                show-search
                :filter-option="filterIngredient"
              >
                <a-select-option v-for="ing in ingredients" :key="ing._id" :value="ing._id">
                  {{ ing.name }} ({{ UNIT_MAP[ing.unit] }})
                </a-select-option>
              </a-select>
            </template>
            <template v-else-if="column.key === 'quantity'">
              <a-input-number v-model:value="record.quantity" :min="0" :precision="3" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" danger @click="removeOutItem(index)">删除</a-button>
            </template>
          </template>
        </a-table>

        <div style="text-align: right; margin-top: 12px; font-size: 16px">
          共 <strong>{{ validOutItems.length }}</strong> 项
        </div>

        <a-form-item label="备注" style="margin-top: 16px">
          <a-textarea v-model:value="outForm.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import {
  getTransactions,
  getStockOutList,
  createStockOut,
  StockOut,
  TransactionItem,
  STOCK_OUT_TYPE_MAP,
  TRANSACTION_TYPE_MAP,
} from '@/api/stockOps'
import { getAllIngredients, Ingredient, UNIT_MAP } from '@/api/inventory'
import { getCanteenList, CanteenItem } from '@/api/canteens'

const userStore = useUserStore()

const activeTab = ref('transactions')
const canteens = ref<CanteenItem[]>([])
const ingredients = ref<Ingredient[]>([])

function formatDate(d: any) {
  return d ? dayjs(d).format('YYYY-MM-DD') : '-'
}
function formatDateTime(d: any) {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
}
function filterIngredient(input: string, option: any) {
  const label = option.children || ''
  return label.toLowerCase().includes(input.toLowerCase())
}

const trFilters = reactive({ canteenId: '', type: '' })
const trDateRange = ref<any>([])
const trLoading = ref(false)
const transactions = ref<TransactionItem[]>([])
const allTransactions = ref<TransactionItem[]>([])
const trPagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`,
})

const trColumns = [
  { title: '类型', key: 'type', width: 140 },
  { title: '单号', dataIndex: 'orderNo', key: 'orderNo', width: 200 },
  { title: '日期', key: 'date', width: 160 },
  { title: '助餐点', dataIndex: 'canteenName', key: 'canteenName', width: 140 },
  { title: '食材', dataIndex: 'ingredientName', key: 'ingredientName', width: 160 },
  { title: '数量', key: 'quantity', width: 140 },
  { title: '金额', key: 'amount', width: 140 },
  { title: '关联方', dataIndex: 'relatedParty', key: 'relatedParty', width: 140 },
  { title: '用途/备注', key: 'purpose', dataIndex: 'purpose', ellipsis: true },
]

async function loadTransactions() {
  trLoading.value = true
  try {
    const params: any = {
      type: trFilters.type || undefined,
    }
    if (trFilters.canteenId) params.canteenId = trFilters.canteenId
    if (userStore.userInfo?.role === 'canteen' && !params.canteenId) {
      params.canteenId = userStore.userInfo.canteenId
    }
    if (trDateRange.value && trDateRange.value.length === 2) {
      params.startDate = dayjs(trDateRange.value[0]).format('YYYY-MM-DD')
      params.endDate = dayjs(trDateRange.value[1]).format('YYYY-MM-DD')
    }
    const res = await getTransactions(params)
    allTransactions.value = res
    trPagination.total = res.length
    updateTrPage()
  } finally {
    trLoading.value = false
  }
}

function updateTrPage() {
  const start = (trPagination.current - 1) * trPagination.pageSize
  transactions.value = allTransactions.value.slice(start, start + trPagination.pageSize)
}

function handleTrPageChange(pg: any) {
  trPagination.current = pg.current
  trPagination.pageSize = pg.pageSize
  updateTrPage()
}

const outFilters = reactive({ canteenId: '', type: '' })
const outDateRange = ref<any>([])
const outLoading = ref(false)
const stockOutList = ref<StockOut[]>([])
const outPagination = reactive({
  current: 1, pageSize: 10, total: 0,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`,
})

const outColumns = [
  { title: '出库单号', dataIndex: 'outNo', key: 'outNo', width: 200 },
  { title: '助餐点', key: 'canteen', width: 140 },
  { title: '类型', key: 'type', width: 100 },
  { title: '日期', key: 'date', width: 120 },
  { title: '明细', key: 'items' },
  { title: '领用信息', key: 'use', width: 200 },
]

async function loadStockOutList() {
  outLoading.value = true
  try {
    const params: any = {
      page: outPagination.current,
      pageSize: outPagination.pageSize,
      type: outFilters.type || undefined,
    }
    if (outFilters.canteenId) params.canteenId = outFilters.canteenId
    if (userStore.userInfo?.role === 'canteen' && !params.canteenId) {
      params.canteenId = userStore.userInfo.canteenId
    }
    if (outDateRange.value && outDateRange.value.length === 2) {
      params.startDate = dayjs(outDateRange.value[0]).format('YYYY-MM-DD')
      params.endDate = dayjs(outDateRange.value[1]).format('YYYY-MM-DD')
    }
    const res = await getStockOutList(params)
    stockOutList.value = res.list
    outPagination.total = res.total
  } finally {
    outLoading.value = false
  }
}

function handleOutPageChange(pg: any) {
  outPagination.current = pg.current
  outPagination.pageSize = pg.pageSize
  loadStockOutList()
}

const outModalVisible = ref(false)
const outSubmitLoading = ref(false)

const defaultOutForm = () => ({
  canteenId: userStore.userInfo?.role === 'canteen' ? userStore.userInfo?.canteenId : '',
  type: 'usage',
  items: [{ __key: Date.now(), ingredientId: '', quantity: 0 }] as any[],
  receiver: '',
  purpose: '',
  outDate: dayjs(),
  remark: '',
})
const outForm = reactive<any>(defaultOutForm())

const validOutItems = computed(() =>
  outForm.items.filter((i: any) => i.ingredientId && i.quantity > 0)
)

const outItemColumns = [
  { title: '食材', key: 'ingredient' },
  { title: '数量', key: 'quantity', width: 160 },
  { title: '操作', key: 'action', width: 80 },
]

function addOutItem() {
  outForm.items.push({ __key: Date.now() + Math.random(), ingredientId: '', quantity: 0 })
}
function removeOutItem(idx: number) {
  outForm.items.splice(idx, 1)
}

function handleAddStockOut() {
  Object.assign(outForm, defaultOutForm())
  outModalVisible.value = true
}

async function handleOutSubmit() {
  if (!outForm.canteenId || !outForm.receiver || !outForm.purpose) {
    // pass
  }
  if (!outForm.canteenId || !outForm.receiver || !outForm.purpose) {
    message.warning('请填写完整信息')
    return
  }
  if (validOutItems.value.length === 0) {
    message.warning('请至少添加一条有效明细')
    return
  }
  outSubmitLoading.value = true
  try {
    const payload = {
      canteenId: outForm.canteenId,
      type: outForm.type,
      items: validOutItems.value.map((i: any) => ({
        ingredientId: i.ingredientId, quantity: i.quantity })),
      receiver: outForm.receiver,
      purpose: outForm.purpose,
      outDate: dayjs(outForm.outDate).format('YYYY-MM-DD'),
      remark: outForm.remark,
    }
    await createStockOut(payload as any)
    message.success('出库成功')
    outModalVisible.value = false
    loadStockOutList()
    loadTransactions()
  } finally {
    outSubmitLoading.value = false
  }
}

watch(activeTab, (val) => {
  if (val === 'transactions') loadTransactions()
  else if (val === 'stock-out') loadStockOutList()
})

onMounted(async () => {
  const [cList, iList] = await Promise.all([
    userStore.userInfo?.role === 'admin' ? getCanteenList() : Promise.resolve([]),
    getAllIngredients(),
  ])
  canteens.value = cList as any
  ingredients.value = iList
  if (userStore.userInfo?.role === 'canteen') {
    trFilters.canteenId = userStore.userInfo.canteenId || ''
    outFilters.canteenId = userStore.userInfo.canteenId || ''
  }
  loadTransactions()
})
</script>

<style scoped>
.page { padding: 24px; }
.page-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.filter-bar { display: flex; gap: 12px; }
</style>
