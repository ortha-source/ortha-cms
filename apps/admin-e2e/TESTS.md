# Admin E2E test catalog

> **Generated file — do not edit by hand.** Regenerate with
> `npx nx catalog admin-e2e`. CI runs `npx nx catalog:check admin-e2e`
> and fails if this file has drifted from the specs.

_703 test cases across 71 spec files._

<!-- source: apps/admin-e2e/src/activity/activity-filter.spec.ts -->
_<sub>apps/admin-e2e/src/activity/activity-filter.spec.ts</sub>_

## Activity filter (query builder)

| Test case |
| --- |
| expands the inline filter panel from the toolbar |
| filters the log by kind and deep-links the choice |
| reflects the active condition count on the trigger |
| restores the filter from a deep link on load |
| blocks Apply when a UUID "is one of" rule has a non-UUID value |
| the open filter panel with a rule is accessible (axe) |
| Reset clears the filter and restores the full log |

<!-- source: apps/admin-e2e/src/activity/activity-kinds.spec.ts -->
_<sub>apps/admin-e2e/src/activity/activity-kinds.spec.ts</sub>_

## Activity Log kind catalogue

| Test case |
| --- |
| every audit kind the server writes has a localized Action label |
| a few labels read as the phrases they should be |
| every subject type renders as a readable name, not a machine token |
| the Details line reads the per-kind meta the server records |
| the home panel names an action the same way the table does |

<!-- source: apps/admin-e2e/src/activity/audit-log.spec.ts -->
_<sub>apps/admin-e2e/src/activity/audit-log.spec.ts</sub>_

## Activity Log page

| Test case |
| --- |
| renders the audit trail with actors and actions |
| renders a system-initiated event with a "System" actor |
| expands a row to reveal its details, then collapses it |
| expands a row by clicking anywhere on the row body |
| the actor-email search drives the request |
| deep-links the active search into the URL |
| shows an empty state when filters match nothing |
| hides the nav entry and shows no-access without activity:read |

## Activity Log resilience

| Test case |
| --- |
| an over-large ?pageSize is clamped instead of 400ing into a dead end |
| a malformed timestamp does not take the whole app down |

## Activity Log accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| table — initial |
| table — expanded row |
| table — loading skeleton |
| empty state — no matches |
| no-access state |
| table — dark theme |
| table — dark theme, expanded row |

## Activity Log assistive-technology semantics

| Test case |
| --- |
| a collapsed row contributes one table row, not two |
| the When cell carries a machine-readable instant |
| paging changes the live region, so the turnover is announced |

## Activity Log keyboard operability

| Test case |
| --- |
| the actor-email search filters as you type |
| a row expands from the keyboard |
| "Clear filters" hands focus back instead of dropping it on the body |

<!-- source: apps/admin-e2e/src/api-tokens/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/api-tokens/a11y.spec.ts</sub>_

## API tokens accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| table — initial |
| table — loading skeleton |
| list error state |
| empty state |
| create dialog — open |
| create dialog — the two selects carry real names |
| create dialog — workspace fetch failed |
| reveal dialog — secret shown |
| revoke confirm — open |
| no-access state |
| the eight-column table scrolls rather than clips at 320 px |
| the pager is reachable at 320 px too |

<!-- source: apps/admin-e2e/src/api-tokens/api-tokens.spec.ts -->
_<sub>apps/admin-e2e/src/api-tokens/api-tokens.spec.ts</sub>_

## API tokens page

| Test case |
| --- |
| lists tokens with every column the table promises |
| derives status from expiry and revocation, revocation winning |
| resolves workspace ids to names, falling back to the raw id |
| offers Revoke only on an active token |
| a failed list gets its own state, not the empty one |
| Retry recovers the list once the API is back |
| an empty deployment gets the empty state with a create action |
| without tokens:create the empty state offers no way in |
| without tokens:read the page refuses and never asks the API |
| without tokens:delete the actions column is absent entirely |
| the create dialog sends exactly what the server expects |
| an expiry preset becomes an ISO timestamp in the future |
| a failed create keeps the form and its values on screen |
| the submit cannot be double-fired while a create is in flight |
| a broken workspace fetch says so instead of reading as empty |
| revoking flips the row in place and says it happened |
| cancelling a revoke sends nothing |
| a failed revoke toasts and leaves the row alone |
| announces the result count so a change without a navigation is heard |
| no pager on a single page |
| the page lives in the URL, so it is linkable and survives a reload |
| a deep link past the end clamps back to the last page |

<!-- source: apps/admin-e2e/src/api-tokens/keyboard.spec.ts -->
_<sub>apps/admin-e2e/src/api-tokens/keyboard.spec.ts</sub>_

## API tokens keyboard operability

| Test case |
| --- |
| the create dialog opens with the Name field focused |
| Escape closes the workspace popover without closing the dialog |
| the secret is a tab stop, so it can be read and copied by hand |
| the whole secret is exposed, not just what fits on screen |
| a revoke lands focus somewhere real instead of on the body |
| the kebab is named per row, so a menu is never ambiguous |

<!-- source: apps/admin-e2e/src/api-tokens/reveal-secret.spec.ts -->
_<sub>apps/admin-e2e/src/api-tokens/reveal-secret.spec.ts</sub>_

## API token reveal-once dialog

| Test case |
| --- |
| shows the secret in a labelled, focusable field |
| focusing the secret selects it, so Ctrl+C is a real fallback |
| a copy that works confirms it |
| a refused clipboard write says so instead of failing silently |
| Done asks before discarding an uncopied secret |
| Escape asks too — every dismissal path funnels through the guard |
| once copied, the dialog closes without argument |
| the plaintext is gone from the client once the dialog is dismissed |
| reloading after a create leaves the token but not its secret |

<!-- source: apps/admin-e2e/src/auth/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/auth/a11y.spec.ts</sub>_

## accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| login page — initial |
| login page — required-field errors visible |
| login page — credential-error banner visible |
| accept-invite page — form ready |
| accept-invite page — validation errors visible |
| accept-invite page — submission-error banner visible |
| accept-invite page — dead link |
| accept-invite page — lookup outage |
| auth gate — probe unavailable |
| login page — dark theme |
| login page — dark theme, errors visible |
| accept-invite page — dark theme |
| login page — banner and field error at once |
| home page |
| root loader — auth probe pending |

