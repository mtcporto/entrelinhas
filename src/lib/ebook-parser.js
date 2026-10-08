export function parseEbook(raw, allowRomanHeadings = false) {
    const lines = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
    const start = lines.findIndex((line) => /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.test(line));
    const end = lines.findIndex((line, index) => index > start && /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.test(line));
    if (start < 0 || end < 0) throw new Error("Arquivo incompleto");

    const sections = [];
    let current = { heading: "", paragraphs: [] };
    let paragraph = [];
    let started = false;
    const flushParagraph = () => {
        const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
        if (text) current.paragraphs.push(text);
        paragraph = [];
    };
    const flushSection = () => {
        flushParagraph();
        if (started && (current.heading || current.paragraphs.length)) sections.push(current);
    };

    for (const rawLine of lines.slice(start + 1, end)) {
        const line = rawLine.trim();
        if (!line) { flushParagraph(); continue; }
        const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[.:]+$/, "").trim();
        const isHeading = /^CAPITULO\s+(?:[IVXLCDM]+|\d+|PRIMEIRO|SEGUNDO|TERCEIRO|QUARTO|QUINTO|SEXTO|SETIMO|OITAVO|NONO|DECIMO)$/.test(normalized)
            || /^(AO LEITOR|PROLOGO|POSFACIO)$/.test(normalized)
            || (allowRomanHeadings && /^[IVXLCDM]{1,8}$/.test(normalized));
        if (isHeading) {
            flushSection();
            current = { heading: line, paragraphs: [] };
            started = true;
        } else if (started) paragraph.push(line);
    }
    flushSection();
    if (!started) {
        const paragraphs = [];
        let fallbackParagraph = [];
        const flushFallbackParagraph = () => {
            const text = fallbackParagraph.join(" ").replace(/\s+/g, " ").trim();
            if (text) paragraphs.push(text);
            fallbackParagraph = [];
        };
        for (const rawLine of lines.slice(start + 1, end)) {
            const line = rawLine.trim();
            if (line) fallbackParagraph.push(line);
            else flushFallbackParagraph();
        }
        flushFallbackParagraph();
        if (paragraphs.length) return [{ heading: "", paragraphs }];
    }
    return sections;
}
