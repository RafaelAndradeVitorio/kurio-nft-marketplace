# Contratos REST e Socket.IO

Fonte tipada: `src/domain/types.ts`. Base REST: `/api`; JSON em todas as respostas. O Axios envia `x-guest` (ID persistente do visitante) e `x-session` (token fictício). Recursos privados exigem sessão válida. ETH usa strings decimais; quantidades, versões e timestamps em milissegundos são números inteiros.

| Método e endpoint | Entrada | Resposta |
| --- | --- | --- |
| POST `/register` | username, email, password, confirm | `{user, token, adjusted}` |
| POST `/login` | email, password | `{user, token, adjusted}`; mescla carrinho visitante |
| GET `/session` | headers | `{user: User|null}` |
| POST `/logout` | headers | `{ok:true}`; invalida token |
| GET `/nfts` | q, collections, networks, min, max, sort, page, tab na query | `{items: NFT[], total, pages, counts}` |
| GET `/nfts/:id` | ID | `NFT` |
| GET `/favorites` | sessão | `string[]` de IDs |
| POST/DELETE `/favorites` | `{nftId}` | lista atualizada |
| GET `/cart` | sessão ou visitante | `{items: CartItem[], coupon, version}` |
| POST `/cart` | `{nftId, editionId, quantity}` | carrinho; soma à quantidade existente |
| PATCH `/cart/items/:nftId` | `{editionId, quantity}` | carrinho; substitui a quantidade |
| DELETE `/cart/items/:nftId?edition=:editionId` | ID e edição | carrinho atualizado |
| POST `/cart/coupon` | `{code}`; vazio remove | carrinho atualizado |
| GET `/quotes?network=Ethereum` | rede | `Quote` com linhas, descontos, taxas, total e problemas |
| POST `/quotes` | `{network}` | mesma cotação |
| POST `/orders` | `OrderInput`; header `Idempotency-Key` | `Order` pendente ou tentativa já existente |
| GET `/orders/:id` | sessão do proprietário | `Order`; resolve/reconcilia seu estado |
| GET/PATCH `/profile` | `Profile` no PATCH | `User` atualizado, sem hash de senha |
| POST `/password` | `{currentPassword, password}` | `{ok:true}` |
| GET `/wallets` | sessão | `Wallet[]` |
| POST `/wallets` | campos de `Wallet` sem ID | carteira criada; máximo duas |
| PATCH `/wallets/:id` | campos de `Wallet` | carteira atualizada |
| POST `/wallet-connection` | `{walletId,status}`; connected/refused/disconnected | `{connected,status}` simulado |

`collections` e `networks` aceitam listas separadas por vírgula. `collections` filtra categorias do layout. `sort` aceita `recent`, `price-asc`, `price-desc`; `tab`: `all`, `new`, `trending`. Página começa em 1 e contém nove itens. Busca sem distinção de maiúsculas.

`CartItem`: `{nftId,editionId,quantity}`. Edições: `unique`, `ten`, `fifty`, `open`. Estoque é por NFT/edição. `Quote`: `{id,lines,subtotal,discount,fee,total,coupon,network,valid,issues}`. Cada linha inclui o preço decimal, a quantidade, seu total, estoque e versão do NFT. A cotação identifica o estado relevante do carrinho; preço, estoque, cupom, rede ou taxas diferentes exigem nova revisão.

`OrderInput`: `{quoteId,walletId,network,provider,collector}`. Collector contém displayName, username, email, profileName, address, referral, ens e note. `Order` contém ID, proprietário, estado, versão, carteira e cotação em snapshot, data e referência fictícia da transação. `pending → confirmed|declined`; estados finais são terminais. Pedido reserva estoque ao ser criado; recusa libera reserva. Confirmação subtrai do carrinho apenas as quantidades do snapshot.

A idempotência é escopada ao usuário: uma chave com os mesmos dados retorna o mesmo pedido, inclusive após timeout. A mesma chave com conteúdo diferente retorna 409. Mutations não possuem retry automático.

## Erros

```json
{"code":"VALIDATION","message":"Revise os campos indicados.","fields":{"email":"Digite um e-mail válido."}}
```

HTTP 401: UNAUTHORIZED/SESSION_EXPIRED; 403: FORBIDDEN; 404: NOT_FOUND; 409: ACCOUNT_CONFLICT, PROFILE_CONFLICT, STOCK_CONFLICT, QUOTE_CHANGED, IDEMPOTENCY_CONFLICT, WALLET_LIMIT; 422: VALIDATION, INVALID_CREDENTIALS, INVALID_COUPON; 503: TRANSIENT. Falhas de rede não retornam JSON e são normalizadas pelo cliente.

## Eventos

Socket.IO em `https://kurio.mock`, path `/socket.io/`, exclusivamente WebSocket. MSW intercepta a conexão: não existe servidor remoto. O cliente emite `subscribe` com token fictício; o mock restringe eventos privados ao usuário dessa sessão.

`nft.updated` e `order.updated` usam:

```json
{"eventId":"event-12","resourceId":"nft-1","version":2,"data":{"id":"nft-1","price":"1.44","version":2}}
```

O exemplo reduz `data` por legibilidade; o evento real envia o snapshot completo de NFT/Order. `order.updated` também contém `userId`. Identificadores e versões permitem ignorar repetições e eventos antigos. Após reconectar, recursos ativos são reconsultados via REST. Os eventos não substituem a validação da cotação no servidor.

## Controle de demonstração

GET `/demo`: cenário, lista e número de conexões. POST `/demo`: `{scenario}` ou `{action,nftId}`. POST `/demo/reset`: `{scenario}` opcional. Endpoints de controle são exclusivos da simulação e não fazem parte de uma API de produção. Testes os usam pelo MSW; não acessam setters React nem o cache diretamente.
