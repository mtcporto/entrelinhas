import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";
import BookCover from "@/components/book-cover";
import { getOpenLibraryJson, searchAuthorProfile } from "@/lib/books";
import { readerBooks } from "@/lib/reader-catalog";
import { getEditorialCovers, getEditorialProfile } from "@/lib/editorial-data";

function slugify(value = "") {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const authorSlugAliases = {
    "azevedo-aluizio": "aluisio-azevedo",
    "azevedo-aluisio": "aluisio-azevedo",
};

async function loadAuthor(authorId) {
    let author = null;
    let slug = authorId;
    if (/^OL\d+A$/.test(authorId)) {
        try {
            author = await getOpenLibraryJson(`/authors/${authorId}`);
            slug = slugify(author.name || "");
        } catch (error) {
            if (error.status === 404) return null;
        }
    }
    const editorial = await getEditorialProfile("author", slug);
    if (!author && editorial) {
        try { author = await searchAuthorProfile(editorial.title); }
        catch { /* The editorial profile remains available without Open Library metadata. */ }
    }
    const name = editorial?.title || author?.name || "";
    const works = Object.values(readerBooks).filter((book) => slugify(book.author) === slug);
    const covers = await getEditorialCovers(works.map((book) => book.workId));
    const worksWithCovers = works.map((book) => ({ ...book, coverUrl: covers[book.workId] || book.coverUrl || null }));
    if (!name && !works.length) return null;
    return { author: { ...author, name }, editorial, works: worksWithCovers };
}

export async function generateMetadata({ params }) {
    const { authorId } = await params;
    const data = await loadAuthor(authorSlugAliases[authorId] || authorId);
    return {
        title: data?.author ? `${data.author.name} | Entrelinhas` : "Autor não encontrado | Entrelinhas",
        description: data?.editorial?.summary || (data?.author ? `Biografia e obras de ${data.author.name}.` : undefined),
    };
}

export default async function AuthorPage({ params }) {
    const { authorId } = await params;
    if (authorSlugAliases[authorId]) permanentRedirect(`/autores/${authorSlugAliases[authorId]}`);
    const data = await loadAuthor(authorId);
    if (!data) notFound();

    const { author, editorial, works } = data;
    const photo = author.photos?.find((id) => id > 0);
    const image = editorial?.coverUrl || (photo ? `https://covers.openlibrary.org/a/id/${photo}-L.jpg` : null);
    const portraitCredit = editorial?.sources?.find((source) => source.label.startsWith("Retrato ·")) || null;
    const sources = editorial?.sources?.filter((source) => source !== portraitCredit) || [];

    return <main className="detail-shell">
        <header className="detail-topbar"><Link className="detail-back" href="/"><ArrowLeft size={16} /> Voltar ao catálogo</Link><Link className="brand" href="/"><span className="brand-mark"><BookOpen size={20} /></span><span>entrelinhas<span className="brand-period">.</span></span></Link></header>
        <section className="author-hero">
            <figure className="author-portrait-block">
                {image ? <BookCover src={image} title={author.name} alt={`Retrato de ${author.name}`} className="author-portrait" loading="eager" /> : <div className="author-portrait author-portrait-placeholder"><BookOpen size={34} /><span>PERFIL DE AUTOR</span></div>}
                {portraitCredit && <figcaption className="author-portrait-credit">Retrato · <a href={portraitCredit.url} target="_blank" rel="noreferrer">{portraitCredit.label.slice("Retrato ·".length).trim()} <ArrowUpRight size={12} /></a></figcaption>}
            </figure>
            <div className="work-copy"><span className="eyebrow">AUTOR</span><h1>{author.name}</h1>
                {(author.birth_date || author.death_date) && <p className="author-dates">{author.birth_date || "Data de nascimento não informada"}{author.death_date ? ` — ${author.death_date}` : ""}</p>}
                {editorial?.summary && <><h2 className="author-section-title">Trajetória</h2><p className="author-bio">{editorial.summary}</p></>}
                {editorial?.editorial && <><h2 className="author-section-title">Lugar na literatura</h2><p className="author-bio">{editorial.editorial}</p></>}
                {sources.length > 0 && <div className="editorial-sources author-sources"><span>Fontes consultadas</span>{sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label} <ArrowUpRight size={13} /></a>)}</div>}
            </div>
        </section>
        <section className="related-section author-works-section"><div className="section-heading"><div><span className="eyebrow">OBRAS COM TEXTO INTEGRAL</span><h2>Leia obras de {author.name}</h2></div><span className="section-note">{works.length} {works.length === 1 ? "obra" : "obras"} disponíveis</span></div>
            {works.length ? <div className="related-grid">{works.map((work) => <Link className="related-card" href={`/livros/${work.workId}`} key={work.workId}><BookCover src={work.coverUrl} title={work.title} className="related-cover" /><span className="book-badge reader-available">Texto integral</span><span className="related-title">{work.title}</span><span className="related-year">{work.year || "Domínio público"}</span></Link>)}</div> : <p>Ainda não há textos integrais deste autor no acervo.</p>}
        </section>
        <footer className="detail-footer">Perfil editorial em português escrito pelo Entrelinhas. Os dados bibliográficos podem ser complementados pela <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a>; as referências específicas estão indicadas acima.</footer>
    </main>;
}
