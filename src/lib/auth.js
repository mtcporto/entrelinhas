import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/libsql";
import { getDb } from "@/lib/db";
import { authSchema } from "@/lib/auth-schema";

let authInstance;
export function getAuth() {
    if (!authInstance) {
        const secret = process.env.BETTER_AUTH_SECRET;
        if (!secret && process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET precisa estar configurado");
        const database = getDb();
        const baseURL = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const socialProviders = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
            google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
        } : {};
        authInstance = betterAuth({
            database: drizzleAdapter(drizzle(database, { schema: authSchema }), { provider: "sqlite", schema: authSchema }),
            secret: secret || "local-development-secret-change-before-production-32chars",
            baseURL,
            basePath: "/api/auth",
            trustedOrigins: [baseURL, "http://localhost:3000"],
            emailAndPassword: { enabled: true, minPasswordLength: 8 },
            socialProviders,
        });
    }
    return authInstance;
}
