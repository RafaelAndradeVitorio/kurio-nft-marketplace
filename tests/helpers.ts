import { expect, type Page } from "@playwright/test";
export async function command(
  page: Page,
  data: Record<string, unknown>,
  path = "/demo",
) {
  return page.evaluate(
    async ({ path, data }) => {
      const r = await fetch(`/api${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session": localStorage.getItem("kurio.session") || "",
          "x-guest": localStorage.getItem("kurio.guest") || "",
        },
        body: JSON.stringify(data),
      });
      return { status: r.status, data: await r.json() };
    },
    { path, data },
  );
}
export async function reset(page: Page, scenario = "standard") {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Demonstração/ }),
  ).toBeVisible();
  await command(page, { scenario }, "/demo/reset");
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
}
export async function login(page: Page, account = "Nova", redirect = "/") {
  await page.goto(`/entrar?redirect=${encodeURIComponent(redirect)}`);
  await page
    .getByRole("button", { name: `Usar ${account}`, exact: true })
    .click();
  await page
    .locator(".auth-panel")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(page).not.toHaveURL(/\/entrar/);
}
export async function addNFT(page: Page, id = "nft-1") {
  await page.goto(`/nft/${id}`);
  await page
    .locator(".detail-purchase")
    .getByRole("button", { name: /COMPRAR|Comprar NFT/ })
    .click();
  await expect(page).toHaveURL(/\/carrinho/);
  await expect(page.locator(".cart-items article")).toHaveCount(1);
}
export async function checkout(page: Page) {
  await page.goto("/pagamento");
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Autorizar conexão simulada" })
    .click();
  await expect(page.locator(".connection-status")).toContainText(
    "Carteira conectada",
  );
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
export async function readyVisual(page: Page) {
  await expect(page.locator(".route-loading")).toHaveCount(0);
  await expect(page.locator('[aria-label="Carregando"]')).toHaveCount(0);
  await page.evaluate(async () => {
    document
      .querySelectorAll<HTMLImageElement>("img")
      .forEach((i) => (i.loading = "eager"));
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((i) => i.decode().catch(() => {})),
    );
  });
  await page.locator("body").click({ position: { x: 1, y: 1 } });
}
