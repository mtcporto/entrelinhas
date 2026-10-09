import { createClient } from "@libsql/client";

process.loadEnvFile(".env.local");

const [authorId, imageUrl, sourceLabel, sourceUrl] = process.argv.slice(2);
if (!authorId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(authorId) || !imageUrl || !sourceLabel || !sourceUrl) {
    throw new Error("Usage: npm run portrait:set -- <author-slug> <r2-webp-url> <source-label> <source-url>");
}

const image = new URL(imageUrl);
if (image.protocol !== "https:" || image.hostname !== "entrelinhas-assets.mosaicoworkers.workers.dev" || !new RegExp(`^/authors/${authorId}-v[1-9][0-9]*\\.webp$`).test(image.pathname)) {
    throw new Error("Portrait URL must point to a versioned WebP in the Entrelinhas R2 authors path");
}
const source = new URL(sourceUrl);
if (source.protocol !== "https:") throw new Error("Portrait source URL must use HTTPS");

const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;
if (!url || !authToken) throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local");

const db = createClient({ url, authToken });
const transaction = await db.transaction("write");
try {
    const result = await transaction.execute({
        sql: "UPDATE editorial_profiles SET cover_url = ?, updated_at = ? WHERE entity_type = 'author' AND entity_id = ?",
        args: [image.href, Date.now(), authorId],
    });
    if (result.rowsAffected !== 1) throw new Error(`No editorial author profile found for ${authorId}`);

    await transaction.execute({
        sql: "DELETE FROM editorial_sources WHERE entity_type = 'author' AND entity_id = ? AND label LIKE 'Retrato ·%'",
        args: [authorId],
    });
    await transaction.execute({
        sql: "INSERT INTO editorial_sources (entity_type, entity_id, label, url, sort_order) VALUES ('author', ?, ?, ?, -1)",
        args: [authorId, `Retrato · ${sourceLabel}`, source.href],
    });
    await transaction.commit();
} catch (error) {
    await transaction.rollback();
    throw error;
} finally {
    await db.close();
}

console.log(`Updated portrait for ${authorId}.`);
