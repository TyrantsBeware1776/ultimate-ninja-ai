const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class GitRepo {
  constructor(root) {
    this.root = root;
    this.gitDir = path.join(root, '.git');
    this.headHash = this.resolveHead();
    this.packs = this.loadPacks();
    this.objectCache = new Map();
    this.entries = null;
  }
  resolveHead() {
    const headRef = fs.readFileSync(path.join(this.gitDir, 'HEAD'), 'utf8').trim();
    if (headRef.startsWith('ref:')) {
      const ref = headRef.split(':',2)[1].trim();
      return fs.readFileSync(path.join(this.gitDir, ref), 'utf8').trim();
    }
    return headRef;
  }
  loadPacks() {
    const packDir = path.join(this.gitDir, 'objects', 'pack');
    if (!fs.existsSync(packDir)) return [];
    const packs = [];
    for (const file of fs.readdirSync(packDir)) {
      if (!file.endsWith('.pack')) continue;
      const packPath = path.join(packDir, file);
      const idxPath = packPath.replace(/\.pack$/, '.idx');
      if (!fs.existsSync(idxPath)) continue;
      packs.push({buf: fs.readFileSync(packPath), map: this.parseIdx(idxPath)});
    }
    return packs;
  }
  parseIdx(idxPath) {
    const buf = fs.readFileSync(idxPath);
    let offset = 0;
    let version = 1;
    if (buf.readUInt32BE(0) === 0xff744f63) {
      version = buf.readUInt32BE(4);
      offset = 8;
    }
    if (version !== 2) throw new Error('Unsupported idx version');
    for (let i=0;i<256;i++) offset += 4;
    const total = buf.readUInt32BE(8 + 255*4);
    const hashes = [];
    for (let i=0;i<total;i++) {
      hashes.push(buf.subarray(offset, offset+20).toString('hex'));
      offset+=20;
    }
    offset += total*4; // skip CRC
    const rawOffsets = [];
    let largeCount = 0;
    for (let i=0;i<total;i++) {
      const val = buf.readUInt32BE(offset); offset+=4;
      rawOffsets.push(val);
      if (val & 0x80000000) largeCount++;
    }
    const largeOffsets = [];
    for (let i=0;i<largeCount;i++) {
      largeOffsets.push(Number(buf.readBigUInt64BE(offset)));
      offset+=8;
    }
    const offsets = [];
    let bigIdx = 0;
    for (const val of rawOffsets) {
      if (val & 0x80000000) offsets.push(largeOffsets[bigIdx++]);
      else offsets.push(val);
    }
    const map = new Map();
    hashes.forEach((sha,i)=> map.set(sha, offsets[i]));
    return map;
  }
  readLooseObject(sha) {
    const file = path.join(this.gitDir, 'objects', sha.slice(0,2), sha.slice(2));
    if (!fs.existsSync(file)) return null;
    return zlib.inflateSync(fs.readFileSync(file));
  }
  getObjectData(sha) {
    if (this.objectCache.has(sha)) return this.objectCache.get(sha);
    const loose = this.readLooseObject(sha);
    if (loose) { this.objectCache.set(sha, loose); return loose; }
    for (const pack of this.packs) {
      const offset = pack.map.get(sha);
      if (offset !== undefined) {
        const obj = this.readObjectAtOffset(pack, offset);
        this.objectCache.set(sha, obj.dataWithHeader);
        return obj.dataWithHeader;
      }
    }
    throw new Error('Missing object '+sha);
  }
  readObjectAtOffset(pack, offset) {
    const buf = pack.buf;
    let pos = offset;
    const start = offset;
    let c = buf[pos++];
    let type = (c >> 4) & 7;
    let size = c & 0x0f;
    let shift = 4;
    while (c & 0x80) {
      c = buf[pos++];
      size |= (c & 0x7f) << shift;
      shift += 7;
    }
    if (type === 6) {
      let distance = 0;
      let byte;
      do {
        byte = buf[pos++];
        distance = (distance << 7) + (byte & 0x7f);
      } while (byte & 0x80);
      distance += 1;
      const baseOffset = start - distance;
      const baseObj = this.readObjectAtOffset(pack, baseOffset);
      const delta = zlib.inflateSync(buf.subarray(pos));
      const result = this.applyDelta(baseObj.data, delta);
      return this.wrapDelta(baseObj.type, result);
    } else if (type === 7) {
      const baseSha = buf.subarray(pos, pos+20).toString('hex');
      pos += 20;
      const base = this.parseObject(this.getObjectData(baseSha));
      const delta = zlib.inflateSync(buf.subarray(pos));
      const result = this.applyDelta(base.body, delta);
      return this.wrapDelta(base.type, result);
    } else {
      const inflated = zlib.inflateSync(buf.subarray(pos));
      const typeName = ['','commit','tree','blob','tag','','ofs-delta','ref-delta'][type];
      const header = Buffer.from(typeName + ' ' + inflated.length + '\0');
      return {type:typeName, data:inflated, dataWithHeader: Buffer.concat([header, inflated])};
    }
  }
  wrapDelta(type, data) {
    const header = Buffer.from(type + ' ' + data.length + '\0');
    return {type, data, dataWithHeader: Buffer.concat([header, data])};
  }
  parseObject(buffer) {
    const nul = buffer.indexOf(0);
    const header = buffer.subarray(0, nul).toString();
    const body = buffer.subarray(nul+1);
    const type = header.split(' ')[0];
    return {type, body};
  }
  applyDelta(base, delta) {
    let idx = 0;
    function readVar() {
      let shift = 0;
      let result = 0;
      while (true) {
        const byte = delta[idx++];
        result |= (byte & 0x7f) << shift;
        if (!(byte & 0x80)) break;
        shift += 7;
      }
      return result;
    }
    readVar();
    const resultSize = readVar();
    const out = Buffer.alloc(resultSize);
    let outPos = 0;
    while (idx < delta.length) {
      const opcode = delta[idx++];
      if (opcode & 0x80) {
        let cpOffset = 0;
        if (opcode & 1) cpOffset |= delta[idx++];
        if (opcode & 2) cpOffset |= delta[idx++] << 8;
        if (opcode & 4) cpOffset |= delta[idx++] << 16;
        if (opcode & 8) cpOffset |= delta[idx++] << 24;
        let cpSize = 0;
        if (opcode & 16) cpSize |= delta[idx++];
        if (opcode & 32) cpSize |= delta[idx++] << 8;
        if (opcode & 64) cpSize |= delta[idx++] << 16;
        if (cpSize === 0) cpSize = 0x10000;
        base.copy(out, outPos, cpOffset, cpOffset + cpSize);
        outPos += cpSize;
      } else if (opcode) {
        delta.copy(out, outPos, idx, idx + opcode);
        outPos += opcode;
        idx += opcode;
      } else {
        throw new Error('Invalid delta opcode');
      }
    }
    return out;
  }
  ensureEntries() {
    if (this.entries) return this.entries;
    const entries = new Map();
    const commit = this.parseObject(this.getObjectData(this.headHash));
    const treeHash = commit.body.toString().split('\n')[0].split(' ')[1];
    const walk = (sha, prefix='') => {
      const tree = this.parseObject(this.getObjectData(sha));
      const body = tree.body;
      let i = 0;
      while (i < body.length) {
        const spaceIdx = body.indexOf(0x20, i);
        const mode = body.subarray(i, spaceIdx).toString();
        const nulIdx = body.indexOf(0, spaceIdx);
        const name = body.subarray(spaceIdx+1, nulIdx).toString();
        const shaBuf = body.subarray(nulIdx+1, nulIdx+21);
        const childSha = shaBuf.toString('hex');
        i = nulIdx + 21;
        if (mode.startsWith('04')) walk(childSha, prefix + name + '/');
        else entries.set(prefix + name, childSha);
      }
    };
    walk(treeHash);
    this.entries = entries;
    return entries;
  }
  getHeadBlob(file) {
    const entries = this.ensureEntries();
    const sha = entries.get(file);
    if (!sha) return null;
    return this.parseObject(this.getObjectData(sha)).body;
  }
  diffWorkingTree() {
    const entries = this.ensureEntries();
    const diffs = [];
    for (const [file, sha] of entries) {
      const filePath = path.join(this.root, file);
      if (!fs.existsSync(filePath)) {
        diffs.push({file, type:'deleted'});
        continue;
      }
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile()) {
        diffs.push({file, type:'type-change'});
        continue;
      }
      const current = fs.readFileSync(filePath);
      const blob = this.parseObject(this.getObjectData(sha)).body;
      if (!blob.equals(current)) diffs.push({file, type:'modified'});
    }
    const tracked = new Set(entries.keys());
    const allFiles = [];
    const stack = [this.root];
    while (stack.length) {
      const cur = stack.pop();
      for (const entry of fs.readdirSync(cur, {withFileTypes:true})) {
        if (entry.name === '.git') continue;
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else allFiles.push(path.relative(this.root, full));
      }
    }
    const untracked = allFiles.filter(f => !tracked.has(f));
    return {diffs, untracked};
  }
}

module.exports = { GitRepo };

if (require.main === module) {
  const repo = new GitRepo(process.cwd());
  const {diffs, untracked} = repo.diffWorkingTree();
  console.log('modified', diffs.length);
  console.log('untracked', untracked.length);
  console.log('modified files', diffs);
  console.log('untracked sample', untracked.slice(0,20));
}
