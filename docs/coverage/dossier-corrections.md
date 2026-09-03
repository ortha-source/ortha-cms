# Dossier corrections found during coverage triage

Triage reads each dossier against the code that implements it, so it turns up
claims that have drifted. Where an invariant itself is wrong, it is recorded as
`stale` in `judgments/<pkg>.json` and the dossier gets fixed. This file collects
the rest — errors in the surrounding prose, checklists and counts, which the
ledger has no state for but which mislead the next reader just as much.

Nothing here is a code defect. Code defects belong in the gap list.

| Package | Where | What is wrong |
| --- | --- | --- |
| identity | Invariant I-19 | Says the API-token routes are reachable "only with an administrator's session". The gate is the `tokens:read` / `tokens:manage` permissions, not the admin role — `api-tokens-management.spec.ts` → `permission separation` proves a custom role holding `tokens:read` can list them. Reword to name the permissions. |
| identity | Testing checklist | Counts `apps/server-e2e/src/server/auth/*` as "15 files"; there are 22. The admin-e2e count (13) is right. |
| mcp | §13.4 | Asserts concrete tool counts ("13 tools" for `read`, "23 tools" for `full`). The e2e deliberately checks membership rather than counts, so these numbers are pinned by nothing and will drift silently as tools are added. |
| mcp | Section numbering | Invariants render as §12 and the testing checklist as §13, where most dossiers put them at §13/§14. Cosmetic, but it breaks cross-references written against the usual numbering. |
| transfer | Invariant I-04 | Ambiguous: "a depth-1 entry's reference" reads either as references *to* depth-1 records or references *held by* them (pointing at depth 2). Triage cited the stricter second reading. Worth disambiguating in the text. |
| workspaces | Testing checklist | Self-contradictory after the 2026-08-30 pass: still lists "After deletion, check `alarm_rules` and `entry_access` → the rows remain — the known uncovered remainder", which section 15 of the same dossier says was fixed. Also counts the server-e2e suite as "7 files"; there are 8 (`workspace-delete-residue.spec.ts` was added and not listed). |
| **README.md** | Cross-cutting findings | "Only `media` and `api-tokens` implement `WorkspacePurger`" is **no longer true** — `alarms`, `content/revisions` and `segments/entry-access` all ship purgers, and `workspace-delete-residue.spec.ts` asserts the whole cleanup. Fed to a triage agent as context, this claim would have produced a false `stale` verdict. The other cross-cutting findings date from the same pass and need the same re-check before anyone quotes them. |
| alarms | §7 and §14 | State that alarms registers no `WorkspacePurger` and that a deleted workspace's rows "stay orphaned forever", listing it as an open defect. It does register one — `packages/alarms/server/src/lib/infrastructure/purge/alarms-workspace.purger.ts`, with a passing spec beside it — and `workspace-delete-residue.spec.ts:49` lists both alarm tables among those a delete clears. The Invariants section correspondingly lacks any statement about workspace deletion, which is now real, tested behaviour. |
| alarms | Invariant I-20 | The only invariant that asserts its own coverage ("pinned down by a server test and a browser test"). It happens to be true, but it means a ledger verdict was written into the dossier instead of derived from the suite. |
| segments | §17 | Already self-reports three of the gaps triage found (I-27, I-29, I-30), so those were known rather than new. |


## Cyrillic `И-NN` in test comments

37 comments across `packages/identity/server` and `apps/admin-e2e/src/workspaces`
cite invariants as `И-09`, `И-34` — with a **Cyrillic И**, and unqualified. They
read as citations to a human skimming, but no grep for `I-09` finds them and the
ledger never will.

They are not noise: whoever wrote those suites was tracking the invariants
already, which is why identity triaged at 30/30 and workspaces at 33/34. Worth
normalising to the ledger's `<pkg>:I-NN` form, but only against the invariant
text one by one — the numbering in the comments has not been verified to match
the dossier's, and a bulk rename would fabricate citations.
