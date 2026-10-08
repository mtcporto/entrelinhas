import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readerBooks } from "./reader-catalog.js";
import { parseEbook } from "./ebook-parser.js";
import { editorialSeedProfiles } from "./editorial-seed-data.js";

test("editorial profiles cover every catalogued author and full-text work with cited sources", () => {
    const authors = new Set(Object.values(readerBooks).map((book) => book.author.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")));
    const seededAuthors = editorialSeedProfiles.filter((profile) => profile.entityType === "author");
    const seededWorks = editorialSeedProfiles.filter((profile) => profile.entityType === "work");
    assert.equal(seededAuthors.length, authors.size, "every author should have an editorial profile");
    assert.equal(seededWorks.length, Object.keys(readerBooks).length, "every full-text work should have an editorial profile");
    for (const profile of editorialSeedProfiles) {
        assert.ok(profile.summary.trim(), `${profile.entityId} should have a summary or biography`);
        assert.ok(profile.editorial.trim(), `${profile.entityId} should have editorial context`);
        assert.ok(profile.sources.length > 0, `${profile.entityId} should cite sources`);
        assert.ok(profile.sources.every((source) => /^https:\/\//.test(source.url)), `${profile.entityId} source links should use HTTPS`);
    }
});

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
