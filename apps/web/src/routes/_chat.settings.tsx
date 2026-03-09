import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { type ProviderKind } from "@t3tools/contracts";
import { getModelOptions, normalizeModelSlug } from "@t3tools/shared/model";

import {
  buildOpenCodeServerConfigInput,
  MAX_CUSTOM_MODEL_LENGTH,
  useAppSettings,
} from "../appSettings";
import { isElectron } from "../env";
import { useTheme } from "../hooks/useTheme";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { ensureNativeApi } from "../nativeApi";
import {
  opencodeMcpServersQueryOptions,
  opencodeProviderAuthMethodsQueryOptions,
  opencodeProvidersQueryOptions,
  opencodeStatusQueryOptions,
} from "../opencode/reactQuery";
import { preferredTerminalEditor } from "../terminal-links";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { SidebarInset } from "~/components/ui/sidebar";

const THEME_OPTIONS = [
  {
    value: "system",
    label: "System",
    description: "Match your OS appearance setting.",
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme.",
  },
] as const;

const MODEL_PROVIDER_SETTINGS: Array<{
  provider: ProviderKind;
  title: string;
  description: string;
  placeholder: string;
  example: string;
}> = [
  {
    provider: "codex",
    title: "Codex",
    description: "Save additional Codex model slugs for the picker and `/model` command.",
    placeholder: "your-codex-model-slug",
    example: "gpt-6.7-codex-ultra-preview",
  },
] as const;

function getCustomModelsForProvider(
  settings: ReturnType<typeof useAppSettings>["settings"],
  provider: ProviderKind,
) {
  switch (provider) {
    case "codex":
    default:
      return settings.customCodexModels;
  }
}

function getDefaultCustomModelsForProvider(
  defaults: ReturnType<typeof useAppSettings>["defaults"],
  provider: ProviderKind,
) {
  switch (provider) {
    case "codex":
    default:
      return defaults.customCodexModels;
  }
}

function patchCustomModels(provider: ProviderKind, models: string[]) {
  switch (provider) {
    case "codex":
    default:
      return { customCodexModels: models };
  }
}

