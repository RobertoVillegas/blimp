import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { AUTO_UPDATED_KEY, reloadIfNewerOnDisk } from ".";

describe("reloadIfNewerOnDisk", () => {
  let reload: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(fakeBrowser.runtime, "getManifest").mockReturnValue({
      version: "0.3.0",
    } as never);
    reload = vi.fn<() => void>();
    fakeBrowser.runtime.reload = reload;
  });
  afterEach(() => vi.unstubAllGlobals());

  const disk = (body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body))),
    );

  it("reloads into a newer build and records it", async () => {
    disk({ version: "0.4.0" });
    expect(await reloadIfNewerOnDisk(() => false)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(
      (await fakeBrowser.storage.local.get(AUTO_UPDATED_KEY))[AUTO_UPDATED_KEY],
    ).toMatchObject({ from: "0.3.0", to: "0.4.0" });
  });

  it("waits while an AI request is running", async () => {
    disk({ version: "0.4.0" });
    expect(await reloadIfNewerOnDisk(() => true)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("ignores the same or an older version, and a half-written manifest", async () => {
    for (const body of [{ version: "0.3.0" }, { version: "0.2.9" }]) {
      disk(body);
      expect(await reloadIfNewerOnDisk(() => false)).toBe(false);
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"vers')),
    );
    expect(await reloadIfNewerOnDisk(() => false)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
