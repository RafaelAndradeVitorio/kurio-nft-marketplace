# Kurio — Marketplace de NFTs

Marketplace demonstrativo em React e TypeScript baseado no [Figma do desafio](https://www.figma.com/design/r5D7DJt8lHjXBKgdy3mGhG/Frontend-Challenge--Copy-?node-id=0-1). Todos os fluxos de compra, conta e tempo real utilizam simulação local. Não conecte uma carteira real nem utilize dados pessoais.

**[Abrir aplicação](https://kurio-nft-marketplace-mauve.vercel.app)** · **[Repositório público](https://github.com/RafaelAndradeVitorio/kurio-nft-marketplace)**

## Executar

Node.js **22.19 ou superior**, npm e Git. Não é necessário backend, chave de API ou serviço privado.

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. O MSW inicia antes de montar a aplicação; os mocks também estão ativos no build de demonstração. O arquivo `.env.example` documenta `VITE_ENABLE_MOCKS=true`. Desativar os mocks exige disponibilizar uma API compatível; não há backend real nesta entrega.

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run typecheck` | TypeScript estrito |
| `npm run lint` | ESLint |
| `npm run build` | Build otimizado em `dist/` |
| `npm run preview` | Preview do build em http://127.0.0.1:4173 |
| `npm run test:e2e` | Chromium desktop 1440 e mobile 390; inclui verificações em 768 e zoom |
| `npm run test:visual` | Regressão de início, detalhe, carrinho e pagamento |
| `npm run test:report` | Relatório HTML Playwright |
| `npm run audit` | Lighthouse: 3 medições por página/perfil e medianas |

Para os testes, execute antes `npx playwright install chromium`. O Playwright inicia o servidor automaticamente. Falhas geram screenshot, vídeo e trace em `test-results/`; o relatório fica em `playwright-report/`. Baselines visuais estão versionadas em `tests/visual.spec.ts-snapshots/`; diferenças entre plataformas podem exigir revisão das capturas, nunca atualização cega.

Para auditar, execute o build, mantenha `npm run preview` em outro terminal e rode `npm run audit`. Os relatórios HTML/JSON e ambiente ficam em `reports/lighthouse/`. `AUDIT_URL`, `AUDIT_RUNS` e `AUDIT_REPORT_DIR` permitem configurar destino, quantidade e pasta de relatórios. As medições finais usam três execuções, sem remover imagens, fontes, mocks ou funcionalidades.

## Contas e compra

| Usuário | E-mail | Senha fictícia |
| --- | --- | --- |
| Nova | `nova@kurio.demo` | `Demo12345!` |
| Atlas | `atlas@kurio.demo` | `Demo12345!` |

O login possui atalhos **Usar Nova** e **Usar Atlas**. Ambas as contas começam com uma carteira Ethereum válida. Cadastros novos precisam adicionar sua carteira em **Carteiras**. Cupom válido: **KURIO10**, desconto de 10%.

Explore um NFT, selecione edição e quantidade, adicione ao carrinho, conecte-se e siga para pagamento. Autorize a conexão simulada, revise os valores e confirme. O pedido começa pendente e só apresenta o recibo após confirmação da API/evento. NFTs de redes diferentes precisam ser comprados separadamente com uma carteira da rede correspondente.

## Cenários reproduzíveis

Abra **Demonstração**, no canto inferior direito. Selecione o cenário REST ou use os comandos de eventos. **Resetar todos os dados** restaura catálogo, contas, senhas, carteiras, favoritos, carrinhos, sessões e pedidos e recarrega a aplicação.

- `standard`: sucesso; `empty`: catálogo vazio; `slow`: 1800 ms; `out-of-order`: busca de um caractere demora 1200 ms e as seguintes 80 ms.
- `offline`: falha de conexão; `server-error`: HTTP 503; retorne a `standard` e use **Tentar novamente**.
- `expired-session`: sessão inválida; **Expirar sessão** também invalida sessões já criadas. Login retoma o destino anterior.
- `signup-conflict` e `form-error`: conflito de cadastro e erros de formulário retornados pela API.
- `invalid-coupon` e `expired-coupon`: aplicação e revalidação de cupom inválido/expirado.
- `price-change` e `sold-out`: alteração durante a criação do pedido, exigindo revalidação. Os comandos **Alterar preço** e **Esgotar edições** fazem a alteração imediatamente e emitem `nft.updated`.
- `order-timeout`: a API cria o pedido, mas demora 3500 ms para responder; o Axios expira em 2500 ms. Retorne a `standard` e use **Recuperar a mesma tentativa**, inclusive após refresh.
- `payment-declined`: pedido recusado sem apagar o carrinho; `pending`: mantém o pedido pendente até **Resolver pedido pendente**.
- **Interromper conexão** fecha o WebSocket e exercita reconexão. **Evento duplicado**, **Evento antigo** e seus equivalentes de pedido exercitam deduplicação e versões.
- **Falhar próximo favorito** falha uma mutation para demonstrar rollback otimista.

O ID inicial é `nft-1`. A base inclui 36 NFTs, nove categorias, três redes e quatro edições por NFT. Mudanças ficam no IndexedDB do navegador até o reset.

## Publicação e documentação

Vercel: preset Vite, comando `npm run build`, saída `dist`. `vercel.json` preserva assets e o worker e oferece fallback para acesso direto e refresh das rotas. Os mocks precisam continuar ativos no deploy.

Consulte `CONTRACTS.md` para REST e eventos, `ARCHITECTURE.md` para cache, sessão, persistência, decisões e limitações, e `PERFORMANCE.md` para resultados medidos. A fonte Roboto Mono e todos os assets usados são locais. As quatro imagens originais estão preservadas; variantes WebP geradas a partir delas reduzem o peso sem mudar a composição.

[Evidências de verificação](VERIFICATION.md): suíte final 46/46, oito baselines, compra verificada na Vercel e relatórios HTML. O workflow GitHub executa tipos, lint, build e E2E em push/PR.
