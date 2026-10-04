import { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
  ZoomIn,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import {
  Button,
  Input,
  Loading,
  ErrorView,
  NFTCard,
  Favorite,
  Quantity,
  Breadcrumb,
  Recommendations,
  Auxiliary,
  Icon,
} from "../components/shared";
import { api, errorInfo, get, queryClient } from "../lib/api";
import { useSession } from "../lib/state";
import { eth } from "../domain/money";
import type { Catalog, CatalogParams, NFT } from "../domain/types";
const categories = [
  "Arte digital",
  "Fotografia",
  "Música",
  "Arte 3D",
  "Colecionáveis",
  "Generativa",
  "Jogos",
  "Assinaturas",
  "Utilidade",
];
export function CatalogPage({ background = false }: { background?: boolean }) {
  const params = useSearch({ strict: false }) as CatalogParams;
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.q || "");
  const [drawer, setDrawer] = useState(false);
  const [min, setMin] = useState(params.min || "0.02");
  const [max, setMax] = useState(params.max || "12.30");
  const update = (next: Partial<CatalogParams>) =>
    void navigate({
      to: "/",
      search: { ...params, ...next, page: next.page || 1 },
      hash: "catalog",
    });
  useEffect(() => setSearch(params.q || ""), [params.q]);
  useEffect(() => {
    setMin(params.min || "0.02");
    setMax(params.max || "12.30");
  }, [params.min, params.max]);
  useEffect(() => {
    if (search === (params.q || "")) return;
    const t = setTimeout(() => update({ q: search || undefined }), 350);
    return () => clearTimeout(t);
  }, [search, params.q]);
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  const catalog = useQuery({
    queryKey: ["catalog", params],
    queryFn: ({ signal }) => get<Catalog>(`/nfts?${qs}`, signal),
  });
  const toggle = (key: "collections" | "networks", value: string) => {
    const values = (params[key] || "").split(",").filter(Boolean);
    update({
      [key]: values.includes(value)
        ? values.filter((v) => v !== value).join(",") || undefined
        : [...values, value].sort().join(","),
    });
  };
  const filterPanel = (
    <div className="filters">
      <h2>Coleções</h2>
      <div className="filter-list">
        {categories.map((c) => (
          <label key={c}>
            <input
              type="checkbox"
              checked={(params.collections || "").split(",").includes(c)}
              onChange={() => toggle("collections", c)}
            />
            <span>{c}</span>
            <b>({catalog.data?.counts[c] || 0})</b>
          </label>
        ))}
      </div>
      <h2>Faixa de preço</h2>
      <div className="range-bar">
        <span />
        <span />
      </div>
      <div className="price-range">
        <label>
          Mínimo em ETH
          <Input
            aria-label="Preço mínimo"
            type="number"
            step="0.01"
            min="0"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <label>
          Máximo em ETH
          <Input
            aria-label="Preço máximo"
            type="number"
            step="0.01"
            min="0"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
      </div>
      <Button
        size="sm"
        onClick={() => {
          if (Number(min) <= Number(max)) update({ min, max });
        }}
      >
        Aplicar
      </Button>
      <h2>Rede</h2>
      <div className="filter-list">
        {["Ethereum", "Polygon", "Solana"].map((n) => (
          <label key={n}>
            <input
              type="checkbox"
              checked={(params.networks || "").split(",").includes(n)}
              onChange={() => toggle("networks", n)}
            />
            <span>{n}</span>
          </label>
        ))}
      </div>
      <label className="mobile-sort">
        Ordenar por
        <select
          aria-label="Ordenar NFTs"
          value={params.sort || "recent"}
          onChange={(e) => update({ sort: e.target.value })}
        >
          <option value="recent">Listados recentemente</option>
          <option value="price-asc">Menor preço</option>
          <option value="price-desc">Maior preço</option>
        </select>
      </label>
      <button
        className="text-action"
        onClick={() => {
          setMin("0.02");
          setMax("12.30");
          void navigate({ to: "/", search: {}, hash: "catalog" });
          setDrawer(false);
        }}
      >
        Limpar filtros
      </button>
    </div>
  );
  return (
    <div className={background ? "catalog-background" : ""}>
      <div className="mobile-search" id="search">
        <div>
          <Search size={20} />
          <Input
            placeholder="Explorar coleções"
            aria-label="Buscar NFTs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetTrigger asChild>
            <Button aria-label="Abrir filtros">
              <SlidersHorizontal />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Filtros do marketplace</SheetTitle>
              <SheetDescription>
                Combine coleções, preços e redes.
              </SheetDescription>
            </SheetHeader>
            {filterPanel}
            <Button onClick={() => setDrawer(false)}>Ver resultados</Button>
          </SheetContent>
        </Sheet>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <small>Bem-vindo à Kurio</small>
          <h1>
            <span className="desktop-copy">
              SEJA DONO DO FUTURO
              <br />
              DA ARTE DIGITAL
            </span>
            <span className="mobile-copy">
              SEJA DONO DA
              <br />
              CULTURA DIGITAL
            </span>
          </h1>
          <p>
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e faça parte da cultura
            da internet.
          </p>
          <a href="#catalog" className="hero-cta">
            EXPLORAR <ArrowRight size={16} />
          </a>
        </div>
        <div className="hero-art">
          <img
            src="/assets/8f387.webp"
            alt="Ape com óculos verdes e jaqueta esmeralda"
            width="450"
            height="450"
            fetchPriority="high"
          />
          <img
            className="hero-mini"
            src="/assets/83794.webp"
            alt=""
            width="80"
            height="80"
          />
        </div>
        <div className="hero-dots" aria-hidden="true">
          ●●●
        </div>
      </section>
      <section className="catalog-layout" id="catalog">
        <aside className="catalog-sidebar">
          {filterPanel}
          <div className="featured">
            <h2>NFT EM DESTAQUE</h2>
            <p>OFERTA LIMITADA</p>
            <img
              src="/assets/83794.webp"
              alt="Sage Nomad em destaque"
              width="310"
              height="368"
              loading="lazy"
            />
          </div>
        </aside>
        <div className="catalog-results">
          <div className="toolbar">
            <div className="tabs" role="group" aria-label="Tipo de catálogo">
              {[
                ["all", "Todos os NFTs"],
                ["new", "Novos lançamentos"],
                ["trending", "Em alta"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={(params.tab || "all") === key}
                  onClick={() => update({ tab: key })}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="sort">
              Ordenar por:{" "}
              <select
                aria-label="Ordenar NFTs"
                value={params.sort || "recent"}
                onChange={(e) => update({ sort: e.target.value })}
              >
                <option value="recent">Listados recentemente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
              </select>
            </label>
          </div>
          <div className="desktop-search">
            <Search size={16} />
            <Input
              aria-label="Buscar NFTs"
              placeholder="Buscar no marketplace"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {catalog.isFetching && !catalog.isPending && (
              <small role="status">Atualizando…</small>
            )}
          </div>
          {catalog.isPending ? (
            <Loading />
          ) : catalog.isError ? (
            <ErrorView
              error={catalog.error}
              retry={() => void catalog.refetch()}
            />
          ) : catalog.data.items.length ? (
            <>
              <div className="nft-grid">
                {catalog.data.items.map((n, i) => (
                  <NFTCard nft={n} key={n.id} priority={i < 3} />
                ))}
              </div>
              <nav className="pagination" aria-label="Paginação">
                {Array.from({ length: catalog.data.pages }, (_, i) => (
                  <button
                    key={i}
                    aria-label={`Página ${i + 1}`}
                    aria-current={
                      (params.page || 1) === i + 1 ? "page" : undefined
                    }
                    onClick={() => update({ page: i + 1 })}
                  >
                    {i + 1}
                  </button>
                ))}
                {(params.page || 1) < catalog.data.pages && (
                  <button
                    aria-label="Próxima página"
                    onClick={() => update({ page: (params.page || 1) + 1 })}
                  >
                    <ArrowRight size={16} />
                  </button>
                )}
              </nav>
            </>
          ) : (
            <div className="empty">
              <h2>Nenhum NFT encontrado</h2>
              <p>Tente outra busca ou limpe os filtros.</p>
              <Button onClick={() => void navigate({ to: "/", search: {} })}>
                Limpar busca e filtros
              </Button>
            </div>
          )}
        </div>
      </section>
      <section className="promos">
        {[
          [
            "8f387.webp",
            "Lançamentos gênesis de edição limitada",
            "Colecione edições escassas diretamente dos criadores antes da revelação pública.",
          ],
          [
            "9add2.webp",
            "Arte digital selecionada e muito mais",
            "Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.",
          ],
        ].map(([img, title, description]) => (
          <div key={title}>
            <img
              src={`/assets/${img}`}
              alt=""
              width="287"
              height="250"
              loading="lazy"
            />
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
              <a href="#catalog">
                Explorar <ArrowRight size={16} />
              </a>
            </div>
          </div>
        ))}
      </section>
      <section className="journal">
        <h2>Diário da Cunhagem</h2>
        <p>
          Histórias, guias e insights para colecionadores sobre o universo da
          propriedade digital.
        </p>
        <div>
          {[
            "Como funciona a propriedade de NFTs",
            "10 artistas digitais para acompanhar",
            "Raridade, atributos e procedência",
            "Como proteger sua carteira",
          ].map((t, i) => (
            <article key={t}>
              <img
                src={`/assets/${["9add2.webp", "8f387.webp", "83794.webp", "b7cfc.webp"][i]}`}
                alt=""
                width="268"
                height="195"
                loading="lazy"
              />
              <div>
                <small>
                  {12 + i} de setembro | Leitura de {i + 2} min
                </small>
                <h3>{t}</h3>
                <p>
                  Aprenda a colecionar, negociar e verificar ativos digitais.
                </p>
                <Auxiliary>Ler mais →</Auxiliary>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
export function DetailPage({ id }: { id: string }) {
  const nft = useQuery({
    queryKey: ["nft", id],
    queryFn: ({ signal }) => get<NFT>(`/nfts/${id}`, signal),
  });
  const [edition, setEdition] = useState("fifty");
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState("details");
  const { notify } = useSession();
  const navigate = useNavigate();
  const add = useMutation({
    mutationFn: () =>
      api.post("/cart", { nftId: id, editionId: edition, quantity }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["quote"] });
      notify("NFT adicionado ao carrinho.");
      void navigate({ to: "/carrinho" });
    },
    onError: (error) => notify(errorInfo(error).message),
  });
  if (nft.isPending) return <Loading kind="detail" />;
  if (nft.isError)
    return <ErrorView error={nft.error} retry={() => void nft.refetch()} />;
  const n = nft.data;
  const stock = n.editions.find((e) => e.id === edition)?.stock || 0;
  return (
    <>
      <Breadcrumb label={n.name} />
      <div className="detail-mobile-top">
        <Link to="/" aria-label="Voltar ao marketplace">
          <ArrowLeft />
        </Link>
        <Favorite nftId={id} />
      </div>
      <section className="detail-main">
        <div className="gallery">
          <div className="thumbs">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                aria-label={`Imagem ${i + 1} de ${n.name}`}
                onClick={() =>
                  notify("A demonstração utiliza a imagem original desta obra.")
                }
              >
                <img src={n.image} alt="" width="100" height="100" />
              </button>
            ))}
          </div>
          <div className="detail-art">
            <img
              src={n.image}
              alt={n.name}
              width="450"
              height="450"
              fetchPriority="high"
            />
            <Auxiliary label="Ampliar imagem do NFT">
              <ZoomIn size={20} />
            </Auxiliary>
          </div>
        </div>
        <div className="detail-info">
          <h1>{n.name}</h1>
          <div className="detail-price">
            <b>{eth(n.price)}</b>
            <span>
              ★★★★★ <small>19 avaliações de colecionadores</small>
            </span>
          </div>
          <h2>Sobre este NFT:</h2>
          <p>{n.description}</p>
          <label>Edição:</label>
          <div className="editions">
            {n.editions.map((e) => (
              <button
                key={e.id}
                disabled={!e.stock}
                aria-pressed={edition === e.id}
                onClick={() => {
                  setEdition(e.id);
                  setQuantity(1);
                }}
              >
                {e.label}
                {!e.stock && <span className="sr-only"> indisponível</span>}
              </button>
            ))}
          </div>
          <div className="detail-purchase">
            <Quantity value={quantity} max={stock} onChange={setQuantity} />
            <strong className="mobile-copy purchase-price">
              {eth(n.price)}
            </strong>
            <Button
              disabled={add.isPending || !stock || quantity > stock}
              onClick={() => add.mutate()}
            >
              <span className="desktop-copy">COMPRAR</span>
              <span className="mobile-copy">Comprar NFT</span>
            </Button>
            <Favorite nftId={id} />
            <Button
              type="button"
              variant="outline"
              className="mobile-cart"
              aria-label="Adicionar ao carrinho"
              disabled={add.isPending || !stock}
              onClick={() => add.mutate()}
            >
              <ShoppingCart size={22} />
            </Button>
          </div>
          {!stock && <p role="status">Esta edição está esgotada.</p>}
          <p>
            ID do token: #{n.token}
            <br />
            Coleção: {n.collection}
            <br />
            Atributos: Óculos, Esmeralda, Raro
          </p>
          <div className="share">
            Compartilhar este NFT:{" "}
            <Auxiliary label="Compartilhar no Instagram">
              <Icon file="d48dd.svg" />
            </Auxiliary>
            <Auxiliary label="Compartilhar no Twitter">
              <Icon file="b4111.svg" />
            </Auxiliary>
          </div>
        </div>
      </section>
      <section className="detail-description">
        <div className="tabs">
          <button
            aria-pressed={tab === "details"}
            onClick={() => setTab("details")}
          >
            Detalhes do NFT
          </button>
          <button
            aria-pressed={tab === "reviews"}
            onClick={() => setTab("reviews")}
          >
            Avaliações de colecionadores (19)
          </button>
        </div>
        {tab === "details" ? (
          <>
            <p>
              {n.name} é uma obra digital finalizada à mão da coleção Kurio
              Editions. Cada atributo fica armazenado nos metadados do token e
              verificado na {n.network}. A obra explora identidade, movimento e
              luz em um mundo digital sem fronteiras.
            </p>
            <p>
              A propriedade inclui a arte em alta resolução, lançamentos
              exclusivos para colecionadores e um registro permanente de
              procedência.
            </p>
            <p>
              <b>Rede:</b>
              <br />
              Cunhado na {n.network} com procedência imutável e metadados
              armazenados em IPFS.
            </p>
            <p>
              <b>Contrato:</b>
              <br />
              Direitos autorais do criador: 5% nas vendas secundárias, pagos
              automaticamente pelos mercados compatíveis.
            </p>
            <small>Informações de blockchain demonstrativas.</small>
          </>
        ) : (
          <p>
            4,8 de 5 — Avaliações ilustrativas da coleção. A publicação de
            avaliações está fora do escopo.
          </p>
        )}
      </section>
      <Recommendations />
      <div className="mobile-buybar">
        <span>{eth(n.price)}</span>
        <Button disabled={add.isPending || !stock} onClick={() => add.mutate()}>
          <ShoppingCart size={18} />
          Adicionar ao carrinho
        </Button>
      </div>
    </>
  );
}
