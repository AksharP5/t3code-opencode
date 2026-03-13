import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ThreadId } from "@t3tools/contracts";
import { buildOpenCodeServerConfigInput, useAppSettings } from "../appSettings";
import type { Project, Thread, TurnDiffSummary } from "../types";
import { useOpenCodeEventActivityStore } from "./eventActivityStore";
import {
  buildOpenCodeAgentCatalog,
  mapOpenCodeProjects,
  mapOpenCodeThreadDetail,
  mapOpenCodeThreadSummary,
  resolveProjectIdForSession,
} from "./mappers";
import { useOpenCodeProjectOverlayStore } from "./projectOverlayStore";
import {
  opencodeAgentsQueryOptions,
  opencodeCommandsQueryOptions,
  opencodeDiffQueryOptions,
  opencodePermissionsQueryOptions,
  opencodeQuestionsQueryOptions,
  opencodeMessagesQueryOptions,
  opencodeProvidersQueryOptions,
  opencodeProjectsQueryOptions,
  opencodeResourcesQueryOptions,
  opencodeSessionQueryOptions,
  opencodeSessionsQueryOptions,
  opencodeStatusesQueryOptions,
  opencodeStatusQueryOptions,
  opencodeTodoQueryOptions,
  opencodeVcsQueryOptions,
} from "./reactQuery";
import { useOpenCodeOverlayStore } from "./overlayStore";

