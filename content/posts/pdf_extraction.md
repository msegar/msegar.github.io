---
title: PDF Text Extraction in Next.js Standalone Builds
description: How a simple PDF upload feature turned into a multi-day debugging session across browser polyfills, build tracing, and Docker containers.
date: 2026-01-27
img: ../assets/images/pdf-extraction.png
categories: [Next.js, Node.js, Docker, PDF]
---

I recently built a feature for ManuscriptMind that lets users upload academic manuscripts in PDF, DOCX, and TXT formats. The server-side API route extracts raw text from the uploaded file and passes it to an AI review pipeline. TXT and DOCX worked immediately. PDF did not.

What followed was a multi-day debugging session that took me through browser global polyfills, Next.js build tracing, Docker container crashes, and invisible production errors. Here's what happened and how I finally fixed it.

## The Feature

The requirement is straightforward: a user uploads a PDF, the server reads the text out of it, and that text gets sent to an AI agent for analysis. The extraction happens in a Next.js API route (`/api/manuscripts/upload`) running server-side in a standalone Docker deployment on `node:20-alpine`.

## The Problem with `pdfjs-dist`

My first instinct was to reach for **`pdfjs-dist`** (Mozilla's PDF.js). It's the gold standard for PDF parsing, widely used, and well-documented. The problem is that it's designed for the browser.

At module-evaluation time — before any of my code runs — `pdfjs-dist` attempts to reference browser globals that don't exist in Node.js:

- **`DOMMatrix`** — coordinate transforms and text positioning
- **`Path2D`** — vector path rendering
- **`ImageData`** — image pixel data

The API route crashed immediately on import:

```
ReferenceError: DOMMatrix is not defined
```

On top of that, Next.js standalone builds use **output file tracing** to determine which `node_modules` files to include in the deployment artifact. `pdfjs-dist` has a complex file structure with worker scripts, WASM binaries, and legacy build variants. The tracer frequently missed files that were loaded at runtime via dynamic `import()`, causing `MODULE_NOT_FOUND` errors in production that didn't appear in local development.

## The Attempts That Didn't Stick

I went through two earlier approaches before landing on the final solution.

**Attempt 1: Polyfill the browser globals.** I wrote ~80 lines of stub classes for `DOMMatrix`, `Path2D`, and `ImageData`, injecting them onto `globalThis` before importing `pdfjs-dist`. This worked locally but was fragile — any update to `pdfjs-dist` could introduce references to additional browser APIs, and it still didn't solve the build tracing issue.

**Attempt 2: Replace `pdfjs-dist` with `pdf-parse`.** The `pdf-parse` library is marketed as Node.js-native — pass a buffer in, get text out. This dropped the extraction code from ~115 lines to 7:

```typescript
import { PDFParse } from 'pdf-parse';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}
```

I also added `outputFileTracingIncludes` to `next.config.ts` to make sure the standalone build actually copied the required `node_modules` into the deployment artifact:

```typescript
outputFileTracingIncludes: {
  "/api/manuscripts/upload": [
    "./node_modules/pdf-parse/**/*",
    "./node_modules/pdfjs-dist/**/*",
  ],
},
```

This worked in local development. It did not work in Docker.

## The Crash Nobody Could See

After deploying to Docker, the upload route returned a 500 error with no useful information. The container logs showed nothing. Sentry captured nothing. The feature simply didn't work.

This is where the debugging got interesting.

The root cause was hiding behind two layers of invisibility. First, `pdf-parse` v2.x depends on `pdfjs-dist` 5.x as a **transitive dependency**. Even though `pdf-parse` presents a clean Node.js API, under the hood it still loads `pdfjs-dist`, which still expects those browser globals. Second, all of my server-side logging was gated behind an `isDev` check:

```typescript
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  console.log('debug info...');
}
```

In Docker, `NODE_ENV` is always `production`. Every debug log was silenced. The crash happened at module resolution time — before the route handler's `try/catch` even ran — so Sentry never captured it either.

When I finally got visibility into the container, the actual errors were:

```
Error: Failed to load external module pdf-parse: ReferenceError: DOMMatrix is not defined
```

```
Warning: Cannot load "@napi-rs/canvas" package
Warning: Cannot polyfill `DOMMatrix`, rendering may be broken.
Warning: Cannot polyfill `ImageData`, rendering may be broken.
Warning: Cannot polyfill `Path2D`, rendering may be broken.
```

The `pdfjs-dist` source code already had logic to import `@napi-rs/canvas` and use it to polyfill the missing browser APIs. It just needed the package to be installed.

## The Fix

### Install `@napi-rs/canvas`

```bash
npm install @napi-rs/canvas
```

`@napi-rs/canvas` is a **Rust-based native module** that ships prebuilt binaries for each platform. Unlike the older C++ `canvas` package that requires a build toolchain (`python3`, `make`, `g++`, `cairo-dev`), this one just works. npm selects the correct binary based on the container's OS and architecture automatically.

### Update the Next.js Build Config

The standalone build needs to know about the new dependency and its platform-specific native binaries:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/manuscripts/upload": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-musl/**/*",
      "./node_modules/@napi-rs/canvas-linux-arm64-musl/**/*",
    ],
  },
};
```

Both `x64-musl` and `arm64-musl` variants are included to cover common VPS architectures. Only the one matching the build container's arch will actually be installed — the other glob matches nothing and is harmlessly ignored.

The `serverExternalPackages` entry tells Next.js not to bundle these packages (they stay as external `require`/`import` calls). The `outputFileTracingIncludes` entry tells the tracer to copy them into the standalone output directory anyway.

### Zero Changes to Extraction Code

The extraction logic in `pdf-extract.ts` didn't change at all. The fix was purely at the dependency and config level. `pdfjs-dist` already contains the code to discover and use `@napi-rs/canvas` — it just needs the package to exist in `node_modules`.

## The Logging Fix

The invisible crash exposed a bigger problem: my logging strategy was wrong for production containers. I replaced the `isDev` / `debug()` pattern with a structured logger controlled by a `LOG_LEVEL` environment variable:

```typescript
// src/lib/logger.ts
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const levels = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: string): boolean {
  return levels[level] >= levels[LOG_LEVEL];
}

