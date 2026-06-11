import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import dayjs from "dayjs";
import { PurchaseOrder, PurchaseOrderStatus } from "../models/PurchaseOrder";
import { InventoryBatch } from "../models/InventoryBatch";
import { Ingredient } from "../models/Ingredient";
import { authMiddleware, requireRoles } from "../middleware/auth";
import { generatePurchaseOrderNo, generateBatchNo } from "../utils/inventory";

const router = Router();

router.use(authMiddleware);

const APPROVAL_THRESHOLD = 500;

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      pageSize = "10",
      status = "",
      canteenId = "",
      startDate = "",
      endDate = "",
    } = req.query;

    const query: any = {};

    if (req.user?.role === "canteen") {
      query.canteenId = req.user.canteenId;
    } else if (canteenId) {
      query.canteenId = canteenId;
    }

    if (status) query.status = status;

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate as string);
      if (endDate) {
        const end = dayjs(endDate as string)
          .add(1, "day")
          .toDate();
        query.purchaseDate.$lt = end;
      }
    }

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      PurchaseOrder.countDocuments(query),
      PurchaseOrder.find(query)
        .populate("canteenId", "name")
        .populate("supplierId", "name contactPerson phone")
        .populate("items.ingredientId", "name unit")
        .populate("createdBy", "name")
        .skip(skip)
        .limit(size)
        .sort({ createdAt: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取采购单列表失败" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate("canteenId", "name")
      .populate("supplierId", "name contactPerson phone")
      .populate("items.ingredientId", "name unit category shelfLifeDays")
      .populate("createdBy", "name")
      .populate("submittedBy", "name")
      .populate("approvedBy", "name")
      .populate("rejectedBy", "name")
      .populate("stockedInBy", "name");

    if (!order) {
      return res.status(404).json({ message: "采购单不存在" });
    }

    if (
      req.user?.role === "canteen" &&
      order.canteenId.toString() !== req.user.canteenId?.toString()
    ) {
      return res.status(403).json({ message: "无权查看此采购单" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "获取采购单详情失败" });
  }
});

router.post(
  "/",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const { canteenId, supplierId, purchaseDate, items, remark } = req.body;

      if (
        !canteenId ||
        !supplierId ||
        !purchaseDate ||
        !items ||
        items.length === 0
      ) {
        return res.status(400).json({ message: "请填写完整的采购单信息" });
      }

      if (
        req.user?.role === "canteen" &&
        canteenId !== req.user.canteenId?.toString()
      ) {
        return res.status(403).json({ message: "只能为本助餐点创建采购单" });
      }

      const totalAmount = items.reduce((sum: number, item: any) => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0);
        return sum + amount;
      }, 0);

      const orderNo = generatePurchaseOrderNo();
      const needApproval = totalAmount > APPROVAL_THRESHOLD;

      const processedItems = items.map((item: any) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
      }));

      const order = new PurchaseOrder({
        orderNo,
        canteenId,
        supplierId,
        purchaseDate,
        items: processedItems,
        totalAmount,
        status: "draft",
        needApproval,
        createdBy: req.user?._id,
        remark,
      });

      await order.save();
      await order.populate("canteenId", "name");
      await order.populate("supplierId", "name");
      await order.populate("items.ingredientId", "name unit");

      res.status(201).json(order);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: error.message || "创建采购单失败" });
    }
  },
);

router.put(
  "/:id",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const order = await PurchaseOrder.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "采购单不存在" });
      }

      if (
        req.user?.role === "canteen" &&
        order.canteenId.toString() !== req.user.canteenId?.toString()
      ) {
        return res.status(403).json({ message: "无权编辑此采购单" });
      }

      if (!["draft", "rejected"].includes(order.status)) {
        return res.status(400).json({ message: "当前状态不可编辑" });
      }

      const { supplierId, purchaseDate, items, remark } = req.body;

      if (supplierId) order.supplierId = supplierId;
      if (purchaseDate) order.purchaseDate = purchaseDate;
      if (remark !== undefined) order.remark = remark;

      if (items && items.length > 0) {
        order.items = items.map((item: any) => ({
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
        }));
        order.totalAmount = order.items.reduce(
          (sum, item) => sum + item.amount,
          0,
        );
        order.needApproval = order.totalAmount > APPROVAL_THRESHOLD;
      }

      order.status = "draft";

      await order.save();
      await order.populate("canteenId", "name");
      await order.populate("supplierId", "name");
      await order.populate("items.ingredientId", "name unit");

      res.json(order);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: error.message || "更新采购单失败" });
    }
  },
);

