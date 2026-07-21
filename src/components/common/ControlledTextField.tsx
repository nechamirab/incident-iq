import type { ReactNode } from 'react';
import { TextField, type TextFieldProps } from '@mui/material';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

interface ControlledTextFieldProps<TFieldValues extends FieldValues>
  extends Omit<
    TextFieldProps,
    'name' | 'value' | 'onChange' | 'onBlur' | 'error' | 'helperText' | 'defaultValue'
  > {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  helperText?: ReactNode;
}

/**
 * A MUI `TextField` bound to a React Hook Form field via `useController`,
 * i.e. a fully *controlled* component.
 *
 * `register()` binds a field uncontrolled: React Hook Form writes
 * programmatic updates (`reset()`, `setValue()`) straight to the DOM input
 * through a ref, bypassing React's render cycle entirely. MUI's
 * `InputLabel` only shrinks in response to an observed value -- via the
 * `value`/`defaultValue` prop at render time, or a real `input` event -- so
 * a ref-written value it never "sees" leaves the label overlapping the
 * text. Binding through `useController` keeps `value` as a live prop, so
 * MUI re-renders correctly on every programmatic update, not just on user
 * keystrokes.
 */
export function ControlledTextField<TFieldValues extends FieldValues>({
  name,
  control,
  helperText,
  ...textFieldProps
}: ControlledTextFieldProps<TFieldValues>): ReactNode {
  const { field, fieldState } = useController({ name, control });

  return (
    <TextField
      {...textFieldProps}
      {...field}
      error={Boolean(fieldState.error)}
      helperText={fieldState.error?.message ?? helperText}
    />
  );
}
