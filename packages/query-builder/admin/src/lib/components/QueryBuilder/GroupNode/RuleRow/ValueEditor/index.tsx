import { defineMessages, useIntl } from 'react-intl';
import {
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@ortha-cms/design-system';
import {
    FIELD_TYPE,
    type FieldType,
    type FilterField
} from '../../../../../types/filter-field.type';
import {
    OP,
    WITHIN_UNIT,
    type OpId,
    type RuleValue,
    type WithinUnit
} from '../../../../../types/filter-tree.type';
import { CsvValueInput } from './CsvValueInput';

const messages = defineMessages({
    rangeJoin: { id: 'qb.value.rangeJoin', defaultMessage: 'and' },
    value: { id: 'qb.value.label', defaultMessage: 'Value' },
    rangeFrom: { id: 'qb.value.rangeFrom', defaultMessage: 'From' },
    rangeTo: { id: 'qb.value.rangeTo', defaultMessage: 'To' },
    withinAmount: { id: 'qb.value.withinAmount', defaultMessage: 'Amount' },
    withinUnit: { id: 'qb.value.withinUnit', defaultMessage: 'Unit' },
    selectPlaceholder: {
        id: 'qb.value.selectPlaceholder',
        defaultMessage: 'Select…'
    },
    booleanTrue: { id: 'qb.value.booleanTrue', defaultMessage: 'true' },
    booleanFalse: { id: 'qb.value.booleanFalse', defaultMessage: 'false' },
    csvPlaceholder: {
        id: 'qb.value.csvPlaceholder',
        defaultMessage: 'value1,value2'
    },
    minutes: { id: 'qb.value.minutes', defaultMessage: 'minutes' },
    hours: { id: 'qb.value.hours', defaultMessage: 'hours' },
    days: { id: 'qb.value.days', defaultMessage: 'days' }
});

const WITHIN_UNIT_LABELS: Record<WithinUnit, typeof messages.minutes> = {
    [WITHIN_UNIT.Minutes]: messages.minutes,
    [WITHIN_UNIT.Hours]: messages.hours,
    [WITHIN_UNIT.Days]: messages.days
};

/** Props for {@link ValueEditor}. */
export type ValueEditorProps = {
    field: FilterField;
    op: OpId;
    value: RuleValue;
    onChange: (next: RuleValue) => void;
};

const inputTypeFor = (fieldType: FieldType): 'date' | 'number' | 'text' => {
    if (fieldType === FIELD_TYPE.Date) return 'date';
    if (fieldType === FIELD_TYPE.Number) return 'number';
    return 'text';
};

/**
 * Switch-based value editor: picks the right control for the active
 * field/op pair. `is_empty` renders nothing — the operator carries the
 * full meaning. `between` and `within_last` render compound editors;
 * `is_one_of` renders a comma-separated text input (a polished
 * multi-select lands with the async-FK editor later).
 */
export function ValueEditor({ field, op, value, onChange }: ValueEditorProps) {
    const intl = useIntl();

    if (op === OP.IsEmpty) return null;

    if (op === OP.Between) {
        const range = (value as { from: string; to: string }) ?? {
            from: '',
            to: ''
        };
        const inputType = inputTypeFor(field.type);
        return (
            <div className="flex items-center gap-1">
                <Input
                    type={inputType}
                    value={range.from}
                    onChange={(e) =>
                        onChange({ ...range, from: e.target.value })
                    }
                    aria-label={intl.formatMessage(messages.rangeFrom)}
                    className="w-32"
                />
                <span className="text-muted-foreground text-xs">
                    {intl.formatMessage(messages.rangeJoin)}
                </span>
                <Input
                    type={inputType}
                    value={range.to}
                    onChange={(e) => onChange({ ...range, to: e.target.value })}
                    aria-label={intl.formatMessage(messages.rangeTo)}
                    className="w-32"
                />
            </div>
        );
    }

    if (op === OP.WithinLast) {
        const v = (value as { n: number; unit: WithinUnit }) ?? {
            n: 7,
            unit: WITHIN_UNIT.Days
        };
        return (
            <div className="flex items-center gap-1">
                <Input
                    type="number"
                    min={1}
                    value={String(v.n)}
                    onChange={(e) =>
                        onChange({
                            ...v,
                            n: Math.max(1, Number(e.target.value) || 1)
                        })
                    }
                    aria-label={intl.formatMessage(messages.withinAmount)}
                    className="w-20"
                />
                <Select
                    value={v.unit}
                    onValueChange={(unit) =>
                        onChange({ ...v, unit: unit as WithinUnit })
                    }
                >
                    <SelectTrigger
                        className="w-28"
                        aria-label={intl.formatMessage(messages.withinUnit)}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(WITHIN_UNIT).map((unit) => (
                            <SelectItem key={unit} value={unit}>
                                {intl.formatMessage(WITHIN_UNIT_LABELS[unit])}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    }

    if (field.type === FIELD_TYPE.Enum && field.enumValues) {
        if (op === OP.IsOneOf) {
            // Multi-select via comma-separated string for v1; polish
            // (proper multi-select chips) lands with the async-FK
            // editor later.
            return (
                <CsvValueInput
                    value={Array.isArray(value) ? value : []}
                    onChange={onChange}
                    placeholder={intl.formatMessage(messages.csvPlaceholder)}
                    ariaLabel={intl.formatMessage(messages.value)}
                />
            );
        }
        return (
            <Select
                value={typeof value === 'string' ? value : ''}
                onValueChange={(v) => onChange(v)}
            >
                <SelectTrigger
                    className="w-48"
                    aria-label={intl.formatMessage(messages.value)}
                >
                    <SelectValue
                        placeholder={intl.formatMessage(
                            messages.selectPlaceholder
                        )}
                    />
                </SelectTrigger>
                <SelectContent>
                    {field.enumValues.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {intl.formatMessage(opt.label)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (op === OP.IsOneOf) {
        return (
            <CsvValueInput
                value={Array.isArray(value) ? value : []}
                onChange={onChange}
                placeholder={intl.formatMessage(messages.csvPlaceholder)}
                ariaLabel={intl.formatMessage(messages.value)}
            />
        );
    }

    if (field.type === FIELD_TYPE.Boolean) {
        return (
            <Select
                value={typeof value === 'string' ? value : ''}
                onValueChange={(v) => onChange(v)}
            >
                <SelectTrigger
                    className="w-32"
                    aria-label={intl.formatMessage(messages.value)}
                >
                    <SelectValue
                        placeholder={intl.formatMessage(
                            messages.selectPlaceholder
                        )}
                    />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="true">
                        {intl.formatMessage(messages.booleanTrue)}
                    </SelectItem>
                    <SelectItem value="false">
                        {intl.formatMessage(messages.booleanFalse)}
                    </SelectItem>
                </SelectContent>
            </Select>
        );
    }

    return (
        <Input
            type={inputTypeFor(field.type)}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            aria-label={intl.formatMessage(messages.value)}
            className="w-48"
        />
    );
}