router.patch(
  "/:id/submit",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const order = await PurchaseOrder.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "采购单不存在" });
      }

      if (
        req.user?.role === "canteen" &&
        order.canteenId.toString() !== req.user.canteenId?.toString()
      ) {
        return res.status(403).json({ message: "无权操作此采购单" });
      }

      if (order.status !== "draft" && order.status !== "rejected") {
        return res.status(400).json({ message: "当前状态不可提交" });
      }

      if (order.needApproval) {
        order.status = "submitted";
      } else {
        order.status = "approved";
        order.approvedBy = req.user?._id;
        order.approvedAt = new Date();
      }

      order.submittedBy = req.user?._id;
      order.submittedAt = new Date();

      await order.save();
      await order.populate("canteenId", "name");
      await order.populate("supplierId", "name");
      await order.populate("items.ingredientId", "name unit");

      res.json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "提交采购单失败" });
    }
  },
);

router.patch(
  "/:id/approve",
  requireRoles("admin"),
  async (req: Request, res: Response) => {
    try {
      const order = await PurchaseOrder.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "采购单不存在" });
      }

      if (order.status !== "submitted") {
        return res.status(400).json({ message: "当前状态不可审批" });
      }

      order.status = "approved";
      order.approvedBy = req.user?._id;
      order.approvedAt = new Date();

      await order.save();
      await order.populate("canteenId", "name");
      await order.populate("supplierId", "name");
      await order.populate("items.ingredientId", "name unit");

      res.json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "审批采购单失败" });
    }
  },
);

router.patch(
  "/:id/reject",
  requireRoles("admin"),
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;

      const order = await PurchaseOrder.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "采购单不存在" });
      }

      if (order.status !== "submitted") {
        return res.status(400).json({ message: "当前状态不可驳回" });
      }

      order.status = "rejected";
      order.rejectedBy = req.user?._id;
      order.rejectedAt = new Date();
      order.rejectReason = reason || "";

      await order.save();
      await order.populate("canteenId", "name");
      await order.populate("supplierId", "name");
      await order.populate("items.ingredientId", "name unit");

      res.json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "驳回采购单失败" });
    }
  },
);

router.post(
  "/:id/stock-in",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const { items, productionDates } = req.body;

      const order = await PurchaseOrder.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "采购单不存在" });
      }

      if (
        req.user?.role === "canteen" &&
        order.canteenId.toString() !== req.user.canteenId?.toString()
      ) {
        return res.status(403).json({ message: "无权操作此采购单" });
      }

      if (order.status !== "approved") {
        return res.status(400).json({ message: "当前状态不可入库" });
      }

      const ingredientMap = new Map();
      const ingredients = await Ingredient.find({
        _id: { $in: order.items.map((i) => i.ingredientId) },
      });
      ingredients.forEach((ing) => ingredientMap.set(ing._id.toString(), ing));

      for (let i = 0; i < order.items.length; i++) {
        const orderItem = order.items[i];
        const acceptedQty = items?.[i]?.acceptedQuantity ?? orderItem.quantity;
        const differenceReason = items?.[i]?.differenceReason || "";
        const productionDate = productionDates?.[i]
          ? new Date(productionDates[i])
          : new Date();

        orderItem.acceptedQuantity = acceptedQty;
        orderItem.difference = acceptedQty - orderItem.quantity;
        orderItem.differenceReason = differenceReason;

        if (acceptedQty > 0) {
          const ingredient = ingredientMap.get(
            orderItem.ingredientId.toString(),
          );
          if (!ingredient) {
            return res.status(400).json({ message: "食材信息不存在" });
          }

          const expiryDate = dayjs(productionDate)
            .add(ingredient.shelfLifeDays, "day")
            .toDate();
          let status: any = "normal";
          const now = new Date();
          const threeDaysLater = dayjs().add(3, "day").toDate();
          if (expiryDate < now) {
            status = "expired";
          } else if (expiryDate <= threeDaysLater) {
            status = "expiring_soon";
          }

          const batch = new InventoryBatch({
            canteenId: order.canteenId,
            ingredientId: orderItem.ingredientId,
            batchNo: generateBatchNo(),
            quantity: acceptedQty,
            remainingQuantity: acceptedQty,
            unitPrice: orderItem.unitPrice,
            productionDate,
            expiryDate,
            stockInDate: new Date(),
            status,
            supplierId: order.supplierId,
            purchaseOrderId: order._id,
          });

          await batch.save();
        }
      }

      order.status = "stocked_in";
      order.stockedInBy = req.user?._id;
      order.stockedInAt = new Date();

      await order.save();

      await order.populate("canteenId", "name");
      await order.populate("supplierId", "name");
      await order.populate("items.ingredientId", "name unit");

      res.json(order);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: error.message || "入库失败" });
    }
  },
);

router.delete(
  "/:id",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const order = await PurchaseOrder.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "采购单不存在" });
      }

      if (
        req.user?.role === "canteen" &&
        order.canteenId.toString() !== req.user.canteenId?.toString()
      ) {
        return res.status(403).json({ message: "无权删除此采购单" });
      }

      if (!["draft", "rejected"].includes(order.status)) {
        return res.status(400).json({ message: "当前状态不可删除" });
      }

      await PurchaseOrder.findByIdAndDelete(req.params.id);
      res.json({ message: "删除成功" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "删除采购单失败" });
    }
  },
);

export default router;
