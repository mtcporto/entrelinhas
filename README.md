# Entrelinhas

Aplicação Next.js para descobrir literatura brasileira, consultar o catálogo do Open Library pelo servidor e organizar favoritos/listas de leitura.

## Desenvolvimento

```bash
npm install
npm run dev
```

O catálogo funciona sem credenciais. As buscas saem do servidor Next.js para o Open Library e ficam em cache por seis horas; o navegador não chama a API externa diretamente. Se o Turso não estiver configurado, favoritos e listas permanecem no navegador. Depois do login, os dados locais podem ser sincronizados para a conta.

## Vercel e Turso

Configure estas variáveis em Vercel (e em `.env.local` para desenvolvimento):

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BETTER_AUTH_SECRET` (segredo aleatório com pelo menos 32 caracteres)
- `BETTER_AUTH_URL` (URL pública da aplicação, por exemplo `https://livros-five-plum.vercel.app`)

O login por e-mail e senha já está habilitado. Google é opcional e requer `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Para criar as tabelas no banco Turso, ative temporariamente `ENABLE_SCHEMA_SETUP=true`, defina `SCHEMA_SETUP_TOKEN` com pelo menos 32 caracteres aleatórios e faça um POST para `/api/auth-schema` com `Authorization: Bearer <token>`. Depois de receber `{ "ok": true }`, desative `ENABLE_SCHEMA_SETUP` e remova o token. A rota retorna 404 quando desativada.

`OPEN_LIBRARY_USER_AGENT` pode ser configurada com identificação de aplicação e contato, por exemplo `Entrelinhas/1.0 (contact: email@example.com)`, seguindo as recomendações do Open Library.

## Arquitetura

- Next.js App Router na Vercel.
- `/api/books` é o proxy do servidor para Open Library e usa cache de função/CDN.
- Better Auth gerencia sessões; Turso (libSQL) guarda usuários e listas privadas.
- Cloudflare pode continuar como DNS/analytics. Não é necessário colocar Worker adicional no caminho de cada busca.
