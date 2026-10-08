import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readerBooks } from "./reader-catalog.js";
import { parseEbook } from "./ebook-parser.js";

test("every catalogued public-domain text is present and parses into readable sections", async () => {
    for (const book of Object.values(readerBooks)) {
        const raw = await readFile(new URL(`../../public${book.textFile}`, import.meta.url), "utf8");
        const sections = parseEbook(raw, book.allowRomanHeadings, book.preserveLineBreaks);
        assert.ok(sections.length > 0, `${book.title} should have readable sections`);
        assert.ok(sections.some((section) => section.paragraphs.length > 0), `${book.title} should contain paragraphs`);
        if (book.preserveLineBreaks) assert.ok(sections.some((section) => section.paragraphs.some((paragraph) => paragraph.includes("\n"))), `${book.title} should preserve verse line breaks`);
        if (book.sourceName === "Wikisource") {
            assert.ok(book.sourceUrl, `${book.title} should credit its source`);
            assert.ok(book.sourceLicense && book.sourceLicenseUrl, `${book.title} should identify the transcription license`);
            assert.ok(!raw.includes("SECTION: undefined"), `${book.title} should have named sections`);
            assert.ok(sections.every((section) => section.paragraphs[0]?.trim().replace(/[.]$/, "").toLocaleLowerCase("pt-BR") !== section.heading.replace(/[.]$/, "").toLocaleLowerCase("pt-BR")), `${book.title} should not repeat section titles as body text`);
        }
    }
});
