# Admin E2E test catalog

> **Generated file — do not edit by hand.** Regenerate with
> `npx nx catalog admin-e2e`. CI runs `npx nx catalog:check admin-e2e`
> and fails if this file has drifted from the specs.

_289 test cases across 31 spec files._

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

## Activity Log accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| table — initial |
| table — expanded row |
| table — loading skeleton |
| empty state — no matches |
| no-access state |

## Activity Log keyboard operability

| Test case |
| --- |
| the actor-email search filters as you type |
| a row expands from the keyboard |

<!-- source: apps/admin-e2e/src/auth/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/auth/a11y.spec.ts</sub>_

## accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| login page — initial |
| login page — required-field errors visible |
| login page — credential-error banner visible |
| home page |
| root loader — auth probe pending |

<!-- source: apps/admin-e2e/src/auth/keyboard.spec.ts -->
_<sub>apps/admin-e2e/src/auth/keyboard.spec.ts</sub>_

## keyboard accessibility

| Test case |
| --- |
| the email field is the first focus stop |
| login can be completed and submitted by keyboard alone |

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

### pending state

| Test case |
| --- |
| disables the submit button while the request is in flight |

<!-- source: apps/admin-e2e/src/auth/private-routes.spec.ts -->
_<sub>apps/admin-e2e/src/auth/private-routes.spec.ts</sub>_

## Private route gating

| Test case |
| --- |
| redirects a signed-out user from / to the sign-in page |
| redirects a signed-out user from an unknown path to the sign-in page |
| returns to the home page after a gated user signs in |

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

<!-- source: apps/admin-e2e/src/content/entry-revisions.spec.ts -->
_<sub>apps/admin-e2e/src/content/entry-revisions.spec.ts</sub>_

## Entry revision history

| Test case |
| --- |
| saving a draft keeps the published version live |
| publishing a version from history makes it live |

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
| marks a relation whose target collection is localized |
| switching locale plays a brief "Switching…" overlay |
| the Locales column shows per-group locale badges |
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

<!-- source: apps/admin-e2e/src/content/wysiwyg-field.spec.ts -->
_<sub>apps/admin-e2e/src/content/wysiwyg-field.spec.ts</sub>_

## Entry editor — wysiwyg field

| Test case |
| --- |
| shows a preview in the form until it is opened |
| takes over the work area, hiding the other fields but not the chrome |
| commits what is typed and saves it as HTML |
| turns a markdown shortcut into a real block |
| names the preview after the document’s own first heading |
| inserts a block from the slash menu |
| Shift+Enter breaks the line inside the block, even with the slash menu up |
| Escape closes the slash menu before it closes the editor |

### multi-block selection

| Test case |
| --- |
| drag-selects a run and marks every block in it |
| deletes the whole selection with one Backspace |
| ⌘A selects every block, Escape drops the selection |
| turns a whole selection into another block type |

### alignment, colour and size

| Test case |
| --- |
| aligns a block, and clears it back to nothing |
| aligns every block in a selection at once |
| aligns from the keyboard |
| colours a run of text, and takes the colour back off |
| highlights a run as a <mark> |
| inline code survives a save with no typing after it |
| centres the picture itself, not just its caption |
| links through the toolbar’s own popover, and unlinks again |
| takes a custom colour, stored as hex |
| names every toolbar control on hover |
| sizes an image and centres it |
| resizes an image by dragging its grip, replacing the preset |

### column layouts

| Test case |
| --- |
| rules the boundary between columns |
| the block controls can be reached and pressed inside a column |

### tables

| Test case |
| --- |
| inserts a table and types across it with Tab |
| Enter inside a cell breaks the line instead of splitting the block |
| Shift+Enter breaks the line inside a cell |
| adds a column and removes a row from the handles |
| the header row is a thead, and the toggle takes it away |
| centres the table without centring what is in it |
| aligns a column, and stands it on the bottom of its cells |
| a column grip never reaches into the column beside it |
| the last column has no grip — its edge is the table’s |
| resizes a column by dragging its grip |

### the image block

| Test case |
| --- |
| fills an image from the media library |
| keeps alt text the author wrote over an asset that carries none |

| Test case |
| --- |
| rejects a document whose text is over the field’s limit |
| is reachable and operable from the keyboard alone |

### accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| the expanded editor |
| with the slash menu open |
| with a table in the document |

<!-- source: apps/admin-e2e/src/home/dashboard.spec.ts -->
_<sub>apps/admin-e2e/src/home/dashboard.spec.ts</sub>_

## Home dashboard

| Test case |
| --- |
| shows the greeting, stat tiles, and both panels |
| the panels link through to their full pages |

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
| Logout calls the logout endpoint |

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
| renders the activity timeline with per-action entries |
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

### create wizard

| Test case |
| --- |
| basics step |
| basics step — slug validation error visible |

<!-- source: apps/admin-e2e/src/workspaces/keyboard.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/keyboard.spec.ts</sub>_

## Workspaces keyboard accessibility

| Test case |
| --- |
| search is reachable and filters by keyboard |
| a row opens on Enter |
| the status filter chips move with arrow keys |

### create wizard

| Test case |
| --- |
| opens the wizard from the list on Enter |
| a color swatch is selectable by keyboard |

<!-- source: apps/admin-e2e/src/workspaces/permissions.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/permissions.spec.ts</sub>_

## Workspaces create permission

| Test case |
| --- |
| shows "New workspace" to a user with workspaces:create |
| hides "New workspace" from a user without the permission |
| redirects /workspaces/new to the list without the permission |

<!-- source: apps/admin-e2e/src/workspaces/settings.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/settings.spec.ts</sub>_

## Workspace settings page

### as an admin

| Test case |
| --- |
| renders the section nav and the current general values |
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

### create wizard

| Test case |
| --- |
| creates a workspace and shows it in the grid |
| keeps Continue disabled until the basics are valid |
| returns to the list via "Back to workspaces" |
| lets the owner pick an accent color |