<!-- source: apps/admin-e2e/src/auth/accept-invite.spec.ts -->
_<sub>apps/admin-e2e/src/auth/accept-invite.spec.ts</sub>_

## accept an invite

| Test case |
| --- |
| shows who the invite is for and asks only for a password |
| each read-only field explains why it cannot be edited |
| omits the name field when the invite carries none |
| posts the token with the password and lands in the app |
| blocks a too-short password client-side, sending no request |
| blocks a mismatched confirmation, sending no request |
| flags both empty fields on submit |
| gives an empty field one message, not a stack of them |
| explains a link that died while the form was open |
| explains a password the server rejected |
| falls back to the generic message for any other failure |
| keeps the form usable after a failed accept — the token is unspent |
| replaces the token URL in history when the invite is accepted |
| hands the tab to the invitee when somebody else was signed in |
| shows the dead-link state for a rejected token |
| tells a truncated link apart from a dead one |
| tells a server outage apart from a dead link |
| retrying a failed lookup picks up where it left off |
| renders a name with markup in it as literal text |
| renders an RTL name without disturbing the copy around it |
| transports a token with reserved characters intact |
| announces the lookup while it is in flight |
| disables the submit button while the request is in flight |

<!-- source: apps/admin-e2e/src/auth/chunk-failure.spec.ts -->
_<sub>apps/admin-e2e/src/auth/chunk-failure.spec.ts</sub>_

## a chunk that never loads

| Test case |
| --- |
| shows a recoverable card instead of blanking the page |
| the failure is announced as a heading, not left as bare text |

<!-- source: apps/admin-e2e/src/auth/focus-and-title.spec.ts -->
_<sub>apps/admin-e2e/src/auth/focus-and-title.spec.ts</sub>_

## auth focus management

| Test case |
| --- |
| a failed sign-in moves focus to the error, not past it |
| the fields are one Tab away from the focused error |
| the banner is not added to the tab order |
| arriving at sign-in focuses its heading rather than the document body |
| the focused heading is not ringed like a control |
| the focused error banner is not ringed either |
| a control reached by Tab keeps its focus indicator |
| the invite form takes focus when the lookup resolves |
| the dead-link card takes focus when the lookup fails |

## auth page titles

| Test case |
| --- |
| the sign-in page names itself in the tab title |
| the accept-invite page names itself in the tab title |
| signing in hands the title back instead of stranding "Sign in" over the app |

<!-- source: apps/admin-e2e/src/auth/keyboard.spec.ts -->
_<sub>apps/admin-e2e/src/auth/keyboard.spec.ts</sub>_

## keyboard accessibility

| Test case |
| --- |
| the email field is the first focus stop |
| tabbing through the form hits credentials then submit, with no dead stop between |
| login can be completed and submitted by keyboard alone |
| an invite can be accepted by keyboard alone |
| every accept-invite field is reachable in source order |

<!-- source: apps/admin-e2e/src/auth/login.spec.ts -->
_<sub>apps/admin-e2e/src/auth/login.spec.ts</sub>_

## Login page (/identity/signin)

### successful sign-in

| Test case |
| --- |
| navigates to the home page |

### invalid credentials (401)

| Test case |
| --- |
| shows the error banner and stays on the page |

### client-side validation

| Test case |
| --- |
| empty submit flags both required fields without calling the API |
| shows exactly one error per field |
| rejects a malformed email |

### the controls on offer

| Test case |
| --- |
| offers no control that leads nowhere |
| says how an account is obtained instead |

### pending state

| Test case |
| --- |
| disables the submit button while the request is in flight |

## The session probe on the sign-in page

| Test case |
| --- |
| asks once and does not retry the 401 |
| renders the form for an already signed-in visitor |

<!-- source: apps/admin-e2e/src/auth/logout.spec.ts -->
_<sub>apps/admin-e2e/src/auth/logout.spec.ts</sub>_

## Logout

| Test case |
| --- |
| lands the tab on the sign-in page |
| says so when the request fails, instead of swallowing the click |
| leaves nothing of the previous account in the cache |

## Signing in after a session ended on its own

| Test case |
| --- |
| does not inherit the previous account’s cached data |

<!-- source: apps/admin-e2e/src/auth/private-routes.spec.ts -->
_<sub>apps/admin-e2e/src/auth/private-routes.spec.ts</sub>_

## Private route gating

| Test case |
| --- |
| redirects a signed-out user from / to the sign-in page |
| redirects a signed-out user from an unknown path to the sign-in page |
| returns to the home page after a gated user signs in |

## Auth probe unavailable

| Test case |
| --- |
| says the server is unreachable instead of signing the user out |
| recovers when the API comes back |

## Session lost mid-visit

| Test case |
| --- |
| redirects to the sign-in page when a request comes back 401 |
| redirects when the session dies under a mutation, without an unhandled error |

## Auth still resolving

| Test case |
| --- |
| holds the branded loader and never flashes the sign-in page |
| gates every affordance while it resolves — fail-closed |

<!-- source: apps/admin-e2e/src/auth/reduced-motion.spec.ts -->
_<sub>apps/admin-e2e/src/auth/reduced-motion.spec.ts</sub>_

## reduced motion

| Test case |
| --- |
| the busy skeleton does not pulse when reduced motion is requested |
| the skeleton still animates by default |

<!-- source: apps/admin-e2e/src/auth/reflow.spec.ts -->
_<sub>apps/admin-e2e/src/auth/reflow.spec.ts</sub>_

## reflow at 320px

| Test case |
| --- |
| the sign-in card fits without sideways scrolling |
| the accept-invite card fits, long email and all |
| nothing is stranded above the scroll origin |

<!-- source: apps/admin-e2e/src/auth/routing.spec.ts -->
_<sub>apps/admin-e2e/src/auth/routing.spec.ts</sub>_

## Admin routing

