import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

const OpenCodeUrl = TrimmedNonEmptyString.check(Schema.isMaxLength(2048));
const OpenCodeSecret = Schema.String.check(Schema.isMaxLength(4096));
const OpenCodeIdentifier = TrimmedNonEmptyString.check(Schema.isMaxLength(255));
const OpenCodeTimestamp = Schema.Number;

export const OpenCodeServerConfigInput = Schema.Struct({
  baseUrl: OpenCodeUrl,
  autoStart: Schema.Boolean,
  password: Schema.optional(OpenCodeSecret),
  workspaceId: Schema.optional(OpenCodeIdentifier),
});
export type OpenCodeServerConfigInput = typeof OpenCodeServerConfigInput.Type;

export const OpenCodeStatusState = Schema.Literals(["ready", "starting", "error"]);
export type OpenCodeStatusState = typeof OpenCodeStatusState.Type;

export const OpenCodeStatus = Schema.Struct({
  state: OpenCodeStatusState,
  serverUrl: OpenCodeUrl,
  healthy: Schema.Boolean,
  autoStart: Schema.Boolean,
  message: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
});
export type OpenCodeStatus = typeof OpenCodeStatus.Type;

const OpenCodeProjectTime = Schema.Struct({
  created: OpenCodeTimestamp,
  updated: OpenCodeTimestamp,
});

export const OpenCodeProject = Schema.Struct({
  id: OpenCodeIdentifier,
  worktree: TrimmedNonEmptyString,
  vcs: Schema.optional(Schema.String),
  time: OpenCodeProjectTime,
  sandboxes: Schema.Array(TrimmedNonEmptyString),
});
export type OpenCodeProject = typeof OpenCodeProject.Type;

const OpenCodeProviderModalities = Schema.Struct({
  text: Schema.Boolean,
  audio: Schema.Boolean,
  image: Schema.Boolean,
  video: Schema.Boolean,
  pdf: Schema.Boolean,
});

const OpenCodeProviderInterleavedCapability = Schema.Union([
  Schema.Boolean,
  Schema.Struct({
    field: Schema.Literals(["reasoning_content", "reasoning_details"]),
  }),
]);

const OpenCodeProviderModelCapabilities = Schema.Struct({
  temperature: Schema.Boolean,
  reasoning: Schema.Boolean,
  attachment: Schema.Boolean,
  toolcall: Schema.Boolean,
  input: OpenCodeProviderModalities,
  output: OpenCodeProviderModalities,
  interleaved: OpenCodeProviderInterleavedCapability,
});

const OpenCodeProviderModelCost = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  cache: Schema.Struct({
    read: Schema.Number,
    write: Schema.Number,
  }),
  experimentalOver200K: Schema.optional(
    Schema.Struct({
      input: Schema.Number,
      output: Schema.Number,
      cache: Schema.Struct({
        read: Schema.Number,
        write: Schema.Number,
      }),
    }),
  ),
});

const OpenCodeProviderModelLimit = Schema.Struct({
  context: Schema.Number,
  input: Schema.optional(Schema.Number),
  output: Schema.Number,
});

export const OpenCodeProviderModel = Schema.Struct({
  id: Schema.String,
  providerID: Schema.String,
  name: Schema.String,
  family: Schema.optional(Schema.String),
  capabilities: OpenCodeProviderModelCapabilities,
  cost: OpenCodeProviderModelCost,
  limit: OpenCodeProviderModelLimit,
  status: Schema.Literals(["alpha", "beta", "deprecated", "active"]),
  options: Schema.Record(Schema.String, Schema.Unknown),
  headers: Schema.Record(Schema.String, Schema.String),
  release_date: Schema.String,
  variants: Schema.optional(Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown))),
});
export type OpenCodeProviderModel = typeof OpenCodeProviderModel.Type;

export const OpenCodeProvider = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  source: Schema.Literals(["env", "config", "custom", "api"]),
  env: Schema.Array(Schema.String),
  key: Schema.optional(Schema.String),
  options: Schema.Record(Schema.String, Schema.Unknown),
  models: Schema.Record(Schema.String, OpenCodeProviderModel),
});
export type OpenCodeProvider = typeof OpenCodeProvider.Type;

