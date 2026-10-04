import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Input } from "./shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { api, errorInfo, get, queryClient } from "../lib/api";
import { useSession } from "../lib/state";
import type { Scenario } from "../domain/types";
export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [nftId, setNftId] = useState("nft-1");
  const { notify, connected } = useSession();
  const config = useQuery({
    queryKey: ["demo"],
    queryFn: () => get<{ scenario: Scenario; scenarios: Scenario[] }>("/demo"),
    enabled: open,
  });
  const action = useMutation({
    mutationFn: ({
      reset = false,
      ...data
    }: {
      reset?: boolean;
      scenario?: string;
      action?: string;
      nftId?: string;
    }) => api.post(reset ? "/demo/reset" : "/demo", data),
    onSuccess: (_, variables) => {
      if (variables.reset) {
        localStorage.removeItem("kurio.session");
        localStorage.removeItem("kurio.attempt");
        window.location.assign("/");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["demo"] });
      notify("Cenário de demonstração atualizado.");
    },
    onError: (error) => notify(errorInfo(error).message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="demo-trigger">
          Demonstração{" "}
          <span
            aria-label={
              connected ? "Eventos conectados" : "Eventos desconectados"
            }
          >
            ●
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="demo-dialog">
        <DialogHeader>
          <DialogTitle>Cenários da demonstração</DialogTitle>
          <DialogDescription>
            Os comandos abaixo alteram a API simulada. Eventos percorrem o
            cliente Socket.IO.
          </DialogDescription>
        </DialogHeader>
        <label htmlFor="scenario">Cenário REST</label>
        <select
          id="scenario"
          value={config.data?.scenario || "standard"}
          onChange={(e) => action.mutate({ scenario: e.target.value })}
        >
          {config.data?.scenarios.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label htmlFor="demo-nft">ID do NFT</label>
        <Input
          id="demo-nft"
          value={nftId}
          onChange={(e) => setNftId(e.target.value)}
        />
        <div className="demo-actions">
          {[
            ["price", "Alterar preço"],
            ["stock", "Esgotar edições"],
            ["duplicate", "Evento duplicado"],
            ["old", "Evento antigo"],
            ["order-old", "Pedido: evento antigo"],
            ["order-duplicate", "Pedido: evento duplicado"],
            ["disconnect", "Interromper conexão"],
            ["resolve", "Resolver pedido pendente"],
            ["expire", "Expirar sessão"],
            ["favorite-failure", "Falhar próximo favorito"],
          ].map(([command, label]) => (
            <Button
              key={command}
              variant="outline"
              disabled={action.isPending}
              onClick={() => action.mutate({ action: command, nftId })}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button
          onClick={() => action.mutate({ reset: true, scenario: "standard" })}
        >
          Resetar todos os dados
        </Button>
        <p>
          Contas: nova@kurio.demo e atlas@kurio.demo
          <br />
          Senha: Demo12345! · Cupom: KURIO10
        </p>
      </DialogContent>
    </Dialog>
  );
}