| Test case |
| --- |
| /identity redirects to the sign-in page |
| an unknown path redirects to home |
| serves the home page inside the shell at / |

<!-- source: apps/admin-e2e/src/content/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/content/a11y.spec.ts</sub>_

## Content Library accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| sidebar + welcome pane |
| expanded group + selected type |
| column picker — open |
| search palette — open |
| sidebar error state |
| entry editor — publish gate showing a refusal |

<!-- source: apps/admin-e2e/src/content/content-library.spec.ts -->
_<sub>apps/admin-e2e/src/content/content-library.spec.ts</sub>_

## Content Library

| Test case |
| --- |
| renders the sidebar with the Workspace Content section |
| Collections opens by default; Pages toggles on click |
| selecting a single (page) opens its entry editor |
| only shows content types granted to the workspace |
| pinning a type adds it to a Favorites section |
| opens the search palette and navigates to a type |
| the Ctrl/⌘+K shortcut opens and Escape closes the palette |
| shows the empty state when the workspace has no content |
| shows the error state and recovers on retry |
| selecting a collection shows its records table |
| searching with no matches shows the empty state |
| the column picker toggles a column |
| the column picker can be searched |
| the column search shows an empty state when nothing matches |
| Add record and row click route to their stubs |
| saving a record stays on the editor and shows a success toast |
| reorders a column via the keyboard |
| sorts records by a column, toggling asc → desc → off |
| selects rows, select-all, and clears the selection |
| row actions menu offers Edit, Publish, and Copy ID |

### required fields

| Test case |
| --- |
| marks a required field and leaves optional ones alone |

### datetime fields

| Test case |
| --- |
| renders a UTC instant in the viewer’s local time |

### entry editor tabs as routes

| Test case |
| --- |
| opening a tab puts it in the URL; General stays canonical |
| a tab URL can be opened directly |
| a single page carries its tab on the type path |

### entry form validation

| Test case |
| --- |
| a numeric field accepts a number and sends it as one |
| clearing a numeric field sends nothing rather than NaN |
| a blocked publish explains itself instead of doing nothing |

<!-- source: apps/admin-e2e/src/content/entry-field-groups.spec.ts -->
_<sub>apps/admin-e2e/src/content/entry-field-groups.spec.ts</sub>_

## Entry editor field groups

### a type with both translated and shared fields

| Test case |
| --- |
| draws a rule between the two runs, under their headings |
| the rule is decorative — it never lands in the a11y tree |

### a type whose fields are all one kind

| Test case |
| --- |
| keeps the flat stack — no headings and no rule |

<!-- source: apps/admin-e2e/src/content/entry-read-only.spec.ts -->
_<sub>apps/admin-e2e/src/content/entry-read-only.spec.ts</sub>_

## Entry editor — read-only

### as a reader (no content:update)

| Test case |
| --- |
| explains itself and offers no save action |
| renders every text field read-only, colour field included |
| refuses typing into the colour field |
| disables the controls that have no read-only state |
| offers the rich-text body to view, not to edit |
| shows the media field without any way to attach or upload |
| never saves, even on a form submit from a field |
| has no accessibility violations |

### as an editor (with content:update)

| Test case |
| --- |
| keeps the fields and the actions live |

<!-- source: apps/admin-e2e/src/content/entry-revisions.spec.ts -->
_<sub>apps/admin-e2e/src/content/entry-revisions.spec.ts</sub>_

## Entry revision history

| Test case |
| --- |
| saving a draft keeps the published version live |
| publishing a version from history makes it live |

<!-- source: apps/admin-e2e/src/content/entry-validation.spec.ts -->
_<sub>apps/admin-e2e/src/content/entry-validation.spec.ts</sub>_

## Entry editor validation

### a required field the editor renders nowhere

| Test case |
| --- |
| is left out of the publish gate and out of client validation alike |
| surfaces the server 422 as a toast when it names an unrendered field |
| a field keeps announcing its hint once it is showing an error |

### refused submits and field hints

| Test case |
| --- |
| a refused publish moves focus to the first invalid control |
| the publish gate states each row pass or fail in words |

<!-- source: apps/admin-e2e/src/content/i18n-resilience.spec.ts -->
_<sub>apps/admin-e2e/src/content/i18n-resilience.spec.ts</sub>_

## Content i18n — degraded reads and edge locales

| Test case |
| --- |
| a failed locale list leaves a retry in the toolbar, not a hole |
| a failed group read says so instead of offering to create what exists |
| a failed summary batch marks the Locales cells unavailable |
| the Locales column does not fetch while it is switched off |
| an unconfigured ?locale= is reported, and any pick clears it |
| an empty ?locale= falls back to the default rather than scoping to nothing |
| leaving within the cover cancels the pending locale swap |

<!-- source: apps/admin-e2e/src/content/i18n.spec.ts -->
_<sub>apps/admin-e2e/src/content/i18n.spec.ts</sub>_

## Content i18n

| Test case |
| --- |
| shows the locale switcher on a localized collection |
| switching locale updates the URL and re-scopes the table |
| opening a row and going back keeps the active locale |
| switching locale keeps the tab the user was working in |
| the default locale keeps a clean URL through the editor |
| the localized-field mark explains itself on hover and on focus |
| splits the form into translated and shared field groups |
| marks how a relation carries across the record’s other locales |
| switching locale plays a brief "Switching…" overlay |
| the Locales column shows per-group locale badges |
| a locale badge names its publish state in words, not wire values |
| the switcher search box is a combobox over the locale list |
| each locale name declares its own language and direction |
| the entry editor marks the language of the record’s own fields |
| the entry editor locale switcher shows current / existing / missing |
| switching to an existing sibling opens that locale row |
| selecting a missing locale opens a prefilled draft form |
| a brand-new record can be re-targeted to another locale before saving |
| a translation draft can jump to an existing sibling |
| the relation picker on a translation-create form is scoped to that locale |

### save after switching locale on a fresh record

| Test case |
| --- |
| saving as draft creates a sibling, never a PATCH on the original |
| publishing creates a sibling, never a PATCH on the original |

### All-locales actions

