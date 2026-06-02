import { z } from "zod";

// Lightweight runtime contracts for the raw provider response envelopes we
// previously read via `data as SomeShape` casts. These mirror the ad-hoc
// interfaces that lived inline in `providers.ts` and `imaging.ts`.
//
// They are deliberately permissive: every field is optional and we
// `.passthrough()` so unknown provider fields survive untouched. The goal is
// not to reject real responses but to give us a typed, validated surface for
// the handful of fields we actually read (usage, status, urls, output, …)
// instead of an unchecked cast.
//
// Use `.safeParse(...)` when a malformed shape should degrade gracefully
// (logging, optional metadata) and `.parse(...)` when the caller depends on the
// shape and should throw on violation.

/** OpenAI `/v1/responses` envelope — usage + completion status. */
export const OpenAIResponseDataSchema = z
  .object({
    usage: z
      .object({
        input_tokens: z.number().optional(),
        input_tokens_details: z
          .object({ cached_tokens: z.number().optional() })
          .passthrough()
          .optional(),
        output_tokens: z.number().optional(),
        total_tokens: z.number().optional()
      })
      .passthrough()
      .optional(),
    status: z.unknown().optional(),
    incomplete_details: z
      .object({ reason: z.unknown().optional() })
      .passthrough()
      .optional()
  })
  .passthrough();

/** Gemini `generateContent` envelope — usage metadata + block/finish reasons. */
export const GeminiResponseDataSchema = z
  .object({
    usageMetadata: z
      .object({
        promptTokenCount: z.number().optional(),
        cachedContentTokenCount: z.number().optional(),
        candidatesTokenCount: z.number().optional(),
        totalTokenCount: z.number().optional()
      })
      .passthrough()
      .optional(),
    promptFeedback: z
      .object({ blockReason: z.unknown().optional() })
      .passthrough()
      .optional(),
    candidates: z
      .array(z.object({ finishReason: z.unknown().optional() }).passthrough())
      .optional()
  })
  .passthrough();

/** Claude `/v1/messages` envelope — usage, content blocks, stop reason. */
export const ClaudeResponseDataSchema = z
  .object({
    usage: z
      .object({
        input_tokens: z.number().optional(),
        cache_read_input_tokens: z.number().optional(),
        cache_creation_input_tokens: z.number().optional(),
        output_tokens: z.number().optional()
      })
      .passthrough()
      .optional(),
    content: z
      .array(
        z
          .object({
            type: z.unknown().optional(),
            name: z.unknown().optional(),
            input: z.unknown().optional()
          })
          .passthrough()
      )
      .optional(),
    stop_reason: z.unknown().optional()
  })
  .passthrough();

/** Replicate prediction envelope — polling lifecycle fields. */
export const ReplicatePredictionSchema = z
  .object({
    status: z.string().optional(),
    error: z.unknown().optional(),
    output: z.unknown().optional(),
    urls: z.object({ get: z.string().optional() }).passthrough().optional()
  })
  .passthrough();

export type OpenAIResponseData = z.infer<typeof OpenAIResponseDataSchema>;
export type GeminiResponseData = z.infer<typeof GeminiResponseDataSchema>;
export type ClaudeResponseData = z.infer<typeof ClaudeResponseDataSchema>;
export type ReplicatePrediction = z.infer<typeof ReplicatePredictionSchema>;
