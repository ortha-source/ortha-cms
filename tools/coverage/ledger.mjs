#!/usr/bin/env node
/**
 * Invariant **coverage ledger** — the traceability layer between the package
 * dossiers in `docs/artifacts/` and the tests that actually pin them down.
 *
 * Each dossier ends with a numbered list of invariants ("statements that must
 * always hold ... at once a review list and a draft set of test assertions").
 * There are 816 of them across 26 dossiers, and until this ledger existed not
 * one was referenced from a spec: nothing said which invariants were tested,
 * so "is this package covered?" could only be answered by re-reading both
 * sides. That question gets asked once per sweep, so it needed a cheap answer.
 *
 * ## The rule that keeps this honest: code is the source of truth
 *
 * `covered` is never written down — it is *derived*, by grepping the test tree
 * for a citation. A spec claims an invariant by naming it:
 *
 *     it('is inert until an audience exists [segments:I-01]', ...)
 *     // covers: segments:I-02, segments:I-03
 *
 * Add such a test and the row flips to covered on the next `check`; delete the
 * test and it flips back. No JSON to keep in sync, so the ledger cannot drift
 * from the suite the way a hand-maintained checklist would.
 *
 * The citation is package-qualified (`segments:I-01`, not `I-01`) because every
 * dossier numbers its own invariants from I-01 — a bare id is ambiguous across
 * 26 files.
 *
 * ## What is written down: only the judgments a grep cannot make
 *
 * Some invariants no test can reach — architectural statements like "the
 * dictionary is unreachable by any token" — and some have simply drifted from
 * the code. Those two verdicts are human (or agent) calls, so they live in
 * `judgments.json`, each with a reason. Everything not cited and not judged is
 * `uncovered`, which is the work list.
 *
 * Splitting generated from authored is deliberate: `invariants.json` is
 * rewritten wholesale on every `build` and must never be hand-edited, while the
 * judgments are only ever appended to by hand. One file owning both would put a
 * day of judgments one regeneration away from being lost.
 *
 * Judgments live one file per package (`docs/coverage/judgments/<pkg>.json`)
 * rather than in a single map, because they are written by a fan-out of agents
 * working a package each: a shared file would have them clobbering one another's
 * writes, and a merge conflict per package is no conflict at all.
 *
 * A package file also carries `externalCitations` — invariants pinned by a spec
 * that lives *outside* that package's own directories. Its author records the
 * intent instead of editing a file another agent may hold open, and `apply`
 * inserts them afterwards, serially.
 *
 * ## Usage
 *
 *   node tools/coverage/ledger.mjs build          rebuild invariants.json from the dossiers
 *   node tools/coverage/ledger.mjs check          report coverage (add --strict to fail on gaps)
 *   node tools/coverage/ledger.mjs check --json   the same, machine-readable
 *   node tools/coverage/ledger.mjs gaps <pkg>     the uncovered rows of one package, with text
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const DOSSIERS = join(ROOT, 'docs/artifacts');
const OUT_DIR = join(ROOT, 'docs/coverage');
const INVARIANTS = join(OUT_DIR, 'invariants.json');
const JUDGMENTS = join(OUT_DIR, 'judgments');

/** The four states a row can be in. Only the last two are ever authored. */
const STATES = ['covered', 'uncovered', 'not-mechanically-checkable', 'stale'];

/* ------------------------------------------------------------------ parsing */

const stripTags = (s) =>
    s
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Pull the invariants out of one dossier. The markup is uniform across all 26
 * (verified): a `<section id="invariants">` of
 * `<li><span class="id">I-NN</span><span>statement</span></li>`.
 */
