const COVER_KEY_PATTERN = /^covers\/[a-z0-9-]+\.webp$/;

export default {
    async fetch(request, env) {
        if (request.method !== "GET" && request.method !== "HEAD") {
            return new Response("Method Not Allowed", {
                status: 405,
                headers: { Allow: "GET, HEAD" },
            });
        }

        const key = new URL(request.url).pathname.slice(1);
        if (!COVER_KEY_PATTERN.test(key)) return new Response("Not Found", { status: 404 });

        const object = await env.COVERS.get(key);
        if (!object) return new Response("Not Found", { status: 404 });

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("ETag", object.httpEtag);
        headers.set("Content-Type", "image/webp");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set("X-Content-Type-Options", "nosniff");

        return new Response(request.method === "HEAD" ? null : object.body, { headers });
    },
};
