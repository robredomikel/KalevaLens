'use server';

import { neon } from '@neondatabase/serverless';
import { persistUserPreferences } from '@/lib/preferences/service';

const sql = neon(process.env.DATABASE_URL);

/**
 * Simple Web Crypto SHA-256 password hasher for secure storage
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Register a new user account and save initial preferences
 */
export async function registerUser({ name, email, password, community, preferences }) {
  if (!name || !email || !password) {
    return { success: false, error: 'Please fill in all required fields.' };
  }

  try {
    // 1. Check if user already exists
    const existing = await sql`
      SELECT id FROM "User" WHERE email = ${email.toLowerCase().trim()} LIMIT 1;
    `;

    if (existing.length > 0) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Insert user into database (defaults role to 'READER' unless specified)
    const newUserResult = await sql`
      INSERT INTO "User" (name, email, "passwordHash", community, "createdAt", "updatedAt")
      VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${passwordHash}, ${community}, NOW(), NOW())
      RETURNING id, name, email, community, role;
    `;

    const user = newUserResult[0];

    // 4. Save their initial content preferences
    if (preferences) {
      await persistUserPreferences(user.id, {
        ...preferences,
        onboardingCompleted: false,
        onboardingCompletedAt: null
      });
    }

    return { success: true, user };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message || 'Database registration failed.' };
  }
}

/**
 * Authenticate an existing user by email and password
 */
export async function loginUser({ email, password }) {
  if (!email || !password) {
    return { success: false, error: 'Please enter both email and password.' };
  }

  try {
    const passwordHash = await hashPassword(password);

    const rows = await sql`
      SELECT id, name, email, community, role 
      FROM "User" 
      WHERE email = ${email.toLowerCase().trim()} AND "passwordHash" = ${passwordHash} 
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return { success: false, error: 'Invalid email or password.' };
    }

    return { success: true, user: rows[0] };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Authentication failed. Please try again.' };
  }
}
