# `@orthacms/segments-domain`

The **segmentation kernel** — who may read a piece of content, decided by a pure
function. No NestJS, no Drizzle, no React: the server package holds everything
that touches a database or a request, and the admin will import the same
vocabulary so its editor describes exactly what the server enforces.

This is the reader-facing half of access. It is **not** RBAC and not workspace
content grants — those answer "who may _touch_ this content" and already exist
(`workspace_content`, `PermissionsGuard`, identity's own `AccessPolicy`, whose
name is why nothing here is called a policy). Segmentation answers "who may
_see_ the published result", and the two models are kept apart on purpose: they
have different subjects, different lifecycles and different blast radius.

| File                       | What lives there                                          |
| -------------------------- | --------------------------------------------------------- |
| `segment-type.ts`          | A type — one axis of the decision, and one tag namespace. |
| `segment.ts`               | A named set of tags, plus tag → segment resolution.       |
| `access-rule.ts`           | Exclusions, condition groups, modes, fallback, levels.    |
| `evaluate.ts`              | The decision. One function, no I/O.                       |
| `inheritance.ts`           | The level chain collapsed into one resolved rule.         |
| `segment-resolver.port.ts` | Where a reader's tags come from.                          |
| `limits.ts`                | The ceilings — groups per rule, types per installation.   |

## The rules that matter here

**Tags are the atom, segments are the indirection, and rules point at
segments.** A reader carries `org:acme`; a segment named "Acme Corp" matches it;
a rule names the segment. Renaming a plan in the billing system, or giving an
organisation a second identifier, then edits one segment's `tags` and leaves
every rule, every grant and every projected row untouched. Nothing outside
`segment.ts` should ever compare a raw tag.

**A mask exists so exclusions never become complements.** `AnyOrg` matches any
tag in the `org` namespace, which is what makes "every organisation except these
three" a deny of three. Written the other way — an allow of the other 397 — the
projection would have to be rewritten for every entry each time an organisation
is onboarded. That is the single most expensive mistake available in this
design, and the mask is the thing that prevents it.

**The decision order is fixed: exclusions, then the window, then the groups.**
Not interchangeable. A denied reader stays denied however good their plan is, and
an embargoed entry is invisible to everyone, so evaluating groups first would
only produce a match nobody may act on.

**Disjunctive normal form, and nothing else.** Groups are OR-ed, the segment
types inside a group are AND-ed, there is no nesting, and the only negation is
the rule-level exclusion. `(Acme) OR (EU AND Pro)` is expressible; an arbitrary
boolean expression is not, and deliberately so — the moment it is, "why can this
reader see this?" stops being a flat list and becomes a proof tree, which is
what the admin's explain panel would then have to render.

**An empty rule is open, an empty `only` is closed.** A rule with no groups
restricts nothing: that is what every entry starts life with, and reading it as
a closed door would black out an installation the moment the plugin is enabled.
An `only` naming no segments admits nobody: that is what a rule reads like after
its last segment is removed, and quietly widening it would open content instead
of closing it. The two look symmetrical and are not.

**Authored and resolved conditions are different types.** `AuthoredCondition`
may say `inherit`; `ResolvedCondition` cannot, and `evaluate` takes only the
latter. "Did anyone forget to run inheritance?" is therefore a compile error
rather than a silently permissive runtime decision.

**Inheritance merges, and exclusions survive a detach.** A lower level adds its
groups to what it inherited; replacing by default would silently lose a type's
restriction the first time someone edited one entry. `detachInherited` makes
replacement possible but explicit — and even then the exclusions accumulated
above are kept, because "this reader never sees our content" is not a guarantee
one entry may shrug off.

**The resolver fails closed.** An adapter that cannot reach its source returns
an empty tag set rather than throwing or guessing. An empty set still reads
everything unrestricted, so an outage degrades to "public content only" instead
of to an outage of its own.

## Commands

- `npx nx test @orthacms/segments-domain` — the decision table lives here.
- `npx nx typecheck @orthacms/segments-domain` / `npx nx lint @orthacms/segments-domain`
