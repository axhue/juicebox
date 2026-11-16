import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { Decimal } from "../generated/prisma/internal/prismaNamespace.js";

const router = Router();
router.use(requireAuth);

// Helper — calculate price per kg/L based on unit
function calcPricePerKg(price: number, weight: number, unit: string): number {
  // Normalise to KG equivalent
  const toKg: Record<string, number> = {
    KG: 1,
    G: 0.001,
    LBS: 0.453592,
    OZ: 0.0283495,
    L: 1,      // treat litres same as kg for price/unit
    ML: 0.001,
    UNIT: 1,
  };
  const factor = toKg[unit] ?? 1;
  const kgEquivalent = weight * factor;
  return kgEquivalent > 0 ? Math.round((price / kgEquivalent) * 100) / 100 : 0;
}

// ─────────────────────────────────────────────
// GET /api/prices
// Get all price entries (paginated)
// Query: ?page=1&limit=20&mine=1 (mine: only the caller's entries)
// ─────────────────────────────────────────────
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const where = req.query.mine ? { entryByUserId: req.user!.id } : {};

  const [entries, total] = await Promise.all([
    prisma.priceEntry.findMany({
      where,
      include: { item: true, location: true, user: { select: { id: true, name: true } } },
      orderBy: { datetime: "desc" },
      skip,
      take: limit,
    }),
    prisma.priceEntry.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    data: entries,
    pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    message: "Success",
  });
});

// ─────────────────────────────────────────────
// GET /api/prices/item/:itemId
// Most recent price for an item across all stores
// ─────────────────────────────────────────────
router.get("/item/:itemId", async (req: Request, res: Response): Promise<void> => {
  const itemId = req.params.itemId as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  // Distinct latest price per location via raw query
  const entries = await prisma.$queryRaw<unknown[]>`
    SELECT DISTINCT ON (pe.location_id)
      pe.*,
      to_json(i.*) AS item,
      to_json(sl.*) AS location
    FROM price_entries pe
    JOIN items i ON pe.item_id = i.id
    JOIN store_locations sl ON pe.location_id = sl.id
    WHERE pe.item_id = ${itemId}
    ORDER BY pe.location_id, pe.datetime DESC
    LIMIT ${limit} OFFSET ${skip}
  `;

  const total = await prisma.priceEntry.groupBy({
    by: ["locationId"],
    where: { itemId },
    _count: true,
  });

  res.status(200).json({
    data: entries,
    pagination: { page, limit, total: total.length, hasNextPage: false, hasPrevPage: page > 1 },
    message: "Success",
  });
});

// ─────────────────────────────────────────────
// GET /api/prices/item/:itemId/history
// Full price history for an item at all stores
// Query: ?locationId= (optional — filter to one store)
// ─────────────────────────────────────────────
router.get("/item/:itemId/history", async (req: Request, res: Response): Promise<void> => {
  const itemId = req.params.itemId as string;
  const locationId = (req.query.locationId as string | undefined)?.trim();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;

  const where = { itemId, ...(locationId ? { locationId } : {}) };

  const [entries, total] = await Promise.all([
    prisma.priceEntry.findMany({
      where,
      select: { price: true, pricePerKg: true, datetime: true, locationId: true },
      orderBy: { datetime: "asc" },
      skip,
      take: limit,
    }),
    prisma.priceEntry.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    data: entries,
    pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    message: "Success",
  });
});

// ─────────────────────────────────────────────
// GET /api/prices/item/:itemId/compare
// Latest price at every store, sorted cheapest first
// ─────────────────────────────────────────────
router.get("/item/:itemId/compare", async (req: Request, res: Response): Promise<void> => {
  const itemId = req.params.itemId as string;

  const entries = await prisma.$queryRaw<unknown[]>`
    SELECT DISTINCT ON (pe.location_id)
      pe.id,
      pe.price,
      pe.weight,
      pe.unit,
      pe.price_per_kg,
      pe.datetime,
      json_build_object('id', sl.id, 'storeName', sl.store_name, 'storeGroup', sl.store_group,
        'address', sl.address, 'city', sl.city, 'province', sl.province) AS location
    FROM price_entries pe
    JOIN store_locations sl ON pe.location_id = sl.id
    WHERE pe.item_id = ${itemId}
    ORDER BY pe.location_id, pe.datetime DESC
  `;

  // Sort by price ascending in JS (raw query doesn't allow outer ORDER BY over DISTINCT ON)
  const sorted = (entries as { price: unknown }[]).sort(
    (a, b) => Number(a.price) - Number(b.price)
  );

  res.status(200).json({ data: sorted, message: "Success" });
});

