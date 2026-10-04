import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { GeneratedBatchSchema, type GeneratedQuestion, type QuestionContent } from "../sat/question";
import { DIFFICULTIES, type SkillRef } from "../sat/taxonomy";
import {
  buildGenerationPrompt,
  buildSolverPrompt,
  GENERATOR_SYSTEM_PROMPT,
  SOLVER_SYSTEM_PROMPT,
  type GenerationRequest,
} from "./prompts";

export const SolverResultSchema = z.object({
  answer: z.string().describe("A letter A-D, or the numeric answer for a student-produced response."),
  issues: z.array(z.string()),
  difficultyEstimate: z.enum(DIFFICULTIES),
});
export type SolverResult = z.infer<typeof SolverResultSchema>;

/** The two model calls the pipeline makes. Tests swap in a fake. */
export interface QuestionModel {
  readonly model: string;
  generate(req: GenerationRequest): Promise<{ questions: GeneratedQuestion[]; servedModel: string }>;
  solve(q: QuestionContent, ref: SkillRef): Promise<SolverResult & { servedModel: string }>;
}

export const DEFAULT_MODEL = "claude-opus-5-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeModelOptions {
  model?: string;
  /** Thinking depth. "high" by default: correctness of answer keys matters more than cost. */
  effort?: Effort;
  client?: Anthropic;
}

export class ClaudeQuestionModel implements QuestionModel {
  readonly model: string;
  private readonly effort: Effort;
  private readonly client: Anthropic;

  constructor(opts: ClaudeModelOptions = {}) {
    this.model = opts.model ?? process.env.SAT_GENERATOR_MODEL ?? DEFAULT_MODEL;
    this.effort = opts.effort ?? (process.env.SAT_GENERATOR_EFFORT as Effort | undefined) ?? "high";
    this.client = opts.client ?? new Anthropic();
  }

  async generate(req: GenerationRequest) {
    const message = await this.run(GENERATOR_SYSTEM_PROMPT, buildGenerationPrompt(req), betaZodOutputFormat(GeneratedBatchSchema));
    return { questions: message.parsed.questions, servedModel: message.model };
  }

  async solve(q: QuestionContent, ref: SkillRef) {
    const message = await this.run(SOLVER_SYSTEM_PROMPT, buildSolverPrompt(q, ref), betaZodOutputFormat(SolverResultSchema));
    return { ...message.parsed, servedModel: message.model };
  }

  private async run<T>(
    system: string,
    user: string,
    format: ReturnType<typeof betaZodOutputFormat<z.ZodType<T>>>,
  ): Promise<{ parsed: T; model: string }> {
    const stream = this.client.beta.messages.stream({
      model: this.model,
      max_tokens: 64000,
      // Server-side fallback: if a safety classifier declines, the API retries on
      // the model Anthropic recommends for that case instead of returning a refusal.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // The system prompt never changes between requests, so cache it.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort: this.effort, format },
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new Error(`Claude declined the request (${message.stop_details?.category ?? "no category"}).`);
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error("Claude ran out of output tokens; try a smaller batch.");
    }
    if (message.parsed_output == null) {
      throw new Error("Claude returned output that did not match the question schema.");
    }
    return { parsed: message.parsed_output, model: message.model };
  }
}
