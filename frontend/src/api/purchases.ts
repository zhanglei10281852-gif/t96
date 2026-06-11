import request from "@/utils/request";

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "stocked_in";

export interface PurchaseItem {
  ingredientId: any;
  quantity: number;
  unitPrice: number;
  amount: number;
  acceptedQuantity?: number;
  difference?: number;
  differenceReason?: string;
}

export interface PurchaseOrder {
  _id: string;
  orderNo: string;
  canteenId: any;
  supplierId: any;
  purchaseDate: string;
  items: PurchaseItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  needApproval: boolean;
  createdBy: any;
  submittedBy?: any;
  submittedAt?: string;
  approvedBy?: any;
  approvedAt?: string;
  rejectedBy?: any;
  rejectedAt?: string;
  rejectReason?: string;
  stockedInBy?: any;
  stockedInAt?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderQueryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  canteenId?: string;
  startDate?: string;
  endDate?: string;
}

export interface PurchaseOrderListResponse {
  total: number;
  list: PurchaseOrder[];
  page: number;
  pageSize: number;
}

export interface PurchaseOrderFormData {
  canteenId: string;
  supplierId: string;
  purchaseDate: string;
  items: {
    ingredientId: string;
    quantity: number;
    unitPrice: number;
  }[];
  remark?: string;
}

export interface StockInData {
  items: { acceptedQuantity: number; differenceReason?: string }[];
  productionDates: (string | null)[];
}

export const PURCHASE_STATUS_MAP: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  approved: "已审批",
  rejected: "已驳回",
  stocked_in: "已入库",
};

export const PURCHASE_STATUS_COLOR: Record<string, string> = {
  draft: "default",
  submitted: "processing",
  approved: "blue",
  rejected: "red",
  stocked_in: "green",
};

export function getPurchaseList(params: PurchaseOrderQueryParams) {
  return request.get<any, PurchaseOrderListResponse>("/purchases", { params });
}

export function getPurchaseDetail(id: string) {
  return request.get<any, PurchaseOrder>(`/purchases/${id}`);
}

export function createPurchaseOrder(data: PurchaseOrderFormData) {
  return request.post<any, PurchaseOrder>("/purchases", data);
}

export function updatePurchaseOrder(id: string, data: PurchaseOrderFormData) {
  return request.put<any, PurchaseOrder>(`/purchases/${id}`, data);
}

export function submitPurchaseOrder(id: string) {
  return request.patch<any, PurchaseOrder>(`/purchases/${id}/submit`);
}

export function approvePurchaseOrder(id: string) {
  return request.patch<any, PurchaseOrder>(`/purchases/${id}/approve`);
}

export function rejectPurchaseOrder(id: string, reason?: string) {
  return request.patch<any, PurchaseOrder>(`/purchases/${id}/reject`, {
    reason,
  });
}

export function stockInPurchaseOrder(id: string, data: StockInData) {
  return request.post<any, PurchaseOrder>(`/purchases/${id}/stock-in`, data);
}

export function deletePurchaseOrder(id: string) {
  return request.delete<any, { message: string }>(`/purchases/${id}`);
}
