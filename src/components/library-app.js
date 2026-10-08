"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    ArrowUpRight,
    BookOpen,
    Bookmark,
    Heart,
    Search,
    Sparkles,
    X,
} from "lucide-react";
import { deduplicateBooks } from "@/lib/books";
import { readerBooks } from "@/lib/reader-catalog";
const readerBooksByAuthor = Object.values(readerBooks).reduce((authors, book) => {
    const name = book.author.trim();
    const existing = authors.get(name) || [];
    existing.push(book);
    authors.set(name, existing);
    return authors;
}, new Map());
const readerBookCards = Object.values(readerBooks).map((book) => ({
    id: `/works/${book.workId}`, title: book.title, authors: [book.author], authorKeys: [],
    firstPublished: Number(book.year) || null, pageCount: null, editions: 0, subjects: [], coverUrl: null, infoUrl: book.sourceUrl,
}));
const readerBookCardById = new Map(readerBookCards.map((book) => [book.id, book]));
function readLocalLists() {
    try {
        const stored = JSON.parse(localStorage.getItem("entrelinhas:reading-lists") || "null");
        if (Array.isArray(stored) && stored.every((list) => typeof list.id === "string" && Array.isArray(list.books))) return stored.map((list) => ({ ...list, books: deduplicateBooks(list.books) }));
        const legacy = JSON.parse(localStorage.getItem("entrelinhas:reading-list") || "[]");
        if (Array.isArray(legacy) && legacy.length) return [{ id: "favorites", name: "Favoritos", books: deduplicateBooks(legacy) }];
    } catch {}
    return [{ id: "favorites", name: "Favoritos", books: [] }];
}
function authorHref(book) {
    const key = book.authorKeys?.[0];
    const author = book.authors?.[0] || "";
    const slug = author.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return /^OL\d+A$/.test(key || "") ? `/autores/${key}` : `/autores/${slug}`;
}

