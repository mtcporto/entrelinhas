"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Minus, Plus } from "lucide-react";

const PAGE_SIZE = 5;
const POSITION_KEY = "entrelinhas-reader-memorias-postumas";

function parseEbook(raw) {
    const lines = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
    const start = lines.findIndex((line) => line.includes("*** START OF THE PROJECT GUTENBERG EBOOK"));
    const end = lines.findIndex((line, index) => index > start && line.includes("*** END OF THE PROJECT GUTENBERG EBOOK"));
    if (start < 0 || end < 0) throw new Error("Arquivo incompleto");

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
        if (!line) { flushParagraph(); continue; }
        const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        if (/^CAPITULO\s+([IVXLCDM]+|\d+)$/.test(normalized) || /^(AO LEITOR|PROLOGO|POSFACIO)$/.test(normalized)) {
            flushSection();
            current = { heading: line, paragraphs: [] };
        } else paragraph.push(line);
    }
    flushSection();
    return sections;
}

export default function PublicDomainReader() {
    const [sections, setSections] = useState([]);
    const [error, setError] = useState(false);
    const [fontSize, setFontSize] = useState(19);
    const [chapterIndex, setChapterIndex] = useState(0);
    const [pageIndex, setPageIndex] = useState(0);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;
        fetch("/texts/memorias-postumas-de-bras-cubas.txt")
            .then((response) => { if (!response.ok) throw new Error("Livro indisponível"); return response.text(); })
            .then((text) => {
                if (!active) return;
                const parsed = parseEbook(text);
                setSections(parsed);
                try {
                    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
                    if (saved && Number.isInteger(saved.chapterIndex) && Number.isInteger(saved.pageIndex)) {
                        setChapterIndex(Math.max(0, Math.min(saved.chapterIndex, parsed.length - 1)));
                        setPageIndex(Math.max(0, saved.pageIndex));
                    }
                } catch { /* Ignore unavailable or malformed saved position. */ }
                setReady(true);
            })
            .catch(() => { if (active) { setError(true); setReady(true); } });
        return () => { active = false; };
    }, []);

    const chapter = sections[chapterIndex];
    const pages = chapter ? Array.from({ length: Math.ceil(chapter.paragraphs.length / PAGE_SIZE) }, (_, index) => chapter.paragraphs.slice(index * PAGE_SIZE, (index + 1) * PAGE_SIZE)) : [];
    const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
    const lastPage = safePageIndex === pages.length - 1;
    const isLastPage = chapterIndex === sections.length - 1 && lastPage;

    useEffect(() => {
        if (!ready || !chapter) return;
        try { localStorage.setItem(POSITION_KEY, JSON.stringify({ chapterIndex, pageIndex: safePageIndex })); } catch { /* Storage is optional. */ }
    }, [chapterIndex, safePageIndex, chapter, ready]);

    function goToChapter(index) {
        setChapterIndex(Math.max(0, Math.min(index, sections.length - 1)));
        setPageIndex(0);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function goToPage(index) {
        if (index >= pages.length) goToChapter(chapterIndex + 1);
        else if (index < 0 && chapterIndex > 0) {
            const previous = sections[chapterIndex - 1];
            setChapterIndex(chapterIndex - 1);
            setPageIndex(Math.max(0, Math.ceil(previous.paragraphs.length / PAGE_SIZE) - 1));
        } else if (index >= 0) setPageIndex(index);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    useEffect(() => {
        function onKeyDown(event) {
            if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement) return;
            if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); goToPage(safePageIndex + 1); }
            if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goToPage(safePageIndex - 1); }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

    return <main className="reader-shell">
        <header className="reader-topbar"><Link className="detail-back" href="/livros/OL1003017W"><ArrowLeft size={16} /> Sobre o livro</Link><span>ENTRELINHAS · LEITOR</span><div className="reader-controls"><button onClick={() => setFontSize((size) => Math.max(16, size - 1))} aria-label="Diminuir tamanho do texto"><Minus size={16} /></button><span>{fontSize}</span><button onClick={() => setFontSize((size) => Math.min(28, size + 1))} aria-label="Aumentar tamanho do texto"><Plus size={16} /></button></div></header>
        <article className="reader-book" style={{ "--reader-font-size": `${fontSize}px` }}>
            <header className="reader-title"><span className="eyebrow">MACHADO DE ASSIS · 1881</span><h1>Memórias Póstumas<br />de Brás Cubas</h1><p>Joaquim Maria Machado de Assis</p><span className="reader-rule" /></header>
            {error ? <div className="empty-state"><h2>Não foi possível abrir o texto.</h2><p>Tente novamente mais tarde ou consulte a fonte original.</p></div>
                : !ready ? <div className="loading-state">Preparando o texto para leitura…</div>
                    : chapter && <><div className="reader-page-meta"><span>{chapter.heading || "ABERTURA"}</span><span>Página {safePageIndex + 1} de {pages.length}</span></div><div className="reader-content" key={`${chapterIndex}-${safePageIndex}`}><section className="reader-chapter">
                        {chapter.heading && <h2>{chapter.heading}</h2>}
                        {(pages[safePageIndex] || []).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </section></div><nav className="reader-pagination" aria-label="Paginação do livro"><button onClick={() => goToChapter(0)} disabled={chapterIndex === 0 && safePageIndex === 0} aria-label="Ir para o início">«</button><button onClick={() => goToPage(safePageIndex - 1)} disabled={chapterIndex === 0 && safePageIndex === 0}>← <span>Anterior</span></button><label><span>Capítulo</span><select value={chapterIndex} onChange={(event) => goToChapter(Number(event.target.value))}>{sections.map((item, index) => <option value={index} key={`${item.heading}-${index}`}>{item.heading || "Abertura"}</option>)}</select></label><span className="reader-page-number">{chapterIndex + 1}/{sections.length} · {safePageIndex + 1}/{pages.length}</span><button onClick={() => goToPage(safePageIndex + 1)} disabled={isLastPage}><span>Próxima</span> →</button><button onClick={() => goToChapter(sections.length - 1)} disabled={isLastPage} aria-label="Ir para o fim">»</button></nav></>}
            <footer className="reader-credit"><strong>Sobre este texto</strong><p>Transcrição digital baseada no eBook 54829 do Project Gutenberg. A grafia histórica foi preservada; esta leitura adapta a organização em parágrafos para a tela.</p><p>A obra está em domínio público no Brasil. Machado de Assis morreu em 1908; a primeira edição, de 1881, está catalogada como domínio público pela Biblioteca Brasiliana Guita e José Mindlin, da USP.</p><div><a href="https://www.gutenberg.org/ebooks/54829" target="_blank" rel="noreferrer">Project Gutenberg · eBook 54829</a><a href="https://digital.bbm.usp.br/handle/bbm/4826" target="_blank" rel="noreferrer">Brasiliana USP · edição de 1881</a><a href="https://www.planalto.gov.br/ccivil_03/leis/l9610.htm" target="_blank" rel="noreferrer">Lei brasileira de direitos autorais · art. 41</a></div><Link href="/livros/OL1003017W">Voltar à página da obra</Link></footer>
        </article>
    </main>;
}
