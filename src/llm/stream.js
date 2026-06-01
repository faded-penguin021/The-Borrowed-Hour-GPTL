// @ts-check
/**
 * @import { BuildRequestParams, ChatCompletionsProviderConfig, ChatMessage, StreamEvent, ToolDefinition } from "../types"
 */
import { BorrowedError } from "./errors";

/**
 * @param {unknown} content
 * @returns {string}
 */
export var normalizeContent = (content) => {
  if (typeof content === "string")
    return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string")
        return part;
      if (part && typeof part.text === "string")
        return part.text;
      if (part && typeof part.content === "string")
        return part.content;
      return "";
    }).filter(Boolean).join(`
`);
  }
  return String(content ?? "");
};

/**
 * @param {any} data
 * @returns {string}
 */
export var extractOpenAIText = (data) => {
  if (typeof data.output_text === "string" && data.output_text.trim())
    return data.output_text.trim();
  const chunks = [];
  for (const item of data.output || []) {
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
/**
 * @param {any} data
 * @returns {string}
 */
export var extractGeminiText = (data) => {
  const chunks = [];
  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (typeof part.text === "string")
        chunks.push(part.text);
    }
  }
  return chunks.join(`
`).trim();
};
/**
 * @param {any} data
 * @returns {string}
 */
export var extractClaudeText = (data) => {
  const chunks = [];
  for (const part of data.content || []) {
    if (part.type === "text" && typeof part.text === "string")
      chunks.push(part.text);
  }
  return chunks.join(`
`).trim();
};
/**
 * @param {string} sys
 * @param {ChatMessage[]} msgs
 * @returns {ChatMessage[]}
 */
export var normalizeChatMessages = (sys, msgs) => [
  { role: "system", content: sys },
  ...msgs.map((m) => (/** @type {ChatMessage} */ ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: normalizeContent(m.content)
  })))
];
/**
 * @param {any} data
 * @returns {string}
 */
export var extractChatText = (data) => {
  const chunks = [];
  for (const choice of data.choices || []) {
    const content = choice.message?.content;
    if (typeof content === "string" && content)
      chunks.push(content);
    else
      chunks.push(normalizeContent(content));
  }
  return chunks.join(`
`).trim();
};
/**
 * @param {string} rawEvent
 * @returns {string}
 */
export var sseEventData = (rawEvent) => {
  const dataLines = [];
  for (const line of rawEvent.split(`
`)) {
    if (line.startsWith("data:"))
      dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  return dataLines.join(`
`).trim();
};
/**
 * @param {string} rawEvent
 * @returns {StreamEvent | null}
 */
export var parseChatStreamEvent = (rawEvent) => {
  const data = sseEventData(rawEvent);
  if (!data || data === "[DONE]")
    return null;
  let json;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  const out = {};
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
/**
 * @param {any} data
 * @returns {string}
 */
export var extractChatToolCallArgs = (data) => {
  const msg = data?.choices?.[0]?.message;
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
/**
 * @param {ChatCompletionsProviderConfig} config
 * @returns {any}
 */
export var makeChatCompletionsProvider = ({ url, label, jsonSchema, tools: useToolsApi, extraBody }) => ({
  toolUse: !!(jsonSchema || useToolsApi),
  retryable: new Set([408, 409, 429, 500, 502, 503, 504]),
  /** @param {BuildRequestParams} params */
  buildRequest({ sys, msgs, useTool, model, maxTokens, temperature, tool, apiKey }) {
    let system = sys;
    /** @type {Record<string, any>} */
    const body = {
      model,
      max_tokens: maxTokens
    };
    if (temperature !== undefined)
      body.temperature = temperature;
    if (useTool) {
      const t = /** @type {ToolDefinition} */ (tool);
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
    /** @type {Record<string, string>} */
    const headers = { "Content-Type": "application/json" };
    if (apiKey)
      headers.Authorization = `Bearer ${apiKey}`;
    return {
      url: resolvedUrl,
      headers,
      body
    };
  },
  /** @param {any} data @param {string} model */
  logUsage(data, model) {
    if (!data.usage)
      return;
    const u = data.usage;
    console.debug("[borrowed] usage", {
      model,
      input: u.prompt_tokens || 0,
      output: u.completion_tokens || 0,
      total: u.total_tokens || 0
    });
  },
  /** @param {BuildRequestParams} params */
  buildStreamRequest(params) {
    const request = this.buildRequest({ ...params, useTool: false, tool: null });
    request.body.stream = true;
    return request;
  },
  parseStreamEvent: parseChatStreamEvent,
  /** @param {any} data @param {boolean} [useTool] */
  extract(data, useTool) {
    if (useTool && useToolsApi) {
      const args = extractChatToolCallArgs(data);
      if (args) return args;
    }
    const text = extractChatText(data);
    if (!text) {
      const reason = data.choices?.[0]?.finish_reason || "unknown";
      const detail = useTool && useToolsApi
        ? `${label} returned no tool call. Finish reason: ${reason}.`
        : `${label} returned an empty response. Finish reason: ${reason}.`;
      throw new BorrowedError("The page came back blank.", detail);
    }
    return text;
  }
});
