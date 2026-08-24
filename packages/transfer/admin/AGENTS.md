# `@orthacms/transfer-admin`

Export and import in the Content Library. Governed by the `admin-plugin`,
`accessibility` and `admin-e2e` skills; what follows is specific to this one.

Contributes **no routes**. Everything it does is an action on content someone is
already looking at, so it lives in the content library's seams:

| Slot                       | Contribution                                  |
| -------------------------- | --------------------------------------------- |
| `ENTRY_MENU_SLOT`          | **Export…** in the editor's ⋯ menu (Extras).  |
| `RECORDS_BULK_ACTION_SLOT` | **Export** in the selection bar's ⋯ menu.     |
| `RECORDS_MENU_SLOT`        | **Import…** in the collection's ⋯ menu.       |

Register it **after** `contentAdminPlugin()`, which declares all three.

## The rules that matter here

**Import belongs to the collection, not the selection.** There is nothing
selected when you import — what arrives is whatever the file holds — so the
selection bar would be a category error. It sits in the collection's ⋯ menu
rather than as a toolbar button of its own because importing is occasional, and
search, columns and filters are used on every visit; they should not give up
width to it. Hidden in the trash view, where the rows are on their way out.

**The export dialog's counts must stay honest.** They come from
`/export/preview`, which runs the *same* graph walk the export runs. If that
ever becomes a cheaper estimate, the toggles stop meaning anything — "include
related records" is the difference between 40 records and 4,000, and the count
is the only warning.

**A format that cannot carry bytes disables the files toggle** rather than
accepting it and ignoring it. `TRANSFER_FORMAT_CAPABILITIES` decides, so the UI
cannot offer a promise the server will not keep.

**Import verdicts go stale.** Changing the file *or* the conflict policy retires
the table — showing one file's verdicts above another file's Import button is
the worst bug this dialog can have.

**A bulk-action overlay dies with the selection.** The selection bar unmounts as
soon as the selection is empty, so `onDone` is called on success, never on open.
The overlay is rendered outside the ⋯ menu for the same reason the entry menu's
is — the menu content unmounts the instant the menu closes, which is exactly
when the export dialog is meant to appear.
