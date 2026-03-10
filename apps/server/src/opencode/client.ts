import type {
  OpenCodeAgent,
  OpenCodeDeleteSessionInput,
  OpenCodeFileDiff,
  OpenCodeGetDiffInput,
  OpenCodeForkSessionInput,
  OpenCodeCommand,
  OpenCodeCreateSessionInput,
  OpenCodeEvent,
  OpenCodeGetTodoInput,
  OpenCodeGetVcsInput,
  OpenCodeMessage,
  OpenCodeMcpAuthStartResult,
  OpenCodeMcpResource,
  OpenCodeMcpStatus,
  OpenCodePermissionRequest,
  OpenCodeProviderAuthMethod,
  OpenCodeProviderAuthorization,
  OpenCodeQuestionRequest,
  OpenCodeProviderCatalog,
  OpenCodeReplyPermissionInput,
  OpenCodeReplyQuestionInput,
  OpenCodeRejectQuestionInput,
  OpenCodeRevertSessionInput,
  OpenCodeAuthenticateMcpInput,
  OpenCodeAuthorizeProviderInput,
  OpenCodeCompleteMcpAuthInput,
  OpenCodeCompleteProviderAuthInput,
  OpenCodeConnectMcpInput,
  OpenCodeDisconnectMcpInput,
  OpenCodeRemoveMcpAuthInput,
  OpenCodeRemoveProviderAuthInput,
  OpenCodeSendMessageInput,
  OpenCodeRunCommandInput,
  OpenCodeSession,
  OpenCodeShareSessionInput,
  OpenCodeSetProviderApiKeyInput,
  OpenCodeStartMcpAuthInput,
  OpenCodeSummarizeSessionInput,
  OpenCodeSessionStatusMap,
  OpenCodeSessionSummary,
  OpenCodeStatus,
  OpenCodeTodo,
  OpenCodeUnrevertSessionInput,
  OpenCodeUnshareSessionInput,
  OpenCodeProject,
  OpenCodeUpdateSessionInput,
  OpenCodeVcsInfo,
} from "@t3tools/contracts";
import {
  OpenCodeAgent as OpenCodeAgentSchema,
  OpenCodeEvent as OpenCodeEventSchema,
  OpenCodeMessage as OpenCodeMessageSchema,
  OpenCodePermissionRequest as OpenCodePermissionRequestSchema,
  OpenCodeProviderAuthMethod as OpenCodeProviderAuthMethodSchema,
  OpenCodeProviderAuthorization as OpenCodeProviderAuthorizationSchema,
  OpenCodeMcpAuthStartResult as OpenCodeMcpAuthStartResultSchema,
  OpenCodeMcpResource as OpenCodeMcpResourceSchema,
  OpenCodeMcpStatus as OpenCodeMcpStatusSchema,
  OpenCodeCommand as OpenCodeCommandSchema,
  OpenCodeQuestionRequest as OpenCodeQuestionRequestSchema,
  OpenCodeProviderCatalog as OpenCodeProviderCatalogSchema,
  OpenCodeProject as OpenCodeProjectSchema,
  OpenCodeSession as OpenCodeSessionSchema,
  OpenCodeSessionStatusMap as OpenCodeSessionStatusMapSchema,
  OpenCodeFileDiff as OpenCodeFileDiffSchema,
  OpenCodeTodo as OpenCodeTodoSchema,
  OpenCodeSessionSummary as OpenCodeSessionSummarySchema,
  OpenCodeVcsInfo as OpenCodeVcsInfoSchema,
} from "@t3tools/contracts";
import { Schema } from "effect";
import { getOpenCodeAuthHeader, type ResolvedOpenCodeConfig } from "./config";

