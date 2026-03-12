#!/usr/bin/env node

// cc-join: Import a shared Claude Code session and launch it immediately
// Usage: cc-join <share-code> [project-dir]

import { execSync, spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shareMjs = join(__dirname, '..', 'skills', 'share', 'scripts', 'share.mjs');

const hash = process.argv[2];
const projectDir = resolve(process.argv[3] || '.');

if (!hash || hash.startsWith('-')) {
  console.log('cc-join — Import a shared Claude Code session and resume it');
  console.log('');
  console.log('Usage: cc-join <share-code> [project-dir]');
  console.log('');
  console.log('  share-code   The cCw_... code from your collaborator');
  console.log('  project-dir  Directory to associate the session with (default: current dir)');
  process.exit(1);
}

// Check gh CLI
try {
  execSync('gh auth status', { stdio: ['pipe', 'pipe', 'pipe'] });
} catch {
  console.error('Error: GitHub CLI (gh) is not installed or not authenticated.');
  console.error('Install: https://cli.github.com/');
  console.error('Then run: gh auth login');
  process.exit(1);
}

// Check claude CLI
try {
  execSync('which claude', { stdio: ['pipe', 'pipe', 'pipe'] });
} catch {
  console.error('Error: Claude Code (claude) is not installed.');
  console.error('Install: https://docs.anthropic.com/en/docs/claude-code');
  process.exit(1);
}

// Run import
let output;
try {
  output = execSync(
    `node "${shareMjs}" import "${hash}" "${projectDir}"`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
} catch (err) {
  console.error(err.stdout || '');
  console.error(err.stderr || '');
  process.exit(1);
}

console.log(output.trim());

// Extract session ID
const match = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
if (!match) {
  console.error('Could not extract session ID from import output.');
  process.exit(1);
}

const sessionId = match[0];

console.log('');
console.log('Launching Claude Code...');

// Launch claude --resume, replacing this process
const child = spawn('claude', ['--resume', sessionId], {
  cwd: projectDir,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
