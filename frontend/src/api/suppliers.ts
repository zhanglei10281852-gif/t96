import request from "@/utils/request";

export type SupplierCategory =
  | "vegetable"
  | "meat"
  | "grain"
  | "seasoning"
  | "fruit"
  | "other";
export type SupplierStatus = "active" | "inactive";
export type CreditRating = "A" | "B" | "C" | "D";

export interface Supplier {
  _id: string;
  name: string;
  contactPerson: string;
  phone: string;
  categories: SupplierCategory[];
  status: SupplierStatus;
  creditRating: CreditRating;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierQueryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  category?: string;
  keyword?: string;
}

export interface SupplierListResponse {
  total: number;
  list: Supplier[];
  page: number;
  pageSize: number;
}

export interface SupplierFormData {
  name: string;
  contactPerson: string;
  phone: string;
  categories: SupplierCategory[];
  status?: SupplierStatus;
  creditRating?: CreditRating;
  remark?: string;
}

export const INGREDIENT_CATEGORY_MAP: Record<string, string> = {
  vegetable: "蔬菜",
  meat: "肉类",
  grain: "粮油",
  seasoning: "调味品",
  fruit: "水果",
  other: "其他",
};

export const SUPPLIER_STATUS_MAP: Record<string, string> = {
  active: "合作中",
  inactive: "已停用",
};

export const CREDIT_RATING_MAP: Record<string, string> = {
  A: "优秀(A)",
  B: "良好(B)",
  C: "一般(C)",
  D: "较差(D)",
};

export function getSupplierList(params: SupplierQueryParams) {
  return request.get<any, SupplierListResponse>("/suppliers", { params });
}

export function getAllSuppliers() {
  return request.get<any, Supplier[]>("/suppliers/all");
}

export function getSupplierDetail(id: string) {
  return request.get<any, Supplier>(`/suppliers/${id}`);
}

export function createSupplier(data: SupplierFormData) {
  return request.post<any, Supplier>("/suppliers", data);
}

export function updateSupplier(id: string, data: SupplierFormData) {
  return request.put<any, Supplier>(`/suppliers/${id}`, data);
}

export function deleteSupplier(id: string) {
  return request.delete<any, { message: string }>(`/suppliers/${id}`);
}
