import test from "node:test";
import assert from "node:assert/strict";
import { deduplicateBooks } from "./books.js";

test("deduplicates spelling variants for the same title and author, keeping the richer record", () => {
    const books = deduplicateBooks([
        { id: "/works/OL1W", title: "Memórias Póstumas de Brás Cubas", authors: ["Machado de Assis"], editions: 1 },
        { id: "/works/OL2W", title: "Memorias Postumas de Bras Cubas", authors: ["MACHADO DE ASSIS", "Translator"], editions: 149, coverUrl: "/cover.jpg" },
    ]);
    assert.equal(books.length, 1);
    assert.equal(books[0].id, "/works/OL2W");
});

test("keeps distinct authors, titled volumes, and records without author data separate", () => {
    const books = deduplicateBooks([
        { id: "/works/OL1W", title: "O Guarani", authors: ["José de Alencar"] },
        { id: "/works/OL2W", title: "O Guarani, volume 2", authors: ["José de Alencar"] },
        { id: "/works/OL3W", title: "O Guarani", authors: ["Outro autor"] },
        { id: "/works/OL4W", title: "O Guarani", authors: [] },
        { id: "/works/OL5W", title: "O Guarani", authors: [] },
    ]);
    assert.equal(books.length, 5);
});
