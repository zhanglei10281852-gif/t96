import request from "@/utils/request";

export type IngredientCategory =
  | "vegetable"
  | "meat"
  | "grain"
  | "seasoning"
  | "fruit"
  | "other";
export type UnitType =
  | "kg"
  | "piece"
  | "bucket"
  | "bunch"
  | "box"
  | "bag"
  | "bottle"
  | "other";
export type InventoryBatchStatus =
  | "normal"
  | "expiring_soon"
  | "expired"
  | "damaged";

export const INGREDIENT_CATEGORY_MAP: Record<string, string> = {
  vegetable: "蔬菜",
  meat: "肉类",
  grain: "粮油",
  seasoning: "调味品",
  fruit: "水果",
  other: "其他",
};

export interface Ingredient {
  _id: string;
  name: string;
  category: IngredientCategory;
  unit: UnitType;
  shelfLifeDays: number;
  referencePrice: number;
  safetyStock: number;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientQueryParams {
  page?: number;
  pageSize?: number;
  category?: string;
  keyword?: string;
}

export interface IngredientListResponse {
  total: number;
  list: Ingredient[];
  page: number;
  pageSize: number;
}

export interface IngredientFormData {
  name: string;
  category: IngredientCategory;
  unit: UnitType;
  shelfLifeDays: number;
  referencePrice: number;
  safetyStock: number;
  remark?: string;
}

export interface InventoryBatch {
  _id: string;
  canteenId: any;
  ingredientId: any;
  batchNo: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number;
  productionDate: string;
  expiryDate: string;
  stockInDate: string;
  status: InventoryBatchStatus;
  supplierId?: any;
  purchaseOrderId?: string;
  remark?: string;
}

export interface InventoryItem {
  _id: {
    canteenId: string;
    ingredientId: string;
  };
  ingredientName: string;
  category: IngredientCategory;
  unit: UnitType;
  safetyStock: number;
  totalQuantity: number;
  totalValue: number;
  batches: InventoryBatch[];
  isLowStock: boolean;
  hasExpiringSoon: boolean;
  hasExpired: boolean;
}

export const UNIT_MAP: Record<string, string> = {
  kg: "kg",
  piece: "件",
  bucket: "桶",
  bunch: "把",
  box: "箱",
  bag: "袋",
  bottle: "瓶",
  other: "其他",
};

export const BATCH_STATUS_MAP: Record<string, string> = {
  normal: "正常",
  expiring_soon: "临期",
  expired: "已过期",
  damaged: "已报损",
};

export function getIngredientList(params: IngredientQueryParams) {
  return request.get<any, IngredientListResponse>("/inventory/ingredients", {
    params,
  });
}

export function getAllIngredients() {
  return request.get<any, Ingredient[]>("/inventory/ingredients/all");
}

export function getIngredientDetail(id: string) {
  return request.get<any, Ingredient>(`/inventory/ingredients/${id}`);
}

export function createIngredient(data: IngredientFormData) {
  return request.post<any, Ingredient>("/inventory/ingredients", data);
}

export function updateIngredient(id: string, data: IngredientFormData) {
  return request.put<any, Ingredient>(`/inventory/ingredients/${id}`, data);
}

export function deleteIngredient(id: string) {
  return request.delete<any, { message: string }>(
    `/inventory/ingredients/${id}`,
  );
}

export function getInventoryList(params?: {
  canteenId?: string;
  category?: string;
  keyword?: string;
  status?: string;
}) {
  return request.get<any, InventoryItem[]>("/inventory/inventory", { params });
}

export function getInventoryBatches(params?: {
  canteenId?: string;
  ingredientId?: string;
  status?: string;
  warningType?: string;
}) {
  return request.get<any, InventoryBatch[]>("/inventory/inventory/batches", {
    params,
  });
}

export function getInventoryWarnings(params?: { canteenId?: string }) {
  return request.get<
    any,
    { expiringBatches: InventoryBatch[]; lowStockItems: any[] }
  >("/inventory/inventory/warnings", { params });
}

export function updateBatchStatus(id: string, status: string, reason?: string) {
  return request.patch<any, InventoryBatch>(
    `/inventory/inventory/batches/${id}/status`,
    { status, reason },
  );
}