function parseDossier(file) {
    const html = readFileSync(file, 'utf8');
    const section = /<section id="invariants">([\s\S]*?)<\/section>/.exec(html);
    if (!section) return null;
    const body = section[1];

    // Split on the id span rather than matching a whole <li>: three dossiers
    // (mcp, query-builder, utils) wrap the statement in <div> where the rest use
    // <span>, and a shape-specific regex silently dropped all 77 of their rows.
    const rows = [];
    const marks = [...body.matchAll(/<span class="id">(I-\d+)<\/span>/g)];
    marks.forEach((m, k) => {
        const from = m.index + m[0].length;
        const to = k + 1 < marks.length ? marks[k + 1].index : body.length;
        const chunk = body.slice(from, to).replace(/<\/li>[\s\S]*$/, '');
        rows.push({ id: m[1], text: stripTags(chunk) });
    });

    // Loud, not silent: the count of id marks is the ground truth for how many
    // invariants this dossier has, so any future markup drift fails the build
    // instead of quietly shrinking the ledger.
    if (rows.length !== marks.length) throw new Error(`${file}: parsed ${rows.length} of ${marks.length} invariants`);
    const empty = rows.filter((r) => !r.text);
    if (empty.length) throw new Error(`${file}: empty text for ${empty.map((r) => r.id).join(', ')}`);
    return rows;
}

/** Section 14 of each dossier — the named groups of the testing checklist. */
function parseChecklist(file) {
    const html = readFileSync(file, 'utf8');
    const idx = html.indexOf('Testing checklist');
    if (idx < 0) return [];
    const tail = html.slice(idx, html.indexOf('<section', idx + 1) + 1 || undefined);
    return [...tail.matchAll(/<h[34][^>]*>([\s\S]*?)<\/h[34]>/g)].map((m) => stripTags(m[1])).filter(Boolean);
}

/* ------------------------------------------------------------------- layout */

const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()) : []);

/**
 * Which harnesses *could* pin an invariant of this package down. This is a
 * candidate set, not an assignment: a dossier covers a whole package group, so
 * narrowing a given invariant to one axis is a judgment made per row.
 */
function axesFor(pkg) {
    const parts = dirs(join(ROOT, 'packages', pkg));
    const axes = new Set(['unit']);
    if (parts.includes('server') || parts.includes('graphql')) axes.add('server-e2e');
    if (parts.includes('admin')) axes.add('admin-e2e');
    // Flat packages (cli, nx, database, design-system, create-ortha-app) have no
    // subdirectories; where an e2e suite already exists for them, say so.
    if (existsSync(join(ROOT, 'apps/server-e2e/src/server', pkg))) axes.add('server-e2e');
    if (existsSync(join(ROOT, 'apps/admin-e2e/src', pkg))) axes.add('admin-e2e');
    return [...axes].sort();
}

/* -------------------------------------------------------------- spec citations */

function specFiles() {
    const out = [];
    const walk = (dir) => {
        if (!existsSync(dir)) return;
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
            const p = join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.spec\.tsx?$/.test(e.name)) out.push(p);
        }
    };
    walk(join(ROOT, 'apps'));
    walk(join(ROOT, 'packages'));
    return out;
}

const axisOfSpec = (p) =>
    p.includes('/apps/server-e2e/') ? 'server-e2e' : p.includes('/apps/admin-e2e/') ? 'admin-e2e' : 'unit';

/** Grep every spec for `<package>:I-NN` citations. */
function citations() {
    const found = new Map(); // id -> [{file, axis}]
    for (const file of specFiles()) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/\b([a-z][a-z0-9-]*):(I-\d+)\b/g)) {
            const id = `${m[1]}:${m[2]}`;
            if (!found.has(id)) found.set(id, []);
            const rel = relative(ROOT, file);
            if (!found.get(id).some((c) => c.file === rel)) found.get(id).push({ file: rel, axis: axisOfSpec(file) });
        }
    }
    return found;
}

/* -------------------------------------------------------------- the commands */

function build() {
    const rows = [];
    const files = readdirSync(DOSSIERS)
        .filter((f) => f.endsWith('.html'))
        .sort();
    const checklists = {};
    for (const f of files) {
        const pkg = f.replace(/\.html$/, '');
        const parsed = parseDossier(join(DOSSIERS, f));
        if (!parsed) {
            console.error(`!! ${pkg}: no <section id="invariants"> — skipped`);
            continue;
        }
        checklists[pkg] = parseChecklist(join(DOSSIERS, f));
        const axes = axesFor(pkg);
        for (const inv of parsed) rows.push({ id: `${pkg}:${inv.id}`, package: pkg, axes, text: inv.text });
    }
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
        INVARIANTS,
        JSON.stringify(
            {
                $generated: 'tools/coverage/ledger.mjs build — do not hand-edit; author judgments.json instead',
                source: 'docs/artifacts/*.html §13 Invariants',
                count: rows.length,
                checklists,
                rows
            },
            null,
            4
        ) + '\n'
    );
    mkdirSync(JUDGMENTS, { recursive: true });
    console.log(`built ${rows.length} invariants from ${files.length} dossiers → ${relative(ROOT, INVARIANTS)}`);
}

