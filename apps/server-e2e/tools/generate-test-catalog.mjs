// Generates apps/server-e2e/TESTS.md from the describe/it tree of every spec.
//
// AST-based (TypeScript compiler) — it never *runs* Jest, so it needs no
// Docker/testcontainer and is safe in CI. Run `--check` to fail when the
// committed catalog has drifted from the specs.
//
//   node tools/generate-test-catalog.mjs           # write TESTS.md
//   node tools/generate-test-catalog.mjs --check    # exit 1 if stale
//
// Invoked via `npx nx catalog server-e2e` / `npx nx catalog:check server-e2e`.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, '..'); // apps/server-e2e
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

/** Peel `.only` / `.skip` / `.each(...)` off a describe/it callee. */
function classifyCallee(expr) {
    // it.each([...])('title', fn) → callee is a CallExpression of it.each
    if (ts.isCallExpression(expr)) return classifyCallee(expr.expression);

    let name;
    let modifier = null;
    if (ts.isIdentifier(expr)) {
        name = expr.text;
    } else if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression)
    ) {
        name = expr.expression.text;
        modifier = expr.name.text; // only | skip | each | todo
    } else {
        return null;
    }

    if (name === 'xdescribe' || name === 'xit') {
        modifier = 'skip';
        name = name.slice(1);
    }
    if (name === 'fdescribe' || name === 'fit') {
        modifier = 'only';
        name = name.slice(1);
    }
    const kind =
        name === 'describe'
            ? 'describe'
            : name === 'it' || name === 'test'
              ? 'it'
              : null;
    if (!kind) return null;
    return { kind, modifier };
}

/** Best-effort title text from the first call argument. */
function titleOf(arg) {
    if (!arg) return '(untitled)';
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))
        return arg.text;
    if (ts.isTemplateExpression(arg)) {
        // Reconstruct `head${expr}tail` with placeholders for the dynamic bits.
        let out = arg.head.text;
        for (const span of arg.templateSpans)
            out += '${…}' + span.literal.text;
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
        children: [],
    };
    if (info.kind === 'describe') {
        const body = call.arguments.find(
            (a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a),
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
        if (
            ts.isExpressionStatement(n) &&
            ts.isCallExpression(n.expression)
        ) {
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
        true,
    );
    return collectCalls(src);
}

// ---- rendering ---------------------------------------------------------------

const tag = (m) => (m === 'skip' ? ' _(skipped)_' : m === 'only' ? ' _(only)_' : '');

let TOTAL = 0;

function renderNode(node, depth, lines) {
    if (node.kind === 'it') {
        TOTAL++;
        // Heading levels express the describe nesting, so bullets stay flush.
        lines.push(`- ${node.title}${tag(node.modifier)}`);
        return;
    }
    // describe → heading (H2 at depth 2, capped at H6, then bold)
    const level = Math.min(depth, 6);
    const hashes = '#'.repeat(level);
    lines.push('');
    if (level <= 6) lines.push(`${hashes} ${node.title}${tag(node.modifier)}`);
    for (const child of node.children) renderNode(child, depth + 1, lines);
}

function render(specs) {
    const lines = [
        '# Server E2E test catalog',
        '',
        '> **Generated file — do not edit by hand.** Regenerate with',
        '> `npx nx catalog server-e2e`. CI runs `npx nx catalog:check server-e2e`',
        '> and fails if this file has drifted from the specs.',
        '',
    ];
    const bodyStart = lines.length;

    for (const file of specs) {
        const rel = relative(REPO_ROOT, file);
        const tree = parseSpec(file);
        if (!tree.length) continue;
        const fileLines = [];
        for (const node of tree) renderNode(node, 2, fileLines);
        lines.push(`<!-- source: ${rel} -->`);
        lines.push(`_<sub>${rel}</sub>_`);
        lines.push(...fileLines);
        lines.push('');
    }

    // Insert the summary now that TOTAL is known.
    lines.splice(
        bodyStart,
        0,
        `_${TOTAL} test cases across ${specs.length} spec files._`,
        '',
    );
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
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
            'TESTS.md is out of date. Run `npx nx catalog server-e2e` and commit the result.',
        );
        process.exit(1);
    }
    console.log('TESTS.md is up to date.');
} else {
    writeFileSync(OUT_FILE, next);
    console.log(`Wrote ${relative(REPO_ROOT, OUT_FILE)} (${TOTAL} cases).`);
}
