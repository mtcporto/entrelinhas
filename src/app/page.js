import LibraryApp from "@/components/library-app";

export default async function HomePage() {
    return <LibraryApp googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
