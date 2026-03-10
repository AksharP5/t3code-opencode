import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type {
  OpenCodeAbortSessionInput,
  OpenCodeListAgentsInput,
  OpenCodeCreateSessionInput,
  OpenCodeDeleteSessionInput,
  OpenCodeForkSessionInput,
  OpenCodeListCommandsInput,
  OpenCodeEvent,
  OpenCodeAuthorizeProviderInput,
  OpenCodeCompleteProviderAuthInput,
  OpenCodeGetDiffInput,
  OpenCodeGetVcsInput,
  OpenCodeGetSessionInput,
  OpenCodeGetTodoInput,
  OpenCodeListMcpServersInput,
  OpenCodeListProviderAuthMethodsInput,
  OpenCodeListProjectsInput,
  OpenCodeListResourcesInput,
  OpenCodeListPermissionsInput,
  OpenCodeListQuestionsInput,
  OpenCodeListSessionsInput,
  OpenCodeReplyPermissionInput,
  OpenCodeReplyQuestionInput,
  OpenCodeRejectQuestionInput,
  OpenCodeRevertSessionInput,
  OpenCodeAuthenticateMcpInput,
  OpenCodeRemoveProviderAuthInput,
  OpenCodeRemoveMcpAuthInput,
  OpenCodeRunCommandInput,
  OpenCodeSendMessageInput,
  OpenCodeSetProviderApiKeyInput,
  OpenCodeShareSessionInput,
  OpenCodeStartMcpAuthInput,
  OpenCodeStatus,
  OpenCodeCompleteMcpAuthInput,
  OpenCodeConnectMcpInput,
  OpenCodeDisconnectMcpInput,
  OpenCodeUnrevertSessionInput,
  OpenCodeUnshareSessionInput,
  OpenCodeUpdateSessionInput,
} from "@t3tools/contracts";
import {
  authorizeOpenCodeProvider,
  abortOpenCodeSession,
  authenticateOpenCodeMcp,
  completeOpenCodeMcpAuth,
  connectOpenCodeMcp,
  completeOpenCodeProviderAuth,
  createOpenCodeSession,
  deleteOpenCodeSession,
  fetchOpenCodeHealth,
  forkOpenCodeSession,
  listOpenCodeCommands,
  getOpenCodeMessages,
  getOpenCodeDiff,
  getOpenCodeSession,
  getOpenCodeTodo,
  getOpenCodeStatuses,
  getOpenCodeVcs,
  listOpenCodeAgents,
  listOpenCodeProviderAuthMethods,
  listOpenCodeMcpServers,
  listOpenCodeProviders,
  listOpenCodePermissions,
  listOpenCodeQuestions,
  listOpenCodeProjects,
  listOpenCodeResources,
  listOpenCodeSessions,
  replyOpenCodePermission,
  replyOpenCodeQuestion,
  rejectOpenCodeQuestion,
  removeOpenCodeProviderAuth,
  removeOpenCodeMcpAuth,
  runOpenCodeCommand,
  revertOpenCodeSession,
  setOpenCodeProviderApiKey,
  sendOpenCodeMessage,
  shareOpenCodeSession,
  startOpenCodeMcpAuth,
  streamOpenCodeEvents,
  disconnectOpenCodeMcp,
  unrevertOpenCodeSession,
  unshareOpenCodeSession,
  updateOpenCodeSession,
} from "./client";
import { isLoopbackOpenCodeUrl, resolveOpenCodeConfig, type ResolvedOpenCodeConfig } from "./config";

const OPENCODE_BOOT_TIMEOUT_MS = 20_000;
const OPENCODE_EVENT_RETRY_MS = 1_000;

export class OpenCodeBridge {
  private serverProcess: ChildProcessByStdio<null, Readable, Readable> | null = null;
  private serverProcessUrl: string | null = null;
  private serverOutput = "";
  private eventAbortController: AbortController | null = null;
  private activeEventConfigKey: string | null = null;
  private disposed = false;
  private readonly handleEvent: (event: OpenCodeEvent) => void;

