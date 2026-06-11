<template>
  <div class="page">
    <a-tabs v-model:activeKey="activeTab" type="card">
      <a-tab-pane key="stock" tab="库存列表">
        <div class="page-header">
          <div class="filter-bar">
            <a-select
              v-model:value="stockFilters.canteenId"
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
              v-model:value="stockFilters.category"
              placeholder="食材分类"
              style="width: 140px"
              allow-clear
            >
              <a-select-option v-for="(label, value) in INGREDIENT_CATEGORY_MAP" :key="value" :value="value">
                {{ label }}
              </a-select-option>
            </a-select>
            <a-input
              v-model:value="stockFilters.keyword"
              placeholder="搜索食材名称"
              style="width: 200px"
              allow-clear
            />
            <a-button type="primary" @click="loadInventory">
              <SearchOutlined />
              查询
            </a-button>
          </div>
          <a-space>
            <a-button @click="handleExport">导出</a-button>
          </a-space>
        </div>

        <a-alert
          v-if="warnings.expiringBatches.length > 0 || warnings.lowStockItems.length > 0"
          style="margin-bottom: 16px"
          show-icon
        >
          <template #message>
            <span v-if="warnings.expiringBatches.length > 0">
              <a-tag color="orange">临期/过期食材: {{ warnings.expiringBatches.length }} 批次</a-tag>
            </span>
            <span v-if="warnings.lowStockItems.length > 0" style="margin-left: 12px">
              <a-tag color="red">低库存预警: {{ warnings.lowStockItems.length }} 项</a-tag>
            </span>
          </template>
        </a-alert>

        <a-table
          :columns="stockColumns"
          :data-source="inventoryList"
          :loading="stockLoading"
          row-key="ingredientId"
          :expandable="{ expandIconColumnIndex: -1 }"
        >
          <template #expandedRowRender="{ record }">
            <a-table
              :columns="batchColumns"
              :data-source="record.batches"
              :pagination="false"
              size="small"
              row-key="_id"
            >
              <template #bodyCell="{ column, record: batch }">
                <template v-if="column.key === 'status'">
                  <a-tag :color="batchStatusColor(batch.status)">
                    {{ BATCH_STATUS_MAP[batch.status] }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'action'">
                  <a-popconfirm
                    v-if="batch.status === 'expired'"
                    title="确定报损此批次？"
                    @confirm="handleReportDamage(batch)"
                  >
                    <a-button type="link" size="small" danger>报损</a-button>
                  </a-popconfirm>
                </template>
              </template>
            </a-table>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'warning'">
              <div>
                <a-tag v-if="record.hasExpired" color="red">过期</a-tag>
                <a-tag v-if="record.hasExpiringSoon" color="orange">临期</a-tag>
                <a-tag v-if="record.isLowStock" color="warning">低库存</a-tag>
                <span v-if="!record.hasExpired && !record.hasExpiringSoon && !record.isLowStock">-</span>
              </div>
            </template>
            <template v-else-if="column.key === 'category'">
              {{ INGREDIENT_CATEGORY_MAP[record.category] || record.category }}
            </template>
            <template v-else-if="column.key === 'stockInfo'">
              <div>
                <div>当前库存: <strong>{{ record.totalQuantity }} {{ UNIT_MAP[record.unit] }}</strong></div>
                <div :style="{ color: record.totalQuantity < record.safetyStock ? '#ff4d4f' : '#666' }">
                  安全库存: {{ record.safetyStock }} {{ UNIT_MAP[record.unit] }}
                </div>
                <div>库存价值: ¥{{ record.totalValue.toFixed(2) }}</div>
              </div>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="ingredient" tab="食材字典">
        <div class="page-header">
          <div class="filter-bar">
            <a-select
              v-model:value="ingredientFilters.category"
              placeholder="食材分类"
              style="width: 140px"
              allow-clear
              @change="loadIngredients"
            >
              <a-select-option v-for="(label, value) in INGREDIENT_CATEGORY_MAP" :key="value" :value="value">
                {{ label }}
              </a-select-option>
            </a-select>
            <a-input
              v-model:value="ingredientFilters.keyword"
              placeholder="搜索食材名称"
              style="width: 200px"
              allow-clear
              @change="loadIngredients"
            />
            <a-button @click="loadIngredients">
              <SearchOutlined />
              搜索
            </a-button>
          </div>
          <a-button type="primary" @click="handleAddIngredient">
            <PlusOutlined />
            新增食材
          </a-button>
        </div>

        <a-table
          :columns="ingredientColumns"
          :data-source="ingredientList"
          :pagination="ingredientPagination"
          :loading="ingredientLoading"
          row-key="_id"
          @change="handleIngredientTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'category'">
              {{ INGREDIENT_CATEGORY_MAP[record.category] || record.category }}
            </template>
            <template v-else-if="column.key === 'unit'">
              {{ UNIT_MAP[record.unit] || record.unit }}
            </template>
            <template v-else-if="column.key === 'price'">
              ¥{{ record.referencePrice.toFixed(2) }}/{{ UNIT_MAP[record.unit] }}
            </template>
            <template v-else-if="column.key === 'shelfLife'">
              {{ record.shelfLifeDays }} 天
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" @click="handleEditIngredient(record)">
                编辑
              </a-button>
              <a-popconfirm title="确定删除该食材？" @confirm="handleDeleteIngredient(record)">
                <a-button type="link" size="small" danger>
                  删除
                </a-button>
              </a-popconfirm>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <a-modal
      v-model:open="ingredientModalVisible"
      :title="isEditIngredient ? '编辑食材' : '新增食材'"
      width="560px"
      @ok="handleSubmitIngredient"
      @cancel="ingredientModalVisible = false"
      :confirmLoading="submitLoading"
    >
      <a-form :model="ingredientForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="食材名称" :rules="[{ required: true, message: '请输入名称' }]">
              <a-input v-model:value="ingredientForm.name" placeholder="请输入食材名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="食材分类" :rules="[{ required: true, message: '请选择分类' }]">
              <a-select v-model:value="ingredientForm.category" style="width: 100%">
                <a-select-option v-for="(label, value) in INGREDIENT_CATEGORY_MAP" :key="value" :value="value">
                  {{ label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="计量单位" :rules="[{ required: true, message: '请选择单位' }]">
              <a-select v-model:value="ingredientForm.unit" style="width: 100%">
                <a-select-option v-for="(label, value) in UNIT_MAP" :key="value" :value="value">
                  {{ label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="保质期" :rules="[{ required: true, message: '请输入保质期' }]">
              <a-input-number v-model:value="ingredientForm.shelfLifeDays" :min="1" style="width: 100%" addon-after="天" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="参考单价" :rules="[{ required: true, message: '请输入单价' }]">
              <a-input-number v-model:value="ingredientForm.referencePrice" :min="0" :precision="2" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="安全库存量" :rules="[{ required: true, message: '请输入安全库存' }]">
          <a-input-number v-model:value="ingredientForm.safetyStock" :min="0" :precision="3" style="width: 100%" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="ingredientForm.remark" :rows="3" placeholder="请输入备注" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import {
  getIngredientList,
  getAllIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  getInventoryList,
  getInventoryWarnings,
  updateBatchStatus,
  Ingredient,
  InventoryItem,
  InventoryBatch,
  INGREDIENT_CATEGORY_MAP,
  UNIT_MAP,
  BATCH_STATUS_MAP,
} from '@/api/inventory'
import { getCanteenList, CanteenItem } from '@/api/canteens'

const userStore = useUserStore()

const activeTab = ref('stock')
const canteens = ref<CanteenItem[]>([])

const stockFilters = reactive({
  canteenId: '',
  category: '',
  keyword: '',
})
const stockLoading = ref(false)
const inventoryList = ref<InventoryItem[]>([])
const warnings = reactive({
  expiringBatches: [] as InventoryBatch[],
  lowStockItems: [] as any[],
})

function batchStatusColor(status: string) {
  const map: Record<string, string> = {
    normal: 'green',
    expiring_soon: 'orange',
    expired: 'red',
    damaged: 'default',
  }
  return map[status] || 'default'
}

const stockColumns = [
  { title: '食材名称', dataIndex: 'ingredientName', key: 'ingredientName', width: 200 },
  { title: '分类', key: 'category', width: 100 },
  { title: '库存信息', key: 'stockInfo', width: 240 },
  { title: '预警', key: 'warning', width: 160 },
  { title: '批次数量', dataIndex: 'batchCount', key: 'batchCount', width: 100,
    customRender: ({ record }: any) => record.batches?.length || 0
  },
]

const batchColumns = [
  { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 180 },
  { title: '剩余数量', dataIndex: 'remainingQuantity', key: 'remainingQuantity', width: 100 },
  { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 100,
    customRender: ({ text }: any) => `¥${Number(text).toFixed(2)}`
  },
  { title: '生产日期', dataIndex: 'productionDate', key: 'productionDate', width: 120,
    customRender: ({ text }: any) => text ? new Date(text).toLocaleDateString() : '-'
  },
  { title: '到期日期', dataIndex: 'expiryDate', key: 'expiryDate', width: 120,
    customRender: ({ text }: any) => text ? new Date(text).toLocaleDateString() : '-'
  },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 100 },
]

async function loadInventory() {
  stockLoading.value = true
  try {
    const params: any = {
      category: stockFilters.category || undefined,
      keyword: stockFilters.keyword || undefined,
    }
    if (stockFilters.canteenId) params.canteenId = stockFilters.canteenId
    if (userStore.userInfo?.role === 'canteen' && !params.canteenId) {
      params.canteenId = userStore.userInfo.canteenId
    }
    const [inventory, warnRes] = await Promise.all([
      getInventoryList(params),
      getInventoryWarnings(params.canteenId ? { canteenId: params.canteenId } : undefined),
    ])
    inventoryList.value = inventory
    warnings.expiringBatches = warnRes.expiringBatches || []
    warnings.lowStockItems = warnRes.lowStockItems || []
  } finally {
    stockLoading.value = false
  }
}

async function handleReportDamage(batch: InventoryBatch) {
  try {
    await updateBatchStatus((batch as any)._id, 'damaged', '系统报损')
    message.success('报损成功')
    loadInventory()
  } catch (e) {
    console.error(e)
  }
}

function handleExport() {
  message.info('导出功能开发中')
}

const ingredientFilters = reactive({
  category: '',
  keyword: '',
})
const ingredientLoading = ref(false)
const ingredientList = ref<Ingredient[]>([])
const ingredientPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const ingredientColumns = [
  { title: '食材名称', dataIndex: 'name', key: 'name', width: 180, fixed: 'left' as const },
  { title: '分类', key: 'category', width: 100 },
  { title: '单位', key: 'unit', width: 80 },
  { title: '参考单价', key: 'price', width: 140 },
  { title: '保质期', key: 'shelfLife', width: 100 },
  { title: '安全库存', dataIndex: 'safetyStock', key: 'safetyStock', width: 120 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
  { title: '操作', key: 'action', width: 150, fixed: 'right' as const },
]

const ingredientModalVisible = ref(false)
const isEditIngredient = ref(false)
const submitLoading = ref(false)
const editingIngredientId = ref('')

const defaultIngredientForm = {
  name: '',
  category: '',
  unit: '',
  shelfLifeDays: 30,
  referencePrice: 0,
  safetyStock: 0,
  remark: '',
}

const ingredientForm = reactive({ ...defaultIngredientForm })

async function loadIngredients() {
  ingredientLoading.value = true
  try {
    const res = await getIngredientList({
      page: ingredientPagination.current,
      pageSize: ingredientPagination.pageSize,
      category: ingredientFilters.category || undefined,
      keyword: ingredientFilters.keyword || undefined,
    })
    ingredientList.value = res.list
    ingredientPagination.total = res.total
  } finally {
    ingredientLoading.value = false
  }
}

function handleIngredientTableChange(pg: any) {
  ingredientPagination.current = pg.current
  ingredientPagination.pageSize = pg.pageSize
  loadIngredients()
}

function handleAddIngredient() {
  isEditIngredient.value = false
  editingIngredientId.value = ''
  Object.assign(ingredientForm, JSON.parse(JSON.stringify(defaultIngredientForm)))
  ingredientModalVisible.value = true
}

function handleEditIngredient(record: Ingredient) {
  isEditIngredient.value = true
  editingIngredientId.value = record._id
  Object.assign(ingredientForm, JSON.parse(JSON.stringify(record)))
  ingredientModalVisible.value = true
}

async function handleSubmitIngredient() {
  if (!ingredientForm.name || !ingredientForm.category || !ingredientForm.unit) {
    message.warning('请填写完整信息')
    return
  }
  submitLoading.value = true
  try {
    if (isEditIngredient.value) {
      await updateIngredient(editingIngredientId.value, ingredientForm as any)
      message.success('更新成功')
    } else {
      await createIngredient(ingredientForm as any)
      message.success('创建成功')
    }
    ingredientModalVisible.value = false
    loadIngredients()
  } finally {
    submitLoading.value = false
  }
}

async function handleDeleteIngredient(record: Ingredient) {
  try {
    await deleteIngredient(record._id)
    message.success('删除成功')
    loadIngredients()
  } catch (e) {
    console.error(e)
  }
}

watch(activeTab, (val) => {
  if (val === 'stock') loadInventory()
  else if (val === 'ingredient') loadIngredients()
})

onMounted(async () => {
  if (userStore.userInfo?.role === 'admin') {
    canteens.value = await getCanteenList()
  }
  if (userStore.userInfo?.role === 'canteen') {
    stockFilters.canteenId = userStore.userInfo.canteenId || ''
  }
  loadInventory()
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
</style>
