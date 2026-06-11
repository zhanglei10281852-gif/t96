import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import dayjs from "dayjs";
import { StockOut, StockOutType } from "../models/StockOut";
import { InventoryBatch } from "../models/InventoryBatch";
import { Ingredient } from "../models/Ingredient";
import { InventoryCheck } from "../models/InventoryCheck";
import { PurchaseOrder } from "../models/PurchaseOrder";
import { authMiddleware, requireRoles } from "../middleware/auth";
import {
  generateStockOutNo,
  generateCheckNo,
  getMonthKey,
} from "../utils/inventory";

const router = Router();

router.use(authMiddleware);

// ==================== 出库（领用） ====================

router.get("/stock-out", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      pageSize = "10",
      canteenId = "",
      startDate = "",
      endDate = "",
      type = "",
    } = req.query;

    const query: any = {};

    if (req.user?.role === "canteen") {
      query.canteenId = req.user.canteenId;
    } else if (canteenId) {
      query.canteenId = canteenId;
    }

    if (type) query.type = type;

    if (startDate || endDate) {
      query.outDate = {};
      if (startDate) query.outDate.$gte = new Date(startDate as string);
      if (endDate) {
        const end = dayjs(endDate as string)
          .add(1, "day")
          .toDate();
        query.outDate.$lt = end;
      }
    }

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      StockOut.countDocuments(query),
      StockOut.find(query)
        .populate("canteenId", "name")
        .populate("items.ingredientId", "name unit")
        .populate("createdBy", "name")
        .skip(skip)
        .limit(size)
        .sort({ outDate: -1, createdAt: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取出库列表失败" });
  }
});

router.get("/stock-out/:id", async (req: Request, res: Response) => {
  try {
    const stockOut = await StockOut.findById(req.params.id)
      .populate("canteenId", "name")
      .populate("items.ingredientId", "name unit")
      .populate("createdBy", "name");

    if (!stockOut) {
      return res.status(404).json({ message: "出库单不存在" });
    }

    if (
      req.user?.role === "canteen" &&
      stockOut.canteenId.toString() !== req.user.canteenId?.toString()
    ) {
      return res.status(403).json({ message: "无权查看此出库单" });
    }

    res.json(stockOut);
  } catch (error) {
    res.status(500).json({ message: "获取出库单详情失败" });
  }
});

router.post(
  "/stock-out",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        canteenId,
        type = "usage",
        items,
        receiver,
        purpose,
        outDate,
        remark,
      } = req.body;

      if (!canteenId || !items || items.length === 0 || !receiver || !purpose) {
        await session.abortTransaction();
        return res.status(400).json({ message: "请填写完整的出库信息" });
      }

      if (
        req.user?.role === "canteen" &&
        canteenId !== req.user.canteenId?.toString()
      ) {
        await session.abortTransaction();
        return res.status(403).json({ message: "只能为本助餐点创建出库单" });
      }

      const processedItems: any[] = [];
      let totalAmount = 0;

      for (const item of items) {
        const { ingredientId, quantity } = item;

        if (!ingredientId || !quantity || quantity <= 0) continue;

        const batches = await InventoryBatch.find({
          canteenId,
          ingredientId,
          remainingQuantity: { $gt: 0 },
          status: { $ne: "expired" },
        })
          .sort({ expiryDate: 1, stockInDate: 1 })
          .session(session);

        const totalAvailable = batches.reduce(
          (sum, b) => sum + b.remainingQuantity,
          0,
        );
        if (totalAvailable < quantity) {
          const ingredient = await Ingredient.findById(ingredientId);
          await session.abortTransaction();
          return res.status(400).json({
            message: `${ingredient?.name || "食材"}库存不足，当前可用${totalAvailable}，需要${quantity}`,
          });
        }

        let remaining = quantity;
        let weightedPrice = 0;
        let totalQty = 0;
        const batchUsages: any[] = [];

        for (const batch of batches) {
          if (remaining <= 0) break;
          const useQty = Math.min(batch.remainingQuantity, remaining);
          batch.remainingQuantity -= useQty;
          await batch.save({ session });

          weightedPrice += useQty * batch.unitPrice;
          totalQty += useQty;
          batchUsages.push({
            batchId: batch._id,
            batchNo: batch.batchNo,
            quantity: useQty,
          });

          remaining -= useQty;
        }

        const unitPrice = totalQty > 0 ? weightedPrice / totalQty : 0;
        const amount = weightedPrice;
        totalAmount += amount;

        processedItems.push({
          ingredientId,
          quantity,
          unitPrice,
          amount,
          batches: batchUsages,
        });
      }

      if (processedItems.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({ message: "没有有效的出库项" });
      }

      const outNo = generateStockOutNo();
      const stockOut = new StockOut({
        outNo,
        canteenId,
        type: type as StockOutType,
        items: processedItems,
        totalAmount,
        receiver,
        purpose,
        createdBy: req.user?._id,
        outDate: outDate ? new Date(outDate) : new Date(),
        remark,
      });

      await stockOut.save({ session });
      await session.commitTransaction();

      await stockOut.populate("canteenId", "name");
      await stockOut.populate("items.ingredientId", "name unit");

      res.status(201).json(stockOut);
    } catch (error: any) {
      await session.abortTransaction();
      console.error(error);
      res.status(500).json({ message: error.message || "出库失败" });
    } finally {
      session.endSession();
    }
  },
);

