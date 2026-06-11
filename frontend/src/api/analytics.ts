import request from "@/utils/request";

export interface CanteenCostItem {
  canteenId: string;
  canteenName: string;
  totalCost: number;
  totalRevenue: number;
  costRate: number;
  isHighCostRate: boolean;
}

export interface CostByCanteenResponse {
  list: CanteenCostItem[];
  summary: {
    totalCost: number;
    totalRevenue: number;
    overallCostRate: number;
    highCostCount: number;
  };
}

export interface TrendItem {
  month: string;
  purchaseAmount: number;
  costAmount: number;
  revenueAmount: number;
}

export interface CategoryStatItem {
  category: string;
  categoryName: string;
  totalAmount: number;
  totalQuantity: number;
  percentage: number;
}

export interface CategoryStatsResponse {
  list: CategoryStatItem[];
  totalAmount: number;
}

export interface ExpiringWarningItem {
  _id: string;
  batchNo: string;
  canteenId: string;
  canteenName: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  productionDate: string;
  expiryDate: string;
  daysLeft: number;
  status: string;
  supplierName: string;
}

export interface ExpiringWarningResponse {
  list: ExpiringWarningItem[];
  summary: {
    total: number;
    expiredCount: number;
    expiringSoonCount: number;
    totalValue: number;
  };
}

export interface TopCostIngredientItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  category: string;
  categoryName: string;
  totalQuantity: number;
  totalAmount: number;
}

export function getCostByCanteen(params?: {
  startDate?: string;
  endDate?: string;
}) {
  return request.get<any, CostByCanteenResponse>("/analytics/cost-by-canteen", {
    params,
  });
}

export function getPurchaseTrend(params?: {
  months?: number;
  canteenId?: string;
}) {
  return request.get<any, TrendItem[]>("/analytics/purchase-trend", { params });
}

export function getPurchaseCategoryStats(params?: {
  startDate?: string;
  endDate?: string;
  canteenId?: string;
}) {
  return request.get<any, CategoryStatsResponse>(
    "/analytics/purchase-category-stats",
    { params },
  );
}

export function getExpiringWarning(params?: { canteenId?: string }) {
  return request.get<any, ExpiringWarningResponse>(
    "/analytics/expiring-warning",
    { params },
  );
}

export function getTopCostIngredients(params?: {
  startDate?: string;
  endDate?: string;
  canteenId?: string;
  limit?: number;
}) {
  return request.get<any, TopCostIngredientItem[]>(
    "/analytics/top-cost-ingredients",
    { params },
  );
}
