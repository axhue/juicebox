import type { Request, Response, NextFunction } from "express";
import { supabaseAnon } from "../lib/supabase.js";
import { prisma } from "../lib/prisma.js";
import type { UserModel } from "../generated/prisma/models/User.js";

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserModel;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid authorization header",
        status: 401,
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  // Verify JWT with Supabase
  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
        status: 401,
      },
    });
    return;
  }

  // Look up user profile in our database by email
  const user = await prisma.user.findUnique({
    where: { email: data.user.email! },
  });

  if (!user) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "User profile not found",
        status: 401,
      },
    });
    return;
  }

  req.user = user;
  next();
}
