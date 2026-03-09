import type {
  OpenCodeAgent,
  OpenCodeDeleteSessionInput,
  OpenCodeForkSessionInput,
  OpenCodeCreateSessionInput,
  OpenCodeEvent,
  OpenCodeGetTodoInput,
  OpenCodeGetVcsInput,
  OpenCodeMessage,
  OpenCodePermissionRequest,
  OpenCodeProviderCatalog,
  OpenCodeReplyPermissionInput,
  OpenCodeSendMessageInput,
  OpenCodeSession,
  OpenCodeSessionStatusMap,
  OpenCodeSessionSummary,
  OpenCodeStatus,
  OpenCodeTodo,
  OpenCodeProject,
  OpenCodeUpdateSessionInput,
  OpenCodeVcsInfo,
} from "@t3tools/contracts";
import {
  OpenCodeAgent as OpenCodeAgentSchema,
  OpenCodeEvent as OpenCodeEventSchema,
  OpenCodeMessage as OpenCodeMessageSchema,
  OpenCodePermissionRequest as OpenCodePermissionRequestSchema,
  OpenCodeProviderCatalog as OpenCodeProviderCatalogSchema,
  OpenCodeProject as OpenCodeProjectSchema,
  OpenCodeSession as OpenCodeSessionSchema,
  OpenCodeSessionStatusMap as OpenCodeSessionStatusMapSchema,
  OpenCodeTodo as OpenCodeTodoSchema,
  OpenCodeSessionSummary as OpenCodeSessionSummarySchema,
  OpenCodeVcsInfo as OpenCodeVcsInfoSchema,
} from "@t3tools/contracts";
import { Schema } from "effect";
import { getOpenCodeAuthHeader, type ResolvedOpenCodeConfig } from "./config";

const decodeProjects = Schema.decodeUnknownSync(Schema.Array(OpenCodeProjectSchema));
const decodeAgents = Schema.decodeUnknownSync(Schema.Array(OpenCodeAgentSchema));
const decodeProviderCatalog = Schema.decodeUnknownSync(OpenCodeProviderCatalogSchema);
const decodeSessions = Schema.decodeUnknownSync(Schema.Array(OpenCodeSessionSummarySchema));
const decodeSession = Schema.decodeUnknownSync(OpenCodeSessionSchema);
const decodeMessages = Schema.decodeUnknownSync(Schema.Array(OpenCodeMessageSchema));
const decodeTodo = Schema.decodeUnknownSync(Schema.Array(OpenCodeTodoSchema));
const decodeStatuses = Schema.decodeUnknownSync(OpenCodeSessionStatusMapSchema);
const decodePermissions = Schema.decodeUnknownSync(Schema.Array(OpenCodePermissionRequestSchema));
const decodeEvent = Schema.decodeUnknownSync(OpenCodeEventSchema);
const decodeVcsInfo = Schema.decodeUnknownSync(OpenCodeVcsInfoSchema);

export async function fetchOpenCodeHealth(config: ResolvedOpenCodeConfig): Promise<OpenCodeStatus> {
  const response = await fetch(`${config.baseUrl}/global/health`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode health check failed with ${response.status}.`);
  }
  const json = (await response.json()) as { healthy?: boolean; version?: string };
  return {
    state: "ready",
    serverUrl: config.baseUrl,
    healthy: json.healthy === true,
    autoStart: config.autoStart,
    ...(typeof json.version === "string" ? { version: json.version } : {}),
  };
}

export async function listOpenCodeProjects(config: ResolvedOpenCodeConfig): Promise<OpenCodeProject[]> {
  const response = await fetch(`${config.baseUrl}/project`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode project list failed with ${response.status}.`);
  }
  return Array.from(decodeProjects(await response.json()));
}

export async function listOpenCodeProviders(
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeProviderCatalog> {
  const response = await fetch(`${config.baseUrl}/provider`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode provider list failed with ${response.status}.`);
  }
  return decodeProviderCatalog(await response.json());
}

export async function listOpenCodeAgents(config: ResolvedOpenCodeConfig): Promise<OpenCodeAgent[]> {
  const response = await fetch(`${config.baseUrl}/agent`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode agent list failed with ${response.status}.`);
  }
  return Array.from(decodeAgents(await response.json()));
}

export async function listOpenCodeSessions(input: {
  config: ResolvedOpenCodeConfig;
  directory?: string | undefined;
  limit?: number | undefined;
  roots?: boolean | undefined;
}): Promise<OpenCodeSessionSummary[]> {
  const searchParams = new URLSearchParams();
  if (input.directory) {
    searchParams.set("directory", input.directory);
  }
  if (typeof input.limit === "number") {
    searchParams.set("limit", String(input.limit));
  }
  if (typeof input.roots === "boolean") {
    searchParams.set("roots", input.roots ? "true" : "false");
  }
  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const response = await fetch(`${input.config.baseUrl}/experimental/session${suffix}`, {
    headers: buildHeaders(input.config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode session list failed with ${response.status}.`);
  }
  return Array.from(decodeSessions(await response.json()));
}

export async function getOpenCodeSession(
  config: ResolvedOpenCodeConfig,
  sessionId: string,
): Promise<OpenCodeSession> {
  const response = await fetch(`${config.baseUrl}/session/${encodeURIComponent(sessionId)}`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode session lookup failed with ${response.status}.`);
  }
  return decodeSession(await response.json());
}

export async function getOpenCodeMessages(
  config: ResolvedOpenCodeConfig,
  sessionId: string,
): Promise<OpenCodeMessage[]> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(sessionId)}/message`,
    {
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode message lookup failed with ${response.status}.`);
  }
  return Array.from(decodeMessages(await response.json()));
}