export function useOpenCodeThreadSource(threadId?: ThreadId) {
  const { settings } = useAppSettings();
  const config = useMemo(() => buildOpenCodeServerConfigInput(settings), [settings]);
  const lastVisitedAtByThreadId = useOpenCodeOverlayStore((store) => store.lastVisitedAtByThreadId);
  const scriptsByProjectCwd = useOpenCodeProjectOverlayStore((store) => store.scriptsByProjectCwd);
  const activitiesByThreadId = useOpenCodeEventActivityStore((store) => store.activitiesByThreadId);
  const statusQuery = useQuery({
    ...opencodeStatusQueryOptions(config),
    enabled: true,
  });
  const openCodeQueriesEnabled = statusQuery.data?.healthy !== false;
  const projectsQuery = useQuery({
    ...opencodeProjectsQueryOptions(config),
    enabled: openCodeQueriesEnabled,
  });
  const providersQuery = useQuery({
    ...opencodeProvidersQueryOptions(config),
    enabled: openCodeQueriesEnabled,
  });
  const commandsQuery = useQuery({
    ...opencodeCommandsQueryOptions(config),
    enabled: openCodeQueriesEnabled,
  });
  const resourcesQuery = useQuery({
    ...opencodeResourcesQueryOptions(config),
    enabled: openCodeQueriesEnabled,
  });
  const agentsQuery = useQuery({
    ...opencodeAgentsQueryOptions(config),
    enabled: openCodeQueriesEnabled,
  });
  const sessionsQuery = useQuery({
    ...opencodeSessionsQueryOptions({ ...config, limit: 1000 }),
    enabled: openCodeQueriesEnabled,
  });
  const statusesQuery = useQuery({
    ...opencodeStatusesQueryOptions(config),
    enabled: openCodeQueriesEnabled,
  });
  const sessionQuery = useQuery({
    ...opencodeSessionQueryOptions({ ...config, sessionId: threadId ?? "missing" }),
    enabled: openCodeQueriesEnabled && threadId !== undefined,
  });
  const messagesQuery = useQuery({
    ...opencodeMessagesQueryOptions({ ...config, sessionId: threadId ?? "missing" }),
    enabled: openCodeQueriesEnabled && threadId !== undefined,
    refetchInterval: () => {
      if (!threadId) {
        return false;
      }
      const status = statusesQuery.data?.[threadId];
      return status?.type === "busy" ? 1_000 : false;
    },
  });
  const permissionsQuery = useQuery({
    ...opencodePermissionsQueryOptions(config),
    enabled: openCodeQueriesEnabled,
  });
  const questionsQuery = useQuery({
    ...opencodeQuestionsQueryOptions(config),
    enabled: openCodeQueriesEnabled,
  });
  const todoQuery = useQuery({
    ...opencodeTodoQueryOptions({ ...config, sessionId: threadId ?? "missing" }),
    enabled: openCodeQueriesEnabled && threadId !== undefined,
  });
  const diffQuery = useQuery({
    ...opencodeDiffQueryOptions({ ...config, sessionId: threadId ?? "missing" }),
    enabled: openCodeQueriesEnabled && threadId !== undefined,
  });
  const agentCatalog = useMemo(
    () => buildOpenCodeAgentCatalog(agentsQuery.data),
    [agentsQuery.data],
  );

  const projects = useMemo<Project[]>(() => {
    return mapOpenCodeProjects({
      projects: projectsQuery.data ?? [],
      sessions: sessionsQuery.data ?? [],
      scriptsByProjectCwd,
    });
  }, [projectsQuery.data, scriptsByProjectCwd, sessionsQuery.data]);

  const threads = useMemo<Thread[]>(() => {
    return (sessionsQuery.data ?? []).map((session) =>
      mapOpenCodeThreadSummary({
        session,
        projectId: resolveProjectIdForSession(session, projects),
        projectCwd: projects.find(
          (project) => project.id === resolveProjectIdForSession(session, projects),
        )?.cwd,
        status: statusesQuery.data?.[session.id],
        lastVisitedAt: lastVisitedAtByThreadId[ThreadId.makeUnsafe(session.id)],
        providerCatalog: providersQuery.data,
        agentCatalog,
        activities: activitiesByThreadId[ThreadId.makeUnsafe(session.id)] ?? [],
      }),
    );
  }, [
    activitiesByThreadId,
    agentCatalog,
    lastVisitedAtByThreadId,
    projects,
    providersQuery.data,
    sessionsQuery.data,
    statusesQuery.data,
  ]);

  const activeProjectId = useMemo(() => {
    if (!sessionQuery.data) {
      return threadId ? threads.find((thread) => thread.id === threadId)?.projectId : undefined;
    }
    return resolveProjectIdForSession(sessionQuery.data, projects);
  }, [projects, sessionQuery.data, threadId, threads]);

  const activeProject = useMemo(
    () =>
      activeProjectId ? (projects.find((project) => project.id === activeProjectId) ?? null) : null,
    [activeProjectId, projects],
  );
  const activeSessionDirectory = useMemo(() => {
    if (sessionQuery.data?.directory) {
      return sessionQuery.data.directory;
    }
    const summaryThread = threadId ? threads.find((thread) => thread.id === threadId) : null;
    return summaryThread?.worktreePath ?? activeProject?.cwd ?? null;
  }, [activeProject?.cwd, sessionQuery.data?.directory, threadId, threads]);

  const vcsQuery = useQuery({
    ...opencodeVcsQueryOptions({ ...config, directory: activeSessionDirectory ?? "missing" }),
    enabled: openCodeQueriesEnabled && activeSessionDirectory !== null,
  });

  const activeThread = useMemo(() => {
    if (!threadId || !sessionQuery.data || !messagesQuery.data) {
      const thread = threads.find((candidate) => candidate.id === threadId) ?? null;
      if (!thread) {
        return null;
      }
      return vcsQuery.data ? { ...thread, branch: vcsQuery.data.branch } : thread;
    }
    return mapOpenCodeThreadDetail({
      session: sessionQuery.data,
      messages: messagesQuery.data,
      projectId: resolveProjectIdForSession(sessionQuery.data, projects),
      projectCwd: activeSessionDirectory ?? activeProject?.cwd ?? undefined,
      status: statusesQuery.data?.[sessionQuery.data.id],
      lastVisitedAt: lastVisitedAtByThreadId[ThreadId.makeUnsafe(sessionQuery.data.id)],
      providerCatalog: providersQuery.data,
      branch: vcsQuery.data?.branch ?? null,
      agentCatalog,
      activities: activitiesByThreadId[ThreadId.makeUnsafe(sessionQuery.data.id)] ?? [],
    });
  }, [
    activitiesByThreadId,
    agentCatalog,
    activeProject?.cwd,
    activeSessionDirectory,
    lastVisitedAtByThreadId,
    messagesQuery.data,
    projects,
    providersQuery.data,
    sessionQuery.data,
    statusesQuery.data,
    threadId,
    threads,
    vcsQuery.data,
  ]);
  const activeThreadHydrated =
    threadId === undefined ||
    (sessionQuery.status === "success" && messagesQuery.status === "success");
  const activeThreadLoadError =
    threadId === undefined
      ? null
      : ((sessionQuery.error instanceof Error ? sessionQuery.error.message : null) ??
        (messagesQuery.error instanceof Error ? messagesQuery.error.message : null));

  const activeThreadWithDiff = useMemo(() => {
    const activeDiff = diffQuery.data ?? [];
    if (
      !activeThread ||
      activeThread.turnDiffSummaries.length > 0 ||
      activeDiff.length === 0 ||
      !activeThread.latestTurn?.turnId
    ) {
      return activeThread;
    }

    const completedAt =
      activeThread.latestTurn.completedAt ??
      activeThread.latestTurn.startedAt ??
      activeThread.createdAt;
    const summary: TurnDiffSummary = {
      turnId: activeThread.latestTurn.turnId,
      completedAt,
      assistantMessageId: activeThread.latestTurn.assistantMessageId ?? undefined,
      files: activeDiff.map((file) => ({
        path: file.file,
        kind: file.status,
        additions: file.additions,
        deletions: file.deletions,
      })),
    };

    return {
      ...activeThread,
      turnDiffSummaries: [summary],
    } satisfies Thread;
  }, [activeThread, diffQuery.data]);

  return {
    config,
    status: statusQuery.data ?? null,
    statusQuery,
    agentCatalog,
    providerCatalog: providersQuery.data ?? null,
    providerCatalogStatus: providersQuery.status,
    providerCatalogError: providersQuery.error instanceof Error ? providersQuery.error.message : null,
    commands: commandsQuery.data ?? [],
    resources: resourcesQuery.data ?? {},
    pendingPermissions: permissionsQuery.data ?? [],
    pendingQuestions: questionsQuery.data ?? [],
    activeTodos: todoQuery.data ?? [],
    activeDiff: diffQuery.data ?? [],
    projects,
    threads,
    activeThread: activeThreadWithDiff,
    activeThreadHydrated,
    activeThreadLoadError,
    threadsHydrated:
      statusQuery.status === "success" &&
      projectsQuery.status !== "pending" &&
      sessionsQuery.status !== "pending",
  } as const;
}
