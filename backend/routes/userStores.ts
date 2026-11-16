import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// All user store routes require authentication
router.use(requireAuth);

// ─────────────────────────────────────────────
// GET /api/users/stores
// Get all stores saved by the authenticated user
// ─────────────────────────────────────────────
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const [userStores, total] = await Promise.all([
    prisma.userStore.findMany({
      where: { userId },
      include: {
        location: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.userStore.count({ where: { userId } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    data: userStores,
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
// POST /api/users/stores
// Add a store to the authenticated user's saved stores
// Body: { locationId: string }
// ─────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { locationId } = req.body as { locationId?: string };

  if (!locationId) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "locationId is required",
        status: 400,
      },
    });
    return;
  }

  // Verify the store location exists
  const location = await prisma.storeLocation.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Store location not found",
        status: 404,
      },
    });
    return;
  }

  // Check for duplicate (userId + locationId must be unique)
  const existing = await prisma.userStore.findUnique({
    where: { userId_locationId: { userId, locationId } },
  });

  if (existing) {
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Store is already in your saved stores",
        status: 409,
      },
    });
    return;
  }

  const userStore = await prisma.userStore.create({
    data: { userId, locationId },
    include: { location: true },
  });

  res.status(201).json({
    data: userStore,
    message: "Store added to your saved stores",
  });
});

// ─────────────────────────────────────────────
// DELETE /api/users/stores/:id
// Remove a store from the authenticated user's saved stores
// :id is the UserStore record ID (junction table)
// ─────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const id = req.params.id as string;

  // Find the UserStore entry and confirm it belongs to this user
  const userStore = await prisma.userStore.findUnique({
    where: { id },
  });

  if (!userStore) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Saved store entry not found",
        status: 404,
      },
    });
    return;
  }

  if (userStore.userId !== userId) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to remove this store",
        status: 403,
      },
    });
    return;
  }

  await prisma.userStore.delete({ where: { id } });

  res.status(200).json({
    data: null,
    message: "Store removed from your saved stores",
  });
});

export default router;
