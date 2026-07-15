# Running Fueling Calculator

A static Next.js app for building a Fueling Plan for a Run. The current walking skeleton proves the GitHub Pages deployment path with a daisyUI-styled landing page.

## Local development

Install dependencies, then start the dev server:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Static build

Build the static export:

```bash
npm run build
```

The app uses Next.js App Router with `output: "export"`, so the production artifact is written to `out/` and contains only static files. Runtime server features such as API routes, middleware, SSR, and server-side state should not be added without revisiting the static-site architecture decision.

## Deployment

GitHub Actions deploys the static export to GitHub Pages on every push to `main`.

The site is configured as a GitHub Pages project page with `basePath: "/run-fueling-calculator"`, so production assets resolve correctly at:

https://pbexe.github.io/run-fueling-calculator/
