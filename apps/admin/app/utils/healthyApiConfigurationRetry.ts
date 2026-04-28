import type { ConfiguredApiResolution } from "@/utils/healthyApiConfig";
import type { ConfigurationErrorReason } from "@/utils/healthyApiGlobalRoute";

type RefetchResult = { status: "success" | "error" | "pending" };

/**
 * Retry behavior for the blocking configuration error page: reload when the URL cannot be used,
 * or refetch `/status` when the URL is valid but the API was unreachable.
 */
export async function runConfigurationRetry(opts: {
  reason: ConfigurationErrorReason;
  resolved: ConfiguredApiResolution;
  refetchUnreachable: () => Promise<RefetchResult>;
  reloadPage: () => void;
  navigateHome: () => Promise<void>;
}): Promise<void> {
  if (opts.reason !== "unreachable" || !opts.resolved.ok) {
    opts.reloadPage();
    return;
  }
  const state = await opts.refetchUnreachable();
  if (state.status === "success") {
    await opts.navigateHome();
  }
}
