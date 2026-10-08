import { createClient } from "@libsql/client";

process.loadEnvFile(".env.local");

const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;
if (!url || !authToken) throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local");

const db = createClient({ url, authToken });
const result = await db.execute("SELECT entity_id, title, cover_url FROM editorial_profiles WHERE entity_type = 'work' AND cover_url IS NOT NULL ORDER BY title");
for (const row of result.rows) console.log(`${row.entity_id}\t${row.title}\t${row.cover_url}`);
await db.close();
