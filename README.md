# T3Code x OpenCode

`t3code-opencode` is a detached product fork that keeps the T3Code UI and desktop shell, but uses canonical OpenCode sessions, events, models, agents, MCP state, and runtime semantics underneath.

The goal is simple:

- use T3Code as the rich UI shell
- keep OpenCode as the source of truth
- move between T3Code and OpenCode on the same session without restarts, migrations, or broken continuity

## What this project is

- T3Code-first UI for OpenCode sessions
- detached standalone repo, not a GitHub fork
- continuously merged with official T3Code upstream
- paired with a separate OpenCode fork that is continuously merged with official OpenCode upstream

## What works now

- open existing OpenCode sessions in the native T3 chat UI
- continue the same canonical session in T3 and reopen it in OpenCode
- provider and model discovery from OpenCode
- explicit OpenCode agent selection from T3
- plan/chat mode parity using canonical OpenCode agents
- runtime permission mode parity
- OpenCode approvals and question prompts in the T3 composer
- session rename, delete, fork, share, unshare, revert, unrevert
- session todos, diffs, plan replies, lightweight activity projection, and turn summaries
- OpenCode session tree visibility in the sidebar
- worktree-aware draft flows and forked OpenCode worktree sessions
- provider auth management from T3 settings
- MCP auth/connect/disconnect management from T3 settings
- OpenCode slash workflows from the T3 composer, including command-backed flows
- OpenCode command catalog and MCP resource prompt integration

## Best way for others to use this

The easiest path is:

1. use this repo as the T3Code desktop/web shell
2. use the paired OpenCode fork as the backend source of truth
3. keep both repos on their long-lived integration branches
4. regularly merge official upstream changes into both repos

Recommended setup for a new user:

- install Bun
- install or build OpenCode locally
- clone this repo
- clone the paired OpenCode repo
- run this repo in desktop mode or dev mode
- point T3Code settings at the OpenCode server, or enable auto-start for local `opencode serve`

## Quick start

Install dependencies:

```bash
bun install
```

Run the app in development:

```bash
bun dev
```

Run the desktop app in development:

```bash
bun dev:desktop
```

If you already have OpenCode serving locally, configure it in Settings.

If you do not, enable auto-start and make sure `opencode serve` is available on your machine.

## Recommended operating model

- keep `AksharP5/t3code-opencode` on branch `opencode`
- keep the OpenCode fork on branch `t3code`
- merge official T3Code `upstream/main` into `opencode`
- merge official OpenCode `origin/dev` into `t3code`
- preserve upstream behavior and layer this integration on top instead of deleting upstream features

## Repo map

- `apps/web` - T3Code React UI adapted for canonical OpenCode sessions
- `apps/server` - T3Code server bridge and OpenCode transport
- `apps/desktop` - desktop shell
- `packages/contracts` - shared schemas and IPC/WS contracts
- `packages/shared` - shared runtime helpers

## Documentation

- integration plan and living project state: `.dev/t3code-x-opencode-plan.md`
- user-facing project guide: `docs/t3code-opencode.md`
- release workflow notes: `docs/release.md`

## Verification standard

Before calling integration work complete:

- `bun lint`
- `bun typecheck`

When changing OpenCode integration behavior, also run focused tests where relevant.

## Notes

- this project is intentionally OpenCode-first
- this repo is not trying to upstream itself as a PR
- upstream changes from both projects should keep flowing in
