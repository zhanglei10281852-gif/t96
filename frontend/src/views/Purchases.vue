<template>
  <div class="page">
    <div class="page-header">
      <div class="filter-bar">
        <a-select
          v-model:value="filters.canteenId"
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
          v-model:value="filters.status"
          placeholder="采购状态"
          style="width: 140px"
          allow-clear
        >
          <a-select-option v-for="(label, value) in PURCHASE_STATUS_MAP" :key="value" :value="value">
            {{ label }}
          </a-select-option>
        </a-select>
        <a-range-picker v-model:value="dateRange" />
        <a-button type="primary" @click="loadData">
          <SearchOutlined />
          查询
        </a-button>
      </div>
      <a-button type="primary" @click="handleAdd">
        <PlusOutlined />
        新建采购单
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="dataSource"
      :pagination="pagination"
      :loading="loading"
      row-key="_id"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'canteen'">
          {{ record.canteenId?.name || '-' }}
        </template>
        <template v-else-if="column.key === 'supplier'">
          {{ record.supplierId?.name || '-' }}
        </template>
        <template v-else-if="column.key === 'date'">
          {{ formatDate(record.purchaseDate) }}
        </template>
        <template v-else-if="column.key === 'amount'">
          <span :class="{ 'need-approval': record.needApproval }">
            ¥{{ record.totalAmount.toFixed(2) }}
            <a-tag v-if="record.needApproval && record.status === 'draft'" color="orange">
              超500需审批
            </a-tag>
          </span>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="PURCHASE_STATUS_COLOR[record.status]">
            {{ PURCHASE_STATUS_MAP[record.status] }}
          </a-tag>
          <div v-if="record.rejectReason" style="color: #ff4d4f; font-size: 12px; margin-top: 4px">
            驳回: {{ record.rejectReason }}
          </div>
        </template>
        <template v-else-if="column.key === 'itemCount'">
          {{ record.items?.length || 0 }} 项
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button type="link" size="small" @click="handleView(record)">
            详情
          </a-button>
          <template v-if="record.status === 'draft' || record.status === 'rejected'">
            <a-button type="link" size="small" @click="handleEdit(record)">
              编辑
            </a-button>
            <a-button type="link" size="small" @click="handleSubmit(record)">
              提交
            </a-button>
            <a-popconfirm title="确定删除此采购单？" @confirm="handleDelete(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </template>
          <template v-if="record.status === 'submitted' && userStore.userInfo?.role === 'admin'">
            <a-button type="link" size="small" @click="handleApprove(record)">
              审批
            </a-button>
            <a-button type="link" size="small" danger @click="handleReject(record)">
              驳回
            </a-button>
          </template>
          <template v-if="record.status === 'approved'">
            <a-button type="primary" size="small" @click="handleStockIn(record)">
              入库
            </a-button>
          </template>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="formModalVisible"
      :title="isEdit ? '编辑采购单' : '新建采购单'"
      width="800px"
      @ok="handleFormSubmit"
      @cancel="formModalVisible = false"
      :confirmLoading="submitLoading"
      :okText="isEdit ? '保存' : '创建草稿'"
    >
      <a-form :model="formData" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12" v-if="userStore.userInfo?.role === 'admin'">
            <a-form-item label="助餐点" :rules="[{ required: true, message: '请选择助餐点' }]">
              <a-select v-model:value="formData.canteenId" placeholder="请选择助餐点" style="width: 100%">
                <a-select-option v-for="c in canteens" :key="c._id" :value="c._id">
                  {{ c.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="供应商" :rules="[{ required: true, message: '请选择供应商' }]">
              <a-select v-model:value="formData.supplierId" placeholder="请选择供应商" style="width: 100%">
                <a-select-option v-for="s in suppliers" :key="s._id" :value="s._id">
                  {{ s.name }} - {{ s.contactPerson }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="采购日期" :rules="[{ required: true, message: '请选择日期' }]">
              <a-date-picker v-model:value="formData.purchaseDate" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider>食材明细</a-divider>
        <div style="margin-bottom: 12px">
          <a-button type="dashed" @click="addItem" style="width: 100%">
            <PlusOutlined /> 添加食材
          </a-button>
        </div>
        <a-table
          :columns="itemColumns"
          :data-source="formData.items"
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
                @change="onIngredientChange(index)"
                show-search
                :filter-option="filterIngredientOption"
              >
                <a-select-option v-for="ing in ingredients" :key="ing._id" :value="ing._id">
                  {{ ing.name }} ({{ UNIT_MAP[ing.unit] }})
                </a-select-option>
              </a-select>
            </template>
            <template v-else-if="column.key === 'quantity'">
              <a-input-number v-model:value="record.quantity" :min="0" :precision="3" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'unitPrice'">
              <a-input-number v-model:value="record.unitPrice" :min="0" :precision="2" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'amount'">
              ¥{{ (record.quantity * record.unitPrice).toFixed(2) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" danger @click="removeItem(index)">删除</a-button>
            </template>
          </template>
        </a-table>

        <div style="text-align: right; margin-top: 12px; font-size: 16px">
          总金额: <strong style="color: #1890ff">¥{{ formTotalAmount.toFixed(2) }}</strong>
          <a-tag v-if="formTotalAmount > 500" color="orange" style="margin-left: 8px">超过500元需审批</a-tag>
        </div>

        <a-form-item label="备注" style="margin-top: 16px">
          <a-textarea v-model:value="formData.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="detailVisible"
      title="采购单详情"
      width="720px"
      :footer="null"
    >
      <template v-if="currentDetail">
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item label="采购单号">{{ currentDetail.orderNo }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="PURCHASE_STATUS_COLOR[currentDetail.status]">
              {{ PURCHASE_STATUS_MAP[currentDetail.status] }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="助餐点">{{ currentDetail.canteenId?.name }}</a-descriptions-item>
          <a-descriptions-item label="供应商">{{ currentDetail.supplierId?.name }}</a-descriptions-item>
          <a-descriptions-item label="采购日期">{{ formatDate(currentDetail.purchaseDate) }}</a-descriptions-item>
          <a-descriptions-item label="总金额">¥{{ currentDetail.totalAmount.toFixed(2) }}</a-descriptions-item>
        </a-descriptions>
        <h4 style="margin: 16px 0 8px">食材明细</h4>
        <a-table
          :columns="detailItemColumns"
          :data-source="currentDetail.items"
          :pagination="false"
          size="small"
          row-key="ingredientId"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              {{ record.ingredientId?.name }}
            </template>
            <template v-else-if="column.key === 'unit'">
              {{ UNIT_MAP[record.ingredientId?.unit] || record.ingredientId?.unit }}
            </template>
          </template>
        </a-table>
        <p v-if="currentDetail.remark" style="margin-top: 12px">
          <strong>备注:</strong> {{ currentDetail.remark }}
        </p>
      </template>
    </a-modal>

    <a-modal
      v-model:open="stockInVisible"
      title="采购入库"
      width="800px"
      @ok="handleStockInSubmit"
      @cancel="stockInVisible = false"
      :confirmLoading="stockInLoading"
    >
      <template v-if="currentStockIn">
        <a-alert type="info" show-icon style="margin-bottom: 16px">
          <template #message>
            采购单: {{ currentStockIn.orderNo }} |
            助餐点: {{ currentStockIn.canteenId?.name }} |
            供应商: {{ currentStockIn.supplierId?.name }}
          </template>
        </a-alert>
        <a-table
          :columns="stockInColumns"
          :data-source="stockInItems"
          :pagination="false"
          row-key="ingredientId"
          size="small"
          :scroll="{ x: 1200 }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'name'">
              {{ record.ingredientId?.name }}
              <span style="color: #999; margin-left: 4px">({{ UNIT_MAP[record.ingredientId?.unit] }})</span>
            </template>
            <template v-else-if="column.key === 'accepted'">
              <a-input-number
                v-model:value="record.acceptedQuantity"
                :min="0"
                :precision="3"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'diff'">
              <span :style="{ color: record.acceptedQuantity !== record.quantity ? '#ff4d4f' : 'inherit' }">
                {{ record.acceptedQuantity - record.quantity }}
              </span>
            </template>
            <template v-else-if="column.key === 'productionDate'">
              <a-date-picker
                v-model:value="stockInProductionDates[index]"
                style="width: 100%"
                :placeholder="'生产日期'"
              />
            </template>
            <template v-else-if="column.key === 'shelfLife'">
              {{ record.ingredientId?.shelfLifeDays }} 天
            </template>
            <template v-else-if="column.key === 'differenceReason'">
              <a-input v-model:value="record.differenceReason" placeholder="差异说明" style="width: 240px" />
            </template>
          </template>
        </a-table>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import {
  getPurchaseList,
  getPurchaseDetail,
  createPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  stockInPurchaseOrder,
  deletePurchaseOrder,
  PurchaseOrder,
  PURCHASE_STATUS_MAP,
  PURCHASE_STATUS_COLOR,
} from '@/api/purchases'
import { getAllIngredients, Ingredient, UNIT_MAP } from '@/api/inventory'
import { getAllSuppliers, Supplier } from '@/api/suppliers'
import { getCanteenList, CanteenItem } from '@/api/canteens'

const userStore = useUserStore()

const loading = ref(false)
const dataSource = ref<PurchaseOrder[]>([])
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const filters = reactive({
  canteenId: '',
  status: '',
})
const dateRange = ref<any>([])

const canteens = ref<CanteenItem[]>([])
const suppliers = ref<Supplier[]>([])
const ingredients = ref<Ingredient[]>([])

const columns = [
  { title: '采购单号', dataIndex: 'orderNo', key: 'orderNo', width: 180 },
  { title: '助餐点', key: 'canteen', width: 140 },
  { title: '供应商', key: 'supplier', width: 160 },
  { title: '采购日期', key: 'date', width: 120 },
  { title: '项数', key: 'itemCount', width: 80 },
  { title: '总金额', key: 'amount', width: 180 },
  { title: '状态', key: 'status', width: 140 },
  { title: '操作', key: 'action', width: 280, fixed: 'right' as const },
]

const itemColumns = [
  { title: '食材', key: 'ingredient', width: 220 },
  { title: '数量', key: 'quantity', width: 120 },
  { title: '单价(元)', key: 'unitPrice', width: 120 },
  { title: '金额', key: 'amount', width: 120 },
  { title: '操作', key: 'action', width: 80 },
]

const detailItemColumns = [
  { title: '食材', key: 'name', dataIndex: 'ingredientId' },
  { title: '单位', key: 'unit', width: 80 },
  { title: '采购数量', dataIndex: 'quantity', width: 100 },
  { title: '单价', dataIndex: 'unitPrice', width: 100, customRender: ({ text }: any) => `¥${Number(text).toFixed(2)}` },
  { title: '金额', dataIndex: 'amount', width: 100, customRender: ({ text }: any) => `¥${Number(text).toFixed(2)}` },
  { title: '验收数量', key: 'accepted', dataIndex: 'acceptedQuantity', width: 100 },
  { title: '差异', key: 'diff', dataIndex: 'difference', width: 80 },
]

const stockInColumns = [
  { title: '食材', key: 'name', width: 180 },
  { title: '采购数量', dataIndex: 'quantity', width: 100 },
  { title: '验收数量', key: 'accepted', width: 150 },
  { title: '差异', key: 'diff', width: 80 },
  { title: '单价', dataIndex: 'unitPrice', width: 90, customRender: ({ text }: any) => `¥${Number(text).toFixed(2)}` },
  { title: '生产日期', key: 'productionDate', width: 180 },
  { title: '保质期', key: 'shelfLife', width: 90 },
  { title: '差异说明', key: 'differenceReason', width: 260 },
]

function formatDate(d: any) {
  return d ? dayjs(d).format('YYYY-MM-DD') : '-'
}

function filterIngredientOption(input: string, option: any) {
  const label = option.children || ''
  return label.toLowerCase().includes(input.toLowerCase())
}

async function loadData() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      status: filters.status || undefined,
    }
    if (userStore.userInfo?.role === 'canteen') {
      params.canteenId = userStore.userInfo.canteenId
    } else if (filters.canteenId) {
      params.canteenId = filters.canteenId
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dayjs(dateRange.value[0]).format('YYYY-MM-DD')
      params.endDate = dayjs(dateRange.value[1]).format('YYYY-MM-DD')
    }
    const res = await getPurchaseList(params)
    dataSource.value = res.list
    pagination.total = res.total
  } finally {
    loading.value = false
  }
}

function handleTableChange(pg: any) {
  pagination.current = pg.current
  pagination.pageSize = pg.pageSize
  loadData()
}

const formModalVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const editingId = ref('')

const defaultForm = () => ({
  canteenId: userStore.userInfo?.role === 'canteen' ? userStore.userInfo?.canteenId : '',
  supplierId: '',
  purchaseDate: dayjs(),
  items: [{ __key: Date.now(), ingredientId: '', quantity: 0, unitPrice: 0 }],
  remark: '',
})

const formData = reactive<any>(defaultForm())

const formTotalAmount = computed(() =>
  formData.items.reduce((sum: number, item: any) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0)
)

function addItem() {
  formData.items.push({ __key: Date.now() + Math.random(), ingredientId: '', quantity: 0, unitPrice: 0 })
}

function removeItem(index: number) {
  formData.items.splice(index, 1)
}

function onIngredientChange(index: number) {
  const ing = ingredients.value.find(i => i._id === formData.items[index].ingredientId)
  if (ing && formData.items[index].unitPrice === 0) {
    formData.items[index].unitPrice = ing.referencePrice
  }
}

function handleAdd() {
  isEdit.value = false
  editingId.value = ''
  Object.assign(formData, defaultForm())
  formModalVisible.value = true
}

function handleEdit(record: PurchaseOrder) {
  isEdit.value = true
  editingId.value = record._id
  Object.assign(formData, {
    canteenId: typeof record.canteenId === 'object' ? record.canteenId._id : record.canteenId,
    supplierId: typeof record.supplierId === 'object' ? record.supplierId._id : record.supplierId,
    purchaseDate: dayjs(record.purchaseDate),
    items: record.items.map((i: any, idx: number) => ({
      __key: idx,
      ingredientId: typeof i.ingredientId === 'object' ? i.ingredientId._id : i.ingredientId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    remark: record.remark || '',
  })
  formModalVisible.value = true
}

async function handleFormSubmit() {
  if (!formData.canteenId || !formData.supplierId || !formData.purchaseDate) {
    message.warning('请填写基本信息')
    return
  }
  const validItems = formData.items.filter((i: any) => i.ingredientId && i.quantity > 0)
  if (validItems.length === 0) {
    message.warning('请至少添加一条有效明细')
    return
  }
  submitLoading.value = true
  try {
    const payload = {
      canteenId: formData.canteenId,
      supplierId: formData.supplierId,
      purchaseDate: dayjs(formData.purchaseDate).format('YYYY-MM-DD'),
      items: validItems.map((i: any) => ({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      remark: formData.remark,
    }
    if (isEdit.value) {
      await updatePurchaseOrder(editingId.value, payload as any)
      message.success('保存成功')
    } else {
      await createPurchaseOrder(payload as any)
      message.success('创建成功')
    }
    formModalVisible.value = false
    loadData()
  } finally {
    submitLoading.value = false
  }
}

async function handleSubmit(record: PurchaseOrder) {
  Modal.confirm({
    title: '提交采购单',
    content: record.needApproval ? '金额超过500元，提交后需管理员审批，确定提交？' : '确定提交此采购单？',
    okText: '提交',
    onOk: async () => {
      try {
        await submitPurchaseOrder(record._id)
        message.success('提交成功')
        loadData()
      } catch (e) {
        console.error(e)
      }
    },
  })
}

async function handleApprove(record: PurchaseOrder) {
  Modal.confirm({
    title: '审批通过',
    content: `确定通过采购单 ${record.orderNo} ？`,
    onOk: async () => {
      try {
        await approvePurchaseOrder(record._id)
        message.success('审批通过')
        loadData()
      } catch (e) {
        console.error(e)
      }
    },
  })
}

async function handleReject(record: PurchaseOrder) {
  const { confirm } = Modal
  confirm({
    title: '驳回采购单',
    content: '请输入驳回原因（可选）',
    okText: '驳回',
    okButtonProps: { danger: true },
  })
  // 简化：直接调用
  try {
    await rejectPurchaseOrder(record._id, '管理员驳回')
    message.success('已驳回')
    loadData()
  } catch (e) {
    console.error(e)
  }
}

async function handleDelete(record: PurchaseOrder) {
  try {
    await deletePurchaseOrder(record._id)
    message.success('删除成功')
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const detailVisible = ref(false)
const currentDetail = ref<PurchaseOrder | null>(null)

async function handleView(record: PurchaseOrder) {
  try {
    currentDetail.value = await getPurchaseDetail(record._id)
    detailVisible.value = true
  } catch (e) {
    console.error(e)
  }
}

const stockInVisible = ref(false)
const stockInLoading = ref(false)
const currentStockIn = ref<PurchaseOrder | null>(null)
const stockInItems = reactive<any[]>([])
const stockInProductionDates = reactive<any[]>([])

async function handleStockIn(record: PurchaseOrder) {
  try {
    currentStockIn.value = await getPurchaseDetail(record._id)
    stockInItems.length = 0
    stockInProductionDates.length = 0
    currentStockIn.value.items.forEach((item: any) => {
      stockInItems.push({
        ...item,
        acceptedQuantity: item.quantity,
        differenceReason: '',
      })
      stockInProductionDates.push(dayjs().toDate())
    })
    stockInVisible.value = true
  } catch (e) {
    console.error(e)
  }
}

async function handleStockInSubmit() {
  if (!currentStockIn.value) return
  stockInLoading.value = true
  try {
    const items = stockInItems.map((item: any) => ({
      acceptedQuantity: item.acceptedQuantity,
      differenceReason: item.differenceReason,
    }))
    const productionDates = stockInProductionDates.map((d: any) => d ? dayjs(d).format('YYYY-MM-DD') : null)
    await stockInPurchaseOrder(currentStockIn.value._id, { items, productionDates })
    message.success('入库成功')
    stockInVisible.value = false
    loadData()
  } finally {
    stockInLoading.value = false
  }
}

onMounted(async () => {
  const [cList, sList, iList] = await Promise.all([
    userStore.userInfo?.role === 'admin' ? getCanteenList() : Promise.resolve([]),
    getAllSuppliers(),
    getAllIngredients(),
  ])
  canteens.value = cList as any
  suppliers.value = sList
  ingredients.value = iList
  loadData()
})
</script>

<style scoped>
.page {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filter-bar {
  display: flex;
  gap: 12px;
}

.need-approval {
  display: block;
}
</style>
