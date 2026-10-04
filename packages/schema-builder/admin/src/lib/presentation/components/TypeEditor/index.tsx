import type {
    BuilderCapabilities,
    TypeDoc
} from '@orthacms/schema-builder-domain';
import { FieldList } from './FieldList';
import { HandWrittenNotice } from './HandWrittenNotice';
import { TypeSummary } from './TypeSummary';

type Props = { type: TypeDoc; capabilities: BuilderCapabilities };

/**
 * The selected type. Read-only for now: its options, then its fields under the
 * built-in tabs. A hand-written type on a server that could edit says why it
 * stays read-only — the page-wide notice covers every other case.
 */
export function TypeEditor({ type, capabilities }: Props) {
    return (
        <div className="flex flex-col gap-4">
            {capabilities.editable && type.origin === 'code' && (
                <HandWrittenNotice type={type} />
            )}
            <TypeSummary type={type} />
            <FieldList type={type} />
        </div>
    );
}
