import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { authenticateTelegramUser } from "../telegramAuth";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class SDKServer {
  constructor() {}

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: "telegram-miniapp", // Use a static App ID for Telegram
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        typeof name !== "string" // Name can be empty
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    // 1. Check for Telegram WebApp initData in headers (passed from client)
    const initData = req.headers["x-telegram-init-data"] as string | undefined;

    if (initData) {
      try {
        // ... (строки 111-114 остаются без изменений)
        const user = await authenticateTelegramUser(initData);
        // Create a session token for the user and set it as a cookie
       const sessionToken = await this.createSessionToken(user.openId, { name: user.name || "User" });;
        
        // --- ИСПРАВЛЕНИЕ ДЛЯ КУКИ ---
        // Устанавливаем SameSite=None и Secure=true для работы в iframe Telegram
        // Добавляем domain: ".tgyoubotsup.fun" для работы в поддомене Render
        req.res.cookie(COOKIE_NAME, sessionToken, {
          maxAge: ONE_YEAR_MS,
          httpOnly: true,
          secure: true, // Должно быть true для SameSite=None
          sameSite: "none", // Критично для кросс-доменной установки куки в iframe
          domain: ENV.isProduction ? ".tgyoubotsup.fun" : undefined, // Помогает браузеру понять, куда привязать куки
        } );
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

        return user;
      } catch (error) {
        console.error("[Auth] Telegram initData validation failed:", error);
        throw ForbiddenError("Invalid Telegram WebApp data");
      }
    }

    // 2. Fallback to session cookie authentication (for non-MiniApp or if session is already established)
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    // User should already be in DB if session is valid, but check just in case
    if (!user) {
        console.error("[Auth] Failed to retrieve user from DB after session validation");
        throw ForbiddenError("User session is invalid or expired");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
