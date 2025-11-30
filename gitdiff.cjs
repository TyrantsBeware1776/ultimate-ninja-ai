const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const root = process.cwd();
const gitDir = path.join(root, '.git');
function readFileSafe(p) {
  try { return fs.readFileSync(p); } catch (e) { return null; }
}
let headRef = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
let headHash;
if (headRef.startsWith('ref:')) {
  const ref = headRef.split(':',2)[1].trim();
  headHash = fs.readFileSync(path.join(gitDir, ref), 'utf8').trim();
} else headHash = headRef;
function readLooseObject(sha) {
  const objPath = path.join(gitDir, 'objects', sha.slice(0,2), sha.slice(2));
  const data = readFileSafe(objPath);
  if (!data) return null;
  return zlib.inflateSync(data);
}
const packDir = path.join(gitDir, 'objects', 'pack');
const packFiles = fs.existsSync(packDir) ? fs.readdirSync(packDir).filter(f=>f.endsWith('.pack')) : [];
const packs = [];
function parseIdx(idxPath) {
  const buf = fs.readFileSync(idxPath);
  let offset = 0;
  let version = 1;
  if (buf.readUInt32BE(0) === 0xff744f63) {
    version = buf.readUInt32BE(4);
    offset = 8;
  }
  if (version !== 2) throw new Error('Unsupported idx version');
  const fanout = new Array(256);
  for (let i=0;i<256;i++) {
    fanout[i] = buf.readUInt32BE(offset); offset+=4;
  }
  const total = fanout[255];
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
    const big = Number(buf.readBigUInt64BE(offset));
    offset+=8;
    largeOffsets.push(big);
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
for (const packFile of packFiles) {
  const packPath = path.join(packDir, packFile);
  const idxPath = packPath.replace(/\.pack$/, '.idx');
  if (!fs.existsSync(idxPath)) continue;
  packs.push({buf: fs.readFileSync(packPath), map: parseIdx(idxPath)});
}
const objectCache = new Map();
function getObjectData(sha) {
  if (objectCache.has(sha)) return objectCache.get(sha);
  let loose = readLooseObject(sha);
  if (loose) {
    objectCache.set(sha, loose);
    return loose;
  }
  for (const pack of packs) {
    const offset = pack.map.get(sha);
    if (offset !== undefined) {
      const obj = readObjectAtOffset(pack, offset);
      objectCache.set(sha, obj.dataWithHeader);
      return obj.dataWithHeader;
    }
  }
  throw new Error('Missing object '+sha);
}
function readObjectAtOffset(pack, offset) {
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
    const baseObj = readObjectAtOffset(pack, baseOffset);
    const delta = zlib.inflateSync(buf.subarray(pos));
    const result = applyDelta(baseObj.data, delta);
    return wrapDelta(baseObj.type, result);
  } else if (type === 7) {
    const baseSha = buf.subarray(pos, pos+20).toString('hex');
    pos += 20;
    const base = parseObject(getObjectData(baseSha));
    const delta = zlib.inflateSync(buf.subarray(pos));
    const result = applyDelta(base.body, delta);
    return wrapDelta(base.type, result);
  } else {
    const inflated = zlib.inflateSync(buf.subarray(pos));
    const typeName = ['','commit','tree','blob','tag','','ofs-delta','ref-delta'][type];
    const header = Buffer.from(typeName + ' ' + inflated.length + '\0');
    return {type:typeName, data:inflated, dataWithHeader: Buffer.concat([header, inflated])};
  }
}
function wrapDelta(type, data) {
  const header = Buffer.from(type + ' ' + data.length + '\0');
  return {type, data, dataWithHeader: Buffer.concat([header, data])};
}
function parseObject(buffer) {
  const nul = buffer.indexOf(0);
  const header = buffer.subarray(0, nul).toString();
  const body = buffer.subarray(nul+1);
  const type = header.split(' ')[0];
  return {type, body};
}
function applyDelta(base, delta) {
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
  const baseSize = readVar();
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
const headObj = parseObject(getObjectData(headHash));
const firstLine = headObj.body.toString().split('\n')[0];
const treeHash = firstLine.split(' ')[1];
const entries = new Map();
function walkTree(sha, prefix='') {
  const tree = parseObject(getObjectData(sha));
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
    if (mode.startsWith('04')) walkTree(childSha, prefix + name + '/');
    else entries.set(prefix + name, childSha);
  }
}
walkTree(treeHash);
const diffs = [];
for (const [file, sha] of entries) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    diffs.push({file, type:'deleted'});
    continue;
  }
    const stat = fs.lstatSync(filePath);
  if (!stat.isFile()) { diffs.push({file, type:"type-change"}); continue; }
  const current = fs.readFileSync(filePath);
  const blob = parseObject(getObjectData(sha)).body;
  if (!blob.equals(current)) diffs.push({file, type:'modified'});
}
function gatherFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const items = fs.readdirSync(cur, {withFileTypes:true});
    for (const entry of items) {
      if (entry.name === '.git') continue;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(path.relative(root, full));
    }
  }
  return out;
}
const tracked = new Set(entries.keys());
const allFiles = gatherFiles(root);
const untracked = allFiles.filter(f => !tracked.has(f));
console.log('modified', diffs.length);
console.log('untracked', untracked.length);
console.log('modified files', diffs);
console.log('untracked sample', untracked.slice(0,20));
