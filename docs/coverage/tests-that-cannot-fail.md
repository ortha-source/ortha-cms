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
| `activity:I-18` | admin-e2e "an over-large `?pageSize` is clamped instead of 400ing into a dead end" | `mockActivity` echoes any `pageSize` back with a 200, so an unclamped request renders identically to a clamped one. Neither half of the invariant is pinned — no server test sends `pageSize=101` either. **Repaired:** `mockActivity` now answers **400** to a `pageSize` outside `1…100`, shaped like the `ValidationPipe`'s own body, so the mock states the contract the DTO's `@Max` states and deleting the page's clamp fails the test. The case keeps its title, cites the invariant, and seeds 120 events so the clamped page is a full one — "Showing 1–100" separates a ceiling at the server's maximum from a retreat to the default 25, which would also dodge the 400 — and asserts the URL still reads `pageSize=1000`, since the clamp happens on the way out rather than by rewriting what the reader typed. The server half is `activity.spec.ts` → "refuses a pageSize above the 100-row maximum, and serves 100 itself" (101 and 1000 are 400s, 100 is served) plus the same pair on the entry-history route in `entry-activity.spec.ts`, which carries its own query DTO. |
| `segments:I-27` (listed here as `query-builder:I-27`, which does not exist — that dossier stops at I-21) | admin-e2e "sets every matched audience at once, not just the page" | The fixture seeds 3 audiences against `EntryAccessTab`'s `DEFAULT_PAGE_SIZE` of 10, so every match is on screen. A bulk action that operated only on visible rows would pass. **Repaired:** the case now seeds `PAGED_SEGMENT_SEED` — fourteen audiences, so `Audience 11`…`Audience 14` are never rendered — and asserts, first, that page two really is off screen, then that all fourteen ids reached the entry's **save body**. Those four can only have come from the list response's `ids`, so `onApply` folded over `list` instead of `matchedIds` now fails. The invariant's second half has its own case: `matchedIdsCap` on the mock reproduces the server's `MATCHED_IDS_CAP`, and past it the three bulk controls are disabled with the reason on screen. |
| `transfer:I-03` | server-e2e export walk | The one-hop depth rule is the feature's central claim, and the fixture graph has no depth-2 neighbour — a walker that recursed would still pass. **Repaired:** the walk is now exercised over `test_comment` → `test_article` → `test_author`, so the depth-2 author is a record a recursive walk would add. |
| `media:I-14` | `media-folders.spec.ts` "cascades only inside the caller's workspace" | Deletes a *childless* root folder, so the recursive `FOR UPDATE` / deepest-first / repeat-until-stable walk it is cited for is never entered. Left uncovered rather than cited. **Repaired:** the citation moved off it. "deletes a non-empty folder together with every level below it" now runs root › child › grandchild with an asset at each level, so a cascade that stops after the direct children fails; "stops the walk where the subtree leaves the workspace" builds the only shape that can follow a parent link across a tenant (A › A › B › A, the middle row written straight to the table), which is what tells the CTE's workspace filter apart from its absence; and three racing-write tests pin the `FOR SHARE`/`FOR UPDATE` serialisation by its outcome — no surviving row whose parent is gone. The old test keeps its isolation assertion and now says in a comment what it cannot show. Both new cases read the surviving assets **from `media_asset`** (`listMediaAssets` in the seed harness) rather than from `GET /api/media/assets`: that route browses one folder and an omitted `folderId` means the workspace *root*, so an asset alive in a nested folder is absent from it either way — through that window a correct cascade and an over-deletion look identical, and the first run of these tests failed on exactly that. The `expectNoOrphans` helper shared by the racing-write cases had the same blind spot, and every asset it checked was a root asset by construction. The "bytes went too" half is now carried by one asset **uploaded** through the API into the deepest folder, asserted against `blobStoreKeys()`; the `GET .../raw` → 404 it replaced could not fail, because a seeded row has no blob behind it and 404s whether or not it was deleted. |
| `copilot:I-02` | `copilot-chat.spec.ts` "refuses a withheld tool at execution, not only at offer time" | The tool was never in the profile, so the call exits down the unknown-tool branch before reaching the per-call re-resolve the invariant is about. Caching the profile across a conversation would break nothing. **Repaired:** the old case is renamed "answers a never-offered tool “unknown”, and runs nothing" and now asserts that branch's own message, so it no longer reads as coverage of the re-resolve. The re-resolve is pinned by `copilot-run-authority.spec.ts` → "a grant revoked mid-run": the caller holds `content:update` at offer time, `fixture.proposeThing` is in `calls[0].tools`, and the grant is deleted while the run is parked on its permission prompt — so the answered call reaches the fresh resolve and comes back `You are not permitted to use "fixture.proposeThing"`, with the handler never invoked. A second run in the same conversation is then offered the tool no longer, which is the "nothing cached across a conversation" half. |
| `copilot:I-34` | `tool-registry.spec.ts` "leaves the MCP endpoint a full catalogue" | Uses `arrayContaining`, so registry *growth* while the feature is disabled would still pass. **Repaired:** the fully-mounted block snapshots both surfaces of the shared registry in its `beforeAll` (`registryToolNames`, a new support helper that reads `ToolRegistry` out of DI), and the copilot-disabled block compares its own registry to that snapshot with `toEqual` — so a tool that appeared, disappeared, or leaked across surfaces with the toggle fails. The served `tools/list` is compared to the same exact set rather than a three-name subset. |
| `i18n:I-17` | `i18n-content.spec.ts` "leaves a mirrored relation unset where the target has no translation" | The German sibling's `author` is already `null` when the test starts, so an implementation that skips instead of nulling passes identically. The set → unresolvable → `null` transition the invariant exists for is never driven. **Repaired:** now titled "nulls a mirrored relation the source moved out of reach", the German sibling starts holding the German Ada and the English article is reassigned to an untranslated author, so a skip leaves the previous author's translation behind and the test fails. |
| `wysiwyg:I-05` | admin-e2e "offers no link to fall into on the way to the editor" | Asserts zero `getByRole('link')` in the preview, but the fixture `WYSIWYG_ENTRY_BODY` contains no anchor at all. Delete `flattenLinks` from `renderRichText` and the test stays green. **Repaired:** `WYSIWYG_ENTRY_BODY` now carries `<p><a href="https://example.com/changelog">the full changelog</a></p>`, and the case — renamed "flattens the body's links, so there is none to fall into on the way to the editor" — asserts first that the preview holds a `<span data-link>` reading *the full changelog*, then that it holds no link. Deleting `flattenLinks` now fails both halves. The anchor is its own paragraph so axe's `link-in-text-block` (which only applies to a link embedded in surrounding text) stays out of the expanded editor's scan, and its text names its destination so `inspectRichText`'s 2.4.4 rule leaves it alone. |
| `wysiwyg:I-25` | admin-e2e "records a decorative image as answered" | Inserts the image with no `alt`, so `alt === ''` held before the box was ticked. `setMediaAlt`'s `alt: decorative ? '' : alt` could be replaced by `alt` outright. **Repaired:** the case is now "clears the alt when the image is marked decorative" and inserts the image **with** `A ruled divider`, asserting the trigger reads "Alt text" (answered) before the box is ticked. `AltTextPopover` disables its input rather than emptying it, so a non-empty `alt` really does reach the save beside `decorative: true`. It keeps its `I-26` citation, whose half (the saved HTML carries the real value, empty included) the same assertions still pin. **The repaired fixture failed on its first run, against a live defect** — and the defect was hiding behind the sentence this row originally ended with. `alt: decorative ? '' : alt` was not "the only thing that empties it"; it lived in `setMediaAlt`, a command **nothing called**. The popover's `onSave` went straight to the node view's `updateAttributes`, writing the description verbatim beside `data-decorative`, so an image the author had declared carries no information still announced *A ruled divider* to the screen-reader user the mark exists to protect. The command was unreachable enough to reference an identifier it never imported without anyone noticing. Fixed in `dd0b9676`, which moves the rule into `domain/mediaAlt` and routes both writers through it. This is the row to point at when asking whether the pass earns its cost: reading the code found the rule and assumed it ran, and only a fixture that could actually fail established that it did not. |