const decodeProjects = Schema.decodeUnknownSync(Schema.Array(OpenCodeProjectSchema));
const decodeAgents = Schema.decodeUnknownSync(Schema.Array(OpenCodeAgentSchema));
const decodeCommands = Schema.decodeUnknownSync(Schema.Array(OpenCodeCommandSchema));
const decodeResources = Schema.decodeUnknownSync(Schema.Record(Schema.String, OpenCodeMcpResourceSchema));
const decodeProviderCatalog = Schema.decodeUnknownSync(OpenCodeProviderCatalogSchema);
const decodeSessions = Schema.decodeUnknownSync(Schema.Array(OpenCodeSessionSummarySchema));
const decodeSession = Schema.decodeUnknownSync(OpenCodeSessionSchema);
const decodeMessages = Schema.decodeUnknownSync(Schema.Array(OpenCodeMessageSchema));
const decodeDiff = Schema.decodeUnknownSync(Schema.Array(OpenCodeFileDiffSchema));
const decodeTodo = Schema.decodeUnknownSync(Schema.Array(OpenCodeTodoSchema));
const decodeStatuses = Schema.decodeUnknownSync(OpenCodeSessionStatusMapSchema);
const decodePermissions = Schema.decodeUnknownSync(Schema.Array(OpenCodePermissionRequestSchema));
const decodeProviderAuthMethods = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, Schema.Array(OpenCodeProviderAuthMethodSchema)),
);
const decodeMcpStatuses = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, OpenCodeMcpStatusSchema),
);
const decodeProviderAuthorization = Schema.decodeUnknownSync(
  Schema.NullOr(OpenCodeProviderAuthorizationSchema),
);
const decodeMcpAuthStartResult = Schema.decodeUnknownSync(OpenCodeMcpAuthStartResultSchema);
const decodeQuestions = Schema.decodeUnknownSync(Schema.Array(OpenCodeQuestionRequestSchema));
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

export async function listOpenCodeProviderAuthMethods(
  config: ResolvedOpenCodeConfig,
): Promise<Record<string, OpenCodeProviderAuthMethod[]>> {
  const response = await fetch(`${config.baseUrl}/provider/auth`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode provider auth methods failed with ${response.status}.`);
  }
  const methods = decodeProviderAuthMethods(await response.json());
  return Object.fromEntries(Object.entries(methods).map(([providerId, entries]) => [providerId, Array.from(entries)]));
}

export async function authorizeOpenCodeProvider(
  input: OpenCodeAuthorizeProviderInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeProviderAuthorization | null> {
  const response = await fetch(
    `${config.baseUrl}/provider/${encodeURIComponent(input.providerId)}/oauth/authorize`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({ method: input.method }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode provider authorization failed with ${response.status}.`);
  }
  return decodeProviderAuthorization(await response.json());
}

export async function completeOpenCodeProviderAuth(
  input: OpenCodeCompleteProviderAuthInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/provider/${encodeURIComponent(input.providerId)}/oauth/callback`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        method: input.method,
        ...(input.code ? { code: input.code } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode provider auth completion failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function setOpenCodeProviderApiKey(
  input: OpenCodeSetProviderApiKeyInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/provider/${encodeURIComponent(input.providerId)}/api`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({ key: input.apiKey }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode provider API key setup failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function removeOpenCodeProviderAuth(
  input: OpenCodeRemoveProviderAuthInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/provider/${encodeURIComponent(input.providerId)}/auth`,
    {
      method: "DELETE",
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode provider auth removal failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function listOpenCodeMcpServers(
  config: ResolvedOpenCodeConfig,
): Promise<Record<string, OpenCodeMcpStatus>> {
  const response = await fetch(`${config.baseUrl}/mcp`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode MCP status lookup failed with ${response.status}.`);
  }
  const statuses = decodeMcpStatuses(await response.json());
  return Object.fromEntries(Object.entries(statuses));
}

export async function listOpenCodeCommands(
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeCommand[]> {
  const response = await fetch(`${config.baseUrl}/command`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode command list failed with ${response.status}.`);
  }
  return Array.from(decodeCommands(await response.json()));
}

export async function listOpenCodeResources(
  config: ResolvedOpenCodeConfig,
): Promise<Record<string, OpenCodeMcpResource>> {
  const response = await fetch(`${config.baseUrl}/experimental/resource`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode resource list failed with ${response.status}.`);
  }
  const resources = decodeResources(await response.json());
  return Object.fromEntries(Object.entries(resources));
}

