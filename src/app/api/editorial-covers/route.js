import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
    try {
        const result = await getDb().execute(
            "SELECT entity_id, cover_url FROM editorial_profiles WHERE entity_type = 'work' AND cover_url IS NOT NULL",
        );
        const covers = Object.fromEntries(result.rows.map((row) => [row.entity_id, row.cover_url]));
        return NextResponse.json(covers, {
            headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" },
        });
    } catch (error) {
        console.error("Could not load editorial covers:", error);
        return NextResponse.json({ error: "covers_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
}
