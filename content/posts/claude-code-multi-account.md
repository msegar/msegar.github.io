---
title: Using Separate Work and Personal Claude Code Accounts on One Mac
description: How to switch Claude Code to your work account inside specific folders and keep your personal account everywhere else, using CLAUDE_CONFIG_DIR and direnv
date: 2026-09-29
img: ../assets/images/claude-code-multi-account.png
categories: [Claude Code, macOS, Developer Tools]
---

If you use Claude Code for work and personal projects, you have hit this limit: it assumes one signed-in account per machine. Switching from personal to work means logging out, logging back in through the browser, and remembering to reverse it later.

I wanted the folder to decide. Inside my work folder and any repo beneath it, Claude Code uses my work account. Everywhere else it uses my personal one. This post covers the setup.

## The Problem with the Default Setup

Claude Code keeps its login, settings, and history in `~/.claude`. Each user has one of those directories, so each user gets one account. The environment variable `CLAUDE_CONFIG_DIR` points Claude Code at a different config directory. It is stable but undocumented. Set it to a new path and you get a separate profile with its own login.

Three things tripped me up:

1. **Setting the variable per folder needs a tool.** Most guides use shell aliases like `claude-work` and `claude-personal`. Those work, but you have to remember which one to type.
2. **A missing shell hook fails silently.** I installed direnv, created the `.envrc`, ran `direnv allow`, and saw nothing. No error appeared. The variable never got set because I had skipped the direnv hook in `~/.zshrc`.
3. **You can log into the wrong profile.** With the variable unset, I signed into my work account in the *default* profile. Every repo on my machine then used my work account.

## The Solution: `CLAUDE_CONFIG_DIR` + direnv

[direnv](https://direnv.net) loads and unloads environment variables based on your current directory. An `.envrc` in a folder applies its exports to that folder and every subfolder. When you `cd` out, direnv unsets them.

### Step 1: Install direnv and Hook It Into Your Shell

```bash
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
exec zsh
```

The second line is the one I missed. Without the hook, direnv never runs when you change directories, and nothing tells you.

If you use bash, swap `zsh` for `bash` and add the line to `~/.bashrc`.

### Step 2: Add an `.envrc` to Your Work Folder

Put it at the top of the folder that holds your work repos. My layout:

```
~/matt/project1/
├── .envrc
└── apps/
    ├── app1/
    ├── app2/
    └── ...
```

```bash
cd ~/path/to/your/work-folder
echo 'export CLAUDE_CONFIG_DIR=~/.claude-work' > .envrc
direnv allow
```

Every repo under that folder, including repos you add later, now uses the work profile.

### Step 3: Verify the Variable Is Set

```bash
cd ~/path/to/your/work-folder/apps/some-repo
echo $CLAUDE_CONFIG_DIR     # → /Users/you/.claude-work

cd ~/some/personal/repo
echo $CLAUDE_CONFIG_DIR     # → (nothing)
```

You should also see a `direnv: loading .../.envrc` line each time you `cd` into the work folder. If it doesn't appear, return to Step 1.

### Step 4: Log In Once Per Profile

- **Outside the work folder:** run `claude` and check `/status`. If it shows your work account, as mine did, run `/logout`, then `/login` with your **personal** account.
- **Inside the work folder:** run `claude` and `/login` with your **work** account. This profile starts empty, so Claude Code prompts you.

Run `/status` in each location to confirm. After that, type `claude` and the folder picks the account.

## Things Worth Knowing

- **Nested `.envrc` files replace the parent's.** direnv loads only the nearest `.envrc`. If a work repo has its own `.envrc` for app-specific variables, make `source_up` its first line so it still inherits the work profile.
- **Keep `.envrc` out of git.** Add it to `.gitignore` or your global gitignore so teammates don't inherit your local path.
- **Launch your editor from the terminal.** direnv sets variables in your shell. To use Claude Code inside VS Code or Cursor, run `code .` from inside the folder so the editor inherits `CLAUDE_CONFIG_DIR`.
- **Each profile has its own settings.** Settings, MCP servers, custom commands, and your global `CLAUDE.md` live in the config directory. To share them, copy or symlink the files into `~/.claude-work`. Project-level `.claude/` folders inside a repo behave the same under either account.
- **Update Claude Code on macOS.** Claude Code stores credentials in the macOS Keychain instead of a file. Recent versions keep a separate Keychain entry for each config directory. If both profiles collapse onto the same account, run `claude update` and log in again in each one.

## Why This Works

Claude Code reads `CLAUDE_CONFIG_DIR` at startup and keeps everything under that directory, including the pointer to its login. direnv sets the variable when you enter the work folder and clears it when you leave. Your folder layout then picks the account, which matches how I already sort work from personal.

## Conclusion

The setup takes one Homebrew install, one line in `~/.zshrc`, one `.envrc`, and two logins. If `echo $CLAUDE_CONFIG_DIR` comes back empty inside your work folder, check the shell hook first.

Once it's in place, `cd` into a folder, type `claude`, and you're on the right account.