/** Merge every per-package judgment file into one id -> verdict map. */
function loadJudgments() {
    const merged = {};
    if (!existsSync(JUDGMENTS)) return merged;
    for (const f of readdirSync(JUDGMENTS).filter((f) => f.endsWith('.json')).sort()) {
        const doc = JSON.parse(readFileSync(join(JUDGMENTS, f), 'utf8'));
        for (const [id, v] of Object.entries(doc.judgments ?? {})) {
            if (!STATES.includes(v.state)) throw new Error(`${f}: ${id} has unknown state ${v.state}`);
            if (!v.reason) throw new Error(`${f}: ${id} has no reason`);
            merged[id] = v;
        }
    }
    return merged;
}

function load() {
    if (!existsSync(INVARIANTS)) {
        console.error('no invariants.json — run `build` first');
        process.exit(2);
    }
    const inv = JSON.parse(readFileSync(INVARIANTS, 'utf8'));
    const jud = loadJudgments();
    const cited = citations();
    for (const r of inv.rows) {
        const c = cited.get(r.id);
        const j = jud[r.id];
        r.specs = c ?? [];
        r.state = c ? 'covered' : j ? j.state : 'uncovered';
        r.reason = j?.reason ?? '';
        // A judged-unreachable invariant that later grew a test is not an error,
        // but it is worth surfacing: the judgment is now wrong.
        r.conflict = Boolean(c && j);
    }
    return inv;
}

function check(args) {
    const inv = load();
    if (args.includes('--json')) {
        console.log(JSON.stringify(inv, null, 4));
        return;
    }
    const byPkg = new Map();
    for (const r of inv.rows) {
        if (!byPkg.has(r.package)) byPkg.set(r.package, []);
        byPkg.get(r.package).push(r);
    }
    const tally = (rs, s) => rs.filter((r) => r.state === s).length;
    const pad = (s, n) => String(s).padEnd(n);
    console.log(`${pad('package', 20)} ${pad('inv', 5)} ${pad('cov', 5)} ${pad('uncov', 6)} ${pad('n/a', 5)} ${pad('stale', 6)} axes`);
    console.log('-'.repeat(78));
    let cov = 0;
    for (const [pkg, rs] of [...byPkg].sort((a, b) => b[1].length - a[1].length)) {
        const c = tally(rs, 'covered');
        cov += c;
        console.log(
            `${pad(pkg, 20)} ${pad(rs.length, 5)} ${pad(c, 5)} ${pad(tally(rs, 'uncovered'), 6)} ` +
                `${pad(tally(rs, 'not-mechanically-checkable'), 5)} ${pad(tally(rs, 'stale'), 6)} ${rs[0].axes.join(',')}`
        );
    }
    console.log('-'.repeat(78));
    const total = inv.rows.length;
    console.log(`${pad('TOTAL', 20)} ${pad(total, 5)} ${pad(cov, 5)} ${pad(total - cov, 6)}   (${((cov / total) * 100).toFixed(1)}% cited)`);
    const conflicts = inv.rows.filter((r) => r.conflict);
    if (conflicts.length) {
        console.log(`\n!! ${conflicts.length} judged-but-now-cited (stale judgments): ${conflicts.map((r) => r.id).join(', ')}`);
    }
    if (args.includes('--strict') && cov < total) process.exit(1);
}

function gaps(pkg) {
    const inv = load();
    const rows = inv.rows.filter((r) => r.package === pkg && r.state === 'uncovered');
    if (!rows.length) return console.log(`${pkg}: no uncovered invariants`);
    console.log(`${pkg}: ${rows.length} uncovered — candidate axes ${rows[0].axes.join(', ')}\n`);
    for (const r of rows) console.log(`  ${r.id}  ${r.text}\n`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'build') build();
else if (cmd === 'check') check(args);
else if (cmd === 'gaps') gaps(args[0]);
else {
    console.error('usage: ledger.mjs build | check [--json] [--strict] | gaps <package>');
    process.exit(2);
}
