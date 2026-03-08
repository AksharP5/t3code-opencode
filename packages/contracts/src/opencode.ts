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

export const OpenCodeSessionSummary = Schema.Struct({
  id: OpenCodeIdentifier,
  slug: Schema.optional(Schema.String),
  projectID: Schema.optional(OpenCodeIdentifier),
  workspaceID: Schema.optional(OpenCodeIdentifier),
  directory: TrimmedNonEmptyString,
  parentID: Schema.optional(OpenCodeIdentifier),
  title: Schema.String,
  version: Schema.optional(Schema.String),
  summary: Schema.optional(OpenCodeSessionSummaryInfo),
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
  title: Schema.String,
  version: Schema.optional(Schema.String),
  summary: Schema.optional(OpenCodeSessionSummaryInfo),
  time: OpenCodeSessionTime,
});
export type OpenCodeSession = typeof OpenCodeSession.Type;

const OpenCodeMessageModel = Schema.Struct({
  providerID: Schema.String,
  modelID: Schema.String,
});

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
  model: Schema.optional(OpenCodeMessageModel),
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

export const OpenCodeCreateSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  directory: TrimmedNonEmptyString,
  title: Schema.optional(Schema.String),
});
export type OpenCodeCreateSessionInput = typeof OpenCodeCreateSessionInput.Type;

export const OpenCodeSendMessageInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
  text: Schema.String,
});
export type OpenCodeSendMessageInput = typeof OpenCodeSendMessageInput.Type;

export const OpenCodeAbortSessionInput = Schema.Struct({
  ...OpenCodeServerConfigInput.fields,
  sessionId: OpenCodeIdentifier,
});
export type OpenCodeAbortSessionInput = typeof OpenCodeAbortSessionInput.Type;