// ==================== 库存流水（入库+出库） ====================

router.get("/transactions", async (req: Request, res: Response) => {
  try {
    let canteenId = (req.query.canteenId as string) || "";
    if (req.user?.role === "canteen") {
      canteenId = req.user.canteenId?.toString() || "";
    }

    const { startDate = "", endDate = "", type = "" } = req.query;

    const dateQuery: any = {};
    if (startDate || endDate) {
      if (startDate) {
        dateQuery.$gte = new Date(startDate as string);
      }
      if (endDate) {
        dateQuery.$lt = dayjs(endDate as string)
          .add(1, "day")
          .toDate();
      }
    }

    const transactions: any[] = [];

    if (!type || type === "in") {
      const purchaseQuery: any = { status: "stocked_in" };
      if (canteenId) purchaseQuery.canteenId = canteenId;
      if (Object.keys(dateQuery).length > 0)
        purchaseQuery.stockedInAt = dateQuery;

      const stockedOrders = await PurchaseOrder.find(purchaseQuery)
        .populate("canteenId", "name")
        .populate("supplierId", "name")
        .populate("items.ingredientId", "name unit")
        .sort({ stockedInAt: -1 });

      stockedOrders.forEach((order) => {
        order.items.forEach((item) => {
          const qty = (item as any).acceptedQuantity ?? item.quantity;
          if (qty > 0) {
            transactions.push({
              type: "in",
              date: order.stockedInAt,
              orderNo: order.orderNo,
              canteenId: order.canteenId,
              canteenName: (order.canteenId as any)?.name,
              ingredientId: item.ingredientId,
              ingredientName: (item.ingredientId as any)?.name,
              unit: (item.ingredientId as any)?.unit,
              quantity: qty,
              unitPrice: item.unitPrice,
              amount: qty * item.unitPrice,
              relatedParty: (order.supplierId as any)?.name,
              remark: order.remark,
            });
          }
        });
      });
    }

    if (!type || type === "out") {
      const outQuery: any = {};
      if (canteenId) outQuery.canteenId = canteenId;
      if (Object.keys(dateQuery).length > 0) outQuery.outDate = dateQuery;

      const stockOuts = await StockOut.find(outQuery)
        .populate("canteenId", "name")
        .populate("items.ingredientId", "name unit")
        .sort({ outDate: -1 });

      stockOuts.forEach((out) => {
        out.items.forEach((item) => {
          transactions.push({
            type: "out",
            outType: out.type,
            date: out.outDate,
            orderNo: out.outNo,
            canteenId: out.canteenId,
            canteenName: (out.canteenId as any)?.name,
            ingredientId: item.ingredientId,
            ingredientName: (item.ingredientId as any)?.name,
            unit: (item.ingredientId as any)?.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            relatedParty: out.receiver,
            purpose: out.purpose,
            remark: out.remark,
          });
        });
      });
    }

    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取流水失败" });
  }
});

// ==================== 盘点管理 ====================

router.get("/checks", async (req: Request, res: Response) => {
  try {
    let canteenId = (req.query.canteenId as string) || "";
    if (req.user?.role === "canteen") {
      canteenId = req.user.canteenId?.toString() || "";
    }

    const { checkMonth = "", status = "" } = req.query;

    const query: any = {};
    if (canteenId) query.canteenId = canteenId;
    if (checkMonth) query.checkMonth = checkMonth;
    if (status) query.status = status;

    const list = await InventoryCheck.find(query)
      .populate("canteenId", "name")
      .populate("items.ingredientId", "name unit")
      .populate("createdBy", "name")
      .populate("confirmedBy", "name")
      .sort({ checkDate: -1 });

    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取盘点列表失败" });
  }
});

router.get("/checks/:id", async (req: Request, res: Response) => {
  try {
    const check = await InventoryCheck.findById(req.params.id)
      .populate("canteenId", "name")
      .populate("items.ingredientId", "name unit")
      .populate("createdBy", "name")
      .populate("confirmedBy", "name");

    if (!check) {
      return res.status(404).json({ message: "盘点单不存在" });
    }

    if (
      req.user?.role === "canteen" &&
      check.canteenId.toString() !== req.user.canteenId?.toString()
    ) {
      return res.status(403).json({ message: "无权查看此盘点单" });
    }

    res.json(check);
  } catch (error) {
    res.status(500).json({ message: "获取盘点单详情失败" });
  }
});