| Test case |
| --- |
| the ⋯ menu groups the built-ins and the locale actions |
| publish all locales pre-flights every sibling, named by locale |
| publishing all locales refreshes the open record’s own status |
| unpublish all locales confirms, naming the live locales |
| neither action is offered on an unsaved record |

<!-- source: apps/admin-e2e/src/content/media-fields.spec.ts -->
_<sub>apps/admin-e2e/src/content/media-fields.spec.ts</sub>_

## Entry editor — Media tab

| Test case |
| --- |
| renders a card per media field, each with its empty state |
| attaches an asset picked from the library and saves its id |
| restricts the picker to the kinds the field accepts |
| walks into a folder and back out through the breadcrumb |
| stages an upload and sends it only when the record is saved |
| drops a staged file without ever uploading it |
| appends to a multiple field and reorders it |
| shows a saved record’s assets by name, not by id |
| waits for the ref instead of fetching the original |
| falls back to the original once the read resolves nothing |
| says the library failed to load, not that it is empty |
| offers no upload without media:create |
| disables library picking without media:read |
| has no accessibility violations, picker included |

<!-- source: apps/admin-e2e/src/content/records-filter-url.spec.ts -->
_<sub>apps/admin-e2e/src/content/records-filter-url.spec.ts</sub>_

## Records filter — hand-edited ?filter=

| Test case |
| --- |
| an "${…}" operator is dropped, not rendered |
| an operator the field does not offer is reported without pressing Apply |
| the Apply gate refuses a substring operator on a date field |
| the Apply gate refuses a non-boolean value on a boolean field |
| a legal hand-written rule still restores and commits |
| a huge "within the last" count is clamped instead of crashing the panel |

<!-- source: apps/admin-e2e/src/content/records-filter.spec.ts -->
_<sub>apps/admin-e2e/src/content/records-filter.spec.ts</sub>_

## Records filter — relations (query builder)

| Test case |
| --- |
| the field picker offers a related type field, grouped |
| applying a relation-path rule deep-links the dotted path |
| a "contains" rule wraps its value in escaped wildcards |
| a relation id rule picks records, not raw uuids |
| a relation id rule keeps a set for a multi-valued operator |

### negative operators

| Test case |
| --- |
| "does not contain" serialises to nilike |
| "is not empty" serialises to null:false |

### applied-filter summary

| Test case |
| --- |
| reads the applied condition back as a chip |
| removing a chip re-commits the narrowed filter |
| "Clear all" drops every condition |

### filter fields unavailable

| Test case |
| --- |
| shows an error state instead of an empty picker |
| the table itself still loads |

<!-- source: apps/admin-e2e/src/content/records-resilience.spec.ts -->
_<sub>apps/admin-e2e/src/content/records-resilience.spec.ts</sub>_

## Records resilience

| Test case |
| --- |
| deleting the only row on the last page pulls the pager back instead of stranding it |
| a page deep-linked past the end is clamped to the last real page |
| a pageSize the server would reject falls back to the default rather than an error card |
| deleting a selected row drops it from the selection |
| focus lands on the records table after a row is deleted |
| every row-actions trigger is named for its own record |
| the live region restates the page and the sort, not just the total |
| boolean and money cells read as answers, not wire values |
| a failed content-type catalogue leaves the sidebar an error, not an absence |
| the sidebar recovers when its retry succeeds |
| the search palette announces how many types match |

<!-- source: apps/admin-e2e/src/content/relation-cells.spec.ts -->
_<sub>apps/admin-e2e/src/content/relation-cells.spec.ts</sub>_

## Relation cells (records table)

| Test case |
| --- |
| shows the first linked title with a +N overflow, not an id |
| opens a dropdown of links to each related record |
| loads past the preview once opened |
| opening the dropdown does not navigate the row |
| opening one dropdown closes the one already open |
| renders an em-dash when a relation holds nothing |
| the dropdown animates on open |
| the relation dropdown is accessible |

<!-- source: apps/admin-e2e/src/content/relations.spec.ts -->
_<sub>apps/admin-e2e/src/content/relations.spec.ts</sub>_

## Relation picker

| Test case |
| --- |
| renders each relation field as a titled card |
| assigns a single relation and shows it by title |
| assigns multiple records to a many relation |
| reorders a many relation with the down arrow |
| offers an open-in-new-tab link on candidate and assigned rows |
| searches to narrow the candidate list |
| lazily loads more candidates as the list scrolls |
| reveals the inline query-builder filter over the target schema |
| edits a bidirectional (inverse) relation from the other side |
| hides relations whose target collection the workspace lacks |
| saves staged links as a relations delta, omitting them from values |
| shows a "Changed" badge on a relation with staged edits |
| removes an assigned relation |
| selects every match at once, then clears |

## Relation picker accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| relations tab — field sections |
| relation picker — open |
| relation picker — inline filter open |

<!-- source: apps/admin-e2e/src/content/wysiwyg-fields.spec.ts -->
_<sub>apps/admin-e2e/src/content/wysiwyg-fields.spec.ts</sub>_

## Entry editor — rich text field

### the collapsed field

| Test case |
| --- |
| renders stored HTML as content, not markup |
| offers no link to fall into on the way to the editor |
| shows the field placeholder while empty |
| keeps a plain textarea for a field that opted out |

### the expanded editor

| Test case |
| --- |
| takes over the work area with the caret already in the text |
| keeps the record and its chrome on screen |
| keeps the toolbar on a single row |
| returns to the form from either exit |
| writes edits back to the form as they are made |
| stores the formatting the toolbar applied |
| stores a callout as semantic HTML, not admin classes |
| stores a table with its header row |
| stores a paragraph’s alignment as text-align |
| stores a column layout as nested divs |
| stores an emptied field as empty, not as a blank paragraph |

### media

| Test case |
| --- |
| offers the contributed sources beside the built-in URL entries |
| stores an image named by URL |
| refuses a URL the editor would not publish |
| places an asset picked from the Media Library |
| resizes an image from the keyboard, and stores the width |
| centres a selected image, and stores where it sits |
| prompts for alt text, and stores what the author writes |
| records a decorative image as answered, not as missing |
| never saves the record from an overlay’s own form |
| carries the library asset’s own alt into the body |
| shows a stored image in the collapsed preview |

