import {
  DEFAULT_MODEL_BY_PROVIDER,
  MessageId,
  type OpenCodeMessage,
  type OpenCodeMessagePart,
  type OpenCodeProject,
  type OpenCodeRuntimeStatus,
  type OpenCodeSession,
  type OpenCodeSessionSummary,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";
import {
  DEFAULT_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  type ChatMessage,
  type Project,
  type Thread,
} from "../types";

export const OPENCODE_THREAD_CAPABILITIES: Thread["capabilities"] = {
  branchSelection: false,
  composerImages: false,
  diff: false,
  interrupt: true,
  planMode: false,
  projectScripts: false,
  runtimeMode: false,
};

export function mapOpenCodeProjects(input: {
  projects: OpenCodeProject[];
  sessions: OpenCodeSessionSummary[];
  existingProjects?: Project[];
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
    }),
  );
  const mappedFallbackProjects = Array.from(fallbackProjects.values()).map((project) =>
    createProject({
      ...project,
      existingExpanded: existingExpandedByCwd.get(project.cwd),
    }),
  );

  return [...mappedProjects, ...mappedFallbackProjects].toSorted((left, right) =>
    right.cwd.localeCompare(left.cwd),
  );
}

export function mapOpenCodeThreadSummary(input: {
  session: OpenCodeSessionSummary | OpenCodeSession;
  projectId: string;
  status: OpenCodeRuntimeStatus | undefined;
}): Thread {
  return {
    id: ThreadId.makeUnsafe(input.session.id),
    codexThreadId: null,
    projectId: ProjectId.makeUnsafe(input.projectId),
    source: "opencode",
    capabilities: OPENCODE_THREAD_CAPABILITIES,
    title: input.session.title.trim().length > 0 ? input.session.title : "New session",
    model: DEFAULT_MODEL_BY_PROVIDER.codex,
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    session: {
      provider: "codex",
      status: openCodeStatusToThreadPhase(input.status),
      orchestrationStatus: input.status?.type === "busy" ? "running" : "ready",
      createdAt: toIso(input.session.time.created),
      updatedAt: toIso(input.session.time.updated),
    },
    messages: [],
    proposedPlans: [],
    error: null,
    createdAt: toIso(input.session.time.created),
    latestTurn: null,
    lastVisitedAt: toIso(input.session.time.updated),
    branch: null,
    worktreePath: null,
    turnDiffSummaries: [],
    activities: [],
  };
}

export function mapOpenCodeThreadDetail(input: {
  session: OpenCodeSession;
  messages: OpenCodeMessage[];
  projectId: string;
  status: OpenCodeRuntimeStatus | undefined;
}): Thread {
  const summary = mapOpenCodeThreadSummary({
    session: input.session,
    projectId: input.projectId,
    status: input.status,
  });
  return {
    ...summary,
    model: resolveThreadModel(input.messages),
    messages: input.messages.map(mapOpenCodeMessage),
    session: summary.session
      ? {
          ...summary.session,
          updatedAt: toIso(input.session.time.updated),
        }
      : null,
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

export function mapOpenCodeMessage(message: OpenCodeMessage): ChatMessage {
  const completedAt =
    message.info.time.completed ?? message.info.time.end ?? message.info.time.created ?? undefined;
  return {
    id: MessageId.makeUnsafe(message.info.id),
    role: message.info.role,
    text: partsToText(message.parts, message.info.role),
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
}): Project {
  return {
    id: ProjectId.makeUnsafe(input.id),
    name: input.name,
    cwd: input.cwd,
    model: DEFAULT_MODEL_BY_PROVIDER.codex,
    expanded: input.existingExpanded ?? true,
    scripts: [],
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

function resolveThreadModel(messages: OpenCodeMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
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
  if (part.type === "tool") {
    const output = extractToolOutput(part.state);
    if (output) {
      return [`Used tool \`${part.tool ?? "unknown"}\`.`, output].join("\n");
    }
    return `Used tool \`${part.tool ?? "unknown"}\`.`;
  }
  if (part.type === "patch") {
    return "Applied a patch.";
  }
  if (part.type === "step-finish") {
    return "Completed a step.";
  }
  if (part.type === "step-start") {
    return null;
  }
  return null;
}

function extractToolOutput(state: unknown): string | null {
  if (!state || typeof state !== "object") {
    return null;
  }
  const output = "output" in state ? state.output : null;
  if (typeof output !== "string") {
    return null;
  }
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length <= 800) {
    return trimmed;
  }
  return `${trimmed.slice(0, 797)}...`;
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
