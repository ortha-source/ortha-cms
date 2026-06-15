import { defineMessages, useIntl } from 'react-intl';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@ortha-cms/design-system';
import type { OpId } from '../../../../../types/filter-tree.type';
import { OP_LABELS } from '../../../../../utils/operators';

const messages = defineMessages({
    label: { id: 'qb.operator.label', defaultMessage: 'Operator' }
});

/** Props for {@link OperatorPicker}. */
export type OperatorPickerProps = {
    /** Operators valid for the current field's type. */
    ops: readonly OpId[];
    value: OpId;
    onChange: (next: OpId) => void;
};

/** Dropdown selector over the operators valid for the current field. */
export function OperatorPicker({ ops, value, onChange }: OperatorPickerProps) {
    const intl = useIntl();
    return (
        <Select value={value} onValueChange={(v) => onChange(v as OpId)}>
            <SelectTrigger
                className="w-full"
                aria-label={intl.formatMessage(messages.label)}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {ops.map((op) => (
                    <SelectItem key={op} value={op}>
                        {intl.formatMessage(OP_LABELS[op])}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
