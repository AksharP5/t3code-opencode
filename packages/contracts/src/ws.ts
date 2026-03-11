import { Schema, Struct } from "effect";
import { NonNegativeInt, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas";

import {
  ClientOrchestrationCommand,
  OrchestrationEvent,
  ORCHESTRATION_WS_CHANNELS,
  OrchestrationGetFullThreadDiffInput,
  ORCHESTRATION_WS_METHODS,
  OrchestrationGetSnapshotInput,
  OrchestrationGetTurnDiffInput,
  OrchestrationReplayEventsInput,
} from "./orchestration";
import {
  GitCheckoutInput,
  GitCreateBranchInput,
  GitPreparePullRequestThreadInput,
  GitCreateWorktreeInput,
  GitInitInput,
  GitListBranchesInput,
  GitPullInput,
  GitPullRequestRefInput,
  GitRemoveWorktreeInput,
  GitRunStackedActionInput,
  GitStatusInput,
} from "./git";
import {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalRestartInput,
  TerminalWriteInput,
} from "./terminal";
import { KeybindingRule } from "./keybindings";
import { ProjectSearchEntriesInput, ProjectWriteFileInput } from "./project";
import { OpenInEditorInput } from "./editor";
import { ServerConfigUpdatedPayload } from "./server";
import {
  OpenCodeEvent,
  OpenCodeListAgentsInput,
  OpenCodeAbortSessionInput,
  OpenCodeCreateSessionInput,
  OpenCodeDeleteSessionInput,
  OpenCodeForkSessionInput,
  OpenCodeGetDiffInput,
  OpenCodeGetTodoInput,
  OpenCodeGetVcsInput,
  OpenCodeGetSessionInput,
  OpenCodeListPermissionsInput,
  OpenCodeListQuestionsInput,
  OpenCodeListProvidersInput,
  OpenCodeListProviderAuthMethodsInput,
  OpenCodeListMcpServersInput,
  OpenCodeListCommandsInput,
  OpenCodeListResourcesInput,
  OpenCodeListProjectsInput,
  OpenCodeListSessionsInput,
  OpenCodeCompleteProviderAuthInput,
  OpenCodeCompleteMcpAuthInput,
  OpenCodeReplyPermissionInput,
  OpenCodeReplyQuestionInput,
  OpenCodeRejectQuestionInput,
  OpenCodeRevertSessionInput,
  OpenCodeAuthorizeProviderInput,
  OpenCodeRemoveProviderAuthInput,
  OpenCodeRemoveMcpAuthInput,
  OpenCodeShareSessionInput,
  OpenCodeSendMessageInput,
  OpenCodeSetProviderApiKeyInput,
  OpenCodeStartMcpAuthInput,
  OpenCodeSummarizeSessionInput,
  OpenCodeUnrevertSessionInput,
  OpenCodeUnshareSessionInput,
  OpenCodeUpdateSessionInput,
  OpenCodeAuthenticateMcpInput,
  OpenCodeConnectMcpInput,
  OpenCodeDisconnectMcpInput,
  OpenCodeRunCommandInput,
} from "./opencode";

// ── WebSocket RPC Method Names ───────────────────────────────────────

export const WS_METHODS = {
  // Project registry methods
  projectsList: "projects.list",
  projectsAdd: "projects.add",
  projectsRemove: "projects.remove",
  projectsSearchEntries: "projects.searchEntries",
  projectsWriteFile: "projects.writeFile",

  // Shell methods
  shellOpenInEditor: "shell.openInEditor",

  // Git methods
  gitPull: "git.pull",
  gitStatus: "git.status",
  gitRunStackedAction: "git.runStackedAction",
  gitListBranches: "git.listBranches",
  gitCreateWorktree: "git.createWorktree",
  gitRemoveWorktree: "git.removeWorktree",
  gitCreateBranch: "git.createBranch",
  gitCheckout: "git.checkout",
  gitInit: "git.init",
  gitResolvePullRequest: "git.resolvePullRequest",
  gitPreparePullRequestThread: "git.preparePullRequestThread",

  // Terminal methods
  terminalOpen: "terminal.open",
  terminalWrite: "terminal.write",
  terminalResize: "terminal.resize",
  terminalClear: "terminal.clear",
  terminalRestart: "terminal.restart",
  terminalClose: "terminal.close",

  // Server meta
  serverGetConfig: "server.getConfig",
  serverUpsertKeybinding: "server.upsertKeybinding",

  // OpenCode methods
  opencodeGetStatus: "opencode.getStatus",
  opencodeEnsureServer: "opencode.ensureServer",
  opencodeListProviders: "opencode.listProviders",
  opencodeListProviderAuthMethods: "opencode.listProviderAuthMethods",
  opencodeListMcpServers: "opencode.listMcpServers",
  opencodeListCommands: "opencode.listCommands",
  opencodeListResources: "opencode.listResources",
  opencodeListAgents: "opencode.listAgents",
  opencodeListProjects: "opencode.listProjects",
  opencodeListSessions: "opencode.listSessions",
  opencodeGetSession: "opencode.getSession",
  opencodeGetMessages: "opencode.getMessages",
  opencodeGetDiff: "opencode.getDiff",
  opencodeGetTodo: "opencode.getTodo",
  opencodeGetStatuses: "opencode.getStatuses",
  opencodeListPermissions: "opencode.listPermissions",
  opencodeListQuestions: "opencode.listQuestions",
  opencodeReplyPermission: "opencode.replyPermission",
  opencodeReplyQuestion: "opencode.replyQuestion",
  opencodeRejectQuestion: "opencode.rejectQuestion",
  opencodeRevertSession: "opencode.revertSession",
  opencodeSetProviderApiKey: "opencode.setProviderApiKey",
  opencodeRemoveProviderAuth: "opencode.removeProviderAuth",
  opencodeAuthorizeProvider: "opencode.authorizeProvider",
  opencodeCompleteProviderAuth: "opencode.completeProviderAuth",
  opencodeStartMcpAuth: "opencode.startMcpAuth",
  opencodeCompleteMcpAuth: "opencode.completeMcpAuth",
  opencodeAuthenticateMcp: "opencode.authenticateMcp",
  opencodeRemoveMcpAuth: "opencode.removeMcpAuth",
  opencodeConnectMcp: "opencode.connectMcp",
  opencodeDisconnectMcp: "opencode.disconnectMcp",
  opencodeRunCommand: "opencode.runCommand",
  opencodeSummarizeSession: "opencode.summarizeSession",
  opencodeShareSession: "opencode.shareSession",
  opencodeUnshareSession: "opencode.unshareSession",
  opencodeUnrevertSession: "opencode.unrevertSession",
  opencodeGetVcs: "opencode.getVcs",
  opencodeCreateSession: "opencode.createSession",
  opencodeSendMessage: "opencode.sendMessage",
  opencodeAbortSession: "opencode.abortSession",
  opencodeUpdateSession: "opencode.updateSession",
  opencodeDeleteSession: "opencode.deleteSession",
  opencodeForkSession: "opencode.forkSession",
} as const;

// ── Push Event Channels ──────────────────────────────────────────────

export const WS_CHANNELS = {
  terminalEvent: "terminal.event",
  serverWelcome: "server.welcome",
  serverConfigUpdated: "server.configUpdated",
  opencodeEvent: "opencode.event",
} as const;

// -- Tagged Union of all request body schemas ─────────────────────────

const tagRequestBody = <const Tag extends string, const Fields extends Schema.Struct.Fields>(
  tag: Tag,
  schema: Schema.Struct<Fields>,
) =>
  schema.mapFields(
    Struct.assign({ _tag: Schema.tag(tag) }),
    // PreserveChecks is safe here. No existing schema should have checks depending on the tag
    { unsafePreserveChecks: true },
  );

const WebSocketRequestBody = Schema.Union([
  // Orchestration methods
  tagRequestBody(
    ORCHESTRATION_WS_METHODS.dispatchCommand,
    Schema.Struct({ command: ClientOrchestrationCommand }),
  ),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getSnapshot, OrchestrationGetSnapshotInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getTurnDiff, OrchestrationGetTurnDiffInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getFullThreadDiff, OrchestrationGetFullThreadDiffInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.replayEvents, OrchestrationReplayEventsInput),

  // Project Search
  tagRequestBody(WS_METHODS.projectsSearchEntries, ProjectSearchEntriesInput),
  tagRequestBody(WS_METHODS.projectsWriteFile, ProjectWriteFileInput),

  // Shell methods
  tagRequestBody(WS_METHODS.shellOpenInEditor, OpenInEditorInput),

  // Git methods
  tagRequestBody(WS_METHODS.gitPull, GitPullInput),
  tagRequestBody(WS_METHODS.gitStatus, GitStatusInput),
  tagRequestBody(WS_METHODS.gitRunStackedAction, GitRunStackedActionInput),
  tagRequestBody(WS_METHODS.gitListBranches, GitListBranchesInput),
  tagRequestBody(WS_METHODS.gitCreateWorktree, GitCreateWorktreeInput),
  tagRequestBody(WS_METHODS.gitRemoveWorktree, GitRemoveWorktreeInput),
  tagRequestBody(WS_METHODS.gitCreateBranch, GitCreateBranchInput),
  tagRequestBody(WS_METHODS.gitCheckout, GitCheckoutInput),
  tagRequestBody(WS_METHODS.gitInit, GitInitInput),
  tagRequestBody(WS_METHODS.gitResolvePullRequest, GitPullRequestRefInput),
  tagRequestBody(WS_METHODS.gitPreparePullRequestThread, GitPreparePullRequestThreadInput),

  // Terminal methods
  tagRequestBody(WS_METHODS.terminalOpen, TerminalOpenInput),
  tagRequestBody(WS_METHODS.terminalWrite, TerminalWriteInput),
  tagRequestBody(WS_METHODS.terminalResize, TerminalResizeInput),
  tagRequestBody(WS_METHODS.terminalClear, TerminalClearInput),
  tagRequestBody(WS_METHODS.terminalRestart, TerminalRestartInput),
  tagRequestBody(WS_METHODS.terminalClose, TerminalCloseInput),

  // Server meta
  tagRequestBody(WS_METHODS.serverGetConfig, Schema.Struct({})),
  tagRequestBody(WS_METHODS.serverUpsertKeybinding, KeybindingRule),

  // OpenCode methods
  tagRequestBody(WS_METHODS.opencodeGetStatus, OpenCodeListProjectsInput),
  tagRequestBody(WS_METHODS.opencodeEnsureServer, OpenCodeListProjectsInput),
  tagRequestBody(WS_METHODS.opencodeListProviders, OpenCodeListProvidersInput),
  tagRequestBody(WS_METHODS.opencodeListProviderAuthMethods, OpenCodeListProviderAuthMethodsInput),
  tagRequestBody(WS_METHODS.opencodeListMcpServers, OpenCodeListMcpServersInput),
  tagRequestBody(WS_METHODS.opencodeListCommands, OpenCodeListCommandsInput),
  tagRequestBody(WS_METHODS.opencodeListResources, OpenCodeListResourcesInput),
  tagRequestBody(WS_METHODS.opencodeListAgents, OpenCodeListAgentsInput),
  tagRequestBody(WS_METHODS.opencodeListProjects, OpenCodeListProjectsInput),
  tagRequestBody(WS_METHODS.opencodeListSessions, OpenCodeListSessionsInput),
  tagRequestBody(WS_METHODS.opencodeGetSession, OpenCodeGetSessionInput),
  tagRequestBody(WS_METHODS.opencodeGetMessages, OpenCodeGetSessionInput),
  tagRequestBody(WS_METHODS.opencodeGetDiff, OpenCodeGetDiffInput),
  tagRequestBody(WS_METHODS.opencodeGetTodo, OpenCodeGetTodoInput),
  tagRequestBody(WS_METHODS.opencodeGetStatuses, OpenCodeListProjectsInput),
  tagRequestBody(WS_METHODS.opencodeListPermissions, OpenCodeListPermissionsInput),
  tagRequestBody(WS_METHODS.opencodeListQuestions, OpenCodeListQuestionsInput),
  tagRequestBody(WS_METHODS.opencodeReplyPermission, OpenCodeReplyPermissionInput),
  tagRequestBody(WS_METHODS.opencodeReplyQuestion, OpenCodeReplyQuestionInput),
  tagRequestBody(WS_METHODS.opencodeRejectQuestion, OpenCodeRejectQuestionInput),
  tagRequestBody(WS_METHODS.opencodeRevertSession, OpenCodeRevertSessionInput),
  tagRequestBody(WS_METHODS.opencodeSetProviderApiKey, OpenCodeSetProviderApiKeyInput),
  tagRequestBody(WS_METHODS.opencodeRemoveProviderAuth, OpenCodeRemoveProviderAuthInput),
  tagRequestBody(WS_METHODS.opencodeAuthorizeProvider, OpenCodeAuthorizeProviderInput),
  tagRequestBody(WS_METHODS.opencodeCompleteProviderAuth, OpenCodeCompleteProviderAuthInput),
  tagRequestBody(WS_METHODS.opencodeStartMcpAuth, OpenCodeStartMcpAuthInput),
  tagRequestBody(WS_METHODS.opencodeCompleteMcpAuth, OpenCodeCompleteMcpAuthInput),
  tagRequestBody(WS_METHODS.opencodeAuthenticateMcp, OpenCodeAuthenticateMcpInput),
  tagRequestBody(WS_METHODS.opencodeRemoveMcpAuth, OpenCodeRemoveMcpAuthInput),
  tagRequestBody(WS_METHODS.opencodeConnectMcp, OpenCodeConnectMcpInput),
  tagRequestBody(WS_METHODS.opencodeDisconnectMcp, OpenCodeDisconnectMcpInput),
  tagRequestBody(WS_METHODS.opencodeRunCommand, OpenCodeRunCommandInput),
  tagRequestBody(WS_METHODS.opencodeSummarizeSession, OpenCodeSummarizeSessionInput),
  tagRequestBody(WS_METHODS.opencodeShareSession, OpenCodeShareSessionInput),
  tagRequestBody(WS_METHODS.opencodeUnshareSession, OpenCodeUnshareSessionInput),
  tagRequestBody(WS_METHODS.opencodeUnrevertSession, OpenCodeUnrevertSessionInput),
  tagRequestBody(WS_METHODS.opencodeGetVcs, OpenCodeGetVcsInput),
  tagRequestBody(WS_METHODS.opencodeCreateSession, OpenCodeCreateSessionInput),
  tagRequestBody(WS_METHODS.opencodeSendMessage, OpenCodeSendMessageInput),
  tagRequestBody(WS_METHODS.opencodeAbortSession, OpenCodeAbortSessionInput),
  tagRequestBody(WS_METHODS.opencodeUpdateSession, OpenCodeUpdateSessionInput),
  tagRequestBody(WS_METHODS.opencodeDeleteSession, OpenCodeDeleteSessionInput),
  tagRequestBody(WS_METHODS.opencodeForkSession, OpenCodeForkSessionInput),
]);

