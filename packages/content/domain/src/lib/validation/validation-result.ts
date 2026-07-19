/** The result types the pure field-value validator returns. */

/** One failed rule on one field. */
export interface ValidationIssue {
    field: string;
    message: string;
}

/** Result of validating a values object. */
export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
}