## A third shape: the observable cannot show the difference

Found while running the repairs, not while reading them. `GET /api/media/assets`
passes `folderId ?? null`, and the query reads `null` as *the workspace root* —
the "every folder" state exists in `ListAssetsParams` but the HTTP route cannot
express it. So an asset in any subfolder is invisible to that call whether or not
the cascade took it: **through that window a correct cascade and an
over-deletion look identical.**

This is neither a small fixture nor a shadowed branch. The assertion is right and
the fixture discriminates; the *observable* does not. It cost two failing tests
that looked like a production bug and were not.

Two more surfaced in the same file, both in code written the same day by an agent
explicitly told to avoid this:

- `expectNoOrphans`, shared by three racing-write tests, read assets through that
  same root-only listing — so every asset it checked had `folderId === null` by
  construction, and its "no asset points at a deleted folder" claim was vacuous.
- Two `GET …/raw → 404` lines: a seeded row has no blob, so `/raw` answers 404
  regardless. Replaced with a real upload plus blob-store assertions before and
  after, so "bytes included" is a claim the store can refute.

The lesson is the uncomfortable one. A rule in the prompt did not prevent these;
**running the test did.** Write-then-run is not a convenience, it is the only
step that distinguishes a test from a sentence about a test.

## Proving a test can fail: mutate the production code

