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


## Textos integrais e fontes

Os textos são mantidos como arquivos TXT UTF-8 em `public/texts`; o catálogo `src/lib/reader-catalog.js` liga cada arquivo à obra, autoria, edição e fonte. O formato simples facilita leitura paginada, busca textual e futura indexação. A atribuição e a licença da transcrição aparecem no leitor.

O acervo aceita fontes confiáveis com texto integral, incluindo Project Gutenberg e Wikisource. Para entradas do Gutenberg, execute `node scripts/sync-gutenberg-texts.mjs`; o script baixa somente arquivos ausentes e valida os marcadores da edição. Para exportar uma edição da Wikisource como EPUB e extrair seu texto:

```bash
python scripts/import-wikisource-epub.py 'Eu_(Augusto_dos_Anjos,_1912)' public/texts/eu-augusto-dos-anjos.txt --min-words 10000
```

O parâmetro `--min-words` é uma barreira simples contra páginas de índice e transcrições claramente parciais; ele não substitui a conferência da edição, dos capítulos e do fim do texto. Registre no catálogo a URL da edição, a edição de referência, a licença da transcrição e os dados do autor. Wikisource pode oferecer transcrição sob licença Creative Commons mesmo quando a obra original está em domínio público; preserve a atribuição e cumpra a licença da transcrição derivada.

A seleção brasileira é editorial e incremental. Confirme autoria brasileira, idioma/escopo, integridade da transcrição e elegibilidade da obra em domínio público no Brasil. A declaração de domínio público dos EUA do Gutenberg, por si só, não comprova o status jurídico brasileiro. Quando a fonte oferecer apenas PDF ou uma transcrição parcial, não a apresente como texto integral.

## Perfis editoriais

Biografias, resumos, textos de contexto e referências dos autores e das obras com texto integral são mantidos em português pelo Entrelinhas e persistidos nas tabelas `editorial_profiles` e `editorial_sources` do Turso. `src/lib/editorial-seed-data.js` é a cópia de segurança versionável; as páginas leem o banco no servidor e usam essa cópia se o banco estiver indisponível. A Open Library continua sendo usada para dados bibliográficos e capas, não para traduzir os perfis editoriais.

Para sincronizar o catálogo editorial com o Turso configurado em `.env.local`, execute `npm run seed:editorial`. A carga é idempotente e atualiza os perfis e suas fontes sem alterar usuários, sessões ou listas de leitura.
