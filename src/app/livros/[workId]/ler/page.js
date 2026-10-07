import { notFound } from "next/navigation";
import PublicDomainReader from "@/components/public-domain-reader";

export const metadata = {
    title: "Ler Memórias Póstumas de Brás Cubas | Entrelinhas",
    description: "Leia o texto integral de Memórias Póstumas de Brás Cubas, de Machado de Assis.",
};

export default async function ReadBookPage({ params }) {
    const { workId } = await params;
    if (workId !== "OL1003017W") notFound();
    return <PublicDomainReader />;
}
