import { createClient } from "@libsql/client";
import { editorialSeedProfiles } from "../src/lib/editorial-seed-data.js";

process.loadEnvFile(".env.local");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local");

const db = createClient({ url, authToken });
const statements = [
    { sql: `CREATE TABLE IF NOT EXISTS editorial_profiles (entity_type TEXT NOT NULL CHECK(entity_type IN ('author', 'work')), entity_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, editorial TEXT NOT NULL, themes_json TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL, PRIMARY KEY(entity_type, entity_id))` },
    { sql: `CREATE TABLE IF NOT EXISTS editorial_sources (entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL, url TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(entity_type, entity_id, url))` },
    { sql: "CREATE INDEX IF NOT EXISTS editorial_sources_entity_index ON editorial_sources(entity_type, entity_id)" },
];

const now = Date.now();
for (const profile of editorialSeedProfiles) {
    statements.push({
        sql: `INSERT INTO editorial_profiles (entity_type, entity_id, title, summary, editorial, themes_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(entity_type, entity_id) DO UPDATE SET title = excluded.title, summary = excluded.summary,
            editorial = excluded.editorial, themes_json = excluded.themes_json, updated_at = excluded.updated_at`,
        args: [profile.entityType, profile.entityId, profile.title, profile.summary, profile.editorial, JSON.stringify(profile.themes), now],
    });
    statements.push({ sql: "DELETE FROM editorial_sources WHERE entity_type = ? AND entity_id = ?", args: [profile.entityType, profile.entityId] });
    profile.sources.forEach((source, index) => statements.push({
        sql: "INSERT INTO editorial_sources (entity_type, entity_id, label, url, sort_order) VALUES (?, ?, ?, ?, ?)",
        args: [profile.entityType, profile.entityId, source.label, source.url, index],
    }));
}

await db.batch(statements, "write");
const [profiles, authors, works, sources] = await Promise.all([
    db.execute("SELECT COUNT(*) AS count FROM editorial_profiles"),
    db.execute("SELECT COUNT(*) AS count FROM editorial_profiles WHERE entity_type = 'author'"),
    db.execute("SELECT COUNT(*) AS count FROM editorial_profiles WHERE entity_type = 'work'"),
    db.execute("SELECT COUNT(*) AS count FROM editorial_sources"),
]);
console.log(`Seeded ${profiles.rows[0].count} profiles (${authors.rows[0].count} authors, ${works.rows[0].count} works) and ${sources.rows[0].count} source links.`);
await db.close();
