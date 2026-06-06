// Generates apps/admin-e2e/TESTS.md from the test.describe/test tree of every
// spec.
//
// AST-based (TypeScript compiler) — it never *runs* Playwright, so it needs no
// browser/dev server and is safe in CI. Run `--check` to fail when the committed
// catalog has drifted from the specs.
//
//   node tools/generate-test-catalog.mjs           # write TESTS.md
//   node tools/generate-test-catalog.mjs --check    # exit 1 if stale
//
// Invoked via `npx nx catalog admin-e2e` / `npx nx catalog:check admin-e2e`.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, '..'); // apps/admin-e2e
const REPO_ROOT = join(PROJECT_ROOT, '..', '..');
const SPEC_DIR = join(PROJECT_ROOT, 'src');
const OUT_FILE = join(PROJECT_ROOT, 'TESTS.md');

/** Recursively collect every *.spec.ts under a directory. */
function findSpecs(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...findSpecs(full));
        else if (entry.endsWith('.spec.ts')) out.push(full);
    }
    return out.sort();
}

// Playwright `test` hooks/config that are NOT describe/it leaves.
const HOOKS = new Set([
    'beforeEach',
    'afterEach',
    'beforeAll',
    'afterAll',
    'use',
    'step',
    'slow',
    'setTimeout'
]);

/**
 * Classify a Playwright callee into a describe/it node. Handles the namespaced
 * forms: `test.describe`, `test.describe.only/skip/fixme`, `test`,
 * `test.only/skip/fixme`, plus `.each(...)`. Returns null for hooks
 * (`test.beforeEach`), `test.use`, and `test.describe.configure`.
 */
function classifyCallee(expr) {
    // it.each([...])('title', fn) / test.describe.fixme(...) → unwrap calls
    if (ts.isCallExpression(expr)) return classifyCallee(expr.expression);

    // Flatten the property chain into segments, e.g. test.describe.only.
    const parts = [];
    let cur = expr;
    while (ts.isPropertyAccessExpression(cur)) {
        parts.unshift(cur.name.text);
        cur = cur.expression;
    }
    if (ts.isIdentifier(cur)) parts.unshift(cur.text);
    else return null;

    if (parts[0] !== 'test') return null;
    const rest = parts.slice(1);

    let kind;
    let modifier = null;
    if (rest[0] === 'describe') {
        if (rest[1] === 'configure') return null;
        kind = 'describe';
        modifier = rest[1] ?? null;
    } else {
        if (rest[0] && HOOKS.has(rest[0])) return null;
        kind = 'it';
        modifier = rest[0] ?? null;
    }

    // Only only/skip/fixme are display modifiers; serial/parallel/etc. aren't.
    if (modifier === 'fixme') modifier = 'skip';
    if (modifier !== 'only' && modifier !== 'skip') modifier = null;
    return { kind, modifier };
}

/** Best-effort title text from the first call argument. */
function titleOf(arg) {
    if (!arg) return '(untitled)';
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))
        return arg.text;
    if (ts.isTemplateExpression(arg)) {
        let out = arg.head.text;
        for (const span of arg.templateSpans) out += '${…}' + span.literal.text;
        return out;
    }
    return '(dynamic title)';
}

/** Walk a describe/it call, returning a node {kind, title, modifier, children}. */
function nodeFromCall(call, info) {
    const node = {
        kind: info.kind,
        modifier: info.modifier,
        title: titleOf(call.arguments[0]),
        children: []
    };
    if (info.kind === 'describe') {
        const body = call.arguments.find(
            (a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)
        );
        if (body && body.body && ts.isBlock(body.body))
            node.children = collectCalls(body.body);
    }
    return node;
}

/** Find direct describe/it calls inside a block (statement-level only). */
function collectCalls(block) {
    const found = [];
    const visit = (n) => {
        if (ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)) {
            const info = classifyCallee(n.expression.expression);
            if (info) {
                found.push(nodeFromCall(n.expression, info));
                return; // don't descend; recursion happens via describe body
            }
        }
        ts.forEachChild(n, visit);
    };
    block.statements.forEach(visit);
    return found;
}

function parseSpec(file) {
    const src = ts.createSourceFile(
        file,
        readFileSync(file, 'utf-8'),
        ts.ScriptTarget.Latest,
        true
    );
    return collectCalls(src);
}

// ---- rendering ---------------------------------------------------------------

const tag = (m) =>
    m === 'skip' ? ' _(skipped)_' : m === 'only' ? ' _(only)_' : '';
const cell = (s) => s.replace(/\|/g, '\\|'); // escape pipes for table cells

let TOTAL = 0;

/** Flatten a describe/it subtree into rows: { scenario: string[], title }. */
function flatten(node, scenarioPath, rows) {
    if (node.kind === 'it') {
        TOTAL++;
        rows.push({
            scenario: scenarioPath,
            title: node.title + tag(node.modifier)
        });
        return;
    }
    const next = [...scenarioPath, node.title + tag(node.modifier)];
    for (const child of node.children) flatten(child, next, rows);
}

/** Render one top-level suite (describe): heading, then a Test-case table per
 *  scenario, with the scenario as a subheading. */
function renderSuite(node, lines) {
    const rows = [];
    for (const child of node.children) flatten(child, [], rows);
    if (node.kind === 'it') flatten(node, [], rows);

    lines.push('');
    lines.push(`## ${node.title}${tag(node.modifier)}`);
    if (!rows.length) return;

    const groups = [];
    for (const row of rows) {
        const key = row.scenario.join(' › ');
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.titles.push(row.title);
        else groups.push({ key, titles: [row.title] });
    }

    for (const group of groups) {
        if (group.key) {
            lines.push('');
            lines.push(`### ${group.key}`);
        }
        lines.push('');
        lines.push('| Test case |');
        lines.push('| --- |');
        for (const title of group.titles) lines.push(`| ${cell(title)} |`);
    }
}

function render(specs) {
    const lines = [
        '# Admin E2E test catalog',
        '',
        '> **Generated file — do not edit by hand.** Regenerate with',
        '> `npx nx catalog admin-e2e`. CI runs `npx nx catalog:check admin-e2e`',
        '> and fails if this file has drifted from the specs.',
        ''
    ];
    const bodyStart = lines.length;

    for (const file of specs) {
        const rel = relative(REPO_ROOT, file);
        const tree = parseSpec(file);
        if (!tree.length) continue;
        const fileLines = [];
        for (const node of tree) renderSuite(node, fileLines);
        lines.push(`<!-- source: ${rel} -->`);
        lines.push(`_<sub>${rel}</sub>_`);
        lines.push(...fileLines);
        lines.push('');
    }

    lines.splice(
        bodyStart,
        0,
        `_${TOTAL} test cases across ${specs.length} spec files._`,
        ''
    );
    return (
        lines
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trimEnd() + '\n'
    );
}

// ---- main --------------------------------------------------------------------

const check = process.argv.includes('--check');
const specs = findSpecs(SPEC_DIR);
const next = render(specs);

if (check) {
    let current = '';
    try {
        current = readFileSync(OUT_FILE, 'utf-8');
    } catch {
        /* missing → stale */
    }
    if (current !== next) {
        console.error(
            'TESTS.md is out of date. Run `npx nx catalog admin-e2e` and commit the result.'
        );
        process.exit(1);
    }
    console.log('TESTS.md is up to date.');
} else {
    writeFileSync(OUT_FILE, next);
    console.log(`Wrote ${relative(REPO_ROOT, OUT_FILE)} (${TOTAL} cases).`);
}
