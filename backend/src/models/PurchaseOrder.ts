import mongoose from "mongoose";

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "stocked_in";

export interface IPurchaseItem {
  ingredientId: mongoose.Types.ObjectId;
  ingredientName?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  acceptedQuantity?: number;
  difference?: number;
  differenceReason?: string;
}

export interface IPurchaseOrder extends mongoose.Document {
  orderNo: string;
  canteenId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  purchaseDate: Date;
  items: IPurchaseItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  needApproval: boolean;
  createdBy: mongoose.Types.ObjectId;
  submittedBy?: mongoose.Types.ObjectId;
  submittedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  rejectReason?: string;
  stockedInBy?: mongoose.Types.ObjectId;
  stockedInAt?: Date;
  remark?: string;
}

const purchaseItemSchema = new mongoose.Schema<IPurchaseItem>(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    acceptedQuantity: { type: Number, min: 0 },
    difference: Number,
    differenceReason: String,
  },
  { _id: false },
);

const purchaseOrderSchema = new mongoose.Schema<IPurchaseOrder>(
  {
    orderNo: { type: String, required: true, unique: true },
    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      required: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    purchaseDate: { type: Date, required: true },
    items: [purchaseItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected", "stocked_in"],
      default: "draft",
      index: true,
    },
    needApproval: { type: Boolean, required: true, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: Date,
    rejectReason: String,
    stockedInBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stockedInAt: Date,
    remark: String,
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ canteenId: 1, status: 1, purchaseDate: -1 });

export const PurchaseOrder = mongoose.model<IPurchaseOrder>(
  "PurchaseOrder",
  purchaseOrderSchema,
);
