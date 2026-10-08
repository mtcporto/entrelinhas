import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { editorialSeedProfiles } from "@/lib/editorial-seed-data";

const seedById = new Map(editorialSeedProfiles.map((profile) => [`${profile.entityType}:${profile.entityId}`, profile]));

function parseJson(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}

export const getEditorialProfile = cache(async (entityType, entityId) => {
    const fallback = seedById.get(`${entityType}:${entityId}`) || null;
    try {
        const result = await getDb().execute({
            sql: "SELECT title, summary, editorial, themes_json, cover_url FROM editorial_profiles WHERE entity_type = ? AND entity_id = ? LIMIT 1",
            args: [entityType, entityId],
        });
        const row = result.rows[0];
        if (!row) return fallback;
        const sources = await getDb().execute({
            sql: "SELECT label, url FROM editorial_sources WHERE entity_type = ? AND entity_id = ? ORDER BY sort_order, label",
            args: [entityType, entityId],
        });
        return {
            entityType, entityId, title: row.title, summary: row.summary,
            editorial: row.editorial, themes: parseJson(row.themes_json, []), coverUrl: row.cover_url || null,
            sources: sources.rows.map(({ label, url }) => ({ label, url })),
        };
    } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("Editorial profile database unavailable; using bundled copy.", error.message);
        return fallback;
    }
});

export const getEditorialCovers = cache(async (entityIds) => {
    const ids = [...new Set(entityIds.filter(Boolean))];
    if (!ids.length) return {};
    try {
        const placeholders = ids.map(() => "?").join(", ");
        const result = await getDb().execute({
            sql: `SELECT entity_id, cover_url FROM editorial_profiles WHERE entity_type = 'work' AND cover_url IS NOT NULL AND entity_id IN (${placeholders})`,
            args: ids,
        });
        return Object.fromEntries(result.rows.map((row) => [row.entity_id, row.cover_url]));
    } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("Editorial covers unavailable; using catalog covers.", error.message);
        return {};
    }
});
