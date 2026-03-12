# cc-cowork

Share Claude Code sessions + project files with collaborators via encrypted one-time codes. No server needed.

## How It Works

**User A** shares their session from inside Claude Code:
```
> /share
```
```
Shared! (42 messages + project files)
Send this to your collaborator (one-time use, deleted after import):

npx cc-cowork cCw_a1b2c3d4e5f6...
```

**User B** pastes that command in terminal — everything happens automatically:
```bash
npx cc-cowork cCw_a1b2c3d4e5f6...
```
```
Session + project imported! (42 messages + project files)
Launching Claude Code...
```

That's it. User B has the full project files and conversation — ready to continue where User A left off.

## What Gets Shared

Everything:
- Full conversation history (user + assistant turns, tool calls, results)
- All project files including hidden files (`.claude/`, `CLAUDE.md`, `.env`, etc.)

The session is filtered to strip noise (progress indicators, file snapshots) and the project is tar'd and bundled together.

## Security

- **AES-256-GCM encryption** — everything is encrypted locally before it leaves your machine
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

No install needed — `npx` downloads and runs it automatically. Project files are extracted to your current directory, Claude Code launches with the full conversation.

Optionally specify a project directory:

```bash
npx cc-cowork cCw_a1b2c3d4e5f6... ~/my-project
```

## Setting up `/share` (for sharing your own sessions)

Install the `/share` skill into Claude Code:

```bash
npx cc-cowork --install
```

Then **restart Claude Code**. Now you can type `/share` in any session to share it.

### What gets installed

```
~/.claude/skills/share/
├── SKILL.md              # Defines the /share slash command
└── scripts/
    └── share.mjs         # Node.js script (encryption + Gist upload/download)
```

Claude Code loads custom slash commands from `~/.claude/skills/`. Each skill is a folder with a `SKILL.md` that tells Claude what to do when the command is invoked.

## How It Works Under the Hood

1. **Export**: Tar's the project directory, reads the session JSONL, bundles them together, encrypts with AES-256-GCM, uploads ciphertext to a secret GitHub Gist
2. **Hash**: The share code (`cCw_...`) encodes the Gist ID + encryption key in base64url — ~68 characters
3. **Import**: Decodes the hash, downloads from the Gist API, decrypts, extracts project files, writes session file, deletes the Gist

The encryption key never leaves the share code. GitHub only ever sees encrypted data.

## Uninstall

```bash
rm -rf ~/.claude/skills/share
```

## License

MIT
