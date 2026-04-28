import { describe, expect, it } from "vitest";

import { PASSWORD_MIN_LENGTH } from "../../app/utils/healthyApiAuth";

describe("healthyApiAuth", () => {
  it("exposes 12-char password minimum aligned with API policy", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });
});
