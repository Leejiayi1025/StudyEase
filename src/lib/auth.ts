import { getPool, uuid } from '@/storage/database/mysql-client';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

// Simple token-based auth (token = base64 of userId:phone:timestamp)
// In production, use JWT. This is a simplified version.

export function generateToken(userId: string, phone: string): string {
  const payload = `${userId}:${phone}:${Date.now()}`;
  return Buffer.from(payload).toString('base64');
}

export function parseToken(token: string): { userId: string; phone: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, phone] = decoded.split(':');
    if (!userId || !phone) return null;
    return { userId, phone };
  } catch {
    return null;
  }
}

// Get current user from request (cookie or header)
export async function getCurrentUser(request: NextRequest): Promise<{ id: string; phone: string; nickname: string } | null> {
  const token = request.cookies.get('auth_token')?.value
    || request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return null;

  const parsed = parseToken(token);
  if (!parsed) return null;

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, phone, nickname FROM users WHERE id = ? LIMIT 1`,
    [parsed.userId]
  );
  const user = (rows as Record<string, unknown>[])[0];
  if (!user) return null;

  return { id: user.id as string, phone: user.phone as string, nickname: user.nickname as string };
}

// Require auth - throws if not authenticated
export async function requireAuth(request: NextRequest): Promise<{ id: string; phone: string; nickname: string }> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('未登录');
  }
  return user;
}

// Register
export async function registerUser(phone: string, password: string, nickname?: string) {
  const pool = getPool();

  // Check if phone already exists
  const [existing] = await pool.execute(`SELECT id FROM users WHERE phone = ? LIMIT 1`, [phone]);
  if ((existing as Record<string, unknown>[]).length > 0) {
    throw new Error('该手机号已注册');
  }

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 10);
  const nick = nickname || `学习者${phone.slice(-4)}`;

  await pool.execute(
    `INSERT INTO users (id, phone, password_hash, nickname) VALUES (?, ?, ?, ?)`,
    [id, phone, passwordHash, nick]
  );

  return { id, phone, nickname: nick };
}

// Login
export async function loginUser(phone: string, password: string) {
  const pool = getPool();

  const [rows] = await pool.execute(
    `SELECT id, phone, password_hash, nickname FROM users WHERE phone = ? LIMIT 1`,
    [phone]
  );
  const user = (rows as Record<string, unknown>[])[0];
  if (!user) {
    throw new Error('手机号或密码错误');
  }

  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) {
    throw new Error('手机号或密码错误');
  }

  return { id: user.id as string, phone: user.phone as string, nickname: user.nickname as string };
}
