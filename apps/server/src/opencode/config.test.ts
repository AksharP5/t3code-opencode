import { describe, expect, it } from "vitest";
import {
  getOpenCodeAuthHeader,
  isLoopbackOpenCodeUrl,
  normalizeBaseUrl,
  resolveOpenCodeConfig,
} from "./config";

describe("opencode config", () => {
  it("normalizes the base url and strips extra path components", () => {
    expect(normalizeBaseUrl(" http://127.0.0.1:4096/api/v1/?x=1#hash ")).toBe(
      "http://127.0.0.1:4096",
    );
  });

  it("detects loopback hosts", () => {
    expect(isLoopbackOpenCodeUrl("http://127.0.0.1:4096")).toBe(true);
    expect(isLoopbackOpenCodeUrl("http://localhost:4096")).toBe(true);
    expect(isLoopbackOpenCodeUrl("https://example.com")).toBe(false);
  });

  it("builds the basic auth header when a password is provided", () => {
    expect(getOpenCodeAuthHeader("secret")).toBe("Basic b3BlbmNvZGU6c2VjcmV0");
    expect(getOpenCodeAuthHeader(null)).toBeNull();
  });

  it("resolves a trimmed config shape", () => {
    expect(
      resolveOpenCodeConfig({
        baseUrl: " http://127.0.0.1:4096 ",
        autoStart: true,
        password: " secret ",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:4096",
      autoStart: true,
      password: "secret",
    });
  });
});
