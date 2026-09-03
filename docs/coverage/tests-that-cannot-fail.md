# Tests that cannot fail

Triage turned up a class of finding worth separating from the gap list: a test
whose fixture makes it pass whether or not the behaviour it names is present.

These are worse than gaps. A gap is visible — the ledger says `uncovered` and the
work is on the list. One of these reads as coverage, gets counted in a review,
and will keep passing through the exact regression it was written to catch. Every
one of them was found by asking the same question, which is the whole discipline
the ledger encodes: *would this test fail if the invariant broke?*

Each needs a fixture change, not a new test. They are listed in the order found.

| Invariant | Test | Why it cannot fail |
| --- | --- | --- |
| `activity:I-18` | admin-e2e "an over-large `?pageSize` is clamped instead of 400ing into a dead end" | `mockActivity` echoes any `pageSize` back with a 200, so an unclamped request renders identically to a clamped one. Neither half of the invariant is pinned — no server test sends `pageSize=101` either. |
| `query-builder:I-27` | admin-e2e "sets every matched audience at once, not just the page" | The fixture seeds 3 audiences against `EntryAccessTab`'s `DEFAULT_PAGE_SIZE` of 10, so every match is on screen. A bulk action that operated only on visible rows would pass. |
| `transfer:I-03` | server-e2e export walk | The one-hop depth rule is the feature's central claim, and the fixture graph has no depth-2 neighbour — a walker that recursed would still pass. |
| `media:I-14` | `media-folders.spec.ts` "cascades only inside the caller's workspace" | Deletes a *childless* root folder, so the recursive `FOR UPDATE` / deepest-first / repeat-until-stable walk it is cited for is never entered. Left uncovered rather than cited. |
| `copilot:I-02` | "refuses a withheld tool at execution, not only at offer time" | The tool was never in the profile, so the call exits down the unknown-tool branch before reaching the per-call re-resolve the invariant is about. Caching the profile across a conversation would break nothing. |
| `copilot:I-34` | registry assertion | Uses `arrayContaining`, so registry *growth* while the feature is disabled would still pass. |

## The pattern

Four of the six share one shape: **a fixture too small to distinguish the two
behaviours**. Three audiences under a page size of ten, a graph with no second
hop, a childless folder for a recursion test. The assertion is right; the world
it runs in cannot tell the difference.

The other two are **branch shadowing** — an earlier guard answers first, so the
code under test is never reached, and the test passes for the wrong reason.

Both shapes are invisible to a reviewer reading the test name, and both are
invisible to coverage tooling, which sees the line execute.
