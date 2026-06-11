import request from "@/utils/request";

export type StockOutType = "usage" | "damage" | "expired" | "other";
export type InventoryCheckStatus = "draft" | "confirmed";

export interface StockOutItemBatch {
  batchId: string;
  batchNo: string;
  quantity: number;
}

export interface StockOutItem {
  ingredientId: any;
  quantity: number;
  unitPrice: number;
  amount: number;
  batches: StockOutItemBatch[];
}

export interface StockOut {
  _id: string;
  outNo: string;
  canteenId: any;
  type: StockOutType;
  items: StockOutItem[];
  totalAmount: number;
  receiver: string;
  purpose: string;
  createdBy: any;
  outDate: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockOutQueryParams {
  page?: number;
  pageSize?: number;
  canteenId?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}

export interface StockOutListResponse {
  total: number;
  list: StockOut[];
  page: number;
  pageSize: number;
}

export interface StockOutFormData {
  canteenId: string;
  type?: StockOutType;
  items: { ingredientId: string; quantity: number }[];
  receiver: string;
  purpose: string;
  outDate?: string;
  remark?: string;
}

export interface TransactionItem {
  type: "in" | "out";
  outType?: string;
  date: string;
  orderNo: string;
  canteenId: any;
  canteenName: string;
  ingredientId: any;
  ingredientName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  relatedParty: string;
  purpose?: string;
  remark?: string;
}

export interface CheckItem {
  ingredientId: any;
  systemQuantity: number;
  actualQuantity: number;
  difference: number;
  unitPrice: number;
  differenceAmount: number;
  reason?: string;
}

export interface InventoryCheck {
  _id: string;
  checkNo: string;
  canteenId: any;
  checkDate: string;
  checkMonth: string;
  items: CheckItem[];
  totalSystemAmount: number;
  totalActualAmount: number;
  totalDifferenceAmount: number;
  status: InventoryCheckStatus;
  createdBy: any;
  confirmedBy?: any;
  confirmedAt?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export const STOCK_OUT_TYPE_MAP: Record<string, string> = {
  usage: "领用",
  damage: "报损",
  expired: "过期",
  other: "其他",
};

export const CHECK_STATUS_MAP: Record<string, string> = {
  draft: "草稿",
  confirmed: "已确认",
};

export const TRANSACTION_TYPE_MAP: Record<string, string> = {
  in: "入库",
  out: "出库",
};

export function getStockOutList(params: StockOutQueryParams) {
  return request.get<any, StockOutListResponse>("/stock-ops/stock-out", {
    params,
  });
}

export function getStockOutDetail(id: string) {
  return request.get<any, StockOut>(`/stock-ops/stock-out/${id}`);
}

export function createStockOut(data: StockOutFormData) {
  return request.post<any, StockOut>("/stock-ops/stock-out", data);
}

export function getTransactions(params?: {
  canteenId?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}) {
  return request.get<any, TransactionItem[]>("/stock-ops/transactions", {
    params,
  });
}

export function getInventoryCheckList(params?: {
  canteenId?: string;
  checkMonth?: string;
  status?: string;
}) {
  return request.get<any, InventoryCheck[]>("/stock-ops/checks", { params });
}

export function getInventoryCheckDetail(id: string) {
  return request.get<any, InventoryCheck>(`/stock-ops/checks/${id}`);
}

export function generateCheckData(params: { canteenId?: string }) {
  return request.get<any, { items: any[] }>("/stock-ops/checks/generate/data", {
    params,
  });
}

export function createInventoryCheck(data: {
  canteenId: string;
  checkDate: string;
  items: any[];
  remark?: string;
  confirmNow?: boolean;
}) {
  return request.post<any, InventoryCheck>("/stock-ops/checks", data);
}

export function confirmInventoryCheck(id: string) {
  return request.patch<any, InventoryCheck>(`/stock-ops/checks/${id}/confirm`);
}