### accessibility

| Test case |
| --- |
| the collapsed field has no violations |
| the expanded editor has no violations |
| the field is reachable and openable from the keyboard |
| a translated body claims its own language, expanded or not |
| returns focus to the field when the editor closes |
| offers a keyboard way out of the document, and says so |
| leaves ⌘K alone while the caret is in the body |

<!-- source: apps/admin-e2e/src/copilot/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/a11y.spec.ts</sub>_

## Agents view accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| the empty thread, its openers and the rail |
| a transcript with a tool step and a change card |
| a change card that did not apply |
| an expanded tool step |
| the archived list |
| the rename dialog |
| a rail row’s menu, open |
| the model picker, open |

<!-- source: apps/admin-e2e/src/copilot/agents-attachments.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/agents-attachments.spec.ts</sub>_

## Agents view — attaching files

| Test case |
| --- |
| stages a picked file and sends its id with the turn |
| clears the staged files once the turn is away |
| shows the file on the turn it was sent with |
| redraws the chips on a reopened thread |
| removing a chip drops it from the turn |
| blocks send while an upload is still in flight |
| reports a failed upload on the chip and sends without it |
| refuses more files than one turn may carry, and says so |

### drag and drop

| Test case |
| --- |
| highlights once while files are dragged over the box |
| attaches dropped files |

### paste

| Test case |
| --- |
| attaches pasted files |
| leaves an ordinary text paste alone |

### accessibility

| Test case |
| --- |
| names the paperclip and each chip’s remove control |
| has no axe violations with files staged |

## Agents view — who may attach

| Test case |
| --- |
| a viewer is not offered a control whose every upload would 403 |
| a role holding media:create still gets it |

<!-- source: apps/admin-e2e/src/copilot/agents-chat.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/agents-chat.spec.ts</sub>_

## Agents view — asking

| Test case |
| --- |
| asks, promotes the URL to the new thread, and answers in order |
| switching threads is navigation, so Back moves between them |
| sends the picked model, and still has it after a trip through the CMS |
| the composer grows with what you type, up to a ceiling |
| a run outlives the page it started on, and says so |
| stopping a run leaves a note rather than an error |

## Agents view — regressions

| Test case |
| --- |
| sending while a run is in flight says why, instead of silence |
| a truncated run explains itself in a translatable sentence |
| a failed step says it failed, even when the tool returned a summary |
| a table in an answer has headers, a name, and a scroll region a keyboard can reach |

## Agents view — what the run is doing

| Test case |
| --- |
| a change that did not apply says so, with room around it |
| a step names the thing it is doing, not just the kind of thing |
| the pending line names the call that just ran |
| and still says “Thinking…” when that is genuinely all it knows |
| a reopened thread names its steps exactly as the live run did |

<!-- source: apps/admin-e2e/src/copilot/agents-manage.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/agents-manage.spec.ts</sub>_

## Agents view — renaming and archiving

| Test case |
| --- |
| renames a thread, and the rail and the bar both follow |
| refuses a blank name with a reason, not a dead Save button |
| says so when the server refuses the rename |
| gives focus back to the row that opened the dialog |
| archives a thread, and only then offers the archive |
| restores a thread from the archived list |
| archiving the thread you are reading starts a new chat |
| the row menu offers no way to destroy a thread |

<!-- source: apps/admin-e2e/src/copilot/agents-skills.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/agents-skills.spec.ts</sub>_

## Agents view — skills

| Test case |
| --- |
| stages a skill and sends its name with the turn |
| shows an always-on skill without sending it |
| the count is in the button’s accessible name |
| drops a staged skill from the next turn |
| keeps a staged skill after sending, unlike a file |
| the selection survives a trip through the CMS |
| a reopened thread redraws the skills its turn ran under |
| renders no skills control when the workspace has none |
| has no accessibility violations with skills staged |

<!-- source: apps/admin-e2e/src/copilot/agents-view.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/agents-view.spec.ts</sub>_

## Agents view — the rail and the thread

| Test case |
| --- |
| lists the workspace threads under recency headings |
| filters by title, and an untitled thread matches nothing |
| a failed list says so instead of claiming there are no chats |
| opens a thread from the rail and announces which one is current |
| a reopened thread rebuilds the order the run produced |
| New chat leaves the thread instead of bouncing back into it |
| the empty thread offers openers, and picking one asks it |
| a thread that will not open offers a retry |
| without copilot:use there is no page and no switcher |

## Agents view — the model a thread was left on

| Test case |
| --- |
| reopening a thread offers the backend it was left on |
| an explicit Default is not the same as never having picked |
| a model picked on a thread is written to it, and survives a reload |
| adopting a thread’s model does not write it straight back |
| a fresh chat still inherits the last model picked in the tab |

<!-- source: apps/admin-e2e/src/copilot/dock.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/dock.spec.ts</sub>_

## Ortha AI dock

| Test case |
| --- |
| is the entry point, and opens a window focused on the composer |
| ⌘J starts a chat too |
| renders nothing outside a workspace |
| tiles three windows, and a fourth collapses the oldest |
| a pill toggles its window, and says which state it is in |
| Escape collapses to the dock; it does not close |
| closing discards the chat and hands focus to the dock |
| an untitled pill is “Untitled chat”, never “New chat” |
| names a pill after what was asked in it |
| a run that finishes off screen marks its pill and the tab |
| opens a saved thread from the history dropdown |
| Expand and Shrink are the same control, relabelled |
| a moved window stays where it was put, and survives reopening |
| Expand is the way out of a bad drag |
| the arrow keys move a focused window |
| the model choice survives collapsing and reopening |

## Ortha AI dock — the attached page

| Test case |
| --- |
| survives collapsing the window and reopening it |
| is still what the next turn carries after a collapse |
| survives switching the window to another thread |
| can still be taken off after the window has been collapsed |

## Ortha AI dock — regressions

| Test case |
| --- |
| the history dropdown will not open a thread a second window already holds |
| collapsing a window hands focus back to the dock, by button and by Escape |
| the start button announces the label it shows, and the shortcut its platform accepts |
| the transcript stops yanking a reader who has scrolled up |
| the dock is a group, and two windows have two names |

