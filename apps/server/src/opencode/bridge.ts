import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type {
  OpenCodeAbortSessionInput,
  OpenCodeListAgentsInput,
  OpenCodeCreateSessionInput,
  OpenCodeDeleteSessionInput,
  OpenCodeForkSessionInput,
  OpenCodeEvent,
  OpenCodeGetDiffInput,
  OpenCodeGetVcsInput,
  OpenCodeGetSessionInput,
  OpenCodeGetTodoInput,
  OpenCodeListProjectsInput,
  OpenCodeListPermissionsInput,
  OpenCodeListSessionsInput,
  OpenCodeReplyPermissionInput,
  OpenCodeSendMessageInput,
  OpenCodeStatus,
  OpenCodeUpdateSessionInput,
} from "@t3tools/contracts";
import {
  abortOpenCodeSession,
  createOpenCodeSession,
  deleteOpenCodeSession,
  fetchOpenCodeHealth,
  forkOpenCodeSession,
  getOpenCodeMessages,
  getOpenCodeDiff,
  getOpenCodeSession,
  getOpenCodeTodo,
  getOpenCodeStatuses,
  getOpenCodeVcs,
  listOpenCodeAgents,
  listOpenCodeProviders,
  listOpenCodePermissions,
  listOpenCodeProjects,
  listOpenCodeSessions,
  replyOpenCodePermission,
  sendOpenCodeMessage,
  streamOpenCodeEvents,
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

  async replyPermission(input: OpenCodeReplyPermissionInput) {
    const config = await this.ensureReady(input);
    return replyOpenCodePermission(input, config);
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
