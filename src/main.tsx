import "@fontsource/roboto-mono/latin-400.css";
import "@fontsource/roboto-mono/latin-500.css";
import "@fontsource/roboto-mono/latin-700.css";
import "./styles.css";
async function start() {
  const app = import("./app");
  if (import.meta.env.VITE_ENABLE_MOCKS !== "false") {
    const { worker } = await import("./mocks/browser");
    await worker.start({ quiet: true, onUnhandledRequest: "bypass" });
  }
  const { mount } = await app;
  mount();
}
void start().catch((error) => {
  console.error(error);
  document.getElementById("root")!.textContent =
    "Não foi possível iniciar a aplicação. Recarregue a página.";
});
