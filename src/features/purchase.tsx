import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  Breadcrumb,
  MobileTitle,
  Loading,
  ErrorView,
  Quantity,
  Trash2,
  Recommendations,
  Fields,
  Auxiliary,
} from "../components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { api, errorInfo, get, queryClient } from "../lib/api";
import { useCart, useSession } from "../lib/state";
import { decimal, eth } from "../domain/money";
import type {
  Collector,
  Network,
  Order,
  OrderInput,
  Quote,
  Wallet,
} from "../domain/types";
function useQuote(network: Network = "Ethereum") {
  const { owner } = useSession();
  const c = useCart();
  return useQuery({
    queryKey: ["quote", owner, c.data?.version, network],
    queryFn: ({ signal }) => get<Quote>(`/quotes?network=${network}`, signal),
    enabled: !!c.data,
    staleTime: 0,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === owner &&
      previousQuery?.queryKey[3] === network
        ? previous
        : undefined,
  });
}
export function QuoteSummary({
  quote,
  coupon = false,
}: {
  quote: Quote;
  coupon?: boolean;
}) {
  const { notify } = useSession();
  const [code, setCode] = useState(quote.coupon);
  useEffect(() => setCode(quote.coupon), [quote.coupon]);
  const mutation = useMutation({
    mutationFn: (value: string) => api.post("/cart/coupon", { code: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["quote"] });
      notify("Cupom atualizado.");
    },
    onError: (error) => notify(errorInfo(error).message),
  });
  return (
    <>
      {coupon && (
        <>
          <label htmlFor="coupon">Código promocional</label>
          <form
            className="coupon"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(code);
            }}
          >
            <Input
              id="coupon"
              placeholder="Digite o código promocional…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={mutation.isError}
              aria-describedby={mutation.isError ? "coupon-error" : undefined}
            />
            <Button disabled={mutation.isPending}>Aplicar</Button>
          </form>
          {mutation.isError && (
            <p id="coupon-error" className="field-error" role="alert">
              {errorInfo(mutation.error).message}
            </p>
          )}
          {quote.coupon && (
            <button className="text-action" onClick={() => mutation.mutate("")}>
              Remover cupom {quote.coupon}
            </button>
          )}
        </>
      )}
      <dl className="totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{eth(quote.subtotal)}</dd>
        </div>
        <div>
          <dt>Desconto do lançamento</dt>
          <dd>(−) {eth(quote.discount)}</dd>
        </div>
        <div>
          <dt>Taxa de rede</dt>
          <dd>
            {eth(quote.fee)}
            <small>Taxa estimada</small>
          </dd>
        </div>
        <div className="total">
          <dt>Total</dt>
          <dd>{eth(quote.total)}</dd>
        </div>
      </dl>
    </>
  );
}
export function CartPage() {
  const { user, notify } = useSession();
  const cart = useCart();
  const quote = useQuote();
  const navigate = useNavigate();
  const change = useMutation({
    mutationFn: ({
      nftId,
      editionId,
      quantity,
    }: {
      nftId: string;
      editionId: string;
      quantity?: number;
    }) =>
      api.request({
        url: `/cart/items/${nftId}?edition=${editionId}`,
        method: quantity ? "PATCH" : "DELETE",
        data: quantity ? { editionId, quantity } : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["quote"] });
    },
    onError: (error) => notify(errorInfo(error).message),
  });
  if (cart.isPending || quote.isPending) return <Loading kind="summary" />;
  if (cart.isError || quote.isError)
    return (
      <ErrorView
        error={cart.error || quote.error}
        retry={() => {
          void cart.refetch();
          void quote.refetch();
        }}
      />
    );
  const q = quote.data;
  return (
    <>
      <Breadcrumb label="Carrinho" />
      <MobileTitle title="Carrinho de NFTs" />
      {!q.lines.length ? (
        <div className="empty">
          <h1>Seu carrinho está vazio</h1>
          <p>Encontre uma obra para começar sua coleção.</p>
          <Link to="/" className="button-link">
            Explorar NFTs
          </Link>
        </div>
      ) : (
        <>
          <h1 className="sr-only">Carrinho de NFTs</h1>
          <div className="cart-layout">
            <div>
              <div className="cart-table-header">
                <span>NFTs</span>
                <span>Preço</span>
                <span>Edições</span>
                <span>Total</span>
              </div>
              <div className="cart-items">
                {q.lines.map((l) => (
                  <article key={`${l.nftId}-${l.editionId}`}>
                    <Link
                      to="/nft/$id"
                      params={{ id: l.nftId }}
                      className="cart-nft"
                    >
                      <img
                        src={l.image}
                        alt={l.name}
                        width="100"
                        height="100"
                      />
                      <div>
                        <h2>{l.name}</h2>
                        <small>Edição: {l.edition}</small>
                        <b className="mobile-copy">{eth(l.total)}</b>
                      </div>
                    </Link>
                    <span className="unit-price">{eth(l.price)}</span>
                    <Quantity
                      value={l.quantity}
                      max={l.stock}
                      disabled={change.isPending}
                      onChange={(quantity) => change.mutate({ ...l, quantity })}
                    />
                    <b className="line-total">{eth(l.total)}</b>
                    <button
                      className="remove"
                      aria-label={`Remover ${l.name}`}
                      disabled={change.isPending}
                      onClick={() =>
                        change.mutate({ ...l, quantity: undefined })
                      }
                    >
                      <Trash2 size={20} />
                    </button>
                    {l.quantity > l.stock && (
                      <p className="stock-warning" role="alert">
                        Quantidade indisponível. Remova o item ou reduza a
                        quantidade.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
            <aside className="cart-summary">
              <h2>Resumo da carteira</h2>
              <QuoteSummary quote={q} coupon />
              <span className="sr-only" role="status" aria-live="polite">
                {quote.isFetching
                  ? "Atualizando cotação do carrinho"
                  : "Cotação atualizada"}
              </span>
              {q.issues
                .filter((i) => !i.includes("selecione a rede"))
                .map((i) => (
                  <p role="alert" className="field-error" key={i}>
                    {i}
                  </p>
                ))}
              <Button
                className="checkout-button"
                disabled={
                  q.lines.some((l) => l.quantity > l.stock) ||
                  change.isPending ||
                  quote.isFetching
                }
                onClick={() =>
                  void navigate(
                    user
                      ? { to: "/pagamento" }
                      : { to: "/entrar", search: { redirect: "/pagamento" } },
                  )
                }
              >
                Conectar e finalizar
              </Button>
              <Link to="/">Continuar explorando</Link>
            </aside>
          </div>
          <Recommendations />
        </>
      )}
    </>
  );
}
const collectorSpec = [
  { name: "displayName", label: "Nome de exibição", required: true },
  { name: "username", label: "Nome de usuário", required: true },
  { name: "profileName", label: "Nome do perfil", required: true },
  { name: "address", label: "Endereço da carteira", required: true },
  { name: "referral", label: "Código de indicação", required: true },
  { name: "email", label: "E-mail", type: "email", required: true },
  { name: "ens", label: "Nome ENS", required: true },
  { name: "note", label: "Observação do colecionador (opcional)" },
];
type Attempt = {
  userId: string;
  key: string;
  input: OrderInput;
  orderId?: string;
};
function storedAttempt(userId: string | undefined): Attempt | undefined {
  try {
    const data = JSON.parse(
      localStorage.getItem("kurio.attempt") || "null",
    ) as Attempt | null;
    return data && data.userId === userId ? data : undefined;
  } catch {
    return undefined;
  }
}
export function CheckoutPage() {
  const { user, notify, connected } = useSession();
  const navigate = useNavigate();
  const wallets = useQuery({
    queryKey: ["wallets", user?.id],
    queryFn: ({ signal }) => get<Wallet[]>("/wallets", signal),
  });
  const [walletId, setWalletId] = useState("");
  const [network, setNetwork] = useState<Network>("Ethereum");
  const [provider, setProvider] = useState("Coinbase Wallet");
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectDialog, setConnectDialog] = useState(false);
  const [review, setReview] = useState<Quote | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`kurio.checkout.${user?.id}`) || "{}",
      ) as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState<Attempt | undefined>(() =>
    storedAttempt(user?.id),
  );
  const quote = useQuote(network);
  useEffect(() => {
    const w = wallets.data?.find((w) => w.id === walletId) || wallets.data?.[0];
    if (!w) return;
    setWalletId(w.id);
    setNetwork(w.network);
    setValues((v) => ({
      displayName: user?.displayName || "",
      username: user?.username || "",
      email: user?.email || "",
      profileName: w.profileName,
      address: w.address,
      referral: w.referral,
      ens: w.ens,
      note: v.note || "",
      ...v,
    }));
    setWalletConnected(false);
  }, [wallets.data, walletId, user]);
  useEffect(() => {
    if (user && Object.keys(values).length)
      localStorage.setItem(`kurio.checkout.${user.id}`, JSON.stringify(values));
  }, [values, user]);
  useEffect(() => {
    if (attempt?.orderId)
      void navigate({ to: "/pedido/$id", params: { id: attempt.orderId } });
  }, [attempt?.orderId, navigate]);
  const connect = useMutation({
    mutationFn: (status: string) =>
      api.post<{ connected: boolean }>("/wallet-connection", {
        walletId,
        status,
      }),
    onSuccess: (r) => {
      setWalletConnected(r.data.connected);
      setConnectDialog(false);
      notify(
        r.data.connected
          ? "Carteira conectada na simulação."
          : "Conexão recusada. Você pode tentar novamente.",
      );
    },
    onError: (error) => notify(errorInfo(error).message),
  });
  const purchase = useMutation({
    mutationFn: async () => {
      let current = attempt;
      if (!current) {
        const latest = await quote.refetch();
        if (!latest.data?.valid || latest.data.id !== review?.id) {
          setReview(null);
          notify("A cotação mudou. Revise os valores e confirme novamente.");
          throw new Error("Cotação atualizada. Revise sua compra.");
        }
        current = {
          userId: user!.id,
          key: crypto.randomUUID(),
          input: {
            quoteId: latest.data.id,
            walletId,
            network,
            provider,
            collector: values as unknown as Collector,
          },
        };
        localStorage.setItem("kurio.attempt", JSON.stringify(current));
        setAttempt(current);
      }
      const { data } = await api.post<Order>("/orders", current.input, {
        headers: { "Idempotency-Key": current.key },
      });
      return { data, current };
    },
    onSuccess: ({ data, current }) => {
      const next = { ...current, orderId: data.id };
      localStorage.setItem("kurio.attempt", JSON.stringify(next));
      setAttempt(next);
      void navigate({ to: "/pedido/$id", params: { id: data.id } });
    },
    onError: (error) => {
      const info = errorInfo(error);
      setFailure(info.message);
      setErrors(info.fields || {});
      if (info.code === "QUOTE_CHANGED") {
        localStorage.removeItem("kurio.attempt");
        setAttempt(undefined);
        setReview(null);
        void quote.refetch();
      }
      notify(info.message);
    },
  });
  if (wallets.isPending || quote.isPending) return <Loading kind="summary" />;
  if (wallets.isError || quote.isError)
    return (
      <ErrorView
        error={wallets.error || quote.error}
        retry={() => {
          void wallets.refetch();
          void quote.refetch();
        }}
      />
    );
  const q = quote.data;
  if (!wallets.data.length)
    return (
      <div className="empty">
        <h1>Cadastre sua carteira</h1>
        <p>Adicione uma carteira simulada para finalizar sua compra.</p>
        <Link to="/carteiras" className="button-link">
          Cadastrar carteira
        </Link>
      </div>
    );
  if (!q.lines.length && !attempt)
    return (
      <div className="empty">
        <h1>Seu carrinho está vazio</h1>
        <Link to="/">Explorar NFTs</Link>
      </div>
    );
  return (
    <>
      <Breadcrumb label="Pagamento" />
      <MobileTitle title="Pagamento com carteira" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!walletConnected) {
            setConnectDialog(true);
            return;
          }
          setErrors({});
          setFailure("");
          setReview(q);
        }}
        className="checkout-layout"
      >
        <section className="collector-form">
          <h1>Perfil do colecionador</h1>
          <div className="form-grid">
            <Fields
              spec={collectorSpec}
              values={values}
              setValues={setValues}
              errors={errors}
            />
          </div>
        </section>
        <section className="payment-summary">
          <h2>Carteira conectada</h2>
          <div className="wallet-select">
            {wallets.data.map((w) => (
              <label key={w.id}>
                <input
                  type="radio"
                  name="wallet"
                  checked={walletId === w.id}
                  onChange={() => {
                    setWalletId(w.id);
                    setValues((v) => ({
                      ...v,
                      address: w.address,
                      profileName: w.profileName,
                      referral: w.referral,
                      ens: w.ens,
                    }));
                    setReview(null);
                  }}
                />
                <span>
                  <b>{w.nickname}</b>
                  <small>
                    {w.address.slice(0, 8)}…{w.address.slice(-4)}
                    <br />
                    Rede {w.network}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <label className="network-select">
            Rede de pagamento
            <select
              aria-label="Rede de pagamento"
              value={network}
              onChange={(e) => {
                setNetwork(e.target.value as Network);
                setWalletConnected(false);
                setReview(null);
              }}
            >
              {["Ethereum", "Polygon", "Solana"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <h2>Seus NFTs</h2>
          <div className="receipt-lines">
            {q.lines.map((l) => (
              <div key={`${l.nftId}-${l.editionId}`}>
                <img src={l.image} alt={l.name} width="70" height="70" />
                <span>
                  <b>{l.name}</b>
                  <small>
                    {l.edition} (× {l.quantity})
                  </small>
                </span>
                <strong>{eth(l.total)}</strong>
              </div>
            ))}
          </div>
          <QuoteSummary quote={q} />
          <h2>Carteira e rede</h2>
          <div className="providers">
            {["WalletConnect", "MetaMask", "Coinbase Wallet"].map((p, i) => (
              <label key={p}>
                <span className="provider-mark">{["W", "M", "C"][i]}</span>
                <span>{p}</span>
                <input
                  type="radio"
                  name="provider"
                  checked={provider === p}
                  onChange={() => {
                    setProvider(p);
                    setWalletConnected(false);
                  }}
                />
              </label>
            ))}
          </div>
          <div className="connection-status" role="status">
            {walletConnected
              ? "Carteira conectada · simulação"
              : "Carteira desconectada"}{" "}
            · {connected ? "Eventos conectados" : "Reconectando eventos…"}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              walletConnected
                ? connect.mutate("disconnected")
                : setConnectDialog(true)
            }
          >
            {walletConnected ? "Desconectar carteira" : "Conectar carteira"}
          </Button>
          {q.issues.map((i) => (
            <p className="field-error" role="alert" key={i}>
              {i}
            </p>
          ))}
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          {attempt ? (
            <Button
              type="button"
              disabled={purchase.isPending}
              onClick={() => purchase.mutate()}
            >
              {purchase.isPending
                ? "Recuperando pedido…"
                : "Recuperar a mesma tentativa"}
            </Button>
          ) : (
            <Button
              className="confirm-button"
              disabled={!q.valid || purchase.isPending || quote.isFetching}
            >
              Revisar compra
            </Button>
          )}
          <Link to="/carrinho">Voltar ao carrinho</Link>
        </section>
      </form>
      <Dialog open={connectDialog} onOpenChange={setConnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar {provider}</DialogTitle>
            <DialogDescription>
              Conexão simulada. Nenhuma extensão ou transação real será
              utilizada.
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={connect.isPending}
            onClick={() => connect.mutate("connected")}
          >
            Autorizar conexão simulada
          </Button>
          <Button variant="outline" onClick={() => connect.mutate("refused")}>
            Recusar conexão
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !purchase.isPending) setReview(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise sua compra</DialogTitle>
            <DialogDescription>
              {q.lines.length} NFT(s) · {provider} · {network}. Os valores serão
              revalidados antes do envio.
            </DialogDescription>
          </DialogHeader>
          {review && <QuoteSummary quote={review} />}
          <Button
            disabled={purchase.isPending || !walletConnected}
            onClick={() => purchase.mutate()}
          >
            {purchase.isPending ? "Enviando pedido…" : "Confirmar compra"}
          </Button>
          <Button
            variant="outline"
            disabled={purchase.isPending}
            onClick={() => setReview(null)}
          >
            Continuar revisando
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function OrderPage({ id }: { id: string }) {
  const { user } = useSession();
  const order = useQuery({
    queryKey: ["order", user?.id, id],
    queryFn: ({ signal }) => get<Order>(`/orders/${id}`, signal),
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 1500 : false),
  });
  useEffect(() => {
    if (order.data && order.data.status !== "pending") {
      const a = storedAttempt(user?.id);
      if (a?.orderId === id) localStorage.removeItem("kurio.attempt");
      if (order.data.status === "confirmed")
        localStorage.removeItem(`kurio.checkout.${user?.id}`);
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["quote"] });
    }
  }, [order.data?.status, id, user?.id]);
  if (order.isPending) return <Loading kind="summary" />;
  if (order.isError)
    return <ErrorView error={order.error} retry={() => void order.refetch()} />;
  const o = order.data;
  return (
    <section className={`order-receipt ${o.status}`}>
      <Link to="/" className="receipt-close" aria-label="Voltar ao marketplace">
        ×
      </Link>
      <div className="receipt-heading">
        <span className="thank-you">
          {o.status === "confirmed" ? (
            <img src="/assets/21283.svg" width="90" height="78" alt="" />
          ) : o.status === "declined" ? (
            "!"
          ) : (
            "◷"
          )}
        </span>
        <h1>
          {o.status === "confirmed"
            ? "Seus NFTs agora estão na sua carteira"
            : o.status === "declined"
              ? "Pagamento recusado"
              : "Aguardando confirmação"}
        </h1>
        <p role="status">
          {o.status === "pending"
            ? "Seu pedido foi recebido. Você pode recarregar esta página com segurança."
            : o.reason || "Transação confirmada na simulação."}
        </p>
      </div>
      <div className="transaction-meta">
        <div>
          ID da transação
          <small>
            {o.transaction
              ? `${o.transaction.slice(0, 8)}…${o.transaction.slice(-4)}`
              : "Pendente"}
          </small>
        </div>
        <div>
          Data<small>{new Date(o.createdAt).toLocaleDateString("pt-BR")}</small>
        </div>
        <div>
          Total<small>{eth(o.quote.total)}</small>
        </div>
        <div>
          Carteira<small>{o.provider}</small>
        </div>
      </div>
      <div className="receipt-content">
        <h2>Detalhes da transação</h2>
        <small className="order-id">Pedido: {o.id}</small>
        <div className="receipt-lines">
          {o.quote.lines.map((l) => (
            <div key={`${l.nftId}-${l.editionId}`}>
              <img src={l.image} alt={l.name} width="70" height="70" />
              <span>
                <b>{l.name}</b>
                <small>
                  Edição {l.edition} (× {l.quantity})
                </small>
              </span>
              <strong>
                {eth(decimal(l.price).mul(l.quantity).toString())}
              </strong>
            </div>
          ))}
        </div>
        <QuoteSummary quote={o.quote} />
        {o.status === "confirmed" ? (
          <>
            <p>
              Propriedade transferida na simulação para sua carteira na rede{" "}
              {o.quote.network}. A referência abaixo é fictícia.
            </p>
            <Auxiliary>Ver transação simulada</Auxiliary>
          </>
        ) : o.status === "declined" ? (
          <Link to="/carrinho" className="button-link">
            Revisar carrinho e tentar novamente
          </Link>
        ) : (
          <Button variant="outline" onClick={() => void order.refetch()}>
            Consultar estado do pedido
          </Button>
        )}
        <Link to="/">Continuar explorando</Link>
      </div>
    </section>
  );
}
