import { Router, Request, Response } from "express";
import { Ingredient } from "../models/Ingredient";
import { InventoryBatch } from "../models/InventoryBatch";
import { authMiddleware, requireRoles } from "../middleware/auth";
import dayjs from "dayjs";

const router = Router();

router.use(authMiddleware);

// ==================== 食材字典管理 ====================

router.get("/ingredients", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      pageSize = "10",
      category = "",
      keyword = "",
    } = req.query;

    const query: any = {};
    if (category) query.category = category;
    if (keyword) query.name = { $regex: keyword, $options: "i" };

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      Ingredient.countDocuments(query),
      Ingredient.find(query).skip(skip).limit(size).sort({ createdAt: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取食材列表失败" });
  }
});

router.get("/ingredients/all", async (req: Request, res: Response) => {
  try {
    const list = await Ingredient.find().sort({ name: 1 });
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取食材列表失败" });
  }
});

router.get("/ingredients/:id", async (req: Request, res: Response) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ message: "食材不存在" });
    }
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ message: "获取食材详情失败" });
  }
});

router.post(
  "/ingredients",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        category,
        unit,
        shelfLifeDays,
        referencePrice,
        safetyStock,
        remark,
      } = req.body;

      if (
        !name ||
        !category ||
        !unit ||
        !shelfLifeDays ||
        referencePrice === undefined ||
        safetyStock === undefined
      ) {
        return res.status(400).json({ message: "请填写完整的食材信息" });
      }

      const existing = await Ingredient.findOne({ name });
      if (existing) {
        return res.status(400).json({ message: "该食材名称已存在" });
      }

      const ingredient = new Ingredient({
        name,
        category,
        unit,
        shelfLifeDays,
        referencePrice,
        safetyStock,
        remark,
      });

      await ingredient.save();
      res.status(201).json(ingredient);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: error.message || "创建食材失败" });
    }
  },
);

router.put(
  "/ingredients/:id",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const ingredient = await Ingredient.findById(req.params.id);
      if (!ingredient) {
        return res.status(404).json({ message: "食材不存在" });
      }

      const {
        name,
        category,
        unit,
        shelfLifeDays,
        referencePrice,
        safetyStock,
        remark,
      } = req.body;

      if (name && name !== ingredient.name) {
        const existing = await Ingredient.findOne({ name });
        if (existing) {
          return res.status(400).json({ message: "该食材名称已存在" });
        }
        ingredient.name = name;
      }

      if (category) ingredient.category = category;
      if (unit) ingredient.unit = unit;
      if (shelfLifeDays) ingredient.shelfLifeDays = shelfLifeDays;
      if (referencePrice !== undefined)
        ingredient.referencePrice = referencePrice;
      if (safetyStock !== undefined) ingredient.safetyStock = safetyStock;
      if (remark !== undefined) ingredient.remark = remark;

      await ingredient.save();
      res.json(ingredient);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: error.message || "更新食材失败" });
    }
  },
);

router.delete(
  "/ingredients/:id",
  requireRoles("admin"),
  async (req: Request, res: Response) => {
    try {
      const ingredient = await Ingredient.findById(req.params.id);
      if (!ingredient) {
        return res.status(404).json({ message: "食材不存在" });
      }

      const hasStock = await InventoryBatch.countDocuments({
        ingredientId: ingredient._id,
        remainingQuantity: { $gt: 0 },
      });
      if (hasStock > 0) {
        return res.status(400).json({ message: "该食材还有库存，无法删除" });
      }

      await Ingredient.findByIdAndDelete(req.params.id);
      res.json({ message: "删除成功" });
    } catch (error) {
      res.status(500).json({ message: "删除食材失败" });
    }
  },
);

// ==================== 库存管理 ====================

async function updateBatchStatus(): Promise<void> {
  const now = new Date();
  const threeDaysLater = dayjs().add(3, "day").toDate();

  await InventoryBatch.updateMany(
    {
      status: { $in: ["normal", "expiring_soon"] },
      expiryDate: { $lt: now },
    },
    { status: "expired" },
  );

  await InventoryBatch.updateMany(
    {
      status: "normal",
      expiryDate: { $gte: now, $lte: threeDaysLater },
    },
    { status: "expiring_soon" },
  );
}