export const logger = {
  debug: (...args: any[]) => shouldLog('debug') && console.log('[DEBUG]', ...args),
  info: (...args: any[]) => shouldLog('info') && console.log('[INFO]', ...args),
  warn: (...args: any[]) => shouldLog('warn') && console.warn('[WARN]', ...args),
  error: (...args: any[]) => shouldLog('error') && console.error('[ERROR]', ...args),
};
```

Now logs are visible in production Docker containers when `LOG_LEVEL=debug` is set, without requiring `NODE_ENV=development`. I also added a `docker-compose.local.yml` for local production testing with `LOG_LEVEL=debug` enabled by default, so I can catch these issues before they reach a real deployment.

## Why This Was Hard

This bug hit a confluence of issues that made it particularly difficult to diagnose:

1. **Transitive dependency.** `pdf-parse` advertises itself as Node-native, but it wraps `pdfjs-dist` which is not. The browser global requirement was hidden one level down in the dependency tree.

2. **Module-time crash.** The error occurred at `import()` resolution, before any application-level error handling could catch it. Sentry, try/catch blocks, error boundaries — none of it mattered.

3. **Silent failure in production.** The logging pattern (`isDev` check) meant the container gave no indication of what was wrong. The only symptom was a generic 500 response.

4. **Environment-specific.** It worked in local development (where Node.js development builds have different module resolution behavior) and failed only in the Docker standalone build.

5. **Build tracing.** Even after fixing the runtime error, the Next.js standalone output file tracer needed explicit instructions to include the native binaries in the deployment artifact.

## Key Takeaways

1. **Check your transitive dependencies.** A library can have a clean API but a messy dependency tree. `pdf-parse` wraps `pdfjs-dist`, which means you inherit all of `pdfjs-dist`'s server-side incompatibilities.

2. **Never gate all logging behind `NODE_ENV`.** Use a separate `LOG_LEVEL` variable so you can get debug output in production containers without changing the build mode.

3. **Test in Docker locally.** If your deployment target is a Docker standalone build, run that build locally before pushing. A `docker-compose.local.yml` with debug logging enabled catches most of these issues.

4. **`outputFileTracingIncludes` is your friend.** Next.js standalone builds frequently miss native modules and complex dependency trees. When in doubt, explicitly tell the tracer what to include.

5. **`@napi-rs/canvas` is the right answer for `pdfjs-dist` on Node.js.** The library already expects it. No polyfills, no stubs, no custom code — just install the package and it works.

---

*Running into similar issues with PDF processing in Next.js? Let me know — I've probably already hit the error you're looking at.*
