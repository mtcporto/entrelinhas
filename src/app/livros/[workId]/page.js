import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";
import BookCover from "@/components/book-cover";
import RelatedBooks from "@/components/related-books";
import { getOpenLibraryJson, searchAuthorWorks, searchWorkRecord } from "@/lib/books";
import { getReaderBook } from "@/lib/reader-catalog";
import { getEditorialProfile } from "@/lib/editorial-data";

function descriptionText(description) {
    const value = typeof description === "string" ? description : description?.value;
    return typeof value === "string" ? value.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") : "";
}

function authorIdFromKey(key = "") {
    return key.match(/\/authors\/(OL\d+A)/)?.[1] || null;
}

function authorSlug(name = "") {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadWork(workId) {
    const readerBook = getReaderBook(workId);
    const editorial = await getEditorialProfile("work", workId);
    if (!/^OL\d+W$/.test(workId)) {
        if (!readerBook) return null;
        return { work: { title: editorial?.title || readerBook.title, first_publish_date: readerBook.year || null, covers: [] }, bibliographicRecord: null, authorIds: [], authorProfiles: [], related: [], localAuthorName: readerBook.author, editorial };
    }
    try {
        const [work, bibliographicRecord] = await Promise.all([
            getOpenLibraryJson(`/works/${workId}`),
            searchWorkRecord(workId).catch(() => null),
        ]);
        const authorIds = [...new Set((work.authors || []).map((item) => authorIdFromKey(item.author?.key)).filter(Boolean))];
        const [authorProfiles, authorWorks] = await Promise.all([
            Promise.all(authorIds.slice(0, 2).map(async (authorId) => {
                try { return await getOpenLibraryJson(`/authors/${authorId}`); } catch { return null; }
            })),
            Promise.all(authorIds.slice(0, 2).map(async (authorId) => {
                try { return await searchAuthorWorks(authorId, 100); } catch { return []; }
            })),
        ]);
        const related = authorWorks.flatMap((result) => result)
            .filter((book) => book.key !== `/works/${workId}`)
            .filter((book, index, all) => all.findIndex((candidate) => candidate.key === book.key) === index)
            .slice(0, 8)
            .map((book) => ({ id: book.key?.split("/").pop(), title: book.title || "Obra sem título", year: book.first_publish_year || "", coverUrl: book.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null }));
        return { work, bibliographicRecord, authorIds, authorProfiles, related, editorial };
    } catch (error) {
        if (error.status === 404 && !editorial) return null;
        if (editorial || readerBook) return { work: { title: editorial?.title || readerBook?.title || workId, first_publish_date: readerBook?.year || null, covers: [] }, bibliographicRecord: null, authorIds: [], authorProfiles: [], related: [], localAuthorName: readerBook?.author, editorial };
        console.error("Could not load book details:", error);
        return { unavailable: true };
    }
}

export async function generateMetadata({ params }) {
    const { workId } = await params;
    const data = await loadWork(workId);
    if (!data?.work) return { title: "Obra não encontrada | Entrelinhas" };
    const description = data.editorial?.summary || descriptionText(data.work.description);
    return { title: `${data.work.title} | Entrelinhas`, description: description.slice(0, 155) || `Conheça ${data.work.title} e seu autor no Entrelinhas.` };
}

export default async function BookDetailPage({ params }) {
    const { workId } = await params;
    const data = await loadWork(workId);
    if (!data) notFound();
    if (data.unavailable) return <main className="detail-shell"><p>Não foi possível carregar esta obra agora.</p><Link href="/">Voltar ao catálogo</Link></main>;

    const { work, bibliographicRecord, authorProfiles = [], related = [], editorial } = data;
    const readerBook = getReaderBook(workId);
    const authorNames = authorProfiles.map((author) => author?.name).filter(Boolean);
    if (!authorNames.length && data.localAuthorName) authorNames.push(data.localAuthorName);
    const authorName = authorNames[0] || readerBook?.author || "";
    const coverId = work.covers?.find((id) => id > 0) || bibliographicRecord?.cover_i;
    const coverUrl = editorial?.coverUrl || readerBook?.coverUrl || (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null);
    const whyItMatters = editorial?.editorial || "Esta obra integra o acervo de literatura brasileira do Entrelinhas.";
    const summary = editorial?.summary || descriptionText(work.description) || `Texto de ${authorName} disponível para leitura no Entrelinhas.`;
    const themes = editorial?.themes || [];
    const sources = editorial?.sources || [];
    const firstPublished = work.first_publish_date || bibliographicRecord?.first_publish_year || readerBook?.year;
    const sourceLabel = readerBook?.sourceName || (readerBook?.gutenbergId ? `Project Gutenberg eBook ${readerBook.gutenbergId}` : null);

    return <main className="detail-shell">
        <header className="detail-topbar"><Link className="detail-back" href="/"><ArrowLeft size={16} /> Voltar ao catálogo</Link><Link className="brand" href="/"><span className="brand-mark"><BookOpen size={20} /></span><span>entrelinhas<span className="brand-period">.</span></span></Link></header>
        <section className="work-heading"><span className="eyebrow">PERFIL DA OBRA</span><h1>{work.title}</h1>{authorName && <Link className="work-author" href={`/autores/${authorSlug(authorName)}`}>{authorName}</Link>}</section>
        <section className="work-overview"><BookCover src={coverUrl} title={work.title} loading="eager" /><div className="work-overview-copy">
            <span className="eyebrow">RESUMO</span><p>{summary}</p>
            <div className="work-facts"><h3>Informações da edição</h3>{firstPublished && <div><span>Primeira edição</span><strong>{firstPublished}</strong></div>}{bibliographicRecord?.number_of_pages_median && <div><span>Páginas (mediana)</span><strong>{bibliographicRecord.number_of_pages_median}</strong></div>}{bibliographicRecord?.edition_count && <div><span>Edições registradas</span><strong>{bibliographicRecord.edition_count}</strong></div>}</div>
            {readerBook && <Link className="primary-button read-book-button" href={`/livros/${workId}/ler`}>Ler no Entrelinhas <ArrowUpRight size={16} /></Link>}
            {readerBook && <a className="detail-source-link" href={readerBook.sourceUrl} target="_blank" rel="noreferrer">Texto original · {sourceLabel} <ArrowUpRight size={14} /></a>}
        </div></section>
        <section className="editorial-section work-importance"><span className="eyebrow">LEITURA E CONTEXTO</span><h2>Por que esta obra importa</h2>
            {whyItMatters.split(/\n\n+/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {themes.length > 0 && <div className="work-themes"><h3>Temas para observar</h3><ul>{themes.map((theme) => <li key={theme}>{theme}</li>)}</ul></div>}
            {sources.length > 0 && <div className="editorial-sources"><span>Fontes consultadas</span>{sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label} <ArrowUpRight size={13} /></a>)}</div>}
        </section>
        {authorName && <p className="author-profile-cta">Conheça a trajetória e outras obras de <Link href={`/autores/${authorSlug(authorName)}`}>{authorName}</Link>.</p>}
        <RelatedBooks books={related} heading={authorName ? `Mais de ${authorName}` : "Obras relacionadas"} />
        <footer className="detail-footer">Texto e edição: {readerBook ? <a href={readerBook.sourceUrl} target="_blank" rel="noreferrer">{sourceLabel}</a> : <a href={`https://openlibrary.org/works/${workId}`} target="_blank" rel="noreferrer">Open Library</a>}. O perfil editorial é de autoria do Entrelinhas e mantém as fontes consultadas acima.</footer>
    </main>;
}
