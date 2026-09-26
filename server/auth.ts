import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be configured in production.");
const signingSecret = JWT_SECRET ?? "vsm-train-development-secret-change-me";
const TOKEN_TTL = "8h";

export interface AuthIdentity {
  playerId: number;
  name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthIdentity;
    }
  }
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function issueToken(identity: AuthIdentity) {
  return jwt.sign(identity, signingSecret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AuthIdentity {
  const payload = jwt.verify(token, signingSecret);
  if (typeof payload !== "object" || payload === null) throw new Error("Invalid authentication token.");
  const { playerId, name, role } = payload as Partial<AuthIdentity>;
  if (!Number.isInteger(playerId) || typeof name !== "string" || (role !== "conductor" && role !== "supervisor"))
    throw new Error("Invalid authentication token.");
  return { playerId: playerId as number, name, role };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: "Требуется авторизация" });
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Недействительный или истёкший токен" });
  }
}

export const requireRole = (role: UserRole) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) return res.status(401).json({ message: "Требуется авторизация" });
  if (req.auth.role !== role) return res.status(403).json({ message: "Недостаточно прав" });
  next();
};
