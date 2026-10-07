import { createHash } from "node:crypto";
import { getDb } from "./db.js";

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS author_biography_translations (
    author_id TEXT PRIMARY KEY,
    source_hash TEXT NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    model TEXT NOT NULL,
    updated_at INTEGER NOT NULL
)`;

function translationConfig() {
    const baseUrl = process.env.OPENAI_BASE_URL || process.env.base_url;
    const model = process.env.OPENAI_MODEL || process.env.modelo || "gpt-4o";
    const apiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key || "";
    if (!baseUrl) return null;
    return { baseUrl: baseUrl.replace(/\/+$/, ""), model, apiKey };
}

async function requestTranslation(source, { baseUrl, model, apiKey }) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
                { role: "system", content: "Você traduz biografias para português brasileiro. Traduza com fidelidade, preserve nomes próprios, datas, títulos e citações. Não acrescente fatos. Se o texto já estiver em português, devolva-o sem mudanças. Responda somente com o texto traduzido." },
                { role: "user", content: source.slice(0, 16000) },
            ],
        }),
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Serviço de tradução respondeu HTTP ${response.status}`);
    const result = await response.json();
    const text = result.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Serviço de tradução retornou uma resposta vazia");
    return text;
}

export async function getPortugueseAuthorBio(authorId, sourceText) {
    const source = sourceText?.trim();
    if (!source) return { text: "", translated: false, unavailable: false };
    const config = translationConfig();
    if (!config) return { text: source, translated: false, unavailable: false };

    const sourceHash = createHash("sha256").update(source).digest("hex");
    try {
        const db = getDb();
        await db.execute(TABLE_SQL);
        const cached = await db.execute({
            sql: "SELECT source_hash, translated_text FROM author_biography_translations WHERE author_id = ? LIMIT 1",
            args: [authorId],
        });
        const existing = cached.rows[0];
        if (existing?.source_hash === sourceHash && typeof existing.translated_text === "string" && existing.translated_text) {
            return { text: existing.translated_text, translated: true, unavailable: false };
        }

        const translatedText = await requestTranslation(source, config);
        await db.execute({
            sql: `INSERT INTO author_biography_translations (author_id, source_hash, source_text, translated_text, model, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(author_id) DO UPDATE SET source_hash = excluded.source_hash, source_text = excluded.source_text,
                translated_text = excluded.translated_text, model = excluded.model, updated_at = excluded.updated_at`,
            args: [authorId, sourceHash, source, translatedText, config.model, Date.now()],
        });
        return { text: translatedText, translated: true, unavailable: false };
    } catch (error) {
        console.error("Could not translate/cache author biography:", error);
        return { text: source, translated: false, unavailable: true };
    }
}
