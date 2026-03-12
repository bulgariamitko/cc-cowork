# cc-cowork

Share Claude Code sessions with collaborators using a single `/share` command. Sessions are encrypted, uploaded as a secret GitHub Gist, and auto-deleted after import. No server needed.

## How It Works

**User A** shares their session:
```
> /share
```
```
Session shared! (42 messages)
Send this to your collaborator (one-time use, deleted after import):

/share cCw_a1b2c3d4e5f6...
```

**User B** imports the session:
```
> /share cCw_a1b2c3d4e5f6...
```
```
Session imported! (42 messages)
Exit and run: claude --resume abc123-def456
```

User B exits Claude Code, runs `claude --resume abc123-def456`, and picks up right where User A left off — full conversation context intact.

## What Gets Shared

The session JSONL is filtered to keep only meaningful messages (user + assistant turns, tool calls, results). Progress indicators and file snapshots are stripped to keep it lean.

## Security

- **AES-256-GCM encryption** — the session is encrypted locally before it ever leaves your machine
- **The key never touches GitHub** — it's embedded in the share code you send directly to your collaborator
- **Secret Gist** — not indexed, not searchable, only accessible via direct ID
- **One-time use** — the Gist is automatically deleted the moment it's imported
- **No server** — everything runs locally through Node.js and the `gh` CLI

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated (`gh auth login`)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed

## Install

### Option 1: Clone and run install script

```bash
git clone https://github.com/bulgariamitko/cc-cowork.git
cd cc-cowork
./install.sh
```

### Option 2: Manual install (no clone needed)

```bash
mkdir -p ~/.claude/skills/share/scripts
curl -sL https://raw.githubusercontent.com/bulgariamitko/cc-cowork/main/skills/share/SKILL.md -o ~/.claude/skills/share/SKILL.md
curl -sL https://raw.githubusercontent.com/bulgariamitko/cc-cowork/main/skills/share/scripts/share.mjs -o ~/.claude/skills/share/scripts/share.mjs
```

### What the install does

Claude Code loads custom slash commands from `~/.claude/skills/`. Each skill is a folder containing a `SKILL.md` file that defines the command name, description, and instructions for Claude.

The install copies two files into `~/.claude/skills/share/`:

```
~/.claude/skills/share/
├── SKILL.md              # Defines the /share slash command
└── scripts/
    └── share.mjs         # Node.js script that handles encryption + Gist upload/download
```

- **`SKILL.md`** — tells Claude Code to register `/share` as a slash command. When you type `/share`, Claude reads this file and follows the instructions inside (run the Node.js script with the right arguments).
- **`share.mjs`** — the actual logic. A single self-contained Node.js script with zero dependencies. Uses built-in `crypto` for AES-256-GCM encryption and the `gh` CLI for Gist operations.

After installing, **restart Claude Code** (exit and reopen) for the `/share` command to appear.

## Usage

### Share your session

Inside any Claude Code conversation, type:

```
/share
```

You'll get a ready-to-paste command like `/share cCw_PcP4dk...`. Send the whole line to your collaborator — they paste it directly into Claude Code.

### Import a shared session

Your collaborator opens Claude Code (in any project) and types:

```
/share cCw_PcP4dkeg8SyeruNrsFwmWuI0jOkTBFUh_RjRQAlZ61tlQeZyNC4B2tUf2X0E4cdG
```

They'll get a session ID back. Exit Claude Code, then:

```bash
claude --resume <session-id>
```

The full conversation loads with all context — they can continue right where you left off.

## How It Works Under the Hood

1. **Export**: Reads the session JSONL, filters out noise, encrypts with a random AES-256-GCM key, uploads the ciphertext to a secret GitHub Gist
2. **Hash**: The share code (`cCw_...`) encodes the Gist ID + encryption key in base64url — ~68 characters total
3. **Import**: Decodes the hash, downloads from the Gist API, decrypts, writes a new session JSONL file, deletes the Gist

The encryption key never leaves the share code. GitHub only ever sees encrypted data.

## Uninstall

```bash
rm -rf ~/.claude/skills/share
```

## License

MIT
