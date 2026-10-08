const OPEN_LIBRARY_URL = "https://openlibrary.org/search.json";
const BOOK_FIELDS = [
    "key",
    "title",
    "author_name",
    "author_key",
    "first_publish_year",
    "edition_count",
    "number_of_pages_median",
    "cover_i",
    "subject",
];

const OPEN_LIBRARY_ROOT = "https://openlibrary.org";

export async function getOpenLibraryJson(path) {
    const [pathname, query] = path.split("?", 2);
    if (!/^\/(works|authors)\/OL\d+[WA](?:\/works\.json)?$/.test(pathname)) {
        throw new Error("Identificador Open Library inválido");
    }
    const apiPath = pathname.endsWith(".json") ? pathname : `${pathname}.json`;
    const response = await fetch(`${OPEN_LIBRARY_ROOT}${apiPath}${query ? `?${query}` : ""}`, {
        headers: {
            Accept: "application/json",
            "User-Agent": process.env.OPEN_LIBRARY_USER_AGENT || "Entrelinhas/1.0 (+https://livros-five-plum.vercel.app)",
        },
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
        const error = new Error(`Open Library respondeu com HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

export async function searchAuthorWorks(authorId, limit = 40) {
    if (!/^OL\d+A$/.test(authorId)) throw new Error("Identificador Open Library inválido");
    const url = new URL(OPEN_LIBRARY_URL);
    url.searchParams.set("q", `author_key:${authorId} language:por`);
    url.searchParams.set("fields", ["key", "title", "author_name", "author_key", "first_publish_year", "edition_count", "cover_i"].join(","));
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": process.env.OPEN_LIBRARY_USER_AGENT || "Entrelinhas/1.0 (+https://livros-five-plum.vercel.app)",
        },
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
        const error = new Error(`Open Library respondeu com HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    const result = await response.json();
    const worksByIdentity = new Map();
    for (const book of result.docs || []) {
        const title = normalizedIdentityPart(book.title);
        if (!title) continue;
        const identity = `${title}|${authorId}`;
        const current = worksByIdentity.get(identity);
        const score = (candidate) => (candidate.edition_count || 0) * 10 + (candidate.cover_i ? 2 : 0);
        if (!current || score(book) > score(current)) worksByIdentity.set(identity, book);
    }
    return [...worksByIdentity.values()];
}

export async function searchWorkRecord(workId) {
    if (!/^OL\d+W$/.test(workId)) throw new Error("Identificador Open Library inválido");
    const url = new URL(OPEN_LIBRARY_URL);
    url.searchParams.set("q", `key:"/works/${workId}"`);
    url.searchParams.set("fields", ["key", "title", "author_name", "author_key", "first_publish_year", "edition_count", "number_of_pages_median", "cover_i"].join(","));
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": process.env.OPEN_LIBRARY_USER_AGENT || "Entrelinhas/1.0 (+https://livros-five-plum.vercel.app)",
        },
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.docs?.[0] || null;
}

export async function searchBooks(query, limit = 40) {
    const url = new URL(OPEN_LIBRARY_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("fields", BOOK_FIELDS.join(","));
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));

    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": process.env.OPEN_LIBRARY_USER_AGENT || "Entrelinhas/1.0 (+https://livros-five-plum.vercel.app)",
        },
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
        const error = new Error(`Open Library respondeu com HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }

    const catalog = await response.json();
    return {
        totalItems: catalog.numFound || 0,
        items: catalog.docs || [],
    };
}

export function normalizeBook(book) {
    const workKey = book.key || "";
    return {
        id: workKey || `${book.title}-${(book.author_name || []).join(",")}`,
        title: book.title || "Título não informado",
        authors: book.author_name || [],
        authorKeys: book.author_key || [],
        firstPublished: book.first_publish_year || null,
        pageCount: book.number_of_pages_median || null,
        editions: book.edition_count || 0,
        subjects: book.subject || [],
        coverUrl: book.cover_i
            ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
            : null,
        infoUrl: workKey ? `https://openlibrary.org${workKey}` : null,
    };
}

function normalizedIdentityPart(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Collapse duplicate Open Library work records without merging distinct titled volumes. */
export function deduplicateBooks(books = []) {
    const unique = new Map();
    for (const book of books) {
        const title = normalizedIdentityPart(book.title);
        const primaryAuthor = normalizedIdentityPart(book.authors?.[0]);
        // Open Library sometimes records translators/editors as extra authors; use the lead author.
        // Without an author, title alone is too weak to establish that two records are one work.
        const identity = title && primaryAuthor ? `${title}|${primaryAuthor}` : `id:${book.id || `unknown-${unique.size}`}`;
        const current = unique.get(identity);
        const score = (candidate) => (candidate.editions || 0) * 10 + (candidate.coverUrl ? 2 : 0) + (candidate.pageCount ? 1 : 0);
        if (!current || score(book) > score(current)) unique.set(identity, book);
    }
    return [...unique.values()];
}
