import { type ThreadId } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const OPENCODE_OVERLAY_STORAGE_KEY = "t3code:opencode-overlay:v1";

interface OpenCodeOverlayState {
  lastVisitedAtByThreadId: Record<ThreadId, string>;
  markThreadVisited: (threadId: ThreadId, visitedAt?: string) => void;
}

function shouldReplaceVisitedAt(previous: string | undefined, next: string): boolean {
  const previousMs = previous ? Date.parse(previous) : Number.NaN;
  const nextMs = Date.parse(next);
  if (!Number.isFinite(nextMs)) {
    return false;
  }
  if (!Number.isFinite(previousMs)) {
    return true;
  }
  return nextMs > previousMs;
}

export const useOpenCodeOverlayStore = create<OpenCodeOverlayState>()(
  persist(
    (set) => ({
      lastVisitedAtByThreadId: {},
      markThreadVisited: (threadId, visitedAt) => {
        const nextVisitedAt = visitedAt ?? new Date().toISOString();
        set((state) => {
          const previousVisitedAt = state.lastVisitedAtByThreadId[threadId];
          if (!shouldReplaceVisitedAt(previousVisitedAt, nextVisitedAt)) {
            return state;
          }
          return {
            lastVisitedAtByThreadId: {
              ...state.lastVisitedAtByThreadId,
              [threadId]: nextVisitedAt,
            },
          };
        });
      },
    }),
    {
      name: OPENCODE_OVERLAY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lastVisitedAtByThreadId: state.lastVisitedAtByThreadId,
      }),
    },
  ),
);
