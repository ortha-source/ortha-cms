/**
 * Refuses a commit whose message carries no `Signed-off-by` line.
 *
 * The line is the contributor's certification of the Developer Certificate
 * of Origin (`DCO` at the repository root). Git writes it for you with
 * `git commit -s`; this hook only checks that it is there, so the
 * requirement is met at commit time rather than discovered in review.
 *
 * Merge commits and fixups are exempt: git authors those itself, and a
 * squash of signed commits carries the sign-offs in its body already.
 *
 * Usage (from lefthook's commit-msg hook): node tools/hooks/require-signoff.mjs <message-file>
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
    console.error('usage: require-signoff.mjs <commit-message-file>');
    process.exit(2);
}

const message = readFileSync(file, 'utf8');
const subject =
    message.split('\n').find((line) => line.trim() && !line.startsWith('#')) ??
    '';

/*
 * Merges, fixups and reverts are git's own; a `chore(release):` commit is
 * `nx release`'s, written unattended in CI where nobody can sign it. None of
 * them carries a contribution, so none of them needs the certification.
 */
const exempt = /^(Merge |fixup! |squash! |Revert "|chore\(release\):)/.test(
    subject
);
const signed = /^Signed-off-by: .+ <.+@.+>$/m.test(message);

if (!exempt && !signed) {
    console.error(
        'This commit has no Signed-off-by line.\n' +
            '\n' +
            'Every commit certifies the Developer Certificate of Origin (see DCO).\n' +
            'Add the line with `git commit -s`, or to the commit you just wrote:\n' +
            '\n' +
            '    git commit --amend -s --no-edit\n'
    );
    process.exit(1);
}
