import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";
import BookCover from "@/components/book-cover";
import RelatedBooks from "@/components/related-books";
import { getOpenLibraryJson, searchAuthorWorks, searchWorkRecord } from "@/lib/books";
import { getReaderBook } from "@/lib/reader-catalog";
import { workEditorial } from "@/lib/work-editorial";

function descriptionText(description) {
    const value = typeof description === "string" ? description : description?.value;
    return typeof value === "string" ? value.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") : "";
}

function authorIdFromKey(key = "") {
    const match = key.match(/\/authors\/(OL\d+A)/);
    return match?.[1] || null;
}

async function loadWork(workId) {
    if (/^PG\d+$/.test(workId)) {
        const readerBook = getReaderBook(workId);
        if (!readerBook) return null;
        return { work: { title: readerBook.title, first_publish_date: readerBook.year || null, covers: [] }, bibliographicRecord: null, authorIds: [], authorProfiles: [], related: [], localAuthorName: readerBook.author };
    }
    if (!/^OL\d+W$/.test(workId)) return null;
    try {
        const [work, bibliographicRecord] = await Promise.all([
            getOpenLibraryJson(`/works/${workId}`),
            searchWorkRecord(workId).catch(() => null),
        ]);
        const authorIds = [...new Set((work.authors || []).map((item) => authorIdFromKey(item.author?.key)).filter(Boolean))];
        const [authorProfiles, authorWorks] = await Promise.all([
            Promise.all(authorIds.slice(0, 2).map(async (authorId) => {
                try { return await getOpenLibraryJson(`/authors/${authorId}`); }
                catch { return null; }
            })),
            Promise.all(authorIds.slice(0, 2).map(async (authorId) => {
            try { return await searchAuthorWorks(authorId, 100); }
            catch { return []; }
            })),
        ]);
        const related = authorWorks.flatMap((result) => result)
            .filter((book) => book.key !== `/works/${workId}`)
            .filter((book, index, all) => all.findIndex((candidate) => candidate.key === book.key) === index)
            .slice(0, 8)
            .map((book) => ({
                id: book.key?.split("/").pop(),
                title: book.title || "Obra sem título",
                year: book.first_publish_year || "",
                coverUrl: book.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null,
            }));
        return { work, bibliographicRecord, authorIds, authorProfiles, related };
    } catch (error) {
        if (error.status === 404) return null;
        console.error("Could not load book details:", error);
        return { unavailable: true };
    }
}

export async function generateMetadata({ params }) {
    const { workId } = await params;
    const data = await loadWork(workId);
    if (!data?.work) return { title: "Obra não encontrada | Entrelinhas" };
    return { title: `${data.work.title} | Entrelinhas`, description: descriptionText(data.work.description).slice(0, 155) || `Conheça ${data.work.title} e seu autor no Entrelinhas.` };
}

export default async function BookDetailPage({ params }) {
    const { workId } = await params;
    const data = await loadWork(workId);
    if (!data) notFound();

    if (data.unavailable) return <main className="detail-shell"><p>Não foi possível carregar esta obra agora.</p><Link href="/">Voltar ao catálogo</Link></main>;
    const { work, bibliographicRecord, authorIds, authorProfiles, related } = data;
    const authorNames = authorProfiles.map((author) => author?.name).filter(Boolean);
    if (!authorNames.length && data.localAuthorName) authorNames.push(data.localAuthorName);
    const primaryAuthorId = authorIds[0];
    const coverId = work.covers?.find((id) => id > 0) || bibliographicRecord?.cover_i;
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
    const description = descriptionText(work.description);
    const readerBook = getReaderBook(workId);
    const editorial = workEditorial[workId];

    return <main className="detail-shell">
        <header className="detail-topbar"><Link className="detail-back" href="/"><ArrowLeft size={16} /> Voltar ao catálogo</Link><Link className="brand" href="/"><span className="brand-mark"><BookOpen size={20} /></span><span>entrelinhas<span className="brand-period">.</span></span></Link></header>
        <section className="work-hero">
            <BookCover src={coverUrl} title={work.title} loading="eager" />
            <div className="work-copy"><span className="eyebrow">DETALHES DA OBRA</span><h1>{work.title}</h1>
                {authorNames.map((name, index) => { const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); return <Link className="work-author" href={`/autores/${primaryAuthorId || slug}`} key={`${name}-${index}`}>{name}</Link>; })}
                <div className="work-facts">{(work.first_publish_date || bibliographicRecord?.first_publish_year) && <div><span>Primeira publicação</span><strong>{work.first_publish_date || bibliographicRecord?.first_publish_year}</strong></div>}{bibliographicRecord?.number_of_pages_median && <div><span>Mediana de páginas</span><strong>{bibliographicRecord.number_of_pages_median}</strong></div>}{bibliographicRecord?.edition_count && <div><span>Edições registradas</span><strong>{bibliographicRecord.edition_count}</strong></div>}</div>
                {readerBook && <Link className="primary-button read-book-button" href={`/livros/${workId}/ler`}>Ler o livro no Entrelinhas <ArrowUpRight size={16} /></Link>}
                <a className="detail-source-link" href={readerBook?.sourceUrl || `https://openlibrary.org/works/${workId}`} target="_blank" rel="noreferrer">{readerBook?.gutenbergId ? `Fonte eBook ${readerBook.gutenbergId} no Project Gutenberg` : "Ficha Open Library"} <ArrowUpRight size={14} /></a>
            </div>
        </section>
        <section className="editorial-section"><span className="eyebrow">{editorial?.kicker || "LEITURA E CONTEXTO"}</span>
            <h2>{editorial?.headline || "Sobre esta obra"}</h2>
            {editorial ? editorial.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                : description ? <><p>{description}</p><p className="source-caption">Descri??o bibliogr?fica: <a href={`https://openlibrary.org/works/${workId}`} target="_blank" rel="noreferrer">Open Library</a>.</p></> : readerBook ? <p>Esta obra integra a sele??o de literatura brasileira com texto integral dispon?vel no Entrelinhas. Leia a transcri??o digital paginada ou consulte a edi??o de origem no Project Gutenberg.</p> : <p>Os dados p?blicos dispon?veis n?o incluem uma apresenta??o editorial desta obra.</p>}
            {editorial?.themes?.length > 0 && <div className="work-themes"><h3>Temas para observar</h3><ul>{editorial.themes.map((theme) => <li key={theme}>{theme}</li>)}</ul></div>}
            {editorial?.sources?.length > 0 && <div className="editorial-sources"><span>Para continuar:</span>{editorial.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label} <ArrowUpRight size={13} /></a>)}</div>}
        </section>
        {primaryAuthorId && <p className="author-profile-cta">Conheça a trajetória e outras obras de <Link href={`/autores/${primaryAuthorId}`}>{authorNames[0] || "este autor"}</Link>.</p>}
        <RelatedBooks books={related} heading={primaryAuthorId ? `Mais de ${authorNames[0] || "este autor"}` : "Obras relacionadas"} />
        <footer className="detail-footer">{readerBook?.gutenbergId ? <>Texto e dados da edi??o digital: <a href={readerBook.sourceUrl} target="_blank" rel="noreferrer">Project Gutenberg, eBook {readerBook.gutenbergId}</a>.</> : <>Dados bibliogr?ficos do <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a>.</>}</footer>
    </main>;
}
