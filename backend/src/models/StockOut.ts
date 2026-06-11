import mongoose from "mongoose";

export type StockOutType = "usage" | "damage" | "expired" | "other";

export interface IStockOutItem {
  ingredientId: mongoose.Types.ObjectId;
  ingredientName?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  batches: {
    batchId: mongoose.Types.ObjectId;
    batchNo: string;
    quantity: number;
  }[];
}

export interface IStockOut extends mongoose.Document {
  outNo: string;
  canteenId: mongoose.Types.ObjectId;
  type: StockOutType;
  items: IStockOutItem[];
  totalAmount: number;
  receiver: string;
  purpose: string;
  createdBy: mongoose.Types.ObjectId;
  outDate: Date;
  remark?: string;
}

const stockOutItemBatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryBatch",
      required: true,
    },
    batchNo: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const stockOutItemSchema = new mongoose.Schema<IStockOutItem>(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    batches: [stockOutItemBatchSchema],
  },
  { _id: false },
);

const stockOutSchema = new mongoose.Schema<IStockOut>(
  {
    outNo: { type: String, required: true, unique: true },
    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["usage", "damage", "expired", "other"],
      default: "usage",
      required: true,
    },
    items: [stockOutItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    receiver: { type: String, required: true },
    purpose: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    outDate: { type: Date, required: true, default: Date.now, index: true },
    remark: String,
  },
  { timestamps: true },
);

stockOutSchema.index({ canteenId: 1, outDate: -1 });

export const StockOut = mongoose.model<IStockOut>("StockOut", stockOutSchema);
