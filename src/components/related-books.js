import Link from "next/link";
import BookCover from "@/components/book-cover";

export default function RelatedBooks({ books, heading = "Outras obras" }) {
    if (!books.length) return null;
    return <section className="related-section">
        <div className="section-heading"><div><span className="eyebrow">CONTINUE EXPLORANDO</span><h2>{heading}</h2></div></div>
        <div className="related-grid">{books.map((book) => <Link className="related-card" href={`/livros/${book.id}`} key={book.id}>
            <BookCover src={book.coverUrl} title={book.title} className="related-cover" />
            <span className="related-title">{book.title}</span>
            {book.year && <span className="related-year">{book.year}</span>}
        </Link>)}</div>
    </section>;
}
