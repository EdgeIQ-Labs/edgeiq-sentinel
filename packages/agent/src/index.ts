import { chromium, type Browser, type Page } from 'playwright';
import OpenAI from 'openai';
import { z } from 'zod';

export interface AgentConfig {
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel?: string;
  headless?: boolean;
  maxSteps?: number;
}

const ActionSchema = z.object({
  action: z.enum(['click', 'fill', 'goto', 'wait', 'done']),
  selector: z.string().optional(),
  value: z.string().optional(),
  reason: z.string(),
});
type Action = z.infer<typeof ActionSchema>;

export interface Finding {
  type: 'bug' | 'a11y' | 'performance' | 'visual' | 'console' | 'network';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  url: string;
  screenshotPath?: string;
}

const SYSTEM_PROMPT = `You are Sentinel, an autonomous QA testing agent by EdgeIQ Labs.
Your goal is to explore a web application like a human user and find bugs, broken flows, accessibility issues, and performance problems.

You will receive the page's accessibility tree snapshot and current URL.
Respond with a JSON object matching this schema:
{"action": "click"|"fill"|"goto"|"wait"|"done", "selector": "<css or role selector>", "value": "<text for fill>", "reason": "<why>"}

Rules:
- Explore systematically: navigation links first, then forms, then interactive elements.
- Use role-based selectors when possible (e.g., 'role=button[name="Submit"]').
- When you see a form, fill it with realistic test data before submitting.
- If you encounter an error page, broken link, or unexpected behavior, note it but continue exploring.
- Return "done" when you've thoroughly explored the app or hit a dead end.
- Do NOT repeat actions you've already taken. Track your path mentally.
- Output ONLY valid JSON, no markdown fences.`;

export class SentinelAgent {
  private config: Required<AgentConfig>;
  private browser: Browser | null = null;
  private llm: OpenAI;
  private findings: Finding[] = [];
  private visitedUrls: Set<string> = new Set();
  private consoleErrors: string[] = [];
  private networkErrors: { url: string; status: number; method: string }[] = [];

  constructor(config: AgentConfig) {
    this.config = {
      llmApiKey: config.llmApiKey,
      llmBaseUrl: config.llmBaseUrl,
      llmModel: config.llmModel || 'gpt-4o-mini',
      headless: config.headless ?? true,
      maxSteps: config.maxSteps ?? 50,
    };
    this.llm = new OpenAI({
      apiKey: this.config.llmApiKey,
      baseURL: this.config.llmBaseUrl,
    });
  }

  async crawl(url: string): Promise<Finding[]> {
    this.findings = [];
    this.visitedUrls.clear();
    this.consoleErrors = [];
    this.networkErrors = [];

    this.browser = await chromium.launch({ headless: this.config.headless });
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Sentinel/0.1.0 (EdgeIQ Labs Agentic QA)',
    });
    const page = await context.newPage();

    // Intercept console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        this.consoleErrors.push(text);
        this.findings.push({
          type: 'console',
          severity: 'medium',
          title: 'Console Error',
          description: text.slice(0, 500),
          url: page.url(),
        });
      }
    });

    // Intercept network failures
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        const reqUrl = response.url();
        const method = response.request().method();
        this.networkErrors.push({ url: reqUrl, status, method });
        this.findings.push({
          type: 'network',
          severity: status >= 500 ? 'high' : 'medium',
          title: `HTTP ${status} on ${method}`,
          description: `${method} ${reqUrl} returned ${status}`,
          url: page.url(),
        });
      }
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      this.visitedUrls.add(page.url());

      for (let step = 0; step < this.config.maxSteps; step++) {
        const currentUrl = page.url();
        console.log(`[Sentinel] Step ${step + 1}/${this.config.maxSteps} — ${currentUrl}`);

        // Observe: get accessibility tree
        const snapshot = await page.accessibility.snapshot();
        const treeText = JSON.stringify(snapshot, null, 2).slice(0, 8000); // cap tokens

        // Decide: ask LLM what to do next
        const action = await this.decide(treeText, currentUrl, step);
        if (!action || action.action === 'done') {
          console.log(`[Sentinel] Agent decided to stop at step ${step + 1}: ${action?.reason}`);
          break;
        }

        // Act: execute the action
        await this.execute(page, action);

        // Evaluate: capture screenshot after each action
        const newUrl = page.url();
        if (!this.visitedUrls.has(newUrl)) {
          this.visitedUrls.add(newUrl);
        }

        // Brief pause to let page settle
        await page.waitForTimeout(500);
      }
    } catch (err) {
      console.error('[Sentinel] Crawl error:', err);
      this.findings.push({
        type: 'bug',
        severity: 'critical',
        title: 'Agent crash during crawl',
        description: String(err),
        url: page.url(),
      });
    } finally {
      await this.browser.close();
      this.browser = null;
    }

    return this.findings;
  }

  private async decide(treeText: string, currentUrl: string, step: number): Promise<Action | null> {
    try {
      const response = await this.llm.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Current URL: ${currentUrl}\nStep: ${step + 1}\nVisited URLs: ${this.visitedUrls.size}\n\nAccessibility tree:\n${treeText}\n\nWhat should I do next? Respond with JSON only.` },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '';
      // Strip markdown fences if LLM ignores instructions
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleaned);
      const result = ActionSchema.safeParse(parsed);

      if (result.success) return result.data;
      console.warn('[Sentinel] LLM returned invalid action:', parsed);
      return null;
    } catch (err) {
      console.error('[Sentinel] LLM decision error:', err);
      return null;
    }
  }

  private async execute(page: Page, action: Action): Promise<void> {
    try {
      switch (action.action) {
        case 'click':
          if (action.selector) {
            await page.click(action.selector, { timeout: 5000 });
            console.log(`[Sentinel] Clicked: ${action.selector} (${action.reason})`);
          }
          break;
        case 'fill':
          if (action.selector && action.value) {
            await page.fill(action.selector, action.value, { timeout: 5000 });
            console.log(`[Sentinel] Filled: ${action.selector} = "${action.value}"`);
          }
          break;
        case 'goto':
          if (action.value) {
            await page.goto(action.value, { waitUntil: 'domcontentloaded', timeout: 15000 });
            console.log(`[Sentinel] Navigated to: ${action.value}`);
          }
          break;
        case 'wait':
          await page.waitForTimeout(2000);
          break;
      }
    } catch (err) {
      console.warn(`[Sentinel] Action failed: ${action.action} ${action.selector || action.value} — ${err}`);
      this.findings.push({
        type: 'bug',
        severity: 'low',
        title: `Action failed: ${action.action}`,
        description: `Could not ${action.action} ${action.selector || action.value}: ${String(err).slice(0, 300)}`,
        url: page.url(),
      });
    }
  }

  async takeScreenshot(page: Page, name: string): Promise<string> {
    const path = `/tmp/sentinel-screenshots/${name}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: false });
    return path;
  }
}
