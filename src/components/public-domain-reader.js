"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus } from "lucide-react";

function parseEbook(raw) {
    const lines = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
    const start = lines.findIndex((line) => line.includes("*** START OF THE PROJECT GUTENBERG EBOOK"));
    const end = lines.findIndex((line, index) => index > start && line.includes("*** END OF THE PROJECT GUTENBERG EBOOK"));
    if (start < 0 || end < 0) throw new Error("O arquivo do livro está incompleto.");

    const sections = [];
    let current = { heading: "", paragraphs: [] };
    let paragraph = [];
    const flushParagraph = () => {
        const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
        if (text) current.paragraphs.push(text);
        paragraph = [];
    };
    const flushSection = () => {
        flushParagraph();
        if (current.heading || current.paragraphs.length) sections.push(current);
    };

    for (const rawLine of lines.slice(start + 1, end)) {
        const line = rawLine.trim();
        if (!line) {
            flushParagraph();
            continue;
        }
        const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const isHeading = /^CAPITULO\s+([IVXLCDM]+|\d+)$/.test(normalized) || /^(AO LEITOR|PROLOGO|POSFACIO)$/.test(normalized);
        if (isHeading) {
            flushSection();
            current = { heading: line, paragraphs: [] };
        } else {
            paragraph.push(line);
        }
    }
    flushSection();
    return sections;
}

export default function PublicDomainReader() {
    const [sections, setSections] = useState([]);
    const [error, setError] = useState(false);
    const [fontSize, setFontSize] = useState(19);

    useEffect(() => {
        let active = true;
        fetch("/texts/memorias-postumas-de-bras-cubas.txt")
            .then((response) => {
                if (!response.ok) throw new Error("Livro indisponível");
                return response.text();
            })
            .then((text) => {
                if (active) setSections(parseEbook(text));
            })
            .catch(() => { if (active) setError(true); });
        return () => { active = false; };
    }, []);

    return <main className="reader-shell">
        <header className="reader-topbar"><Link className="detail-back" href="/livros/OL1003017W"><ArrowLeft size={16} /> Sobre o livro</Link><span>ENTRELINHAS · LEITOR</span><div className="reader-controls"><button onClick={() => setFontSize((size) => Math.max(16, size - 1))} aria-label="Diminuir tamanho do texto"><Minus size={16} /></button><span>{fontSize}</span><button onClick={() => setFontSize((size) => Math.min(28, size + 1))} aria-label="Aumentar tamanho do texto"><Plus size={16} /></button></div></header>
        <article className="reader-book" style={{ "--reader-font-size": `${fontSize}px` }}>
            <header className="reader-title"><span className="eyebrow">MACHADO DE ASSIS · 1881</span><h1>Memórias Póstumas<br />de Brás Cubas</h1><p>Joaquim Maria Machado de Assis</p><span className="reader-rule" /></header>
            {error ? <div className="empty-state"><h2>Não foi possível abrir o texto.</h2><p>Tente novamente mais tarde ou consulte a fonte original.</p></div>
                : !sections.length ? <div className="loading-state">Preparando o texto para leitura…</div>
                    : <div className="reader-content">{sections.map((section, index) => <section className="reader-chapter" key={`${section.heading}-${index}`}>
                        {section.heading && <h2>{section.heading}</h2>}
                        {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                    </section>)}</div>}
            <footer className="reader-credit"><strong>Sobre este texto</strong><p>Transcrição digital baseada no eBook 54829 do Project Gutenberg. A grafia histórica foi preservada; esta leitura adapta a organização em parágrafos para a tela.</p><p>A obra está em domínio público no Brasil. Machado de Assis morreu em 1908; a primeira edição, de 1881, está catalogada como domínio público pela Biblioteca Brasiliana Guita e José Mindlin, da USP.</p><div><a href="https://www.gutenberg.org/ebooks/54829" target="_blank" rel="noreferrer">Project Gutenberg · eBook 54829</a><a href="https://digital.bbm.usp.br/handle/bbm/4826" target="_blank" rel="noreferrer">Brasiliana USP · edição de 1881</a><a href="https://www.planalto.gov.br/ccivil_03/leis/l9610.htm" target="_blank" rel="noreferrer">Lei brasileira de direitos autorais · art. 41</a></div><Link href="/livros/OL1003017W">Voltar à página da obra</Link></footer>
        </article>
    </main>;
}
