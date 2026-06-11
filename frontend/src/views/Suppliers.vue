<template>
  <div class="page">
    <div class="page-header">
      <div class="filter-bar">
        <a-input
          v-model:value="filters.keyword"
          placeholder="搜索供应商名称/联系人/电话"
          style="width: 240px"
          allow-clear
          @change="loadData"
        />
        <a-select
          v-model:value="filters.category"
          placeholder="供应类别"
          style="width: 160px"
          allow-clear
          @change="loadData"
        >
          <a-select-option v-for="(label, value) in INGREDIENT_CATEGORY_MAP" :key="value" :value="value">
            {{ label }}
          </a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.status"
          placeholder="合作状态"
          style="width: 140px"
          allow-clear
          @change="loadData"
        >
          <a-select-option value="active">合作中</a-select-option>
          <a-select-option value="inactive">已停用</a-select-option>
        </a-select>
        <a-button @click="loadData">
          <SearchOutlined />
          搜索
        </a-button>
      </div>
      <a-button type="primary" @click="handleAdd">
        <PlusOutlined />
        新增供应商
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
        <template v-if="column.key === 'categories'">
          <a-tag v-for="cat in record.categories" :key="cat" color="blue" style="margin-bottom: 4px">
            {{ INGREDIENT_CATEGORY_MAP[cat] || cat }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 'active' ? 'green' : 'default'">
            {{ SUPPLIER_STATUS_MAP[record.status] }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'creditRating'">
          <a-tag :color="ratingColor(record.creditRating)">
            {{ CREDIT_RATING_MAP[record.creditRating] }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button type="link" size="small" @click="handleEdit(record)">
            编辑
          </a-button>
          <a-popconfirm title="确定停用该供应商？" @confirm="handleDelete(record)">
            <a-button type="link" size="small" danger>
              停用
            </a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑供应商' : '新增供应商'"
      width="600px"
      @ok="handleSubmit"
      @cancel="modalVisible = false"
      :confirmLoading="submitLoading"
    >
      <a-form :model="formData" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="供应商名称" :rules="[{ required: true, message: '请输入名称' }]">
              <a-input v-model:value="formData.name" placeholder="请输入供应商名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系人" :rules="[{ required: true, message: '请输入联系人' }]">
              <a-input v-model:value="formData.contactPerson" placeholder="请输入联系人姓名" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="联系电话" :rules="[{ required: true, message: '请输入电话' }]">
              <a-input v-model:value="formData.phone" placeholder="请输入联系电话" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="信用评级">
              <a-select v-model:value="formData.creditRating" style="width: 100%">
                <a-select-option v-for="(label, value) in CREDIT_RATING_MAP" :key="value" :value="value">
                  {{ label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="供应类别" :rules="[{ required: true, message: '请选择供应类别' }]">
          <a-checkbox-group v-model:value="formData.categories">
            <a-row>
              <a-col :span="8" v-for="(label, value) in INGREDIENT_CATEGORY_MAP" :key="value">
                <a-checkbox :value="value">{{ label }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item label="合作状态">
          <a-radio-group v-model:value="formData.status">
            <a-radio value="active">合作中</a-radio>
            <a-radio value="inactive">已停用</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="formData.remark" :rows="3" placeholder="请输入备注" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  getSupplierList,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  Supplier,
  INGREDIENT_CATEGORY_MAP,
  SUPPLIER_STATUS_MAP,
  CREDIT_RATING_MAP,
} from '@/api/suppliers'

const loading = ref(false)
const dataSource = ref<Supplier[]>([])
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const filters = reactive({
  keyword: '',
  category: '',
  status: '',
})

function ratingColor(rating: string) {
  const map: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'red' }
  return map[rating] || 'default'
}

const columns = [
  { title: '供应商名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' as const },
  { title: '联系人', dataIndex: 'contactPerson', key: 'contactPerson', width: 120 },
  { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '供应类别', key: 'categories', width: 260 },
  { title: '合作状态', key: 'status', width: 100 },
  { title: '信用评级', key: 'creditRating', width: 120 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
  { title: '操作', key: 'action', width: 140, fixed: 'right' as const },
]

const modalVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const editingId = ref('')

const defaultForm = {
  name: '',
  contactPerson: '',
  phone: '',
  categories: [] as string[],
  status: 'active',
  creditRating: 'B',
  remark: '',
}

const formData = reactive({ ...defaultForm })

async function loadData() {
  loading.value = true
  try {
    const res = await getSupplierList({
      page: pagination.current,
      pageSize: pagination.pageSize,
      keyword: filters.keyword || undefined,
      category: filters.category || undefined,
      status: filters.status || undefined,
    })
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

function handleAdd() {
  isEdit.value = false
  editingId.value = ''
  Object.assign(formData, JSON.parse(JSON.stringify(defaultForm)))
  modalVisible.value = true
}

function handleEdit(record: Supplier) {
  isEdit.value = true
  editingId.value = record._id
  Object.assign(formData, JSON.parse(JSON.stringify(record)))
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formData.name || !formData.contactPerson || !formData.phone || formData.categories.length === 0) {
    message.warning('请填写完整信息')
    return
  }

  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateSupplier(editingId.value, formData as any)
      message.success('更新成功')
    } else {
      await createSupplier(formData as any)
      message.success('创建成功')
    }
    modalVisible.value = false
    loadData()
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(record: Supplier) {
  try {
    await deleteSupplier(record._id)
    message.success('已停用')
    loadData()
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
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
</style>
