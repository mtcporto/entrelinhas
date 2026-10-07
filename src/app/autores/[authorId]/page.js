import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";
import BookCover from "@/components/book-cover";
import { getOpenLibraryJson, searchAuthorWorks } from "@/lib/books";

async function loadAuthor(authorId) {
    if (!/^OL\d+A$/.test(authorId)) return null;
    try {
        const [author, works] = await Promise.all([
            getOpenLibraryJson(`/authors/${authorId}`),
            searchAuthorWorks(authorId, 100),
        ]);
        return { author, works: works.slice(0, 36) };
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
    const bio = biographyText(author.bio);
    const isMachado = authorId === "OL93286A";

    return <main className="detail-shell">
        <header className="detail-topbar"><Link className="detail-back" href="/"><ArrowLeft size={16} /> Voltar ao catálogo</Link><Link className="brand" href="/"><span className="brand-mark"><BookOpen size={20} /></span><span>entrelinhas<span className="brand-period">.</span></span></Link></header>
        <section className="author-hero">
            {image ? <BookCover src={image} title={author.name} className="author-portrait" loading="eager" /> : <div className="author-portrait author-portrait-placeholder"><BookOpen size={34} /><span>PERFIL DE AUTOR</span></div>}
            <div className="work-copy"><span className="eyebrow">AUTOR</span><h1>{author.name}</h1><p className="author-dates">{author.birth_date || author.death_date ? `${author.birth_date || "Data de nascimento não informada"}${author.death_date ? ` — ${author.death_date}` : ""}` : ""}</p>
                {bio && <p className="author-bio">{bio}</p>}
                {isMachado && !bio && <p className="author-bio">Joaquim Maria Machado de Assis (1839–1908) foi um dos principais escritores brasileiros do século XIX. Seus romances e contos exploram com ironia as relações sociais, a memória e os limites da narração.</p>}
                <a className="detail-source-link" href={`https://openlibrary.org/authors/${authorId}`} target="_blank" rel="noreferrer">Perfil bibliográfico Open Library <ArrowUpRight size={14} /></a>
            </div>
        </section>
        <section className="related-section author-works-section"><div className="section-heading"><div><span className="eyebrow">BIBLIOGRAFIA</span><h2>Obras de {author.name}</h2></div><span className="section-note">{works.length} títulos no catálogo</span></div>
            {works.length ? <div className="related-grid">{works.map((work) => {
                const id = work.key?.split("/").pop();
                const cover = work.cover_i;
                if (!id) return null;
                return <Link className="related-card" href={`/livros/${id}`} key={id}><BookCover src={cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : null} title={work.title || "Obra sem título"} className="related-cover" /><span className="related-title">{work.title || "Obra sem título"}</span></Link>;
            })}</div> : <p>O catálogo ainda não tem outras obras para exibir.</p>}
        </section>
        {isMachado && <p className="source-caption">Biografia e bibliografia complementares: <a href="https://machado.mec.gov.br/" target="_blank" rel="noreferrer">Coleção Digital Machado de Assis, MEC e NUPILL/UFSC</a>.</p>}
        <footer className="detail-footer">Dados bibliográficos do <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a>.</footer>
    </main>;
}
