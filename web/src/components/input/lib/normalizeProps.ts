import { InputProps } from "../types";

const componentKeys = [
    'className',
    'title',
    'error',
    'icon',
    'controls',
    'autoHeight',
    'variant'
];

type OmitKeys = "className" | "title" | "error" | "icon" | "controls" | "autoHeight" | "variant";
type NormalizedInputProps = Omit<InputProps, OmitKeys>;

export const normalizeProps = (
    props: Record<string, unknown>
) => {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(props)) {
        if (!componentKeys.includes(key)) {
            normalized[key] = value;
        }
    }

    return normalized as NormalizedInputProps;
};
