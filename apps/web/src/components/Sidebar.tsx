import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  GitPullRequestIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  SquarePenIcon,
  TerminalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  type DesktopUpdateState,
  ProjectId,
  ThreadId,
  type GitStatusResult,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { buildOpenCodeServerConfigInput, useAppSettings } from "../appSettings";
import { isElectron } from "../env";
import { APP_STAGE_LABEL, APP_VERSION } from "../branding";
import { isMacPlatform, newThreadId } from "../lib/utils";
import { isChatNewLocalShortcut, isChatNewShortcut, shortcutLabelForCommand } from "../keybindings";
import { type Thread } from "../types";
import { derivePendingApprovals, derivePendingUserInputs } from "../session-logic";
import { gitStatusQueryOptions } from "../lib/gitReactQuery";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { readNativeApi } from "../nativeApi";
import { useOpenCodeThreadSource } from "../opencode/hooks";
import { opencodeQueryKeys } from "../opencode/reactQuery";
import { useComposerDraftStore } from "../composerDraftStore";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { toastManager } from "./ui/toast";
import {
  getArm64IntelBuildWarningDescription,
  getDesktopUpdateActionError,
  getDesktopUpdateButtonTooltip,
  isDesktopUpdateButtonDisabled,
  resolveDesktopUpdateButtonAction,
  shouldShowArm64IntelBuildWarning,
  shouldHighlightDesktopUpdateError,
  shouldShowDesktopUpdateButton,
  shouldToastDesktopUpdateActionResult,
} from "./desktopUpdate.logic";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenuAction,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarTrigger,
} from "./ui/sidebar";
import { resolveThreadStatusPill, shouldClearThreadSelectionOnMouseDown } from "./Sidebar.logic";

const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const THREAD_PREVIEW_LIMIT = 6;

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || navigator.clipboard?.writeText === undefined) {
    throw new Error("Clipboard API unavailable.");
  }
  await navigator.clipboard.writeText(text);
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface TerminalStatusIndicator {
  label: "Terminal process running";
  colorClass: string;
  pulse: boolean;
}

interface PrStatusIndicator {
  label: "PR open" | "PR closed" | "PR merged";
  colorClass: string;
  tooltip: string;
  url: string;
}

type ThreadPr = GitStatusResult["pr"];

function threadActivityTimestamp(thread: Thread): number {
  const activityIso = resolveThreadActivityIso(thread);
  if (!activityIso) {
    return 0;
  }
  const timestamp = Date.parse(activityIso);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function resolveThreadActivityIso(thread: Thread): string | null {
  const candidates = [
    thread.latestTurn?.completedAt,
    thread.latestTurn?.startedAt,
    thread.latestTurn?.requestedAt,
    thread.session?.updatedAt,
    thread.lastVisitedAt,
    thread.createdAt,
  ];

  for (const value of candidates) {
    if (!value) {
      continue;
    }
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return value;
    }
  }

  return null;
}

function compareThreadsByActivity(left: Thread, right: Thread): number {
  const byDate = threadActivityTimestamp(right) - threadActivityTimestamp(left);
  if (byDate !== 0) {
    return byDate;
  }
  return right.id.localeCompare(left.id);
}

function orderProjectThreads(threads: Thread[]): Thread[] {
  const byId = new Map(threads.map((thread) => [thread.id, thread] as const));
  const childrenByParentId = new Map<ThreadId, Thread[]>();
  const roots: Thread[] = [];

  for (const thread of threads) {
    const parentId = thread.parentThreadId ?? null;
    if (!parentId || !byId.has(parentId)) {
      roots.push(thread);
      continue;
    }
    const children = childrenByParentId.get(parentId) ?? [];
    children.push(thread);
    childrenByParentId.set(parentId, children);
  }

  const ordered: Thread[] = [];
  const visit = (thread: Thread) => {
    ordered.push(thread);
    const children = childrenByParentId.get(thread.id);
    if (!children) {
      return;
    }
    children.toSorted(compareThreadsByActivity).forEach(visit);
  };

  roots.toSorted(compareThreadsByActivity).forEach(visit);
  return ordered;
}
function terminalStatusFromRunningIds(
  runningTerminalIds: string[],
): TerminalStatusIndicator | null {
  if (runningTerminalIds.length === 0) {
    return null;
  }
  return {
    label: "Terminal process running",
    colorClass: "text-teal-600 dark:text-teal-300/90",
    pulse: true,
  };
}

function prStatusIndicator(pr: ThreadPr): PrStatusIndicator | null {
  if (!pr) return null;

  if (pr.state === "open") {
    return {
      label: "PR open",
      colorClass: "text-emerald-600 dark:text-emerald-300/90",
      tooltip: `#${pr.number} PR open: ${pr.title}`,
      url: pr.url,
    };
  }
  if (pr.state === "closed") {
    return {
      label: "PR closed",
      colorClass: "text-zinc-500 dark:text-zinc-400/80",
      tooltip: `#${pr.number} PR closed: ${pr.title}`,
      url: pr.url,
    };
  }
  if (pr.state === "merged") {
    return {
      label: "PR merged",
      colorClass: "text-violet-600 dark:text-violet-300/90",
      tooltip: `#${pr.number} PR merged: ${pr.title}`,
      url: pr.url,
    };
  }
  return null;
}

