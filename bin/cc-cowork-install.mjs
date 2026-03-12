#!/usr/bin/env node

// cc-cowork-install: Install the /share skill into Claude Code
// Usage: cc-cowork-install

import { mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'skills', 'share');
const destDir = join(homedir(), '.claude', 'skills', 'share');

mkdirSync(join(destDir, 'scripts'), { recursive: true });
copyFileSync(join(srcDir, 'SKILL.md'), join(destDir, 'SKILL.md'));
copyFileSync(join(srcDir, 'scripts', 'share.mjs'), join(destDir, 'scripts', 'share.mjs'));

console.log('Installed /share skill to ' + destDir);
console.log('Restart Claude Code to use /share');
