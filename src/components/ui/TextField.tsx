import { InputHTMLAttributes, useId } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

/** Labeled, accessible input with inline error messaging. Consolidates the
 *  repeated input class string and wires label/error to the field for screen
 *  readers (aria-invalid, aria-describedby). */
export default function TextField({ label, error, hint, id, className = '', ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition ${error ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-gray-400'} ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-red-500 mt-1">{error}</p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-gray-400 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
