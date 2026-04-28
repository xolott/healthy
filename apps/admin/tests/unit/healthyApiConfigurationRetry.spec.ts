import { describe, expect, it, vi } from "vitest";

import { runConfigurationRetry } from "../../app/utils/healthyApiConfigurationRetry";

describe("runConfigurationRetry", () => {
  it("reloads when URL is missing or invalid (operator must fix deployment config)", async () => {
    const reloadPage = vi.fn();
    const navigateHome = vi.fn();
    await runConfigurationRetry({
      reason: "missing",
      resolved: { ok: false, reason: "missing" },
      refetchUnreachable: async () => ({ status: "success" }),
      reloadPage,
      navigateHome,
    });
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(navigateHome).not.toHaveBeenCalled();
  });

  it("reloads for unreachable when resolved URL is invalid", async () => {
    const reloadPage = vi.fn();
    await runConfigurationRetry({
      reason: "unreachable",
      resolved: { ok: false, reason: "invalid_url" },
      refetchUnreachable: async () => ({ status: "success" }),
      reloadPage,
      navigateHome: vi.fn(),
    });
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("navigates home when unreachable refetch succeeds", async () => {
    const reloadPage = vi.fn();
    const navigateHome = vi.fn(async () => {});
    await runConfigurationRetry({
      reason: "unreachable",
      resolved: { ok: true, baseUrl: "http://127.0.0.1:3001" },
      refetchUnreachable: async () => ({ status: "success" }),
      reloadPage,
      navigateHome,
    });
    expect(reloadPage).not.toHaveBeenCalled();
    expect(navigateHome).toHaveBeenCalledTimes(1);
  });

  it("stays on error page when refetch still fails", async () => {
    const reloadPage = vi.fn();
    const navigateHome = vi.fn();
    await runConfigurationRetry({
      reason: "unreachable",
      resolved: { ok: true, baseUrl: "http://127.0.0.1:3001" },
      refetchUnreachable: async () => ({ status: "error" }),
      reloadPage,
      navigateHome,
    });
    expect(navigateHome).not.toHaveBeenCalled();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