router.get("/checks/generate/data", async (req: Request, res: Response) => {
  try {
    let canteenId = (req.query.canteenId as string) || "";
    if (req.user?.role === "canteen") {
      canteenId = req.user.canteenId?.toString() || "";
    }

    if (!canteenId) {
      return res.status(400).json({ message: "请选择助餐点" });
    }

    const aggregatePipeline: any[] = [
      {
        $match: {
          canteenId: new mongoose.Types.ObjectId(canteenId),
          remainingQuantity: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$ingredientId",
          systemQuantity: { $sum: "$remainingQuantity" },
          totalValue: {
            $sum: { $multiply: ["$remainingQuantity", "$unitPrice"] },
          },
        },
      },
      {
        $lookup: {
          from: "ingredients",
          localField: "_id",
          foreignField: "_id",
          as: "ingredient",
        },
      },
      { $unwind: "$ingredient" },
      {
        $project: {
          ingredientId: "$_id",
          ingredientName: "$ingredient.name",
          unit: "$ingredient.unit",
          systemQuantity: 1,
          unitPrice: {
            $cond: [
              { $gt: ["$systemQuantity", 0] },
              { $divide: ["$totalValue", "$systemQuantity"] },
              0,
            ],
          },
        },
      },
    ];

    const items = await InventoryBatch.aggregate(aggregatePipeline);

    const checkItems = items.map((item) => ({
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      unit: item.unit,
      systemQuantity: item.systemQuantity,
      actualQuantity: item.systemQuantity,
      difference: 0,
      unitPrice: item.unitPrice,
      differenceAmount: 0,
      reason: "",
    }));

    res.json({ items: checkItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "生成盘点数据失败" });
  }
});

router.post(
  "/checks",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        canteenId,
        checkDate,
        items,
        remark,
        confirmNow = false,
      } = req.body;

      if (!canteenId || !checkDate || !items || items.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({ message: "请填写完整的盘点信息" });
      }

      if (
        req.user?.role === "canteen" &&
        canteenId !== req.user.canteenId?.toString()
      ) {
        await session.abortTransaction();
        return res.status(403).json({ message: "只能为本助餐点创建盘点单" });
      }

      const checkMonth = getMonthKey(checkDate);

      const existing = await InventoryCheck.findOne({
        canteenId,
        checkMonth,
      }).session(session);
      if (existing && existing.status === "confirmed") {
        await session.abortTransaction();
        return res.status(400).json({ message: "该月份已完成盘点" });
      }

      const processedItems = items.map((item: any) => {
        const difference =
          (item.actualQuantity || 0) - (item.systemQuantity || 0);
        const differenceAmount = difference * (item.unitPrice || 0);
        return {
          ingredientId: item.ingredientId,
          systemQuantity: item.systemQuantity || 0,
          actualQuantity: item.actualQuantity || 0,
          difference,
          unitPrice: item.unitPrice || 0,
          differenceAmount,
          reason: item.reason || "",
        };
      });

      const totalSystemAmount = processedItems.reduce(
        (sum: number, item: any) => sum + item.systemQuantity * item.unitPrice,
        0,
      );
      const totalActualAmount = processedItems.reduce(
        (sum: number, item: any) => sum + item.actualQuantity * item.unitPrice,
        0,
      );
      const totalDifferenceAmount = processedItems.reduce(
        (sum: number, item: any) => sum + item.differenceAmount,
        0,
      );

      if (existing) {
        existing.checkDate = new Date(checkDate);
        existing.items = processedItems as any;
        existing.totalSystemAmount = totalSystemAmount;
        existing.totalActualAmount = totalActualAmount;
        existing.totalDifferenceAmount = totalDifferenceAmount;
        existing.remark = remark || existing.remark;

        if (confirmNow) {
          existing.status = "confirmed";
          existing.confirmedBy = req.user?._id;
          existing.confirmedAt = new Date();
        }

        await existing.save({ session });
        await session.commitTransaction();
        await existing.populate("canteenId", "name");
        res.json(existing);
      } else {
        const checkNo = generateCheckNo();
        const check = new InventoryCheck({
          checkNo,
          canteenId,
          checkDate: new Date(checkDate),
          checkMonth,
          items: processedItems as any,
          totalSystemAmount,
          totalActualAmount,
          totalDifferenceAmount,
          status: confirmNow ? "confirmed" : "draft",
          createdBy: req.user?._id,
          confirmedBy: confirmNow ? req.user?._id : undefined,
          confirmedAt: confirmNow ? new Date() : undefined,
          remark,
        });

        await check.save({ session });
        await session.commitTransaction();
        await check.populate("canteenId", "name");
        res.status(201).json(check);
      }
    } catch (error: any) {
      await session.abortTransaction();
      console.error(error);
      res.status(500).json({ message: error.message || "创建盘点单失败" });
    } finally {
      session.endSession();
    }
  },
);

router.patch(
  "/checks/:id/confirm",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const check = await InventoryCheck.findById(req.params.id);
      if (!check) {
        return res.status(404).json({ message: "盘点单不存在" });
      }

      if (
        req.user?.role === "canteen" &&
        check.canteenId.toString() !== req.user.canteenId?.toString()
      ) {
        return res.status(403).json({ message: "无权操作此盘点单" });
      }

      if (check.status !== "draft") {
        return res.status(400).json({ message: "当前状态不可确认" });
      }

      check.status = "confirmed";
      check.confirmedBy = req.user?._id;
      check.confirmedAt = new Date();

      await check.save();
      await check.populate("canteenId", "name");

      res.json(check);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "确认盘点单失败" });
    }
  },
);

export default router;
