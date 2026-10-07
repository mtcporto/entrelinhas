import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
function handle(method) {
    return async (request) => {
        if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
            return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
        }
        try {
            return await toNextJsHandler(getAuth())[method](request);
        } catch (error) {
            console.error("Authentication service unavailable:", error.message);
            return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
        }
    };
}

export const GET = handle("GET");
export const POST = handle("POST");