## Ortha AI dock accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| the dock, with nothing open |
| an open window over the page it is about |
| three tiled windows |
| a transcript with a change card in it |

<!-- source: apps/admin-e2e/src/copilot/skills-manage.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/skills-manage.spec.ts</sub>_

## Copilot skills — management

| Test case |
| --- |
| lists code skills as read-only and the workspace’s own as editable |
| creates a skill, deriving its identifier from the name |
| edits an existing skill |
| does not rewrite an existing skill’s identifier when its name changes |
| deletes a skill after confirming |
| shows the server’s reason for refusing a save |
| reports a missing field on submit rather than disabling Save |
| a role without the permission gets no page and no rail link |
| the rail links an admin to the page |
| has no accessibility violations, listed or in the form |

<!-- source: apps/admin-e2e/src/copilot/view-switcher.spec.ts -->
_<sub>apps/admin-e2e/src/copilot/view-switcher.spec.ts</sub>_

## CMS ⇄ Agents switcher

| Test case |
| --- |
| says which view you are in, in both of them |
| goes back to the CMS page you left, not the workspace root |
| clicking the view you are already in is not a third state |
| the dock stands down on the Agents view while it owns nothing |

<!-- source: apps/admin-e2e/src/harness/axe-fixture.spec.ts -->
_<sub>apps/admin-e2e/src/harness/axe-fixture.spec.ts</sub>_

## axe harness

| Test case |
| --- |
| runs the structural ruleset, and excludes exactly the tracked debt |
| records what axe could not decide instead of discarding it |

<!-- source: apps/admin-e2e/src/harness/seed-drift.spec.ts -->
_<sub>apps/admin-e2e/src/harness/seed-drift.spec.ts</sub>_

## harness seed drift

| Test case |
| --- |
| the signed-in mock grants exactly the server permission catalogue |

<!-- source: apps/admin-e2e/src/home/dashboard.spec.ts -->
_<sub>apps/admin-e2e/src/home/dashboard.spec.ts</sub>_

## Home dashboard

| Test case |
| --- |
| shows the greeting, stat tiles, and both panels |
| the panels link through to their full pages |

<!-- source: apps/admin-e2e/src/host/host.spec.ts -->
_<sub>apps/admin-e2e/src/host/host.spec.ts</sub>_

## a private route whose chunk never loads

| Test case |
| --- |
| shows a recoverable card instead of blanking the app |
| the failure is a focused heading, not bare text |
| a broken page does not take the toast host with it |

## client-side navigation is announced

| Test case |
| --- |
| the live region is mounted, and empty, before anything happens |
| moving to another page speaks that page name |
| a second navigation names the new page, not the one just left |
| returning to a page announces it again |
| the announcement takes up no space on screen |

## the toast host

| Test case |
| --- |
| sits in the corner the design system documents |

## bypass blocks

| Test case |
| --- |
| the first Tab reaches a visible skip link |
| activating it puts focus inside main, past the sidebar |

## the app-wide scrollport

| Test case |
| --- |
| is a tab stop, because a scrolling region must be reachable by keyboard |
| shows a focus indicator when it holds focus |

<!-- source: apps/admin-e2e/src/host/platform-preferences.spec.ts -->
_<sub>apps/admin-e2e/src/host/platform-preferences.spec.ts</sub>_

## declarative platform preferences

| Test case |
| --- |
| reach the page through `contextOptions` |

## forced colors

| Test case |
| --- |
| a button keeps a visible focus indicator |
| the app scrollport keeps a visible focus indicator |
| nothing opts out of the user palette |

## focus indicator contrast

| Test case |
| --- |
| the button focus ring clears 3:1 against the page in ${…} |

## dark theme

| Test case |
| --- |
| the members table has no contrast failures in the dark palette |
| the workspaces dashboard has no contrast failures in the dark palette |

<!-- source: apps/admin-e2e/src/host/reflow.spec.ts -->
_<sub>apps/admin-e2e/src/host/reflow.spec.ts</sub>_

## the shell reflows at 320px

| Test case |
| --- |
| the home dashboard does not scroll sideways |
| a table page keeps its controls reachable, and its table scrolls in its own box |
| the sidebar collapses rather than pushing the page sideways |

<!-- source: apps/admin-e2e/src/insights/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/insights/a11y.spec.ts</sub>_

## Insights accessibility

| Test case |
| --- |
| has no axe violations once every widget has loaded |
| has no axe violations while widgets are loading |
| has no axe violations with a failed widget on the page |
| the range picker is reachable and operable by keyboard |
| every chart carries a text alternative |

<!-- source: apps/admin-e2e/src/insights/announcements.spec.ts -->
_<sub>apps/admin-e2e/src/insights/announcements.spec.ts</sub>_

## Insights announcements and outline

| Test case |
| --- |
| a loading widget announces itself, named by its title |
| an empty widget announces politely, as the failed one does assertively |
| a failed stat tile says its value is unavailable |
| the document outline has no skipped heading level |
| a range option is addressable by the label printed on it |
| the heat grid exposes its values as a real table |

<!-- source: apps/admin-e2e/src/insights/insights.spec.ts -->
_<sub>apps/admin-e2e/src/insights/insights.spec.ts</sub>_

## Insights

| Test case |
| --- |
| renders every contributed widget in its section |
| each widget contributes its slot id to the grid |
| renders each section band under its registered id |
| renders the headline figures from the API |
| counts live records carrying unpublished edits |
| separates translated, untranslated and part-way records |
| breaks translation coverage down by content type |
| a workspace that has never published shows no pending backlog |
| coverage shares never round a near-miss to 0% or 100% |
| coverage states both series of every bar, not just the drawn one |
| an untouched workspace is not congratulated for it |
| a failing coverage read does not empty the localisation band |
| neither new widget takes a time range |
| each widget calls its own endpoint |
| a failing widget does not take down the rest of the page |
| a stat tile that cannot load shows no figure at all |
| an empty workspace shows empty states, not errors |
| shows a skeleton per widget while its request is open |
| changing the range refetches the range-dependent widgets |
| hides content widgets from a user without content:read |
| shows the empty page when no widget is visible |
| offers a table view for the chart whose values are hover-only |

