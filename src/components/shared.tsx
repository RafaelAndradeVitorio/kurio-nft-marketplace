import { useState, useId, type ReactNode } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Heart,
  Home,
  ShoppingCart,
  UserRound,
  SlidersHorizontal,
  LogOut,
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { api, errorInfo, get, queryClient } from "../lib/api";
import { clearSession, useCart, useSession } from "../lib/state";
import { eth } from "../domain/money";
import type { NFT } from "../domain/types";
export const asset = (file: string) => `/assets/${file}`;
export function Icon({ file, ...props }: { file: string; className?: string }) {
  return <img alt="" src={asset(file)} {...props} />;
}
export function Auxiliary({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  const { notify } = useSession();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() =>
        notify(
          "Esta ação não faz parte da demonstração. Explore NFTs, favoritos e os fluxos de compra e conta.",
        )
      }
    >
      {children}
    </button>
  );
}
export function Header() {
  const { user } = useSession();
  const cart = useCart();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const market =
    path.startsWith("/nft/") || path === "/carrinho" || path === "/pagamento";
  return (
    <>
      <a className="skip" href="#main">
        Ir para o conteúdo
      </a>
      <header className="desktop-header">
        <Link to="/" className="wordmark">
          KURIO
        </Link>
        <nav aria-label="Principal">
          <Link to="/" data-page={!market ? "active" : undefined}>
            Início
          </Link>
          <Link
            to="/"
            search={{ tab: "all" }}
            data-page={market ? "active" : undefined}
          >
            Mercado
          </Link>
          <Auxiliary>Criadores</Auxiliary>
          <Auxiliary>Aprenda</Auxiliary>
        </nav>
        <div className="header-actions">
          <button
            aria-label="Buscar NFTs"
            onClick={() => void navigate({ to: "/", hash: "search" })}
          >
            <Icon file="bd8c9.svg" />
          </button>
          <Link
            to="/carrinho"
            aria-label={`Carrinho, ${cart.data?.items.reduce((s, i) => s + i.quantity, 0) || 0} NFTs`}
            className="cart-link"
          >
            <Icon file="c0c08.svg" />
            <span>
              {cart.data?.items.reduce((s, i) => s + i.quantity, 0) || 0}
            </span>
          </Link>
          <Link to={user ? "/perfil" : "/entrar"} className="signin">
            <Icon file="62554.svg" />
            {user ? user.username : "Entrar"}
          </Link>
        </div>
      </header>
    </>
  );
}
export function MobileNav() {
  const { user } = useSession();
  return (
    <nav className="mobile-nav" aria-label="Navegação mobile">
      <Link to="/" aria-label="Início">
        <Home />
      </Link>
      <Link to="/favoritos" aria-label="Favoritos">
        <Heart />
      </Link>
      <Auxiliary>
        <span className="mint" aria-label="Explorar coleções">
          <SlidersHorizontal />
        </span>
      </Auxiliary>
      <Link to="/carrinho" aria-label="Carrinho">
        <ShoppingCart />
      </Link>
      <Link to={user ? "/perfil" : "/entrar"} aria-label="Meu perfil">
        <UserRound />
      </Link>
    </nav>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-features">
        {[
          [
            "W",
            "Segurança da carteira",
            "Proteja sua carteira e colecione arte digital verificada com confiança.",
          ],
          [
            "C",
            "Criadores em destaque",
            "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.",
          ],
          [
            "D",
            "Alertas de lançamentos",
            "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.",
          ],
        ].map(([letter, title, text]) => (
          <div key={letter}>
            <span className="medallion">{letter}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
        <div>
          <h3>Antecipe-se ao próximo lançamento</h3>
          <div className="newsletter">
            <Input
              aria-label="E-mail para novidades"
              placeholder="digite seu e-mail..."
            />
            <Auxiliary>Enviar</Auxiliary>
          </div>
          <p>
            Receba lançamentos selecionados, histórias de criadores e novidades
            do mercado.
          </p>
        </div>
      </div>
      <div className="brand-band">
        <b>KURIO</b>
        <span>
          Feito para colecionadores,
          <br />
          criadores e cultura
        </span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>
      <div className="footer-links">
        <div>
          <h3>Meu perfil</h3>
          <Link to="/perfil">Meu perfil</Link>
          <Link to="/favoritos">Lista de interesse</Link>
          <Link to="/carteiras">Carteiras</Link>
          <Auxiliary>Atividade</Auxiliary>
          <Auxiliary>Estúdio do criador</Auxiliary>
        </div>
        <div>
          <h3>Central de ajuda</h3>
          {[
            "Central de ajuda",
            "Como comprar NFTs",
            "Carteira e segurança",
            "Política do mercado",
            "Denunciar item",
          ].map((t) => (
            <Auxiliary key={t}>{t}</Auxiliary>
          ))}
        </div>
        <div>
          <h3>Coleções</h3>
          {["Arte digital", "Fotografia", "Música", "Arte 3D", "Utilidade"].map(
            (t) => (
              <Link key={t} to="/" search={{ collections: t }}>
                {t}
              </Link>
            ),
          )}
        </div>
        <div>
          <h3>Redes sociais</h3>
          <div className="social-icons">
            {[
              "99280.svg",
              "d48dd.svg",
              "b4111.svg",
              "b8b84.svg",
              "ca2da.svg",
            ].map((f, i) => (
              <Auxiliary
                key={f}
                label={
                  ["Facebook", "Instagram", "Twitter", "LinkedIn", "YouTube"][i]
                }
              >
                <Icon file={f} />
              </Auxiliary>
            ))}
          </div>
          <h3>Carteiras compatíveis</h3>
          <small className="wallet-chip">
            METAMASK · WALLETCONNECT · COINBASE
          </small>
        </div>
      </div>
      <p className="copyright">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  );
}
export function Breadcrumb({ label }: { label: string }) {
  return (
    <nav className="breadcrumb" aria-label="Caminho">
      <Link to="/">Início</Link> / <Link to="/">Mercado</Link> / {label}
    </nav>
  );
}
export function MobileTitle({ title }: { title: string }) {
  return (
    <div className="mobile-title">
      <Link to="/" aria-label="Voltar ao início">
        <ArrowLeft size={20} />
      </Link>
      <h1>{title}</h1>
    </div>
  );
}
export function Loading({
  kind = "cards",
}: {
  kind?: "cards" | "detail" | "summary";
}) {
  return (
    <div role="status" aria-label="Carregando" className={`loading-${kind}`}>
      {Array.from({ length: kind === "cards" ? 6 : 3 }, (_, i) => (
        <Skeleton key={i} className="shimmer" />
      ))}
      <span className="sr-only">Carregando conteúdo</span>
    </div>
  );
}
export function ErrorView({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error-box">
      <p>{errorInfo(error).message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Tentar novamente
        </Button>
      )}
      <Link to="/">Voltar ao marketplace</Link>
    </div>
  );
}
export function Quantity({
  value,
  max,
  onChange,
  disabled = false,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="quantity">
      <button
        aria-label="Diminuir quantidade"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={12} />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        aria-label="Aumentar quantidade"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
export function Favorite({ nftId }: { nftId: string }) {
  const { user, notify } = useSession();
  const navigate = useNavigate();
  const key = ["favorites", user?.id];
  const favorites = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => get<string[]>("/favorites", signal),
    enabled: !!user,
  });
  const active = favorites.data?.includes(nftId) || false;
  const mutation = useMutation({
    mutationFn: ({ remove }: { remove: boolean }) =>
      api
        .request<string[]>({
          url: "/favorites",
          method: remove ? "DELETE" : "POST",
          data: { nftId },
        })
        .then((r) => r.data),
    onMutate: async ({ remove }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<string[]>(key) || [];
      queryClient.setQueryData(
        key,
        remove
          ? (prev || []).filter((i) => i !== nftId)
          : [...(prev || []), nftId],
      );
      return prev;
    },
    onError: (error, _, prev) => {
      queryClient.setQueryData(key, prev);
      notify(errorInfo(error).message);
    },
    onSuccess: (data, { remove }) => {
      queryClient.setQueryData(key, data);
      notify(remove ? "Favorito removido." : "NFT salvo nos favoritos.");
    },
  });
  return (
    <button
      className={`favorite ${active ? "active" : ""}`}
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={active}
      disabled={mutation.isPending}
      onClick={() => {
        if (!user)
          void navigate({
            to: "/entrar",
            search: {
              redirect: window.location.pathname + window.location.search,
            },
          });
        else mutation.mutate({ remove: active });
      }}
    >
      <Heart size={19} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
export function NFTCard({
  nft,
  priority = false,
}: {
  nft: NFT;
  priority?: boolean;
}) {
  return (
    <article className="nft-card">
      <div className="art-slot">
        <Link
          to="/nft/$id"
          params={{ id: nft.id }}
          aria-label={`Ver ${nft.name}`}
        >
          <img
            src={nft.image}
            alt={nft.name}
            width="300"
            height="300"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
          />
        </Link>
        <Favorite nftId={nft.id} />
        {nft.rare && <span className="rare">RARO</span>}
      </div>
      <Link to="/nft/$id" params={{ id: nft.id }}>
        {nft.name}
      </Link>
      <div className="price">
        {eth(nft.price)} {nft.oldPrice && <del>{eth(nft.oldPrice)}</del>}
      </div>
    </article>
  );
}
export function Recommendations() {
  const { data } = useQuery({
    queryKey: ["catalog", "recommendations"],
    queryFn: ({ signal }) => get<{ items: NFT[] }>("/nfts", signal),
  });
  return (
    <section className="recommendations">
      <h2>Mais desta coleção</h2>
      <div>
        {data?.items.slice(3, 8).map((n) => (
          <NFTCard key={n.id} nft={n} />
        ))}
      </div>
    </section>
  );
}
export type FieldSpec = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};
export function Fields({
  spec,
  values,
  setValues,
  errors = {},
}: {
  spec: FieldSpec[];
  values: Record<string, string>;
  setValues: (values: Record<string, string>) => void;
  errors?: Record<string, string>;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const prefix = useId();
  return (
    <>
      {spec.map((f) => (
        <div className="field" key={f.name}>
          <label
            htmlFor={`${prefix}-${f.name}`}
            data-required={f.required || undefined}
          >
            {f.label}
          </label>
          {f.options ? (
            <select
              id={`${prefix}-${f.name}`}
              name={f.name}
              value={values[f.name] || ""}
              required={f.required}
              aria-invalid={!!errors[f.name]}
              aria-describedby={
                errors[f.name] ? `${prefix}-${f.name}-error` : undefined
              }
              onChange={(e) =>
                setValues({ ...values, [f.name]: e.target.value })
              }
            >
              <option value="">Selecione</option>
              {f.options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <div className="input-wrapper">
              <Input
                id={`${prefix}-${f.name}`}
                name={f.name}
                value={values[f.name] || ""}
                type={
                  f.type === "password" && visible[f.name]
                    ? "text"
                    : f.type || "text"
                }
                placeholder={f.placeholder}
                required={f.required}
                minLength={
                  f.type === "password" && f.name !== "currentPassword"
                    ? 8
                    : undefined
                }
                autoComplete={
                  f.type === "password"
                    ? f.name === "currentPassword"
                      ? "current-password"
                      : "new-password"
                    : f.type === "email"
                      ? "email"
                      : f.name === "username"
                        ? "username"
                        : "off"
                }
                aria-invalid={!!errors[f.name]}
                aria-describedby={
                  errors[f.name] ? `${prefix}-${f.name}-error` : undefined
                }
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.value })
                }
              />
              {f.type === "password" && (
                <button
                  type="button"
                  aria-label={
                    visible[f.name] ? "Ocultar senha" : "Mostrar senha"
                  }
                  onClick={() =>
                    setVisible({ ...visible, [f.name]: !visible[f.name] })
                  }
                >
                  {visible[f.name] ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              )}
            </div>
          )}
          {errors[f.name] && (
            <p id={`${prefix}-${f.name}-error`} className="field-error">
              {errors[f.name]}
            </p>
          )}
        </div>
      ))}
    </>
  );
}
export function AccountNav() {
  const navigate = useNavigate();
  return (
    <aside className="account-nav">
      <h2>Meu perfil</h2>
      <Link to="/perfil">
        <UserRound />
        Dados do perfil
      </Link>
      <Link to="/carteiras">
        <Icon file="8a4e9.svg" />
        Carteiras
      </Link>
      <Auxiliary>Atividade</Auxiliary>
      <Link to="/favoritos">
        <Heart />
        Lista de interesse
      </Link>
      {["Ofertas", "Arquivos baixados", "Suporte"].map((t) => (
        <Auxiliary key={t}>{t}</Auxiliary>
      ))}
      <button
        onClick={() => void clearSession().then(() => navigate({ to: "/" }))}
      >
        <LogOut />
        Sair
      </button>
    </aside>
  );
}
export { Button, Input, Trash2 };
