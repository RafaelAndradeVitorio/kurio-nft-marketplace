import { test, expect } from "@playwright/test";
import { addNFT, checkout, command, login, reset } from "./helpers";
test.beforeEach(async ({ page }) => {
  await reset(page);
});
test("catálogo: busca, filtros combinados, ordenação, paginação e histórico", async ({
  page,
}, info) => {
  await expect(page.locator(".catalog-results .nft-card")).toHaveCount(9);
  await page.getByRole("button", { name: "Página 2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Página 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Página 1", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Abrir filtros" }).click();
  await page
    .getByRole("checkbox", { name: "Arte digital (4)", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "Ethereum", exact: true }).check();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Ver resultados" }).click();
  await expect(page).toHaveURL(/collections=Arte/);
  await expect(page.locator(".catalog-results .nft-card")).toHaveCount(4);
  if (info.project.name === "desktop") {
    await page
      .getByRole("combobox", { name: "Ordenar NFTs" })
      .selectOption("price-asc");
    await expect(
      page.locator(".catalog-results .nft-card").first(),
    ).toContainText("1.19 ETH");
  }
  await page
    .getByRole("textbox", { name: "Buscar NFTs", exact: true })
    .filter({ visible: true })
    .fill("Emerald");
  await expect(page.locator(".catalog-results .nft-card")).toHaveCount(1);
  await page.reload();
  await expect(
    page
      .getByRole("textbox", { name: "Buscar NFTs", exact: true })
      .filter({ visible: true }),
  ).toHaveValue("Emerald");
});
test("detalhe direto, edição indisponível, quantidade e recurso inexistente", async ({
  page,
}) => {
  await page.goto("/nft/nft-1");
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /1\/1 indisponível/ }),
  ).toBeDisabled();
  await page
    .locator(".detail-purchase")
    .getByRole("button", { name: "Aumentar quantidade" })
    .click();
  await page
    .locator(".detail-purchase")
    .getByRole("button", { name: /COMPRAR|Comprar NFT/ })
    .click();
  await expect(page.locator(".cart-items .quantity")).toContainText("2");
  await page.goto("/nft/inexistente");
  await expect(page.getByRole("alert")).toContainText("não foi encontrado");
});
test("carrinho visitante: cupom, precisão decimal, refresh e mesclagem no login", async ({
  page,
}) => {
  await addNFT(page);
  await page
    .locator(".cart-items")
    .getByRole("button", { name: "Aumentar quantidade" })
    .click();
  await page.getByLabel("Código promocional").fill("INVALID");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cupom inválido" }),
  ).toBeVisible();
  await page.getByLabel("Código promocional").fill("KURIO10");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.locator(".cart-summary .total")).toContainText("2.158 ETH");
  await page.reload();
  await expect(page.locator(".cart-summary .total")).toContainText("2.158 ETH");
  await login(page, "Nova", "/carrinho");
  await expect(page.locator(".cart-items .quantity")).toContainText("2");
  await page.getByRole("button", { name: "Remover cupom KURIO10" }).click();
  await expect(page.locator(".cart-summary .total")).toContainText("2.396 ETH");
  await page.getByRole("button", { name: "Remover Emerald Ape #042" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
});
test("cadastro, conflito, validação de senha e recuperação da sessão", async ({
  page,
}) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome de usuário", { exact: true }).fill("teste");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@kurio.demo");
  await page.getByLabel("Senha", { exact: true }).fill("Test12345!");
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill("Mismatch123!");
  await page
    .locator(".auth-panel")
    .getByRole("button", { name: "Criar conta", exact: true })
    .click();
  await expect(page.getByText("As senhas devem ser iguais.")).toBeVisible();
  await page.getByLabel("Confirmar senha", { exact: true }).fill("Test12345!");
  await page
    .locator(".auth-panel")
    .getByRole("button", { name: "Criar conta", exact: true })
    .click();
  await expect(page).not.toHaveURL(/cadastro/);
  await page.reload();
  await page.goto("/perfil");
  await expect(page.getByLabel("Nome de usuário", { exact: true })).toHaveValue(
    "teste",
  );
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.goto("/cadastro");
  await page.getByLabel("Nome de usuário", { exact: true }).fill("outro");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@kurio.demo");
  await page.getByLabel("Senha", { exact: true }).fill("Test12345!");
  await page.getByLabel("Confirmar senha", { exact: true }).fill("Test12345!");
  await page
    .locator(".auth-panel")
    .getByRole("button", { name: "Criar conta", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("já cadastrado");
});
test("favoritos otimistas: rollback, persistência e isolamento entre usuários", async ({
  page,
}) => {
  await login(page);
  await command(page, { action: "favorite-failure" });
  const card = page.locator(".catalog-results .nft-card").first();
  await card.hover();
  await card.getByRole("button", { name: "Adicionar aos favoritos" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Não foi possível atualizar" }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Adicionar aos favoritos" }),
  ).toHaveAttribute("aria-pressed", "false");
  await card.getByRole("button", { name: "Adicionar aos favoritos" }).click();
  await page.goto("/favoritos");
  await expect(page.locator("main .nft-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("main .nft-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await login(page, "Atlas", "/favoritos");
  await expect(page.locator("main .nft-card")).toHaveCount(0);
});
test("compra completa, clique repetido, recibo imutável e carrinho limpo", async ({
  page,
}) => {
  await addNFT(page);
  await login(page, "Nova", "/pagamento");
  await checkout(page);
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .dblclick();
  await expect(page).toHaveURL(/\/pedido\/order-/);
  await expect(
    page.getByRole("heading", {
      name: "Seus NFTs agora estão na sua carteira",
    }),
  ).toBeVisible();
  await expect(page.locator(".order-receipt .total")).toContainText(
    "1.206 ETH",
  );
  await command(page, { action: "price" });
  await page.reload();
  await expect(page.locator(".order-receipt .total")).toContainText(
    "1.206 ETH",
  );
  await page.goto("/carrinho");
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
});
test("pagamento recusado preserva carrinho", async ({ page }) => {
  await login(page);
  await addNFT(page);
  await command(page, { scenario: "payment-declined" });
  await checkout(page);
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pagamento recusado", exact: true }),
  ).toBeVisible();
  await page.goto("/carrinho");
  await expect(page.locator(".cart-items article")).toHaveCount(1);
});
test("timeout após criação recupera o mesmo pedido por idempotência", async ({
  page,
}) => {
  await login(page);
  await addNFT(page);
  await command(page, { scenario: "order-timeout" });
  await checkout(page);
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("A resposta demorou");
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kurio.attempt")!),
  );
  await command(page, { scenario: "standard" });
  await page.reload();
  await page
    .getByRole("button", { name: "Recuperar a mesma tentativa" })
    .click();
  await expect(page).toHaveURL(/\/pedido\/order-/);
  await expect(
    page.getByRole("heading", {
      name: "Seus NFTs agora estão na sua carteira",
    }),
  ).toBeVisible();
  const result = await page.evaluate(async ({ key, input }) => {
    const r = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session": localStorage.getItem("kurio.session")!,
        "Idempotency-Key": key,
      },
      body: JSON.stringify(input),
    });
    return r.json();
  }, before);
  expect(page.url()).toContain(result.id);
});
test("Socket.IO: preço, duplicatas, evento antigo e cotação desatualizada", async ({
  page,
}) => {
  await login(page);
  await addNFT(page);
  await checkout(page);
  await command(page, { action: "price" });
  await expect(page.locator(".toast")).toContainText(
    "Preço ou disponibilidade",
  );
  await page
    .getByRole("button", { name: "Confirmar compra", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".payment-summary .total")).toContainText(
    "1.456 ETH",
  );
  await command(page, { action: "duplicate" });
  await command(page, { action: "old" });
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
test("pedido pendente: desconexão, refresh, reconciliação e eventos terminais", async ({
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
  const url = page.url();
  await command(page, { action: "disconnect" });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Aguardando confirmação" }),
  ).toBeVisible();
  await command(page, { action: "resolve" });
  await expect(
    page.getByRole("heading", {
      name: "Seus NFTs agora estão na sua carteira",
    }),
  ).toBeVisible();
  expect(page.url()).toBe(url);
});
test("sessão expirada durante checkout preserva contexto e carrinho", async ({
  page,
}) => {
  await login(page);
  await addNFT(page);
  await page.goto("/pagamento");
  await page
    .getByRole("button", { name: "Conectar carteira", exact: true })
    .click();
  await command(page, { action: "expire" });
  await page
    .getByRole("button", { name: "Autorizar conexão simulada" })
    .click();
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByRole("button", { name: "Usar Nova", exact: true }).click();
  await page
    .locator(".auth-panel")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pagamento/);
  await expect(page.locator(".payment-summary .receipt-lines")).toContainText(
    "Emerald Ape #042",
  );
});
test("perfil, avatar, senha e carteira com validação e persistência", async ({
  page,
}) => {
  await login(page, "Nova", "/perfil");
  await page.getByLabel("Nome de exibição", { exact: true }).fill("Nova Teste");
  await page.locator("#avatar").setInputFiles("public/assets/8f387.webp");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.locator(".toast")).toContainText("Perfil salvo");
  await page.reload();
  await expect(
    page.getByLabel("Nome de exibição", { exact: true }),
  ).toHaveValue("Nova Teste");
  await expect(page.getByRole("img", { name: "Seu avatar" })).toBeVisible();
  await page.getByLabel("Senha atual", { exact: true }).fill("Errada123!");
  await page.getByLabel("Nova senha", { exact: true }).fill("Nova12345!");
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("Nova12345!");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page.locator(".field-error")).toContainText(
    "Senha atual incorreta",
  );
  await page.getByLabel("Senha atual", { exact: true }).fill("Demo12345!");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page.locator(".toast")).toContainText("Senha alterada");
  await page.goto("/carteiras");
  await page
    .getByLabel("Endereço da carteira", { exact: true })
    .fill("invalido");
  await page
    .getByRole("button", { name: "Salvar carteira principal", exact: true })
    .click();
  await expect(page.locator(".field-error")).toContainText("endereço válido");
  await page
    .getByLabel("Endereço da carteira", { exact: true })
    .fill("0x1111111111111111111111111111111111111111");
  await page
    .getByRole("button", { name: "Salvar carteira principal", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Carteira salva");
  await page.reload();
  await expect(
    page.getByLabel("Endereço da carteira", { exact: true }),
  ).toHaveValue("0x1111111111111111111111111111111111111111");
});
test("skeleton, erro de rede, recuperação, foco e ausência de overflow", async ({
  page,
}) => {
  await command(page, { scenario: "slow" });
  await page.goto("/nft/nft-2");
  await expect(
    page.getByRole("status", { name: "Carregando", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sage Nomad #009", exact: true }),
  ).toBeVisible();
  await command(page, { scenario: "offline" });
  await page.goto("/nft/nft-3");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível conectar",
  );
  await command(page, { scenario: "standard" });
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Neon Vessel #552", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Demonstração/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    ),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