function bookHref(book) {
    const match = book.id?.match(/(?:\/works\/)?(OL\d+W|PG\d+)$/);
    return match ? `/livros/${match[1]}` : book.infoUrl || "#";
}
function BookCover({ book, large = false }) {
    if (book.coverUrl) {
        return (
            // Open Library serves cover images separately from its search API.
            <Image
                fill
                sizes="(max-width: 680px) 50vw, 25vw"
                unoptimized
                className="book-cover"
                src={book.coverUrl}
                alt={`Capa de ${book.title}`}
                loading="lazy"
                onError={(event) => { event.currentTarget.remove(); }}
            />
        );
    }
    return (
        <div className={large ? "book-cover book-cover-placeholder book-cover-large" : "book-cover book-cover-placeholder"} aria-label="Capa indisponível">
            <BookOpen size={28} strokeWidth={1.3} />
            <span>{book.title}</span>
        </div>
    );
}
export default function LibraryApp({ googleEnabled = false }) {
    const [books] = useState(readerBookCards);
    const [savedBooks, setSavedBooks] = useState([]);
    const [view, setView] = useState("discover");
    const [search, setSearch] = useState("");
    const [accountState, setAccountState] = useState("loading");
    const [user, setUser] = useState(null);
    const [lists, setLists] = useState([{ id: "favorites", name: "Favoritos", books: [] }]);
    const [activeList, setActiveList] = useState("favorites");
    const [accountDialog, setAccountDialog] = useState("");
    const [accountMessage, setAccountMessage] = useState("");
    const [accountBusy, setAccountBusy] = useState(false);
    useEffect(() => {
        void loadAccount();
    }, []);
    useEffect(() => {
        const active = lists.find((list) => list.id === activeList) || lists[0];
        setSavedBooks(active?.books || []);
    }, [activeList, lists]);
    async function loadAccount() {
        try {
            const response = await fetch("/api/auth/get-session", { cache: "no-store" });
            if (!response.ok) {
                setLists(readLocalLists());
                setAccountState("offline");
                return;
            }
            const session = await response.json();
            if (session?.user) {
                setUser(session.user);
                const listResponse = await fetch("/api/lists", { cache: "no-store" });
                if (!listResponse.ok) throw new Error("lists_unavailable");
                const data = await listResponse.json();
                const localLists = readLocalLists();
                const remoteLists = data.lists.map((list) => ({ ...list, books: deduplicateBooks(list.books || []) }));
                const nextLists = remoteLists.length ? remoteLists : localLists;
                setLists(nextLists);
                if (remoteLists.some((list, index) => list.books.length !== (data.lists[index]?.books || []).length)) {
                    const cleanup = await fetch("/api/lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lists: remoteLists }) });
                    if (!cleanup.ok) throw new Error("Could not clean duplicate saved books");
                }
                if (!data.lists.length && localLists.some((list) => list.books.length)) {
                    const migration = await fetch("/api/lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lists: localLists }) });
                    if (!migration.ok) throw new Error("Could not migrate local lists");
                }
                localStorage.removeItem("entrelinhas:reading-lists");
                localStorage.removeItem("entrelinhas:reading-list");
                setAccountState("signed-in");
            } else {
                setLists(readLocalLists());
                setAccountState("signed-out");
            }
        } catch (loadError) {
            console.error("Could not load account:", loadError);
            setAccountState("offline");
        }
    }
    async function saveLists(nextLists) {
        setLists(nextLists);
        if (accountState !== "signed-in") {
            try { localStorage.setItem("entrelinhas:reading-lists", JSON.stringify(nextLists)); } catch {}
            return;
        }
        try {
            const response = await fetch("/api/lists", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lists: nextLists }),
            });
            if (!response.ok) throw new Error("save_failed");
        } catch (saveError) {
            console.error("Could not save lists:", saveError);
            setAccountMessage("Não foi possível sincronizar agora. Tente novamente.");
            await loadAccount();
        }
    }
    async function submitAccount(event) {
        event.preventDefault();
        setAccountBusy(true);
        setAccountMessage("");
        const form = new FormData(event.currentTarget);
        const isSignup = accountDialog === "signup";
        try {
            const response = await fetch(`/api/auth/${isSignup ? "sign-up/email" : "sign-in/email"}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: String(form.get("name") || ""), email: form.get("email"), password: form.get("password") }),
            });
            const result = await response.json();
            if (!response.ok || result.error) throw new Error(result.message || "Confira seu e-mail e sua senha e tente novamente.");
            setAccountDialog("");
            await loadAccount();
        } catch (accountError) {
            setAccountMessage(accountError.message);
        } finally {
            setAccountBusy(false);
        }
    }
    async function signOut() {
        await fetch("/api/auth/sign-out", { method: "POST" });
        try { localStorage.setItem("entrelinhas:reading-lists", JSON.stringify(lists)); } catch {}
        setUser(null);
        setLists([{ id: "favorites", name: "Favoritos", books: [] }]);
        setSavedBooks([]);
        setAccountState("signed-out");
    }
    async function signInWithGoogle() {
        setAccountBusy(true);
        setAccountMessage("");
        try {
            const response = await fetch("/api/auth/sign-in/social", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: "google", callbackURL: window.location.href }),
            });
            const result = await response.json();
            if (!response.ok || !result.url) throw new Error(result.message || "Não foi possível iniciar o acesso pelo Google.");
            window.location.assign(result.url);
        } catch (authError) {
            setAccountMessage(authError.message);
            setAccountBusy(false);
        }
    }
    function submitSearch(event) {
        event.preventDefault();
        setView("discover");
    }
    function toggleSaved(book) {
        const current = lists.find((list) => list.id === activeList) || lists[0];
        const nextBooks = current.books.some((item) => item.id === book.id)
            ? current.books.filter((item) => item.id !== book.id)
            : [book, ...current.books];
        void saveLists(lists.map((list) => list.id === current.id ? { ...list, books: nextBooks } : list));
    }
    function createList() {
        const name = window.prompt("Nome da nova lista:")?.trim();
        if (!name) return;
        const list = { id: crypto.randomUUID(), name: name.slice(0, 80), books: [] };
        setActiveList(list.id);
        void saveLists([...lists, list]);
    }
    const selectedList = lists.find((list) => list.id === activeList) || lists[0];
    const selectedBooks = view === "saved" ? savedBooks.filter((book) => readerBookCardById.has(book.id)) : books;
    const normalizedReaderSearch = search.trim().toLocaleLowerCase("pt-BR");
    const visibleBooks = view !== "saved" && normalizedReaderSearch
        ? selectedBooks.filter((book) => `${book.title} ${book.authors.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalizedReaderSearch))
        : selectedBooks;
    return (
        <main className="site-shell">
            <header className="topbar">
                <a className="brand" href="#inicio" onClick={() => setView("discover")} aria-label="Entrelinhas, início">
                    <span className="brand-mark"><BookOpen size={20} /></span>
                    <span>entrelinhas<span className="brand-period">.</span></span>
                </a>
                <nav className="top-nav" aria-label="Navegação principal">
                    <button className={view === "discover" ? "nav-link active" : "nav-link"} onClick={() => setView("discover")}>Descobrir</button>
                <button className={view === "saved" ? "nav-link active" : "nav-link"} onClick={() => setView("saved")}>
                    Minhas listas <span className="nav-count">{savedBooks.filter((book) => readerBookCardById.has(book.id)).length}</span>
                </button>
            </nav>
            <div className="topbar-note"><Sparkles size={15} /> Feito para quem ama ler</div>
            <div className="account-actions">
                {accountState === "signed-in" ? <><span className="account-name">{user?.name || user?.email}</span><button className="account-button" onClick={signOut}>Sair</button></>
                    : <button className="account-button" onClick={() => { setAccountMessage(""); setAccountDialog("signin"); }}>Entrar / criar conta</button>}
            </div>
            </header>
            <section className="hero" id="inicio">
                <div className="hero-copy">
                    <span className="eyebrow"><span className="eyebrow-line" /> UM GUIA DE LEITURA BRASILEIRA</span>
                    <h1>Histórias que<br /><em>ficam com você.</em></h1>
                    <p>Encontre os clássicos, conheça os movimentos literários e monte uma lista de leitura do seu jeito.</p>
                    <button className="hero-action" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>
                        Explorar livros
                    </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                    <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
                    <div className="book-stack stack-back"><span>POESIA</span><b>versos<br />do Brasil</b></div>
                    <div className="book-stack stack-front"><span>ROMANCE</span><b>uma história<br />para guardar</b></div>
                    <span className="art-sparkle sparkle-one">✳</span><span className="art-sparkle sparkle-two">✳</span>
                </div>
                <div className="hero-index">01 <span /> 12</div>
            </section>
            <section className="stats-strip" aria-label="Estatísticas do catálogo">
                <div className="stat-block"><span className="stat-value">{books.length}</span><span className="stat-label">livros nesta seleção</span></div>
                <div className="stat-block"><span className="stat-value">{readerBooksByAuthor.size}</span><span className="stat-label">autores com texto integral</span></div>
                <div className="stats-aside">Uma biblioteca para<br /><strong>ler sem pressa.</strong></div>
            </section>
            <section className="catalog-section" id="catalogo">
                <div className="section-heading">
                    <div><span className="eyebrow">A BIBLIOTECA</span><h2>{view === "saved" ? "Suas listas de leitura" : "Encontre sua próxima história"}</h2></div>
                    {view === "saved" ? <button className="text-action" onClick={() => setView("discover")}>Voltar ao catálogo <ArrowUpRight size={15} /></button> : <span className="section-note">Clássicos brasileiros, em um só lugar</span>}
                </div>
                {view === "saved" && <div className="list-toolbar"><div className="list-tabs">{lists.map((list) => <button key={list.id} className={activeList === list.id ? "period-chip selected" : "period-chip"} onClick={() => setActiveList(list.id)}>{list.name} <span>{list.books.filter((book) => readerBookCardById.has(book.id)).length}</span></button>)}</div><button className="secondary-button new-list-button" onClick={createList}>+ Nova lista</button>{accountState !== "signed-in" && <span className="list-sync-note">Entre para sincronizar suas listas no Turso.</span>}</div>}
                {view === "discover" && <>
                    <form className="search-form" onSubmit={submitSearch}>
                        <Search size={19} className="search-icon" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque por título ou autor..." aria-label="Buscar livros por título ou autor" />
                        {search && <button className="clear-search" type="button" onClick={() => setSearch("")} aria-label="Limpar busca"><X size={17} /></button>}
                        <button className="search-submit" type="submit">Buscar</button>
                    </form>
                    <div className="filter-heading"><span>Obras dispon?veis para leitura integral</span><span className="filter-hint">Sele??o brasileira ? Project Gutenberg</span></div>
                </>}
                <div className="results-heading">
                    <h3>{view === "saved" ? "Guardados para depois" : search ? `Resultados para “${search}”` : "Textos integrais disponiveis"}</h3>
                    <span>{`${visibleBooks.length} ${visibleBooks.length === 1 ? "livro" : "livros"}`}</span>
                </div>
                {visibleBooks.length === 0 ? <div className="empty-state"><div className="empty-icon"><Bookmark size={23} /></div><h3>{view === "saved" ? "Sua lista comeca com um livro." : "Nao encontramos livros por aqui."}</h3><p>{view === "saved" ? "Salve os titulos com texto integral para encontra-los aqui." : "Tente outro titulo ou autor."}</p>{view === "saved" && <button className="primary-button" onClick={() => setView("discover")}>Explorar catalogo</button>}</div>
                    : <div className="book-grid">{visibleBooks.map((book) => {
                        const saved = savedBooks.some((item) => item.id === book.id);
                        return <article className="book-card" key={book.id}>
                            <Link className="cover-button" href={bookHref(book)} aria-label={`Ver detalhes de ${book.title}`}>
                                <div className="cover-frame"><BookCover book={book} /><span className="book-badges"><span className="book-badge reader-available">Texto integral</span></span></div>
                            </Link>
                            <div className="book-info">
                                <div className="book-meta">Literatura brasileira{book.firstPublished ? ` · ${book.firstPublished}` : ""}</div>
                                <Link className="book-title-link" href={bookHref(book)}>{book.title}</Link>
                                <p className="book-author"><Link className="book-author-link" href={authorHref(book)}>{book.authors[0]}</Link></p>
                                <div className="book-card-bottom"><span>Texto integral</span><button className={saved ? "save-button saved" : "save-button"} onClick={() => toggleSaved(book)} aria-label={saved ? `Remover ${book.title} da lista` : `Salvar ${book.title}`} aria-pressed={saved}>{saved ? <Heart size={17} fill="currentColor" /> : <Bookmark size={17} />}</button></div>
                            </div>
                        </article>;
                    })}</div>}
            </section>
            <footer className="site-footer"><a className="brand footer-brand" href="#inicio"><span className="brand-mark"><BookOpen size={18} /></span><span>entrelinhas<span className="brand-period">.</span></span></a><span>Literatura brasileira, para ler e guardar.</span><a href="https://www.gutenberg.org/ebooks/" target="_blank" rel="noreferrer">Textos integrais do Project Gutenberg <ArrowUpRight size={14} /></a></footer>
            {accountDialog && <div className="modal-backdrop" onClick={() => setAccountDialog("")} role="presentation"><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setAccountDialog("")} aria-label="Fechar"><X size={20} /></button><span className="eyebrow">SUAS LEITURAS EM QUALQUER LUGAR</span><h2 id="account-title">{accountDialog === "signup" ? "Crie sua conta" : "Bem-vindo de volta"}</h2><p>Suas listas ficam salvas com segurança e sincronizadas entre dispositivos.</p><form className="account-form" onSubmit={submitAccount}>{accountDialog === "signup" && <label>Nome<input name="name" autoComplete="name" required maxLength={120} /></label>}<label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>Senha<input name="password" type="password" autoComplete={accountDialog === "signup" ? "new-password" : "current-password"} minLength={8} required /></label>{accountMessage && <p className="account-error" role="alert">{accountMessage}</p>}<button className="primary-button" disabled={accountBusy}>{accountBusy ? "Aguarde..." : accountDialog === "signup" ? "Criar conta" : "Entrar"}</button></form>{googleEnabled && <><div className="auth-divider">ou</div><button className="secondary-button google-button" disabled={accountBusy} onClick={signInWithGoogle}>Continuar com Google</button></>}{accountDialog === "signin" ? <button className="auth-switch" onClick={() => { setAccountMessage(""); setAccountDialog("signup"); }}>Ainda não tem conta? Criar agora</button> : <button className="auth-switch" onClick={() => { setAccountMessage(""); setAccountDialog("signin"); }}>Já tem uma conta? Entrar</button>}</section></div>}
        </main>
    );
}
