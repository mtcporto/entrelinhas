import { createClient } from "@libsql/client";

process.loadEnvFile(".env.local");

const [workId, coverUrl] = process.argv.slice(2);
if (!workId || !/^(OL\d+W|PG\d+|WS\d+)$/.test(workId)) {
    throw new Error("Usage: npm run cover:set -- <workId> <https-cover-url>");
}
const parsedUrl = new URL(coverUrl || "");
if (parsedUrl.protocol !== "https:" || !/^\/covers\/[a-z0-9-]+\.webp$/.test(parsedUrl.pathname)) {
    throw new Error("Cover URL must be HTTPS and point to a .webp file under /covers/");
}

const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;
if (!url || !authToken) throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local");

const db = createClient({ url, authToken });
const result = await db.execute({
    sql: "UPDATE editorial_profiles SET cover_url = ? WHERE entity_type = 'work' AND entity_id = ?",
    args: [parsedUrl.href, workId],
});
await db.close();
if (result.rowsAffected !== 1) throw new Error(`No editorial work profile found for ${workId}`);
console.log(`Updated cover URL for ${workId}.`);