<!-- source: apps/admin-e2e/src/media/media-alt-text.spec.ts -->
_<sub>apps/admin-e2e/src/media/media-alt-text.spec.ts</sub>_

## Media alt text

| Test case |
| --- |
| sends alt written at upload with the file |
| leaves alt off the request when the author skips it |
| offers no alt input for a non-image |
| edits an existing asset’s alt text from its drawer |
| shows alt read-only without media:update |
| has no accessibility violations with the drawer open |
| has no accessibility violations with a file staged for upload |

<!-- source: apps/admin-e2e/src/media/media-feedback.spec.ts -->
_<sub>apps/admin-e2e/src/media/media-feedback.spec.ts</sub>_

## Media Library feedback

| Test case |
| --- |
| shows the API’s own message when a rename is rejected |
| does not confirm a rename the server refused |
| confirms a rename the server accepted |
| puts the server’s reason on a failed upload row |
| announces which file failed, not just the batch count |
| moves focus to the grid after deleting the tile that opened the menu |
| names each asset’s ⋯ trigger after its file |

<!-- source: apps/admin-e2e/src/media/media-library.spec.ts -->
_<sub>apps/admin-e2e/src/media/media-library.spec.ts</sub>_

## Media Library

| Test case |
| --- |
| renders the workspace folders and assets |
| uploads a file and shows it in the grid |
| creates a folder |
| warns that deleting a folder takes its contents with it |
| says a folder is empty when it holds nothing |
| shows a no-access state without media:read |
| has no accessibility violations |

<!-- source: apps/admin-e2e/src/shell/command-palette.spec.ts -->
_<sub>apps/admin-e2e/src/shell/command-palette.spec.ts</sub>_

## Command palette

| Test case |
| --- |
| suggests nav destinations, workspaces, and content types |
| navigates to a nav destination |
| jumps straight to a workspace content type |
| arrow keys move the announced selection, not just the highlight |
| closing it with Escape gives focus back to the trigger |
| choosing a result does not drag focus back to the sidebar |

## the ⌘K binding

| Test case |
| --- |
| opens the palette from anywhere that is not a text field |
| leaves the caret alone when a page search field has it |
| still toggles the palette closed from inside the palette |

<!-- source: apps/admin-e2e/src/shell/right-panel.spec.ts -->
_<sub>apps/admin-e2e/src/shell/right-panel.spec.ts</sub>_

## the right panel

| Test case |
| --- |
| collapsing it from the keyboard hands focus to the reopen button |
| reopening it from the keyboard hands focus back into the panel |
| a collapse the user never asked for is not persisted as a preference |
| the desktop preference survives a narrow visit |

## the right panel as a narrow-viewport overlay

| Test case |
| --- |
| Escape dismisses it |
| dismissing it with Escape still lands focus somewhere usable |
| the scrim is decoration, not an unreachable control |

<!-- source: apps/admin-e2e/src/users/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/users/a11y.spec.ts</sub>_

## Members accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| table — initial |
| table — loading skeleton |
| invite wizard — details step |
| invite wizard — workspaces step |
| row menu — open |
| empty state — no matches |
| no-access state |

<!-- source: apps/admin-e2e/src/users/account-menu.spec.ts -->
_<sub>apps/admin-e2e/src/users/account-menu.spec.ts</sub>_

## Account menu

| Test case |
| --- |
| shows the signed-in account in the toolbar dropdown |
| "My profile" opens the current user’s detail page |
| falls back to the email when the account has no name |
| Logout calls the logout endpoint |

<!-- source: apps/admin-e2e/src/users/destructive-actions.spec.ts -->
_<sub>apps/admin-e2e/src/users/destructive-actions.spec.ts</sub>_

## Destructive member actions

| Test case |
| --- |
| confirms before revoking an invite, naming the invitee |
| sends nothing when the revoke confirmation is cancelled |
| sends exactly one request when the revoke is confirmed |
| moves focus to a stable anchor after the row is removed |
| keeps focus when revoking the last row empties the table |
| confirms before disabling a member, naming them |
| returns focus to the row’s own kebab when the row survives |
| warns before discarding an uncopied invite link |
| keeps the link on screen when the discard warning is declined |
| closes without a warning once the link has been copied |

<!-- source: apps/admin-e2e/src/users/keyboard.spec.ts -->
_<sub>apps/admin-e2e/src/users/keyboard.spec.ts</sub>_

## Members keyboard operability

| Test case |
| --- |
| search filters as you type |
| the invite wizard opens from the keyboard |
| the row menu opens from the keyboard |

<!-- source: apps/admin-e2e/src/users/members-filter.spec.ts -->
_<sub>apps/admin-e2e/src/users/members-filter.spec.ts</sub>_

## Members filter (query builder)

| Test case |
| --- |
| opens the filter drawer from the toolbar |
| filters the roster by status and deep-links the choice |
| reflects the active condition count on the trigger |
| restores the filter from a deep link on load |
| the open drawer with a rule is accessible (axe) |
| Reset clears the filter and restores the full roster |

<!-- source: apps/admin-e2e/src/users/members.spec.ts -->
_<sub>apps/admin-e2e/src/users/members.spec.ts</sub>_

## Members page

| Test case |
| --- |
| renders the roster with names, emails, and status pills |
| shows the member count in the header subtitle |
| filters the roster by a search term |
| shows an empty state when the search matches nobody |
| a link back to the bare roster clears the search box with it |
| invites a member through the three-step wizard |
| assigns all workspaces via the "All workspaces" mode |
| searches the workspaces in the assignment step |
| keeps Continue disabled (no request) for an invalid email |
| paginates with a selectable page size |
| shows status-specific actions for a pending invite |
| the row menu mirrors the detail sections |
| offers Enable (not Disable) for a disabled member |
| renders the role as a read-only chip |
| hides write controls without the matching permission |
| shows a no-access state without users:read |
| hands over the rotated link when an invite is resent |

