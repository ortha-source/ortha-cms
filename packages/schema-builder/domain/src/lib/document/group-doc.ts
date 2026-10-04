/** One accordion group on the entry form's General tab (`groups` on the type). */
export interface GroupDoc {
    key: string;
    label: string;
    description?: string;
    collapsed?: boolean;
}
