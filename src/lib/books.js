const OPEN_LIBRARY_URL = "https://openlibrary.org/search.json";
const BOOK_FIELDS = [
    "key",
    "title",
    "author_name",
    "first_publish_year",
    "edition_count",
    "number_of_pages_median",
    "cover_i",
    "subject",
];

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
