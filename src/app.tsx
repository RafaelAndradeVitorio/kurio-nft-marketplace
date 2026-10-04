import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
  redirect,
  useNavigate,
  useLocation,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { queryClient, api } from "./lib/api";
import { SessionProvider, sessionOptions } from "./lib/state";
import { Header, Footer, MobileNav, ErrorView } from "./components/shared";
import { DemoPanel } from "./components/demo";
import { CatalogPage, DetailPage } from "./features/catalog";
const CartPage = lazyRouteComponent(
  () => import("./features/purchase"),
  "CartPage",
);
const CheckoutPage = lazyRouteComponent(
  () => import("./features/purchase"),
  "CheckoutPage",
);
const OrderPage = lazyRouteComponent(
  () => import("./features/purchase"),
  "OrderPage",
);
const AuthPage = lazyRouteComponent(
  () => import("./features/account"),
  "AuthPage",
);
const ProfilePage = lazyRouteComponent(
  () => import("./features/account"),
  "ProfilePage",
);
const WalletsPage = lazyRouteComponent(
  () => import("./features/account"),
  "WalletsPage",
);
const FavoritesPage = lazyRouteComponent(
  () => import("./features/account"),
  "FavoritesPage",
);
import type { CatalogParams, User } from "./domain/types";
function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const account = ["/perfil", "/carteiras", "/favoritos"].includes(path);
  const auth = path === "/entrar" || path === "/cadastro";
  const order = path.startsWith("/pedido/");
  useEffect(() => {
    const expired = () => {
      void queryClient.cancelQueries();
      queryClient.removeQueries({
        predicate: (q) =>
          !["catalog", "nft", "demo"].includes(String(q.queryKey[0])),
      });
      localStorage.removeItem("kurio.session");
      queryClient.setQueryData(["session"], { user: null });
      if (!auth)
        void navigate({
          to: "/entrar",
          search: {
            redirect: window.location.pathname + window.location.search,
          },
        });
    };
    window.addEventListener("kurio:expired", expired);
    return () => window.removeEventListener("kurio:expired", expired);
  }, [navigate, auth]);
  useEffect(() => {
    document.title = path.startsWith("/nft/")
      ? "Detalhes do NFT — Kurio"
      : path === "/carrinho"
        ? "Carrinho — Kurio"
        : path === "/pagamento"
          ? "Pagamento — Kurio"
          : order
            ? "Pedido — Kurio"
            : "Kurio — Arte digital para colecionadores";
    if (!location.hash) window.scrollTo(0, 0);
  }, [path, location.hash, order]);
  return (
    <SessionProvider>
      <div
        className={`app-shell ${auth ? "auth-shell" : ""} ${account ? "account-shell" : ""} ${order ? "order-shell" : ""}`}
      >
        <Header />
        <main id="main">
          <Outlet />
        </main>
        {!account && !auth && !order && <Footer />}
        {!auth && !order && (path === "/" || account) && <MobileNav />}
        <DemoPanel />
      </div>
    </SessionProvider>
  );
}
const root = createRootRoute({
  component: Layout,
  notFoundComponent: () => (
    <ErrorView error={new Error("Página não encontrada.")} />
  ),
  errorComponent: ({ error }) => (
    <ErrorView error={error} retry={() => window.location.reload()} />
  ),
});
function catalogSearch(s: Record<string, unknown>): CatalogParams {
  const decimal = (v: unknown) =>
    typeof v === "string" && /^\d+(\.\d{1,18})?$/.test(v) ? v : undefined;
  return {
    q: typeof s.q === "string" ? s.q.slice(0, 100) : undefined,
    collections: typeof s.collections === "string" ? s.collections : undefined,
    networks: typeof s.networks === "string" ? s.networks : undefined,
    min: decimal(s.min),
    max: decimal(s.max),
    sort: ["recent", "price-asc", "price-desc"].includes(String(s.sort))
      ? String(s.sort)
      : "recent",
    page: Math.max(1, Math.min(100, Math.floor(Number(s.page) || 1))),
    tab: ["all", "new", "trending"].includes(String(s.tab))
      ? String(s.tab)
      : "all",
  };
}
const home = createRoute({
  getParentRoute: () => root,
  path: "/",
  validateSearch: catalogSearch,
  component: () => <CatalogPage />,
});
const detail = createRoute({
  getParentRoute: () => root,
  path: "/nft/$id",
  component: () => <DetailPage id={detail.useParams().id} />,
});
const cart = createRoute({
  getParentRoute: () => root,
  path: "/carrinho",
  component: CartPage,
});
const authSearch = (s: Record<string, unknown>) => ({
  redirect:
    typeof s.redirect === "string" &&
    s.redirect.startsWith("/") &&
    !s.redirect.startsWith("//")
      ? s.redirect
      : undefined,
});
const login = createRoute({
  getParentRoute: () => root,
  path: "/entrar",
  validateSearch: authSearch,
  component: () => <AuthPage />,
});
const register = createRoute({
  getParentRoute: () => root,
  path: "/cadastro",
  validateSearch: authSearch,
  component: () => <AuthPage signup />,
});
const protect = async ({ location }: { location: { href: string } }) => {
  const { data } = await api.get<{ user: User | null }>("/session");
  queryClient.setQueryData(sessionOptions.queryKey, data);
  if (!data.user)
    throw redirect({ to: "/entrar", search: { redirect: location.href } });
};
const checkout = createRoute({
  getParentRoute: () => root,
  path: "/pagamento",
  beforeLoad: protect,
  component: CheckoutPage,
});
const order = createRoute({
  getParentRoute: () => root,
  path: "/pedido/$id",
  beforeLoad: protect,
  component: () => <OrderPage id={order.useParams().id} />,
});
const profile = createRoute({
  getParentRoute: () => root,
  path: "/perfil",
  beforeLoad: protect,
  component: ProfilePage,
});
const wallets = createRoute({
  getParentRoute: () => root,
  path: "/carteiras",
  beforeLoad: protect,
  component: WalletsPage,
});
const favorites = createRoute({
  getParentRoute: () => root,
  path: "/favoritos",
  beforeLoad: protect,
  component: FavoritesPage,
});
const router = createRouter({
  routeTree: root.addChildren([
    home,
    detail,
    cart,
    login,
    register,
    checkout,
    order,
    profile,
    wallets,
    favorites,
  ]),
  defaultPreload: "intent",
  defaultPendingMs: 0,
  defaultPendingComponent: () => (
    <div role="status" className="route-loading">
      Carregando página…
    </div>
  ),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
export function mount() {
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
