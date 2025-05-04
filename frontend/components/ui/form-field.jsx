// frontend/components/ui/form-field.jsx
"use client";

import { useId } from 'react';
import { ErrorMessage } from './error-message';

/**
 * Accessible form field wrapper component
 * 
 * @param {Object} props - Component props
 * @param {string} props.label - Field label
 * @param {React.ReactNode} props.children - Form control (input, select, etc.)
 * @param {string} props.error - Error message
 * @param {string} props.helpText - Help text for the field
 * @param {boolean} props.required - Whether the field is required
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.errorHelpText - Help text for resolving the error
 * @param {React.ReactNode} props.errorAction - Action for the error message
 * @returns {React.ReactElement}
 */
export function FormField({
  label,
  children,
  error,
  helpText,
  required = false,
  className = "",
  errorHelpText,
  errorAction,
  ...props
}) {
  const id = useId();
  const helpId = useId();
  const errorId = useId();
  
  // Clone the child element to add accessibility attributes
  const enhancedChild = React.cloneElement(children, {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [
      helpText ? helpId : null,
      error ? errorId : null
    ].filter(Boolean).join(' ') || undefined,
    'aria-required': required || undefined,
  });
  
  return (
    <div className={`space-y-2 ${className}`} {...props}>
      <div className="flex justify-between items-baseline">
        <label 
          htmlFor={id} 
          className="block text-sm font-medium"
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          )}
        </label>
      </div>
      
      {enhancedChild}
      
      {helpText && !error && (
        <p 
          id={helpId} 
          className="text-xs text-gray-500"
        >
          {helpText}
        </p>
      )}
      
      {error && (
        <ErrorMessage
          id={errorId}
          message={error}
          fieldId={id}
          helpText={errorHelpText}
          action={errorAction}
          size="sm"
        />
      )}
    </div>
  );
}
