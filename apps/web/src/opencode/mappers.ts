import {
  DEFAULT_MODEL_BY_PROVIDER,
  EventId,
  MessageId,
  type OpenCodeAgent,
  type OpenCodeMessage,
  type OpenCodeMessagePart,
  type OpenCodeProviderCatalog,
  type OpenCodeProviderModel,
  type OpenCodeProject,
  type OpenCodeRuntimeStatus,
  type OpenCodeSession,
  type OpenCodeSessionSummary,
  type OrchestrationLatestTurn,
  OrchestrationProposedPlanId,
  type OrchestrationThreadActivity,
  ProjectId,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import {
  DEFAULT_INTERACTION_MODE,
  type ChatMessage,
  type Project,
  type ProjectScript,
  type Thread,
} from "../types";

export interface OpenCodeAgentCatalog {
  visible: OpenCodeAgent[];
  defaultAgent: string | null;
  planAgent: string | null;
}

export function mapOpenCodeProjects(input: {
  projects: OpenCodeProject[];
  sessions: OpenCodeSessionSummary[];
  existingProjects?: Project[];
  scriptsByProjectCwd?: Readonly<Record<string, ProjectScript[]>> | undefined;
}): Project[] {
  const projectsById = new Map(input.projects.map((project) => [project.id, project] as const));
  const fallbackProjects = new Map<string, { id: string; cwd: string; name: string }>();

  for (const session of input.sessions) {
    if (session.projectID && projectsById.has(session.projectID)) {
      continue;
    }
    const cwd = session.project?.worktree ?? session.directory;
    const syntheticId = syntheticProjectId(session.projectID ?? cwd);
    if (fallbackProjects.has(syntheticId)) {
      continue;
    }
    fallbackProjects.set(syntheticId, {
      id: syntheticId,
      cwd,
      name: basename(cwd),
    });
  }

  const existingExpandedByCwd = new Map(
    (input.existingProjects ?? []).map((project) => [project.cwd, project.expanded] as const),
  );

  const mappedProjects = input.projects.map((project) =>
    createProject({
      id: project.id,
      cwd: project.worktree,
      name: basename(project.worktree),
      existingExpanded: existingExpandedByCwd.get(project.worktree),
      scripts: input.scriptsByProjectCwd?.[project.worktree] ?? [],
    }),
  );
  const mappedFallbackProjects = Array.from(fallbackProjects.values()).map((project) =>
    createProject({
      ...project,
      existingExpanded: existingExpandedByCwd.get(project.cwd),
      scripts: input.scriptsByProjectCwd?.[project.cwd] ?? [],
    }),
  );

  return [...mappedProjects, ...mappedFallbackProjects].toSorted((left, right) =>
    right.cwd.localeCompare(left.cwd),
  );
}

export function mapOpenCodeThreadSummary(input: {
  session: OpenCodeSessionSummary | OpenCodeSession;
  projectId: string;
  projectCwd?: string | undefined;
  status: OpenCodeRuntimeStatus | undefined;
  lastVisitedAt?: string | undefined;
  providerCatalog?: OpenCodeProviderCatalog | null | undefined;
  agentCatalog?: OpenCodeAgentCatalog | null | undefined;
  activities?: OrchestrationThreadActivity[] | undefined;
}): Thread {
  const provider = resolveThreadProvider({
    session: input.session,
    providerCatalog: input.providerCatalog,
  });
  const model = resolveThreadModel({
    messages: [],
    providerCatalog: input.providerCatalog,
    provider,
  });
  return {
    id: ThreadId.makeUnsafe(input.session.id),
    codexThreadId: null,
    projectId: ProjectId.makeUnsafe(input.projectId),
    source: "opencode",
    capabilities: resolveThreadCapabilities({
      providerCatalog: input.providerCatalog,
      agentCatalog: input.agentCatalog,
      provider,
      model,
    }),
    title: input.session.title.trim().length > 0 ? input.session.title : "New session",
    model,
    runtimeMode: resolveThreadRuntimeMode(input.session),
    interactionMode: resolveThreadInteractionMode([], input.agentCatalog),
    session: {
      provider,
      status: openCodeStatusToThreadPhase(input.status),
      orchestrationStatus: input.status?.type === "busy" ? "running" : "ready",
      createdAt: toIso(input.session.time.created),
      updatedAt: toIso(input.session.time.updated),
    },
    messages: [],
    proposedPlans: [],
    error: null,
    createdAt: toIso(input.session.time.created),
    latestTurn: resolveLatestTurn([], input.status),
    lastVisitedAt: input.lastVisitedAt,
    branch: null,
    worktreePath: resolveThreadWorktreePath({ session: input.session, projectCwd: input.projectCwd }),
    turnDiffSummaries: [],
    activities: input.activities ?? [],
  };
}

export function mapOpenCodeThreadDetail(input: {
  session: OpenCodeSession;
  messages: OpenCodeMessage[];
  projectId: string;
  projectCwd?: string | undefined;
  status: OpenCodeRuntimeStatus | undefined;
  lastVisitedAt?: string | undefined;
  providerCatalog?: OpenCodeProviderCatalog | null | undefined;
  branch?: string | null | undefined;
  agentCatalog?: OpenCodeAgentCatalog | null | undefined;
  activities?: OrchestrationThreadActivity[] | undefined;
}): Thread {
  const summary = mapOpenCodeThreadSummary({
    session: input.session,
    projectId: input.projectId,
    projectCwd: input.projectCwd,
    status: input.status,
    lastVisitedAt: input.lastVisitedAt,
    providerCatalog: input.providerCatalog,
    agentCatalog: input.agentCatalog,
    activities: input.activities,
  });
  const model = resolveThreadModel({
    messages: input.messages,
    providerCatalog: input.providerCatalog,
    provider: summary.session?.provider ?? "codex",
  });
  return {
    ...summary,
    model,
    runtimeMode: resolveThreadRuntimeMode(input.session),
    interactionMode: resolveThreadInteractionMode(input.messages, input.agentCatalog),
    messages: input.messages.map(mapOpenCodeMessage),
    proposedPlans: deriveOpenCodeProposedPlans(input.messages, input.agentCatalog),
    capabilities: resolveThreadCapabilities({
      providerCatalog: input.providerCatalog,
      provider: summary.session?.provider ?? "codex",
      model,
    }),
    latestTurn: resolveLatestTurn(input.messages, input.status),
    session: summary.session
      ? {
          ...summary.session,
          updatedAt: toIso(input.session.time.updated),
        }
      : null,
    branch: input.branch ?? null,
    worktreePath: resolveThreadWorktreePath({
      session: input.session,
      projectCwd: input.projectCwd,
      messages: input.messages,
    }),
    activities: mergeOpenCodeActivities(input.messages, input.activities ?? []),
  };
}

function deriveOpenCodeProposedPlans(
  messages: OpenCodeMessage[],
  agentCatalog?: OpenCodeAgentCatalog | null | undefined,
): Thread["proposedPlans"] {
  const planAgent = agentCatalog?.planAgent;
  if (!planAgent) {
    return [];
  }

  return messages.flatMap((message) => {
    if (message.info.role !== "assistant" || message.info.agent !== planAgent) {
      return [];
    }
    const planMarkdown = partsToText(message.parts, message.info.role).trim();
    if (!planMarkdown) {
      return [];
    }
    const updatedAt = toIso(
      message.info.time.completed ?? message.info.time.end ?? message.info.time.created,
    );
    return [
      {
        id: OrchestrationProposedPlanId.makeUnsafe(`opencode-plan-${message.info.id}`),
        turnId: resolveMessageTurnId(message),
        planMarkdown,
        createdAt: toIso(message.info.time.created),
        updatedAt,
      },
    ];
  });
}

function resolveLatestTurn(
  messages: OpenCodeMessage[],
  status: OpenCodeRuntimeStatus | undefined,
): OrchestrationLatestTurn | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.info.role !== "user") {
      continue;
    }

    const assistant = messages
      .slice(index + 1)
      .find((candidate) => candidate.info.role === "assistant");
    const requestedAt = toIso(message.info.time.created);
    const startedAt = assistant
      ? toIso(assistant.info.time.start ?? assistant.info.time.created)
      : requestedAt;
    const completedAt = assistant
      ? toIso(assistant.info.time.completed ?? assistant.info.time.end ?? assistant.info.time.created)
      : null;

    if (status?.type === "busy" || status?.type === "retry") {
      return {
        turnId: TurnId.makeUnsafe(`opencode-turn-${message.info.id}`),
        state: "running",
        requestedAt,
        startedAt,
        completedAt: null,
        assistantMessageId: assistant ? MessageId.makeUnsafe(assistant.info.id) : null,
      };
    }

    if (!assistant) {
      return {
        turnId: TurnId.makeUnsafe(`opencode-turn-${message.info.id}`),
        state: "interrupted",
        requestedAt,
        startedAt,
        completedAt: startedAt,
        assistantMessageId: null,
      };
    }

    return {
      turnId: TurnId.makeUnsafe(`opencode-turn-${message.info.id}`),
      state: assistant.info.error ? "error" : "completed",
      requestedAt,
      startedAt,
      completedAt,
      assistantMessageId: MessageId.makeUnsafe(assistant.info.id),
    };
  }

  return null;
}

