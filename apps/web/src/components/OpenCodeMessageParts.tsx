import type { OpenCodeMessagePart } from "@t3tools/contracts";
import ChatMarkdown from "./ChatMarkdown";

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function renderToolState(part: OpenCodeMessagePart): { status: string; detail?: string } | null {
  const state = part.state;
  if (!isRecord(state)) {
    return null;
  }
  const status = typeof state.status === "string" ? state.status : "unknown";
  if (status === "completed") {
    return {
      status,
      detail: typeof state.output === "string" ? state.output : stringifyUnknown(state.output),
    };
  }
  if (status === "error") {
    return {
      status,
      detail: typeof state.error === "string" ? state.error : stringifyUnknown(state.error),
    };
  }
  if (status === "running" || status === "pending") {
    const detail = typeof state.title === "string" ? state.title : undefined;
    return detail ? { status, detail } : { status };
  }
  return {
    status,
    detail: stringifyUnknown(state),
  };
}

export default function OpenCodeMessageParts(props: {
  parts: ReadonlyArray<OpenCodeMessagePart>;
  cwd: string | undefined;
}) {
  const visibleParts = props.parts.filter((part) => part.type !== "text");
  if (visibleParts.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {visibleParts.map((part, index) => {
        const key = part.id ?? part.callID ?? `${part.type}-${index}`;

        if (part.type === "reasoning") {
          return (
            <div key={key} className="rounded-lg border border-border/70 bg-card/50 px-3 py-2">
              <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Reasoning
              </p>
              <ChatMarkdown text={part.text ?? ""} cwd={props.cwd} isStreaming={false} />
            </div>
          );
        }

        if (part.type === "tool") {
          const toolState = renderToolState(part);
          return (
            <div key={key} className="rounded-lg border border-border/70 bg-card/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Tool
                </p>
                <span className="text-[10px] text-muted-foreground/60">
                  {toolState?.status ?? "unknown"}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-foreground">{part.tool ?? "unknown"}</p>
              {toolState?.detail ? (
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
                  {toolState.detail}
                </pre>
              ) : null}
            </div>
          );
        }

        if (part.type === "patch") {
          const files = Array.isArray((part as { files?: unknown }).files)
            ? ((part as { files?: unknown[] }).files ?? []).filter(
                (value): value is string => typeof value === "string",
              )
            : [];
          return (
            <div
              key={key}
              className="rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs"
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Patch
              </p>
              <p className="mt-1 text-foreground">
                Applied changes to {files.length || 1} file(s).
              </p>
              {files.length > 0 ? (
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
                  {files.join("\n")}
                </pre>
              ) : null}
            </div>
          );
        }

        if (part.type === "file") {
          const label =
            part.path ??
            (typeof part.metadata === "string" ? part.metadata : undefined) ??
            "Attachment";
          return (
            <div
              key={key}
              className="rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs text-foreground"
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                File
              </p>
              <p className="mt-1 break-all">{label}</p>
            </div>
          );
        }

        if (part.type === "subtask") {
          const metadata = isRecord(part.metadata) ? part.metadata : null;
          const description =
            typeof metadata?.description === "string" ? metadata.description : null;
          const agent = typeof metadata?.agent === "string" ? metadata.agent : null;
          return (
            <div
              key={key}
              className="rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs text-foreground"
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Subtask
              </p>
              {description ? <p className="mt-1">{description}</p> : null}
              {agent ? <p className="mt-1 text-muted-foreground">Agent: {agent}</p> : null}
            </div>
          );
        }

        if (part.type === "retry") {
          return (
            <div
              key={key}
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300/80">
                Retry
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-words text-amber-800 dark:text-amber-200/90">
                {stringifyUnknown(part.state ?? part.metadata ?? null)}
              </pre>
            </div>
          );
        }

        if (part.type === "snapshot") {
          return (
            <details
              key={key}
              className="rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs"
            >
              <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Snapshot
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
                {part.snapshot ?? ""}
              </pre>
            </details>
          );
        }

        if (part.type === "agent") {
          const label =
            typeof part.metadata === "string" ? part.metadata : (part.text ?? "Agent updated");
          return (
            <div
              key={key}
              className="rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs text-foreground"
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Agent
              </p>
              <p className="mt-1">{label}</p>
            </div>
          );
        }

        if (part.type === "compaction") {
          return (
            <div
              key={key}
              className="rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs text-muted-foreground"
            >
              Conversation context was compacted.
            </div>
          );
        }

        if (part.type === "step-start" || part.type === "step-finish") {
          return (
            <div
              key={key}
              className="rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs text-muted-foreground"
            >
              {part.type === "step-start" ? "Started a step." : "Completed a step."}
            </div>
          );
        }

        return (
          <details
            key={key}
            className="rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-xs"
          >
            <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              {part.type}
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
              {stringifyUnknown(part)}
            </pre>
          </details>
        );
      })}
    </div>
  );
}
