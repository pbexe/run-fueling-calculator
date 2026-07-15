import { describe, expect, it } from "vitest";

import { PROJECT_BASE_PATH, resolveBasePath } from "./basePath";

describe("resolveBasePath", () => {
  it("serves production builds under the project-page basePath", () => {
    expect(resolveBasePath("production")).toBe(PROJECT_BASE_PATH);
  });

  it("serves development builds from the site root", () => {
    expect(resolveBasePath("development")).toBe("");
  });

  it("serves test builds from the site root", () => {
    expect(resolveBasePath("test")).toBe("");
  });

  it("falls back to the site root when the environment is undefined", () => {
    expect(resolveBasePath(undefined)).toBe("");
  });

  it("uses a leading-slash, no-trailing-slash project basePath", () => {
    expect(PROJECT_BASE_PATH.startsWith("/")).toBe(true);
    expect(PROJECT_BASE_PATH.endsWith("/")).toBe(false);
  });
});
