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

npx cc-cowork cCw_a1b2c3d4e5f6...
```

**User B** pastes that command in terminal — everything happens automatically:
```bash
npx cc-cowork cCw_a1b2c3d4e5f6...
```
```
Session imported! (42 messages)
Launching Claude Code...
```

That's it. User B is inside Claude Code with the full conversation — ready to continue where User A left off.

## Two Sharing Modes

| Command | What gets shared |
|---|---|
| `/share` | Session only (conversation + tool calls) |
| `/share --full` | Session + all project files (including hidden files like `.claude/`, `CLAUDE.md`, etc.) |

Use `--full` when your collaborator needs the actual project files to continue working, not just the conversation context. Import auto-detects which mode was used and extracts files if included.

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

## Joining a shared session

Your collaborator sends you a command. Paste it in your terminal:

```bash
npx cc-cowork cCw_a1b2c3d4e5f6...
```

No install needed — `npx` downloads and runs it automatically. The session imports, Claude Code launches, done.

If the share included project files (`--full`), they are extracted to your current directory before launching.

Optionally specify a project directory (defaults to current directory):

```bash
npx cc-cowork cCw_a1b2c3d4e5f6... ~/my-project
```

## Setting up `/share` (for sharing your own sessions)

If you want to share sessions yourself, install the `/share` skill into Claude Code:

```bash
npx cc-cowork --install
```

Then **restart Claude Code**. Now you can use:

- `/share` — share session only
- `/share --full` — share session + all project files

### What gets installed

The `/share` skill is two files copied into Claude Code's skills directory:

```
~/.claude/skills/share/
├── SKILL.md              # Defines the /share slash command
└── scripts/
    └── share.mjs         # Node.js script (encryption + Gist upload/download)
```

Claude Code loads custom slash commands from `~/.claude/skills/`. Each skill is a folder with a `SKILL.md` that tells Claude what to do when the command is invoked.

## How It Works Under the Hood

1. **Export**: Reads the session JSONL, filters noise, encrypts with a random AES-256-GCM key, uploads ciphertext to a secret GitHub Gist. With `--full`, the project directory is tar'd and bundled alongside the session.
2. **Hash**: The share code (`cCw_...`) encodes the Gist ID + encryption key in base64url — ~68 characters
3. **Import**: Decodes the hash, downloads from the Gist API, decrypts, writes a new session file, extracts project files if included, deletes the Gist

The encryption key never leaves the share code. GitHub only ever sees encrypted data.

## Uninstall

```bash
rm -rf ~/.claude/skills/share
```

## License

MIT
