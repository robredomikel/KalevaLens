import { neon } from '@neondatabase/serverless';

// Initialize the Neon SQL query tag using your environment variable
export const sql = neon(process.env.DATABASE_URL);