export const OpenCodeProviderCatalog = Schema.Struct({
  all: Schema.Array(OpenCodeProvider),
  default: Schema.Record(Schema.String, Schema.String),
  connected: Schema.Array(Schema.String),
});
export type OpenCodeProviderCatalog = typeof OpenCodeProviderCatalog.Type;

const OpenCodeSessionTime = Schema.Struct({
  created: OpenCodeTimestamp,
  updated: OpenCodeTimestamp,
  compacting: Schema.optional(OpenCodeTimestamp),
  archived: Schema.optional(OpenCodeTimestamp),
});

const OpenCodeSessionSummaryInfo = Schema.Struct({
  additions: Schema.optional(Schema.Number),
  deletions: Schema.optional(Schema.Number),
  files: Schema.optional(Schema.Number),
});

const OpenCodeSessionProjectRef = Schema.Struct({
  id: OpenCodeIdentifier,
  worktree: TrimmedNonEmptyString,
});

export const OpenCodePermissionAction = Schema.Literals(["allow", "deny", "ask"]);
export type OpenCodePermissionAction = typeof OpenCodePermissionAction.Type;

export const OpenCodePermissionRule = Schema.Struct({
  permission: Schema.String,
  pattern: Schema.String,
  action: OpenCodePermissionAction,
});
export type OpenCodePermissionRule = typeof OpenCodePermissionRule.Type;

export const OpenCodePermissionRuleset = Schema.Array(OpenCodePermissionRule);
export type OpenCodePermissionRuleset = typeof OpenCodePermissionRuleset.Type;

export const OpenCodePermissionRequest = Schema.Struct({
  id: OpenCodeIdentifier,
  sessionID: OpenCodeIdentifier,
  permission: Schema.String,
  patterns: Schema.Array(Schema.String),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
  always: Schema.Array(Schema.String),
  tool: Schema.optional(
    Schema.Struct({
      messageID: Schema.String,
      callID: Schema.String,
    }),
  ),
});
export type OpenCodePermissionRequest = typeof OpenCodePermissionRequest.Type;

export const OpenCodePermissionReply = Schema.Literals(["once", "always", "reject"]);
export type OpenCodePermissionReply = typeof OpenCodePermissionReply.Type;

export const OpenCodeVcsInfo = Schema.Struct({
  branch: Schema.NullOr(Schema.String),
});
export type OpenCodeVcsInfo = typeof OpenCodeVcsInfo.Type;

export const OpenCodeTodo = Schema.Struct({
  content: Schema.String,
  status: Schema.String,
  priority: Schema.String,
});
export type OpenCodeTodo = typeof OpenCodeTodo.Type;

export const OpenCodeQuestionOption = Schema.Struct({
  label: Schema.String,
  description: Schema.String,
});
export type OpenCodeQuestionOption = typeof OpenCodeQuestionOption.Type;

export const OpenCodeQuestionInfo = Schema.Struct({
  question: Schema.String,
  header: Schema.String,
  options: Schema.Array(OpenCodeQuestionOption),
  multiple: Schema.optional(Schema.Boolean),
  custom: Schema.optional(Schema.Boolean),
});
export type OpenCodeQuestionInfo = typeof OpenCodeQuestionInfo.Type;

export const OpenCodeQuestionRequest = Schema.Struct({
  id: OpenCodeIdentifier,
  sessionID: OpenCodeIdentifier,
  questions: Schema.Array(OpenCodeQuestionInfo),
  tool: Schema.optional(
    Schema.Struct({
      messageID: Schema.String,
      callID: Schema.String,
    }),
  ),
});
export type OpenCodeQuestionRequest = typeof OpenCodeQuestionRequest.Type;

export const OpenCodeFileDiff = Schema.Struct({
  file: Schema.String,
  before: Schema.String,
  after: Schema.String,
  additions: Schema.Number,
  deletions: Schema.Number,
  status: Schema.optional(Schema.Literals(["added", "deleted", "modified"])),
});
export type OpenCodeFileDiff = typeof OpenCodeFileDiff.Type;

export const OpenCodeSharedSession = Schema.Struct({
  url: Schema.String,
});
export type OpenCodeSharedSession = typeof OpenCodeSharedSession.Type;

