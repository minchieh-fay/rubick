# Rubick

Personal AI Assistant Workspace - Plugin-based Tool/Skill/Agent Ecosystem

## Overview

Rubick is a personal productivity tool similar to CoWork. It provides a plugin-based architecture where:

- **Tools**: Executable utilities that can be called by agents (CLI wrappers, file operations, etc.)
- **Skills**: Markdown-defined capabilities with instructions for agents
- **Agents**: Role-specific configurations that combine tools + skills for different tasks

## Architecture

```
rubick/
├── core/              # Core infrastructure (CLI abstraction, loader, agent runtime)
│   ├── cli/          # CLI tool interface and wrappers
│   ├── loader/       # Dynamic tool loading and registry
│   └── agent/        # Agent configuration and runtime
├── builtin/           # Built-in tools and skills (official, git-tracked)
│   ├── tools/        # Built-in tools
│   └── skills/       # Built-in skills
├── custom/            # User-defined tools and skills (local, extensible)
│   ├── tools/        # Custom tools
│   └── skills/       # Custom skills
├── server/            # HTTP server for dev/debugging
├── client/            # Web client
└── electron/          # Desktop app wrapper
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime

### Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Type check
bun run typecheck

# Run tests
bun test
```

### Creating a Tool

Each tool is a directory with an `index.ts`:

```bash
builtin/tools/my-tool/
  index.ts       # Exports ToolDefinition
```

Example `index.ts`:

```typescript
import { ToolDefinition } from '../../../core/cli/types';

const myTool: ToolDefinition = {
  name: 'my-tool',
  description: 'Does something useful',
  
  async execute(args, context) {
    // Implementation
    return { exitCode: 0, stdout: 'result', stderr: '', success: true };
  },
};

export default myTool;
```

### Creating a Skill

Each skill is a directory with a `SKILL.md`:

```bash
builtin/skills/my-skill/
  SKILL.md       # Skill description and instructions
```

### Running with Agents

Different agents can load different skills:

```bash
# Example: Load requirement analysis agent
rubick --agents "builtin/skills/requirement-analysis/SKILL.md"

# Example: Load K8s operations agent
rubick --agents "builtin/skills/k8s-ops/SKILL.md"
```

## Philosophy

- **Plugin-first**: Every tool/skill is a plugin, independently testable
- **Decoupled**: Upper layers only know CLI abstraction, not implementation details
- **Extensible**: Users can add custom tools/skills without modifying builtin code
- **Agent-driven**: AI agent evaluates capabilities, requests missing tools/skills as needed

## Future Plans

- Plugin repository for sharing tools/skills
- Electron packaging for desktop app
- More builtin tools and skills based on user needs
