import { notFound } from "next/navigation";
import PublicDomainReader from "@/components/public-domain-reader";
import { getReaderBook } from "@/lib/reader-catalog";

export async function generateMetadata({ params }) {
    const { workId } = await params;
    const book = getReaderBook(workId);
    return book
        ? { title: `Ler ${book.title} | Entrelinhas`, description: `Leia ${book.title}, de ${book.author}, no leitor do Entrelinhas.` }
        : { title: "Leitor | Entrelinhas" };
}

export default async function ReadBookPage({ params }) {
    const { workId } = await params;
    const book = getReaderBook(workId);
    if (!book) notFound();
    return <PublicDomainReader book={book} />;
}