router.get("/inventory", async (req: Request, res: Response) => {
  try {
    await updateBatchStatus();

    let canteenId = (req.query.canteenId as string) || "";
    if (req.user?.role === "canteen") {
      canteenId = req.user.canteenId?.toString() || "";
    }

    const { category = "", keyword = "", status = "" } = req.query;

    const matchStage: any = {};
    if (canteenId) matchStage.canteenId = canteenId;

    const aggregatePipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: "ingredients",
          localField: "ingredientId",
          foreignField: "_id",
          as: "ingredient",
        },
      },
      { $unwind: "$ingredient" },
    ];

    if (category || keyword) {
      const ingredientMatch: any = {};
      if (category) ingredientMatch["ingredient.category"] = category;
      if (keyword)
        ingredientMatch["ingredient.name"] = { $regex: keyword, $options: "i" };
      aggregatePipeline.push({ $match: ingredientMatch });
    }

    aggregatePipeline.push({
      $group: {
        _id: {
          canteenId: "$canteenId",
          ingredientId: "$ingredientId",
        },
        ingredientName: { $first: "$ingredient.name" },
        category: { $first: "$ingredient.category" },
        unit: { $first: "$ingredient.unit" },
        safetyStock: { $first: "$ingredient.safetyStock" },
        totalQuantity: { $sum: "$remainingQuantity" },
        totalValue: {
          $sum: { $multiply: ["$remainingQuantity", "$unitPrice"] },
        },
        batches: {
          $push: {
            _id: "$_id",
            batchNo: "$batchNo",
            remainingQuantity: "$remainingQuantity",
            unitPrice: "$unitPrice",
            productionDate: "$productionDate",
            expiryDate: "$expiryDate",
            status: "$status",
          },
        },
      },
    });

    if (status) {
      aggregatePipeline.push({
        $match: {
          "batches.status": status,
        },
      });
    }

    aggregatePipeline.push({ $sort: { ingredientName: 1 } });

    const results = await InventoryBatch.aggregate(aggregatePipeline);

    const resultsWithWarning = results.map((item: any) => {
      const isLowStock = item.totalQuantity < item.safetyStock;
      const hasExpiringSoon = item.batches.some(
        (b: any) => b.status === "expiring_soon",
      );
      const hasExpired = item.batches.some((b: any) => b.status === "expired");
      return {
        ...item,
        isLowStock,
        hasExpiringSoon,
        hasExpired,
      };
    });

    res.json(resultsWithWarning);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取库存列表失败" });
  }
});

router.get("/inventory/batches", async (req: Request, res: Response) => {
  try {
    await updateBatchStatus();

    let canteenId = (req.query.canteenId as string) || "";
    if (req.user?.role === "canteen") {
      canteenId = req.user.canteenId?.toString() || "";
    }

    const { ingredientId = "", status = "", warningType = "" } = req.query;

    const query: any = {};
    if (canteenId) query.canteenId = canteenId;
    if (ingredientId) query.ingredientId = ingredientId;
    if (status) query.status = status;

    if (warningType === "expiring_soon") {
      query.status = { $in: ["expiring_soon", "expired"] };
    } else if (warningType === "expired") {
      query.status = "expired";
    }

    query.remainingQuantity = { $gt: 0 };

    const batches = await InventoryBatch.find(query)
      .populate("ingredientId", "name unit category safetyStock")
      .populate("canteenId", "name")
      .populate("supplierId", "name")
      .sort({ expiryDate: 1 });

    res.json(batches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取批次列表失败" });
  }
});

router.get("/inventory/warnings", async (req: Request, res: Response) => {
  try {
    await updateBatchStatus();

    let canteenId = (req.query.canteenId as string) || "";
    if (req.user?.role === "canteen") {
      canteenId = req.user.canteenId?.toString() || "";
    }

    const matchStage: any = {};
    if (canteenId) matchStage.canteenId = canteenId;

    const expiringBatches = await InventoryBatch.find({
      ...matchStage,
      status: { $in: ["expiring_soon", "expired"] },
      remainingQuantity: { $gt: 0 },
    })
      .populate("ingredientId", "name unit")
      .populate("canteenId", "name")
      .sort({ expiryDate: 1 });

    const lowStockAggregate: any[] = [
      { $match: { ...matchStage, remainingQuantity: { $gt: 0 } } },
      {
        $lookup: {
          from: "ingredients",
          localField: "ingredientId",
          foreignField: "_id",
          as: "ingredient",
        },
      },
      { $unwind: "$ingredient" },
      {
        $group: {
          _id: {
            canteenId: "$canteenId",
            ingredientId: "$ingredientId",
          },
          ingredientName: { $first: "$ingredient.name" },
          unit: { $first: "$ingredient.unit" },
          safetyStock: { $first: "$ingredient.safetyStock" },
          totalQuantity: { $sum: "$remainingQuantity" },
        },
      },
      {
        $match: {
          $expr: { $lt: ["$totalQuantity", "$safetyStock"] },
        },
      },
    ];

    const lowStockItems = await InventoryBatch.aggregate(lowStockAggregate);

    res.json({
      expiringBatches,
      lowStockItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取预警信息失败" });
  }
});

router.patch(
  "/inventory/batches/:id/status",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const { status, reason } = req.body;

      const batch = await InventoryBatch.findById(req.params.id);
      if (!batch) {
        return res.status(404).json({ message: "批次不存在" });
      }

      if (
        req.user?.role === "canteen" &&
        batch.canteenId.toString() !== req.user.canteenId?.toString()
      ) {
        return res.status(403).json({ message: "无权操作此批次" });
      }

      if (status === "damaged") {
        batch.status = "damaged";
        batch.remainingQuantity = 0;
        if (reason)
          batch.remark = (batch.remark || "") + ` 报损原因：${reason}`;
      } else if (["normal", "expiring_soon", "expired"].includes(status)) {
        batch.status = status;
      }

      await batch.save();
      res.json(batch);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "更新批次状态失败" });
    }
  },
);

export default router;