export const OpenCodeRevertedSession = Schema.Struct({
  messageID: Schema.String,
  partID: Schema.optional(Schema.String),
  snapshot: Schema.optional(Schema.String),
  diff: Schema.optional(Schema.String),
});
export type OpenCodeRevertedSession = typeof OpenCodeRevertedSession.Type;

export const OpenCodeSessionSummary = Schema.Struct({
  id: OpenCodeIdentifier,
  slug: Schema.optional(Schema.String),
  projectID: Schema.optional(OpenCodeIdentifier),
  workspaceID: Schema.optional(OpenCodeIdentifier),
  directory: TrimmedNonEmptyString,
  parentID: Schema.optional(OpenCodeIdentifier),
  providerID: Schema.optional(Schema.String),
  modelID: Schema.optional(Schema.String),
  title: Schema.String,
  version: Schema.optional(Schema.String),
  summary: Schema.optional(OpenCodeSessionSummaryInfo),
  share: Schema.optional(OpenCodeSharedSession),
  revert: Schema.optional(OpenCodeRevertedSession),
  permission: Schema.optional(OpenCodePermissionRuleset),
  time: OpenCodeSessionTime,
  project: Schema.optional(OpenCodeSessionProjectRef),
});
export type OpenCodeSessionSummary = typeof OpenCodeSessionSummary.Type;

export const OpenCodeSession = Schema.Struct({
  id: OpenCodeIdentifier,
  slug: Schema.optional(Schema.String),
  projectID: Schema.optional(OpenCodeIdentifier),
  workspaceID: Schema.optional(OpenCodeIdentifier),
  directory: TrimmedNonEmptyString,
  parentID: Schema.optional(OpenCodeIdentifier),
  providerID: Schema.optional(Schema.String),
  modelID: Schema.optional(Schema.String),
  title: Schema.String,
  version: Schema.optional(Schema.String),
  summary: Schema.optional(OpenCodeSessionSummaryInfo),
  share: Schema.optional(OpenCodeSharedSession),
  revert: Schema.optional(OpenCodeRevertedSession),
  permission: Schema.optional(OpenCodePermissionRuleset),
  time: OpenCodeSessionTime,
});
export type OpenCodeSession = typeof OpenCodeSession.Type;

export const OpenCodePromptModel = Schema.Struct({
  providerID: Schema.String,
  modelID: Schema.String,
});
export type OpenCodePromptModel = typeof OpenCodePromptModel.Type;

export const OpenCodeAgentMode = Schema.Literals(["subagent", "primary", "all"]);
export type OpenCodeAgentMode = typeof OpenCodeAgentMode.Type;

export const OpenCodeAgent = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  mode: OpenCodeAgentMode,
  native: Schema.optional(Schema.Boolean),
  hidden: Schema.optional(Schema.Boolean),
  topP: Schema.optional(Schema.Number),
  temperature: Schema.optional(Schema.Number),
  color: Schema.optional(Schema.String),
  permission: OpenCodePermissionRuleset,
  model: Schema.optional(OpenCodePromptModel),
  variant: Schema.optional(Schema.String),
  prompt: Schema.optional(Schema.String),
  options: Schema.Record(Schema.String, Schema.Unknown),
  steps: Schema.optional(Schema.Number),
});
export type OpenCodeAgent = typeof OpenCodeAgent.Type;

export const OpenCodePromptTextPart = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
  id: Schema.optional(OpenCodeIdentifier),
});
export type OpenCodePromptTextPart = typeof OpenCodePromptTextPart.Type;

export const OpenCodePromptFilePart = Schema.Struct({
  type: Schema.Literal("file"),
  mime: Schema.String,
  url: Schema.String,
  filename: Schema.optional(Schema.String),
  id: Schema.optional(OpenCodeIdentifier),
});
export type OpenCodePromptFilePart = typeof OpenCodePromptFilePart.Type;

export const OpenCodePromptAgentPart = Schema.Struct({
  type: Schema.Literal("agent"),
  name: Schema.String,
  id: Schema.optional(OpenCodeIdentifier),
});
export type OpenCodePromptAgentPart = typeof OpenCodePromptAgentPart.Type;

export const OpenCodePromptSubtaskPart = Schema.Struct({
  type: Schema.Literal("subtask"),
  prompt: Schema.String,
  description: Schema.String,
  agent: Schema.String,
  model: Schema.optional(OpenCodePromptModel),
  command: Schema.optional(Schema.String),
  id: Schema.optional(OpenCodeIdentifier),
});
export type OpenCodePromptSubtaskPart = typeof OpenCodePromptSubtaskPart.Type;

