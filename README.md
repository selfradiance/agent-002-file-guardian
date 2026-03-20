# Agent 002: File Guardian

A rollback-enforcing file watcher for AI-assisted coding that adds bond/slash accountability through [AgentGate](https://github.com/selfradiance/agentgate).

When an AI coding agent (or anything else) modifies or deletes a file, the guardian posts a bond, verifies the change, and either releases the bond or slashes it and restores the file from a snapshot. The guardian process posts the bond on behalf of whatever agent made the file change — the agent itself is not aware of the bond. The guardian is an independent enforcement layer that watches the directory and attaches accountability after the fact, using its own Ed25519 keypair as its identity.

## Why

AI coding agents are being given filesystem access with zero accountability. A developer recently lost 2.5 years of production data when an AI agent executed a single destructive command. Rate limits and permission systems don't help when the agent has legitimate access — the problem is that nothing makes the agent economically accountable for what it does with that access. This project exists so that destructive file changes can't happen silently.

## Why Not Git / Hooks / CI?

**"Why not just use git?"** — Git tracks history after the fact. It doesn't create an automatic gate or consequence at the moment a file is mutated. The guardian acts at the point of change — detecting, verifying, and reverting before the next command runs — not after a review cycle.

**"Why not pre-commit hooks or watch-mode tests?"** — Those run verification but don't revert on failure or attach an economic record. The guardian combines verification, automatic rollback, and bond/slash accountability in a single loop. A hook can tell you something broke; the guardian fixes it and records who paid.

**"Why not sandbox the agent?"** — Valid for some setups, but many real workflows grant agents legitimate write access to working directories (Claude Code, Cursor, Copilot Workspace). This is a runtime enforcement layer for environments where the agent already has access and you want accountability, not restriction.

## How It Works

1. The guardian starts and snapshots every file in the watched directory (non-recursive — files present at startup only, by design for v0.2.0)
2. A file change is detected (modification or deletion)
3. A bond is posted to AgentGate (the guardian puts up collateral on behalf of the agent)
4. Verification runs: either a user-supplied command (`--verify-cmd`, exit 0 = pass) or the default size-threshold check (file exists, not empty, size within threshold)
5. If verification passes → bond released, snapshot updated to the new file state
6. If verification fails → bond slashed, file restored from the pre-change snapshot

## Quick Start

**Prerequisites:** Node.js 20+, a running [AgentGate](https://github.com/selfradiance/agentgate) instance.

```bash
# Clone and install
git clone https://github.com/selfradiance/agent-002-file-guardian.git
cd agent-002-file-guardian
npm install

# Watch a TypeScript project — restore any change that breaks the build
npx tsx src/index.ts ./src --verify-cmd 'tsc --noEmit' --api-key YOUR_AGENTGATE_REST_KEY

# Watch a Python project — restore any change that breaks tests
npx tsx src/index.ts ./src --verify-cmd 'python -m pytest tests/' --api-key YOUR_AGENTGATE_REST_KEY

# Bare-minimum fallback: default size-threshold verification (no verify command)
npx tsx src/index.ts /path/to/directory --api-key YOUR_AGENTGATE_REST_KEY
```

The `--verify-cmd` flag is the primary way to use the guardian. The default size-threshold verifier (file exists, not empty, size within threshold) is a bare-minimum fallback for cases where no verification command is available.

**Options:**

```
npx tsx src/index.ts <directory> [options]

  --agentgate-url <url>   AgentGate server URL (default: http://127.0.0.1:3000)
  --api-key <key>         AgentGate REST key (or set AGENTGATE_REST_KEY env var)
  --threshold <percent>   Max allowed size change % (default: 50)
  --verify-cmd <command>  Shell command to run for verification (exit 0 = pass)
  --verify-timeout <sec>  Timeout for verify command in seconds (default: 30)
  --fail-open             Allow changes through when AgentGate is unreachable (default: fail-closed)
```

The `--agentgate-url` flag also accepts `https://agentgate.run` — a live demo instance available until approximately March 2027.

## What Happens When a Change Is Caught

```
[14:32:01] [change] Change detected: db.ts
[14:32:01] [error]  Bond lifecycle failed for db.ts: fetch failed: ECONNREFUSED
[14:32:01] [failed] db.ts: AgentGate unreachable — change reverted (fail-closed)
```

```
[14:35:12] [change] Change detected: config.ts
[14:35:14] [failed] config.ts: Command failed (exit 1): tsc --noEmit — error TS2322: Type 'string' is not assignable to type 'number'. — restored from snapshot
```

```
[14:36:44] [change] Change detected: utils.ts
[14:36:46] [passed] utils.ts: Command passed: tsc --noEmit
```

## Scope (v0.2.0)

This is a deliberately scoped proof-of-concept:

- **Watches a single directory** (non-recursive) — files present at startup are monitored
- **Does not watch new files** created after startup, subdirectories, or nested paths
- **One verification command** applies to all file changes (no per-file rules)

This scope is intentional. Agent 002 proves that the bond/verify/rollback loop works with real verification commands. Recursive watching, per-file rules, and multi-directory support are straightforward extensions but outside the scope of the proof-of-concept.

## Safety Features

- **Fail-closed by default** — if AgentGate is unreachable, changes are reverted from snapshot. Use `--fail-open` to override.
- **Symlinks skipped** — symlinks in the watched directory are detected and ignored, preventing the guardian from reading or writing outside the directory
- **Restore-echo suppression** — when the guardian restores a file, the resulting filesystem event is suppressed so it doesn't waste a bond re-checking its own restore
- **Atomic restores** — restored files are written to a temp file first, then atomically renamed into place. A crash mid-restore won't corrupt the original.
- **Per-file locking** — concurrent changes to the same file are serialized, preventing race conditions in the bond/verify/restore cycle
- **10-second request timeout** — all AgentGate API calls time out after 10 seconds, so the guardian doesn't hang if AgentGate is unreachable
- **Input validation** — invalid CLI values (NaN thresholds, bad timeout values) are rejected at startup with clear errors

## Trust Model

The `--verify-cmd` flag runs an arbitrary shell command via `/bin/sh`. This is a deliberate design choice — the guardian's operator specifies the command, and it runs with the same permissions as the guardian process. Do not source the `--verify-cmd` value from untrusted input (e.g., user-facing config files or environment variables set by other processes). The trust boundary is the same as a `Makefile` target or an npm script.

## Tests

```bash
npm test
```

50 tests across 5 test files (snapshots, verification, bonds, watcher, integration).

Integration tests require a running AgentGate instance:

```bash
AGENTGATE_URL=http://127.0.0.1:3000 AGENTGATE_REST_KEY=yourkey npm test
```

## Built On

- [AgentGate](https://github.com/selfradiance/agentgate) — the bond-and-slash accountability layer for AI agents

## License

MIT
