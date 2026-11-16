import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { supabaseAdmin, supabaseAnon } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ─────────────────────────────────────────────
// POST /api/auth/register
// Creates a Supabase auth user + Prisma profile
// Body: { email, password, name }
// ─────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };


  if (!email || !password || !name) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "email, password and name are required",
        status: 400,
      },
    });
    return;
  }

  // Check for existing profile in our DB first (fast fail)
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "An account with this email already exists",
        status: 409,
      },
    });
    return;
  }


  console.log("Registering new user with email:", email);
  // Create Supabase auth user (admin createUser skips email confirmation)
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: authError?.message ?? "Failed to create auth user",
        status: 400,
      },
    });
    return;
  }

  // The on_auth_user_created trigger already inserted the profile row; set its name
  const user = await prisma.user.upsert({
    where: { id: authData.user.id },
    update: { name },
    create: { id: authData.user.id, name, email },
  });

  // Sign in immediately to return a usable token
  const { data: sessionData, error: sessionError } =
    await supabaseAnon.auth.signInWithPassword({ email, password });

  if (sessionError || !sessionData.session) {
    // Account created but couldn't get a session — ask them to log in
    res.status(201).json({
      data: { user, token: null },
      message: "Account created. Please sign in.",
    });
    return;
  }

  res.status(201).json({
    data: { user, token: sessionData.session.access_token },
    message: "Account created",
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// ─────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  
  console.log("Login attempt with body:", req.body);
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "email and password are required",
        status: 400,
      },
    });
    return;
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: error?.message ?? "Invalid credentials",
        status: 401,
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "User profile not found",
        status: 404,
      },
    });
    return;
  }

  res.status(200).json({
    data: { user, token: data.session.access_token },
    message: "Login successful",
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// Invalidates the Supabase session server-side
// ─────────────────────────────────────────────
router.post(
  "/logout",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    // Sign out all sessions for this user (scope: "global")
    await supabaseAdmin.auth.admin.signOut(req.headers.authorization!.slice(7));

    res.status(200).json({ data: null, message: "Logged out successfully" });
  }
);

// ─────────────────────────────────────────────
// GET /api/auth/me
// Returns the authenticated user's profile
// ─────────────────────────────────────────────
router.get(
  "/me",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ data: _req.user, message: "Success" });
  }
);

export default router;
