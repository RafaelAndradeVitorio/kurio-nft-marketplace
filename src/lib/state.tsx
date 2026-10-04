import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { api, get, queryClient } from "./api";
import type { Cart, NFT, Order, ResourceEvent, User } from "../domain/types";
const SessionContext = createContext<{
  user: User | null;
  owner: string;
  notify: (text: string) => void;
  message: string;
  connected: boolean;
}>({
  user: null,
  owner: "guest",
  notify: () => {},
  message: "",
  connected: false,
});
export const useSession = () => useContext(SessionContext);
export const sessionOptions = {
  queryKey: ["session"],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    get<{ user: User | null }>("/session", signal),
  staleTime: 10000,
};
export function SessionProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery(sessionOptions);
  const user = data?.user || null;
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (data && data.user === null && localStorage.getItem("kurio.session"))
      queueMicrotask(() => window.dispatchEvent(new Event("kurio:expired")));
  }, [data]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    let active = true;
    let close = () => {};
    void import("socket.io-client").then(({ io }) => {
      if (!active) return;
      const socket = io("https://kurio.mock", {
        path: "/socket.io/",
        transports: ["websocket"],
        reconnectionDelay: 300,
        reconnectionDelayMax: 1000,
        autoConnect: false,
      });
      const versions = new Map<string, number>();
      const seen = new Set<string>();
      let connectedOnce = false;
      const reconcile = () => {
        if (!active) return;
        setConnected(true);
        socket.emit("subscribe", localStorage.getItem("kurio.session") || "");
        if (connectedOnce)
          void queryClient.invalidateQueries({
            predicate: (q) =>
              q.isActive() &&
              q.queryKey[0] !== "session" &&
              q.queryKey[0] !== "demo",
          });
        connectedOnce = true;
      };
      const update = (kind: "nft" | "order", event: ResourceEvent) => {
        if (
          !active ||
          (event.userId && event.userId !== user?.id) ||
          seen.has(event.eventId)
        )
          return;
        const key = `${kind}:${event.resourceId}`;
        const cached =
          kind === "nft"
            ? queryClient.getQueryData<NFT>(["nft", event.resourceId])
            : queryClient.getQueryData<Order>([
                "order",
                user?.id,
                event.resourceId,
              ]);
        if (
          kind === "order" &&
          cached &&
          (cached as Order).status !== "pending"
        )
          return;
        if (
          event.version <=
          Math.max(versions.get(key) || 0, cached?.version || 0)
        )
          return;
        seen.add(event.eventId);
        versions.set(key, event.version);
        if (kind === "nft") {
          queryClient.setQueryData(["nft", event.resourceId], event.data);
          for (const name of ["catalog", "cart", "quote"])
            void queryClient.invalidateQueries({ queryKey: [name] });
          setMessage(
            "Preço ou disponibilidade de um NFT foi atualizado. Revise seu carrinho.",
          );
        } else {
          queryClient.setQueryData(
            ["order", user?.id, event.resourceId],
            event.data,
          );
          void queryClient.invalidateQueries({ queryKey: ["cart"] });
          void queryClient.invalidateQueries({ queryKey: ["quote"] });
          setMessage(
            (event.data as Order).status === "confirmed"
              ? "Compra confirmada. Seus NFTs estão na sua carteira."
              : (event.data as Order).status === "declined"
                ? "Pagamento recusado. Seus itens foram preservados."
                : "Pedido recebido. Aguardando confirmação.",
          );
        }
      };
      socket.on("connect", reconcile);
      socket.on("connect_error", (error) =>
        console.warn("Socket.IO mock:", error.message),
      );
      socket.on("disconnect", () => active && setConnected(false));
      socket.on("nft.updated", (e: ResourceEvent) => update("nft", e));
      socket.on("order.updated", (e: ResourceEvent) => update("order", e));
      socket.connect();
      close = () => {
        socket.removeAllListeners();
        socket.disconnect();
      };
    });
    return () => {
      active = false;
      close();
    };
  }, [user?.id]);
  return (
    <SessionContext.Provider
      value={{
        user,
        owner: user?.id || "guest",
        notify: setMessage,
        message,
        connected,
      }}
    >
      {children}
      <div
        className={message ? "toast" : "sr-only"}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </SessionContext.Provider>
  );
}
export function useCart() {
  const { owner } = useSession();
  return useQuery({
    queryKey: ["cart", owner],
    queryFn: ({ signal }) => get<Cart>("/cart", signal),
  });
}
export async function clearSession() {
  const previous = queryClient.getQueryData<{ user: User | null }>([
    "session",
  ])?.user;
  await api.post("/logout");
  await queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: (q) =>
      !["catalog", "nft", "demo"].includes(String(q.queryKey[0])),
  });
  localStorage.removeItem("kurio.session");
  localStorage.removeItem("kurio.attempt");
  if (previous) localStorage.removeItem(`kurio.checkout.${previous.id}`);
  queryClient.setQueryData(["session"], { user: null });
}
