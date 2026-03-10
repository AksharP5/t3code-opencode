# T3Code x OpenCode Guide

This project gives you the T3Code UI and desktop experience on top of canonical OpenCode sessions.

## Mental model

- OpenCode owns the real session state
- T3Code owns the richer UI shell
- the same session can be opened in either app

## Current capabilities

- continue existing OpenCode sessions in T3
- switch back to OpenCode without losing continuity
- choose providers, models, and agents from canonical OpenCode data
- use plan mode and normal chat mode
- answer approvals and question prompts in the composer
- manage worktrees and forked session flows
- inspect todos, changed files, plans, and projected work activity
- share, unshare, revert, and restore sessions
- manage provider auth and MCP auth from settings
- use OpenCode commands and MCP resources from the T3 composer

## Best rollout for other users

If you want other people to use this with the least friction, the best approach is:

1. provide a desktop build of this repo
2. provide clear OpenCode setup instructions or bundle a supported local OpenCode install path
3. default the app to a local OpenCode server URL
4. keep auto-start enabled when appropriate
5. document the paired OpenCode backend branch users should run

In practice, the easiest experience for a new user is:

- launch the desktop app
- point it at a running OpenCode server, or let it auto-start one
- open an existing session or create a new one

## Settings that matter most

- OpenCode server URL
- OpenCode password
- OpenCode workspace ID
- provider connections
- MCP server auth and connectivity

## Development workflow

- merge official T3Code upstream into `opencode`
- merge official OpenCode upstream into `t3code`
- adapt this integration around upstream behavior
- keep commits small and scoped

## Project status

This fork is intended to feel seamless for normal OpenCode-backed usage.

Remaining work should be treated as polish, completeness, or future product refinement unless the living plan says otherwise.
