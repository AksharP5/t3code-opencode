import { type ProjectScript } from "../types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const OPENCODE_PROJECT_OVERLAY_STORAGE_KEY = "t3code:opencode-project-overlay:v1";

interface OpenCodeProjectOverlayState {
  scriptsByProjectCwd: Record<string, ProjectScript[]>;
  setProjectScripts: (projectCwd: string, scripts: ProjectScript[]) => void;
}

export const useOpenCodeProjectOverlayStore = create<OpenCodeProjectOverlayState>()(
  persist(
    (set) => ({
      scriptsByProjectCwd: {},
      setProjectScripts: (projectCwd, scripts) => {
        set((state) => ({
          scriptsByProjectCwd: {
            ...state.scriptsByProjectCwd,
            [projectCwd]: scripts.map((script) => ({ ...script })),
          },
        }));
      },
    }),
    {
      name: OPENCODE_PROJECT_OVERLAY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scriptsByProjectCwd: state.scriptsByProjectCwd,
      }),
    },
  ),
);
