import { createHash, createHmac } from 'crypto';
import { User } from '../drizzle/schema';
import * as db from './db';
import { ENV } from './_core/env';

/**
 * Validates the Telegram WebApp initData.
 * @param initData The data string received from Telegram.
 * @returns A map of the validated data.
 */
function validateInitData(initData: string): Map<string, string> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  if (!hash) {
    throw new Error('Invalid initData: hash is missing');
  }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHash('sha256').update(ENV.botToken).digest();
  const calculatedHash = createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    throw new Error('Invalid initData: hash check failed');
  }

  return params;
}

/**
 * Authenticates a user based on Telegram WebApp initData.
 * @param initData The data string received from Telegram.
 * @returns The authenticated User object from the database.
 */
export async function authenticateTelegramUser(initData: string): Promise<User> {
  const validatedData = validateInitData(initData);
  const userData = validatedData.get('user') || validatedData.get('receiver');

  if (!userData) {
    throw new Error('Invalid initData: user data is missing');
  }

  const userJson = JSON.parse(userData);
  const telegramId = String(userJson.id); // Telegram ID is the unique identifier

  // 1. Check if user exists in DB
  let user = await db.getUserByOpenId(telegramId);

  // 2. If user does not exist, create a new one
  if (!user) {
    const newUser: db.InsertUser = {
      openId: telegramId,
      name: userJson.first_name + (userJson.last_name ? ' ' + userJson.last_name : ''),
      email: null, // Telegram does not provide email
      loginMethod: 'telegram',
      lastSignedIn: new Date(),
    };

    await db.upsertUser(newUser);
    user = await db.getUserByOpenId(telegramId);
  }

  if (!user) {
    throw new Error('Failed to create or retrieve user');
  }

  // 3. Update last signed in time
  await db.upsertUser({
    openId: user.openId,
    lastSignedIn: new Date(),
  });

  return user;
}
