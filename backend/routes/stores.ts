import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// All store routes require authentication
router.use(requireAuth);

// ─────────────────────────────────────────────
// GET /api/stores
// Get all store locations (paginated)
// Query: ?page=1&limit=20&search=&group=
// ─────────────────────────────────────────────
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;
  const search = (req.query.search as string | undefined)?.trim();
  const group = (req.query.group as string | undefined)?.trim();

  const where = {
    ...(search
      ? {
          OR: [
            { storeName: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(group ? { storeGroup: { contains: group, mode: "insensitive" as const } } : {}),
  };

  const [stores, total] = await Promise.all([
    prisma.storeLocation.findMany({
      where,
      orderBy: [{ storeGroup: "asc" }, { storeName: "asc" }],
      skip,
      take: limit,
    }),
    prisma.storeLocation.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    data: stores,
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
// GET /api/stores/groups
// Get distinct store group names for filter chips
// ─────────────────────────────────────────────
router.get("/groups", async (_req: Request, res: Response): Promise<void> => {
  const groups = await prisma.storeLocation.findMany({
    select: { storeGroup: true },
    distinct: ["storeGroup"],
    orderBy: { storeGroup: "asc" },
  });

  res.status(200).json({
    data: groups.map((g) => g.storeGroup),
    message: "Success",
  });
});

// ─────────────────────────────────────────────
// POST /api/stores
// Create a new store location
// Body: { storeName, storeGroup, address, city, province, postalCode }
// ─────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { storeName, storeGroup, address, city, province, postalCode } = req.body as {
    storeName?: string;
    storeGroup?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };

  if (!storeName || !storeGroup || !address || !city || !province || !postalCode) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "All fields are required: storeName, storeGroup, address, city, province, postalCode", status: 400 },
    });
    return;
  }

  const store = await prisma.storeLocation.create({
    data: {
      storeName: storeName.trim(),
      storeGroup: storeGroup.trim(),
      address: address.trim(),
      city: city.trim(),
      province: province.trim(),
      postalCode: postalCode.trim().toUpperCase(),
    },
  });

  res.status(201).json({ data: store, message: "Store created" });
});

// ─────────────────────────────────────────────
// GET /api/stores/:id
// Get a single store by ID
// ─────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const store = await prisma.storeLocation.findUnique({ where: { id } });

  if (!store) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Store not found", status: 404 },
    });
    return;
  }

  res.status(200).json({ data: store, message: "Success" });
});

export default router;
