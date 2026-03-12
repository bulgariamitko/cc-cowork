# cc-cowork

Share Claude Code sessions with collaborators via encrypted one-time codes. No server needed.

## How It Works

**User A** shares their session from inside Claude Code:
```
> /share
```
```
Session shared! (42 messages)
Send this to your collaborator (one-time use, deleted after import):

/share cCw_a1b2c3d4e5f6...
```

**User B** runs one command in terminal — session imports and Claude Code launches automatically:
```bash
cc-join cCw_a1b2c3d4e5f6...
```
```
Session imported! (42 messages)
Launching Claude Code...
```

User B is now inside Claude Code with the full conversation context — ready to continue.

## Security

- **AES-256-GCM encryption** — the session is encrypted locally before it leaves your machine
- **The key never touches GitHub** — it's embedded in the share code you send directly to your collaborator
- **Secret Gist** — not indexed, not searchable, only accessible via direct ID
- **One-time use** — the Gist is automatically deleted after import
- **No server** — everything runs locally through Node.js and the `gh` CLI

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated (`gh auth login`)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed

## Install

```bash
npm install -g cc-cowork
```

This gives you two commands:

| Command | What it does |
|---|---|
| `cc-cowork-install` | Installs the `/share` skill into Claude Code |
| `cc-join <code>` | Imports a shared session and launches Claude Code |

### Set up the `/share` command

After installing the npm package, run:

```bash
cc-cowork-install
```

Then **restart Claude Code**. The `/share` slash command is now available in all your sessions.

### What gets installed where

The npm package provides the `cc-join` and `cc-cowork-install` CLI commands globally.

`cc-cowork-install` copies the skill files into Claude Code's skills directory:

```
~/.claude/skills/share/
├── SKILL.md              # Defines the /share slash command
└── scripts/
    └── share.mjs         # Node.js script (encryption + Gist upload/download)
```

Claude Code loads custom slash commands from `~/.claude/skills/`. Each skill is a folder with a `SKILL.md` that tells Claude what to do when the command is invoked.

## Usage

### Sharing a session (User A)

Inside any Claude Code conversation:

```
/share
```

You'll get a `cCw_...` code. Send it to your collaborator.

### Joining a session (User B)

Your collaborator doesn't even need the `/share` skill installed. They just need the npm package:

```bash
cc-join cCw_a1b2c3d4e5f6...
```

This downloads the session, decrypts it, and launches Claude Code with the full conversation — one command, no extra steps.

Optionally specify a project directory (defaults to current directory):

```bash
cc-join cCw_a1b2c3d4e5f6... ~/my-project
```

### Importing inside Claude Code (alternative)

If you prefer, you can also import from within a running Claude Code session:

```
/share cCw_a1b2c3d4e5f6...
```

## What Gets Shared

The session is filtered to keep only meaningful messages (user + assistant turns, tool calls, results). Progress indicators and file snapshots are stripped to keep it lean.

## How It Works Under the Hood

1. **Export**: Reads the session JSONL, filters noise, encrypts with a random AES-256-GCM key, uploads ciphertext to a secret GitHub Gist
2. **Hash**: The share code (`cCw_...`) encodes the Gist ID + encryption key in base64url — ~68 characters
3. **Import**: Decodes the hash, downloads from the Gist API, decrypts, writes a new session file, deletes the Gist

The encryption key never leaves the share code. GitHub only ever sees encrypted data.

## Uninstall

```bash
npm uninstall -g cc-cowork
rm -rf ~/.claude/skills/share
```

## License

MIT