export async function getOpenCodeTodo(
  input: OpenCodeGetTodoInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeTodo[]> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/todo`,
    {
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode todo lookup failed with ${response.status}.`);
  }
  return Array.from(decodeTodo(await response.json()));
}

export async function getOpenCodeStatuses(
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeSessionStatusMap> {
  const response = await fetch(`${config.baseUrl}/session/status`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode session status lookup failed with ${response.status}.`);
  }
  return decodeStatuses(await response.json());
}

export async function listOpenCodePermissions(
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodePermissionRequest[]> {
  const response = await fetch(`${config.baseUrl}/permission`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode permission list failed with ${response.status}.`);
  }
  return Array.from(decodePermissions(await response.json()));
}

export async function replyOpenCodePermission(
  input: OpenCodeReplyPermissionInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/permission/${encodeURIComponent(input.requestId)}/reply`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        reply: input.reply,
        ...(input.message ? { message: input.message } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode permission reply failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function getOpenCodeVcs(
  input: OpenCodeGetVcsInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeVcsInfo> {
  const response = await fetch(`${config.baseUrl}/vcs`, {
    headers: buildHeaders(config, input.directory),
  });
  if (!response.ok) {
    throw new Error(`OpenCode VCS lookup failed with ${response.status}.`);
  }
  return decodeVcsInfo(await response.json());
}

export async function createOpenCodeSession(
  input: OpenCodeCreateSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeSession> {
  const response = await fetch(`${config.baseUrl}/session`, {
    method: "POST",
    headers: buildHeaders(config, input.directory),
    body: JSON.stringify({
      ...(input.title ? { title: input.title } : {}),
      ...(input.permission ? { permission: input.permission } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenCode session creation failed with ${response.status}.`);
  }
  return decodeSession(await response.json());
}

export async function sendOpenCodeMessage(
  input: OpenCodeSendMessageInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeMessage | null> {
  const parts =
    input.parts ??
    (typeof input.text === "string"
      ? [
          {
            type: "text" as const,
            text: input.text,
          },
        ]
      : []);
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/message`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        ...(input.model ? { model: input.model } : {}),
        ...(input.agent ? { agent: input.agent } : {}),
        ...(input.variant ? { variant: input.variant } : {}),
        parts,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode send message failed with ${response.status}.`);
  }
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }
  return Schema.decodeUnknownSync(OpenCodeMessageSchema)(JSON.parse(text));
}

export async function abortOpenCodeSession(
  config: ResolvedOpenCodeConfig,
  sessionId: string,
): Promise<boolean> {
  const response = await fetch(`${config.baseUrl}/session/${encodeURIComponent(sessionId)}/abort`, {
    method: "POST",
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode abort failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function updateOpenCodeSession(
  input: OpenCodeUpdateSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeSession> {
  const body = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.permission !== undefined ? { permission: input.permission } : {}),
  };
  const response = await fetch(`${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}`, {
    method: "PATCH",
    headers: buildHeaders(config),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OpenCode update session failed with ${response.status}.`);
  }
  return decodeSession(await response.json());
}

export async function deleteOpenCodeSession(
  input: OpenCodeDeleteSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(`${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}`, {
    method: "DELETE",
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode delete session failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function forkOpenCodeSession(
  input: OpenCodeForkSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeSession> {
  const body = {
    ...(input.messageId !== undefined ? { messageID: input.messageId } : {}),
    ...(input.directory !== undefined ? { directory: input.directory } : {}),
    ...(input.permission !== undefined ? { permission: input.permission } : {}),
  };
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/fork`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode fork session failed with ${response.status}.`);
  }
  return decodeSession(await response.json());
}

export async function streamOpenCodeEvents(input: {
  config: ResolvedOpenCodeConfig;
  signal: AbortSignal;
  onEvent: (event: OpenCodeEvent) => void;
}): Promise<void> {
  const response = await fetch(`${input.config.baseUrl}/global/event`, {
    headers: buildHeaders(input.config),
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error(`OpenCode event stream failed with ${response.status}.`);
  }
  if (!response.body) {
    throw new Error("OpenCode event stream returned no body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!input.signal.aborted) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    buffer += decoder.decode(next.value, { stream: true });
    let boundaryIndex = buffer.search(/\r?\n\r?\n/);
    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + (buffer[boundaryIndex] === "\r" ? 4 : 2));
      const parsed = parseServerSentEvent(rawEvent);
      if (parsed) {
        input.onEvent(decodeEvent(parsed));
      }
      boundaryIndex = buffer.search(/\r?\n\r?\n/);
    }
  }
}

function buildHeaders(config: ResolvedOpenCodeConfig, directory?: string): Headers {
  const headers = new Headers();
  const authHeader = getOpenCodeAuthHeader(config.password);
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }
  if (directory) {
    headers.set("x-opencode-directory", encodeDirectoryHeader(directory));
  }
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  return headers;
}

function encodeDirectoryHeader(directory: string): string {
  const hasOnlyAscii = Array.from(directory).every((char) => char.charCodeAt(0) <= 0x7f);
  return hasOnlyAscii ? directory : encodeURIComponent(directory);
}

function parseServerSentEvent(rawEvent: string): unknown | null {
  const lines = rawEvent.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line.startsWith("data:")) {
      continue;
    }
    dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) {
    return null;
  }
  return JSON.parse(dataLines.join("\n"));
}
