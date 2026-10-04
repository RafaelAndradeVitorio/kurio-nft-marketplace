# Verificação

Executado em Windows, Node 22.12.0, Vite 7.3.6 e Playwright 1.63.0 / Chromium. O projeto recomenda Node 22.19+ para atender também aos requisitos de engine de todas as ferramentas.

- `npm run typecheck`, `npm run lint` e `npm run build`: aprovados.
- Suíte final no build servido em `127.0.0.1:4174`: **46/46 testes aprovados**, sem retries, desktop 1440×1000 e mobile 390×844, incluindo o novo caso de recotação lenta.
- Após o endurecimento de estados terminais, sincronização do filtro de preço com a URL e isolamento das fontes Tailwind, nova rodada de catálogo, eventos, pedidos e visual: **8/8 aprovados**.
- Oito capturas baseline (quatro páginas × dois perfis), sem atualização na rodada final.
- Testes adicionais em 768 px e viewport CSS 384 px, equivalente ao reflow em zoom 200% numa janela de 768 px; foco do skip link, diálogos e drawer.
- `npm audit`: zero vulnerabilidades encontradas no lockfile instalado.

Relatórios: [suíte completa](reports/e2e/index.html) e [verificação após ajustes finais](reports/e2e-followup/index.html). Para reproduzir, `npm ci`, `npx playwright install chromium`, `npm run test:e2e`. O servidor de desenvolvimento inicia automaticamente; `BASE_URL` permite apontar os testes ao preview de um build ou deploy. Cada teste cria um contexto novo e reseta toda a base pelo endpoint MSW.

Cobertura: filtros/paginação/histórico, cancelamento de respostas antigas, detalhe/estoque/edições, carrinho e cupom com aritmética decimal, sessão/cadastro/mesclagem, favoritos e rollback, isolamento entre usuários, avatar/senha/carteiras, conexão simulada recusada, revisão e cotação alterada, compra confirmada/recusada/pendente, snapshot imutável, idempotência após timeout e conflito de payload, quantidades adicionadas durante pedido pendente, expiração, refresh/reconexão, eventos Socket.IO antigos/duplicados e erros REST recuperáveis.

Falhas durante o desenvolvimento foram usadas para corrigir idempotência após timeout, handshake do binding, rollback de favoritos e labels das duas carteiras. O Playwright está configurado para gerar trace, vídeo e screenshot em qualquer nova falha; a rodada aprovada não gera traces de falha.

A primeira execução no GitHub encontrou uma corrida ao aumentar a quantidade e digitar um cupom antes da recotação. O resumo era desmontado durante atualização em segundo plano. A correção mantém o formulário e a cotação anterior apenas para o mesmo usuário/rede, anuncia a atualização e bloqueia finalizar enquanto consulta valores. O teste adicional com latência de 1800 ms reproduz a regressão em ambos os perfis; a verificação específica de cupom/carrinho passou 4/4. O [trace da regressão antes da correção](reports/regression-before-fix/coupon-trace.zip) está preservado para inspeção com `npx playwright show-trace`.

A suíte completa foi executada novamente após essa correção: 46/46, com regressão visual aprovada sem atualizar baselines. O relatório principal contém essa execução final.

Checkout limpo também verificado no [GitHub Actions](https://github.com/RafaelAndradeVitorio/kurio-nft-marketplace/actions/runs/37172165990): instalação, typecheck, lint, build e 46 testes aprovados para o commit `47762b1`. Artefatos e traces de falha são publicados pelo workflow. Commits posteriores contendo somente relatórios/documentação usam `[skip ci]`; o código da aplicação permanece o mesmo desse job aprovado.

## Vercel

Aplicação pública: https://kurio-nft-marketplace-mauve.vercel.app. Projeto vinculado a `RafaelAndradeVitorio/kurio-nft-marketplace`, branch `main`, framework Vite. Primeiro deployment `dpl_FYde4oMdr7g2zLgeMW4eTKbRfQLU`, código `cd3f45d6b225c6e981784106f1ef7940f5d83f8c`, estado READY. A proteção SSO do novo projeto foi desativada para permitir acesso público à demonstração.

Execução Playwright contra o domínio: **6/6 testes aprovados**, desktop e mobile, detalhe direto/recurso inexistente, compra completa/idempotência/recibo e pedido pendente/desconexão/refresh/reconciliação. Report: [verificação publicada](reports/deployed/index.html). A URL de detalhe retorna HTTP 200 com fallback SPA; o refresh preserva a sessão e os dados de cada contexto. Esta rodada usa os mesmos handlers MSW e cliente Socket.IO em HTTPS.

Depois da correção do cupom, deployment `dpl_CgvcZaFkaE4ujhQ6gUgrYvRVtL4V` / commit `47762b1662b12bac0b693e94fc1812b1406fbbe9` READY. Nova verificação publicada de cupom sob latência e compra completa: **4/4 aprovados**, nos dois perfis. [Relatório final publicado](reports/deployed-final/index.html).

```sh
# PowerShell
$env:BASE_URL='https://kurio-nft-marketplace-mauve.vercel.app'
npx playwright test --grep 'compra completa|detalhe direto|pedido pendente:'
```
