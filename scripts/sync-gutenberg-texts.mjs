import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readerBooks } from "../src/lib/reader-catalog.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const books = Object.values(readerBooks);
let downloaded = 0;

for (let start = 0; start < books.length; start += 3) {
    await Promise.all(books.slice(start, start + 3).map(async (book) => {
        const output = join(root, "public", book.textFile.replace(/^\//, ""));
        try {
            await access(output);
            return;
        } catch {}

        const response = await fetch(`https://www.gutenberg.org/cache/epub/${book.gutenbergId}/pg${book.gutenbergId}.txt`);
        if (!response.ok) throw new Error(`eBook ${book.gutenbergId}: HTTP ${response.status}`);
        const text = await response.text();
        if (!/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.test(text)
            || !/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.test(text)) {
            throw new Error(`eBook ${book.gutenbergId}: Gutenberg text markers not found`);
        }
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, text, "utf8");
        downloaded += 1;
        console.log(`${book.gutenbergId}: ${book.title} (${text.length} characters)`);
    }));
}

console.log(`Downloaded ${downloaded} new texts; ${books.length - downloaded} were already present.`);
