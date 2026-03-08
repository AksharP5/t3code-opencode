import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ThreadId } from "@t3tools/contracts";
import { buildOpenCodeServerConfigInput, useAppSettings } from "../appSettings";
import type { Project, Thread } from "../types";
import {
  mapOpenCodeProjects,
  mapOpenCodeThreadDetail,
  mapOpenCodeThreadSummary,
  resolveProjectIdForSession,
} from "./mappers";
import {
  opencodeMessagesQueryOptions,
  opencodeProjectsQueryOptions,
  opencodeSessionQueryOptions,
  opencodeSessionsQueryOptions,
  opencodeStatusesQueryOptions,
  opencodeStatusQueryOptions,
} from "./reactQuery";

export function useOpenCodeMode(): boolean {
  const { settings } = useAppSettings();
  return settings.sessionSource === "opencode";
}

export function useOpenCodeThreadSource(threadId?: ThreadId) {
  const { settings } = useAppSettings();
  const config = useMemo(() => buildOpenCodeServerConfigInput(settings), [settings]);
  const statusQuery = useQuery(opencodeStatusQueryOptions(config));
  const projectsQuery = useQuery({
    ...opencodeProjectsQueryOptions(config),
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

  const projects = useMemo<Project[]>(() => {
    return mapOpenCodeProjects({
      projects: projectsQuery.data ?? [],
      sessions: sessionsQuery.data ?? [],
    });
  }, [projectsQuery.data, sessionsQuery.data]);

  const threads = useMemo<Thread[]>(() => {
    return (sessionsQuery.data ?? []).map((session) =>
      mapOpenCodeThreadSummary({
        session,
        projectId: resolveProjectIdForSession(session, projects),
        status: statusesQuery.data?.[session.id],
      }),
    );
  }, [projects, sessionsQuery.data, statusesQuery.data]);

  const activeThread = useMemo(() => {
    if (!threadId || !sessionQuery.data || !messagesQuery.data) {
      return threads.find((thread) => thread.id === threadId) ?? null;
    }
    return mapOpenCodeThreadDetail({
      session: sessionQuery.data,
      messages: messagesQuery.data,
      projectId: resolveProjectIdForSession(sessionQuery.data, projects),
      status: statusesQuery.data?.[sessionQuery.data.id],
    });
  }, [messagesQuery.data, projects, sessionQuery.data, statusesQuery.data, threadId, threads]);

  return {
    config,
    status: statusQuery.data ?? null,
    statusQuery,
    projects,
    threads,
    activeThread,
    threadsHydrated:
      statusQuery.status === "success" && projectsQuery.status !== "pending" && sessionsQuery.status !== "pending",
  } as const;
}
