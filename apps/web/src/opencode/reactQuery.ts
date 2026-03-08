import { queryOptions } from "@tanstack/react-query";
import type {
  OpenCodeGetSessionInput,
  OpenCodeListProjectsInput,
  OpenCodeListSessionsInput,
} from "@t3tools/contracts";
import { ensureNativeApi } from "../nativeApi";

export const opencodeQueryKeys = {
  all: ["opencode"] as const,
  status: (input: OpenCodeListProjectsInput) => ["opencode", "status", input] as const,
  projects: (input: OpenCodeListProjectsInput) => ["opencode", "projects", input] as const,
  sessions: (input: OpenCodeListSessionsInput) => ["opencode", "sessions", input] as const,
  session: (input: OpenCodeGetSessionInput) => ["opencode", "session", input] as const,
  messages: (input: OpenCodeGetSessionInput) => ["opencode", "messages", input] as const,
  statuses: (input: OpenCodeListProjectsInput) => ["opencode", "statuses", input] as const,
};

export function opencodeStatusQueryOptions(input: OpenCodeListProjectsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.status(input),
    queryFn: async () => ensureNativeApi().opencode.getStatus(input),
    staleTime: 10_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function opencodeProjectsQueryOptions(input: OpenCodeListProjectsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.projects(input),
    queryFn: async () => ensureNativeApi().opencode.listProjects(input),
    staleTime: 30_000,
    refetchOnReconnect: true,
  });
}

export function opencodeSessionsQueryOptions(input: OpenCodeListSessionsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.sessions(input),
    queryFn: async () => ensureNativeApi().opencode.listSessions(input),
    staleTime: 10_000,
    refetchOnReconnect: true,
  });
}

export function opencodeSessionQueryOptions(input: OpenCodeGetSessionInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.session(input),
    queryFn: async () => ensureNativeApi().opencode.getSession(input),
    staleTime: 5_000,
    refetchOnReconnect: true,
  });
}

export function opencodeMessagesQueryOptions(input: OpenCodeGetSessionInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.messages(input),
    queryFn: async () => ensureNativeApi().opencode.getMessages(input),
    staleTime: 0,
    refetchOnReconnect: true,
  });
}

export function opencodeStatusesQueryOptions(input: OpenCodeListProjectsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.statuses(input),
    queryFn: async () => ensureNativeApi().opencode.getStatuses(input),
    staleTime: 2_000,
    refetchOnReconnect: true,
    refetchInterval: 2_000,
  });
}
