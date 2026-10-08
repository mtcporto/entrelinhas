import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readerBooks } from "./reader-catalog.js";
import { parseEbook } from "./ebook-parser.js";

test("every catalogued public-domain text is present and parses into readable sections", async () => {
    for (const book of Object.values(readerBooks)) {
        const raw = await readFile(new URL(`../../public${book.textFile}`, import.meta.url), "utf8");
        const sections = parseEbook(raw, book.allowRomanHeadings);
        assert.ok(sections.length > 0, `${book.title} should have readable sections`);
        assert.ok(sections.some((section) => section.paragraphs.length > 0), `${book.title} should contain paragraphs`);
    }
});
