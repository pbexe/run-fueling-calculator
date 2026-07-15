// Pure, framework-free helpers for the GitHub Pages project-page basePath.
// Kept separate from any React or Next.js code so the resolution rule can be
// unit tested in isolation (see ADR-0001: static project page under a basePath).

// The repository is published as the GitHub Pages project page
// pbexe.github.io/run-fueling-calculator, so production assets must resolve
// under this path prefix.
export const PROJECT_BASE_PATH = "/run-fueling-calculator";

// Resolve the Next.js basePath for a given build environment. Only production
// builds are served under the project-page prefix; local development and tests
// run at the site root so the dev server and its assets resolve from "/".
export function resolveBasePath(nodeEnv: string | undefined): string {
  return nodeEnv === "production" ? PROJECT_BASE_PATH : "";
}
