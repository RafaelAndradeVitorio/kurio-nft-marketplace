# Lighthouse — resultados medidos

Auditoria de 4 de outubro de 2026, três execuções por página/perfil, total **12 medições**. Categorias e métricas são medianas calculadas separadamente. Relatórios HTML/JSON e ambiente: [`reports/lighthouse/`](reports/lighthouse/), [resumo JSON](reports/lighthouse/summary.json).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Desktop | 97 | 100 | 100 | 100 | 1053 ms | 0.000335 | 10 ms |
| Detalhe | Desktop | 97 | 100 | 100 | 100 | 1185 ms | 0.000127 | 0 ms |
| Início | Mobile | 80 | 100 | 100 | 100 | 3925 ms | 0.000159 | 181 ms |
| Detalhe | Mobile | 82 | 100 | 100 | 100 | 4029 ms | 0.000149 | 189 ms |

Metas: Performance ≥90, Accessibility ≥95, Best Practices ≥95 e SEO ≥90. Desktop atende todas. **Performance mobile não atinge a meta**; as outras categorias atendem em ambas as páginas.

## Condições e reprodução

Windows 11 (10.0.26200), Intel Core i5-12450HX, Node v22.12.0, Lighthouse **13.5.0**, Playwright **1.63.0**, Chromium instalado pelo Playwright. Cada medição abre novo processo Chrome. Mobile: 390×844 e throttling padrão Lighthouse. Desktop: 1440×1000, CPU 1× e rede 10 Mbps. Build Vite 7.3.6, preview com gzip em `127.0.0.1:4174`, dados padrão, sem testes E2E simultâneos. Aplicação, fontes, imagens, MSW, IndexedDB e Socket.IO ativos.

```sh
npm ci
npx playwright install chromium
npm run build
npm run preview
# Em outro terminal:
npm run audit
```

A porta padrão do script é 4173; a porta 4174 desta medição foi escolhida com `AUDIT_URL`. O ambiente completo está no resumo. Resultados variam por CPU, navegador e carga do sistema; o menor resultado isolado de detalhe desktop foi 87, e a mediana foi 97.

## Análise e limites

O bootstrap registra o worker e carrega o runtime MSW antes de montar React. Aplicação e mocks são baixados em paralelo, mas juntos representam aproximadamente **270 kB gzip**, além de imagens e CSS. Esse custo, a avaliação JavaScript sob CPU mobile e a sequência consulta/renderização do catálogo elevam LCP e TBT. A imagem identificada como LCP no início mobile está num card visível; o relatório aponta atraso de renderização, além do download. O CSS inicial também bloqueia o primeiro paint. Estes são os principais pontos para uma próxima rodada de redução de módulos e antecipação de recursos.

CLS ficou abaixo de 0.001. Skeletons com reserva de espaço, dimensões de imagens e fontes locais corrigiram o deslocamento anterior do rodapé no detalhe. PNGs originais foram convertidos em WebP de 900 px; aplicação e mocks iniciam em paralelo; conta e compra carregam por rota; diálogos auxiliares foram simplificados; preview usa gzip. Nenhum mock, imagem ou fluxo foi desativado na auditoria. Não se usa SSR ou HTML estático específico para obter pontuação melhor.

Os resultados são do build local reproduzível, não uma promessa de performance em todos os aparelhos nem uma auditoria do domínio publicado. A verificação da Vercel é funcional e está descrita em `VERIFICATION.md`.
