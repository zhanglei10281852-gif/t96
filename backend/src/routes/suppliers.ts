import { Router, Request, Response } from "express";
import { Supplier } from "../models/Supplier";
import { authMiddleware, requireRoles } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      pageSize = "10",
      status = "",
      category = "",
      keyword = "",
    } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (category) query.categories = category;
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { contactPerson: { $regex: keyword, $options: "i" } },
        { phone: { $regex: keyword, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      Supplier.countDocuments(query),
      Supplier.find(query).skip(skip).limit(size).sort({ createdAt: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取供应商列表失败" });
  }
});

router.get("/all", async (req: Request, res: Response) => {
  try {
    const list = await Supplier.find({ status: "active" }).sort({ name: 1 });
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取供应商列表失败" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "供应商不存在" });
    }
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: "获取供应商详情失败" });
  }
});

router.post(
  "/",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        contactPerson,
        phone,
        categories,
        status,
        creditRating,
        remark,
      } = req.body;

      if (
        !name ||
        !contactPerson ||
        !phone ||
        !categories ||
        categories.length === 0
      ) {
        return res.status(400).json({ message: "请填写完整的供应商信息" });
      }

      const existing = await Supplier.findOne({ name });
      if (existing) {
        return res.status(400).json({ message: "该供应商名称已存在" });
      }

      const supplier = new Supplier({
        name,
        contactPerson,
        phone,
        categories,
        status: status || "active",
        creditRating: creditRating || "B",
        remark,
      });

      await supplier.save();
      res.status(201).json(supplier);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: error.message || "创建供应商失败" });
    }
  },
);

router.put(
  "/:id",
  requireRoles("admin", "canteen"),
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        contactPerson,
        phone,
        categories,
        status,
        creditRating,
        remark,
      } = req.body;

      const supplier = await Supplier.findById(req.params.id);
      if (!supplier) {
        return res.status(404).json({ message: "供应商不存在" });
      }

      if (name && name !== supplier.name) {
        const existing = await Supplier.findOne({ name });
        if (existing) {
          return res.status(400).json({ message: "该供应商名称已存在" });
        }
        supplier.name = name;
      }

      if (contactPerson) supplier.contactPerson = contactPerson;
      if (phone) supplier.phone = phone;
      if (categories && categories.length > 0) supplier.categories = categories;
      if (status) supplier.status = status;
      if (creditRating) supplier.creditRating = creditRating;
      if (remark !== undefined) supplier.remark = remark;

      await supplier.save();
      res.json(supplier);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: error.message || "更新供应商失败" });
    }
  },
);

router.delete(
  "/:id",
  requireRoles("admin"),
  async (req: Request, res: Response) => {
    try {
      const supplier = await Supplier.findById(req.params.id);
      if (!supplier) {
        return res.status(404).json({ message: "供应商不存在" });
      }

      supplier.status = "inactive";
      await supplier.save();
      res.json({ message: "供应商已停用" });
    } catch (error) {
      res.status(500).json({ message: "停用供应商失败" });
    }
  },
);

export default router;
