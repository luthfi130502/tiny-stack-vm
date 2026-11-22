// Tiny stack VM (ISA v1), Node 22, stdlib only, no clock.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
function run(p, inp) {
  const s = new Int32Array(257);
  const c = new Int32Array(64);
  const m = new Int32Array(256);
  const o = Buffer.alloc(65536);
  let sp = 0, cp = 0, pc = 0, ip = 0, steps = 0, ol = 0, code = 0, done = false;
  while (!done) {
    if (steps >= 1000000) { code = 10; break; }
    if (pc < 0 || pc >= p.length) { code = 9; break; }
    const op = p[pc];
    const ok = op <= 7 || (op >= 16 && op <= 30) || (op >= 32 && op <= 34) ||
      (op >= 48 && op <= 52) || (op >= 64 && op <= 65) || (op >= 80 && op <= 83);
    if (!ok) { code = 5; break; }
    const n = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + n >= p.length) { code = 9; break; }
    steps++;
    let a, b, t;
    if (op >= 16 && op <= 34 && op !== 23 && op !== 27) {
      if (sp < 2) { code = 2; done = true; }
      else { b = s[--sp]; a = s[--sp]; }
    }
    if (!done) switch (op) {
      case 0: code = 0; done = true; break;
      case 1:
        if (sp >= 256) { code = 3; done = true; break; }
        s[sp++] = p[pc + 1] << 24 >> 24; pc += 2; break;
      case 2:
        if (sp >= 256) { code = 3; done = true; break; }
        s[sp++] = p[pc + 1] | p[pc + 2] << 8 | p[pc + 3] << 16 | p[pc + 4] << 24;
        pc += 5; break;
      case 3:
        if (sp < 1) { code = 2; done = true; break; }
        sp--; pc++; break;
      case 4:
        if (sp < 1) { code = 2; done = true; break; }
        if (sp >= 256) { code = 3; done = true; break; }
        s[sp] = s[sp - 1]; sp++; pc++; break;
      case 5:
        if (sp < 2) { code = 2; done = true; break; }
        t = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = t; pc++; break;
      case 6:
        if (sp < 2) { code = 2; done = true; break; }
        if (sp >= 256) { code = 3; done = true; break; }
        s[sp] = s[sp - 2]; sp++; pc++; break;
      case 7:
        if (sp < 3) { code = 2; done = true; break; }
        t = s[sp - 3]; s[sp - 3] = s[sp - 2]; s[sp - 2] = s[sp - 1]; s[sp - 1] = t;
        pc++; break;
      case 16: s[sp++] = a + b; pc++; break;
      case 17: s[sp++] = a - b; pc++; break;
      case 18: s[sp++] = Math.imul(a, b); pc++; break;
      case 19:
        if (b === 0) { code = 4; done = true; break; }
        s[sp++] = Math.trunc(a / b); pc++; break;
      case 20:
        if (b === 0) { code = 4; done = true; break; }
        s[sp++] = a % b; pc++; break;
      case 21:
        if (b === 0) { code = 4; done = true; break; }
        s[sp++] = Math.trunc((a >>> 0) / (b >>> 0)); pc++; break;
      case 22:
        if (b === 0) { code = 4; done = true; break; }
        s[sp++] = (a >>> 0) % (b >>> 0); pc++; break;
      case 23:
        if (sp < 1) { code = 2; done = true; break; }
        s[sp - 1] = -s[sp - 1]; pc++; break;
      case 24: s[sp++] = a & b; pc++; break;
      case 25: s[sp++] = a | b; pc++; break;
      case 26: s[sp++] = a ^ b; pc++; break;
      case 27:
        if (sp < 1) { code = 2; done = true; break; }
        s[sp - 1] = ~s[sp - 1]; pc++; break;
      case 28: s[sp++] = a << (b & 31); pc++; break;
      case 29: s[sp++] = a >> (b & 31); pc++; break;
      case 30: s[sp++] = a >>> (b & 31); pc++; break;
      case 32: s[sp++] = a === b ? 1 : 0; pc++; break;
      case 33: s[sp++] = a < b ? 1 : 0; pc++; break;
      case 34: s[sp++] = (a >>> 0) < (b >>> 0) ? 1 : 0; pc++; break;
      case 48:
        t = p[pc + 1] | p[pc + 2] << 8; if (t & 32768) t -= 65536;
        pc += 3 + t; break;
      case 49:
        if (sp < 1) { code = 2; done = true; break; }
        a = s[--sp]; t = p[pc + 1] | p[pc + 2] << 8; if (t & 32768) t -= 65536;
        pc = a === 0 ? pc + 3 + t : pc + 3; break;
      case 50:
        if (sp < 1) { code = 2; done = true; break; }
        a = s[--sp]; t = p[pc + 1] | p[pc + 2] << 8; if (t & 32768) t -= 65536;
        pc = a !== 0 ? pc + 3 + t : pc + 3; break;
      case 51:
        if (cp >= 64) { code = 7; done = true; break; }
        c[cp++] = pc + 3; pc = p[pc + 1] | p[pc + 2] << 8; break;
      case 52:
        if (cp === 0) { code = 8; done = true; break; }
        pc = c[--cp]; break;
      case 64:
        if (sp < 1) { code = 2; done = true; break; }
        a = s[--sp]; if (a < 0 || a > 255) { code = 6; done = true; break; }
        s[sp++] = m[a]; pc++; break;
      case 65:
        if (sp < 2) { code = 2; done = true; break; }
        a = s[--sp]; b = s[--sp];
        if (a < 0 || a > 255) { code = 6; done = true; break; }
        m[a] = b; pc++; break;
      case 80:
        if (sp < 1) { code = 2; done = true; break; }
        a = s[--sp]; t = String(a);
        if (ol + t.length > 65536) { code = 11; done = true; break; }
        ol += o.write(t, ol, 'ascii'); pc++; break;
      case 81:
        if (sp < 1) { code = 2; done = true; break; }
        if (ol >= 65536) { code = 11; done = true; break; }
        o[ol++] = s[--sp] & 255; pc++; break;
      case 82:
        if (sp >= 256) { code = 3; done = true; break; }
        s[sp++] = ip < inp.length ? inp[ip++] : -1; pc++; break;
      case 83:
        if (sp < 1) { code = 2; done = true; break; }
        code = s[--sp] & 255; done = true; break;
      default: code = 5; done = true; break;
    }
  }
  return { out: o.subarray(0, ol), code };
}
for (const id of readdirSync(IN).sort()) {
  let p = Buffer.alloc(0), inp = Buffer.alloc(0);
  try { p = readFileSync(join(IN, id, 'program.bin')); } catch {}
  try { inp = readFileSync(join(IN, id, 'input.bin')); } catch {}
  const r = run(p, inp);
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), r.out);
  writeFileSync(join(OUT, id, 'exit.txt'), r.code + '\n');
}
