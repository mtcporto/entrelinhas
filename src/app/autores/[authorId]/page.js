import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";
import BookCover from "@/components/book-cover";
import { getPortugueseAuthorBio } from "@/lib/author-bio";
import { getOpenLibraryJson } from "@/lib/books";
import { readerBooks } from "@/lib/reader-catalog";

function normalizeAuthorName(value = "") {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

async function loadAuthor(authorId) {
    const localWorks = Object.values(readerBooks).filter((book) => normalizeAuthorName(book.author) === normalizeAuthorName(authorId));
    if (!/^OL\d+A$/.test(authorId)) {
        if (!localWorks.length) return null;
        return { author: { name: localWorks[0].author }, works: localWorks };
    }
    try {
        const author = await getOpenLibraryJson(`/authors/${authorId}`);
        const works = Object.values(readerBooks).filter((book) => normalizeAuthorName(book.author) === normalizeAuthorName(author.name));
        return { author, works };
    } catch (error) {
        if (error.status === 404) return null;
        console.error("Could not load author details:", error);
        return { unavailable: true };
    }
}

export async function generateMetadata({ params }) {
    const { authorId } = await params;
    const data = await loadAuthor(authorId);
    return { title: data?.author ? `${data.author.name} | Entrelinhas` : "Autor não encontrado | Entrelinhas", description: data?.author?.name ? `Biografia e obras de ${data.author.name}.` : undefined };
}

function biographyText(bio) {
    const value = typeof bio === "string" ? bio : bio?.value;
    return typeof value === "string" ? value.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") : "";
}

export default async function AuthorPage({ params }) {
    const { authorId } = await params;
    const data = await loadAuthor(authorId);
    if (!data) notFound();
    if (data.unavailable) return <main className="detail-shell"><p>Não foi possível carregar este perfil agora.</p><Link href="/">Voltar ao catálogo</Link></main>;

    const { author, works } = data;
    const photo = author.photos?.find((id) => id > 0);
    const image = photo ? `https://covers.openlibrary.org/a/id/${photo}-L.jpg` : null;
    const sourceBio = biographyText(author.bio);
    const biography = /^OL\d+A$/.test(authorId) ? await getPortugueseAuthorBio(authorId, sourceBio) : { text: "", translated: false };

    return <main className="detail-shell">
        <header className="detail-topbar"><Link className="detail-back" href="/"><ArrowLeft size={16} /> Voltar ao catálogo</Link><Link className="brand" href="/"><span className="brand-mark"><BookOpen size={20} /></span><span>entrelinhas<span className="brand-period">.</span></span></Link></header>
        <section className="author-hero">
            {image ? <BookCover src={image} title={author.name} className="author-portrait" loading="eager" /> : <div className="author-portrait author-portrait-placeholder"><BookOpen size={34} /><span>PERFIL DE AUTOR</span></div>}
            <div className="work-copy"><span className="eyebrow">AUTOR</span><h1>{author.name}</h1><p className="author-dates">{author.birth_date || author.death_date ? `${author.birth_date || "Data de nascimento não informada"}${author.death_date ? ` — ${author.death_date}` : ""}` : ""}</p>
                {biography.text && <><p className="author-bio">{biography.text}</p><p className="bio-translation-note">{biography.translated ? "Tradução automática para português a partir da biografia da Open Library." : biography.unavailable ? "Biografia original da Open Library; tradução para português temporariamente indisponível." : "Biografia da Open Library."}</p></>}
                {/^OL\d+A$/.test(authorId) && <a className="detail-source-link" href={`https://openlibrary.org/authors/${authorId}`} target="_blank" rel="noreferrer">Perfil Open Library <ArrowUpRight size={14} /></a>}
            </div>
        </section>
        <section className="related-section author-works-section"><div className="section-heading"><div><span className="eyebrow">OBRAS COM TEXTO INTEGRAL</span><h2>Leia obras de {author.name}</h2></div><span className="section-note">{works.length} {works.length === 1 ? "obra" : "obras"} disponiveis</span></div>
            {works.length ? <div className="related-grid">{works.map((work) => <Link className="related-card" href={`/livros/${work.workId}`} key={work.workId}><BookCover src={null} title={work.title} className="related-cover" /><span className="book-badge reader-available">Texto integral</span><span className="related-title">{work.title}</span><span className="related-year">{work.year || "Dominio publico"}</span></Link>)}</div> : <p>Ainda nao ha textos integrais deste autor no acervo.</p>}
        </section>
        <footer className="detail-footer">Textos integrais e creditos da edicao de origem: Project Gutenberg.</footer>
    </main>;
}
