---
name: share
description: Share your current Claude Code session with a collaborator via encrypted one-time code
argument-hint: [--full] [code-to-import]
disable-model-invocation: true
allowed-tools: Bash(node *), Bash(tar *)
---

## Share Session

This skill shares Claude Code sessions via encrypted one-time codes using GitHub Gists.

### Usage

**Export session only (no arguments):**
```bash
node ~/.claude/skills/share/scripts/share.mjs export ${CLAUDE_SESSION_ID} ${CLAUDE_PROJECT_DIR}
```

**Export session + all project files (`--full`):**
```bash
node ~/.claude/skills/share/scripts/share.mjs export --full ${CLAUDE_SESSION_ID} ${CLAUDE_PROJECT_DIR}
```

**Import (with code argument):**
```bash
node ~/.claude/skills/share/scripts/share.mjs import $ARGUMENTS ${CLAUDE_PROJECT_DIR}
```

### Instructions

- If `$ARGUMENTS` is empty, run the **export session only** command
- If `$ARGUMENTS` is `--full`, run the **export session + project files** command
- If `$ARGUMENTS` contains a code (starts with `cCw_`), run the **import** command (remove `--full` if present before the code)
- Print the script output exactly as-is to the user
- Do NOT add any extra commentary
