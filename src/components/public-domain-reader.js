"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { parseEbook } from "@/lib/ebook-parser";

const PAGE_SIZE = 5;
const POSITION_KEY = "entrelinhas-reader-position";

export default function PublicDomainReader({ book }) {
    const [sections, setSections] = useState([]);
    const [error, setError] = useState(false);
    const [fontSize, setFontSize] = useState(19);
    const [chapterIndex, setChapterIndex] = useState(0);
    const [pageIndex, setPageIndex] = useState(0);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;
        setReady(false);
        setError(false);
        fetch(book.textFile)
            .then((response) => { if (!response.ok) throw new Error("Livro indisponível"); return response.text(); })
            .then((text) => {
                if (!active) return;
                const parsed = parseEbook(text, book.allowRomanHeadings);
                if (!parsed.length) throw new Error("Nenhum capítulo reconhecido");
                setSections(parsed);
                try {
                    const saved = JSON.parse(localStorage.getItem(`${POSITION_KEY}:${book.workId}`) || "null");
                    if (saved && Number.isInteger(saved.chapterIndex) && Number.isInteger(saved.pageIndex)) {
                        setChapterIndex(Math.max(0, Math.min(saved.chapterIndex, parsed.length - 1)));
                        setPageIndex(Math.max(0, saved.pageIndex));
                    } else {
                        setChapterIndex(0);
                        setPageIndex(0);
                    }
                } catch {
                    setChapterIndex(0);
                    setPageIndex(0);
                }
                setReady(true);
            })
            .catch(() => { if (active) { setError(true); setReady(true); } });
        return () => { active = false; };
    }, [book.textFile, book.allowRomanHeadings, book.workId]);

    const chapter = sections[chapterIndex];
    const pages = chapter ? Array.from({ length: Math.ceil(chapter.paragraphs.length / PAGE_SIZE) }, (_, index) => chapter.paragraphs.slice(index * PAGE_SIZE, (index + 1) * PAGE_SIZE)) : [];
    const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
    const lastPage = safePageIndex === pages.length - 1;
    const isLastPage = chapterIndex === sections.length - 1 && lastPage;

    useEffect(() => {
        if (!ready || !chapter) return;
        try { localStorage.setItem(`${POSITION_KEY}:${book.workId}`, JSON.stringify({ chapterIndex, pageIndex: safePageIndex })); } catch { /* Storage is optional. */ }
    }, [book.workId, chapterIndex, safePageIndex, chapter, ready]);

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
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (index >= 0) {
            setPageIndex(index);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
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
        <header className="reader-topbar"><Link className="detail-back" href={`/livros/${book.workId}`}><ArrowLeft size={16} /> Sobre o livro</Link><span>ENTRELINHAS · LEITOR</span><div className="reader-controls"><button onClick={() => setFontSize((size) => Math.max(16, size - 1))} aria-label="Diminuir tamanho do texto"><Minus size={16} /></button><span>{fontSize}</span><button onClick={() => setFontSize((size) => Math.min(28, size + 1))} aria-label="Aumentar tamanho do texto"><Plus size={16} /></button></div></header>
        <article className="reader-book" style={{ "--reader-font-size": `${fontSize}px` }}>
            <header className="reader-title"><span className="eyebrow">{book.author.toLocaleUpperCase("pt-BR")} · {book.year}</span><h1>{book.title}</h1><p>{book.author}</p><span className="reader-rule" /></header>
            {error ? <div className="empty-state"><h2>Não foi possível abrir o texto.</h2><p>Tente novamente mais tarde ou consulte a fonte original.</p></div>
                : !ready ? <div className="loading-state">Preparando o texto para leitura…</div>
                    : chapter && <><div className="reader-page-meta"><span>{chapter.heading || "ABERTURA"}</span><span>Página {safePageIndex + 1} de {pages.length}</span></div><div className="reader-content" key={`${chapterIndex}-${safePageIndex}`}><section className="reader-chapter">
                        {chapter.heading && <h2>{chapter.heading}</h2>}
                        {(pages[safePageIndex] || []).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </section></div><nav className="reader-pagination" aria-label="Paginação do livro"><button onClick={() => goToChapter(0)} disabled={chapterIndex === 0 && safePageIndex === 0} aria-label="Ir para o início">«</button><button onClick={() => goToPage(safePageIndex - 1)} disabled={chapterIndex === 0 && safePageIndex === 0}>← <span>Anterior</span></button><label><span>Capítulo</span><select value={chapterIndex} onChange={(event) => goToChapter(Number(event.target.value))}>{sections.map((item, index) => <option value={index} key={`${item.heading}-${index}`}>{item.heading || "Abertura"}</option>)}</select></label><span className="reader-page-number">{chapterIndex + 1}/{sections.length} · {safePageIndex + 1}/{pages.length}</span><button onClick={() => goToPage(safePageIndex + 1)} disabled={isLastPage}><span>Próxima</span> →</button><button onClick={() => goToChapter(sections.length - 1)} disabled={isLastPage} aria-label="Ir para o fim">»</button></nav></>}
            <footer className="reader-credit"><strong>Sobre este texto</strong><p>Transcrição digital baseada no eBook {book.gutenbergId} do Project Gutenberg. A grafia histórica da edição foi preservada; a organização dos parágrafos foi adaptada para a tela.</p><p>{book.author} morreu em {book.authorDeathYear}. Pelo prazo do art. 41 da Lei brasileira de Direitos Autorais, o texto original está em domínio público no Brasil. A edição digital consultada é identificada como domínio público nos Estados Unidos; veja na fonte os créditos da transcrição.</p><div><a href={book.sourceUrl} target="_blank" rel="noreferrer">Project Gutenberg · eBook {book.gutenbergId}</a><a href="https://www.planalto.gov.br/ccivil_03/leis/l9610.htm" target="_blank" rel="noreferrer">Lei brasileira de direitos autorais · art. 41</a></div><Link href={`/livros/${book.workId}`}>Voltar à página da obra</Link></footer>
        </article>
    </main>;
}
