---
title: Using Supabase MCP with Multiple Organizations in Claude Code
description: How to configure multiple Supabase MCP servers in Claude Code so you can work across different organizations and projects without constantly logging in and out
date: 2026-04-30
img: ../assets/images/supabase-mcp-multi-org.png
categories: [Supabase, Claude Code, MCP, Developer Tools]
---

# Using Supabase MCP with Multiple Organizations in Claude Code

If you work across multiple Supabase organizations — say, a personal project and a client project — you've probably hit this wall: Claude Code only lets you authenticate one Supabase org at a time, and switching means logging out and back in through a browser OAuth flow. Every. Single. Time.

After fighting with this for longer than I'd like to admit, I found a clean solution that lets you have multiple Supabase MCP servers running simultaneously, each scoped to a different org and project. Here's exactly how to set it up.

## The Problem with the Default Setup

The default Supabase MCP setup uses OAuth browser-based authentication. When you run `/mcp` in Claude Code and authorize, you're granting access to one specific Supabase organization. There's no built-in way to be authenticated to two orgs at once using this flow.

There are also a few things that tripped me up when trying to solve this:

1. **The `npx` stdio approach silently breaks** - Many tutorials still show configuring the MCP server by spawning `@supabase/mcp-server-supabase` via `npx`. The server will show as "Connected" in `claude mcp list`, but the tools simply won't be discovered. No error, just silence.
2. **PATs passed as CLI flags don't work** - Passing `--access-token` as an argument to the npx command is a pattern that appears in old docs and blog posts, but it's not the supported authentication path for Claude Code.
3. **The `Authorization` header approach is what actually works** - Supabase's MCP server supports token authentication via HTTP headers, and Claude Code supports a `headers` field in its http-type MCP config.

## The Solution: HTTP-type MCP with Authorization Headers

Instead of spawning a local npx process, we use Supabase's hosted remote MCP URL (`https://mcp.supabase.com/mcp`) and authenticate with a Personal Access Token (PAT) passed via an `Authorization` header. You can define as many of these as you want — one per project — each with a different name, URL, and token.

### Step 1: Generate a PAT for Each Supabase Org

For each Supabase organization you want to connect to:

1. Log into that org's account at [supabase.com](https://supabase.com)
2. Click your avatar in the top right → **Account Preferences**
3. Go to **Access Tokens** → **Generate new token**
4. Name it something descriptive (e.g. "Claude Code - Personal" or "Claude Code - ClientX")
5. Copy and save the token — you won't be able to see it again

Repeat for each org. If you have two orgs, you'll end up with two PATs.

### Step 2: Find Your Project Refs

For each project you want to scope the MCP to:

1. Open the project in the Supabase dashboard
2. Go to **Project Settings** → **General**
3. Copy the **Project ID** (this is your `project_ref`)

Scoping to a specific project ref is strongly recommended — without it, the MCP server has access to everything in that org.

### Step 3: Configure `.mcp.json`

In the root of each Claude Code project, create (or edit) a `.mcp.json` file:

```json
{
  "mcpServers": {
    "supabase-project-a": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF_A",
      "headers": {
        "Authorization": "Bearer YOUR_PAT_FOR_ORG_A"
      }
    },
    "supabase-project-b": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF_B",
      "headers": {
        "Authorization": "Bearer YOUR_PAT_FOR_ORG_B"
      }
    }
  }
}
```

Give each server a descriptive name (the key in `mcpServers`) so you can tell them apart. Claude Code will pick this up automatically when you open a session in that directory.

### Step 4: Verify It's Working

Open Claude Code in the project directory and run `/mcp`. You should see your named servers listed and connected. Then try a quick sanity check:

> "List all tables in the database using MCP tools."

If tools come back, you're in business.

## Using Multiple Projects from One Config

The real power of this approach is that you can define both servers in a single `.mcp.json` and have them active at the same time. Claude Code will have simultaneous access to both projects and can query either one in the same session. Just be explicit in your prompts about which project you're referring to.

If you'd rather keep configs separate, just put a `.mcp.json` in each project's directory with only the relevant server defined. Claude Code loads config from the working directory, so each project gets its own isolated MCP context.

## Security Considerations

A few things worth keeping in mind:

- **Add `.mcp.json` to `.gitignore`** - PATs are secrets and should never be committed to version control.
- **Use environment variables instead of hardcoding tokens** - Claude Code will expand shell environment variables, so you can do `"Bearer $SUPABASE_PAT_PERSONAL"` and set the variables in your shell profile.
- **Consider read-only mode** for projects where you only need to query data. Just append `&read_only=true` to the URL: `https://mcp.supabase.com/mcp?project_ref=abc123&read_only=true`
- **Scope to a project ref whenever possible** - Without a `project_ref`, the MCP server has access to every project in that org.

## Why This Approach Works

Supabase's MCP server is a hosted remote server, not a locally-installed package. The `type: "http"` configuration tells Claude Code to connect to it over HTTP rather than spawning a subprocess. The `Authorization` header is the officially supported way to authenticate in non-interactive environments where a browser OAuth flow isn't possible — which is exactly what we need here for a stable, multi-org setup.

The `npx` approach predates Supabase's hosted remote MCP and is effectively deprecated for this use case, even though it still appears in a lot of tutorials and community posts.

## Conclusion

Once you get past the authentication model shift, the setup is actually quite clean. A `.mcp.json` with two entries, two PATs, two project refs — and you're done. No more logging in and out, no browser tabs, no broken tool discovery.

If you're building across multiple Supabase projects or organizations with Claude Code, this is the approach to use. The configuration takes about five minutes and saves a lot of friction.

The full config template is above — swap in your own project refs and tokens and you should be up and running.