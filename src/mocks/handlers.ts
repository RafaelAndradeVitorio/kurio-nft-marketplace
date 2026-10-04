import { http, HttpResponse, delay, ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import { transaction, reset, hashPassword, type Database } from "./database";
import { decimal } from "../domain/money";
import {
  scenarios,
  type Cart,
  type Network,
  type NFT,
  type Order,
  type OrderInput,
  type Profile,
  type Quote,
  type ResourceEvent,
  type Scenario,
  type Wallet,
} from "../domain/types";

class Failure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
const fail = (
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): never => {
  throw new Failure(status, code, message, fields);
};
const clients = new Set<{
  io: ReturnType<typeof toSocketIo>;
  session: string;
}>();
let failFavorite = false;
export const socketUrl = "wss://kurio.mock/socket.io/";
// MSW normalizes the Socket.IO transport path to the server root.
const socket = ws.link(/wss:\/\/kurio\.mock/);
const published = new Set<string>();
function emit(
  db: Database,
  name: "nft.updated" | "order.updated",
  data: NFT | Order,
  mode = "normal",
) {
  const event: ResourceEvent = {
    eventId: `event-${++db.eventCounter}`,
    resourceId: data.id,
    version: data.version,
    userId: "userId" in data ? data.userId : undefined,
    data: structuredClone(data),
  };
  for (const c of clients) {
    const userId = db.sessions[c.session]?.userId;
    if (event.userId && userId !== event.userId) continue;
    c.io.client.emit(name, event);
    if (mode === "duplicate") c.io.client.emit(name, event);
    if (mode === "old")
      c.io.client.emit(name, {
        ...event,
        eventId: `old-${event.eventId}`,
        version: event.version - 1,
        data: {
          ...event.data,
          version: event.version - 1,
          ...("price" in data ? { price: "0.01" } : { status: "pending" }),
        },
      });
  }
}
function finishOrders(db: Database) {
  for (const order of db.orders) {
    if (order.status !== "pending" || order.resolveAt > Date.now()) continue;
    order.status = order.outcome;
    order.version++;
    if (order.status === "confirmed") {
      const cart = db.carts[order.userId];
      if (cart) {
        for (const line of order.quote.lines) {
          const item = cart.items.find(
            (i) => i.nftId === line.nftId && i.editionId === line.editionId,
          );
          if (item) item.quantity = Math.max(0, item.quantity - line.quantity);
        }
        cart.items = cart.items.filter((i) => i.quantity > 0);
        cart.version++;
      }
      order.transaction = `0x${order.id.replace("order-", "").replaceAll("-", "").padEnd(64, "0")}`;
    } else {
      order.reason =
        "Pagamento recusado na simulação. Seus itens foram preservados.";
      for (const line of order.quote.lines) {
        const nft = db.nfts.find((n) => n.id === line.nftId)!;
        nft.editions.find((e) => e.id === line.editionId)!.stock +=
          line.quantity;
        nft.version++;
        emit(db, "nft.updated", nft);
      }
    }
    emit(db, "order.updated", order);
    published.add(order.id);
  }
}
setInterval(() => void transaction((db) => finishOrders(db)), 1000);
const socketHandler = socket.addEventListener("connection", (connection) => {
  const io = toSocketIo(connection);
  const client = { io, session: "" };
  clients.add(client);
  // The binding's older handshake detection sees MSW's lazy server socket as
  // connected in current MSW. Complete Engine.IO explicitly in that case.
  let manualHandshake = false;
  queueMicrotask(() => {
    try {
      void Reflect.get(io.rawServer, "socket").readyState;
      manualHandshake = true;
      connection.client.send(
        "0" +
          JSON.stringify({
            sid: crypto.randomUUID(),
            upgrades: [],
            pingInterval: 20000,
            pingTimeout: 10000,
            maxPayload: 1000000,
          }),
      );
    } catch {
      /* binding provides the initial handshake */
    }
  });
  connection.client.addEventListener("message", (event) => {
    if (event.data === "2") connection.client.send("3");
    if (
      manualHandshake &&
      typeof event.data === "string" &&
      event.data.startsWith("40")
    )
      connection.client.send(
        "40" + JSON.stringify({ sid: crypto.randomUUID() }),
      );
  });
  io.client.on("subscribe", (_event, session: string) => {
    client.session = session;
  });
  const ping = setInterval(() => connection.client.send("2"), 20000);
  connection.client.addEventListener("close", () => {
    clients.delete(client);
    clearInterval(ping);
  });
});
function user(db: Database, request: Request, required = true) {
  const session = db.sessions[request.headers.get("x-session") || ""];
  if (
    db.scenario === "expired-session" ||
    (session && session.expires <= Date.now())
  ) {
    if (session) session.expires = 0;
    if (required)
      fail(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre para continuar.");
    return undefined;
  }
  const account = db.users.find((u) => u.id === session?.userId);
  if (!account && required)
    fail(401, "UNAUTHORIZED", "Entre na sua conta para continuar.");
  return account;
}
function publicUser(account: Database["users"][number]) {
  const { salt: _salt, passwordHash: _passwordHash, ...safe } = account;
  return safe;
}
function cart(db: Database, request: Request) {
  const account = user(db, request, false);
  const owner =
    account?.id || `guest:${request.headers.get("x-guest") || "anonymous"}`;
  return (db.carts[owner] ??= { items: [], coupon: "", version: 1 });
}
function quote(db: Database, c: Cart, network: Network = "Ethereum"): Quote {
  const issues: string[] = [];
  const lines = c.items.map((item) => {
    const nft = db.nfts.find((n) => n.id === item.nftId)!;
    const edition = nft.editions.find((e) => e.id === item.editionId)!;
    if (item.quantity > edition.stock)
      issues.push(
        `${nft.name}: edição indisponível para a quantidade solicitada.`,
      );
    if (nft.network !== network)
      issues.push(`${nft.name}: selecione a rede ${nft.network}.`);
    return {
      ...item,
      name: nft.name,
      image: nft.image,
      price: nft.price,
      total: decimal(nft.price).mul(item.quantity).toString(),
      stock: edition.stock,
      edition: edition.label,
      nftVersion: nft.version,
    };
  });
  const subtotal = lines.reduce((sum, l) => sum.plus(l.total), decimal(0));
  const couponValid =
    c.coupon === "KURIO10" &&
    !["invalid-coupon", "expired-coupon"].includes(db.scenario);
  if (c.coupon && !couponValid)
    issues.push("O cupom não é mais válido. Remova-o ou aplique outro código.");
  const discount = couponValid ? subtotal.mul("0.1") : decimal(0);
  const fee = lines.length
    ? decimal(
        network === "Ethereum"
          ? "0.016"
          : network === "Polygon"
            ? "0.002"
            : "0.001",
      )
    : decimal(0);
  const q = {
    lines,
    subtotal: subtotal.toString(),
    discount: discount.toString(),
    fee: fee.toString(),
    total: subtotal.minus(discount).plus(fee).toString(),
    coupon: c.coupon,
    network,
    valid: issues.length === 0 && lines.length > 0,
    issues,
  };
  return {
    id: btoa(
      unescape(
        encodeURIComponent(
          JSON.stringify({
            version: c.version,
            lines: lines.map((l) => [
              l.nftId,
              l.editionId,
              l.quantity,
              l.price,
              l.nftVersion,
            ]),
            coupon: c.coupon,
            network,
            total: q.total,
          }),
        ),
      ),
    ),
    ...q,
  };
}
function validateFields(body: Record<string, unknown>, fields: string[]) {
  const errors: Record<string, string> = {};
  for (const field of fields)
    if (typeof body[field] !== "string" || !(body[field] as string).trim())
      errors[field] = "Preencha este campo.";
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email)))
    errors.email = "Digite um e-mail válido.";
  if (Object.keys(errors).length)
    fail(422, "VALIDATION", "Revise os campos indicados.", errors);
}
async function route(
  db: Database,
  request: Request,
  body: Record<string, unknown>,
) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api", "");
  const method = request.method;
  finishOrders(db);
  if (path === "/demo" && method === "GET")
    return { scenario: db.scenario, scenarios, connections: clients.size };
  if (path === "/demo" && method === "POST") {
    if (body.scenario) {
      if (!scenarios.includes(body.scenario as Scenario))
        fail(422, "VALIDATION", "Cenário inválido");
      db.scenario = body.scenario as Scenario;
    }
    if (body.action === "expire")
      for (const session of Object.values(db.sessions)) session.expires = 0;
    if (body.action === "favorite-failure") failFavorite = true;
    if (body.action === "disconnect")
      for (const c of clients)
        c.io.rawClient.close(1012, "Interrupção simulada");
    if (
      body.action === "price" ||
      body.action === "stock" ||
      body.action === "duplicate" ||
      body.action === "old"
    ) {
      const nft = db.nfts.find((n) => n.id === (body.nftId || "nft-1"))!;
      if (body.action === "price")
        nft.price = decimal(nft.price).plus("0.25").toString();
      if (body.action === "stock") for (const e of nft.editions) e.stock = 0;
      nft.version++;
      emit(db, "nft.updated", nft, String(body.action));
    }
    if (body.action === "order-old" || body.action === "order-duplicate") {
      const order = db.orders.at(-1);
      if (order)
        emit(
          db,
          "order.updated",
          order,
          body.action === "order-old" ? "old" : "duplicate",
        );
    }
    if (body.action === "resolve")
      for (const o of db.orders) if (o.status === "pending") o.resolveAt = 0;
    finishOrders(db);
    return { ok: true };
  }
  if (path === "/session" && method === "GET") {
    const account = user(db, request, false);
    return { user: account ? publicUser(account) : null };
  }
  if (path === "/logout") {
    delete db.sessions[request.headers.get("x-session") || ""];
    return { ok: true };
  }
  if (path === "/login" || path === "/register") {
    validateFields(
      body,
      path === "/register"
        ? ["username", "email", "password"]
        : ["email", "password"],
    );
    let account = db.users.find(
      (u) => u.email.toLowerCase() === String(body.email).toLowerCase(),
    );
    if (path === "/register") {
      if (
        account ||
        db.scenario === "signup-conflict" ||
        db.users.some((u) => u.username === body.username)
      )
        fail(
          409,
          "ACCOUNT_CONFLICT",
          "E-mail ou nome de usuário já cadastrado.",
          { email: "Este e-mail ou usuário já está em uso." },
        );
      if (String(body.password).length < 8)
        fail(422, "VALIDATION", "Senha muito curta.", {
          password: "Use pelo menos 8 caracteres.",
        });
      const salt = crypto.randomUUID();
      account = {
        id: crypto.randomUUID(),
        username: String(body.username),
        email: String(body.email),
        displayName: String(body.username),
        ens: "",
        walletNickname: "",
        avatar: "",
        salt,
        passwordHash: await hashPassword(String(body.password), salt),
      };
      db.users.push(account);
      db.wallets[account.id] = [];
    } else if (
      !account ||
      (await hashPassword(String(body.password), account.salt)) !==
        account.passwordHash
    )
      fail(422, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.", {
        password: "Confira suas credenciais.",
      });
    if (!account) return fail(422, "INVALID_CREDENTIALS", "Conta inválida");
    const token = crypto.randomUUID();
    db.sessions[token] = { userId: account.id, expires: Date.now() + 3600000 };
    if (db.scenario === "expired-session") db.scenario = "standard";
    const guest = db.carts[`guest:${request.headers.get("x-guest")}`];
    let adjusted = false;
    if (guest) {
      const target = (db.carts[account.id] ??= {
        items: [],
        coupon: "",
        version: 1,
      });
      for (const item of guest.items) {
        const stock = db.nfts
          .find((n) => n.id === item.nftId)!
          .editions.find((e) => e.id === item.editionId)!.stock;
        let existing = target.items.find(
          (i) => i.nftId === item.nftId && i.editionId === item.editionId,
        );
        if (!existing) {
          existing = { ...item, quantity: 0 };
          target.items.push(existing);
        }
        const sum = existing.quantity + item.quantity;
        existing.quantity = Math.min(stock, sum);
        if (sum > stock) adjusted = true;
      }
      target.items = target.items.filter((i) => i.quantity);
      target.coupon = guest.coupon || target.coupon;
      target.version++;
      delete db.carts[`guest:${request.headers.get("x-guest")}`];
    }
    return { user: publicUser(account), token, adjusted };
  }
  if (path === "/nfts") {
    const p = url.searchParams;
    const all = db.scenario === "empty" ? [] : db.nfts;
    const filtered = all.filter(
      (n) =>
        (!p.get("q") ||
          n.name.toLowerCase().includes(p.get("q")!.toLowerCase())) &&
        (!p.get("collections") ||
          p.get("collections")!.split(",").includes(n.category)) &&
        (!p.get("networks") ||
          p.get("networks")!.split(",").includes(n.network)) &&
        (!p.get("min") || decimal(n.price).gte(p.get("min")!)) &&
        (!p.get("max") || decimal(n.price).lte(p.get("max")!)) &&
        (p.get("tab") !== "trending" || n.rare) &&
        (p.get("tab") !== "new" || n.createdAt >= 18),
    );
    filtered.sort((a, b) =>
      p.get("sort") === "price-asc"
        ? decimal(a.price).cmp(b.price)
        : p.get("sort") === "price-desc"
          ? decimal(b.price).cmp(a.price)
          : b.createdAt - a.createdAt,
    );
    const page = Math.max(1, Number(p.get("page")) || 1);
    return {
      items: filtered.slice((page - 1) * 9, page * 9),
      total: filtered.length,
      pages: Math.ceil(filtered.length / 9),
      counts: Object.fromEntries(
        [...new Set(db.nfts.map((n) => n.category))].map((c) => [
          c,
          db.nfts.filter((n) => n.category === c).length,
        ]),
      ),
    };
  }
  if (path.startsWith("/nfts/"))
    return (
      db.nfts.find((n) => n.id === path.split("/")[2]) ||
      fail(404, "NOT_FOUND", "Este NFT não foi encontrado.")
    );
  if (path === "/cart" && method === "GET") return cart(db, request);
  if (
    (path === "/cart" && method === "POST") ||
    path.startsWith("/cart/items/")
  ) {
    const c = cart(db, request);
    const nftId = String(body.nftId || path.split("/")[3]);
    const editionId = String(
      body.editionId || url.searchParams.get("edition") || "fifty",
    );
    const nft =
      db.nfts.find((n) => n.id === nftId) ||
      fail(404, "NOT_FOUND", "NFT inexistente");
    const edition =
      nft.editions.find((e) => e.id === editionId) ||
      fail(404, "NOT_FOUND", "Edição inexistente");
    const quantity = Number(body.quantity);
    const index = c.items.findIndex(
      (i) => i.nftId === nftId && i.editionId === editionId,
    );
    if (method === "DELETE") {
      if (index >= 0) c.items.splice(index, 1);
    } else {
      const next =
        method === "POST"
          ? quantity + (index >= 0 ? c.items[index].quantity : 0)
          : quantity;
      if (!Number.isInteger(next) || next < 1 || next > edition.stock)
        fail(409, "STOCK_CONFLICT", "Quantidade indisponível nesta edição.");
      if (index < 0) c.items.push({ nftId, editionId, quantity: next });
      else c.items[index].quantity = next;
    }
    c.version++;
    return c;
  }
  if (path === "/cart/coupon") {
    const c = cart(db, request);
    const code = String(body.code || "")
      .trim()
      .toUpperCase();
    if (
      code &&
      (code !== "KURIO10" ||
        db.scenario === "invalid-coupon" ||
        db.scenario === "expired-coupon")
    )
      fail(
        422,
        "INVALID_COUPON",
        code === "EXPIRED" || db.scenario === "expired-coupon"
          ? "Este cupom expirou."
          : "Cupom inválido.",
      );
    c.coupon = code;
    c.version++;
    return c;
  }
  if (path === "/quotes")
    return quote(
      db,
      cart(db, request),
      (body.network ||
        url.searchParams.get("network") ||
        "Ethereum") as Network,
    );
  const account = user(db, request)!;
  if (path === "/wallet-connection") {
    const wallet = db.wallets[account.id].find((w) => w.id === body.walletId);
    if (!wallet) fail(422, "VALIDATION", "Carteira não cadastrada.");
    return { connected: body.status === "connected", status: body.status };
  }
  if (
    db.scenario === "form-error" &&
    ["PATCH", "POST", "PUT"].includes(method) &&
    ["/profile", "/password", "/wallets"].some((p) => path.startsWith(p))
  )
    fail(422, "VALIDATION", "Erro de validação simulado.", {
      email: "Este e-mail não pode ser utilizado.",
    });
  if (path === "/favorites") {
    const f = (db.favorites[account.id] ??= []);
    if (method === "GET") return f;
    if (failFavorite) {
      failFavorite = false;
      fail(
        503,
        "TRANSIENT",
        "Não foi possível atualizar o favorito. Tente novamente.",
      );
    }
    const id = String(body.nftId);
    if (!db.nfts.some((n) => n.id === id))
      fail(404, "NOT_FOUND", "NFT inexistente");
    if (method === "POST" && !f.includes(id)) f.push(id);
    if (method === "DELETE")
      db.favorites[account.id] = f.filter((i) => i !== id);
    return db.favorites[account.id];
  }
  if (path === "/profile") {
    if (method === "GET") return publicUser(account);
    validateFields(body, [
      "displayName",
      "username",
      "email",
      "ens",
      "walletNickname",
    ]);
    if (
      db.users.some(
        (u) =>
          u.id !== account.id &&
          (u.email === body.email || u.username === body.username),
      )
    )
      fail(409, "PROFILE_CONFLICT", "E-mail ou usuário já utilizado.", {
        email: "Este e-mail ou usuário está em uso.",
      });
    if (
      body.avatar &&
      (String(body.avatar).length > 2800000 ||
        !/^data:image\/(png|jpeg|webp);base64,/.test(String(body.avatar)))
    )
      fail(
        422,
        "VALIDATION",
        "Avatar inválido. Use PNG, JPEG ou WebP de até 2 MB.",
        { avatar: "Formato ou tamanho inválido." },
      );
    const keys: (keyof Profile)[] = [
      "displayName",
      "username",
      "email",
      "ens",
      "walletNickname",
      "avatar",
    ];
    for (const k of keys)
      if (typeof body[k] === "string") account[k] = String(body[k]);
    return publicUser(account);
  }
  if (path === "/password") {
    validateFields(body, ["currentPassword", "password"]);
    if (
      (await hashPassword(String(body.currentPassword), account.salt)) !==
      account.passwordHash
    )
      fail(422, "VALIDATION", "Senha atual incorreta.", {
        currentPassword: "Senha atual incorreta.",
      });
    if (String(body.password).length < 8)
      fail(422, "VALIDATION", "Use pelo menos 8 caracteres.", {
        password: "Use pelo menos 8 caracteres.",
      });
    account.passwordHash = await hashPassword(
      String(body.password),
      account.salt,
    );
    return { ok: true };
  }
  if (path.startsWith("/wallets")) {
    const wallets = (db.wallets[account.id] ??= []);
    if (method === "GET") return wallets;
    validateFields(body, [
      "displayName",
      "nickname",
      "network",
      "address",
      "provider",
      "email",
      "profileName",
      "referral",
      "ens",
    ]);
    const network = body.network as Network;
    if (!["Ethereum", "Polygon", "Solana"].includes(network))
      fail(422, "VALIDATION", "Rede inválida.", {
        network: "Selecione uma rede válida.",
      });
    if (
      network === "Solana"
        ? !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(body.address))
        : !/^0x[a-fA-F0-9]{40}$/.test(String(body.address))
    )
      fail(422, "VALIDATION", "Endereço de carteira inválido.", {
        address: "Informe um endereço válido para a rede.",
      });
    const id = path.split("/")[2];
    if (id) {
      const index = wallets.findIndex((w) => w.id === id);
      if (index < 0) fail(404, "NOT_FOUND", "Carteira inexistente");
      wallets[index] = { ...wallets[index], ...body, id } as Wallet;
      return wallets[index];
    }
    if (wallets.length >= 2)
      fail(409, "WALLET_LIMIT", "Use a carteira principal e a secundária.");
    const w = {
      ...body,
      id: crypto.randomUUID(),
      secondary: wallets.length > 0,
    } as Wallet;
    wallets.push(w);
    return w;
  }
  if (path === "/orders" && method === "POST") {
    const key =
      request.headers.get("idempotency-key") ||
      fail(422, "VALIDATION", "Chave de idempotência obrigatória.");
    const input = body as unknown as OrderInput;
    if (!input.collector)
      fail(422, "VALIDATION", "Dados do colecionador obrigatórios.");
    const inputHash = JSON.stringify(input);
    const previous = db.orders.find(
      (o) => o.userId === account.id && o.key === key,
    );
    if (previous) {
      if (previous.inputHash !== inputHash)
        fail(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Esta tentativa já foi usada com outros dados.",
        );
      return previous;
    }
    validateFields(input.collector as unknown as Record<string, unknown>, [
      "displayName",
      "username",
      "email",
      "profileName",
      "address",
      "referral",
      "ens",
    ]);
    if (
      !["MetaMask", "WalletConnect", "Coinbase Wallet"].includes(input.provider)
    )
      fail(422, "VALIDATION", "Selecione um provedor válido.");
    if (
      input.network !== "Solana" &&
      !/^0x[a-fA-F0-9]{40}$/.test(input.collector.address)
    )
      fail(422, "VALIDATION", "Endereço de carteira inválido.", {
        address: "Informe um endereço válido.",
      });
    if (db.scenario === "price-change" || db.scenario === "sold-out") {
      const nft = db.nfts.find(
        (n) => n.id === cart(db, request).items[0]?.nftId,
      );
      if (nft) {
        if (db.scenario === "price-change")
          nft.price = decimal(nft.price).plus("0.25").toString();
        else for (const e of nft.editions) e.stock = 0;
        nft.version++;
        emit(db, "nft.updated", nft);
      }
      db.scenario = "standard";
    }
    const q = quote(db, cart(db, request), input.network);
    if (q.id !== input.quoteId || !q.valid)
      fail(
        409,
        "QUOTE_CHANGED",
        "Preço, disponibilidade ou taxas mudaram. Revise a cotação antes de confirmar.",
      );
    const wallet =
      db.wallets[account.id].find((w) => w.id === input.walletId) ||
      fail(422, "VALIDATION", "Selecione uma carteira cadastrada.");
    if (wallet.network !== input.network)
      fail(422, "VALIDATION", "A carteira deve usar a rede selecionada.");
    const order: Order = {
      id: `order-${crypto.randomUUID()}`,
      userId: account.id,
      status: "pending",
      version: 1,
      quote: q,
      collector: input.collector,
      wallet: structuredClone(wallet),
      provider: input.provider,
      transaction: "",
      createdAt: Date.now(),
      resolveAt: Date.now() + (db.scenario === "pending" ? 86400000 : 1500),
      outcome: db.scenario === "payment-declined" ? "declined" : "confirmed",
      key,
      inputHash,
    };
    db.orders.push(order);
    for (const line of q.lines) {
      const n = db.nfts.find((n) => n.id === line.nftId)!;
      n.editions.find((e) => e.id === line.editionId)!.stock -= line.quantity;
      n.version++;
      emit(db, "nft.updated", n);
    }
    emit(db, "order.updated", order);
    return order;
  }
  if (path.startsWith("/orders/")) {
    const order =
      db.orders.find((o) => o.id === path.split("/")[2]) ||
      fail(404, "NOT_FOUND", "Pedido não encontrado.");
    if (order.userId !== account.id)
      fail(403, "FORBIDDEN", "Este pedido pertence a outro colecionador.");
    return order;
  }
  fail(404, "NOT_FOUND", "Recurso não encontrado.");
}
export const handlers = [
  socketHandler,
  http.all("/api/*", async ({ request }) => {
    try {
      const path = new URL(request.url).pathname;
      if (path === "/api/demo/reset") {
        const b = (await request.json()) as { scenario?: Scenario };
        published.clear();
        failFavorite = false;
        return HttpResponse.json(await reset(b.scenario));
      }
      const body =
        request.method === "GET"
          ? {}
          : ((await request.json().catch(() => ({}))) as Record<
              string,
              unknown
            >);
      const scenario = await transaction((db) => db.scenario);
      const demo = path.startsWith("/api/demo");
      if (!demo && scenario === "offline") return HttpResponse.error();
      if (!demo && scenario === "server-error")
        return HttpResponse.json(
          {
            code: "TRANSIENT",
            message: "Serviço temporariamente indisponível.",
          },
          { status: 503 },
        );
      const result = await transaction((db) => route(db, request, body));
      if (!demo)
        await delay(
          scenario === "slow"
            ? 1800
            : scenario === "out-of-order"
              ? new URL(request.url).searchParams.get("q")?.length === 1
                ? 1200
                : 80
              : scenario === "order-timeout" && path === "/api/orders"
                ? 3500
                : 120,
        );
      return HttpResponse.json(result);
    } catch (error) {
      if (error instanceof Failure)
        return HttpResponse.json(
          { code: error.code, message: error.message, fields: error.fields },
          { status: error.status },
        );
      console.error(error);
      return HttpResponse.json(
        { code: "INTERNAL", message: "Falha inesperada na simulação." },
        { status: 500 },
      );
    }
  }),
];
