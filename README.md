# Agent 002: File Guardian

A bonded file guardian that watches a directory and enforces accountability on file changes through [AgentGate](https://github.com/selfradiance/agentgate).

When an AI coding agent (or anything else) modifies or deletes a file, the guardian posts a bond, verifies the change, and either releases the bond or slashes it and restores the file from a snapshot.

## Status
Under construction — v0.1.0 in progress.

## Why
AI coding agents are being given filesystem access with zero accountability. A developer recently lost 2.5 years of production data when an AI agent executed a single destructive command. This project exists so that can't happen silently.

## Built On
- [AgentGate](https://github.com/selfradiance/agentgate) — the bond-and-slash accountability layer for AI agents