function mergeOpenCodeActivities(
  messages: OpenCodeMessage[],
  overlayActivities: OrchestrationThreadActivity[],
): OrchestrationThreadActivity[] {
  const derived = deriveMessageActivities(messages);
  const merged = new Map<string, OrchestrationThreadActivity>();
  for (const activity of [...derived, ...overlayActivities]) {
    merged.set(activity.id, activity);
  }
  return [...merged.values()].toSorted((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function deriveMessageActivities(messages: OpenCodeMessage[]): OrchestrationThreadActivity[] {
  return messages.flatMap((message) => {
    if (message.info.role !== "assistant") {
      return [];
    }
    const turnId = resolveMessageTurnId(message);
    const createdAt = toIso(
      message.info.time.completed ?? message.info.time.end ?? message.info.time.created,
    );
    return message.parts.flatMap((part, index) => {
      const activity = mapPartToActivity(part, message.info.id, index, createdAt, turnId);
      return activity ? [activity] : [];
    });
  });
}

function mapPartToActivity(
  part: OpenCodeMessagePart,
  messageId: string,
  index: number,
  createdAt: string,
  turnId: OrchestrationThreadActivity["turnId"],
): OrchestrationThreadActivity | null {
  const id = `opencode-activity-${messageId}-${part.id ?? part.callID ?? index}`;
  if (part.type === "tool") {
    return {
      id: EventId.makeUnsafe(id),
      tone: isToolError(part) ? "error" : "tool",
      kind: "tool.completed",
      summary: part.tool ? `Used ${part.tool}` : "Used tool",
      payload: buildToolActivityPayload(part),
      turnId,
      createdAt,
    } as OrchestrationThreadActivity;
  }
  if (part.type === "patch") {
    return {
      id: EventId.makeUnsafe(id),
      tone: "tool",
      kind: "patch.applied",
      summary: "Applied patch",
      payload: {
        detail: "Applied changes to the workspace.",
        data: part,
      },
      turnId,
      createdAt,
    } as OrchestrationThreadActivity;
  }
  if (part.type === "subtask") {
    return {
      id: EventId.makeUnsafe(id),
      tone: "info",
      kind: "task.completed",
      summary: "Delegated subtask",
      payload: {
        detail: typeof part.metadata === "object" && part.metadata && "description" in part.metadata
          ? (part.metadata as { description?: string }).description
          : undefined,
        data: part,
      },
      turnId,
      createdAt,
    } as OrchestrationThreadActivity;
  }
  return null;
}

function resolveMessageTurnId(message: OpenCodeMessage): OrchestrationThreadActivity["turnId"] {
  const sourceId = message.info.parentID ?? message.info.id;
  return TurnId.makeUnsafe(`opencode-turn-${sourceId}`);
}

function isToolError(part: OpenCodeMessagePart): boolean {
  if (!part.state || typeof part.state !== "object") {
    return false;
  }
  return (part.state as { status?: string }).status === "error";
}

function buildToolActivityPayload(part: OpenCodeMessagePart): Record<string, unknown> {
  const state = part.state && typeof part.state === "object" ? (part.state as Record<string, unknown>) : null;
  return {
    detail: typeof state?.title === "string" ? state.title : undefined,
    data: {
      item: {
        command: typeof state?.command === "string" ? state.command : part.tool,
        result: state,
      },
    },
  };
}

export function resolveProjectIdForSession(
  session: OpenCodeSessionSummary | OpenCodeSession,
  projects: Project[],
): string {
  if (session.projectID && projects.some((project) => project.id === session.projectID)) {
    return session.projectID;
  }
  const cwd = getSessionCwd(session);
  const existing = projects.find((project) => project.cwd === cwd);
  if (existing) {
    return existing.id;
  }
  return syntheticProjectId(session.projectID ?? cwd);
}

export function buildOpenCodeAgentCatalog(
  agents: OpenCodeAgent[] | null | undefined,
): OpenCodeAgentCatalog {
  const visible = (agents ?? []).filter((agent) => agent.mode !== "subagent" && agent.hidden !== true);
  const planAgent = visible.find((agent) => agent.name === "plan")?.name ?? null;
  const defaultAgent =
    visible.find((agent) => agent.name === "build")?.name ??
    visible.find((agent) => agent.name !== planAgent)?.name ??
    visible[0]?.name ??
    null;

  return {
    visible,
    defaultAgent,
    planAgent,
  };
}

export function mapOpenCodeMessage(message: OpenCodeMessage): ChatMessage {
  const completedAt =
    message.info.time.completed ?? message.info.time.end ?? message.info.time.created ?? undefined;
  return {
    id: MessageId.makeUnsafe(message.info.id),
    role: message.info.role,
    text: partsToText(message.parts, message.info.role),
    ...(message.parts.length > 0 ? { structuredParts: message.parts } : {}),
    createdAt: toIso(message.info.time.created),
    ...(typeof completedAt === "number" ? { completedAt: toIso(completedAt) } : {}),
    streaming:
      message.info.role === "assistant" &&
      message.info.time.completed === undefined &&
      message.info.time.end === undefined,
  };
}

function createProject(input: {
  id: string;
  cwd: string;
  name: string;
  existingExpanded?: boolean | undefined;
  scripts: ProjectScript[];
}): Project {
  return {
    id: ProjectId.makeUnsafe(input.id),
    name: input.name,
    cwd: input.cwd,
    model: DEFAULT_MODEL_BY_PROVIDER.codex,
    expanded: input.existingExpanded ?? true,
    scripts: input.scripts,
    source: "opencode",
  };
}

function openCodeStatusToThreadPhase(
  status: OpenCodeRuntimeStatus | undefined,
): "connecting" | "ready" | "running" | "error" | "closed" {
  if (!status) {
    return "ready";
  }
  if (status.type === "busy") {
    return "running";
  }
  if (status.type === "retry") {
    return "connecting";
  }
  return "ready";
}

function resolveThreadModel(input: {
  messages: OpenCodeMessage[];
  providerCatalog?: OpenCodeProviderCatalog | null | undefined;
  provider: string;
}): string {
  const providerModel = resolveCatalogDefaultModel(input.providerCatalog, input.provider);
  if (providerModel) {
    for (let index = input.messages.length - 1; index >= 0; index -= 1) {
      const message = input.messages[index];
      if (!message) {
        continue;
      }
      const modelId = message.info.modelID ?? message.info.model?.modelID;
      if (typeof modelId === "string" && modelId.trim().length > 0) {
        return modelId;
      }
    }
    return providerModel.id;
  }
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (!message) {
      continue;
    }
    const modelId = message.info.modelID ?? message.info.model?.modelID;
    if (typeof modelId === "string" && modelId.trim().length > 0) {
      return modelId;
    }
  }
  return DEFAULT_MODEL_BY_PROVIDER.codex;
}

function resolveThreadProvider(input: {
  session: OpenCodeSessionSummary | OpenCodeSession;
  providerCatalog?: OpenCodeProviderCatalog | null | undefined;
}): string {
  if (input.providerCatalog?.all.length) {
    const connectedProviders = input.providerCatalog.connected
      .map((providerId) => input.providerCatalog?.all.find((provider) => provider.id === providerId))
      .filter((provider): provider is NonNullable<typeof provider> => provider !== undefined);
    if (connectedProviders.length === 1) {
      const connectedProvider = connectedProviders[0];
      return connectedProvider ? connectedProvider.id : "codex";
    }
    const defaultEntry = Object.entries(input.providerCatalog.default)[0];
    if (defaultEntry?.[0]) {
      return defaultEntry[0];
    }
  }
  void input.session;
  return "codex";
}

function resolveCatalogDefaultModel(
  providerCatalog: OpenCodeProviderCatalog | null | undefined,
  provider: string,
): OpenCodeProviderModel | null {
  if (!providerCatalog) {
    return null;
  }
  const providerEntry = providerCatalog.all.find((entry) => entry.id === provider);
  if (!providerEntry) {
    return null;
  }
  const defaultModelId = providerCatalog.default[provider];
  if (typeof defaultModelId === "string") {
    const defaultModel = providerEntry.models[defaultModelId];
    if (defaultModel) {
      return defaultModel;
    }
  }
  return Object.values(providerEntry.models)[0] ?? null;
}

function resolveCatalogModel(input: {
  providerCatalog: OpenCodeProviderCatalog | null | undefined;
  provider: string;
  model: string;
}): OpenCodeProviderModel | null {
  const providerEntry = input.providerCatalog?.all.find((entry) => entry.id === input.provider);
  if (!providerEntry) {
    return null;
  }
  return providerEntry.models[input.model] ?? null;
}

function resolveThreadCapabilities(input: {
  providerCatalog?: OpenCodeProviderCatalog | null | undefined;
  agentCatalog?: OpenCodeAgentCatalog | null | undefined;
  provider: string;
  model: string;
}): Thread["capabilities"] {
  const model = resolveCatalogModel({
    providerCatalog: input.providerCatalog,
    provider: input.provider,
    model: input.model,
  });
  return {
    branchSelection: true,
    composerImages:
      model?.capabilities.attachment === true && model.capabilities.input.image === true,
    diff: true,
    interrupt: true,
    planMode: input.agentCatalog?.planAgent !== null,
    projectScripts: true,
    runtimeMode: true,
  };
}

function resolveThreadRuntimeMode(
  session: Pick<OpenCodeSessionSummary | OpenCodeSession, "permission">,
): Thread["runtimeMode"] {
  const ruleset = session.permission ?? [];
  const hasAllowAll = ruleset.some(
    (rule) => rule.permission === "*" && rule.pattern === "*" && rule.action === "allow",
  );
  return hasAllowAll ? "full-access" : "approval-required";
}

function resolveThreadInteractionMode(
  messages: OpenCodeMessage[],
  agentCatalog?: OpenCodeAgentCatalog | null | undefined,
): Thread["interactionMode"] {
  const planAgent = agentCatalog?.planAgent;
  if (!planAgent) {
    return DEFAULT_INTERACTION_MODE;
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }
    if (message.info.agent === planAgent) {
      return "plan";
    }
    if (typeof message.info.agent === "string" && message.info.agent.trim().length > 0) {
      return "default";
    }
  }
  return DEFAULT_INTERACTION_MODE;
}

function resolveThreadWorktreePath(input: {
  session: OpenCodeSessionSummary | OpenCodeSession;
  projectCwd?: string | undefined;
  messages?: OpenCodeMessage[] | undefined;
}): string | null {
  if (typeof input.session.directory === "string" && input.session.directory.trim().length > 0) {
    return input.session.directory;
  }
  for (let index = (input.messages?.length ?? 0) - 1; index >= 0; index -= 1) {
    const message = input.messages?.[index];
    const root = message?.info.path?.root;
    if (typeof root === "string" && root.trim().length > 0) {
      return root;
    }
  }
  if ("project" in input.session) {
    const worktree = input.session.project?.worktree;
    if (typeof worktree === "string" && worktree.trim().length > 0) {
      return worktree;
    }
  }
  if (typeof input.projectCwd === "string" && input.projectCwd.trim().length > 0) {
    return input.projectCwd;
  }
  return null;
}

function partsToText(parts: readonly OpenCodeMessagePart[], role: ChatMessage["role"]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    const rendered = renderPart(part);
    if (!rendered) {
      continue;
    }
    chunks.push(rendered);
  }
  if (chunks.length > 0) {
    return chunks.join("\n\n");
  }
  if (role === "assistant") {
    return "Working...";
  }
  return "";
}

function renderPart(part: OpenCodeMessagePart): string | null {
  if (part.type === "text") {
    return part.text?.trim().length ? part.text : null;
  }
  return null;
}

function getSessionCwd(session: OpenCodeSessionSummary | OpenCodeSession): string {
  if ("project" in session) {
    return session.project?.worktree ?? session.directory;
  }
  return session.directory;
}

function basename(input: string): string {
  const normalized = input.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || input;
}

function syntheticProjectId(input: string): string {
  return `opencode:${input}`;
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}
