import type { OpenCodeServerConfigInput } from "@t3tools/contracts";

export const DEFAULT_OPENCODE_SERVER_URL = "http://127.0.0.1:4096";
export const DEFAULT_OPENCODE_AUTH_USERNAME = "opencode";

export interface ResolvedOpenCodeConfig {
  readonly baseUrl: string;
  readonly autoStart: boolean;
  readonly password: string | null;
}

export function resolveOpenCodeConfig(input: OpenCodeServerConfigInput): ResolvedOpenCodeConfig {
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl);
  return {
    baseUrl: normalizedBaseUrl,
    autoStart: input.autoStart,
    password: normalizeSecret(input.password),
  };
}

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().length > 0 ? input.trim() : DEFAULT_OPENCODE_SERVER_URL;
  const url = new URL(trimmed);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function isLoopbackOpenCodeUrl(input: string): boolean {
  const url = new URL(input);
  return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
}

export function getOpenCodeAuthHeader(password: string | null): string | null {
  if (!password) {
    return null;
  }
  return `Basic ${Buffer.from(`${DEFAULT_OPENCODE_AUTH_USERNAME}:${password}`).toString("base64")}`;
}

function normalizeSecret(input: string | undefined): string | null {
  if (!input) {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}
