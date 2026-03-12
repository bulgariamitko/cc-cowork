#!/usr/bin/env node

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PREFIX = 'cCw_';
const GIST_ID_BYTES = 16; // 32 hex chars = 16 bytes
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

// --- Helpers ---

function base64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function encrypt(plaintext, key) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // IV (12) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(encoded, key) {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
}

function buildHash(gistId, key) {
  // gistId is 32 hex chars -> convert to 16 bytes
  const gistIdBytes = Buffer.from(gistId, 'hex');
  const combined = Buffer.concat([gistIdBytes, key]);
  return PREFIX + base64urlEncode(combined);
}

function parseHash(hash) {
  if (!hash.startsWith(PREFIX)) {
    throw new Error('Invalid share code: must start with ' + PREFIX);
  }
  const decoded = base64urlDecode(hash.slice(PREFIX.length));
  if (decoded.length !== GIST_ID_BYTES + KEY_BYTES) {
    throw new Error('Invalid share code: wrong length');
  }
  const gistIdBytes = decoded.subarray(0, GIST_ID_BYTES);
  const key = decoded.subarray(GIST_ID_BYTES);
  return {
    gistId: gistIdBytes.toString('hex'),
    key,
  };
}

function filterMessages(jsonlContent) {
  const lines = jsonlContent.split('\n').filter(Boolean);
  const kept = [];
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      // Skip progress and file-history-snapshot messages
      if (msg.type === 'progress' || msg.type === 'file-history-snapshot') continue;
      kept.push(line);
    } catch {
      // Skip malformed lines
    }
  }
  return kept;
}

function countConversationMessages(lines) {
  let count = 0;
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'user' || msg.type === 'assistant') count++;
    } catch { /* skip */ }
  }
  return count;
}

function resolveProjectDir(projectDir) {
  // projectDir comes as the raw CLAUDE_PROJECT_DIR value
  // Session files are at ~/.claude/projects/<projectDir>/<sessionId>.jsonl
  return join(homedir(), '.claude', 'projects', projectDir);
}

// --- Export ---

async function doExport(sessionId, projectDir) {
  const dir = resolveProjectDir(projectDir);
  const sessionFile = join(dir, `${sessionId}.jsonl`);

  if (!existsSync(sessionFile)) {
    console.error(`Session file not found: ${sessionFile}`);
    process.exit(1);
  }

  const content = readFileSync(sessionFile, 'utf8');
  const filteredLines = filterMessages(content);
  const msgCount = countConversationMessages(filteredLines);
  const payload = filteredLines.join('\n');

  // Generate encryption key
  const key = randomBytes(KEY_BYTES);

  // Encrypt
  const encrypted = encrypt(payload, key);

  // Upload to GitHub Gist via gh CLI
  // Write encrypted data to a temp file, then upload
  const tmpFile = join(homedir(), '.claude', '.share-tmp-' + randomUUID());
  writeFileSync(tmpFile, encrypted);

  let gistUrl;
  try {
    gistUrl = execSync(
      `gh gist create "${tmpFile}" --desc "cc-cowork shared session" --public=false`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
  } catch (err) {
    // Clean up temp file
    try { execSync(`rm "${tmpFile}"`); } catch { /* ignore */ }
    console.error('Failed to create gist. Is `gh` CLI installed and authenticated?');
    console.error(err.stderr || err.message);
    process.exit(1);
  }

  // Clean up temp file
  try { execSync(`rm "${tmpFile}"`); } catch { /* ignore */ }

  // Extract gist ID from URL (last path segment)
  const gistId = gistUrl.split('/').pop();

  if (!gistId || gistId.length !== 32) {
    console.error(`Unexpected gist ID format: ${gistId} (from ${gistUrl})`);
    process.exit(1);
  }

  const hash = buildHash(gistId, key);

  console.log(`Session shared! (${msgCount} messages)`);
  console.log(`Code: ${hash}`);
  console.log(`Share this code. It's one-time use and will be deleted after import.`);
}

// --- Import ---

async function doImport(hash, projectDir) {
  const { gistId, key } = parseHash(hash);

  // Download from gist using gh api to get raw file content
  let encrypted;
  try {
    const gistJson = execSync(
      `gh api gists/${gistId}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 }
    );
    const gist = JSON.parse(gistJson);
    const files = Object.values(gist.files);
    if (files.length === 0) throw new Error('Gist has no files');
    encrypted = files[0].content;
  } catch (err) {
    console.error('Failed to download gist. It may have been deleted or the code is invalid.');
    console.error(err.stderr || err.message);
    process.exit(1);
  }

  // Decrypt
  let payload;
  try {
    payload = decrypt(encrypted, key);
  } catch (err) {
    console.error('Decryption failed. The code may be corrupted.');
    process.exit(1);
  }

  // Write as new session JSONL
  const newSessionId = randomUUID();
  const dir = resolveProjectDir(projectDir);
  const outFile = join(dir, `${newSessionId}.jsonl`);

  // Rewrite sessionId in each line to the new session ID
  const lines = payload.split('\n').filter(Boolean);
  const rewritten = lines.map(line => {
    try {
      const msg = JSON.parse(line);
      msg.sessionId = newSessionId;
      return JSON.stringify(msg);
    } catch {
      return line;
    }
  });

  writeFileSync(outFile, rewritten.join('\n') + '\n');

  const msgCount = countConversationMessages(rewritten);

  // Delete gist (one-time use)
  try {
    execSync(`gh gist delete ${gistId} --yes`, { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    console.error('Warning: Could not delete gist. You may want to delete it manually.');
  }

  console.log(`Session imported! (${msgCount} messages)`);
  console.log(`Exit and run: claude --resume ${newSessionId}`);
}

// --- Main ---

const [,, command, arg1, arg2] = process.argv;

if (command === 'export') {
  if (!arg1 || !arg2) {
    console.error('Usage: share.mjs export <sessionId> <projectDir>');
    process.exit(1);
  }
  await doExport(arg1, arg2);
} else if (command === 'import') {
  if (!arg1) {
    console.error('Usage: share.mjs import <hash> [projectDir]');
    process.exit(1);
  }
  if (!arg2) {
    console.error('Usage: share.mjs import <hash> <projectDir>');
    process.exit(1);
  }
  await doImport(arg1, arg2);
} else {
  console.error('Usage: share.mjs <export|import> ...');
  process.exit(1);
}
