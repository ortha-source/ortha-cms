# 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-06-18
- **Deciders:** Engineering

## Context

The codebase encodes many non-obvious decisions (the plugin-host model,
resolve-from-source, per-plugin migrations, transactional audit). Without a
durable record of *why*, those choices get re-litigated or accidentally undone —
especially now that AI agents contribute changes and have no memory of prior
discussions.

## Decision

We will keep Architecture Decision Records, one Markdown file per decision, under
`docs/adr/`, using Michael Nygard's format. Decisions are immutable once
`Accepted`; a change is a new ADR that supersedes the old one.

## Consequences

- New significant decisions get a lightweight, reviewable paper trail.
- Onboarding (human and agent) has a single place to learn *why*.
- Minor overhead per significant decision; we explicitly do not ADR routine,
  easily-reversed changes.

## Alternatives considered

- **A wiki / external doc tool** — drifts from the code and isn't in the diff;
  rejected in favor of in-repo, version-controlled records.
- **Inline comments only** — too local to capture cross-cutting rationale.