  constructor(input: { onEvent: (event: OpenCodeEvent) => void }) {
    this.handleEvent = input.onEvent;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.stopEventStream();
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
      this.serverProcessUrl = null;
    }
  }

  async getStatus(input: OpenCodeListProjectsInput): Promise<OpenCodeStatus> {
    const config = resolveOpenCodeConfig(input);
    try {
      const health = await fetchOpenCodeHealth(config);
      this.ensureEventStream(config);
      return health;
    } catch (error) {
      if (config.autoStart && isLoopbackOpenCodeUrl(config.baseUrl)) {
        try {
          await this.ensureStarted(config);
          const health = await fetchOpenCodeHealth(config);
          this.ensureEventStream(config);
          return health;
        } catch (startError) {
          return {
            state: "error",
            serverUrl: config.baseUrl,
            healthy: false,
            autoStart: config.autoStart,
            message: startError instanceof Error ? startError.message : "Unable to start OpenCode.",
          };
        }
      }
      return {
        state: "error",
        serverUrl: config.baseUrl,
        healthy: false,
        autoStart: config.autoStart,
        message: error instanceof Error ? error.message : "Unable to reach OpenCode.",
      };
    }
  }

  async ensureServer(input: OpenCodeListProjectsInput): Promise<OpenCodeStatus> {
    const config = await this.ensureReady(input);
    const health = await fetchOpenCodeHealth(config);
    this.ensureEventStream(config);
    return health;
  }

  async listProjects(input: OpenCodeListProjectsInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeProjects(config);
  }

  async listProviders(input: OpenCodeListProjectsInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeProviders(config);
  }

  async listProviderAuthMethods(input: OpenCodeListProviderAuthMethodsInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeProviderAuthMethods(config);
  }

  async listMcpServers(input: OpenCodeListMcpServersInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeMcpServers(config);
  }

  async listCommands(input: OpenCodeListCommandsInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeCommands(config);
  }

  async listResources(input: OpenCodeListResourcesInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeResources(config);
  }

  async authorizeProvider(input: OpenCodeAuthorizeProviderInput) {
    const config = await this.ensureReady(input);
    return authorizeOpenCodeProvider(input, config);
  }

  async completeProviderAuth(input: OpenCodeCompleteProviderAuthInput) {
    const config = await this.ensureReady(input);
    return completeOpenCodeProviderAuth(input, config);
  }

  async setProviderApiKey(input: OpenCodeSetProviderApiKeyInput) {
    const config = await this.ensureReady(input);
    return setOpenCodeProviderApiKey(input, config);
  }

  async removeProviderAuth(input: OpenCodeRemoveProviderAuthInput) {
    const config = await this.ensureReady(input);
    return removeOpenCodeProviderAuth(input, config);
  }

  async startMcpAuth(input: OpenCodeStartMcpAuthInput) {
    const config = await this.ensureReady(input);
    return startOpenCodeMcpAuth(input, config);
  }

  async completeMcpAuth(input: OpenCodeCompleteMcpAuthInput) {
    const config = await this.ensureReady(input);
    return completeOpenCodeMcpAuth(input, config);
  }

  async authenticateMcp(input: OpenCodeAuthenticateMcpInput) {
    const config = await this.ensureReady(input);
    return authenticateOpenCodeMcp(input, config);
  }

  async removeMcpAuth(input: OpenCodeRemoveMcpAuthInput) {
    const config = await this.ensureReady(input);
    return removeOpenCodeMcpAuth(input, config);
  }

  async connectMcp(input: OpenCodeConnectMcpInput) {
    const config = await this.ensureReady(input);
    return connectOpenCodeMcp(input, config);
  }

  async disconnectMcp(input: OpenCodeDisconnectMcpInput) {
    const config = await this.ensureReady(input);
    return disconnectOpenCodeMcp(input, config);
  }

  async runCommand(input: OpenCodeRunCommandInput) {
    const config = await this.ensureReady(input);
    return runOpenCodeCommand(input, config);
  }

  async listAgents(input: OpenCodeListAgentsInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeAgents(config);
  }

  async listSessions(input: OpenCodeListSessionsInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeSessions({
      config,
      directory: input.directory,
      limit: input.limit,
      roots: input.roots,
    });
  }

  async getSession(input: OpenCodeGetSessionInput) {
    const config = await this.ensureReady(input);
    return getOpenCodeSession(config, input.sessionId);
  }

  async getMessages(input: OpenCodeGetSessionInput) {
    const config = await this.ensureReady(input);
    return getOpenCodeMessages(config, input.sessionId);
  }

  async getDiff(input: OpenCodeGetDiffInput) {
    const config = await this.ensureReady(input);
    return getOpenCodeDiff(input, config);
  }

  async getTodo(input: OpenCodeGetTodoInput) {
    const config = await this.ensureReady(input);
    return getOpenCodeTodo(input, config);
  }

  async getStatuses(input: OpenCodeListProjectsInput) {
    const config = await this.ensureReady(input);
    return getOpenCodeStatuses(config);
  }

  async listPermissions(input: OpenCodeListPermissionsInput) {
    const config = await this.ensureReady(input);
    return listOpenCodePermissions(config);
  }

  async listQuestions(input: OpenCodeListQuestionsInput) {
    const config = await this.ensureReady(input);
    return listOpenCodeQuestions(config);
  }

  async replyPermission(input: OpenCodeReplyPermissionInput) {
    const config = await this.ensureReady(input);
    return replyOpenCodePermission(input, config);
  }

  async replyQuestion(input: OpenCodeReplyQuestionInput) {
    const config = await this.ensureReady(input);
    return replyOpenCodeQuestion(input, config);
  }

  async rejectQuestion(input: OpenCodeRejectQuestionInput) {
    const config = await this.ensureReady(input);
    return rejectOpenCodeQuestion(input, config);
  }

  async revertSession(input: OpenCodeRevertSessionInput) {
    const config = await this.ensureReady(input);
    return revertOpenCodeSession(input, config);
  }

  async shareSession(input: OpenCodeShareSessionInput) {
    const config = await this.ensureReady(input);
    return shareOpenCodeSession(input, config);
  }

  async unshareSession(input: OpenCodeUnshareSessionInput) {
    const config = await this.ensureReady(input);
    return unshareOpenCodeSession(input, config);
  }

  async unrevertSession(input: OpenCodeUnrevertSessionInput) {
    const config = await this.ensureReady(input);
    return unrevertOpenCodeSession(input, config);
  }

  async getVcs(input: OpenCodeGetVcsInput) {
    const config = await this.ensureReady(input);
    return getOpenCodeVcs(input, config);
  }

  async createSession(input: OpenCodeCreateSessionInput) {
    const config = await this.ensureReady(input);
    return createOpenCodeSession(input, config);
  }

  async sendMessage(input: OpenCodeSendMessageInput) {
    const config = await this.ensureReady(input);
    return sendOpenCodeMessage(input, config);
  }

  async abortSession(input: OpenCodeAbortSessionInput) {
    const config = await this.ensureReady(input);
    return abortOpenCodeSession(config, input.sessionId);
  }

  async updateSession(input: OpenCodeUpdateSessionInput) {
    const config = await this.ensureReady(input);
    return updateOpenCodeSession(input, config);
  }

  async deleteSession(input: OpenCodeDeleteSessionInput) {
    const config = await this.ensureReady(input);
    return deleteOpenCodeSession(input, config);
  }

  async forkSession(input: OpenCodeForkSessionInput) {
    const config = await this.ensureReady(input);
    return forkOpenCodeSession(input, config);
  }

  private async ensureReady(input: OpenCodeListProjectsInput): Promise<ResolvedOpenCodeConfig> {
    const config = resolveOpenCodeConfig(input);
    try {
      await fetchOpenCodeHealth(config);
      this.ensureEventStream(config);
      return config;
    } catch (error) {
      if (!config.autoStart || !isLoopbackOpenCodeUrl(config.baseUrl)) {
        throw error;
      }
    }
    await this.ensureStarted(config);
    await fetchOpenCodeHealth(config);
    this.ensureEventStream(config);
    return config;
  }

  private async ensureStarted(config: ResolvedOpenCodeConfig): Promise<void> {
    if (this.serverProcess && this.serverProcess.exitCode === null && this.serverProcessUrl === config.baseUrl) {
      await this.waitForHealth(config, OPENCODE_BOOT_TIMEOUT_MS);
      return;
    }
    if (this.serverProcess && this.serverProcess.exitCode === null) {
      this.serverProcess.kill();
    }
    this.serverOutput = "";
    const url = new URL(config.baseUrl);
    const port = url.port.length > 0 ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    const serverProcess = spawn("opencode", ["serve", `--hostname=${url.hostname}`, `--port=${port}`], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.serverProcess = serverProcess;
    this.serverProcessUrl = config.baseUrl;
    serverProcess.stdout.on("data", (chunk: Buffer | string) => {
      this.serverOutput += chunk.toString();
    });
    serverProcess.stderr.on("data", (chunk: Buffer | string) => {
      this.serverOutput += chunk.toString();
    });
    serverProcess.once("exit", () => {
      this.serverProcess = null;
      this.serverProcessUrl = null;
    });
    await this.waitForHealth(config, OPENCODE_BOOT_TIMEOUT_MS);
  }

  private async waitForHealth(config: ResolvedOpenCodeConfig, timeoutMs: number): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      try {
        await fetchOpenCodeHealth(config);
        return;
      } catch {
        if (this.serverProcess && this.serverProcess.exitCode !== null) {
          throw new Error(
            this.serverOutput.trim().length > 0
              ? `OpenCode exited before becoming ready.\n${this.serverOutput.trim()}`
              : "OpenCode exited before becoming ready.",
          );
        }
        await sleep(250);
      }
    }
    throw new Error("Timed out waiting for OpenCode to become ready.");
  }

  private ensureEventStream(config: ResolvedOpenCodeConfig): void {
    const configKey = JSON.stringify(config);
    if (this.activeEventConfigKey === configKey && this.eventAbortController) {
      return;
    }
    this.stopEventStream();
    this.activeEventConfigKey = configKey;
    this.eventAbortController = new AbortController();
    void this.runEventStream(config, this.eventAbortController.signal);
  }

  private stopEventStream(): void {
    this.eventAbortController?.abort();
    this.eventAbortController = null;
    this.activeEventConfigKey = null;
  }

  private async runEventStream(config: ResolvedOpenCodeConfig, signal: AbortSignal): Promise<void> {
    while (!signal.aborted && !this.disposed) {
      try {
        await streamOpenCodeEvents({
          config,
          signal,
          onEvent: (event) => {
            this.handleEvent(event);
          },
        });
      } catch {
        if (signal.aborted || this.disposed) {
          return;
        }
        await sleep(OPENCODE_EVENT_RETRY_MS);
        continue;
      }
      await sleep(OPENCODE_EVENT_RETRY_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
