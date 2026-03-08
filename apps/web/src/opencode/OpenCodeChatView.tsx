import { type ThreadId } from "@t3tools/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { CircleAlertIcon, LoaderCircleIcon, SquareIcon, TerminalIcon } from "lucide-react";
import ChatMarkdown from "../components/ChatMarkdown";
import GitActionsControl from "../components/GitActionsControl";
import { buildOpenCodeServerConfigInput, useAppSettings } from "../appSettings";
import { ensureNativeApi } from "../nativeApi";
import { useOpenCodeThreadSource } from "./hooks";
import { preferredTerminalEditor } from "../terminal-links";
import { toastManager } from "../components/ui/toast";
import ThreadTerminalDrawer from "../components/ThreadTerminalDrawer";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";

interface OpenCodeChatViewProps {
  threadId: ThreadId;
}

export default function OpenCodeChatView({ threadId }: OpenCodeChatViewProps) {
  const { settings } = useAppSettings();
  const config = useMemo(() => buildOpenCodeServerConfigInput(settings), [settings]);
  const { status, activeThread, projects, threadsHydrated } = useOpenCodeThreadSource(threadId);
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [terminalFocusRequestId, setTerminalFocusRequestId] = useState(0);
  const activeProject = projects.find((project) => project.id === activeThread?.projectId) ?? null;
  const gitCwd = activeProject?.cwd ?? null;
  const canSend = prompt.trim().length > 0 && !pending && activeThread !== null;
  const isRunning = activeThread?.session?.status === "running";
  const terminalState = useTerminalStateStore((state) =>
    selectThreadTerminalState(state.terminalStateByThreadId, threadId),
  );
  const storeSetTerminalOpen = useTerminalStateStore((state) => state.setTerminalOpen);
  const storeSetTerminalHeight = useTerminalStateStore((state) => state.setTerminalHeight);
  const storeSplitTerminal = useTerminalStateStore((state) => state.splitTerminal);
  const storeNewTerminal = useTerminalStateStore((state) => state.newTerminal);
  const storeSetActiveTerminal = useTerminalStateStore((state) => state.setActiveTerminal);
  const storeCloseTerminal = useTerminalStateStore((state) => state.closeTerminal);

  useEffect(() => {
    setLocalError(null);
  }, [threadId]);

  const openProjectInEditor = async () => {
    if (!gitCwd) {
      return;
    }
    try {
      await ensureNativeApi().shell.openInEditor(gitCwd, preferredTerminalEditor());
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Unable to open project",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const setTerminalOpen = useCallback(
    (open: boolean) => {
      storeSetTerminalOpen(threadId, open);
    },
    [storeSetTerminalOpen, threadId],
  );

  const setTerminalHeight = useCallback(
    (height: number) => {
      storeSetTerminalHeight(threadId, height);
    },
    [storeSetTerminalHeight, threadId],
  );

  const splitTerminal = useCallback(() => {
    const terminalId = `terminal-${crypto.randomUUID()}`;
    storeSplitTerminal(threadId, terminalId);
    setTerminalFocusRequestId((value) => value + 1);
  }, [storeSplitTerminal, threadId]);

  const createNewTerminal = useCallback(() => {
    const terminalId = `terminal-${crypto.randomUUID()}`;
    storeNewTerminal(threadId, terminalId);
    setTerminalFocusRequestId((value) => value + 1);
  }, [storeNewTerminal, threadId]);

  const activateTerminal = useCallback(
    (terminalId: string) => {
      storeSetActiveTerminal(threadId, terminalId);
      setTerminalFocusRequestId((value) => value + 1);
    },
    [storeSetActiveTerminal, threadId],
  );

  const closeTerminal = useCallback(
    (terminalId: string) => {
      const api = ensureNativeApi();
      const isFinalTerminal = terminalState.terminalIds.length <= 1;
      const fallbackExitWrite = () =>
        api.terminal.write({ threadId, terminalId, data: "exit\n" }).catch(() => undefined);
      if (typeof api.terminal.close === "function") {
        void (async () => {
          if (isFinalTerminal) {
            await api.terminal.clear({ threadId, terminalId }).catch(() => undefined);
          }
          await api.terminal.close({ threadId, terminalId, deleteHistory: true });
        })().catch(() => fallbackExitWrite());
      } else {
        void fallbackExitWrite();
      }
      storeCloseTerminal(threadId, terminalId);
      setTerminalFocusRequestId((value) => value + 1);
    },
    [storeCloseTerminal, terminalState.terminalIds.length, threadId],
  );

  const sendMessage = async () => {
    const text = prompt.trim();
    if (!text || !activeThread) {
      return;
    }

    setPending(true);
    setLocalError(null);
    try {
      await ensureNativeApi().opencode.sendMessage({
        ...config,
        sessionId: activeThread.id,
        text,
      });
      setPrompt("");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Failed to send message.");
    }
    setPending(false);
  };

  const abortSession = async () => {
    if (!activeThread) {
      return;
    }
    try {
      await ensureNativeApi().opencode.abortSession({
        ...config,
        sessionId: activeThread.id,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Failed to stop session.");
    }
  };

  if (!threadsHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading OpenCode session...
      </div>
    );
  }

  if (!status?.healthy) {
    return (
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0 md:hidden" />
            <h2 className="text-sm font-medium">OpenCode</h2>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4">
          <Alert variant="error">
            <CircleAlertIcon />
            <AlertTitle>OpenCode is unavailable</AlertTitle>
            <AlertDescription>
              {status?.message ?? "T3 Code could not reach the configured OpenCode server."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!activeThread) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        This OpenCode session is unavailable.
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-7 shrink-0 md:hidden" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-medium">{activeThread.title}</h2>
              {activeProject ? <Badge variant="outline">{activeProject.name}</Badge> : null}
              <Badge variant="outline">OpenCode</Badge>
            </div>
            {gitCwd ? <p className="truncate text-xs text-muted-foreground">{gitCwd}</p> : null}
          </div>
          {gitCwd ? (
            <Button type="button" size="xs" variant="outline" onClick={() => void openProjectInEditor()}>
              Open folder
            </Button>
          ) : null}
          {gitCwd ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setTerminalOpen(!terminalState.terminalOpen)}
            >
              <TerminalIcon className="size-3.5" />
              {terminalState.terminalOpen ? "Hide terminal" : "Terminal"}
            </Button>
          ) : null}
          {gitCwd ? <GitActionsControl gitCwd={gitCwd} activeThreadId={activeThread.id} /> : null}
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-4">
        <div className="mb-3">
          <Alert>
            <AlertTitle>OpenCode-backed thread</AlertTitle>
            <AlertDescription>
              This session stays canonical in OpenCode. Branch selection, plan mode, diff view, and
              image uploads stay disabled here for now.
            </AlertDescription>
          </Alert>
        </div>

        {localError ? (
          <div className="mb-3">
            <Alert variant="error">
              <CircleAlertIcon />
              <AlertDescription>{localError}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
          {activeThread.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No messages yet.
            </div>
          ) : (
            activeThread.messages.map((message) => (
              <article
                key={message.id}
                className="rounded-2xl border border-border bg-card px-4 py-3 shadow-xs"
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide">{message.role}</span>
                  <span>{new Date(message.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm leading-6 text-foreground">
                  <ChatMarkdown text={message.text || "..."} cwd={gitCwd ?? undefined} />
                </div>
              </article>
            ))
          )}
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{isRunning ? "OpenCode is responding..." : "Continue this OpenCode session"}</span>
            {isRunning ? (
              <Button type="button" size="xs" variant="outline" onClick={() => void abortSession()}>
                <SquareIcon className="size-3" />
                Stop
              </Button>
            ) : null}
          </div>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Send a follow-up to OpenCode..."
              className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-ring"
              disabled={pending}
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="submit" disabled={!canSend}>
                {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
                {pending ? "Sending..." : "Send"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {terminalState.terminalOpen && gitCwd ? (
        <ThreadTerminalDrawer
          key={threadId}
          threadId={threadId}
          cwd={gitCwd}
          height={terminalState.terminalHeight}
          terminalIds={terminalState.terminalIds}
          activeTerminalId={terminalState.activeTerminalId}
          terminalGroups={terminalState.terminalGroups}
          activeTerminalGroupId={terminalState.activeTerminalGroupId}
          focusRequestId={terminalFocusRequestId}
          onSplitTerminal={splitTerminal}
          onNewTerminal={createNewTerminal}
          onActiveTerminalChange={activateTerminal}
          onCloseTerminal={closeTerminal}
          onHeightChange={setTerminalHeight}
        />
      ) : null}
    </div>
  );
}
