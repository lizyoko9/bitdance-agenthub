# AgentHub OpenSpec Project

## Purpose

AgentHub is a local multi-agent collaboration app that turns agent work into an IM-style workspace. Users create single-agent or group conversations, route messages to Claude Code, Codex, or custom OpenAI-compatible agents, preview generated artifacts, and approve file changes inside local workspaces.

## Canonical Spec Layout

OpenSpec capability specs under `openspec/specs/` are the concise, testable contract layer. The legacy numbered docs under `specs/` remain the detailed design/reference layer until they are fully folded into OpenSpec.

| OpenSpec capability | Legacy source |
|---|---|
| `core-domain` | `specs/01-core-entities.md` |
| `stream-events` | `specs/02-stream-events.md` |
| `message-parts` | `specs/03-message-parts.md` |
| `artifacts` | `specs/04-artifacts.md` |
| `adapters` | `specs/05-adapter-interface.md` |
| `terminal-bench-evaluation` | `eval/terminalbench/README.md` |
| `tracetrial-evaluation` | `eval/tracetrial/README.md` |
| `delivery-validation` | `specs/17-delivery-validation.md` |
| `orchestrator` | `specs/06-orchestrator-flow.md` |
| `tools` | `specs/07-tools.md` |
| `persistence` | `specs/08-db-schema.md` |
| `frontend` | `specs/09-frontend-architecture.md` |
| `agent-builder` | `specs/10-agent-builder.md` |
| `platform-security` | `specs/11-platform.md` |
| `desktop-electron` | `specs/12-desktop-electron.md` |
| `conversation-context` | `specs/13-conversation-context.md` |
| `mobile-companion` | `specs/14-mobile-remote.md` |

## Technology

- Next.js 16 App Router + React 19
- TypeScript strict mode
- SQLite + Drizzle + `better-sqlite3`
- SSE for stream transport
- Zustand + Immer for client state
- Adapter SDKs: `@anthropic-ai/claude-agent-sdk`, `@openai/codex-sdk`, `openai`
- Desktop shell: Electron 33

## Rules

- UI MUST not call LLM SDKs directly.
- Adapter code MUST not write database rows directly except through documented event translation boundaries.
- Tools MUST enforce workspace path isolation and command safety before side effects.
- Specs and code MUST be updated together for entity, event, adapter, tool, persistence, and security contract changes.
