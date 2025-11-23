import type { Request } from "express";
import type { User } from "../../drizzle/schema";

class SDKServer {
  constructor() {}

  // Поскольку мы полностью отказались от аутентификации, 
  // эта функция всегда возвращает null.
  async authenticateRequest(req: Request): Promise<User | null> {
    return null;
  }
}

export const sdk = new SDKServer();
