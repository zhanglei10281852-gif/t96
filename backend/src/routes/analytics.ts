import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import dayjs from "dayjs";
import { StockOut } from "../models/StockOut";
import { Order } from "../models/Order";
import { PurchaseOrder } from "../models/PurchaseOrder";
import { InventoryBatch } from "../models/InventoryBatch";
import { Ingredient } from "../models/Ingredient";
import { Canteen } from "../models/Canteen";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

const COST_RATE_THRESHOLD = 0.45;

router.get("/cost-by-canteen", async (req: Request, res: Response) => {
  try {
    const { startDate = "", endDate = "" } = req.query;

    const dateQuery: any = {};
    if (startDate || endDate) {
      if (startDate) dateQuery.$gte = new Date(startDate as string);
      if (endDate)
        dateQuery.$lt = dayjs(endDate as string)
          .add(1, "day")
          .toDate();
    }

    let canteenQuery: any = {};
    if (req.user?.role === "canteen" && req.user.canteenId) {
      canteenQuery._id = req.user.canteenId;
    }

    const canteens = await Canteen.find(canteenQuery, "name");
    const canteenIds = canteens.map((c) => c._id);

    const outMatch: any = { type: "usage" };
    if (Object.keys(dateQuery).length > 0) outMatch.outDate = dateQuery;
    if (canteenIds.length > 0) outMatch.canteenId = { $in: canteenIds };

    const costByCanteen = await StockOut.aggregate([
      { $match: outMatch },
      {
        $group: {
          _id: "$canteenId",
          totalCost: { $sum: "$totalAmount" },
        },
      },
    ]);

    const orderMatch: any = {
      status: {
        $in: ["completed", "confirmed", "preparing", "ready", "ordered"],
      },
    };
    if (Object.keys(dateQuery).length > 0) orderMatch.mealDate = dateQuery;
    if (canteenIds.length > 0) orderMatch.canteenId = { $in: canteenIds };

    const revenueByCanteen = await Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: "$canteenId",
          totalRevenue: { $sum: "$mealPrice" },
        },
      },
    ]);

    const costMap = new Map(
      costByCanteen.map((c) => [c._id.toString(), c.totalCost]),
    );
    const revenueMap = new Map(
      revenueByCanteen.map((r) => [r._id.toString(), r.totalRevenue]),
    );

    const results = canteens.map((canteen) => {
      const canteenId = canteen._id.toString();
      const totalCost = costMap.get(canteenId) || 0;
      const totalRevenue = revenueMap.get(canteenId) || 0;
      const costRate = totalRevenue > 0 ? totalCost / totalRevenue : 0;

      return {
        canteenId,
        canteenName: canteen.name,
        totalCost: Math.round(totalCost * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        costRate: Math.round(costRate * 10000) / 100,
        isHighCostRate: costRate > COST_RATE_THRESHOLD,
      };
    });

    const summary = results.reduce(
      (acc, item) => {
        acc.totalCost += item.totalCost;
        acc.totalRevenue += item.totalRevenue;
        acc.highCostCount += item.isHighCostRate ? 1 : 0;
        return acc;
      },
      { totalCost: 0, totalRevenue: 0, highCostCount: 0 },
    );

    res.json({
      list: results,
      summary: {
        ...summary,
        overallCostRate:
          summary.totalRevenue > 0
            ? Math.round((summary.totalCost / summary.totalRevenue) * 10000) /
              100
            : 0,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取成本统计失败" });
  }
});

router.get("/purchase-trend", async (req: Request, res: Response) => {
  try {
    const { months = "6", canteenId = "" } = req.query;
    const monthCount = parseInt(months as string, 10) || 6;

    const dateRanges: { start: Date; end: Date; label: string }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const start = dayjs().subtract(i, "month").startOf("month").toDate();
      const end = dayjs()
        .subtract(i, "month")
        .endOf("month")
        .add(1, "day")
        .toDate();
      const label = dayjs().subtract(i, "month").format("YYYY-MM");
      dateRanges.push({ start, end, label });
    }

    let purchaseQueryBase: any = {
      status: { $in: ["approved", "stocked_in"] },
    };
    if (req.user?.role === "canteen") {
      purchaseQueryBase.canteenId = req.user.canteenId;
    } else if (canteenId) {
      purchaseQueryBase.canteenId = new mongoose.Types.ObjectId(
        canteenId as string,
      );
    }

    const trendData = await Promise.all(
      dateRanges.map(async ({ start, end, label }) => {
        const purchaseQuery = {
          ...purchaseQueryBase,
          purchaseDate: { $gte: start, $lt: end },
        };
        const purchaseResult = await PurchaseOrder.aggregate([
          { $match: purchaseQuery },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);

        const outQuery: any = {
          type: "usage",
          outDate: { $gte: start, $lt: end },
        };
        if (purchaseQueryBase.canteenId)
          outQuery.canteenId = purchaseQueryBase.canteenId;
        const outResult = await StockOut.aggregate([
          { $match: outQuery },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);

        const orderQuery: any = {
          status: {
            $in: ["completed", "confirmed", "preparing", "ready", "ordered"],
          },
          mealDate: { $gte: start, $lt: end },
        };
        if (purchaseQueryBase.canteenId)
          orderQuery.canteenId = purchaseQueryBase.canteenId;
        const orderResult = await Order.aggregate([
          { $match: orderQuery },
          { $group: { _id: null, total: { $sum: "$mealPrice" } } },
        ]);

        return {
          month: label,
          purchaseAmount:
            Math.round((purchaseResult[0]?.total || 0) * 100) / 100,
          costAmount: Math.round((outResult[0]?.total || 0) * 100) / 100,
          revenueAmount: Math.round((orderResult[0]?.total || 0) * 100) / 100,
        };
      }),
    );

    res.json(trendData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取趋势数据失败" });
  }
});

router.get("/purchase-category-stats", async (req: Request, res: Response) => {
  try {
    const { startDate = "", endDate = "", canteenId = "" } = req.query;

    const purchaseMatch: any = { status: { $in: ["approved", "stocked_in"] } };
    if (req.user?.role === "canteen") {
      purchaseMatch.canteenId = req.user.canteenId;
    } else if (canteenId) {
      purchaseMatch.canteenId = new mongoose.Types.ObjectId(
        canteenId as string,
      );
    }
    if (startDate || endDate) {
      purchaseMatch.purchaseDate = {};
      if (startDate)
        purchaseMatch.purchaseDate.$gte = new Date(startDate as string);
      if (endDate) {
        purchaseMatch.purchaseDate.$lt = dayjs(endDate as string)
          .add(1, "day")
          .toDate();
      }
    }

    const result = await PurchaseOrder.aggregate([
      { $match: purchaseMatch },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "ingredients",
          localField: "items.ingredientId",
          foreignField: "_id",
          as: "ingredient",
        },
      },
      { $unwind: "$ingredient" },
      {
        $group: {
          _id: "$ingredient.category",
          totalAmount: {
            $sum: {
              $multiply: [
                { $ifNull: ["$items.acceptedQuantity", "$items.quantity"] },
                "$items.unitPrice",
              ],
            },
          },
          totalQuantity: {
            $sum: { $ifNull: ["$items.acceptedQuantity", "$items.quantity"] },
          },
        },
      },
      {
        $project: {
          category: "$_id",
          totalAmount: { $round: ["$totalAmount", 2] },
          totalQuantity: 1,
          _id: 0,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const categoryMap: Record<string, string> = {
      vegetable: "蔬菜",
      meat: "肉类",
      grain: "粮油",
      seasoning: "调味品",
      fruit: "水果",
      other: "其他",
    };

    const totalAll = result.reduce(
      (sum, item) => sum + (item.totalAmount || 0),
      0,
    );

    const stats = result.map((item) => ({
      ...item,
      categoryName: categoryMap[item.category] || item.category,
      percentage:
        totalAll > 0
          ? Math.round((item.totalAmount / totalAll) * 10000) / 100
          : 0,
    }));

    res.json({
      list: stats,
      totalAmount: Math.round(totalAll * 100) / 100,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取分类统计失败" });
  }
});

router.get("/expiring-warning", async (req: Request, res: Response) => {
  try {
    let canteenId = (req.query.canteenId as string) || "";
    if (req.user?.role === "canteen") {
      canteenId = req.user.canteenId?.toString() || "";
    }

    const matchQuery: any = {
      remainingQuantity: { $gt: 0 },
      status: { $in: ["expiring_soon", "expired"] },
    };
    if (canteenId)
      matchQuery.canteenId = new mongoose.Types.ObjectId(canteenId);

    const batches = await InventoryBatch.find(matchQuery)
      .populate("canteenId", "name")
      .populate("ingredientId", "name unit category")
      .populate("supplierId", "name")
      .sort({ expiryDate: 1 });

    const now = new Date();
    const result = batches.map((batch) => {
      const daysLeft = Math.ceil(
        (new Date(batch.expiryDate).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        _id: batch._id,
        batchNo: batch.batchNo,
        canteenId: batch.canteenId,
        canteenName: (batch.canteenId as any)?.name,
        ingredientId: batch.ingredientId,
        ingredientName: (batch.ingredientId as any)?.name,
        unit: (batch.ingredientId as any)?.unit,
        category: (batch.ingredientId as any)?.category,
        quantity: batch.remainingQuantity,
        unitPrice: batch.unitPrice,
        totalValue:
          Math.round(batch.remainingQuantity * batch.unitPrice * 100) / 100,
        productionDate: batch.productionDate,
        expiryDate: batch.expiryDate,
        daysLeft,
        status: batch.status,
        supplierName: (batch.supplierId as any)?.name,
      };
    });

    const expiredCount = result.filter((r) => r.status === "expired").length;
    const expiringSoonCount = result.filter(
      (r) => r.status === "expiring_soon",
    ).length;
    const totalValue = result.reduce((sum, r) => sum + r.totalValue, 0);

    res.json({
      list: result,
      summary: {
        total: result.length,
        expiredCount,
        expiringSoonCount,
        totalValue: Math.round(totalValue * 100) / 100,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取临期预警失败" });
  }
});

router.get("/top-cost-ingredients", async (req: Request, res: Response) => {
  try {
    const {
      startDate = "",
      endDate = "",
      canteenId = "",
      limit = "10",
    } = req.query;

    const matchQuery: any = { type: "usage" };
    if (req.user?.role === "canteen") {
      matchQuery.canteenId = req.user.canteenId;
    } else if (canteenId) {
      matchQuery.canteenId = new mongoose.Types.ObjectId(canteenId as string);
    }
    if (startDate || endDate) {
      matchQuery.outDate = {};
      if (startDate) matchQuery.outDate.$gte = new Date(startDate as string);
      if (endDate)
        matchQuery.outDate.$lt = dayjs(endDate as string)
          .add(1, "day")
          .toDate();
    }

    const limitNum = parseInt(limit as string, 10) || 10;

    const result = await StockOut.aggregate([
      { $match: matchQuery },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "ingredients",
          localField: "items.ingredientId",
          foreignField: "_id",
          as: "ingredient",
        },
      },
      { $unwind: "$ingredient" },
      {
        $group: {
          _id: "$items.ingredientId",
          ingredientName: { $first: "$ingredient.name" },
          unit: { $first: "$ingredient.unit" },
          category: { $first: "$ingredient.category" },
          totalQuantity: { $sum: "$items.quantity" },
          totalAmount: { $sum: "$items.amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: limitNum },
      {
        $project: {
          ingredientId: "$_id",
          ingredientName: 1,
          unit: 1,
          category: 1,
          totalQuantity: 1,
          totalAmount: { $round: ["$totalAmount", 2] },
          _id: 0,
        },
      },
    ]);

    const categoryMap: Record<string, string> = {
      vegetable: "蔬菜",
      meat: "肉类",
      grain: "粮油",
      seasoning: "调味品",
      fruit: "水果",
      other: "其他",
    };

    const stats = result.map((item) => ({
      ...item,
      categoryName: categoryMap[item.category] || item.category,
    }));

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取食材成本排行失败" });
  }
});

export default router;
