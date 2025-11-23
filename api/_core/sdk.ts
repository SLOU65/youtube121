import type { Request } from "express";
type User = any;

class SDKServer {
  constructor() {}

  // Поскольку мы полностью отказались от аутентификации, 
  // эта функция всегда возвращает null.
  async authenticateRequest(req: Request): Promise<User | null> {
    return null;
  }
}

export const sdk = new SDKServer();