export const WebSocketRequest = Schema.Struct({
  id: TrimmedNonEmptyString,
  body: WebSocketRequestBody,
});
export type WebSocketRequest = typeof WebSocketRequest.Type;

export const WebSocketResponse = Schema.Struct({
  id: TrimmedNonEmptyString,
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(
    Schema.Struct({
      message: Schema.String,
    }),
  ),
});
export type WebSocketResponse = typeof WebSocketResponse.Type;

export const WsPushSequence = NonNegativeInt;
export type WsPushSequence = typeof WsPushSequence.Type;

export const WsWelcomePayload = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  projectName: TrimmedNonEmptyString,
  bootstrapProjectId: Schema.optional(ProjectId),
  bootstrapThreadId: Schema.optional(ThreadId),
});
export type WsWelcomePayload = typeof WsWelcomePayload.Type;

export interface WsPushPayloadByChannel {
  readonly [WS_CHANNELS.serverWelcome]: WsWelcomePayload;
  readonly [WS_CHANNELS.serverConfigUpdated]: typeof ServerConfigUpdatedPayload.Type;
  readonly [WS_CHANNELS.terminalEvent]: typeof TerminalEvent.Type;
  readonly [WS_CHANNELS.opencodeEvent]: OpenCodeEvent;
  readonly [ORCHESTRATION_WS_CHANNELS.domainEvent]: OrchestrationEvent;
}

