import type { Request, Response, NextFunction } from "express";

export type UserRole = "admin" | "manager" | "intern";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.headers["x-user-role"] as UserRole | undefined;

    if (!userRole) {
      return res.status(401).json({ message: "Unauthorized: No role provided" });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden: Insufficient role permissions" });
    }

    next();
  };
}

export function extractUserId(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (userId) {
    (req as any).userId = userId;
  }
  next();
}
