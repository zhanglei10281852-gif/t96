import mongoose from "mongoose";

export type InventoryBatchStatus =
  | "normal"
  | "expiring_soon"
  | "expired"
  | "damaged";

export interface IInventoryBatch extends mongoose.Document {
  canteenId: mongoose.Types.ObjectId;
  ingredientId: mongoose.Types.ObjectId;
  batchNo: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number;
  productionDate: Date;
  expiryDate: Date;
  stockInDate: Date;
  status: InventoryBatchStatus;
  supplierId?: mongoose.Types.ObjectId;
  purchaseOrderId?: mongoose.Types.ObjectId;
  remark?: string;
}

const inventoryBatchSchema = new mongoose.Schema<IInventoryBatch>(
  {
    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      required: true,
      index: true,
    },
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
      index: true,
    },
    batchNo: { type: String, required: true, unique: true },
    quantity: { type: Number, required: true, min: 0 },
    remainingQuantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    productionDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true, index: true },
    stockInDate: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ["normal", "expiring_soon", "expired", "damaged"],
      default: "normal",
      index: true,
    },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    remark: String,
  },
  { timestamps: true },
);

inventoryBatchSchema.index({ canteenId: 1, ingredientId: 1, status: 1 });
inventoryBatchSchema.index({ expiryDate: 1, status: 1 });

export const InventoryBatch = mongoose.model<IInventoryBatch>(
  "InventoryBatch",
  inventoryBatchSchema,
);