function SettingsRouteView() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { settings, defaults, updateSettings } = useAppSettings();
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const [isOpeningKeybindings, setIsOpeningKeybindings] = useState(false);
  const [isEnsuringOpenCodeServer, setIsEnsuringOpenCodeServer] = useState(false);
  const [openKeybindingsError, setOpenKeybindingsError] = useState<string | null>(null);
  const [openCodeServerError, setOpenCodeServerError] = useState<string | null>(null);
  const [customModelInputByProvider, setCustomModelInputByProvider] = useState<
    Record<ProviderKind, string>
  >({
    codex: "",
  });
  const [customModelErrorByProvider, setCustomModelErrorByProvider] = useState<
    Partial<Record<ProviderKind, string | null>>
  >({});
  const [providerApiKeyById, setProviderApiKeyById] = useState<Record<string, string>>({});
  const [providerOauthCodeById, setProviderOauthCodeById] = useState<Record<string, string>>({});
  const [providerAuthErrorById, setProviderAuthErrorById] = useState<Record<string, string | null>>({});
  const [providerAuthPendingId, setProviderAuthPendingId] = useState<string | null>(null);
  const [providerPendingOauthMethodById, setProviderPendingOauthMethodById] = useState<Record<string, number>>(
    {},
  );
  const [mcpAuthCodeByName, setMcpAuthCodeByName] = useState<Record<string, string>>({});
  const [mcpAuthStartUrlByName, setMcpAuthStartUrlByName] = useState<Record<string, string>>({});
  const [mcpAuthErrorByName, setMcpAuthErrorByName] = useState<Record<string, string | null>>({});
  const [mcpPendingName, setMcpPendingName] = useState<string | null>(null);

  const codexBinaryPath = settings.codexBinaryPath;
  const codexHomePath = settings.codexHomePath;
  const openCodeConfig = buildOpenCodeServerConfigInput(settings);
  const keybindingsConfigPath = serverConfigQuery.data?.keybindingsConfigPath ?? null;
  const openCodeStatusQuery = useQuery(opencodeStatusQueryOptions(openCodeConfig));
  const openCodeProvidersQuery = useQuery({
    ...opencodeProvidersQueryOptions(openCodeConfig),
    enabled: openCodeStatusQuery.data?.healthy === true,
  });
  const openCodeProviderAuthMethodsQuery = useQuery({
    ...opencodeProviderAuthMethodsQueryOptions(openCodeConfig),
    enabled: openCodeStatusQuery.data?.healthy === true,
  });
  const openCodeMcpServersQuery = useQuery({
    ...opencodeMcpServersQueryOptions(openCodeConfig),
    enabled: openCodeStatusQuery.data?.healthy === true,
  });

  const openKeybindingsFile = useCallback(() => {
    if (!keybindingsConfigPath) return;
    setOpenKeybindingsError(null);
    setIsOpeningKeybindings(true);
    const api = ensureNativeApi();
    void api.shell
      .openInEditor(keybindingsConfigPath, preferredTerminalEditor())
      .catch((error) => {
        setOpenKeybindingsError(
          error instanceof Error ? error.message : "Unable to open keybindings file.",
        );
      })
      .finally(() => {
        setIsOpeningKeybindings(false);
      });
  }, [keybindingsConfigPath]);

  const ensureOpenCodeServer = useCallback(() => {
    setIsEnsuringOpenCodeServer(true);
    setOpenCodeServerError(null);
    void ensureNativeApi()
      .opencode.ensureServer(openCodeConfig)
      .then(() => openCodeStatusQuery.refetch())
      .catch((error) => {
        setOpenCodeServerError(
          error instanceof Error ? error.message : "Unable to start the OpenCode server.",
        );
      })
      .finally(() => {
        setIsEnsuringOpenCodeServer(false);
      });
  }, [openCodeConfig, openCodeStatusQuery]);

  const refreshOpenCodeProviderQueries = useCallback(() => {
    void openCodeProvidersQuery.refetch();
    void openCodeProviderAuthMethodsQuery.refetch();
  }, [openCodeProviderAuthMethodsQuery, openCodeProvidersQuery]);

  const refreshOpenCodeMcpQuery = useCallback(() => {
    void openCodeMcpServersQuery.refetch();
  }, [openCodeMcpServersQuery]);

  const connectOpenCodeProvider = useCallback(
    async (providerId: string) => {
      const methods = openCodeProviderAuthMethodsQuery.data?.[providerId] ?? [];
      if (methods.length === 0) {
        return;
      }

      const api = ensureNativeApi();
      let methodIndex = 0;
      if (methods.length > 1) {
        const selected = await api.contextMenu.show(
          methods.map((method, index) => ({ id: String(index), label: method.label })),
        );
        if (!selected) {
          return;
        }
        methodIndex = Number(selected);
      }

      const method = methods[methodIndex];
      if (!method) {
        return;
      }

      setProviderAuthErrorById((existing) => ({ ...existing, [providerId]: null }));
      setProviderAuthPendingId(providerId);

      if (method.type === "api") {
        const apiKey = providerApiKeyById[providerId]?.trim();
        if (!apiKey) {
          setProviderAuthErrorById((existing) => ({
            ...existing,
            [providerId]: "Enter an API key first.",
          }));
          setProviderAuthPendingId(null);
          return;
        }
        await api.opencode
          .setProviderApiKey({
            ...openCodeConfig,
            providerId,
            apiKey,
          })
          .then(() => {
            setProviderApiKeyById((existing) => ({ ...existing, [providerId]: "" }));
            refreshOpenCodeProviderQueries();
          })
          .catch((error: unknown) => {
            setProviderAuthErrorById((existing) => ({
              ...existing,
              [providerId]: error instanceof Error ? error.message : "Failed to save API key.",
            }));
          })
          .finally(() => {
            setProviderAuthPendingId(null);
          });
        return;
      }

      await api.opencode
        .authorizeProvider({
          ...openCodeConfig,
          providerId,
          method: methodIndex,
        })
        .then(async (authorization) => {
          if (!authorization) {
            return;
          }
          await api.shell.openExternal(authorization.url);
          if (authorization.method === "auto") {
            const confirmed = await api.dialogs.confirm(
              `${authorization.instructions}\n\nClick OK after you finish authorization in the browser.`,
            );
            if (!confirmed) {
              return;
            }
            await api.opencode.completeProviderAuth({
              ...openCodeConfig,
              providerId,
              method: methodIndex,
            });
            refreshOpenCodeProviderQueries();
            return;
          }
          setProviderPendingOauthMethodById((existing) => ({ ...existing, [providerId]: methodIndex }));
          setProviderAuthErrorById((existing) => ({
            ...existing,
            [providerId]: authorization.instructions,
          }));
        })
        .catch((error: unknown) => {
          setProviderAuthErrorById((existing) => ({
            ...existing,
            [providerId]: error instanceof Error ? error.message : "Failed to authorize provider.",
          }));
        })
        .finally(() => {
          setProviderAuthPendingId(null);
        });
    },
    [
      openCodeConfig,
      openCodeProviderAuthMethodsQuery.data,
      providerApiKeyById,
      refreshOpenCodeProviderQueries,
    ],
  );

  const completeOpenCodeProviderOauth = useCallback(
    async (providerId: string) => {
      const method = providerPendingOauthMethodById[providerId];
      if (typeof method !== "number") {
        return;
      }
      setProviderAuthPendingId(providerId);
      setProviderAuthErrorById((existing) => ({ ...existing, [providerId]: null }));
      await ensureNativeApi()
        .opencode.completeProviderAuth({
          ...openCodeConfig,
          providerId,
          method,
          code: providerOauthCodeById[providerId]?.trim() || undefined,
        })
        .then(() => {
          setProviderPendingOauthMethodById((existing) => {
            const next = { ...existing };
            delete next[providerId];
            return next;
          });
          setProviderOauthCodeById((existing) => ({ ...existing, [providerId]: "" }));
          refreshOpenCodeProviderQueries();
        })
        .catch((error: unknown) => {
          setProviderAuthErrorById((existing) => ({
            ...existing,
            [providerId]: error instanceof Error ? error.message : "Failed to complete provider auth.",
          }));
        })
        .finally(() => {
          setProviderAuthPendingId(null);
        });
    },
    [openCodeConfig, providerOauthCodeById, providerPendingOauthMethodById, refreshOpenCodeProviderQueries],
  );

  const disconnectOpenCodeProvider = useCallback(
    async (providerId: string) => {
      setProviderAuthPendingId(providerId);
      setProviderAuthErrorById((existing) => ({ ...existing, [providerId]: null }));
      await ensureNativeApi()
        .opencode.removeProviderAuth({
          ...openCodeConfig,
          providerId,
        })
        .then(() => {
          refreshOpenCodeProviderQueries();
        })
        .catch((error: unknown) => {
          setProviderAuthErrorById((existing) => ({
            ...existing,
            [providerId]: error instanceof Error ? error.message : "Failed to disconnect provider.",
          }));
        })
        .finally(() => {
          setProviderAuthPendingId(null);
        });
    },
    [openCodeConfig, refreshOpenCodeProviderQueries],
  );

  const startOpenCodeMcpAuth = useCallback(
    async (serverName: string) => {
      setMcpPendingName(serverName);
      setMcpAuthErrorByName((existing) => ({ ...existing, [serverName]: null }));
      await ensureNativeApi()
        .opencode.startMcpAuth({
          ...openCodeConfig,
          serverName,
        })
        .then(async (result) => {
          setMcpAuthStartUrlByName((existing) => ({ ...existing, [serverName]: result.authorizationUrl }));
          await ensureNativeApi().shell.openExternal(result.authorizationUrl);
        })
        .catch((error: unknown) => {
          setMcpAuthErrorByName((existing) => ({
            ...existing,
            [serverName]: error instanceof Error ? error.message : "Failed to start MCP auth.",
          }));
        })
        .finally(() => {
          setMcpPendingName(null);
        });
    },
    [openCodeConfig],
  );

  const completeOpenCodeMcpAuth = useCallback(
    async (serverName: string) => {
      const code = mcpAuthCodeByName[serverName]?.trim();
      if (!code) {
        setMcpAuthErrorByName((existing) => ({
          ...existing,
          [serverName]: "Enter the authorization code first.",
        }));
        return;
      }
      setMcpPendingName(serverName);
      setMcpAuthErrorByName((existing) => ({ ...existing, [serverName]: null }));
      await ensureNativeApi()
        .opencode.completeMcpAuth({
          ...openCodeConfig,
          serverName,
          code,
        })
        .then(() => {
          setMcpAuthCodeByName((existing) => ({ ...existing, [serverName]: "" }));
          refreshOpenCodeMcpQuery();
        })
        .catch((error: unknown) => {
          setMcpAuthErrorByName((existing) => ({
            ...existing,
            [serverName]: error instanceof Error ? error.message : "Failed to complete MCP auth.",
          }));
        })
        .finally(() => {
          setMcpPendingName(null);
        });
    },
    [mcpAuthCodeByName, openCodeConfig, refreshOpenCodeMcpQuery],
  );

  const authenticateOpenCodeMcp = useCallback(
    async (serverName: string) => {
      setMcpPendingName(serverName);
      setMcpAuthErrorByName((existing) => ({ ...existing, [serverName]: null }));
      await ensureNativeApi()
        .opencode.authenticateMcp({
          ...openCodeConfig,
          serverName,
        })
        .then(() => {
          refreshOpenCodeMcpQuery();
        })
        .catch((error: unknown) => {
          setMcpAuthErrorByName((existing) => ({
            ...existing,
            [serverName]: error instanceof Error ? error.message : "Failed to authenticate MCP server.",
          }));
        })
        .finally(() => {
          setMcpPendingName(null);
        });
    },
    [openCodeConfig, refreshOpenCodeMcpQuery],
  );

  const removeOpenCodeMcpAuth = useCallback(
    async (serverName: string) => {
      setMcpPendingName(serverName);
      setMcpAuthErrorByName((existing) => ({ ...existing, [serverName]: null }));
      await ensureNativeApi()
        .opencode.removeMcpAuth({
          ...openCodeConfig,
          serverName,
        })
        .then(() => {
          refreshOpenCodeMcpQuery();
        })
        .catch((error: unknown) => {
          setMcpAuthErrorByName((existing) => ({
            ...existing,
            [serverName]: error instanceof Error ? error.message : "Failed to remove MCP auth.",
          }));
        })
        .finally(() => {
          setMcpPendingName(null);
        });
    },
    [openCodeConfig, refreshOpenCodeMcpQuery],
  );

  const toggleOpenCodeMcpConnection = useCallback(
    async (serverName: string, connected: boolean) => {
      setMcpPendingName(serverName);
      setMcpAuthErrorByName((existing) => ({ ...existing, [serverName]: null }));
      await ensureNativeApi()
        .opencode[connected ? "disconnectMcp" : "connectMcp"]({
          ...openCodeConfig,
          serverName,
        })
        .then(() => {
          refreshOpenCodeMcpQuery();
        })
        .catch((error: unknown) => {
          setMcpAuthErrorByName((existing) => ({
            ...existing,
            [serverName]: error instanceof Error ? error.message : "Failed to update MCP connection.",
          }));
        })
        .finally(() => {
          setMcpPendingName(null);
        });
    },
    [openCodeConfig, refreshOpenCodeMcpQuery],
  );

  const addCustomModel = useCallback((provider: ProviderKind) => {
    const customModelInput = customModelInputByProvider[provider];
    const customModels = getCustomModelsForProvider(settings, provider);
    const normalized = normalizeModelSlug(customModelInput, provider);
    if (!normalized) {
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: "Enter a model slug.",
      }));
      return;
    }
    if (getModelOptions(provider).some((option) => option.slug === normalized)) {
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: "That model is already built in.",
      }));
      return;
    }
    if (normalized.length > MAX_CUSTOM_MODEL_LENGTH) {
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: `Model slugs must be ${MAX_CUSTOM_MODEL_LENGTH} characters or less.`,
      }));
      return;
    }
    if (customModels.includes(normalized)) {
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: "That custom model is already saved.",
      }));
      return;
    }

    updateSettings(patchCustomModels(provider, [...customModels, normalized]));
    setCustomModelInputByProvider((existing) => ({
      ...existing,
      [provider]: "",
    }));
    setCustomModelErrorByProvider((existing) => ({
      ...existing,
      [provider]: null,
    }));
  }, [customModelInputByProvider, settings, updateSettings]);

  const removeCustomModel = useCallback(
    (provider: ProviderKind, slug: string) => {
      const customModels = getCustomModelsForProvider(settings, provider);
      updateSettings(patchCustomModels(provider, customModels.filter((model) => model !== slug)));
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));
    },
    [settings, updateSettings],
  );

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              Settings
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure app-level preferences for this device.
              </p>
            </header>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Appearance</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose how T3 Code handles light and dark mode.
                </p>
              </div>

              <div className="space-y-2" role="radiogroup" aria-label="Theme preference">
                {THEME_OPTIONS.map((option) => {
                  const selected = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`flex w-full items-start justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-primary/60 bg-primary/8 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                      onClick={() => setTheme(option.value)}
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className="text-xs">{option.description}</span>
                      </span>
                      {selected ? (
                        <span className="rounded bg-primary/14 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                          Selected
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Active theme: <span className="font-medium text-foreground">{resolvedTheme}</span>
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">OpenCode connection</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This fork is OpenCode-first. Configure the server T3 Code uses for canonical
                  sessions, history, and continuation.
                </p>
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-background/50 p-4">
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">Connection status</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {openCodeStatusQuery.isPending
                          ? "Checking OpenCode server..."
                          : openCodeStatusQuery.data?.state === "ready" && openCodeStatusQuery.data.healthy
                            ? "Connected"
                            : openCodeStatusQuery.data?.state === "starting"
                              ? "Starting"
                              : "Unavailable"}
                      </p>
                    </div>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {openCodeStatusQuery.data?.healthy ? "healthy" : openCodeStatusQuery.isPending ? "checking" : "error"}
                    </span>
                  </div>
                  {openCodeStatusQuery.data?.message ? (
                    <p className="mt-2 text-xs text-muted-foreground">{openCodeStatusQuery.data.message}</p>
                  ) : null}
                  {openCodeServerError ? (
                    <p className="mt-2 text-xs text-destructive">{openCodeServerError}</p>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={ensureOpenCodeServer}
                      disabled={isEnsuringOpenCodeServer}
                    >
                      {isEnsuringOpenCodeServer ? "Starting..." : "Start now"}
                    </Button>
                  </div>
                </div>

                <label htmlFor="opencode-server-url" className="block space-y-1">
                  <span className="text-xs font-medium text-foreground">OpenCode server URL</span>
                  <Input
                    id="opencode-server-url"
                    value={settings.opencodeServerUrl}
                    onChange={(event) => updateSettings({ opencodeServerUrl: event.target.value })}
                    placeholder="http://127.0.0.1:4096"
                    spellCheck={false}
                  />
                  <span className="text-xs text-muted-foreground">
                    Used for project/session discovery, session continuation, and native T3Code UI over
                    OpenCode sessions.
                  </span>
                </label>

                <label htmlFor="opencode-password" className="block space-y-1">
                  <span className="text-xs font-medium text-foreground">OpenCode password</span>
                  <Input
                    id="opencode-password"
                    type="password"
                    value={settings.opencodePassword}
                    onChange={(event) => updateSettings({ opencodePassword: event.target.value })}
                    placeholder="Optional"
                    spellCheck={false}
                  />
                </label>

                <label htmlFor="opencode-workspace" className="block space-y-1">
                  <span className="text-xs font-medium text-foreground">OpenCode workspace ID</span>
                  <Input
                    id="opencode-workspace"
                    value={settings.opencodeWorkspaceId}
                    onChange={(event) => updateSettings({ opencodeWorkspaceId: event.target.value })}
                    placeholder="Optional"
                    spellCheck={false}
                  />
                  <span className="text-xs text-muted-foreground">
                    Use this when you want T3 Code to operate on a specific canonical OpenCode workspace.
                  </span>
                </label>

                <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-start local OpenCode</p>
                    <p className="text-xs text-muted-foreground">
                      If the loopback server is down, T3 Code tries to launch `opencode serve`.
                    </p>
                  </div>
                  <Switch
                    checked={settings.opencodeAutoStart}
                    onCheckedChange={(checked) =>
                      updateSettings({ opencodeAutoStart: Boolean(checked) })
                    }
                    aria-label="Auto-start local OpenCode"
                  />
                </div>

                <div className="rounded-lg border border-border bg-background px-3 py-3">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-foreground">Providers</p>
                    <p className="text-xs text-muted-foreground">
                      Connect or disconnect canonical OpenCode providers without leaving T3 Code.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {(openCodeProvidersQuery.data?.all ?? []).map((provider) => {
                      const isConnected = openCodeProvidersQuery.data?.connected.includes(provider.id) === true;
                      const methods = openCodeProviderAuthMethodsQuery.data?.[provider.id] ?? [];
                      const pendingOauthMethod = providerPendingOauthMethodById[provider.id];
                      const authError = providerAuthErrorById[provider.id];
                      return (
                        <div key={provider.id} className="rounded-lg border border-border/70 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{provider.name}</p>
                              <p className="text-xs text-muted-foreground">{provider.id}</p>
                            </div>
                            {isConnected ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={providerAuthPendingId === provider.id}
                                onClick={() => {
                                  void disconnectOpenCodeProvider(provider.id);
                                }}
                              >
                                Disconnect
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={providerAuthPendingId === provider.id || methods.length === 0}
                                onClick={() => {
                                  void connectOpenCodeProvider(provider.id);
                                }}
                              >
                                Connect
                              </Button>
                            )}
                          </div>
                          {!isConnected && methods.some((method) => method.type === "api") ? (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <Input
                                type="password"
                                value={providerApiKeyById[provider.id] ?? ""}
                                onChange={(event) =>
                                  setProviderApiKeyById((existing) => ({
                                    ...existing,
                                    [provider.id]: event.target.value,
                                  }))
                                }
                                placeholder="API key"
                                spellCheck={false}
                              />
                            </div>
                          ) : null}
                          {!isConnected && typeof pendingOauthMethod === "number" ? (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={providerOauthCodeById[provider.id] ?? ""}
                                onChange={(event) =>
                                  setProviderOauthCodeById((existing) => ({
                                    ...existing,
                                    [provider.id]: event.target.value,
                                  }))
                                }
                                placeholder="Authorization code"
                                spellCheck={false}
                              />
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={providerAuthPendingId === provider.id}
                                onClick={() => {
                                  void completeOpenCodeProviderOauth(provider.id);
                                }}
                              >
                                Finish OAuth
                              </Button>
                            </div>
                          ) : null}
                          {authError ? (
                            <p className="mt-2 text-xs text-muted-foreground">{authError}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background px-3 py-3">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-foreground">MCP servers</p>
                    <p className="text-xs text-muted-foreground">
                      Monitor and authenticate canonical OpenCode MCP servers from T3 Code.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(openCodeMcpServersQuery.data ?? {}).map(([serverName, status]) => {
                      const needsAuth = status.status === "needs_auth";
                      const isConnected = status.status === "connected";
                      return (
                        <div key={serverName} className="rounded-lg border border-border/70 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{serverName}</p>
                              <p className="text-xs text-muted-foreground">{status.status}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {needsAuth ? (
                                <>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    disabled={mcpPendingName === serverName}
                                    onClick={() => {
                                      void authenticateOpenCodeMcp(serverName);
                                    }}
                                  >
                                    Authenticate
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    disabled={mcpPendingName === serverName}
                                    onClick={() => {
                                      void startOpenCodeMcpAuth(serverName);
                                    }}
                                  >
                                    Start OAuth
                                  </Button>
                                </>
                              ) : null}
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={mcpPendingName === serverName}
                                onClick={() => {
                                  void toggleOpenCodeMcpConnection(serverName, isConnected);
                                }}
                              >
                                {isConnected ? "Disconnect" : "Connect"}
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={mcpPendingName === serverName}
                                onClick={() => {
                                  void removeOpenCodeMcpAuth(serverName);
                                }}
                              >
                                Remove auth
                              </Button>
                            </div>
                          </div>
                          {needsAuth || mcpAuthStartUrlByName[serverName] ? (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={mcpAuthCodeByName[serverName] ?? ""}
                                onChange={(event) =>
                                  setMcpAuthCodeByName((existing) => ({
                                    ...existing,
                                    [serverName]: event.target.value,
                                  }))
                                }
                                placeholder="Authorization code"
                                spellCheck={false}
                              />
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={mcpPendingName === serverName}
                                onClick={() => {
                                  void completeOpenCodeMcpAuth(serverName);
                                }}
                              >
                                Finish OAuth
                              </Button>
                            </div>
                          ) : null}
                          {mcpAuthStartUrlByName[serverName] ? (
                            <p className="mt-2 text-xs text-muted-foreground break-all">
                              OAuth started: {mcpAuthStartUrlByName[serverName]}
                            </p>
                          ) : null}
                          {status.status === "failed" || status.status === "needs_client_registration" ? (
                            <p className="mt-2 text-xs text-muted-foreground">{status.error}</p>
                          ) : null}
                          {mcpAuthErrorByName[serverName] ? (
                            <p className="mt-2 text-xs text-muted-foreground">{mcpAuthErrorByName[serverName]}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Codex App Server</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  These overrides apply to new sessions and let you use a non-default Codex install.
                </p>
              </div>

              <div className="space-y-4">
                <label htmlFor="codex-binary-path" className="block space-y-1">
                  <span className="text-xs font-medium text-foreground">Codex binary path</span>
                  <Input
                    id="codex-binary-path"
                    value={codexBinaryPath}
                    onChange={(event) => updateSettings({ codexBinaryPath: event.target.value })}
                    placeholder="codex"
                    spellCheck={false}
                  />
                  <span className="text-xs text-muted-foreground">
                    Leave blank to use <code>codex</code> from your PATH.
                  </span>
                </label>

                <label htmlFor="codex-home-path" className="block space-y-1">
                  <span className="text-xs font-medium text-foreground">CODEX_HOME path</span>
                  <Input
                    id="codex-home-path"
                    value={codexHomePath}
                    onChange={(event) => updateSettings({ codexHomePath: event.target.value })}
                    placeholder="/Users/you/.codex"
                    spellCheck={false}
                  />
                  <span className="text-xs text-muted-foreground">
                    Optional custom Codex home/config directory.
                  </span>
                </label>

                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <p>
                    Binary source:{" "}
                    <span className="font-medium text-foreground">{codexBinaryPath || "PATH"}</span>
                  </p>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      updateSettings({
                        codexBinaryPath: defaults.codexBinaryPath,
                        codexHomePath: defaults.codexHomePath,
                      })
                    }
                  >
                    Reset codex overrides
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Models</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save additional provider model slugs so they appear in the chat model picker and
                  `/model` command suggestions.
                </p>
              </div>

              <div className="space-y-5">
                {MODEL_PROVIDER_SETTINGS.map((providerSettings) => {
                  const provider = providerSettings.provider;
                  const customModels = getCustomModelsForProvider(settings, provider);
                  const customModelInput = customModelInputByProvider[provider];
                  const customModelError = customModelErrorByProvider[provider] ?? null;
                  return (
                    <div
                      key={provider}
                      className="rounded-xl border border-border bg-background/50 p-4"
                    >
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-foreground">
                          {providerSettings.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {providerSettings.description}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <label
                            htmlFor={`custom-model-slug-${provider}`}
                            className="block flex-1 space-y-1"
                          >
                            <span className="text-xs font-medium text-foreground">
                              Custom model slug
                            </span>
                            <Input
                              id={`custom-model-slug-${provider}`}
                              value={customModelInput}
                              onChange={(event) => {
                                const value = event.target.value;
                                setCustomModelInputByProvider((existing) => ({
                                  ...existing,
                                  [provider]: value,
                                }));
                                if (customModelError) {
                                  setCustomModelErrorByProvider((existing) => ({
                                    ...existing,
                                    [provider]: null,
                                  }));
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") return;
                                event.preventDefault();
                                addCustomModel(provider);
                              }}
                              placeholder={providerSettings.placeholder}
                              spellCheck={false}
                            />
                            <span className="text-xs text-muted-foreground">
                              Example: <code>{providerSettings.example}</code>
                            </span>
                          </label>

                          <Button
                            className="sm:mt-6"
                            type="button"
                            onClick={() => addCustomModel(provider)}
                          >
                            Add model
                          </Button>
                        </div>

                        {customModelError ? (
                          <p className="text-xs text-destructive">{customModelError}</p>
                        ) : null}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <p>Saved custom models: {customModels.length}</p>
                            {customModels.length > 0 ? (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  updateSettings(
                                    patchCustomModels(
                                      provider,
                                      [...getDefaultCustomModelsForProvider(defaults, provider)],
                                    ),
                                  )
                                }
                              >
                                Reset custom models
                              </Button>
                            ) : null}
                          </div>

                          {customModels.length > 0 ? (
                            <div className="space-y-2">
                              {customModels.map((slug) => (
                                <div
                                  key={`${provider}:${slug}`}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                                >
                                  <code className="min-w-0 flex-1 truncate text-xs text-foreground">
                                    {slug}
                                  </code>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => removeCustomModel(provider, slug)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-xs text-muted-foreground">
                              No custom models saved yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Responses</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Control how assistant output is rendered during a turn.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Stream assistant messages</p>
                  <p className="text-xs text-muted-foreground">
                    Show token-by-token output while a response is in progress.
                  </p>
                </div>
                <Switch
                  checked={settings.enableAssistantStreaming}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      enableAssistantStreaming: Boolean(checked),
                    })
                  }
                  aria-label="Stream assistant messages"
                />
              </div>

              {settings.enableAssistantStreaming !== defaults.enableAssistantStreaming ? (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      updateSettings({
                        enableAssistantStreaming: defaults.enableAssistantStreaming,
                      })
                    }
                  >
                    Restore default
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Keybindings</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open the persisted <code>keybindings.json</code> file to edit advanced bindings
                  directly.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">Config file path</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                      {keybindingsConfigPath ?? "Resolving keybindings path..."}
                    </p>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={!keybindingsConfigPath || isOpeningKeybindings}
                    onClick={openKeybindingsFile}
                  >
                    {isOpeningKeybindings ? "Opening..." : "Open keybindings.json"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Opens in your preferred editor selection.
                </p>
                {openKeybindingsError ? (
                  <p className="text-xs text-destructive">{openKeybindingsError}</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-foreground">Safety</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Additional guardrails for destructive local actions.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Confirm thread deletion</p>
                  <p className="text-xs text-muted-foreground">
                    Ask for confirmation before deleting a thread and its chat history.
                  </p>
                </div>
                <Switch
                  checked={settings.confirmThreadDelete}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      confirmThreadDelete: Boolean(checked),
                    })
                  }
                  aria-label="Confirm thread deletion"
                />
              </div>

              {settings.confirmThreadDelete !== defaults.confirmThreadDelete ? (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      updateSettings({
                        confirmThreadDelete: defaults.confirmThreadDelete,
                      })
                    }
                  >
                    Restore default
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/settings")({
  component: SettingsRouteView,
});
