import type {
  GitCheckoutInput,
  GitCreateBranchInput,
  GitCreateWorktreeInput,
  GitCreateWorktreeResult,
  GitInitInput,
  GitListBranchesInput,
  GitListBranchesResult,
  GitPullInput,
  GitPullResult,
  GitRemoveWorktreeInput,
  GitRunStackedActionInput,
  GitRunStackedActionResult,
  GitStatusInput,
  GitStatusResult,
} from "./git";
import type {
  ProjectSearchEntriesInput,
  ProjectSearchEntriesResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
} from "./project";
import type { ServerConfig } from "./server";
import type {
  OpenCodeAbortSessionInput,
  OpenCodeCreateSessionInput,
  OpenCodeDeleteSessionInput,
  OpenCodeForkSessionInput,
  OpenCodeAgent,
  OpenCodeFileDiff,
  OpenCodeGetDiffInput,
  OpenCodeGetTodoInput,
  OpenCodeGetVcsInput,
  OpenCodeEvent,
  OpenCodeGetSessionInput,
  OpenCodeListAgentsInput,
  OpenCodeListMcpServersInput,
  OpenCodeListCommandsInput,
  OpenCodeListResourcesInput,
  OpenCodeListProviderAuthMethodsInput,
  OpenCodeListPermissionsInput,
  OpenCodeListQuestionsInput,
  OpenCodeListProvidersInput,
  OpenCodeListProjectsInput,
  OpenCodeListSessionsInput,
  OpenCodeMessage,
  OpenCodePermissionRequest,
  OpenCodeQuestionRequest,
  OpenCodeProviderCatalog,
  OpenCodeProject,
  OpenCodeProviderAuthMethod,
  OpenCodeProviderAuthorization,
  OpenCodeMcpAuthStartResult,
  OpenCodeMcpResource,
  OpenCodeMcpStatus,
  OpenCodeCommand,
  OpenCodeReplyPermissionInput,
  OpenCodeReplyQuestionInput,
  OpenCodeRejectQuestionInput,
  OpenCodeRevertSessionInput,
  OpenCodeAuthorizeProviderInput,
  OpenCodeAuthenticateMcpInput,
  OpenCodeCompleteMcpAuthInput,
  OpenCodeCompleteProviderAuthInput,
  OpenCodeConnectMcpInput,
  OpenCodeDisconnectMcpInput,
  OpenCodeRemoveProviderAuthInput,
  OpenCodeRemoveMcpAuthInput,
  OpenCodeSendMessageInput,
  OpenCodeSession,
  OpenCodeSessionStatusMap,
  OpenCodeSessionSummary,
  OpenCodeStatus,
  OpenCodeTodo,
  OpenCodeShareSessionInput,
  OpenCodeSetProviderApiKeyInput,
  OpenCodeStartMcpAuthInput,
  OpenCodeUnrevertSessionInput,
  OpenCodeUnshareSessionInput,
  OpenCodeUpdateSessionInput,
  OpenCodeVcsInfo,
  OpenCodeRunCommandInput,
} from "./opencode";
import type {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalSessionSnapshot,
  TerminalWriteInput,
} from "./terminal";
import type { ServerUpsertKeybindingInput, ServerUpsertKeybindingResult } from "./server";
import type {
  ClientOrchestrationCommand,
  OrchestrationGetFullThreadDiffInput,
  OrchestrationGetFullThreadDiffResult,
  OrchestrationGetTurnDiffInput,
  OrchestrationGetTurnDiffResult,
  OrchestrationEvent,
  OrchestrationReadModel,
} from "./orchestration";
import { EditorId } from "./editor";

export interface ContextMenuItem<T extends string = string> {
  id: T;
  label: string;
  destructive?: boolean;
}

export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export type DesktopRuntimeArch = "arm64" | "x64" | "other";

export interface DesktopRuntimeInfo {
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
}

export interface DesktopUpdateState {
  enabled: boolean;
  status: DesktopUpdateStatus;
  currentVersion: string;
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null;
  message: string | null;
  errorContext: "check" | "download" | "install" | null;
  canRetry: boolean;
}

