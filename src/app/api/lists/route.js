import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

async function currentUser() {
    try {
        const session = await getAuth().api.getSession({ headers: await headers() });
        return { user: session?.user || null };
    } catch (error) {
        console.error("Authentication service unavailable:", error.message);
        return { error: true };
    }
}

export async function GET() {
    const auth = await currentUser();
    if (auth.error) return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
    const user = auth.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
        const result = await getDb().execute({
            sql: `SELECT l.id, l.name, b.book_id, b.book_data FROM reading_lists l
                  LEFT JOIN reading_list_books b ON b.list_id = l.id
                  WHERE l.user_id = ? ORDER BY l.created_at, b.created_at`,
            args: [user.id],
        });
        const lists = new Map();
        for (const row of result.rows) {
            if (!lists.has(row.id)) lists.set(row.id, { id: row.id, name: row.name, books: [] });
            if (row.book_id) lists.get(row.id).books.push(JSON.parse(row.book_data));
        }
        return NextResponse.json({ lists: [...lists.values()] }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Could not load reading lists:", error);
        return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    }
}

export async function PUT(request) {
    const auth = await currentUser();
    if (auth.error) return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
    const user = auth.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1_000_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    let payload;
    try { payload = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
    if (!Array.isArray(payload.lists) || payload.lists.length > 50) return NextResponse.json({ error: "invalid_lists" }, { status: 400 });
    const lists = payload.lists;
    if (lists.some((list) => typeof list.name !== "string" || !list.name.trim() || list.name.length > 80 || !Array.isArray(list.books) || list.books.length > 500 || list.books.some((book) => !book || typeof book.id !== "string" || book.id.length > 500))) {
        return NextResponse.json({ error: "invalid_list" }, { status: 400 });
    }
    if (new Set(lists.map((list) => list.id)).size !== lists.length || lists.reduce((count, list) => count + list.books.length, 0) > 1000) {
        return NextResponse.json({ error: "too_many_or_duplicate_items" }, { status: 400 });
    }
    const db = getDb();
    const now = Date.now();
    const statements = [
        { sql: "DELETE FROM reading_list_books WHERE list_id IN (SELECT id FROM reading_lists WHERE user_id = ?)", args: [user.id] },
        { sql: "DELETE FROM reading_lists WHERE user_id = ?", args: [user.id] },
        ...lists.flatMap((list) => [
            { sql: "INSERT INTO reading_lists (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: [list.id, user.id, list.name.trim(), now, now] },
            ...list.books.map((book) => ({ sql: "INSERT INTO reading_list_books (list_id, book_id, book_data, created_at) VALUES (?, ?, ?, ?)", args: [list.id, book.id, JSON.stringify(book), now] })),
        ]),
    ];
    try {
        await db.batch(statements, "write");
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Could not save reading lists:", error);
        return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    }
}
