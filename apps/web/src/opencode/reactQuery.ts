import { queryOptions } from "@tanstack/react-query";
import type {
  OpenCodeGetDiffInput,
  OpenCodeGetVcsInput,
  OpenCodeGetSessionInput,
  OpenCodeGetTodoInput,
  OpenCodeListAgentsInput,
  OpenCodeListMcpServersInput,
  OpenCodeListProviderAuthMethodsInput,
  OpenCodeListPermissionsInput,
  OpenCodeListQuestionsInput,
  OpenCodeListProvidersInput,
  OpenCodeListProjectsInput,
  OpenCodeListSessionsInput,
} from "@t3tools/contracts";
import { ensureNativeApi } from "../nativeApi";

export const opencodeQueryKeys = {
  all: ["opencode"] as const,
  status: (input: OpenCodeListProjectsInput) => ["opencode", "status", input] as const,
  providers: (input: OpenCodeListProvidersInput) => ["opencode", "providers", input] as const,
  providerAuthMethods: (input: OpenCodeListProviderAuthMethodsInput) => ["opencode", "providerAuthMethods", input] as const,
  mcpServers: (input: OpenCodeListMcpServersInput) => ["opencode", "mcpServers", input] as const,
  agents: (input: OpenCodeListAgentsInput) => ["opencode", "agents", input] as const,
  projects: (input: OpenCodeListProjectsInput) => ["opencode", "projects", input] as const,
  sessions: (input: OpenCodeListSessionsInput) => ["opencode", "sessions", input] as const,
  session: (input: OpenCodeGetSessionInput) => ["opencode", "session", input] as const,
  messages: (input: OpenCodeGetSessionInput) => ["opencode", "messages", input] as const,
  diff: (input: OpenCodeGetDiffInput) => ["opencode", "diff", input] as const,
  todo: (input: OpenCodeGetTodoInput) => ["opencode", "todo", input] as const,
  statuses: (input: OpenCodeListProjectsInput) => ["opencode", "statuses", input] as const,
  permissions: (input: OpenCodeListPermissionsInput) => ["opencode", "permissions", input] as const,
  questions: (input: OpenCodeListQuestionsInput) => ["opencode", "questions", input] as const,
  vcs: (input: OpenCodeGetVcsInput) => ["opencode", "vcs", input] as const,
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

export function opencodeAgentsQueryOptions(input: OpenCodeListAgentsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.agents(input),
    queryFn: async () => ensureNativeApi().opencode.listAgents(input),
    staleTime: 30_000,
    refetchOnReconnect: true,
  });
}

export function opencodeProvidersQueryOptions(input: OpenCodeListProvidersInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.providers(input),
    queryFn: async () => ensureNativeApi().opencode.listProviders(input),
    staleTime: 30_000,
    refetchOnReconnect: true,
  });
}

export function opencodeProviderAuthMethodsQueryOptions(input: OpenCodeListProviderAuthMethodsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.providerAuthMethods(input),
    queryFn: async () => ensureNativeApi().opencode.listProviderAuthMethods(input),
    staleTime: 30_000,
    refetchOnReconnect: true,
  });
}

export function opencodeMcpServersQueryOptions(input: OpenCodeListMcpServersInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.mcpServers(input),
    queryFn: async () => ensureNativeApi().opencode.listMcpServers(input),
    staleTime: 5_000,
    refetchOnReconnect: true,
    refetchInterval: 5_000,
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

export function opencodeTodoQueryOptions(input: OpenCodeGetTodoInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.todo(input),
    queryFn: async () => ensureNativeApi().opencode.getTodo(input),
    staleTime: 0,
    refetchOnReconnect: true,
    refetchInterval: 2_000,
  });
}

export function opencodeDiffQueryOptions(input: OpenCodeGetDiffInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.diff(input),
    queryFn: async () => ensureNativeApi().opencode.getDiff(input),
    staleTime: 0,
    refetchOnReconnect: true,
    refetchInterval: 2_000,
  });
}

export function opencodePermissionsQueryOptions(input: OpenCodeListPermissionsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.permissions(input),
    queryFn: async () => ensureNativeApi().opencode.listPermissions(input),
    staleTime: 0,
    refetchOnReconnect: true,
    refetchInterval: 2_000,
  });
}

export function opencodeQuestionsQueryOptions(input: OpenCodeListQuestionsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.questions(input),
    queryFn: async () => ensureNativeApi().opencode.listQuestions(input),
    staleTime: 0,
    refetchOnReconnect: true,
    refetchInterval: 2_000,
  });
}

export function opencodeVcsQueryOptions(input: OpenCodeGetVcsInput) {
  return queryOptions({
    queryKey: opencodeQueryKeys.vcs(input),
    queryFn: async () => ensureNativeApi().opencode.getVcs(input),
    staleTime: 5_000,
    refetchOnReconnect: true,
  });
}
