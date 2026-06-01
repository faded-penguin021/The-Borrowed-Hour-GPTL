import type {
  BuildRequestParams,
  ChatCompletionsProviderConfig,
  ChatMessage,
  ProviderAdapter,
  ProviderRequest,
  StreamEvent,
  ToolDefinition,
} from "../types";
import { BorrowedError } from "./errors";

// Minimal shapes for the untyped provider-response JSON we read below.
interface ContentPart {
  text?: unknown;
  content?: unknown;
}
interface OpenAIResponse {
  output_text?: unknown;
  output?: Array<{ type?: unknown; content?: Array<{ type?: unknown; text?: unknown; output_text?: unknown }> }>;
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
}
interface ClaudeResponse {
  content?: Array<{ type?: unknown; text?: unknown }>;
}
interface ChatChoice {
  message?: { content?: unknown; tool_calls?: Array<{ function?: { arguments?: unknown } }>; function_call?: { arguments?: unknown } };
  finish_reason?: unknown;
}
interface ChatResponse {
  choices?: ChatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export const normalizeContent = (content: unknown): string => {
  if (typeof content === "string")
    return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string")
        return part;
      const p = part as ContentPart;
      if (p && typeof p.text === "string")
        return p.text;
      if (p && typeof p.content === "string")
        return p.content;
      return "";
    }).filter(Boolean).join(`
`);
  }
  return String(content ?? "");
};

export const extractOpenAIText = (data: unknown): string => {
  const d = data as OpenAIResponse;
  if (typeof d.output_text === "string" && d.output_text.trim())
    return d.output_text.trim();
  const chunks: string[] = [];
  for (const item of d.output || []) {
    if (item.type && item.type !== "message")
      continue;
    for (const part of item.content || []) {
      if (part.type && part.type !== "output_text")
        continue;
      if (typeof part.text === "string")
        chunks.push(part.text);
      if (typeof part.output_text === "string")
        chunks.push(part.output_text);
    }
  }
  return chunks.join(`
`).trim();
};

export const extractGeminiText = (data: unknown): string => {
  const d = data as GeminiResponse;
  const chunks: string[] = [];
  for (const candidate of d.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (typeof part.text === "string")
        chunks.push(part.text);
    }
  }
  return chunks.join(`
`).trim();
};

export const extractClaudeText = (data: unknown): string => {
  const d = data as ClaudeResponse;
  const chunks: string[] = [];
  for (const part of d.content || []) {
    if (part.type === "text" && typeof part.text === "string")
      chunks.push(part.text);
  }
  return chunks.join(`
`).trim();
};

export const normalizeChatMessages = (sys: string, msgs: ChatMessage[]): ChatMessage[] => [
  { role: "system", content: sys },
  ...msgs.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: normalizeContent(m.content)
  } as ChatMessage))
];

export const extractChatText = (data: unknown): string => {
  const d = data as ChatResponse;
  const chunks: string[] = [];
  for (const choice of d.choices || []) {
    const content = choice.message?.content;
    if (typeof content === "string" && content)
      chunks.push(content);
    else
      chunks.push(normalizeContent(content));
  }
  return chunks.join(`
`).trim();
};

export const sseEventData = (rawEvent: string): string => {
  const dataLines: string[] = [];
  for (const line of rawEvent.split(`
`)) {
    if (line.startsWith("data:"))
      dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  return dataLines.join(`
`).trim();
};

export const parseChatStreamEvent = (rawEvent: string): StreamEvent | null => {
  const data = sseEventData(rawEvent);
  if (!data || data === "[DONE]")
    return null;
  let json: {
    choices?: Array<{ delta?: { content?: unknown } }>;
    usage?: { prompt_tokens?: number; input_tokens?: number; completion_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  const out: StreamEvent = {};
  const delta = json.choices?.[0]?.delta?.content;
  if (typeof delta === "string" && delta)
    out.text = delta;
  if (json.usage)
    out.usage = {
      input: json.usage.prompt_tokens || json.usage.input_tokens || 0,
      output: json.usage.completion_tokens || json.usage.output_tokens || 0
    };
  if (json.error)
    out.error = json.error.message || String(json.error);
  return out;
};

export const extractChatToolCallArgs = (data: unknown): string => {
  const msg = (data as ChatResponse)?.choices?.[0]?.message;
  if (!msg) return "";
  const calls = msg.tool_calls;
  if (Array.isArray(calls) && calls.length > 0) {
    const args = calls[0]?.function?.arguments;
    if (typeof args === "string" && args.trim()) return args;
    if (args && typeof args === "object") return JSON.stringify(args);
  }
  if (msg.function_call?.arguments) {
    const args = msg.function_call.arguments;
    if (typeof args === "string" && args.trim()) return args;
    if (args && typeof args === "object") return JSON.stringify(args);
  }
  return "";
};

export const makeChatCompletionsProvider = ({ url, label, jsonSchema, tools: useToolsApi, extraBody }: ChatCompletionsProviderConfig): ProviderAdapter => ({
  toolUse: !!(jsonSchema || useToolsApi),
  retryable: new Set([408, 409, 429, 500, 502, 503, 504]),
  buildRequest({ sys, msgs, useTool, model, maxTokens, temperature, tool, apiKey }: BuildRequestParams): ProviderRequest {
    let system = sys;
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens
    };
    if (temperature !== undefined)
      body.temperature = temperature;
    if (useTool) {
      const t = tool as ToolDefinition;
      if (useToolsApi) {
        body.tools = [{
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema
          }
        }];
        body.tool_choice = { type: "function", function: { name: t.name } };
      } else if (jsonSchema) {
        body.response_format = {
          type: "json_schema",
          json_schema: { name: t.name, schema: t.input_schema, strict: false }
        };
      } else {
        body.response_format = { type: "json_object" };
        system += `

Respond ONLY with a single valid JSON object matching this schema (no prose, no markdown fences): ${JSON.stringify(t.input_schema)}`;
      }
    }
    body.messages = normalizeChatMessages(system, msgs);
    if (extraBody && typeof extraBody === "object")
      Object.assign(body, extraBody);
    const resolvedUrl = typeof url === "function" ? url() : url;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey)
      headers.Authorization = `Bearer ${apiKey}`;
    return {
      url: resolvedUrl,
      headers,
      body
    };
  },
  logUsage(data: unknown, model: string): void {
    const d = data as ChatResponse;
    if (!d.usage)
      return;
    const u = d.usage;
    console.debug("[borrowed] usage", {
      model,
      input: u.prompt_tokens || 0,
      output: u.completion_tokens || 0,
      total: u.total_tokens || 0
    });
  },
  buildStreamRequest(params: BuildRequestParams): ProviderRequest {
    const request = this.buildRequest({ ...params, useTool: false, tool: null });
    request.body.stream = true;
    return request;
  },
  parseStreamEvent: parseChatStreamEvent,
  extract(data: unknown, useTool?: boolean): string {
    if (useTool && useToolsApi) {
      const args = extractChatToolCallArgs(data);
      if (args) return args;
    }
    const text = extractChatText(data);
    if (!text) {
      const reason = (data as ChatResponse).choices?.[0]?.finish_reason || "unknown";
      const detail = useTool && useToolsApi
        ? `${label} returned no tool call. Finish reason: ${reason}.`
        : `${label} returned an empty response. Finish reason: ${reason}.`;
      throw new BorrowedError("The page came back blank.", detail);
    }
    return text;
  }
});
