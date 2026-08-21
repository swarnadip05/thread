import type { UserRole } from "@thread/types";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        readonly userId: string;
        readonly roles: readonly UserRole[];
        readonly sessionFamilyId: string;
      };
    }
  }
}

export {};