export const OpenCodePromptPart = Schema.Union([
  OpenCodePromptTextPart,
  OpenCodePromptFilePart,
  OpenCodePromptAgentPart,
  OpenCodePromptSubtaskPart,
]);
export type OpenCodePromptPart = typeof OpenCodePromptPart.Type;

const OpenCodeMessageTime = Schema.Struct({
  created: OpenCodeTimestamp,
  completed: Schema.optional(OpenCodeTimestamp),
  start: Schema.optional(OpenCodeTimestamp),
  end: Schema.optional(OpenCodeTimestamp),
});

export const OpenCodeMessageInfo = Schema.Struct({
  role: Schema.Literals(["user", "assistant", "system"]),
  time: OpenCodeMessageTime,
  summary: Schema.optional(Schema.Unknown),
  agent: Schema.optional(Schema.String),
  model: Schema.optional(OpenCodePromptModel),
  variant: Schema.optional(Schema.String),
  id: OpenCodeIdentifier,
  sessionID: OpenCodeIdentifier,
  parentID: Schema.optional(OpenCodeIdentifier),
  modelID: Schema.optional(Schema.String),
  providerID: Schema.optional(Schema.String),
  mode: Schema.optional(Schema.String),
  path: Schema.optional(
    Schema.Struct({
      cwd: TrimmedNonEmptyString,
      root: TrimmedNonEmptyString,
    }),
  ),
  finish: Schema.optional(Schema.String),
  error: Schema.optional(Schema.Unknown),
});
export type OpenCodeMessageInfo = typeof OpenCodeMessageInfo.Type;

export const OpenCodeMessagePart = Schema.Struct({
  type: Schema.String,
  text: Schema.optional(Schema.String),
  tool: Schema.optional(Schema.String),
  state: Schema.optional(Schema.Unknown),
  metadata: Schema.optional(Schema.Unknown),
  snapshot: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
  callID: Schema.optional(Schema.String),
  id: Schema.optional(OpenCodeIdentifier),
  sessionID: Schema.optional(OpenCodeIdentifier),
  messageID: Schema.optional(OpenCodeIdentifier),
});
export type OpenCodeMessagePart = typeof OpenCodeMessagePart.Type;

export const OpenCodeMessage = Schema.Struct({
  info: OpenCodeMessageInfo,
  parts: Schema.Array(OpenCodeMessagePart),
});
export type OpenCodeMessage = typeof OpenCodeMessage.Type;

const OpenCodeRuntimeStatus = Schema.Union([
  Schema.Struct({ type: Schema.Literal("idle") }),
  Schema.Struct({ type: Schema.Literal("busy") }),
  Schema.Struct({
    type: Schema.Literal("retry"),
    attempt: Schema.Number,
    message: Schema.String,
    next: Schema.Number,
  }),
]);
export type OpenCodeRuntimeStatus = typeof OpenCodeRuntimeStatus.Type;

export const OpenCodeSessionStatusMap = Schema.Record(OpenCodeIdentifier, OpenCodeRuntimeStatus);
export type OpenCodeSessionStatusMap = typeof OpenCodeSessionStatusMap.Type;

export const OpenCodeEventPayload = Schema.Struct({
  type: Schema.String,
  properties: Schema.Unknown,
});
export type OpenCodeEventPayload = typeof OpenCodeEventPayload.Type;

export const OpenCodeEvent = Schema.Struct({
  directory: TrimmedNonEmptyString,
  payload: OpenCodeEventPayload,
});
export type OpenCodeEvent = typeof OpenCodeEvent.Type;

export const OpenCodeListProjectsInput = OpenCodeServerConfigInput;
export type OpenCodeListProjectsInput = typeof OpenCodeListProjectsInput.Type;

export const OpenCodeListProvidersInput = OpenCodeServerConfigInput;
export type OpenCodeListProvidersInput = typeof OpenCodeListProvidersInput.Type;

export const OpenCodeListAgentsInput = OpenCodeServerConfigInput;
export type OpenCodeListAgentsInput = typeof OpenCodeListAgentsInput.Type;

