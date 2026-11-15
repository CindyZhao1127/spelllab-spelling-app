#!/usr/bin/env node
/* Verify generated packs with the REAL import functions from SpellLab.html.

It extracts validateQuestion / tokenize / normalizeImportedPack / parsePackJSON
from the app source and runs them in a small vm sandbox, then checks that every
pack, unit, sentence, hint and word survives the import unchanged.

    node textbooks/verify.cjs
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const html = fs.readFileSync(path.join(root, '..', 'SpellLab.html'), 'utf8');
const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('SpellLab.html: <script> block not found');
const src = scriptMatch[1];

function fn(name) {
  const hit = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!hit) throw new Error('function not found in SpellLab.html: ' + name);
  const start = src.indexOf('{', hit.index);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(hit.index, i + 1);
  }
  throw new Error('unbalanced braces in function: ' + name);
}
function decl(re, label) {
  const hit = re.exec(src);
  if (!hit) throw new Error('declaration not found: ' + label);
  return hit[0];
}

const pieces = [
  decl(/const PUNCT_CN\s*=\s*\{[^}]*\};/, 'PUNCT_CN'),
  decl(/const DEFAULT_GRADES\s*=\s*\[[\s\S]*?\];/, 'DEFAULT_GRADES'),
  decl(/const DEFAULT_BOOKS\s*=\s*\[[\s\S]*?\];/, 'DEFAULT_BOOKS'),
  decl(/const clone\s*=\s*[^;]+;/, 'clone'),
  fn('gradeName'), fn('bookName'), fn('nextId'), fn('today'),
  fn('tokenize'), fn('validateQuestion'), fn('normalizeImportedPack'), fn('parsePackJSON'),
];

const sandbox = {
  console, JSON, Math, Date, RegExp, String, Number, Boolean, Array, Object,
  Set, Map, parseInt, parseFloat, isNaN, state: null,
};
vm.createContext(sandbox);
vm.runInContext(
  pieces.join('\n') +
    '\nstate = { grades: DEFAULT_GRADES, books: DEFAULT_BOOKS, seq: 1 };' +
    '\nglobalThis.API = { parsePackJSON, validateQuestion, tokenize };',
  sandbox
);
const api = sandbox.API;

const files = [
  path.join(root, 'pep-sanqi-2024.json'),
  ...fs.readdirSync(path.join(root, 'packs'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(root, 'packs', f)),
];

let errors = 0;
const check = (ok, msg) => { if (!ok) { errors++; console.log('  FAIL ' + msg); } };

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  check(data.format === 'spelllab.textbook.v1', `${file}: format`);
  const result = api.parsePackJSON(JSON.stringify(data));
  check(!result.error, `${file}: parsePackJSON error = ${result.error}`);
  check(result.packs.length === data.packs.length,
    `${file}: pack count ${result.packs.length} != ${data.packs.length}`);

  let units = 0, sentences = 0, words = 0, hints = 0;
  for (let i = 0; i < data.packs.length; i++) {
    const want = data.packs[i], got = result.packs[i];
    if (!got) { errors++; continue; }
    check(got.name === want.name, `${file}: pack name ${i}`);
    check(got.gradeId === want.gradeId, `${file}: gradeId ${i} -> ${got.gradeId}`);
    check(got.bookId === want.bookId, `${file}: bookId ${i} -> ${got.bookId}`);
    check(got.units.length === want.units.length, `${file}: unit count in ${want.name}`);
    for (let j = 0; j < Math.min(got.units.length, want.units.length); j++) {
      const wu = want.units[j], gu = got.units[j];
      check(gu.name === wu.name, `${file}: unit name ${want.name}/${wu.name}`);
      check(gu.sentences.length === wu.sentences.length,
        `${file}: sentence count in ${want.name}/${wu.name} (${gu.sentences.length} vs ${wu.sentences.length})`);
      check(gu.words.length === wu.words.length,
        `${file}: word count in ${want.name}/${wu.name} (${gu.words.length} vs ${wu.words.length})`);
      for (let k = 0; k < Math.min(gu.sentences.length, wu.sentences.length); k++) {
        check(gu.sentences[k].en === wu.sentences[k].en, `${file}: en ${want.name}/${wu.name} #${k}`);
        check(gu.sentences[k].cn === wu.sentences[k].cn, `${file}: cn ${want.name}/${wu.name} #${k}`);
        check(gu.sentences[k].hints.length === wu.sentences[k].hints.length,
          `${file}: hints ${want.name}/${wu.name} #${k}`);
        hints += gu.sentences[k].hints.length;
      }
      units++;
      sentences += gu.sentences.length;
      words += gu.words.length;
    }
  }
  console.log(`${path.basename(file).padEnd(24)} packs=${data.packs.length} units=${units} sentences=${sentences} words=${words} hints=${hints}`);
}

console.log(errors ? `\nFAILED: ${errors} check(s)` : '\nOK: all packs import cleanly through the real app functions.');
process.exit(errors ? 1 : 0);
