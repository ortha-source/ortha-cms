# Dossier corrections found during coverage triage

Triage reads each dossier against the code that implements it, so it turns up
claims that have drifted. Where an invariant itself is wrong, it is recorded as
`stale` in `judgments/<pkg>.json` and the dossier gets fixed. This file collects
the rest — errors in the surrounding prose, checklists and counts, which the
ledger has no state for but which mislead the next reader just as much.

Nothing here is a code defect. Code defects belong in the gap list.

| Package          | Where                                    | What is wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

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
