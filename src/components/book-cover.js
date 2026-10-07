import Image from "next/image";
import { BookOpen } from "lucide-react";

export default function BookCover({ src, title, className = "detail-cover", loading = "lazy" }) {
    if (!src) return <div className={`${className} book-cover-fallback`}><BookOpen size={32} /><span>{title}</span></div>;
    return <div className={className}>
        <Image src={src} alt={`Capa de ${title}`} fill sizes="(max-width: 680px) 70vw, 340px" loading={loading} unoptimized />
    </div>;
}
