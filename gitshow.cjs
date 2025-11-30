const fs = require('fs');
const path = require('path');
const { GitRepo } = require('./gitlib.cjs');
const file = process.argv[2];
if (!file) {
  console.error('Usage: node gitshow.cjs <path>');
  process.exit(1);
}
const repo = new GitRepo(process.cwd());
const blob = repo.getHeadBlob(file);
if (!blob) {
  console.error('File not found in HEAD');
  process.exit(1);
}
process.stdout.write(blob);
