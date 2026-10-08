import LibraryApp from "@/components/library-app";
import { deduplicateBooks, normalizeBook, searchBooks } from "@/lib/books";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    let initialBooks = [];

    try {
        const catalog = await searchBooks('subject:"Brazilian literature"', 40);
        initialBooks = deduplicateBooks(catalog.items.map(normalizeBook));
    } catch (error) {
        console.error("Initial book catalog unavailable:", error);
    }

    return <LibraryApp initialBooks={initialBooks} googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
