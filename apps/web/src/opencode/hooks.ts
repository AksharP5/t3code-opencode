import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ThreadId } from "@t3tools/contracts";
import { buildOpenCodeServerConfigInput, useAppSettings } from "../appSettings";
import type { Project, Thread } from "../types";
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
  opencodeDiffQueryOptions,
  opencodePermissionsQueryOptions,
  opencodeMessagesQueryOptions,
  opencodeProvidersQueryOptions,
  opencodeProjectsQueryOptions,
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
  const projectsQuery = useQuery({
    ...opencodeProjectsQueryOptions(config),
    enabled: statusQuery.data?.healthy === true,
  });
  const providersQuery = useQuery({
    ...opencodeProvidersQueryOptions(config),
    enabled: statusQuery.data?.healthy === true,
  });
  const agentsQuery = useQuery({
    ...opencodeAgentsQueryOptions(config),
    enabled: statusQuery.data?.healthy === true,
  });
  const sessionsQuery = useQuery({
    ...opencodeSessionsQueryOptions({ ...config, roots: true, limit: 200 }),
    enabled: statusQuery.data?.healthy === true,
  });
  const statusesQuery = useQuery({
    ...opencodeStatusesQueryOptions(config),
    enabled: statusQuery.data?.healthy === true,
  });
  const sessionQuery = useQuery({
    ...opencodeSessionQueryOptions({ ...config, sessionId: threadId ?? "missing" }),
    enabled: statusQuery.data?.healthy === true && threadId !== undefined,
  });
  const messagesQuery = useQuery({
    ...opencodeMessagesQueryOptions({ ...config, sessionId: threadId ?? "missing" }),
    enabled: statusQuery.data?.healthy === true && threadId !== undefined,
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
    enabled: statusQuery.data?.healthy === true,
  });
  const todoQuery = useQuery({
    ...opencodeTodoQueryOptions({ ...config, sessionId: threadId ?? "missing" }),
    enabled: statusQuery.data?.healthy === true && threadId !== undefined,
  });
  const diffQuery = useQuery({
    ...opencodeDiffQueryOptions({ ...config, sessionId: threadId ?? "missing" }),
    enabled: statusQuery.data?.healthy === true && threadId !== undefined,
  });
  const agentCatalog = useMemo(() => buildOpenCodeAgentCatalog(agentsQuery.data), [agentsQuery.data]);

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
          projectCwd: projects.find((project) => project.id === resolveProjectIdForSession(session, projects))?.cwd,
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
    () => (activeProjectId ? projects.find((project) => project.id === activeProjectId) ?? null : null),
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
    enabled: statusQuery.data?.healthy === true && activeSessionDirectory !== null,
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

  return {
    config,
    status: statusQuery.data ?? null,
    statusQuery,
    agentCatalog,
    providerCatalog: providersQuery.data ?? null,
    pendingPermissions: permissionsQuery.data ?? [],
    activeTodos: todoQuery.data ?? [],
    activeDiff: diffQuery.data ?? [],
    projects,
    threads,
    activeThread,
    threadsHydrated:
      statusQuery.status === "success" &&
      projectsQuery.status !== "pending" &&
      sessionsQuery.status !== "pending",
  } as const;
}
