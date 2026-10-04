import { openDB } from "idb";
import type {
  Cart,
  NFT,
  Order,
  Profile,
  Scenario,
  Wallet,
} from "../domain/types";
type Account = Profile & { id: string; salt: string; passwordHash: string };
export type Database = {
  nfts: NFT[];
  users: Account[];
  sessions: Record<string, { userId: string; expires: number }>;
  carts: Record<string, Cart>;
  favorites: Record<string, string[]>;
  wallets: Record<string, Wallet[]>;
  orders: Order[];
  scenario: Scenario;
  eventCounter: number;
};
const names = [
  "Emerald Ape #042",
  "Sage Nomad #009",
  "Neon Vessel #552",
  "Cosmic Bloom #118",
  "Violet Nomad #314",
  "Ivory Baron #088",
  "Golden Beat #207",
  "Golden Frequency #071",
  "Golden Signal #160",
];
const images = [
  "8f387.webp",
  "83794.webp",
  "9add2.webp",
  "83794.webp",
  "83794.webp",
  "9add2.webp",
  "b7cfc.webp",
  "b7cfc.webp",
  "b7cfc.webp",
];
const prices = [
  "1.19",
  "1.69",
  "1.99",
  "1.29",
  "1.39",
  "1.79",
  "0.99",
  "0.59",
  "0.39",
];
export const categories = [
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
export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 10000,
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
async function seed(): Promise<Database> {
  const users = await Promise.all(
    ["nova", "atlas"].map(async (username, i) => ({
      id: `user-${i + 1}`,
      displayName: i ? "Atlas Silva" : "Nova Andrade",
      username,
      email: `${username}@kurio.demo`,
      ens: `${username}.kurio.eth`,
      walletNickname: "Principal",
      avatar: "",
      salt: `kurio-demo-${username}`,
      passwordHash: await hashPassword("Demo12345!", `kurio-demo-${username}`),
    })),
  );
  const nfts = Array.from({ length: 36 }, (_, i): NFT => ({
    id: `nft-${i + 1}`,
    name:
      i < 9
        ? names[i]
        : `${names[i % 9].split(" #")[0]} #${String(200 + i).padStart(3, "0")}`,
    token: i < 9 ? names[i].split("#")[1] : String(200 + i),
    price: prices[i % 9],
    oldPrice: i === 2 ? "2.29" : undefined,
    image: `/assets/${images[i % 9]}`,
    collection: "Kurio Apes",
    category: categories[Math.floor(i / 4) % 9],
    network: (["Ethereum", "Polygon", "Solana"] as const)[Math.floor(i / 12)],
    editions: [
      { id: "unique", label: "1/1", stock: i === 0 ? 0 : 1 },
      { id: "ten", label: "1/10", stock: 10 },
      { id: "fifty", label: "1/50", stock: 50 },
      { id: "open", label: "ABERTA", stock: 100 },
    ],
    version: 1,
    rare: i % 3 === 2,
    createdAt: 36 - i,
    description:
      "Um colecionável digital finalizado à mão da coleção Kurio Editions, com arte desbloqueável e acesso para colecionadores.",
  }));
  const wallets = Object.fromEntries(
    users.map((u) => [
      u.id,
      [
        {
          id: `wallet-${u.id}`,
          displayName: u.displayName,
          nickname: "Principal",
          network: "Ethereum",
          address: "0xA91F00000000000000000000000000000000E82C",
          provider: "MetaMask",
          email: u.email,
          profileName: u.username,
          referral: "KURIO",
          ens: u.ens,
          secondary: false,
        },
      ],
    ]),
  ) as Database["wallets"];
  return {
    nfts,
    users,
    sessions: {},
    carts: {},
    favorites: {},
    wallets,
    orders: [],
    scenario: "standard",
    eventCounter: 0,
  };
}
const storage = openDB("kurio-demo", 1, {
  upgrade(db) {
    db.createObjectStore("state");
  },
});
let state: Database | undefined;
let queue: Promise<unknown> = Promise.resolve();
export function transaction<T>(
  fn: (db: Database) => T | Promise<T>,
): Promise<T> {
  const next = queue.then(async () => {
    if (!state)
      state =
        ((await (await storage).get("state", "database")) as
          Database | undefined) || (await seed());
    const result = await fn(state);
    await (await storage).put("state", state, "database");
    return structuredClone(result);
  });
  queue = next.catch(() => {});
  return next;
}
export async function reset(scenario: Scenario = "standard") {
  return transaction(async (db) => {
    Object.assign(db, await seed());
    db.scenario = scenario;
    return { ok: true };
  });
}
