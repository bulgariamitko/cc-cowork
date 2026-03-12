#!/usr/bin/env node

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';

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

function parseLines(jsonlContent) {
  // Keep ALL messages to preserve the parentUuid chain.
  // Filtering breaks the conversation tree.
  return jsonlContent.split('\n').filter(Boolean);
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
  let encoded = projectDir;
  if (projectDir.startsWith('/')) {
    encoded = projectDir.replace(/\//g, '-');
  }
  return join(homedir(), '.claude', 'projects', encoded);
}

function resolveProjectCwd(projectDir) {
  // Convert encoded project dir back to absolute path, or return as-is if already absolute
  if (projectDir.startsWith('/')) {
    return projectDir;
  }
  // Encoded format: -Users-foo-bar → /Users/foo/bar
  return projectDir.replace(/^-/, '/').replace(/-/g, '/');
}

function uploadToGist(data, desc) {
  const tmpFile = join(tmpdir(), '.cc-cowork-' + randomUUID());
  writeFileSync(tmpFile, data);

  let gistUrl;
  try {
    gistUrl = execSync(
      `gh gist create "${tmpFile}" --desc "${desc}" --public=false`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
  } catch (err) {
    try { execSync(`rm "${tmpFile}"`); } catch { /* ignore */ }
    console.error('Failed to create gist. Is `gh` CLI installed and authenticated?');
    console.error(err.stderr || err.message);
    process.exit(1);
  }

  try { execSync(`rm "${tmpFile}"`); } catch { /* ignore */ }

  const gistId = gistUrl.split('/').pop();
  if (!gistId || gistId.length !== 32) {
    console.error(`Unexpected gist ID format: ${gistId} (from ${gistUrl})`);
    process.exit(1);
  }
  return gistId;
}

function downloadFromGist(gistId) {
  const gistJson = execSync(
    `gh api gists/${gistId}`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024 }
  );
  const gist = JSON.parse(gistJson);
  const files = Object.values(gist.files);
  if (files.length === 0) throw new Error('Gist has no files');
  const file = files[0];
  if (file.truncated) {
    return execSync(
      `curl -sL "${file.raw_url}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024 }
    );
  }
  return file.content;
}

function deleteGist(gistId) {
  try {
    execSync(`gh gist delete ${gistId} --yes`, { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    console.error('Warning: Could not delete gist. You may want to delete it manually.');
  }
}

const STATS_GIST_ID = '8d17ab9286de738fde8dda3109242ae3';

function bumpStat(field) {
  // Silently increment share/import counter — never block on failure
  try {
    const gistJson = execSync(
      `gh api gists/${STATS_GIST_ID}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }
    );
    const gist = JSON.parse(gistJson);
    const stats = JSON.parse(Object.values(gist.files)[0].content);
    stats[field] = (stats[field] || 0) + 1;
    const body = JSON.stringify({ files: { 'stdin.txt': { content: JSON.stringify(stats) } } });
    const tmpFile = join(tmpdir(), '.cc-cowork-stats-' + randomUUID() + '.json');
    writeFileSync(tmpFile, body);
    execSync(
      `gh api gists/${STATS_GIST_ID} -X PATCH --input "${tmpFile}"`,
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }
    );
    try { execSync(`rm "${tmpFile}"`); } catch { /* ignore */ }
  } catch { /* silent — stats are nice-to-have, never block */ }
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
  const lines = parseLines(content);
  const msgCount = countConversationMessages(lines);
  const sessionData = lines.join('\n');

  // Tar the project directory (all files including hidden)
  const projectCwd = resolveProjectCwd(projectDir);
  if (!existsSync(projectCwd)) {
    console.error(`Project directory not found: ${projectCwd}`);
    process.exit(1);
  }

  const tarFile = join(tmpdir(), '.cc-cowork-tar-' + randomUUID() + '.tar.gz');
  try {
    execSync(
      `tar -czf "${tarFile}" -C "${projectCwd}" .`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (err) {
    console.error('Failed to create project archive.');
    console.error(err.stderr || err.message);
    process.exit(1);
  }

  const tarData = readFileSync(tarFile).toString('base64');
  try { execSync(`rm "${tarFile}"`); } catch { /* ignore */ }

  const payload = JSON.stringify({
    type: 'full',
    session: sessionData,
    files: tarData,
  });

  const key = randomBytes(KEY_BYTES);
  const encrypted = encrypt(payload, key);
  const gistId = uploadToGist(encrypted, 'cc-cowork shared session');
  const hash = buildHash(gistId, key);

  console.log(`Shared! (${msgCount} messages + project files)`);
  console.log(`Send this to your collaborator (one-time use, deleted after import):`);
  console.log(``);
  console.log(`npx cc-cowork ${hash}`);

  bumpStat('shares');
}

// --- Import ---

async function doImport(hash, projectDir) {
  const { gistId, key } = parseHash(hash);

  let encrypted;
  try {
    encrypted = downloadFromGist(gistId);
  } catch (err) {
    console.error('Failed to download gist. It may have been deleted or the code is invalid.');
    console.error(err.stderr || err.message);
    process.exit(1);
  }

  let payload;
  try {
    payload = decrypt(encrypted, key);
  } catch (err) {
    console.error('Decryption failed. The code may be corrupted.');
    process.exit(1);
  }

  // Detect payload type: full (JSON with files) or session-only (plain JSONL)
  let sessionData;
  let hasFiles = false;

  try {
    const parsed = JSON.parse(payload);
    if (parsed.type === 'full' && parsed.session && parsed.files) {
      sessionData = parsed.session;
      hasFiles = true;

      // Extract project files
      const projectCwd = projectDir.startsWith('/') ? projectDir : resolve(projectDir);
      mkdirSync(projectCwd, { recursive: true });

      const tarFile = join(tmpdir(), '.cc-cowork-tar-' + randomUUID() + '.tar.gz');
      writeFileSync(tarFile, Buffer.from(parsed.files, 'base64'));

      try {
        execSync(
          `tar -xzf "${tarFile}" -C "${projectCwd}"`,
          { stdio: ['pipe', 'pipe', 'pipe'] }
        );
      } catch (err) {
        console.error('Failed to extract project files.');
        console.error(err.stderr || err.message);
        process.exit(1);
      }

      try { execSync(`rm "${tarFile}"`); } catch { /* ignore */ }
    } else {
      sessionData = payload;
    }
  } catch {
    // Not JSON — it's plain JSONL (session-only)
    sessionData = payload;
  }

  // Write session JSONL
  const newSessionId = randomUUID();
  const dir = resolveProjectDir(projectDir);
  mkdirSync(dir, { recursive: true });
  const outFile = join(dir, `${newSessionId}.jsonl`);

  const projectCwd = projectDir.startsWith('/') ? projectDir : resolve(projectDir);
  const lines = sessionData.split('\n').filter(Boolean);
  const rewritten = lines.map(line => {
    try {
      const msg = JSON.parse(line);
      msg.sessionId = newSessionId;
      if (msg.cwd) msg.cwd = projectCwd;
      return JSON.stringify(msg);
    } catch {
      return line;
    }
  });

  writeFileSync(outFile, rewritten.join('\n') + '\n');

  const msgCount = countConversationMessages(rewritten);

  deleteGist(gistId);

  if (hasFiles) {
    console.log(`Session + project imported! (${msgCount} messages + project files)`);
  } else {
    console.log(`Session imported! (${msgCount} messages)`);
  }
  console.log(`Exit and run: claude --resume ${newSessionId}`);

  bumpStat('imports');
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
  if (!arg1 || !arg2) {
    console.error('Usage: share.mjs import <hash> <projectDir>');
    process.exit(1);
  }
  await doImport(arg1, arg2);
} else {
  console.error('Usage: share.mjs <export|import> ...');
  process.exit(1);
}
