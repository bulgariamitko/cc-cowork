---
name: share
description: Share your current Claude Code session and project files with a collaborator via encrypted one-time code
argument-hint: [code-to-import]
disable-model-invocation: true
allowed-tools: Bash(node *), Bash(tar *)
---

## Share Session

This skill shares Claude Code sessions + project files via encrypted one-time codes using GitHub Gists.

### Usage

**Export (no arguments):**
```bash
node ~/.claude/skills/share/scripts/share.mjs export ${CLAUDE_SESSION_ID} ${CLAUDE_PROJECT_DIR}
```

**Import (with code argument):**
```bash
node ~/.claude/skills/share/scripts/share.mjs import $ARGUMENTS ${CLAUDE_PROJECT_DIR}
```

### Instructions

- If `$ARGUMENTS` is empty, run the **export** command above
- If `$ARGUMENTS` contains a code (starts with `cCw_`), run the **import** command above
- Print the script output exactly as-is to the user
- Do NOT add any extra commentary