export type WsPushChannel = keyof WsPushPayloadByChannel;
export type WsPushData<C extends WsPushChannel> = WsPushPayloadByChannel[C];

const makeWsPushSchema = <const Channel extends string, Payload extends Schema.Schema<any>>(
  channel: Channel,
  payload: Payload,
) =>
  Schema.Struct({
    type: Schema.Literal("push"),
    sequence: WsPushSequence,
    channel: Schema.Literal(channel),
    data: payload,
  });

export const WsPushServerWelcome = makeWsPushSchema(WS_CHANNELS.serverWelcome, WsWelcomePayload);
export const WsPushServerConfigUpdated = makeWsPushSchema(
  WS_CHANNELS.serverConfigUpdated,
  ServerConfigUpdatedPayload,
);
export const WsPushTerminalEvent = makeWsPushSchema(WS_CHANNELS.terminalEvent, TerminalEvent);
export const WsPushOpenCodeEvent = makeWsPushSchema(WS_CHANNELS.opencodeEvent, OpenCodeEvent);
export const WsPushOrchestrationDomainEvent = makeWsPushSchema(
  ORCHESTRATION_WS_CHANNELS.domainEvent,
  OrchestrationEvent,
);

export const WsPushChannelSchema = Schema.Literals([
  WS_CHANNELS.serverWelcome,
  WS_CHANNELS.serverConfigUpdated,
  WS_CHANNELS.terminalEvent,
  WS_CHANNELS.opencodeEvent,
  ORCHESTRATION_WS_CHANNELS.domainEvent,
]);
export type WsPushChannelSchema = typeof WsPushChannelSchema.Type;

export const WsPush = Schema.Union([
  WsPushServerWelcome,
  WsPushServerConfigUpdated,
  WsPushTerminalEvent,
  WsPushOpenCodeEvent,
  WsPushOrchestrationDomainEvent,
]);
export type WsPush = typeof WsPush.Type;

export type WsPushMessage<C extends WsPushChannel> = Extract<WsPush, { channel: C }>;

export const WsPushEnvelopeBase = Schema.Struct({
  type: Schema.Literal("push"),
  sequence: WsPushSequence,
  channel: WsPushChannelSchema,
  data: Schema.Unknown,
});
export type WsPushEnvelopeBase = typeof WsPushEnvelopeBase.Type;

// ── Union of all server → client messages ─────────────────────────────

export const WsResponse = Schema.Union([WebSocketResponse, WsPush]);
export type WsResponse = typeof WsResponse.Type;
