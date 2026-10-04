/**
 * A content type as the schema rules see it: plain data. The DSL builds one
 * from its field specs (thunks resolved to names), the schema builder from its
 * document — neither Drizzle nor React reaches the rules.
 */
export interface RuleRelation {
    /** The target type's machine name. */
    readonly to: string;
    readonly many: boolean;
    readonly unique: boolean;
    readonly onDelete: 'cascade' | 'set null' | 'restrict';
    readonly syncAcrossLocales: boolean;
    /** Present on a back-reference: the owning field on `to`. */
    readonly inverse?: { readonly field: string };
}

export interface RuleField {
    readonly type: string;
    readonly required: boolean;
    readonly localized?: boolean;
    readonly lang?: string;
    readonly pattern?: string;
    readonly accept?: { readonly kinds?: readonly string[] };
    /** `admin.width` / `admin.group` as declared — unknown values are the point. */
    readonly width?: unknown;
    readonly group?: unknown;
    readonly relation?: RuleRelation;
}

export interface RuleGroup {
    readonly label?: unknown;
}

export interface RuleType {
    readonly name: string;
    readonly kind: 'collection' | 'single';
    readonly path?: string;
    readonly i18n: boolean;
    /** Declaration order matters: the first broken field is the one reported. */
    readonly fields: Readonly<Record<string, RuleField>>;
    readonly groups?: Readonly<Record<string, RuleGroup>>;
}
