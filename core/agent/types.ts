/**
 * Agent Configuration
 * 
 * Different agents require different tools and skills.
 * Agents can be loaded via --agents "path/to/SKILL.md" parameter
 */

export interface AgentConfig {
  /** Agent name */
  name: string;
  /** Agent role description */
  role: string;
  /** Path to SKILL.md file */
  skillPath?: string;
  /** Tools available to this agent */
  tools: string[];
  /** Skills available to this agent */
  skills: string[];
}

/**
 * Agent Runtime - manages agent lifecycle and tool/skill binding
 */
export class AgentRuntime {
  private config: AgentConfig;
  
  constructor(config: AgentConfig) {
    this.config = config;
  }
  
  getName(): string {
    return this.config.name;
  }
  
  getRole(): string {
    return this.config.role;
  }
  
  getAvailableTools(): string[] {
    return this.config.tools;
  }
  
  getAvailableSkills(): string[] {
    return this.config.skills;
  }
}
