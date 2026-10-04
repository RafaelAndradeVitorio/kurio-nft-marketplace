import { test, expect } from "@playwright/test";
import { addNFT, login, readyVisual, reset } from "./helpers";
test("visual: início, detalhe, carrinho e pagamento", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-03T15:00:00Z") });
  await reset(page);
  await expect(page.locator(".catalog-results .nft-card")).toHaveCount(9);
  await readyVisual(page);
  await expect(page).toHaveScreenshot("inicio.png", {
    fullPage: true,
    animations: "disabled",
    maskColor: "#140d0a",
    mask: [page.locator(".demo-trigger")],
  });
  await page.goto("/nft/nft-1");
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await readyVisual(page);
  await expect(page).toHaveScreenshot("detalhe.png", {
    fullPage: true,
    animations: "disabled",
    maskColor: "#140d0a",
    mask: [page.locator(".demo-trigger")],
  });
  await addNFT(page);
  await readyVisual(page);
  await expect(page).toHaveScreenshot("carrinho.png", {
    fullPage: true,
    animations: "disabled",
    maskColor: "#140d0a",
    mask: [page.locator(".demo-trigger"), page.locator(".toast")],
  });
  await login(page, "Nova", "/pagamento");
  await expect(page.locator(".payment-summary")).toBeVisible();
  await readyVisual(page);
  await expect(page).toHaveScreenshot("pagamento.png", {
    fullPage: true,
    animations: "disabled",
    maskColor: "#140d0a",
    mask: [page.locator(".demo-trigger"), page.locator(".toast")],
  });
});
