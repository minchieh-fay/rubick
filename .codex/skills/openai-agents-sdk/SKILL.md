---
name: openai-agents-sdk
description: Use when creating or modifying a TypeScript application with the OpenAI Agents SDK, including agents, tools, handoffs, guardrails, sessions, streaming, tracing, MCP, sandbox agents, realtime agents, and structured outputs. Prefer this skill when SDK API details or official TypeScript examples are needed.
---

# OpenAI Agents SDK

Use the bundled official snapshot as the first reference for SDK implementation work.

## Workflow

1. Inspect the target project's `package.json`, TypeScript configuration, installed `@openai/agents` version, and runtime.
2. Search the local references before writing SDK code:
   - Guides: `references/docs`
   - TypeScript examples: `references/examples`
   - Snapshot metadata: `references/SNAPSHOT.md`
3. Use `rg` to locate concepts, exported names, and imports. Read the smallest relevant guide and one or two complete examples. Do not load the entire reference corpus into context.
4. Check whether the snapshot commit and installed package version are compatible. When they differ materially, verify the current API in official OpenAI documentation or the upstream repository.
5. Follow the existing project's conventions. Adapt examples rather than copying package configuration or secrets unchanged.
6. Validate changes with the project's typecheck, lint, and tests.

## Selection Guide

- Basic text workflow: `references/docs/guides/quickstart.md`, `references/docs/guides/agents.md`, `references/docs/guides/running-agents.md`.
- Multi-agent design: `references/docs/guides/handoffs.md`, `references/docs/guides/multi-agent.md`, and `references/examples/agent-patterns`.
- Tools and external capabilities: `references/docs/guides/tools.md`, `references/docs/guides/mcp.md`, and `references/examples/tools` or `references/examples/mcp`.
- State across turns: `references/docs/guides/sessions.md`, `references/docs/guides/results.md`, and `references/examples/memory`.
- Reliability: `references/docs/guides/guardrails.md`, `references/docs/guides/troubleshooting.md`, and the guardrail examples.
- Streaming, observability, or voice: `references/docs/guides/streaming.md`, `references/docs/guides/tracing.md`, and the relevant examples directory.
- Filesystem, command execution, or long-running work: `references/docs/guides/sandbox-agents` and `references/examples/sandbox`.

## Freshness

The reference files are a pinned snapshot, not an authority for every installed SDK version. The refresh script is `scripts/refresh-snapshot.sh`. Run it only when intentionally updating the snapshot and review the metadata afterward.

## References

Detailed SDK documentation and examples are in the `references/` directory. The source repository is recorded in `references/SNAPSHOT.md`.
