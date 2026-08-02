# Architecture Decision Records

An **ADR** captures a single significant architectural decision: the context, the
decision, and its consequences. It records *why*, so future readers (humans and
agents) don't re-litigate settled choices or accidentally undo them.

We follow [Michael Nygard's format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## When to write one

Write an ADR when a decision is **hard to reverse** or **shapes how the system is
built**: a new cross-cutting pattern, a datastore/runtime choice, a security
model, an auth boundary, a major dependency, deprecating a pattern. Skip it for
routine, easily-reversed changes.

## How to add one

1. Copy [`_template.md`](_template.md) to `NNNN-short-title.md`, where `NNNN` is
   the next zero-padded number.
2. Fill it in. Keep it short — one decision per record.
3. Set **Status** to `Proposed`, then `Accepted` once agreed. Never rewrite an
   accepted ADR's history: to change a decision, add a *new* ADR and mark the
   old one `Superseded by NNNN`.

## Index

- [0001 — Record architecture decisions](0001-record-architecture-decisions.md)
- [0002 — Plugin-based architecture](0002-plugin-based-architecture.md)
- [0003 — Tactical DDD inside plugins](0003-tactical-ddd-inside-plugins.md)
- [0004 — Model-agnostic copilot provider](0004-model-agnostic-copilot-provider.md)
- [0005 — The copilot acts as its user, never as itself](0005-copilot-authority-model.md)

<!-- Add new ADRs to this index. -->
