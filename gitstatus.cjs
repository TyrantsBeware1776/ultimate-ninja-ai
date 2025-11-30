const { GitRepo } = require('./gitlib.cjs');
const repo = new GitRepo(process.cwd());
const {diffs, untracked} = repo.diffWorkingTree();
console.log('modified', diffs.length);
console.log('untracked', untracked.length);
console.log('modified files', diffs);
console.log('untracked sample', untracked.slice(0,20));
