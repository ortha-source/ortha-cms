/**
 * A select's or a multiselect's options with the default that names them.
 * The default is a value, not a position — `string` on a select, `string[]`
 * on a multiselect — so an edit to an option has to carry it along.
 */
export type OptionsField = {
    readonly options: readonly string[];
    readonly defaultValue?: unknown;
};

/** The spec patch an option edit makes: the options, and the default when it moves. */
export type OptionsPatch = {
    options: string[];
    defaultValue?: unknown;
};

/** The default with every `from` replaced by `to` (`undefined` drops it). */
function retarget(
    defaultValue: unknown,
    from: string,
    to: string | undefined
): unknown {
    if (Array.isArray(defaultValue))
        return defaultValue.flatMap((value) =>
            value === from ? (to === undefined ? [] : [to]) : [value]
        );
    return defaultValue === from ? to : defaultValue;
}

function patch(
    field: OptionsField,
    options: string[],
    from: string,
    to: string | undefined
): OptionsPatch {
    const named =
        field.defaultValue === from ||
        (Array.isArray(field.defaultValue) &&
            field.defaultValue.includes(from));
    return named
        ? { options, defaultValue: retarget(field.defaultValue, from, to) }
        : { options };
}

/** Option `index` typed over: a default naming it follows the new value. */
export function renameOption(
    field: OptionsField,
    index: number,
    value: string
): OptionsPatch {
    const options = field.options.map((option, at) =>
        at === index ? value : option
    );
    return patch(field, options, field.options[index], value);
}

/** Option `index` removed: a default naming it no longer does. */
export function removeOption(field: OptionsField, index: number): OptionsPatch {
    const options = field.options.filter((_, at) => at !== index);
    return patch(field, options, field.options[index], undefined);
}

/** `value` added last, unless it is empty or already an option (`null`). */
export function addOption(
    field: OptionsField,
    value: string
): OptionsPatch | null {
    const option = value.trim();
    if (!option || field.options.includes(option)) return null;
    return { options: [...field.options, option] };
}
