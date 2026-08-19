# 0012 — One rate limit per credential, shared by every public protocol

- **Status:** Proposed
- **Date:** 2026-08-19
- **Deciders:** Engineering

> Extends [ADR-0008](0008-graphql-as-a-protocol-adapter.md)'s "one rule, two
> protocols" to the third one, and to a rule ADR-0008 did not have: how much a
> caller may spend. Nothing in ADR-0008 or
> [ADR-0006](0006-cms-as-an-mcp-server.md) is reversed.

## Context

Three front doors serve the public content API, and until now none of them
bounded request **volume**:

| Front door             | Authenticated by                  |
| ---------------------- | --------------------------------- |
| `GET/POST /api/v1/*`   | `ApiTokenGuard`                   |
| `POST /api/v1/graphql` | `ApiTokenGuard` (the same object) |
| `POST /api/v1/mcp`     | `McpAuthService`                  |

All three take the **same bearer tokens**, minted on the same admin page, and
the only throttled route in the product was `/auth/login`. Measured on a live
stack: 300 sequential `POST /api/v1/graphql` with one `read` token returned 300
× 200, and REST behaved identically.

GraphQL's cost budget (`maxDepth` / `maxFields` / `maxComplexity` /
`maxQueryLength`) was doing duty as a rate limit and was never that. It bounds
one document at ~1000 estimated rows; a thousand documents a second are bounded
by nothing. This was the largest remaining amplification surface on an
authenticated public API.

Two questions had to be answered together, because answering them separately is
how the three doors drift: **what is the unit of fairness**, and **do the
protocols share it**.

## Decision

We will meter the public API **per API token**, with **one bucket per
credential shared by all three protocols**.

1. **The credential is the key**, not the workspace and not the client address.
   The token id is already resolved before any handler runs, it survives a
   client changing host, and it is what an operator can act on: a 429 naming a
   token says which integration to slow down, rotate or split.
2. **One bucket, three doors.** A token that spreads its traffic across REST,
   GraphQL and MCP gets one ceiling, not three. Raising the limit raises it for
   the caller, not for whichever protocol they happened to use.
3. **The counter lives in identity** (`ApiTokenRateLimiter`), because identity
   owns the credential — and because the three doors live in three packages
   that all depend on identity and none of which depends on the others. Both
   `ApiTokenGuard` and `McpAuthService` call it immediately after `verify`.
4. **Charged inside the authentication path**, not in a guard of its own. Every
   public route reaches its handler through `ApiTokenGuard`, so a route added
   later cannot forget the limit; and MCP is one route carrying many
   operations, so a Nest guard could never have covered it at all.
5. **Charged before the permission check, and never before authentication.** A
   `read` token looping on write routes costs the same to refuse as legitimate
   work, so it is metered; a request that failed authentication is not, so an
   unauthenticated flood can neither exhaust a real token's budget nor allocate
   a bucket.
6. **300 requests / 60 s by default**, configurable per deployment
   (`PUBLIC_API_RATE_LIMIT`, `PUBLIC_API_RATE_LIMIT_TTL_SECONDS`), and `0`
   disables it for a deployment that limits at its own gateway.

## Consequences

- One number to tune, one place to read it, and one shape of refusal: HTTP 429
  with `Retry-After`, plus `X-RateLimit-Limit` / `-Remaining` / `-Reset` on
  **every** public response, so a client can back off before it is refused.
- On GraphQL the refusal is a real 429, not a 200 carrying an `errors` array —
  it happens in the guard, before a document is parsed. A client that only
  branches on `extensions.status` will not see it, which is the intended
  behaviour: transport-level back-pressure belongs in the status.
- On MCP the refusal is likewise HTTP, not a JSON-RPC error. An agent's retry
  loop must be told to stop by the transport; a JSON-RPC error reads as a
  working connection returning something to reason about.
- The bucket is **in-memory and per instance**, exactly like the login
  throttle: N replicas mean N buckets, and the window is fixed rather than
  sliding (worst case `2 × limit` across a boundary). This is a floor under a
  gateway or edge limit, not a replacement for one. A deployment needing an
  exact global number wants a shared store; the seam for that is
  `ApiTokenRateLimiter`, which is the only stateful piece.
- A busy legitimate integration can now be refused. That is the point, but it
  makes the default a product decision rather than an implementation detail —
  hence one env var, documented in `.env.example`, and a `0` that means
  "unlimited" rather than "block everything".

## Alternatives considered

- **Per workspace.** The alternative unit named in the ticket. Rejected because
  a workspace's traffic is the sum of its tokens: one runaway integration would
  refuse every other caller in the tenant, and revoking or re-issuing the
  offending credential would be no remedy. Per-workspace fairness is a
  reasonable _second_ limit later; it is a bad _only_ limit.
- **Per client address (reuse `@nestjs/throttler`).** Rejected: machine callers
  sit behind NAT and serverless egress pools, so the address is neither stable
  nor discriminating, and it depends on `trust proxy` being configured
  correctly. It is the right key for login, where there is no identity yet, and
  the wrong one here, where there always is.
- **A separate throttle guard per controller.** Rejected: one omission is an
  unmetered surface, and it could not cover MCP.
- **A per-protocol limit.** Rejected: it hands the same credential three
  ceilings, and the operator raising one has no reason to think about the
  other two.
- **Tightening the GraphQL cost budget instead.** Rejected as a category error,
  and explicitly out of scope: the budget is a per-request cost cap. Both
  bounds are needed, and neither substitutes for the other.
