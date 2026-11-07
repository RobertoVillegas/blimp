import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { activeProfile, loadSettings, newProfile } from "./settings";

describe("settings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("seeds one profile per base provider, OpenAI active", async () => {
    const settings = await loadSettings();
    expect(settings.profiles.map((profile) => profile.id)).toEqual([
      "openai",
      "anthropic",
      "gemini",
      "deepseek",
      "mistral",
      "opencode-go",
    ]);
    expect(activeProfile(settings).id).toBe("openai");
  });

  it("gives a second profile of the same provider its own id and name", async () => {
    const settings = await loadSettings();
    const second = newProfile("mistral", settings.profiles);
    expect(second.id).not.toBe("mistral");
    expect(second.name).toBe("Mistral AI 2");
  });

  it("replaces the early OpenCode Zen profile with OpenCode Go, keeping its id and model", async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        activeProfileId: "opencode",
        profiles: [
          {
            id: "opencode",
            preset: "opencode",
            name: "OpenCode Zen",
            model: "glm-5.3",
            baseUrl: "https://opencode.ai/zen/v1",
          },
        ],
      },
    });
    const settings = await loadSettings();
    expect(activeProfile(settings)).toEqual({
      id: "opencode",
      preset: "opencode-go",
      name: "OpenCode Go",
      model: "glm-5.3",
      baseUrl: "",
    });
  });

  it("migrates v0.1 per-provider settings, keeping the provider id so stored keys still match", async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        provider: "custom",
        providers: {
          custom: {
            model: "deepseek-flash",
            baseUrl: "https://api.deepseek.com",
          },
          openai: { model: "gpt-x" },
        },
        temperature: 0.7,
      },
    });
    const settings = await loadSettings();
    expect(settings.activeProfileId).toBe("custom");
    expect(activeProfile(settings)).toMatchObject({
      preset: "custom",
      model: "deepseek-flash",
      baseUrl: "https://api.deepseek.com",
    });
    expect(
      settings.profiles.find((profile) => profile.id === "openai")?.model,
    ).toBe("gpt-x");
    expect(settings.temperature).toBe(0.7);
  });
});

describe("per-feature profiles", () => {
  beforeEach(() => fakeBrowser.reset());

  it("uses the feature profile when set and falls back to the active one when it is gone", async () => {
    const { profileFor } = await import("@/ai/active");
    const settings = await loadSettings();
    settings.featureProfiles = {
      previews: "deepseek",
      downloads: "deleted-profile",
    };
    expect(profileFor(settings, "previews").id).toBe("deepseek");
    expect(profileFor(settings, "downloads").id).toBe("openai");
    expect(profileFor(settings, "tabs").id).toBe("openai");
    expect(profileFor(settings).id).toBe("openai");
  });
});