export const OpenCodeListSessionsInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  directory: Schema.optional(TrimmedNonEmptyString),
  limit: Schema.optional(Schema.Number),
  roots: Schema.optional(Schema.Boolean),
});
export type OpenCodeListSessionsInput = typeof OpenCodeListSessionsInput.Type;

export const OpenCodeGetSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
});
export type OpenCodeGetSessionInput = typeof OpenCodeGetSessionInput.Type;

export const OpenCodeGetTodoInput = OpenCodeGetSessionInput;
export type OpenCodeGetTodoInput = typeof OpenCodeGetTodoInput.Type;

export const OpenCodeGetDiffInput = OpenCodeGetSessionInput;
export type OpenCodeGetDiffInput = typeof OpenCodeGetDiffInput.Type;

export const OpenCodeListPermissionsInput = OpenCodeServerConfigInput;
export type OpenCodeListPermissionsInput = typeof OpenCodeListPermissionsInput.Type;

export const OpenCodeListQuestionsInput = OpenCodeServerConfigInput;
export type OpenCodeListQuestionsInput = typeof OpenCodeListQuestionsInput.Type;

export const OpenCodeGetVcsInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  directory: TrimmedNonEmptyString,
});
export type OpenCodeGetVcsInput = typeof OpenCodeGetVcsInput.Type;

export const OpenCodeCreateSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  directory: TrimmedNonEmptyString,
  title: Schema.optional(Schema.String),
  permission: Schema.optional(OpenCodePermissionRuleset),
});
export type OpenCodeCreateSessionInput = typeof OpenCodeCreateSessionInput.Type;

export const OpenCodeSendMessageInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
  text: Schema.optional(Schema.String),
  parts: Schema.optional(Schema.Array(OpenCodePromptPart)),
  model: Schema.optional(OpenCodePromptModel),
  agent: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.String),
});
export type OpenCodeSendMessageInput = typeof OpenCodeSendMessageInput.Type;

export const OpenCodeAbortSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
});
export type OpenCodeAbortSessionInput = typeof OpenCodeAbortSessionInput.Type;

export const OpenCodeUpdateSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
  title: Schema.optional(Schema.String),
  permission: Schema.optional(OpenCodePermissionRuleset),
});
export type OpenCodeUpdateSessionInput = typeof OpenCodeUpdateSessionInput.Type;

export const OpenCodeReplyPermissionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  requestId: OpenCodeIdentifier,
  reply: OpenCodePermissionReply,
  message: Schema.optional(Schema.String),
});
export type OpenCodeReplyPermissionInput = typeof OpenCodeReplyPermissionInput.Type;

export const OpenCodeReplyQuestionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  requestId: OpenCodeIdentifier,
  answers: Schema.Array(Schema.Array(Schema.String)),
});
export type OpenCodeReplyQuestionInput = typeof OpenCodeReplyQuestionInput.Type;

export const OpenCodeRejectQuestionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  requestId: OpenCodeIdentifier,
});
export type OpenCodeRejectQuestionInput = typeof OpenCodeRejectQuestionInput.Type;

export const OpenCodeRevertSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
  messageId: OpenCodeIdentifier,
  partId: Schema.optional(OpenCodeIdentifier),
});
export type OpenCodeRevertSessionInput = typeof OpenCodeRevertSessionInput.Type;

export const OpenCodeShareSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
});
export type OpenCodeShareSessionInput = typeof OpenCodeShareSessionInput.Type;

export const OpenCodeUnshareSessionInput = OpenCodeShareSessionInput;
export type OpenCodeUnshareSessionInput = typeof OpenCodeUnshareSessionInput.Type;

export const OpenCodeUnrevertSessionInput = OpenCodeShareSessionInput;
export type OpenCodeUnrevertSessionInput = typeof OpenCodeUnrevertSessionInput.Type;

export const OpenCodeDeleteSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
});
export type OpenCodeDeleteSessionInput = typeof OpenCodeDeleteSessionInput.Type;

export const OpenCodeForkSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
  messageId: Schema.optional(OpenCodeIdentifier),
  directory: Schema.optional(TrimmedNonEmptyString),
  permission: Schema.optional(OpenCodePermissionRuleset),
});
export type OpenCodeForkSessionInput = typeof OpenCodeForkSessionInput.Type;
