export function parseEbook(raw, allowRomanHeadings = false) {
    const lines = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
    const start = lines.findIndex((line) => line.includes("*** START OF THE PROJECT GUTENBERG EBOOK"));
    const end = lines.findIndex((line, index) => index > start && line.includes("*** END OF THE PROJECT GUTENBERG EBOOK"));
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
    return sections;
}
