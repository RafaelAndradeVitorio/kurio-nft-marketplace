# Arquitetura e decisões

## Camadas

- `domain`: modelos do transporte e aritmética decimal (Decimal.js, precisão 40).
- `lib`: Axios, QueryClient, sessão e ciclo de vida Socket.IO.
- `features`: catálogo/detalhe, compra e conta. TanStack Router controla rotas, busca e proteção; módulos de conta e compra carregam sob demanda.
- `components/ui`: fontes shadcn/ui geradas pelo CLI, Radix para diálogos e drawers, customizadas com tokens Kurio. Componentes compartilhados mantêm a identidade do Figma.
- `mocks`: MSW REST/WebSocket e banco IndexedDB; nenhum componente, hook ou cliente Axios devolve fixtures.

O bootstrap carrega interface e mocks em paralelo e só monta a aplicação depois de `worker.start()`. O cliente Socket.IO é importado depois desse início, pois Engine.IO captura o construtor WebSocket durante a importação.

## Consistência e persistência

A simulação serializa operações em uma fila e persiste um registro de banco no IndexedDB. Catálogo, estoque, favoritos, carrinhos, usuários, carteiras, sessões e pedidos pertencem à mesma base. Senhas usam PBKDF2/SHA-256 com salt; dados e credenciais são fictícios. Sessões expiram após uma hora ou por comando de demonstração.

O carrinho visitante usa ID persistente e é mesclado por NFT/edição ao autenticar; quantidades são limitadas ao estoque e ajustes são informados. Carrinhos autenticados são separados por usuário. O checkout guarda o rascunho por usuário e a tentativa idempotente antes de enviar. Refresh ou timeout recuperam essa tentativa. Logout limpa tokens, tentativa, rascunho e cache privado.

Pedidos persistem `resolveAt` e resultado determinístico. Um timer do mock ou uma consulta REST resolve o pedido mesmo após refresh. Estoque é reservado na criação e liberado na recusa. O recibo usa o snapshot original; uma confirmação executa os efeitos apenas uma vez.

## Cache e concorrência

Dados públicos são indexados pelos parâmetros completos da consulta e têm stale time de 30 segundos; sessão, 10 segundos; cotação é sempre revalidada no envio. Dados privados incluem o usuário na query key. O Axios recebe o AbortSignal do Query para descartar pesquisas obsoletas. Consultas repetem uma vez apenas para falhas transitórias/rede; mutations não repetem automaticamente.

Favoritos têm atualização otimista, snapshot anterior e rollback. O comando desejado é passado como variável da mutation para não inverter a operação depois de um rerender otimista. Preço/estoque invalida catálogo, carrinho e cotação. Eventos de pedido atualizam seu cache, carrinho e cotação. Logout/troca de conta cancela consultas e encerra o socket anterior.

O cliente acompanha versões por recurso, IDs já vistos e o usuário da subscription. Duplicatas e eventos antigos não regridem estado. A reconexão invalida os recursos ativos; REST é a fonte de reconciliação e autoridade para finalizar a compra.

## Transporte Socket.IO

Uso efetivo de `socket.io-client`, MSW `ws.link` e `@mswjs/socket.io-binding` 0.2.0. MSW normaliza o path Socket.IO ao associar handlers; o mock associa o host reservado `kurio.mock`. Um adaptador completa o handshake Engine.IO quando a detecção antiga do binding encontra o socket lazy do MSW atual. Eventos são codificados/decodificados pelo binding; heartbeat e fechamento utilizam o WebSocket interceptado.

O [binding oficial](https://github.com/mswjs/socket.io-binding) é limitado à namespace padrão e eventos de texto; acknowledgements, namespaces personalizados e anexos binários ficam fora desta implementação. Não se usa polling HTTP ou rooms. Esta simulação suporta os eventos exigidos, identidade por sessão, heartbeat e reconexão. Polling e uma infraestrutura real de Socket.IO exigiriam backend, fora do desafio. O build publicado usa o mesmo transporte e handlers dos testes.

Par verificado no lockfile: MSW **2.15.0**, Socket.IO Client **4.8.4**, binding **0.2.0**. Catálogo, cotação, reconexão, eventos privados, duplicatas e versões antigas passam pelo cliente nessas versões. O pequeno adaptador de handshake está isolado em `mocks/handlers.ts` e precisa ser revisto antes de atualizar o binding. A API descrita pelo README atual do upstream pode ser diferente da versão fixada.

## Design, acessibilidade e performance

Referência: 9 frames desktop e 6 mobile da cópia Figma. Roboto Mono, cores e imagens originais são locais. PNGs originais permanecem disponíveis; WebP a 900 px reduz transferência mantendo a arte. Layouts usam grid/flex responsivos em vez de coordenadas absolutas do código gerado.

Estados ausentes no Figma seguem os mesmos tokens. Perfil, carteiras, favoritos e recibo têm adaptação mobile. Informações de validação e revisão ocupam espaço adicional; o conteúdo pode rolar. Labels persistentes, contraste, foco e mensagens de erro recebem prioridade sobre placeholders e alturas fixas. Diálogos/drawers usam foco Radix; skeletons respeitam movimento reduzido. Ações fora do escopo dão um aviso explícito, sem aparentar sucesso.

Os números decorativos de contagem, preço e carrinho do Figma são substituídos pelos dados reais da simulação. O carrinho inicial é vazio; cenários e testes constroem seus itens. A confirmação é uma rota recuperável, com aparência do recibo do Figma, em vez de uma mensagem de sucesso disparada localmente.

O bootstrap carrega aplicação e mocks em paralelo, mas só monta React depois do worker. Conta e compra são chunks carregados por rota. O preview comprime respostas com gzip, como o hosting de produção; a auditoria utiliza esse servidor. A reserva vertical do skeleton de detalhe mantém o rodapé fora da primeira viewport enquanto a API responde. Campos compartilhados usam IDs React únicos, inclusive nos dois formulários de carteiras. A verificação de zoom modela o viewport CSS reduzido a 384 px (200% de uma janela de 768 px), que também ativa os breakpoints, e não a propriedade CSS `zoom`.

## Limitações

Persistência e simulação são por navegador/origem; não existe sincronização com outros dispositivos nem autenticação segura de produção. A base em memória de uma aba não fornece coordenação entre abas simultâneas. Não há blockchain, login social, gateways, mensagens externas, envio de newsletter, editoriais, suporte, atividade ou ofertas funcionais. Avatares aceitam PNG/JPEG/WebP até 2 MB. Carteiras limitadas a principal/secundária.

## Evidência

Playwright usa Chromium, UI observável e a mesma camada MSW, sem setters de teste. Cenários controlam falhas e eventos; casos pendentes são resolvidos por comando, e regressão visual controla o relógio e aguarda os dados/fontes/imagens. Capturas baseline cobrem quatro telas em desktop/mobile, com verificações adicionais em tablet/zoom. Lighthouse mede o build com todas as funcionalidades e relata as condições e medianas em `PERFORMANCE.md`.
