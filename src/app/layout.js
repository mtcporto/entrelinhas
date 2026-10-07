import "./globals.css";

export const metadata = {
    title: "Entrelinhas — Literatura brasileira",
    description: "Descubra clássicos brasileiros, organize suas leituras e explore movimentos literários.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="pt-BR">
            <body>{children}</body>
        </html>
    );
}
