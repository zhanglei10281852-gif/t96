import mongoose from "mongoose";

export type InventoryCheckStatus = "draft" | "confirmed";

export interface ICheckItem {
  ingredientId: mongoose.Types.ObjectId;
  ingredientName?: string;
  unit?: string;
  systemQuantity: number;
  actualQuantity: number;
  difference: number;
  unitPrice: number;
  differenceAmount: number;
  reason?: string;
}

export interface IInventoryCheck extends mongoose.Document {
  checkNo: string;
  canteenId: mongoose.Types.ObjectId;
  checkDate: Date;
  checkMonth: string;
  items: ICheckItem[];
  totalSystemAmount: number;
  totalActualAmount: number;
  totalDifferenceAmount: number;
  status: InventoryCheckStatus;
  createdBy: mongoose.Types.ObjectId;
  confirmedBy?: mongoose.Types.ObjectId;
  confirmedAt?: Date;
  remark?: string;
}

const checkItemSchema = new mongoose.Schema<ICheckItem>(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    systemQuantity: { type: Number, required: true, min: 0 },
    actualQuantity: { type: Number, required: true, min: 0 },
    difference: { type: Number, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    differenceAmount: { type: Number, required: true },
    reason: String,
  },
  { _id: false },
);

const inventoryCheckSchema = new mongoose.Schema<IInventoryCheck>(
  {
    checkNo: { type: String, required: true, unique: true },
    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      required: true,
      index: true,
    },
    checkDate: { type: Date, required: true },
    checkMonth: { type: String, required: true, index: true },
    items: [checkItemSchema],
    totalSystemAmount: { type: Number, required: true, min: 0, default: 0 },
    totalActualAmount: { type: Number, required: true, min: 0, default: 0 },
    totalDifferenceAmount: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["draft", "confirmed"],
      default: "draft",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmedAt: Date,
    remark: String,
  },
  { timestamps: true },
);

inventoryCheckSchema.index({ canteenId: 1, checkMonth: 1 }, { unique: true });

export const InventoryCheck = mongoose.model<IInventoryCheck>(
  "InventoryCheck",
  inventoryCheckSchema,
);
