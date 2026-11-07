import type { ProviderAdapter } from "../types";
import { joinUrl } from "./http";

export const gemini: ProviderAdapter = {
  buildRequest(config, request) {
    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined)
      generationConfig.temperature = request.temperature;
    if (request.maxOutputTokens !== undefined)
      generationConfig.maxOutputTokens = request.maxOutputTokens;
    if (request.json) generationConfig.responseMimeType = "application/json";

    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig,
    };

    return {
      url: joinUrl(
        config.baseUrl,
        `models/${encodeURIComponent(config.model)}:generateContent`,
      ),
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": config.apiKey ?? "",
        },
        body: JSON.stringify(body),
      },
    };
  },

  parseResponse(body) {
    const parts = (
      body as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    )?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) throw new Error("No candidates in response");
    return parts.map((part) => part.text ?? "").join("");
  },

  modelsRequest(config) {
    return {
      url: joinUrl(config.baseUrl, "models?pageSize=200"),
      init: {
        method: "GET",
        headers: { "x-goog-api-key": config.apiKey ?? "" },
      },
    };
  },

  parseModels(body) {
    const models = (
      body as {
        models?: { name?: unknown; supportedGenerationMethods?: unknown }[];
      }
    )?.models;
    if (!Array.isArray(models)) return [];
    return models
      .filter(
        (model) =>
          Array.isArray(model.supportedGenerationMethods) &&
          model.supportedGenerationMethods.includes("generateContent"),
      )
      .map((model) =>
        typeof model.name === "string"
          ? model.name.replace(/^models\//, "")
          : "",
      )
      .filter(Boolean)
      .map((id) => ({ id }));
  },
};
