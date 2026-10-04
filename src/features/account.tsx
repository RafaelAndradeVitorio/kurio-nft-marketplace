import { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Fields,
  AccountNav,
  Loading,
  ErrorView,
  NFTCard,
  Auxiliary,
  type FieldSpec,
} from "../components/shared";
import { api, errorInfo, get, queryClient } from "../lib/api";
import { useSession } from "../lib/state";
import { CatalogPage } from "./catalog";
import type { NFT, User, Wallet } from "../domain/types";
export function AuthPage({ signup = false }: { signup?: boolean }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const { notify } = useSession();
  const [values, setValues] = useState<Record<string, string>>({
    email: "",
    password: "",
    username: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ user: User; token: string; adjusted: boolean }>(
        signup ? "/register" : "/login",
        values,
      ),
    onSuccess: async ({ data }) => {
      await queryClient.cancelQueries();
      queryClient.removeQueries({
        predicate: (q) =>
          !["catalog", "nft", "demo"].includes(String(q.queryKey[0])),
      });
      localStorage.setItem("kurio.session", data.token);
      queryClient.setQueryData(["session"], { user: data.user });
      notify(
        data.adjusted
          ? "Conta conectada. Ajustamos quantidades à disponibilidade."
          : signup
            ? "Perfil criado. Bem-vindo à Kurio!"
            : "Bem-vindo de volta!",
      );
      const target =
        search.redirect?.startsWith("/") && !search.redirect.startsWith("//")
          ? search.redirect
          : "/";
      await navigate({ href: target });
    },
    onError: (error) => {
      const info = errorInfo(error);
      setFailure(info.message);
      setErrors(info.fields || {});
    },
  });
  const spec: FieldSpec[] = [
    ...(signup
      ? [{ name: "username", label: "Nome de usuário", required: true }]
      : []),
    {
      name: "email",
      label: "E-mail",
      type: "email",
      required: true,
      placeholder: "contato@email.com",
    },
    { name: "password", label: "Senha", type: "password", required: true },
    ...(signup
      ? [
          {
            name: "confirm",
            label: "Confirmar senha",
            type: "password",
            required: true,
          },
        ]
      : []),
  ];
  return (
    <>
      <div className="auth-background" aria-hidden="true" inert>
        <CatalogPage background />
      </div>
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link
          to="/"
          className="auth-close"
          aria-label="Fechar e voltar ao marketplace"
        >
          ×
        </Link>
        <div className="auth-logo">KURIO</div>
        <div className="auth-tabs">
          <Link
            to="/entrar"
            search={{ redirect: search.redirect }}
            data-active={!signup}
          >
            Entrar
          </Link>
          <span>|</span>
          <Link
            to="/cadastro"
            search={{ redirect: search.redirect }}
            data-active={signup}
          >
            Criar conta
          </Link>
        </div>
        <h1 id="auth-title">
          {signup
            ? "Crie seu perfil de colecionador"
            : "Entre para gerenciar sua carteira, coleção e perfil"}
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            setFailure("");
            if (signup && values.password !== values.confirm) {
              setErrors({ confirm: "As senhas devem ser iguais." });
              return;
            }
            mutation.mutate();
          }}
        >
          <Fields
            spec={spec}
            values={values}
            setValues={setValues}
            errors={errors}
          />
          {!signup && (
            <div className="forgot">
              <Auxiliary>Esqueceu a senha?</Auxiliary>
            </div>
          )}
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          <Button disabled={mutation.isPending}>
            {mutation.isPending
              ? "Aguarde…"
              : signup
                ? "Criar conta"
                : "Entrar"}
          </Button>
        </form>
        <div className="social-auth">
          <small>Ou continue com</small>
          <Auxiliary>
            <b className="google">G</b> Continuar com Google
          </Auxiliary>
          <Auxiliary>
            <b className="facebook">f</b> Continuar com Facebook
          </Auxiliary>
        </div>
        <div className="demo-credentials">
          <span>Conta de demonstração</span>
          <button
            onClick={() =>
              setValues({
                ...values,
                email: "nova@kurio.demo",
                password: "Demo12345!",
              })
            }
          >
            Usar Nova
          </button>
          <button
            onClick={() =>
              setValues({
                ...values,
                email: "atlas@kurio.demo",
                password: "Demo12345!",
              })
            }
          >
            Usar Atlas
          </button>
        </div>
        <div className="auth-mobile-link">
          <Link
            to={signup ? "/entrar" : "/cadastro"}
            search={{ redirect: search.redirect }}
          >
            {signup
              ? "Já tem uma conta? Entre"
              : "Novo na Kurio? Crie uma conta"}
          </Link>
        </div>
      </section>
    </>
  );
}
const profileSpec: FieldSpec[] = [
  { name: "displayName", label: "Nome de exibição", required: true },
  { name: "username", label: "Nome de usuário", required: true },
  { name: "email", label: "E-mail", type: "email", required: true },
  { name: "ens", label: "Nome ENS", required: true },
  { name: "walletNickname", label: "Apelido da carteira", required: true },
];
export function ProfilePage() {
  const { user, notify } = useSession();
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: ({ signal }) => get<User>("/profile", signal),
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [passwords, setPasswords] = useState<Record<string, string>>({
    currentPassword: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  );
  useEffect(() => {
    if (profile.data) {
      const { id: _id, ...rest } = profile.data;
      setValues(rest);
    }
  }, [profile.data]);
  const save = useMutation({
    mutationFn: () => api.patch<User>("/profile", values),
    onSuccess: (r) => {
      queryClient.setQueryData(["profile", user?.id], r.data);
      queryClient.setQueryData(["session"], { user: r.data });
      notify("Perfil salvo.");
    },
    onError: (error) => {
      const info = errorInfo(error);
      setErrors(info.fields || {});
      notify(info.message);
    },
  });
  const password = useMutation({
    mutationFn: () => api.post("/password", passwords),
    onSuccess: () => {
      setPasswords({ currentPassword: "", password: "", confirm: "" });
      notify("Senha alterada.");
    },
    onError: (error) => {
      const info = errorInfo(error);
      setPasswordErrors(info.fields || {});
      notify(info.message);
    },
  });
  if (profile.isPending) return <Loading kind="summary" />;
  if (profile.isError)
    return (
      <ErrorView error={profile.error} retry={() => void profile.refetch()} />
    );
  return (
    <div className="account-layout">
      <AccountNav />
      <section>
        <h1>Perfil do colecionador</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            save.mutate();
          }}
        >
          <div className="form-grid">
            <Fields
              spec={profileSpec}
              values={values}
              setValues={setValues}
              errors={errors}
            />
            <div className="avatar-field">
              <label htmlFor="avatar">Avatar</label>
              <div>
                {values.avatar ? (
                  <img
                    src={values.avatar}
                    alt="Seu avatar"
                    width="48"
                    height="48"
                  />
                ) : (
                  <span className="avatar-placeholder">◎</span>
                )}
                <label htmlFor="avatar" className="button-link">
                  Alterar
                </label>
                <input
                  className="sr-only"
                  id="avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (
                      file.size > 2 * 1024 * 1024 ||
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        file.type,
                      )
                    ) {
                      notify("Escolha PNG, JPEG ou WebP de até 2 MB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      setValues({ ...values, avatar: String(reader.result) });
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setValues({ ...values, avatar: "" })}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
          <Button disabled={save.isPending}>Salvar perfil</Button>
        </form>
        <form
          className="password-form"
          onSubmit={(e) => {
            e.preventDefault();
            setPasswordErrors({});
            if (passwords.password !== passwords.confirm) {
              setPasswordErrors({ confirm: "As senhas devem ser iguais." });
              return;
            }
            password.mutate();
          }}
        >
          <h2>Alterar senha</h2>
          <Fields
            spec={[
              {
                name: "currentPassword",
                label: "Senha atual",
                type: "password",
                required: true,
              },
              {
                name: "password",
                label: "Nova senha",
                type: "password",
                required: true,
              },
              {
                name: "confirm",
                label: "Confirmar nova senha",
                type: "password",
                required: true,
              },
            ]}
            values={passwords}
            setValues={setPasswords}
            errors={passwordErrors}
          />
          <Button disabled={password.isPending}>Salvar senha</Button>
        </form>
      </section>
    </div>
  );
}
const walletSpec: FieldSpec[] = [
  { name: "displayName", label: "Nome de exibição", required: true },
  { name: "nickname", label: "Apelido da carteira", required: true },
  {
    name: "network",
    label: "Rede",
    required: true,
    options: ["Ethereum", "Polygon", "Solana"],
  },
  { name: "profileName", label: "Nome do perfil", required: true },
  {
    name: "address",
    label: "Endereço da carteira",
    placeholder: "Endereço 0x da carteira",
    required: true,
  },
  {
    name: "provider",
    label: "Tipo de carteira",
    required: true,
    options: ["MetaMask", "WalletConnect", "Coinbase Wallet"],
  },
  { name: "referral", label: "Código de indicação", required: true },
  { name: "email", label: "E-mail", type: "email", required: true },
  { name: "ens", label: "Nome ENS", required: true },
];
function WalletForm({
  wallet,
  secondary = false,
}: {
  wallet?: Wallet;
  secondary?: boolean;
}) {
  const { user, notify } = useSession();
  const [values, setValues] = useState<Record<string, string>>({
    displayName: wallet?.displayName || user?.displayName || "",
    nickname: wallet?.nickname || (secondary ? "Reserva" : "Principal"),
    network: wallet?.network || "Ethereum",
    profileName: wallet?.profileName || user?.username || "",
    address: wallet?.address || "",
    provider: wallet?.provider || "MetaMask",
    referral: wallet?.referral || "KURIO",
    email: wallet?.email || user?.email || "",
    ens: wallet?.ens || user?.ens || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      api.request({
        url: wallet ? `/wallets/${wallet.id}` : "/wallets",
        method: wallet ? "PATCH" : "POST",
        data: values,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      notify("Carteira salva.");
    },
    onError: (error) => {
      const info = errorInfo(error);
      setErrors(info.fields || {});
      notify(info.message);
    },
  });
  return (
    <form
      className="wallet-form"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        save.mutate();
      }}
    >
      <h2>Carteira {secondary ? "secundária" : "principal"}</h2>
      <p>
        Estas carteiras ficam disponíveis no pagamento e para receber NFTs
        comprados.
      </p>
      <div className="form-grid">
        <Fields
          spec={walletSpec}
          values={values}
          setValues={setValues}
          errors={errors}
        />
      </div>
      <Button disabled={save.isPending}>
        Salvar carteira {secondary ? "secundária" : "principal"}
      </Button>
    </form>
  );
}
export function WalletsPage() {
  const { user } = useSession();
  const [addSecondary, setAddSecondary] = useState(false);
  const wallets = useQuery({
    queryKey: ["wallets", user?.id],
    queryFn: ({ signal }) => get<Wallet[]>("/wallets", signal),
  });
  if (wallets.isPending) return <Loading kind="summary" />;
  if (wallets.isError)
    return (
      <ErrorView error={wallets.error} retry={() => void wallets.refetch()} />
    );
  return (
    <div className="account-layout">
      <AccountNav />
      <section>
        <h1 className="sr-only">Carteiras</h1>
        <WalletForm
          key={wallets.data[0]?.id || "new"}
          wallet={wallets.data[0]}
        />
        {wallets.data[1] || addSecondary ? (
          <WalletForm
            key={wallets.data[1]?.id || "secondary"}
            wallet={wallets.data[1]}
            secondary
          />
        ) : (
          <div className="secondary-empty">
            <h2>Carteira secundária</h2>
            <p>Você ainda não adicionou uma carteira secundária.</p>
            <Button variant="outline" onClick={() => setAddSecondary(true)}>
              Adicionar carteira secundária
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
export function FavoritesPage() {
  const { user } = useSession();
  const favorites = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: ({ signal }) => get<string[]>("/favorites", signal),
  });
  const all = useQuery({
    queryKey: ["catalog", "favorites-all"],
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        [1, 2, 3, 4].map((p) =>
          get<{ items: NFT[] }>(`/nfts?page=${p}`, signal),
        ),
      );
      return pages.flatMap((p) => p.items);
    },
  });
  return (
    <div className="account-layout">
      <AccountNav />
      <section>
        <h1>Lista de interesse</h1>
        {favorites.isPending || all.isPending ? (
          <Loading />
        ) : favorites.isError || all.isError ? (
          <ErrorView
            error={favorites.error || all.error}
            retry={() => {
              void favorites.refetch();
              void all.refetch();
            }}
          />
        ) : favorites.data.length ? (
          <div className="nft-grid">
            {all.data
              .filter((n) => favorites.data.includes(n.id))
              .map((n) => (
                <NFTCard key={n.id} nft={n} />
              ))}
          </div>
        ) : (
          <div className="empty">
            <h2>Sua coleção começa com uma descoberta</h2>
            <p>Salve as obras que chamaram sua atenção.</p>
            <Link to="/">Explorar NFTs</Link>
          </div>
        )}
      </section>
    </div>
  );
}