// ─────────────────────────────────────────────
// GET /api/prices/location/:locationId
// All price entries at a specific store (paginated)
// ─────────────────────────────────────────────
router.get("/location/:locationId", async (req: Request, res: Response): Promise<void> => {
  const locationId = req.params.locationId as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  // Latest entry per item at this location
  const entries = await prisma.$queryRaw<unknown[]>`
    SELECT DISTINCT ON (pe.item_id)
      pe.*,
      to_json(i.*) AS item
    FROM price_entries pe
    JOIN items i ON pe.item_id = i.id
    WHERE pe.location_id = ${locationId}
    ORDER BY pe.item_id, pe.datetime DESC
    LIMIT ${limit} OFFSET ${skip}
  `;

  const total = await prisma.priceEntry.groupBy({
    by: ["itemId"],
    where: { locationId },
    _count: true,
  });

  res.status(200).json({
    data: entries,
    pagination: { page, limit, total: total.length, hasNextPage: false, hasPrevPage: page > 1 },
    message: "Success",
  });
});

// ─────────────────────────────────────────────
// GET /api/prices/:id
// Get a single price entry by ID
// ─────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  const entry = await prisma.priceEntry.findUnique({
    where: { id },
    include: { item: true, location: true, user: { select: { id: true, name: true } } },
  });

  if (!entry) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Price entry not found", status: 404 } });
    return;
  }

  res.status(200).json({ data: entry, message: "Success" });
});

// ─────────────────────────────────────────────
// POST /api/prices
// Create a new price entry
// Body: { itemId, locationId, price, weight, unit, notes? }
// pricePerKg is auto-calculated
// ─────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { itemId, locationId, price, weight, unit, notes } = req.body as {
    itemId?: string;
    locationId?: string;
    price?: number;
    weight?: number;
    unit?: string;
    notes?: string;
  };

  if (!itemId || !locationId || price == null || weight == null || !unit) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "itemId, locationId, price, weight and unit are required", status: 400 },
    });
    return;
  }

  // Verify both item and store exist
  const [item, location] = await Promise.all([
    prisma.item.findUnique({ where: { id: itemId } }),
    prisma.storeLocation.findUnique({ where: { id: locationId } }),
  ]);

  if (!item) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Item not found", status: 404 } });
    return;
  }
  if (!location) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Store location not found", status: 404 } });
    return;
  }

  const pricePerKg = calcPricePerKg(Number(price), Number(weight), unit);

  const entry = await prisma.priceEntry.create({
    data: {
      itemId,
      locationId,
      price: new Decimal(price),
      weight: new Decimal(weight),
      unit: unit as never,
      pricePerKg: new Decimal(pricePerKg),
      notes: notes?.trim() ?? null,
      entryByUserId: req.user!.id,
    },
    include: { item: true, location: true },
  });

  res.status(201).json({ data: entry, message: "Price entry created" });
});

// ─────────────────────────────────────────────
// PUT /api/prices/:id  (author or ADMIN)
// Update a price entry
// ─────────────────────────────────────────────
router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { price, weight, unit, notes } = req.body as {
    price?: number;
    weight?: number;
    unit?: string;
    notes?: string;
  };

  const existing = await prisma.priceEntry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Price entry not found", status: 404 } });
    return;
  }
  if (existing.entryByUserId !== req.user!.id && req.user!.role !== "ADMIN") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You can only edit your own entries", status: 403 } });
    return;
  }

  const newPrice = price != null ? Number(price) : Number(existing.price);
  const newWeight = weight != null ? Number(weight) : Number(existing.weight);
  const newUnit = unit ?? existing.unit;
  const pricePerKg = calcPricePerKg(newPrice, newWeight, newUnit);

  const entry = await prisma.priceEntry.update({
    where: { id },
    data: {
      price: new Decimal(newPrice),
      weight: new Decimal(newWeight),
      unit: newUnit as never,
      pricePerKg: new Decimal(pricePerKg),
      ...(notes !== undefined ? { notes: notes?.trim() ?? null } : {}),
    },
    include: { item: true, location: true },
  });

  res.status(200).json({ data: entry, message: "Price entry updated" });
});

// ─────────────────────────────────────────────
// DELETE /api/prices/:id  (ADMIN)
// Delete a price entry
// ─────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin only", status: 403 } });
    return;
  }

  const id = req.params.id as string;
  await prisma.priceEntry.delete({ where: { id } });

  res.status(200).json({ data: null, message: "Price entry deleted" });
});

export default router;