function T3Wordmark() {
  return (
    <svg
      aria-label="T3"
      className="h-2.5 w-auto shrink-0 text-foreground"
      viewBox="15.5309 37 94.3941 56.96"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M33.4509 93V47.56H15.5309V37H64.3309V47.56H46.4109V93H33.4509ZM86.7253 93.96C82.832 93.96 78.9653 93.4533 75.1253 92.44C71.2853 91.3733 68.032 89.88 65.3653 87.96L70.4053 78.04C72.5386 79.5867 75.0186 80.8133 77.8453 81.72C80.672 82.6267 83.5253 83.08 86.4053 83.08C89.6586 83.08 92.2186 82.44 94.0853 81.16C95.952 79.88 96.8853 78.12 96.8853 75.88C96.8853 73.7467 96.0586 72.0667 94.4053 70.84C92.752 69.6133 90.0853 69 86.4053 69H80.4853V60.44L96.0853 42.76L97.5253 47.4H68.1653V37H107.365V45.4L91.8453 63.08L85.2853 59.32H89.0453C95.9253 59.32 101.125 60.8667 104.645 63.96C108.165 67.0533 109.925 71.0267 109.925 75.88C109.925 79.0267 109.099 81.9867 107.445 84.76C105.792 87.48 103.259 89.6933 99.8453 91.4C96.432 93.1067 92.0586 93.96 86.7253 93.96Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Derives the server's HTTP origin (scheme + host + port) from the same
 * sources WsTransport uses, converting ws(s) to http(s).
 */
function getServerHttpOrigin(): string {
  const bridgeUrl = window.desktopBridge?.getWsUrl();
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  const wsUrl =
    bridgeUrl && bridgeUrl.length > 0
      ? bridgeUrl
      : envUrl && envUrl.length > 0
        ? envUrl
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:${window.location.port}`;
  // Parse to extract just the origin, dropping path/query (e.g. ?token=…)
  const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  try {
    return new URL(httpUrl).origin;
  } catch {
    return httpUrl;
  }
}

const serverHttpOrigin = getServerHttpOrigin();

function ProjectFavicon({ cwd }: { cwd: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  const src = `${serverHttpOrigin}/api/project-favicon?cwd=${encodeURIComponent(cwd)}`;

  if (status === "error") {
    return <FolderIcon className="size-3.5 shrink-0 text-muted-foreground/50" />;
  }

  return (
    <img
      src={src}
      alt=""
      className={`size-3.5 shrink-0 rounded-sm object-contain ${status === "loading" ? "hidden" : ""}`}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
    />
  );
}

export default function Sidebar() {
  const terminalStateByThreadId = useTerminalStateStore((state) => state.terminalStateByThreadId);
  const navigate = useNavigate();
  const isOnSettings = useLocation({ select: (loc) => loc.pathname === "/settings" });
  const { settings: appSettings } = useAppSettings();
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });
  const { data: keybindings = EMPTY_KEYBINDINGS } = useQuery({
    ...serverConfigQueryOptions(),
    select: (config) => config.keybindings,
  });
  const openCodeState = useOpenCodeThreadSource(routeThreadId ?? undefined);
  const openCodeConfig = useMemo(() => buildOpenCodeServerConfigInput(appSettings), [appSettings]);
  const queryClient = useQueryClient();
  const getDraftThreadByProjectId = useComposerDraftStore(
    (store) => store.getDraftThreadByProjectId,
  );
  const setProjectDraftThreadId = useComposerDraftStore((store) => store.setProjectDraftThreadId);
  const [addingProject, setAddingProject] = useState(false);
  const [newCwd, setNewCwd] = useState("");
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);
  const addProjectInputRef = useRef<HTMLInputElement | null>(null);
  const [renamingThreadId, setRenamingThreadId] = useState<ThreadId | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [expandedThreadListsByProject, setExpandedThreadListsByProject] = useState<
    ReadonlySet<ProjectId>
  >(() => new Set());
  const [openCodeExpandedProjectIds, setOpenCodeExpandedProjectIds] = useState<
    ReadonlySet<ProjectId>
  >(() => new Set());
  const renamingCommittedRef = useRef(false);
  const renamingInputRef = useRef<HTMLInputElement | null>(null);
  const [desktopUpdateState, setDesktopUpdateState] = useState<DesktopUpdateState | null>(null);
  const visibleProjects = openCodeState.projects;
  const visibleThreads = openCodeState.threads;
  const sortedVisibleProjects = useMemo(() => {
    const latestActivityByProjectId = new Map<ProjectId, number>();

    for (const thread of visibleThreads) {
      const timestamp = threadActivityTimestamp(thread);
      const previous = latestActivityByProjectId.get(thread.projectId) ?? 0;
      if (timestamp > previous) {
        latestActivityByProjectId.set(thread.projectId, timestamp);
      }
    }

    return visibleProjects.toSorted((left, right) => {
      const byActivity =
        (latestActivityByProjectId.get(right.id) ?? 0) -
        (latestActivityByProjectId.get(left.id) ?? 0);
      if (byActivity !== 0) {
        return byActivity;
      }
      return left.name.localeCompare(right.name);
    });
  }, [visibleProjects, visibleThreads]);
  const selectedThreadIds = useThreadSelectionStore((s) => s.selectedThreadIds);
  const toggleThreadSelection = useThreadSelectionStore((s) => s.toggleThread);
  const rangeSelectTo = useThreadSelectionStore((s) => s.rangeSelectTo);
  const clearSelection = useThreadSelectionStore((s) => s.clearSelection);
  const removeFromSelection = useThreadSelectionStore((s) => s.removeFromSelection);
  const setSelectionAnchor = useThreadSelectionStore((s) => s.setAnchor);
  const shouldBrowseForProjectImmediately = isElectron;
  const shouldShowProjectPathEntry = addingProject && !shouldBrowseForProjectImmediately;
  const pendingApprovalByThreadId = useMemo(() => {
    const map = new Map<ThreadId, boolean>();
    for (const thread of visibleThreads) {
      if (thread.source === "opencode") {
        map.set(
          thread.id,
          openCodeState.pendingPermissions.some((request) => request.sessionID === thread.id),
        );
        continue;
      }
      map.set(thread.id, derivePendingApprovals(thread.activities).length > 0);
    }
    return map;
  }, [openCodeState.pendingPermissions, visibleThreads]);
  const pendingUserInputByThreadId = useMemo(() => {
    const map = new Map<ThreadId, boolean>();
    for (const thread of visibleThreads) {
      if (thread.source === "opencode") {
        map.set(
          thread.id,
          openCodeState.pendingQuestions.some((request) => request.sessionID === thread.id),
        );
        continue;
      }
      map.set(thread.id, derivePendingUserInputs(thread.activities).length > 0);
    }
    return map;
  }, [openCodeState.pendingQuestions, visibleThreads]);
  const projectCwdById = useMemo(
    () => new Map(sortedVisibleProjects.map((project) => [project.id, project.cwd] as const)),
    [sortedVisibleProjects],
  );
  const threadGitTargets = useMemo(
    () =>
      visibleThreads.map((thread) => ({
        threadId: thread.id,
        branch: thread.branch,
        cwd: thread.worktreePath ?? projectCwdById.get(thread.projectId) ?? null,
      })),
    [projectCwdById, visibleThreads],
  );
  const threadGitStatusCwds = useMemo(
    () => [
      ...new Set(
        threadGitTargets
          .filter((target) => target.branch !== null)
          .map((target) => target.cwd)
          .filter((cwd): cwd is string => cwd !== null),
      ),
    ],
    [threadGitTargets],
  );
  const threadGitStatusQueries = useQueries({
    queries: threadGitStatusCwds.map((cwd) => ({
      ...gitStatusQueryOptions(cwd),
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });
  const prByThreadId = useMemo(() => {
    const statusByCwd = new Map<string, GitStatusResult>();
    for (let index = 0; index < threadGitStatusCwds.length; index += 1) {
      const cwd = threadGitStatusCwds[index];
      if (!cwd) continue;
      const status = threadGitStatusQueries[index]?.data;
      if (status) {
        statusByCwd.set(cwd, status);
      }
    }

    const map = new Map<ThreadId, ThreadPr>();
    for (const target of threadGitTargets) {
      const status = target.cwd ? statusByCwd.get(target.cwd) : undefined;
      const branchMatches =
        target.branch !== null && status?.branch !== null && status?.branch === target.branch;
      map.set(target.threadId, branchMatches ? (status?.pr ?? null) : null);
    }
    return map;
  }, [threadGitStatusCwds, threadGitStatusQueries, threadGitTargets]);

  const openPrLink = useCallback((event: React.MouseEvent<HTMLElement>, prUrl: string) => {
    event.preventDefault();
    event.stopPropagation();

    const api = readNativeApi();
    if (!api) {
      toastManager.add({
        type: "error",
        title: "Link opening is unavailable.",
      });
      return;
    }

    void api.shell.openExternal(prUrl).catch((error) => {
      toastManager.add({
        type: "error",
        title: "Unable to open PR link",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    });
  }, []);
  const refreshOpenCodeQueries = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: opencodeQueryKeys.all });
  }, [queryClient]);

  const handleNewThread = useCallback(
    (projectId: ProjectId): Promise<void> => {
      const project = visibleProjects.find((entry) => entry.id === projectId);
      if (!project) {
        return Promise.resolve();
      }
      return (async () => {
        const existingDraft = getDraftThreadByProjectId(projectId);
        const nextThreadId = existingDraft?.threadId ?? newThreadId();
        if (!existingDraft) {
          setProjectDraftThreadId(projectId, nextThreadId, {
            runtimeMode: "approval-required",
          });
        }
        await navigate({
          to: "/$threadId",
          params: { threadId: nextThreadId },
        });
      })();
    },
    [getDraftThreadByProjectId, navigate, setProjectDraftThreadId, visibleProjects],
  );

  const focusMostRecentThreadForProject = useCallback(
    (projectId: ProjectId) => {
      const draftThread = getDraftThreadByProjectId(projectId);
      if (draftThread) {
        void navigate({
          to: "/$threadId",
          params: { threadId: draftThread.threadId },
        });
        return;
      }

      const latestThread = visibleThreads
        .filter((thread) => thread.projectId === projectId)
        .toSorted((a, b) => {
          const byDate = threadActivityTimestamp(b) - threadActivityTimestamp(a);
          if (byDate !== 0) return byDate;
          return b.id.localeCompare(a.id);
        })[0];
      if (!latestThread) return;

      void navigate({
        to: "/$threadId",
        params: { threadId: latestThread.id },
      });
    },
    [getDraftThreadByProjectId, navigate, visibleThreads],
  );

  const addProjectFromPath = useCallback(
    async (rawCwd: string) => {
      const cwd = rawCwd.trim();
      if (!cwd || isAddingProject) return;
      const api = readNativeApi();
      if (!api) return;

      setIsAddingProject(true);
      const finishAddingProject = () => {
        setIsAddingProject(false);
        setNewCwd("");
        setAddProjectError(null);
        setAddingProject(false);
      };

      const existing = visibleProjects.find((project) => project.cwd === cwd);
      if (existing) {
        focusMostRecentThreadForProject(existing.id);
        finishAddingProject();
        return;
      }

      try {
        const session = await api.opencode.createSession({
          ...openCodeConfig,
          directory: cwd,
        });
        await navigate({
          to: "/$threadId",
          params: { threadId: ThreadId.makeUnsafe(session.id) },
        });
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "An error occurred while adding the project.";
        setIsAddingProject(false);
        if (shouldBrowseForProjectImmediately) {
          toastManager.add({
            type: "error",
            title: "Failed to add project",
            description,
          });
        } else {
          setAddProjectError(description);
        }
        return;
      }
      finishAddingProject();
    },
    [
      focusMostRecentThreadForProject,
      isAddingProject,
      navigate,
      openCodeConfig,
      visibleProjects,
      shouldBrowseForProjectImmediately,
    ],
  );

  const handleAddProject = () => {
    void addProjectFromPath(newCwd);
  };

  const canAddProject = newCwd.trim().length > 0 && !isAddingProject;

  const handlePickFolder = async () => {
    const api = readNativeApi();
    if (!api || isPickingFolder) return;
    setIsPickingFolder(true);
    let pickedPath: string | null = null;
    try {
      pickedPath = await api.dialogs.pickFolder();
    } catch {
      // Ignore picker failures and leave the current thread selection unchanged.
    }
    if (pickedPath) {
      await addProjectFromPath(pickedPath);
    } else if (!shouldBrowseForProjectImmediately) {
      addProjectInputRef.current?.focus();
    }
    setIsPickingFolder(false);
  };

  const handleStartAddProject = () => {
    setAddProjectError(null);
    if (shouldBrowseForProjectImmediately) {
      void handlePickFolder();
      return;
    }
    setAddingProject((prev) => !prev);
  };

  const cancelRename = useCallback(() => {
    setRenamingThreadId(null);
    renamingInputRef.current = null;
  }, []);

  const commitRename = useCallback(
    async (threadId: ThreadId, newTitle: string, originalTitle: string) => {
      const finishRename = () => {
        setRenamingThreadId((current) => {
          if (current !== threadId) return current;
          renamingInputRef.current = null;
          return null;
        });
      };

      const trimmed = newTitle.trim();
      if (trimmed.length === 0) {
        toastManager.add({ type: "warning", title: "Session title cannot be empty" });
        finishRename();
        return;
      }
      if (trimmed === originalTitle) {
        finishRename();
        return;
      }
      const api = readNativeApi();
      if (!api) {
        finishRename();
        return;
      }
      try {
        await api.opencode.updateSession({
          ...openCodeConfig,
          sessionId: threadId,
          title: trimmed,
        });
        await refreshOpenCodeQueries();
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Failed to rename session",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      }
      finishRename();
    },
    [openCodeConfig, refreshOpenCodeQueries],
  );

  /**
   * Delete a single thread: stop session, close terminal, dispatch delete,
   * clean up drafts/state, and optionally remove orphaned worktree.
   * Callers handle thread-level confirmation; this still prompts for worktree removal.
   */
  const deleteThread = useCallback(
    async (
      threadId: ThreadId,
      opts: { deletedThreadIds?: ReadonlySet<ThreadId> } = {},
    ): Promise<void> => {
      const api = readNativeApi();
      if (!api) return;
      const thread = visibleThreads.find((entry) => entry.id === threadId);
      if (!thread) return;

      const allDeletedIds = opts.deletedThreadIds ?? new Set<ThreadId>();
      const shouldNavigateToFallback = routeThreadId === threadId;
      const fallbackThreadId =
        visibleThreads.find((entry) => entry.id !== threadId && !allDeletedIds.has(entry.id))?.id ??
        null;

      await api.opencode.deleteSession({
        ...openCodeConfig,
        sessionId: threadId,
      });
      await refreshOpenCodeQueries();

      if (shouldNavigateToFallback) {
        if (fallbackThreadId) {
          void navigate({
            to: "/$threadId",
            params: { threadId: fallbackThreadId },
            replace: true,
          });
        } else {
          void navigate({ to: "/", replace: true });
        }
      }
    },
    [navigate, openCodeConfig, refreshOpenCodeQueries, routeThreadId, visibleThreads],
  );

  const handleThreadContextMenu = useCallback(
    async (threadId: ThreadId, position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;
      const thread = visibleThreads.find((entry) => entry.id === threadId);
      if (!thread) {
        return;
      }
      const clicked = await api.contextMenu.show(
        [
          { id: "rename", label: "Rename session" },
          { id: "fork", label: "Fork session" },
          thread.session?.shareUrl
            ? { id: "unshare", label: "Remove share link" }
            : { id: "share", label: "Create share link" },
          ...(thread.session?.shareUrl
            ? ([{ id: "copy-share-url", label: "Copy share URL" }] as const)
            : []),
          { id: "copy-thread-id", label: "Copy Session ID" },
          { id: "delete", label: "Delete session", destructive: true },
        ],
        position,
      );
      if (clicked === "rename") {
        setRenamingThreadId(threadId);
        setRenamingTitle(thread.title);
        renamingCommittedRef.current = false;
        return;
      }
      if (clicked === "fork") {
        try {
          const forked = await api.opencode.forkSession({
            ...openCodeConfig,
            sessionId: threadId,
          });
          await refreshOpenCodeQueries();
          await navigate({
            to: "/$threadId",
            params: { threadId: ThreadId.makeUnsafe(forked.id) },
          });
        } catch (error) {
          toastManager.add({
            type: "error",
            title: "Failed to fork session",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        }
        return;
      }
      if (clicked === "share") {
        try {
          const session = await api.opencode.shareSession({
            ...openCodeConfig,
            sessionId: threadId,
          });
          await refreshOpenCodeQueries();
          if (session.share?.url) {
            await copyTextToClipboard(session.share.url);
            toastManager.add({
              type: "success",
              title: "Share link copied",
              description: session.share.url,
            });
          }
        } catch (error) {
          toastManager.add({
            type: "error",
            title: "Failed to share session",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        }
        return;
      }
      if (clicked === "unshare") {
        try {
          await api.opencode.unshareSession({
            ...openCodeConfig,
            sessionId: threadId,
          });
          await refreshOpenCodeQueries();
        } catch (error) {
          toastManager.add({
            type: "error",
            title: "Failed to remove share link",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        }
        return;
      }
      if (clicked === "copy-share-url") {
        if (!thread.session?.shareUrl) {
          return;
        }
        try {
          await copyTextToClipboard(thread.session.shareUrl);
          toastManager.add({
            type: "success",
            title: "Share link copied",
            description: thread.session.shareUrl,
          });
        } catch (error) {
          toastManager.add({
            type: "error",
            title: "Failed to copy share link",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        }
        return;
      }
      if (clicked === "delete") {
        if (appSettings.confirmThreadDelete) {
          const confirmed = await api.dialogs.confirm(
            [
              `Delete session "${thread.title}"?`,
              "This permanently clears conversation history for this session.",
            ].join("\n"),
          );
          if (!confirmed) {
            return;
          }
        }

        try {
          await deleteThread(threadId);
        } catch (error) {
          toastManager.add({
            type: "error",
            title: "Failed to delete session",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        }
        return;
      }
      if (clicked !== "copy-thread-id") {
        return;
      }
      try {
        await copyTextToClipboard(threadId);
        toastManager.add({
          type: "success",
          title: "Session ID copied",
          description: threadId,
        });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Failed to copy session ID",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      }
    },
    [
      appSettings.confirmThreadDelete,
      deleteThread,
      navigate,
      openCodeConfig,
      refreshOpenCodeQueries,
      visibleThreads,
    ],
  );

  const handleMultiSelectContextMenu = useCallback(
    async (position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;
      const ids = [...selectedThreadIds];
      if (ids.length === 0) return;
      const count = ids.length;
      const clicked = await api.contextMenu.show(
        [{ id: "delete", label: `Delete (${count})`, destructive: true }],
        position,
      );
      if (clicked !== "delete") return;

      if (appSettings.confirmThreadDelete) {
        const confirmed = await api.dialogs.confirm(
          [
            `Delete ${count} session${count === 1 ? "" : "s"}?`,
            "This permanently clears conversation history for these sessions.",
          ].join("\n"),
        );
        if (!confirmed) return;
      }

      const deletedIds = new Set<ThreadId>(ids);
      for (const id of ids) {
        await deleteThread(id, { deletedThreadIds: deletedIds });
      }
      removeFromSelection(ids);
    },
    [appSettings.confirmThreadDelete, deleteThread, removeFromSelection, selectedThreadIds],
  );

  const handleThreadClick = useCallback(
    (event: MouseEvent, threadId: ThreadId, orderedProjectThreadIds: readonly ThreadId[]) => {
      const isMac = isMacPlatform(navigator.platform);
      const isModClick = isMac ? event.metaKey : event.ctrlKey;
      const isShiftClick = event.shiftKey;

      if (isModClick) {
        event.preventDefault();
        toggleThreadSelection(threadId);
        return;
      }

      if (isShiftClick) {
        event.preventDefault();
        rangeSelectTo(threadId, orderedProjectThreadIds);
        return;
      }

      if (selectedThreadIds.size > 0) {
        clearSelection();
      }
      setSelectionAnchor(threadId);
      void navigate({
        to: "/$threadId",
        params: { threadId },
      });
    },
    [
      clearSelection,
      navigate,
      rangeSelectTo,
      selectedThreadIds.size,
      setSelectionAnchor,
      toggleThreadSelection,
    ],
  );

  const handleProjectContextMenu = useCallback(
    async (projectId: ProjectId, position: { x: number; y: number }) => {
      void projectId;
      void position;
    },
    [],
  );

  useEffect(() => {
    if (sortedVisibleProjects.length === 0) {
      return;
    }
    setOpenCodeExpandedProjectIds((current) => {
      if (current.size > 0) {
        return current;
      }
      return new Set(sortedVisibleProjects.map((project) => project.id));
    });
  }, [sortedVisibleProjects]);

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedThreadIds.size > 0) {
        event.preventDefault();
        clearSelection();
        return;
      }

      const activeThread = routeThreadId
        ? visibleThreads.find((thread) => thread.id === routeThreadId)
        : undefined;
      if (isChatNewLocalShortcut(event, keybindings)) {
        const projectId = activeThread?.projectId ?? sortedVisibleProjects[0]?.id;
        if (!projectId) return;
        event.preventDefault();
        void handleNewThread(projectId);
        return;
      }

      if (!isChatNewShortcut(event, keybindings)) return;
      const projectId = activeThread?.projectId ?? sortedVisibleProjects[0]?.id;
      if (!projectId) return;
      event.preventDefault();
      void handleNewThread(projectId);
    };

    const onMouseDown = (event: globalThis.MouseEvent) => {
      if (selectedThreadIds.size === 0) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!shouldClearThreadSelectionOnMouseDown(target)) return;
      clearSelection();
    };

    window.addEventListener("keydown", onWindowKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [
    clearSelection,
    handleNewThread,
    keybindings,
    routeThreadId,
    sortedVisibleProjects,
    visibleThreads,
    selectedThreadIds.size,
  ]);

  useEffect(() => {
    if (!isElectron) return;
    const bridge = window.desktopBridge;
    if (
      !bridge ||
      typeof bridge.getUpdateState !== "function" ||
      typeof bridge.onUpdateState !== "function"
    ) {
      return;
    }

    let disposed = false;
    let receivedSubscriptionUpdate = false;
    const unsubscribe = bridge.onUpdateState((nextState) => {
      if (disposed) return;
      receivedSubscriptionUpdate = true;
      setDesktopUpdateState(nextState);
    });

    void bridge
      .getUpdateState()
      .then((nextState) => {
        if (disposed || receivedSubscriptionUpdate) return;
        setDesktopUpdateState(nextState);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const showDesktopUpdateButton = isElectron && shouldShowDesktopUpdateButton(desktopUpdateState);

  const desktopUpdateTooltip = desktopUpdateState
    ? getDesktopUpdateButtonTooltip(desktopUpdateState)
    : "Update available";

  const desktopUpdateButtonDisabled = isDesktopUpdateButtonDisabled(desktopUpdateState);
  const desktopUpdateButtonAction = desktopUpdateState
    ? resolveDesktopUpdateButtonAction(desktopUpdateState)
    : "none";
  const showArm64IntelBuildWarning =
    isElectron && shouldShowArm64IntelBuildWarning(desktopUpdateState);
  const arm64IntelBuildWarningDescription =
    desktopUpdateState && showArm64IntelBuildWarning
      ? getArm64IntelBuildWarningDescription(desktopUpdateState)
      : null;
  const desktopUpdateButtonInteractivityClasses = desktopUpdateButtonDisabled
    ? "cursor-not-allowed opacity-60"
    : "hover:bg-accent hover:text-foreground";
  const desktopUpdateButtonClasses =
    desktopUpdateState?.status === "downloaded"
      ? "text-emerald-500"
      : desktopUpdateState?.status === "downloading"
        ? "text-sky-400"
        : shouldHighlightDesktopUpdateError(desktopUpdateState)
          ? "text-rose-500 animate-pulse"
          : "text-amber-500 animate-pulse";
  const newThreadShortcutLabel = useMemo(
    () =>
      shortcutLabelForCommand(keybindings, "chat.newLocal") ??
      shortcutLabelForCommand(keybindings, "chat.new"),
    [keybindings],
  );

  const handleDesktopUpdateButtonClick = useCallback(() => {
    const bridge = window.desktopBridge;
    if (!bridge || !desktopUpdateState) return;
    if (desktopUpdateButtonDisabled || desktopUpdateButtonAction === "none") return;

    if (desktopUpdateButtonAction === "download") {
      void bridge
        .downloadUpdate()
        .then((result) => {
          if (result.completed) {
            toastManager.add({
              type: "success",
              title: "Update downloaded",
              description: "Restart the app from the update button to install it.",
            });
          }
          if (!shouldToastDesktopUpdateActionResult(result)) return;
          const actionError = getDesktopUpdateActionError(result);
          if (!actionError) return;
          toastManager.add({
            type: "error",
            title: "Could not download update",
            description: actionError,
          });
        })
        .catch((error) => {
          toastManager.add({
            type: "error",
            title: "Could not start update download",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
          });
        });
      return;
    }

    if (desktopUpdateButtonAction === "install") {
      void bridge
        .installUpdate()
        .then((result) => {
          if (!shouldToastDesktopUpdateActionResult(result)) return;
          const actionError = getDesktopUpdateActionError(result);
          if (!actionError) return;
          toastManager.add({
            type: "error",
            title: "Could not install update",
            description: actionError,
          });
        })
        .catch((error) => {
          toastManager.add({
            type: "error",
            title: "Could not install update",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
          });
        });
    }
  }, [desktopUpdateButtonAction, desktopUpdateButtonDisabled, desktopUpdateState]);

  const expandThreadListForProject = useCallback((projectId: ProjectId) => {
    setExpandedThreadListsByProject((current) => {
      if (current.has(projectId)) return current;
      const next = new Set(current);
      next.add(projectId);
      return next;
    });
  }, []);

  const collapseThreadListForProject = useCallback((projectId: ProjectId) => {
    setExpandedThreadListsByProject((current) => {
      if (!current.has(projectId)) return current;
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
  }, []);

  const wordmark = (
    <div className="flex items-center gap-2">
      <SidebarTrigger className="shrink-0 md:hidden" />
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="flex min-w-0 flex-1 items-center gap-1 mt-1.5 ml-1 cursor-pointer">
              <T3Wordmark />
              <span className="truncate text-sm font-medium tracking-tight text-muted-foreground">
                Code
              </span>
              <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                {APP_STAGE_LABEL}
              </span>
            </div>
          }
        />
        <TooltipPopup side="bottom" sideOffset={2}>
          Version {APP_VERSION}
        </TooltipPopup>
      </Tooltip>
    </div>
  );

  return (
    <>
      {isElectron ? (
        <>
          <SidebarHeader className="drag-region h-[52px] flex-row items-center gap-2 px-4 py-0 pl-[90px]">
            {wordmark}
            {showDesktopUpdateButton && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={desktopUpdateTooltip}
                      aria-disabled={desktopUpdateButtonDisabled || undefined}
                      disabled={desktopUpdateButtonDisabled}
                      className={`inline-flex size-7 ml-auto mt-1.5 items-center justify-center rounded-md text-muted-foreground transition-colors ${desktopUpdateButtonInteractivityClasses} ${desktopUpdateButtonClasses}`}
                      onClick={handleDesktopUpdateButtonClick}
                    >
                      <RocketIcon className="size-3.5" />
                    </button>
                  }
                />
                <TooltipPopup side="bottom">{desktopUpdateTooltip}</TooltipPopup>
              </Tooltip>
            )}
          </SidebarHeader>
        </>
      ) : (
        <SidebarHeader className="gap-3 px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-3">
          {wordmark}
        </SidebarHeader>
      )}

      <SidebarContent className="gap-0">
        {showArm64IntelBuildWarning && arm64IntelBuildWarningDescription ? (
          <SidebarGroup className="px-2 pt-2 pb-0">
            <Alert variant="warning" className="rounded-2xl border-warning/40 bg-warning/8">
              <TriangleAlertIcon />
              <AlertTitle>Intel build on Apple Silicon</AlertTitle>
              <AlertDescription>{arm64IntelBuildWarningDescription}</AlertDescription>
              {desktopUpdateButtonAction !== "none" ? (
                <AlertAction>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={desktopUpdateButtonDisabled}
                    onClick={handleDesktopUpdateButtonClick}
                  >
                    {desktopUpdateButtonAction === "download"
                      ? "Download ARM build"
                      : "Install ARM build"}
                  </Button>
                </AlertAction>
              ) : null}
            </Alert>
          </SidebarGroup>
        ) : null}
        <SidebarGroup className="px-2 py-2">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Projects
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="Add project"
                    aria-pressed={shouldShowProjectPathEntry}
                    className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                    onClick={handleStartAddProject}
                  />
                }
              >
                <PlusIcon
                  className={`size-3.5 transition-transform duration-150 ${
                    shouldShowProjectPathEntry ? "rotate-45" : "rotate-0"
                  }`}
                />
              </TooltipTrigger>
              <TooltipPopup side="right">Add project</TooltipPopup>
            </Tooltip>
          </div>

          {shouldShowProjectPathEntry && (
            <div className="mb-2 px-1">
              {isElectron && (
                <button
                  type="button"
                  className="mb-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary py-1.5 text-xs text-foreground/80 transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handlePickFolder()}
                  disabled={isPickingFolder || isAddingProject}
                >
                  <FolderIcon className="size-3.5" />
                  {isPickingFolder ? "Picking folder..." : "Browse for folder"}
                </button>
              )}
              <div className="flex gap-1.5">
                <input
                  ref={addProjectInputRef}
                  className={`min-w-0 flex-1 rounded-md border bg-secondary px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none ${
                    addProjectError
                      ? "border-red-500/70 focus:border-red-500"
                      : "border-border focus:border-ring"
                  }`}
                  placeholder="/path/to/project"
                  value={newCwd}
                  onChange={(event) => {
                    setNewCwd(event.target.value);
                    setAddProjectError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleAddProject();
                    if (event.key === "Escape") {
                      setAddingProject(false);
                      setAddProjectError(null);
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-60"
                  onClick={handleAddProject}
                  disabled={!canAddProject}
                >
                  {isAddingProject ? "Adding..." : "Add"}
                </button>
              </div>
              {addProjectError && (
                <p className="mt-1 px-0.5 text-[11px] leading-tight text-red-400">
                  {addProjectError}
                </p>
              )}
              <div className="mt-1.5 px-0.5">
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                  onClick={() => {
                    setAddingProject(false);
                    setAddProjectError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <SidebarMenu>
            {sortedVisibleProjects.map((project) => {
              const projectThreads = visibleThreads.filter(
                (thread) => thread.projectId === project.id,
              );
              const orderedProjectThreads = orderProjectThreads(projectThreads);
              const visibleProjectThreads =
                projectThreads.length > THREAD_PREVIEW_LIMIT &&
                !expandedThreadListsByProject.has(project.id)
                  ? orderedProjectThreads.slice(0, THREAD_PREVIEW_LIMIT)
                  : orderedProjectThreads;
              const orderedProjectThreadIds = orderedProjectThreads.map((thread) => thread.id);
              const isThreadListExpanded = expandedThreadListsByProject.has(project.id);
              const hasHiddenThreads = projectThreads.length > THREAD_PREVIEW_LIMIT;
              const projectExpanded = openCodeExpandedProjectIds.has(project.id);

              return (
                <Collapsible
                  key={project.id}
                  className="group/collapsible"
                  open={projectExpanded}
                  onOpenChange={(open) => {
                    setOpenCodeExpandedProjectIds((current) => {
                      const next = new Set(current);
                      if (open) {
                        next.add(project.id);
                      } else {
                        next.delete(project.id);
                      }
                      return next;
                    });
                  }}
                >
                  <SidebarMenuItem>
                    <div className="group/project-header relative">
                      <CollapsibleTrigger
                        render={
                          <SidebarMenuButton
                            size="sm"
                            className="gap-2 px-2 py-1.5 text-left hover:bg-accent group-hover/project-header:bg-accent group-hover/project-header:text-sidebar-accent-foreground"
                          />
                        }
                        onContextMenu={(event) => {
                          event.preventDefault();
                          void handleProjectContextMenu(project.id, {
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                      >
                        <ChevronRightIcon
                          className={`-ml-0.5 size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-150 ${
                            projectExpanded ? "rotate-90" : ""
                          }`}
                        />
                        <ProjectFavicon cwd={project.cwd} />
                        <span className="flex-1 truncate text-xs font-medium text-foreground/90">
                          {project.name}
                        </span>
                      </CollapsibleTrigger>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <SidebarMenuAction
                              render={
                                <button
                                  type="button"
                                  aria-label={`Create new thread in ${project.name}`}
                                  data-testid="new-thread-button"
                                />
                              }
                              showOnHover
                              className="top-1 right-1 size-5 rounded-md p-0 text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleNewThread(project.id);
                              }}
                            >
                              <SquarePenIcon className="size-3.5" />
                            </SidebarMenuAction>
                          }
                        />
                        <TooltipPopup side="top">
                          {newThreadShortcutLabel
                            ? `New thread (${newThreadShortcutLabel})`
                            : "New thread"}
                        </TooltipPopup>
                      </Tooltip>
                    </div>

                    <CollapsibleContent keepMounted>
                      <SidebarMenuSub className="mx-1 my-0 w-full translate-x-0 gap-0.5 px-1.5 py-0">
                        {visibleProjectThreads.map((thread) => {
                          const isActive = routeThreadId === thread.id;
                          const isSelected = selectedThreadIds.has(thread.id);
                          const isHighlighted = isActive || isSelected;
                          const threadStatus = resolveThreadStatusPill({
                            thread,
                            hasPendingApprovals: pendingApprovalByThreadId.get(thread.id) === true,
                            hasPendingUserInput: pendingUserInputByThreadId.get(thread.id) === true,
                          });
                          const prStatus = prStatusIndicator(prByThreadId.get(thread.id) ?? null);
                          const terminalStatus = terminalStatusFromRunningIds(
                            selectThreadTerminalState(terminalStateByThreadId, thread.id)
                              .runningTerminalIds,
                          );

                          return (
                            <SidebarMenuSubItem key={thread.id} className="w-full" data-thread-item>
                              <SidebarMenuSubButton
                                render={<div role="button" tabIndex={0} />}
                                size="sm"
                                isActive={isActive}
                                className={`h-7 w-full translate-x-0 cursor-default justify-start px-2 text-left select-none hover:bg-accent hover:text-foreground focus-visible:ring-0 ${
                                  isSelected
                                    ? "bg-primary/15 text-foreground dark:bg-primary/10"
                                    : isActive
                                      ? "bg-accent/85 text-foreground font-medium dark:bg-accent/55"
                                      : "text-muted-foreground"
                                }`}
                                onClick={(event) => {
                                  handleThreadClick(event, thread.id, orderedProjectThreadIds);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  if (selectedThreadIds.size > 0) {
                                    clearSelection();
                                  }
                                  setSelectionAnchor(thread.id);
                                  void navigate({
                                    to: "/$threadId",
                                    params: { threadId: thread.id },
                                  });
                                }}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  if (
                                    selectedThreadIds.size > 0 &&
                                    selectedThreadIds.has(thread.id)
                                  ) {
                                    void handleMultiSelectContextMenu({
                                      x: event.clientX,
                                      y: event.clientY,
                                    });
                                    return;
                                  }
                                  if (selectedThreadIds.size > 0) {
                                    clearSelection();
                                  }
                                  void handleThreadContextMenu(thread.id, {
                                    x: event.clientX,
                                    y: event.clientY,
                                  });
                                }}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                                  {prStatus && (
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <button
                                            type="button"
                                            aria-label={prStatus.tooltip}
                                            className={`inline-flex items-center justify-center ${prStatus.colorClass} cursor-pointer rounded-sm outline-hidden focus-visible:ring-1 focus-visible:ring-ring`}
                                            onClick={(event) => {
                                              openPrLink(event, prStatus.url);
                                            }}
                                          >
                                            <GitPullRequestIcon className="size-3" />
                                          </button>
                                        }
                                      />
                                      <TooltipPopup side="top">{prStatus.tooltip}</TooltipPopup>
                                    </Tooltip>
                                  )}
                                  {threadStatus && (
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] ${threadStatus.colorClass}`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${threadStatus.dotClass} ${
                                          threadStatus.pulse ? "animate-pulse" : ""
                                        }`}
                                      />
                                      <span className="hidden md:inline">{threadStatus.label}</span>
                                    </span>
                                  )}
                                  {renamingThreadId === thread.id ? (
                                    <input
                                      ref={(element) => {
                                        if (element && renamingInputRef.current !== element) {
                                          renamingInputRef.current = element;
                                          element.focus();
                                          element.select();
                                        }
                                      }}
                                      className="min-w-0 flex-1 truncate rounded border border-ring bg-transparent px-0.5 text-xs outline-none"
                                      value={renamingTitle}
                                      onChange={(event) => setRenamingTitle(event.target.value)}
                                      onKeyDown={(event) => {
                                        event.stopPropagation();
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          renamingCommittedRef.current = true;
                                          void commitRename(thread.id, renamingTitle, thread.title);
                                          return;
                                        }
                                        if (event.key !== "Escape") return;
                                        event.preventDefault();
                                        renamingCommittedRef.current = true;
                                        cancelRename();
                                      }}
                                      onBlur={() => {
                                        if (!renamingCommittedRef.current) {
                                          void commitRename(thread.id, renamingTitle, thread.title);
                                        }
                                      }}
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                  ) : (
                                    <span className="min-w-0 flex-1 truncate text-xs">
                                      {thread.title}
                                    </span>
                                  )}
                                </div>
                                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                  {terminalStatus && (
                                    <span
                                      role="img"
                                      aria-label={terminalStatus.label}
                                      title={terminalStatus.label}
                                      className={`inline-flex items-center justify-center ${terminalStatus.colorClass}`}
                                    >
                                      <TerminalIcon
                                        className={`size-3 ${terminalStatus.pulse ? "animate-pulse" : ""}`}
                                      />
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] ${
                                      isHighlighted
                                        ? "text-foreground/65"
                                        : "text-muted-foreground/40"
                                    }`}
                                  >
                                    {formatRelativeTime(resolveThreadActivityIso(thread) ?? thread.createdAt)}
                                  </span>
                                </div>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}

                        {hasHiddenThreads && !isThreadListExpanded && (
                          <SidebarMenuSubItem className="w-full">
                            <SidebarMenuSubButton
                              render={<button type="button" />}
                              data-thread-selection-safe
                              size="sm"
                              className="h-6 w-full translate-x-0 justify-start px-2 text-left text-[10px] text-muted-foreground/60 hover:bg-accent hover:text-muted-foreground/80"
                              onClick={() => {
                                expandThreadListForProject(project.id);
                              }}
                            >
                              <span>Show more</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        {hasHiddenThreads && isThreadListExpanded && (
                          <SidebarMenuSubItem className="w-full">
                            <SidebarMenuSubButton
                              render={<button type="button" />}
                              data-thread-selection-safe
                              size="sm"
                              className="h-6 w-full translate-x-0 justify-start px-2 text-left text-[10px] text-muted-foreground/60 hover:bg-accent hover:text-muted-foreground/80"
                              onClick={() => {
                                collapseThreadListForProject(project.id);
                              }}
                            >
                              <span>Show less</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>

          {sortedVisibleProjects.length === 0 && !shouldShowProjectPathEntry && (
            <div className="px-2 pt-4 text-center text-xs text-muted-foreground/60">
              No OpenCode projects yet.
              <br />
              Create a session in a folder to get started.
            </div>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {isOnSettings ? (
              <SidebarMenuButton
                size="sm"
                className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                onClick={() => window.history.back()}
              >
                <ArrowLeftIcon className="size-3.5" />
                <span className="text-xs">Back</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                size="sm"
                className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                onClick={() => void navigate({ to: "/settings" })}
              >
                <SettingsIcon className="size-3.5" />
                <span className="text-xs">Settings</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
