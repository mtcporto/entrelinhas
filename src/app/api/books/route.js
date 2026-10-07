import { NextResponse } from "next/server";
import { searchBooks } from "@/lib/books";

export const runtime = "nodejs";

export async function GET(request) {
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "40", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 40;

    if (query.length < 2 || query.length > 4000) {
        return NextResponse.json({ error: "invalid_query" }, { status: 400 });
    }

    try {
        const catalog = await searchBooks(query, limit);
        return NextResponse.json(catalog, {
            headers: {
                "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400",
            },
        });
    } catch (error) {
        console.error("Open Library search failed:", error);
        const isRateLimited = error.status === 429;
        return NextResponse.json(
            { error: isRateLimited ? "catalog_rate_limited" : "catalog_unavailable" },
            {
                status: isRateLimited ? 503 : 502,
                headers: {
                    "Cache-Control": "no-store",
                    ...(isRateLimited ? { "Retry-After": "60" } : {}),
                },
            },
        );
    }
}