<!-- source: apps/admin-e2e/src/users/preferences.spec.ts -->
_<sub>apps/admin-e2e/src/users/preferences.spec.ts</sub>_

## User preferences (theme)

| Test case |
| --- |
| shows the Preferences tab only on your own profile |
| redirects a deep link to someone else’s preferences |
| selecting a theme applies it and saves it (PUT /api/preferences) |
| does not re-save the theme already in effect |
| hydrates the saved theme app-wide on load |
| the theme picker has no accessibility violations |
| the dark theme has no accessibility violations |
| applies the saved theme on a route that overrides the sidebar |

<!-- source: apps/admin-e2e/src/users/roles.spec.ts -->
_<sub>apps/admin-e2e/src/users/roles.spec.ts</sub>_

## Role tab guardrails

| Test case |
| --- |
| locks your own role with the reason, rather than 409-ing |
| locks the sole active admin with the reason |
| shows a custom role by its server name and refuses to guess |
| lets an ordinary member’s role be changed behind a confirm |

<!-- source: apps/admin-e2e/src/users/user-detail.spec.ts -->
_<sub>apps/admin-e2e/src/users/user-detail.spec.ts</sub>_

## User detail page

| Test case |
| --- |
| renders the member hero and the General tab by default |
| opens when the member row is clicked |
| opens a specific tab from the row menu |
| navigates between tabs via the side rail |
| edits the display name (PATCH /api/users/:id) |
| revokes a session from the Sessions tab |
| names the device in each session control and in its confirm dialog |
| renders the activity timeline with per-action entries |
| names every kind the member touched, not just the user.* ones |
| shows workspace membership events in the personal log |
| hides audit and access tabs without users:update |

<!-- source: apps/admin-e2e/src/workspaces/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/a11y.spec.ts</sub>_

## Workspaces accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| table — initial (active) |
| table — loading skeleton |
| table — all statuses (archived rows visible) |
| empty state — no matches |
| sidebar quick-list — collapsed |
| sidebar quick-list — empty but creatable |
| sidebar quick-list — list still loading |
| workspace switcher popover — a scrolling list of 30 |

### create wizard

| Test case |
| --- |
| basics step |
| basics step — slug validation error visible |
| members step |
| members step — directory results open |
| content step |

<!-- source: apps/admin-e2e/src/workspaces/keyboard.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/keyboard.spec.ts</sub>_

## Workspaces keyboard accessibility

| Test case |
| --- |
| search is reachable and filters by keyboard |
| a row opens on Enter |
| the status filter chips move with arrow keys |
| the sidebar Workspaces group folds and unfolds from the keyboard |
| the group "+" is its own tab stop after the collapse trigger |

### create wizard

| Test case |
| --- |
| opens the wizard from the list on Enter |
| a color swatch is selectable by keyboard |
| the color swatches are one tab stop and move with arrow keys |
| the members typeahead is driven from the input by arrow keys |
| a step change moves focus to the new step heading |

<!-- source: apps/admin-e2e/src/workspaces/permissions.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/permissions.spec.ts</sub>_

## Workspaces create permission

| Test case |
| --- |
| shows "New workspace" to a user with workspaces:create |
| hides "New workspace" from a user without the permission |
| redirects /workspaces/new to the list without the permission |

<!-- source: apps/admin-e2e/src/workspaces/regressions.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/regressions.spec.ts</sub>_

## workspaces-admin regressions

### a failed slug check must not read as available

| Test case |
| --- |
| reports the check failed and keeps Continue disabled |

### the basics gate holds on state, not just on transitions

| Test case |
| --- |
| deep-linking ?step=3 falls back to Basics instead of offering Create |
| reloading mid-wizard returns to Basics rather than a dead end |

### a duplicate slug reports as a conflict, not a retryable error

| Test case |
| --- |
| names the slug as the problem instead of "please try again" |

### a name the server accepts stays editable

| Test case |
| --- |
| a 110-character name does not lock the General tab |

### the sidebar reflects a rename immediately

| Test case |
| --- |
| the workspace switcher picks up the new name without navigating away |

### monogram initials are code-point safe

| Test case |
| --- |
| an emoji-led name renders a whole character, not half a surrogate pair |

<!-- source: apps/admin-e2e/src/workspaces/settings.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/settings.spec.ts</sub>_

## Workspace settings page

### as an admin

| Test case |
| --- |
| renders the section nav and the current general values |
| copies the workspace id from the general tab |
| saves an edited name (save enables only when dirty) |
| assigns an unassigned member and removes an existing one |
| grants a content type and revokes an empty one |
| blocks revoking a content type that still has entries |
| archives the workspace from the danger zone |
| deletes the workspace and returns to the grid |

### delete guard (workspace still has content)

| Test case |
| --- |
| blocks deleting until all content is removed |

### as a viewer (read-only)

| Test case |
| --- |
| hides edit controls and the danger tab |

### accessibility

| Test case |
| --- |
| the settings page has no automatically-detectable a11y violations |

<!-- source: apps/admin-e2e/src/workspaces/workspaces.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/workspaces.spec.ts</sub>_

## Workspaces page

| Test case |
| --- |
| renders the active workspaces by default behind the shell |
| search narrows the table and updates the count |
| the status filter switches to archived and marks the chip active |
| the status filter can show all workspaces |
| shows a contextual empty state when nothing matches |
| a row shows the workspace member and type counts |
| a row opens its workspace on click |
| a workspace the user is not a member of shows a no-access screen |

### sidebar Workspaces section

| Test case |
| --- |
| ships expanded, listing the active workspaces |
| collapses and expands from the heading, flipping aria-expanded |
| stays a plain heading when there is nothing to reveal |
| the "+" action still opens the wizard, collapsed or not |

### workspace switcher popover

| Test case |
| --- |
| scrolls its list while the heading and create action stay put |
| clips a long workspace name instead of widening the popover |

### create wizard

| Test case |
| --- |
| creates a workspace and shows it in the grid |
| keeps Continue disabled until the basics are valid |
| returns to the list via "Back to workspaces" |
| lets the owner pick an accent color |
