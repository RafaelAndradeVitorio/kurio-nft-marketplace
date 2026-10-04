import { test, expect } from "@playwright/test";
import { addNFT, checkout, command, login, reset } from "./helpers";
test.beforeEach(async ({ page }) => reset(page));
test("cupom digitado permanece durante recotação lenta do carrinho", async ({
  page,
}) => {
  await addNFT(page);
  await command(page, { scenario: "slow" });
  await page
    .locator(".cart-items")
    .getByRole("button", { name: "Aumentar quantidade" })
    .click();
  await page.getByLabel("Código promocional").fill("INVALID");
  await expect(page.locator(".cart-items .quantity")).toContainText("2");
  await expect(page.getByLabel("Código promocional")).toHaveValue("INVALID");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.locator("#coupon-error")).toContainText("Cupom inválido");
  await command(page, { scenario: "standard" });
});
test("resultado vazio, HTTP 503 e recuperação", async ({ page }) => {
  await command(page, { scenario: "empty" });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Nenhum NFT encontrado" }),
  ).toBeVisible();
  await command(page, { scenario: "server-error" });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "temporariamente indisponível",
  );
  await command(page, { scenario: "standard" });
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator(".catalog-results .nft-card")).toHaveCount(9);
});
test("respostas fora de ordem não substituem o resultado da busca atual", async ({
  page,
}) => {
  await command(page, { scenario: "out-of-order" });
  const search = page
    .getByRole("textbox", { name: "Buscar NFTs", exact: true })
    .filter({ visible: true });
  await search.fill("S");
  await page.waitForRequest(
    (r) =>
      r.url().includes("/api/nfts?") &&
      new URL(r.url()).searchParams.get("q") === "S",
  );
  await search.fill("Emerald");
  await expect(page.locator(".catalog-results .nft-card")).toHaveCount(4);
  await expect(
    page.locator(".catalog-results .nft-card").first(),
  ).toContainText("Emerald");
  await page.waitForTimeout(1300);
  await expect(page.locator(".catalog-results .nft-card")).toHaveCount(4);
  await expect(search).toHaveValue("Emerald");
});
test("cupom expirado depois da aplicação bloqueia a compra", async ({
  page,
}) => {
  await login(page);
  await addNFT(page);
  await page.getByLabel("Código promocional").fill("KURIO10");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.locator(".cart-summary .total")).toContainText("1.087 ETH");
  await command(page, { scenario: "expired-coupon" });
  await page.goto("/pagamento");
  await expect(page.locator(".field-error")).toContainText(
    "cupom não é mais válido",
  );
  await expect(
    page.getByRole("button", { name: "Revisar compra" }),
  ).toBeDisabled();
  await page.goto("/carrinho");
  await page.getByRole("button", { name: "Remover cupom KURIO10" }).click();
  await expect(page.locator(".cart-summary .total")).toContainText("1.206 ETH");
});
test("edição esgotada por evento Socket.IO impede confirmação", async ({
  page,
}) => {
  await login(page);
  await addNFT(page);
  await page.goto("/pagamento");
  await expect(
    page.getByRole("button", { name: "Revisar compra" }),
  ).toBeVisible();
  await expect(page.locator(".demo-trigger span")).toHaveAttribute(
    "aria-label",
    "Eventos conectados",
  );
  await command(page, { action: "stock" });
  await expect(page.locator(".field-error")).toContainText("indisponível");
  await expect(
    page.getByRole("button", { name: "Revisar compra" }),
  ).toBeDisabled();
  await page.goto("/carrinho");
  await page.getByRole("button", { name: "Remover Emerald Ape #042" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
});
test("mudança de preço na revalidação do servidor exige nova revisão", async ({
  page,
}) => {
  await login(page);
  await addNFT(page);
  await checkout(page);
  await command(page, { scenario: "price-change" });
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".payment-summary .total")).toContainText(
    "1.456 ETH",
  );
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Seus NFTs agora estão na sua carteira",
    }),
  ).toBeVisible();
});
test("conexão recusada, carteira secundária e validação do formulário pela API", async ({
  page,
}) => {
  await login(page, "Nova", "/carteiras");
  await page
    .getByRole("button", { name: "Adicionar carteira secundária" })
    .click();
  const form = page.locator(".wallet-form").nth(1);
  await form
    .getByLabel("Endereço da carteira", { exact: true })
    .fill("0x2222222222222222222222222222222222222222");
  await form
    .getByRole("button", { name: "Salvar carteira secundária" })
    .click();
  await expect(page.locator(".toast")).toContainText("Carteira salva");
  await page.reload();
  await expect(page.locator(".wallet-form")).toHaveCount(2);
  await command(page, { scenario: "form-error" });
  await page
    .locator(".wallet-form")
    .first()
    .getByRole("button", { name: "Salvar carteira principal" })
    .click();
  await expect(page.locator(".field-error")).toContainText("e-mail não pode");
  await command(page, { scenario: "standard" });
  await addNFT(page);
  await page.goto("/pagamento");
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await page.getByRole("button", { name: "Recusar conexão" }).click();
  await expect(page.locator(".connection-status")).toContainText(
    "desconectada",
  );
  await checkout(page);
  await page.getByRole("button", { name: "Continuar revisando" }).click();
});
test("pedido terminal não regride e só remove quantidades compradas", async ({
  page,
}) => {
  await login(page);
  await addNFT(page);
  await command(page, { scenario: "pending" });
  await checkout(page);
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Aguardando confirmação" }),
  ).toBeVisible();
  const receipt = page.url();
  const attempt = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kurio.attempt")!),
  );
  const conflict = await page.evaluate(async (a) => {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session": localStorage.getItem("kurio.session")!,
        "Idempotency-Key": a.key,
      },
      body: JSON.stringify({ ...a.input, provider: "MetaMask" }),
    });
    return response.status;
  }, attempt);
  expect(conflict).toBe(409);
  await addNFT(page);
  await expect(page.locator(".cart-items .quantity")).toContainText("2");
  await command(page, { action: "resolve" });
  await page.goto(receipt);
  await expect(
    page.getByRole("heading", {
      name: "Seus NFTs agora estão na sua carteira",
    }),
  ).toBeVisible();
  await command(page, { action: "order-old" });
  await command(page, { action: "order-duplicate" });
  await expect(
    page.getByRole("heading", {
      name: "Seus NFTs agora estão na sua carteira",
    }),
  ).toBeVisible();
  await page.goto("/carrinho");
  await expect(page.locator(".cart-items .quantity")).toContainText("1");
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await login(page, "Atlas");
  await page.goto(receipt);
  await expect(page.getByRole("alert")).toContainText("outro colecionador");
});
test("tablet e zoom preservam conteúdo e operação por teclado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator(".catalog-results .nft-card")).toHaveCount(9);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir para o conteúdo" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  // A browser zoom of 200% halves its CSS layout viewport, including media queries.
  await page.setViewportSize({ width: 384, height: 512 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/entrar/);
});
