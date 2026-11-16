import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// ─────────────────────────────────────────────
// GET /api/items
// Get all items (paginated)
// Query: ?page=1&limit=20&search=&category=
// ─────────────────────────────────────────────
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const search = (req.query.search as string | undefined)?.trim();
  const category = (req.query.category as string | undefined)?.trim();

  const where = {
    ...(search
      ? {
          OR: [
            { productName: { contains: search, mode: "insensitive" as const } },
            { brand: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(category ? { category: category as never } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: [{ productName: "asc" }],
      skip,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    message: "Success",
  });
});

// ─────────────────────────────────────────────
// GET /api/items/search
// Inline search — returns top 5 for autocomplete
// Query: ?q=
// ─────────────────────────────────────────────
router.get("/search", async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();

  if (!q || q.length < 2) {
    res.status(200).json({ data: [], message: "Success" });
    return;
  }

  const items = await prisma.item.findMany({
    where: {
      OR: [
        { productName: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { barcodeSku: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 5,
    orderBy: { productName: "asc" },
  });

  res.status(200).json({ data: items, message: "Success" });
});

// ─────────────────────────────────────────────
// GET /api/items/category/:category
// Get items by category
// ─────────────────────────────────────────────
router.get("/category/:category", async (req: Request, res: Response): Promise<void> => {
  const category = req.params.category as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where: { category: category as never },
      orderBy: { productName: "asc" },
      skip,
      take: limit,
    }),
    prisma.item.count({ where: { category: category as never } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    data: items,
    pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    message: "Success",
  });
});

// ─────────────────────────────────────────────
// GET /api/items/:id
// Get item by ID
// ─────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const item = await prisma.item.findUnique({ where: { id } });

  if (!item) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Item not found", status: 404 } });
    return;
  }

  res.status(200).json({ data: item, message: "Success" });
});

// ─────────────────────────────────────────────
// POST /api/items
// Create a new item
// Body: { productName, brand, category, barcodeSku? }
// ─────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { productName, brand, category, barcodeSku } = req.body as {
    productName?: string;
    brand?: string;
    category?: string;
    barcodeSku?: string;
  };

  const isMeatSeafood = category === "MEAT_SEAFOOD";
  if (!productName || (!isMeatSeafood && !brand) || !category) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: isMeatSeafood
          ? "productName and category are required"
          : "productName, brand and category are required",
        status: 400,
      },
    });
    return;
  }

  const item = await prisma.item.create({
    data: {
      productName: productName.trim(),
      brand: brand?.trim() ?? "",
      category: category as never,
      barcodeSku: barcodeSku?.trim() ?? null,
    },
  });

  res.status(201).json({ data: item, message: "Item created" });
});

// ─────────────────────────────────────────────
// PUT /api/items/:id  (ADMIN)
// Update an item
// ─────────────────────────────────────────────
router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin only", status: 403 } });
    return;
  }

  const id = req.params.id as string;
  const { productName, brand, category, barcodeSku } = req.body as {
    productName?: string;
    brand?: string;
    category?: string;
    barcodeSku?: string;
  };

  const item = await prisma.item.update({
    where: { id },
    data: {
      ...(productName ? { productName: productName.trim() } : {}),
      ...(brand ? { brand: brand.trim() } : {}),
      ...(category ? { category: category as never } : {}),
      ...(barcodeSku !== undefined ? { barcodeSku: barcodeSku?.trim() ?? null } : {}),
    },
  });

  res.status(200).json({ data: item, message: "Item updated" });
});

// ─────────────────────────────────────────────
// DELETE /api/items/:id  (ADMIN)
// Delete an item
// ─────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin only", status: 403 } });
    return;
  }

  const id = req.params.id as string;
  await prisma.item.delete({ where: { id } });

  res.status(200).json({ data: null, message: "Item deleted" });
});

export default router;
