import mongoose from "mongoose";

export type IngredientCategory =
  | "vegetable"
  | "meat"
  | "grain"
  | "seasoning"
  | "fruit"
  | "other";
export type UnitType =
  | "kg"
  | "piece"
  | "bucket"
  | "bunch"
  | "box"
  | "bag"
  | "bottle"
  | "other";

export interface IIngredient extends mongoose.Document {
  name: string;
  category: IngredientCategory;
  unit: UnitType;
  shelfLifeDays: number;
  referencePrice: number;
  safetyStock: number;
  remark?: string;
}

const ingredientSchema = new mongoose.Schema<IIngredient>(
  {
    name: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: ["vegetable", "meat", "grain", "seasoning", "fruit", "other"],
      required: true,
    },
    unit: {
      type: String,
      enum: ["kg", "piece", "bucket", "bunch", "box", "bag", "bottle", "other"],
      required: true,
    },
    shelfLifeDays: { type: Number, required: true, min: 1 },
    referencePrice: { type: Number, required: true, min: 0 },
    safetyStock: { type: Number, required: true, min: 0, default: 0 },
    remark: String,
  },
  { timestamps: true },
);

export const Ingredient = mongoose.model<IIngredient>(
  "Ingredient",
  ingredientSchema,
);
