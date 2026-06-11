export function generateNo(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${prefix}${year}${month}${day}${hours}${minutes}${seconds}${random}`;
}

export function generateBatchNo(): string {
  return generateNo("BATCH");
}

export function generatePurchaseOrderNo(): string {
  return generateNo("PO");
}

export function generateStockOutNo(): string {
  return generateNo("OUT");
}

export function generateCheckNo(): string {
  return generateNo("CK");
}

export function getMonthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export const INGREDIENT_CATEGORY_MAP: Record<string, string> = {
  vegetable: "蔬菜",
  meat: "肉类",
  grain: "粮油",
  seasoning: "调味品",
  fruit: "水果",
  other: "其他",
};

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

export const SUPPLIER_STATUS_MAP: Record<string, string> = {
  active: "合作中",
  inactive: "已停用",
};

export const PURCHASE_STATUS_MAP: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  approved: "已审批",
  rejected: "已驳回",
  stocked_in: "已入库",
};

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

export const BATCH_STATUS_MAP: Record<string, string> = {
  normal: "正常",
  expiring_soon: "临期",
  expired: "已过期",
  damaged: "已报损",
};