The media diagnosis established discrimination rather than asserting it — drop
`child.workspace_id` from the recursive CTE branch and confirm *only* the
workspace-boundary test fails; make the recursive branch match nothing and
confirm the depth test and all three racing tests fail. Revert after each.

Two minutes, and it is the only proof that a test bites. Do it for every repair
in this file.

## The pattern

Six of the nine share one shape: **a fixture too small to distinguish the two
behaviours**. Three audiences under a page size of ten, a graph with no second
hop, a childless folder for a recursion test. The assertion is right; the world
it runs in cannot tell the difference.

The other two are **branch shadowing** — an earlier guard answers first, so the
code under test is never reached, and the test passes for the wrong reason.

Both shapes are invisible to a reviewer reading the test name, and both are
invisible to coverage tooling, which sees the line execute.

## Was unstable, and always was — diagnosed and fixed

Not a test that cannot fail — the opposite, and it is recorded here because it
bears on the same question: whether a green suite means anything. The
investigation is left in the order it happened, because every hypothesis it
discards is one worth not having again; the answer is in
**[Diagnosed and fixed](#diagnosed-and-fixed-the-requests-were-reaching-another-process)**
at the end.

A full `server-e2e` run (111 suites, 1710 tests) ends **1708 passed, 2 failed**:

| Spec | Failure |
| --- | --- |
| `server/insights/content-insights.spec.ts` → `stops counting an entry once it is unpublished` | `POST /api/content/test_article` answered **403**, expected 201 |
| `server/users/origin-guard.spec.ts` → `allows a request with no Origin (non-browser client)` | `read ECONNRESET` |

What is established:

- Both pass **in isolation** (52/52 together), so it is ordering-dependent.
  (Read at the time as leakage between spec files. It was not — see the end.)
- `jest.config.cts` sets `maxWorkers: 1`; the suite runs in band, single process.
  This is not a parallel-worker race.
- Neither file is touched by the coverage work.
- Not `revokePermissionFromRole` (added with the slice): it refuses system roles
  by design, and its only caller uses a disposable role that `resetDb` removes.

**The clean-tree run settles it.** A full run on `4bbe57a4` — the commit before
any coverage work — also ends with **two failures**, and they are *different
tests*:

| Commit | Failures |
| --- | --- |
| `4bbe57a4`, before the slice | `content-entries-write` → "merges a link delta onto existing links"; `webhook-endpoints` → "refuses `ftp://…`" |
| with the slice | `insights/content-insights` → a content write answered 403; `users/origin-guard` → `ECONNRESET` |

Two failures both times, a different pair each time, and all four pass in
isolation. That is not a regression; it is a suite that drops roughly two tests
per full run wherever the ordering happens to land. The coverage work is
exonerated, and the instability is older than it.

Nobody had seen it because nobody ran the suite end to end — the specs are run
per-directory, and a per-directory run is exactly the shape that hides it.

### Diagnosed and fixed: the requests were reaching another process

It was never leakage between spec files. **The lost requests were answered by
other programs running on the machine.**

`supertest` builds every URL as `http://127.0.0.1:<port>`, but the listen it
does for you names no address:

```js
// supertest/lib/test.js — serverAddress()
if (!addr) this._server = app.listen(0);          // binds the WILDCARD
return 'http://127.0.0.1:' + app.address().port;  // dials LOOPBACK
```

A wildcard `listen(0)` binds `0.0.0.0`/`::`, and Node sets `SO_REUSEADDR`, which
on BSD/macOS lets it **succeed on a port another process already holds bound to
`127.0.0.1` specifically**. The more specific socket wins the loopback traffic,
and the request is answered by the stranger. (Linux refuses the overlap, so a
Linux CI runner would never have reproduced this — the bug lived exactly where
the suite was actually being run.) On the machine that has the problem those
strangers are ordinary desktop software — DataGrip's built-in server on
`127.0.0.1:63342`, the JetBrains toolbox on `52829`, two more IDE ports — and
what they answer is `403 Forbidden`, `301 Moved Permanently`, or a hang-up the
client reports as `read ECONNRESET`. **That is the whole failure list**: a
content write "refused" 403, a `read ECONNRESET`, a link-delta write that got
someone else's answer, an `ftp://` refusal that never reached the server.

Why about two a run, and never in a per-directory run: supertest also **closes
the server after every request**, so the harness re-bound a fresh ephemeral port
for each of the ~35 000 requests a full run makes. Two ports go per request (the
listener and the client's source port) out of macOS's 49152–65535, so a full run
cycles the range about four times and lands on each occupied port about four
times. A directory takes a few hundred requests and never gets round the ring.

Reproduced outside the suite in a minute, with nothing but supertest and a
one-line server that only ever answers `200`:

```
#1455 port=63342 status=301  server: DataGrip 2026.1.3
#4342 port=52829 status=403  Forbidden
#8340 port=60879 ERR=socket hang up
done: 20000 requests, 11 wrong answers   (a period of ~8100 — half the range)
```

The fix is in `createTestApp`: bind `127.0.0.1` ourselves, once, before a test
can touch the server. The kernel will not hand a loopback listen a port already
bound on loopback, so the collision cannot be constructed; and because
`app.address()` is already set, supertest neither listens nor closes, which
takes the churn from one bind per request to one per spec file. `createServer`
gained a `host` option so `create-server.spec.ts` (which drives the real host
bootstrap) is covered by the same rule.

`apps/server-e2e/src/harness/harness-binding.spec.ts` pins it: that the harness
is bound to `127.0.0.1` before any request, that the port does not change across
requests, and — deterministically, out of two servers of its own — the kernel
behaviour the fix rests on, so the day a platform stops behaving this way the
comment does not quietly become a lie.

**The lesson is the same one this file keeps recording.** Every hypothesis on
the list above was about our code: module-level state, an app not closed, rows
`resetDb` misses. All plausible, all wrong. What settled it was reproducing the
symptom in a program with no database, no Nest and no leak — at which point the
answer arrived with a vendor name in the response header.
