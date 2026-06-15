import { useId } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { X } from 'lucide-react';
import { Button } from '@ortha-cms/design-system';
import type { FilterField } from '../../../../types/filter-field.type';
import { OP, type FilterRule, type OpId } from '../../../../types/filter-tree.type';
import { defaultValueForOp } from '../../../../utils/defaultValueForOp';
import { OPS_FOR_TYPE } from '../../../../utils/operators';
import {
    RULE_VALIDATION,
    validateRule,
    type RuleValidationCode
} from '../../../../utils/validateRule';
import { FieldPicker } from './FieldPicker';
import { OperatorPicker } from './OperatorPicker';
import { ValueEditor } from './ValueEditor';

const messages = defineMessages({
    removeRule: { id: 'qb.row.remove', defaultMessage: 'Remove rule' }
});

const errorMessages = defineMessages({
    value_required: {
        id: 'qb.rule.error.valueRequired',
        defaultMessage: 'Value required'
    },
    not_uuid: {
        id: 'qb.rule.error.notUuid',
        defaultMessage: 'Must be a valid UUID'
    },
    not_number: {
        id: 'qb.rule.error.notNumber',
        defaultMessage: 'Must be a number'
    },
    not_date: {
        id: 'qb.rule.error.notDate',
        defaultMessage: 'Must be a valid date'
    },
    range_required: {
        id: 'qb.rule.error.rangeRequired',
        defaultMessage: 'Both bounds required'
    },
    range_invalid: {
        id: 'qb.rule.error.rangeInvalid',
        defaultMessage: 'One of the bounds is invalid for this field'
    },
    multi_required: {
        id: 'qb.rule.error.multiRequired',
        defaultMessage: 'Add at least one value'
    },
    count_required: {
        id: 'qb.rule.error.countRequired',
        defaultMessage: 'Enter a positive count'
    }
});

const ERROR_BY_CODE: Record<RuleValidationCode, MessageDescriptor> = {
    [RULE_VALIDATION.ValueRequired]: errorMessages.value_required,
    [RULE_VALIDATION.NotUuid]: errorMessages.not_uuid,
    [RULE_VALIDATION.NotNumber]: errorMessages.not_number,
    [RULE_VALIDATION.NotDate]: errorMessages.not_date,
    [RULE_VALIDATION.RangeRequired]: errorMessages.range_required,
    [RULE_VALIDATION.RangeInvalid]: errorMessages.range_invalid,
    [RULE_VALIDATION.MultiRequired]: errorMessages.multi_required,
    [RULE_VALIDATION.CountRequired]: errorMessages.count_required
};

/** Props for {@link RuleRow}. */
export type RuleRowProps = {
    rule: FilterRule;
    fields: readonly FilterField[];
    onUpdate: (patch: Partial<FilterRule>) => void;
    onRemove: () => void;
    /** When true, render the inline error message under the row if invalid. */
    showErrors?: boolean;
};

/**
 * One field/op/value rule. Changing the field auto-resets `op` to the
 * first valid operator for the new field type and seeds a value matching
 * the op's expected shape (via {@link defaultValueForOp}); changing the
 * op reseeds the value the same way. Both invariants mean a rule never
 * sits in an "op valid on the previous type but not this one" state
 * that would 400 at the BE.
 */
export function RuleRow({
    rule,
    fields,
    onUpdate,
    onRemove,
    showErrors = false
}: RuleRowProps) {
    const intl = useIntl();
    const field = fields.find((f) => f.id === rule.fieldId) ?? fields[0];
    const ops = OPS_FOR_TYPE[field.type];
    const errorCode = showErrors ? validateRule(rule, field) : null;
    const errorId = useId();

    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[7rem] flex-1 basis-0">
                    <FieldPicker
                        fields={fields}
                        value={rule.fieldId}
                        onChange={(fieldId) => {
                            const nextField = fields.find(
                                (f) => f.id === fieldId
                            );
                            if (!nextField) return;
                            const nextOp = OPS_FOR_TYPE[nextField.type][0];
                            onUpdate({
                                fieldId,
                                op: nextOp,
                                value: defaultValueForOp(nextOp)
                            });
                        }}
                    />
                </div>
                <div className="min-w-[7rem] flex-1 basis-0">
                    <OperatorPicker
                        ops={ops}
                        value={rule.op}
                        onChange={(op: OpId) =>
                            onUpdate({ op, value: defaultValueForOp(op) })
                        }
                    />
                </div>
                {rule.op !== OP.IsEmpty && (
                    <div className="min-w-[8rem] flex-[1.5] basis-0">
                        <ValueEditor
                            field={field}
                            op={rule.op}
                            value={rule.value}
                            onChange={(value) => onUpdate({ value })}
                            invalid={errorCode !== null}
                            describedById={errorCode ? errorId : undefined}
                        />
                    </div>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={intl.formatMessage(messages.removeRule)}
                    onClick={onRemove}
                    className="size-7 shrink-0"
                >
                    <X aria-hidden className="size-3.5" />
                </Button>
            </div>
            {errorCode && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-destructive text-xs pl-1"
                    data-testid="qb-rule-error"
                >
                    {intl.formatMessage(ERROR_BY_CODE[errorCode])}
                </p>
            )}
        </div>
    );
}
