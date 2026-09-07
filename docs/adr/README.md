# Architecture Decision Records

An **ADR** captures a single significant architectural decision: the context, the
decision, and its consequences. It records _why_, so future readers (humans and
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
   accepted ADR's history: to change a decision, add a _new_ ADR and mark the
   old one `Superseded by NNNN`.

## Index

- [0001 — Record architecture decisions](0001-record-architecture-decisions.md)
- [0002 — Plugin-based architecture](0002-plugin-based-architecture.md)
- [0003 — Tactical DDD inside plugins](0003-tactical-ddd-inside-plugins.md)
- [0004 — Model-agnostic copilot provider](0004-model-agnostic-copilot-provider.md)
- [0005 — The copilot acts as its user, never as itself](0005-copilot-authority-model.md)
- [0006 — The CMS is an MCP server, over one shared tool registry](0006-cms-as-an-mcp-server.md)
- [0007 — One tool registry, two surfaces](0007-one-tool-registry-two-surfaces.md)
- [0008 — GraphQL is a protocol adapter over the public content API](0008-graphql-as-a-protocol-adapter.md)
- [0009 — The copilot asks in the moment, then applies directly](0009-copilot-applies-directly.md)
- [0010 — Skills are prompt configuration, authored in two places and delivered in one](0010-copilot-skills.md)
- [0011 — Rich text is a structured document, not an opaque string](0011-richtext-as-a-structured-document.md)
- [0012 — One storage provider per deployment, passed as one object](0012-one-storage-provider-per-deployment.md)
- [0013 — SSO is a provider port, and the core owns the handshake](0013-sso-provider-port.md)
- [0014 — Export and import as a separate plugin, one hop deep](0014-transfer-as-a-separate-plugin.md)
- [0015 — Alarms flag content, and never block a write](0015-alarms-are-non-blocking.md)
- [0016 — Webhooks deliver from a queue, never from the outbox subscriber](0016-webhooks-deliver-from-a-queue.md)
- [0017 — Publication is protected per content type, and an approval belongs to a revision](0017-publication-protection.md)
- [0018 — One mail provider per deployment, and the message is built where the secret is](0018-mail-provider.md)

<!-- Add new ADRs to this index. -->
