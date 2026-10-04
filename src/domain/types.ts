export type Network = "Ethereum" | "Polygon" | "Solana";
export type Edition = { id: string; label: string; stock: number };
export type NFT = {
  id: string;
  name: string;
  token: string;
  price: string;
  oldPrice?: string;
  image: string;
  collection: string;
  category: string;
  network: Network;
  editions: Edition[];
  version: number;
  rare: boolean;
  createdAt: number;
  description: string;
};
export type CatalogParams = {
  q?: string;
  collections?: string;
  networks?: string;
  min?: string;
  max?: string;
  sort?: string;
  page?: number;
  tab?: string;
};
export type Catalog = {
  items: NFT[];
  total: number;
  pages: number;
  counts: Record<string, number>;
};
export type Profile = {
  displayName: string;
  username: string;
  email: string;
  ens: string;
  walletNickname: string;
  avatar: string;
};
export type User = Profile & { id: string };
export type Wallet = {
  id: string;
  displayName: string;
  nickname: string;
  network: Network;
  address: string;
  provider: string;
  email: string;
  profileName: string;
  referral: string;
  ens: string;
  secondary: boolean;
};
export type CartItem = { nftId: string; editionId: string; quantity: number };
export type Cart = { items: CartItem[]; coupon: string; version: number };
export type QuoteLine = CartItem & {
  name: string;
  image: string;
  price: string;
  total: string;
  stock: number;
  edition: string;
  nftVersion: number;
};
export type Quote = {
  id: string;
  lines: QuoteLine[];
  subtotal: string;
  discount: string;
  fee: string;
  total: string;
  coupon: string;
  network: Network;
  valid: boolean;
  issues: string[];
};
export type Collector = {
  displayName: string;
  username: string;
  email: string;
  profileName: string;
  address: string;
  referral: string;
  ens: string;
  note: string;
};
export type OrderInput = {
  quoteId: string;
  walletId: string;
  network: Network;
  provider: string;
  collector: Collector;
};
export type Order = {
  id: string;
  userId: string;
  status: "pending" | "confirmed" | "declined";
  version: number;
  quote: Quote;
  collector: Collector;
  wallet: Wallet;
  provider: string;
  transaction: string;
  createdAt: number;
  resolveAt: number;
  outcome: "confirmed" | "declined";
  reason?: string;
  key: string;
  inputHash: string;
};
export type ResourceEvent = {
  eventId: string;
  resourceId: string;
  version: number;
  userId?: string;
  data: NFT | Order;
};
export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};
export const scenarios = [
  "standard",
  "empty",
  "slow",
  "out-of-order",
  "offline",
  "server-error",
  "expired-session",
  "signup-conflict",
  "form-error",
  "invalid-coupon",
  "expired-coupon",
  "price-change",
  "sold-out",
  "order-timeout",
  "payment-declined",
  "pending",
] as const;
export type Scenario = (typeof scenarios)[number];
