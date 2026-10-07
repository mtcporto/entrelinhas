import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
    if (process.env.ENABLE_SCHEMA_SETUP !== "true") return NextResponse.json({ error: "disabled" }, { status: 404 });
    const expected = process.env.SCHEMA_SETUP_TOKEN;
    if (!expected) return NextResponse.json({ error: "setup_token_missing" }, { status: 503 });
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== expected) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (expected.length < 32) return NextResponse.json({ error: "setup_token_too_short" }, { status: 503 });

    const statements = [
        `CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, email_verified INTEGER NOT NULL DEFAULT 0, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT, user_id TEXT NOT NULL)`,
        `CREATE INDEX IF NOT EXISTS session_user_id_index ON session(user_id)`,
        `CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, user_id TEXT NOT NULL, access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, issuer TEXT NOT NULL DEFAULT '', UNIQUE(issuer, account_id))`,
        `CREATE INDEX IF NOT EXISTS account_user_id_index ON account(user_id)`,
        `CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
        `CREATE INDEX IF NOT EXISTS verification_identifier_index ON verification(identifier)`,
        `CREATE TABLE IF NOT EXISTS reading_lists (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
        `CREATE INDEX IF NOT EXISTS reading_lists_user_id_index ON reading_lists(user_id)`,
        `CREATE TABLE IF NOT EXISTS reading_list_books (list_id TEXT NOT NULL, book_id TEXT NOT NULL, book_data TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(list_id, book_id))`,
    ];
    try {
        await getDb().batch(statements.map((sql) => ({ sql })), "write");
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Schema setup failed:", error);
        return NextResponse.json({ error: "schema_setup_failed" }, { status: 503 });
    }
}