export async function startOpenCodeMcpAuth(
  input: OpenCodeStartMcpAuthInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeMcpAuthStartResult> {
  const response = await fetch(`${config.baseUrl}/mcp/${encodeURIComponent(input.serverName)}/auth`, {
    method: "POST",
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode MCP auth start failed with ${response.status}.`);
  }
  return decodeMcpAuthStartResult(await response.json());
}

export async function completeOpenCodeMcpAuth(
  input: OpenCodeCompleteMcpAuthInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeMcpStatus> {
  const response = await fetch(
    `${config.baseUrl}/mcp/${encodeURIComponent(input.serverName)}/auth/callback`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({ code: input.code }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode MCP auth completion failed with ${response.status}.`);
  }
  return Schema.decodeUnknownSync(OpenCodeMcpStatusSchema)(await response.json());
}

export async function authenticateOpenCodeMcp(
  input: OpenCodeAuthenticateMcpInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeMcpStatus> {
  const response = await fetch(
    `${config.baseUrl}/mcp/${encodeURIComponent(input.serverName)}/auth/authenticate`,
    {
      method: "POST",
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode MCP authenticate failed with ${response.status}.`);
  }
  return Schema.decodeUnknownSync(OpenCodeMcpStatusSchema)(await response.json());
}

export async function removeOpenCodeMcpAuth(
  input: OpenCodeRemoveMcpAuthInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(`${config.baseUrl}/mcp/${encodeURIComponent(input.serverName)}/auth`, {
    method: "DELETE",
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode MCP auth removal failed with ${response.status}.`);
  }
  return ((await response.json()) as { success?: boolean }).success === true;
}

export async function connectOpenCodeMcp(
  input: OpenCodeConnectMcpInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(`${config.baseUrl}/mcp/${encodeURIComponent(input.serverName)}/connect`, {
    method: "POST",
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode MCP connect failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function disconnectOpenCodeMcp(
  input: OpenCodeDisconnectMcpInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(`${config.baseUrl}/mcp/${encodeURIComponent(input.serverName)}/disconnect`, {
    method: "POST",
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode MCP disconnect failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function runOpenCodeCommand(
  input: OpenCodeRunCommandInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeMessage | null> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/command`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        command: input.command,
        arguments: input.arguments,
        ...(input.agent ? { agent: input.agent } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.variant ? { variant: input.variant } : {}),
        ...(input.parts ? { parts: input.parts } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode command run failed with ${response.status}.`);
  }
  const payload = (await response.json()) as { info?: unknown; parts?: unknown };
  if (!payload.info || !payload.parts) {
    return null;
  }
  return Schema.decodeUnknownSync(OpenCodeMessageSchema)(payload);
}

export async function summarizeOpenCodeSession(
  input: OpenCodeSummarizeSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/summarize`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        providerID: input.providerID,
        modelID: input.modelID,
        ...(input.auto !== undefined ? { auto: input.auto } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode summarize failed with ${response.status}.`);
  }
  return (await response.json()) === true;
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

export async function getOpenCodeDiff(
  input: OpenCodeGetDiffInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeFileDiff[]> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/diff`,
    {
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode diff lookup failed with ${response.status}.`);
  }
  return Array.from(decodeDiff(await response.json()));
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

export async function listOpenCodeQuestions(
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeQuestionRequest[]> {
  const response = await fetch(`${config.baseUrl}/question`, {
    headers: buildHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`OpenCode question list failed with ${response.status}.`);
  }
  return Array.from(decodeQuestions(await response.json()));
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

export async function replyOpenCodeQuestion(
  input: OpenCodeReplyQuestionInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/question/${encodeURIComponent(input.requestId)}/reply`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({ answers: input.answers }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode question reply failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function rejectOpenCodeQuestion(
  input: OpenCodeRejectQuestionInput,
  config: ResolvedOpenCodeConfig,
): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/question/${encodeURIComponent(input.requestId)}/reject`,
    {
      method: "POST",
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode question rejection failed with ${response.status}.`);
  }
  return (await response.json()) === true;
}

export async function revertOpenCodeSession(
  input: OpenCodeRevertSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeSession> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/revert`,
    {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        messageID: input.messageId,
        ...(input.partId ? { partID: input.partId } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode session revert failed with ${response.status}.`);
  }
  return decodeSession(await response.json());
}

export async function shareOpenCodeSession(
  input: OpenCodeShareSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeSession> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/share`,
    {
      method: "POST",
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode session share failed with ${response.status}.`);
  }
  return decodeSession(await response.json());
}

export async function unshareOpenCodeSession(
  input: OpenCodeUnshareSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeSession> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/share`,
    {
      method: "DELETE",
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode session unshare failed with ${response.status}.`);
  }
  return decodeSession(await response.json());
}

export async function unrevertOpenCodeSession(
  input: OpenCodeUnrevertSessionInput,
  config: ResolvedOpenCodeConfig,
): Promise<OpenCodeSession> {
  const response = await fetch(
    `${config.baseUrl}/session/${encodeURIComponent(input.sessionId)}/unrevert`,
    {
      method: "POST",
      headers: buildHeaders(config),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenCode session unrevert failed with ${response.status}.`);
  }
  return decodeSession(await response.json());
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
  if (config.workspaceId) {
    headers.set("x-opencode-workspace", config.workspaceId);
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
