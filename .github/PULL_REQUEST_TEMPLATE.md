## Summary

<!-- What changed and why. Bullet the user-facing flows and the server endpoints/schema touched. -->

## Test plan

<!-- Automated coverage. Check what you've run; leave CI boxes unchecked until green. -->

- [ ] `nx typecheck` / `nx lint` for the changed projects
- [ ] admin-e2e green in CI (if admin UI changed)
- [ ] server-e2e green in CI (if an endpoint changed)

## Manual testing checklist

<!--
Tailor this to the diff — delete sections that don't apply, add the flows you
actually touched. Keep it concrete: each box should name what to click and what
to expect, not "test the page". Cover, at minimum:

- The happy path for each new/changed flow.
- Edge cases: validation limits, empty/loading/error states (error ≠ empty),
  permission-gated variants (read-only / lower-role users), and any
  count/pagination boundaries after a mutation.
- A dedicated check for every bug this PR fixes — the exact reproduction, now
  passing. Regressions that e2e can't easily cover belong here.
- Accessibility/keyboard: tab order, accessible names, dialog focus trap +
  return, screen-reader announcements (toasts/live regions).

Setup: <!-- prerequisite data/accounts the reviewer needs to reproduce -->
-->

### <Area / flow>
- [ ] …

### Permission gating
- [ ] …

### Accessibility / keyboard
- [ ] …