export interface DesktopUpdateActionResult {
  accepted: boolean;
  completed: boolean;
  state: DesktopUpdateState;
}

export interface DesktopBridge {
  getWsUrl: () => string | null;
  pickFolder: () => Promise<string | null>;
  confirm: (message: string) => Promise<boolean>;
  showContextMenu: <T extends string>(
    items: readonly ContextMenuItem<T>[],
    position?: { x: number; y: number },
  ) => Promise<T | null>;
  openExternal: (url: string) => Promise<boolean>;
  onMenuAction: (listener: (action: string) => void) => () => void;
  getUpdateState: () => Promise<DesktopUpdateState>;
  downloadUpdate: () => Promise<DesktopUpdateActionResult>;
  installUpdate: () => Promise<DesktopUpdateActionResult>;
  onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
}

export interface NativeApi {
  dialogs: {
    pickFolder: () => Promise<string | null>;
    confirm: (message: string) => Promise<boolean>;
  };
  terminal: {
    open: (input: TerminalOpenInput) => Promise<TerminalSessionSnapshot>;
    write: (input: TerminalWriteInput) => Promise<void>;
    resize: (input: TerminalResizeInput) => Promise<void>;
    clear: (input: TerminalClearInput) => Promise<void>;
    restart: (input: TerminalOpenInput) => Promise<TerminalSessionSnapshot>;
    close: (input: TerminalCloseInput) => Promise<void>;
    onEvent: (callback: (event: TerminalEvent) => void) => () => void;
  };
  projects: {
    searchEntries: (input: ProjectSearchEntriesInput) => Promise<ProjectSearchEntriesResult>;
    writeFile: (input: ProjectWriteFileInput) => Promise<ProjectWriteFileResult>;
  };
  shell: {
    openInEditor: (cwd: string, editor: EditorId) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  git: {
    // Existing branch/worktree API
    listBranches: (input: GitListBranchesInput) => Promise<GitListBranchesResult>;
    createWorktree: (input: GitCreateWorktreeInput) => Promise<GitCreateWorktreeResult>;
    removeWorktree: (input: GitRemoveWorktreeInput) => Promise<void>;
    createBranch: (input: GitCreateBranchInput) => Promise<void>;
    checkout: (input: GitCheckoutInput) => Promise<void>;
    init: (input: GitInitInput) => Promise<void>;
    // Stacked action API
    pull: (input: GitPullInput) => Promise<GitPullResult>;
    status: (input: GitStatusInput) => Promise<GitStatusResult>;
    runStackedAction: (input: GitRunStackedActionInput) => Promise<GitRunStackedActionResult>;
  };
  contextMenu: {
    show: <T extends string>(
      items: readonly ContextMenuItem<T>[],
      position?: { x: number; y: number },
    ) => Promise<T | null>;
  };
  server: {
    getConfig: () => Promise<ServerConfig>;
    upsertKeybinding: (input: ServerUpsertKeybindingInput) => Promise<ServerUpsertKeybindingResult>;
  };
  opencode: {
    getStatus: (input: OpenCodeListProjectsInput) => Promise<OpenCodeStatus>;
    ensureServer: (input: OpenCodeListProjectsInput) => Promise<OpenCodeStatus>;
    listProviders: (input: OpenCodeListProvidersInput) => Promise<OpenCodeProviderCatalog>;
    listProviderAuthMethods: (input: OpenCodeListProviderAuthMethodsInput) => Promise<Record<string, OpenCodeProviderAuthMethod[]>>;
    listMcpServers: (input: OpenCodeListMcpServersInput) => Promise<Record<string, OpenCodeMcpStatus>>;
    listCommands: (input: OpenCodeListCommandsInput) => Promise<OpenCodeCommand[]>;
    listResources: (input: OpenCodeListResourcesInput) => Promise<Record<string, OpenCodeMcpResource>>;
    listAgents: (input: OpenCodeListAgentsInput) => Promise<OpenCodeAgent[]>;
    listProjects: (input: OpenCodeListProjectsInput) => Promise<OpenCodeProject[]>;
    listSessions: (input: OpenCodeListSessionsInput) => Promise<OpenCodeSessionSummary[]>;
    getSession: (input: OpenCodeGetSessionInput) => Promise<OpenCodeSession>;
    getMessages: (input: OpenCodeGetSessionInput) => Promise<OpenCodeMessage[]>;
    getDiff: (input: OpenCodeGetDiffInput) => Promise<OpenCodeFileDiff[]>;
    getTodo: (input: OpenCodeGetTodoInput) => Promise<OpenCodeTodo[]>;
    getStatuses: (input: OpenCodeListProjectsInput) => Promise<OpenCodeSessionStatusMap>;
    listPermissions: (input: OpenCodeListPermissionsInput) => Promise<OpenCodePermissionRequest[]>;
    listQuestions: (input: OpenCodeListQuestionsInput) => Promise<OpenCodeQuestionRequest[]>;
    replyPermission: (input: OpenCodeReplyPermissionInput) => Promise<boolean>;
    replyQuestion: (input: OpenCodeReplyQuestionInput) => Promise<boolean>;
    rejectQuestion: (input: OpenCodeRejectQuestionInput) => Promise<boolean>;
    revertSession: (input: OpenCodeRevertSessionInput) => Promise<OpenCodeSession>;
    setProviderApiKey: (input: OpenCodeSetProviderApiKeyInput) => Promise<boolean>;
    removeProviderAuth: (input: OpenCodeRemoveProviderAuthInput) => Promise<boolean>;
    authorizeProvider: (input: OpenCodeAuthorizeProviderInput) => Promise<OpenCodeProviderAuthorization | null>;
    completeProviderAuth: (input: OpenCodeCompleteProviderAuthInput) => Promise<boolean>;
    startMcpAuth: (input: OpenCodeStartMcpAuthInput) => Promise<OpenCodeMcpAuthStartResult>;
    completeMcpAuth: (input: OpenCodeCompleteMcpAuthInput) => Promise<OpenCodeMcpStatus>;
    authenticateMcp: (input: OpenCodeAuthenticateMcpInput) => Promise<OpenCodeMcpStatus>;
    removeMcpAuth: (input: OpenCodeRemoveMcpAuthInput) => Promise<boolean>;
    connectMcp: (input: OpenCodeConnectMcpInput) => Promise<boolean>;
    disconnectMcp: (input: OpenCodeDisconnectMcpInput) => Promise<boolean>;
    runCommand: (input: OpenCodeRunCommandInput) => Promise<OpenCodeMessage | null>;
    shareSession: (input: OpenCodeShareSessionInput) => Promise<OpenCodeSession>;
    unshareSession: (input: OpenCodeUnshareSessionInput) => Promise<OpenCodeSession>;
    unrevertSession: (input: OpenCodeUnrevertSessionInput) => Promise<OpenCodeSession>;
    getVcs: (input: OpenCodeGetVcsInput) => Promise<OpenCodeVcsInfo>;
    createSession: (input: OpenCodeCreateSessionInput) => Promise<OpenCodeSession>;
    sendMessage: (input: OpenCodeSendMessageInput) => Promise<OpenCodeMessage | null>;
    abortSession: (input: OpenCodeAbortSessionInput) => Promise<boolean>;
    updateSession: (input: OpenCodeUpdateSessionInput) => Promise<OpenCodeSession>;
    deleteSession: (input: OpenCodeDeleteSessionInput) => Promise<boolean>;
    forkSession: (input: OpenCodeForkSessionInput) => Promise<OpenCodeSession>;
    onEvent: (callback: (event: OpenCodeEvent) => void) => () => void;
  };
  orchestration: {
    getSnapshot: () => Promise<OrchestrationReadModel>;
    dispatchCommand: (command: ClientOrchestrationCommand) => Promise<{ sequence: number }>;
    getTurnDiff: (input: OrchestrationGetTurnDiffInput) => Promise<OrchestrationGetTurnDiffResult>;
    getFullThreadDiff: (
      input: OrchestrationGetFullThreadDiffInput,
    ) => Promise<OrchestrationGetFullThreadDiffResult>;
    replayEvents: (fromSequenceExclusive: number) => Promise<OrchestrationEvent[]>;
    onDomainEvent: (callback: (event: OrchestrationEvent) => void) => () => void;
  };
}
