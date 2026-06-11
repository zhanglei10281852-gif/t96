import mongoose from 'mongoose';

export type SupplierCategory = 'vegetable' | 'meat' | 'grain' | 'seasoning' | 'fruit' | 'other';
export type SupplierStatus = 'active' | 'inactive';
export type CreditRating = 'A' | 'B' | 'C' | 'D';

export interface ISupplier extends mongoose.Document {
  name: string;
  contactPerson: string;
  phone: string;
  categories: SupplierCategory[];
  status: SupplierStatus;
  creditRating: CreditRating;
  remark?: string;
}

const supplierSchema = new mongoose.Schema<ISupplier>({
  name: { type: String, required: true, unique: true },
  contactPerson: { type: String, required: true },
  phone: { type: String, required: true },
  categories: {
    type: [String],
    enum: ['vegetable', 'meat', 'grain', 'seasoning', 'fruit', 'other'],
    required: true,
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  creditRating: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'B' },
  remark: String,
}, { timestamps: true });

export const Supplier = mongoose.model<ISupplier>('Supplier', supplierSchema);
