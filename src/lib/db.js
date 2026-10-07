import { createClient } from "@libsql/client";

let client;
export function getDb() {
    if (!client) {
        const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;
        if (!url || !authToken) throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN precisam estar configurados");
        client = createClient({ url, authToken });
    }
    return client;
}
