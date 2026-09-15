/**
 * Sentinel Agent — Playwright + LLM orchestration engine
 * Stub for Phase 1
 */

export interface AgentConfig {
  llmApiKey: string;
  llmBaseUrl: string;
  headless?: boolean;
}

export class SentinelAgent {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async crawl(url: string): Promise<void> {
    console.log(`[Agent] Starting crawl of ${url}`);
    // TODO: Launch Playwright chromium, navigate, interact, capture screenshots
    // TODO: Send observations to LLM for analysis
    // TODO: Return structured findings
    throw new Error('Not implemented');
  }
}
