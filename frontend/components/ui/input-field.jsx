// frontend/components/ui/input-field.jsx
"use client";

import { forwardRef } from 'react';
import { FormField } from './form-field';
import { Input } from './input';
import { getErrorMessage, getErrorHelpText } from '@/lib/i18n/error-messages';

/**
 * Accessible input field with integrated error handling and i18n support
 * 
 * @param {Object} props - Component props
 * @param {string} props.name - Input name
 * @param {string} props.label - Input label
 * @param {string} props.type - Input type (text, password, email, etc.)
 * @param {string} props.error - Error message or key
 * @param {string} props.helpText - Help text
 * @param {boolean} props.required - Whether the field is required
 * @param {Object} props.i18nParams - Parameters for message interpolation
 * @param {React.ReactNode} props.errorAction - Action component for error
 * @param {Function} props.onFocus - Focus handler
 * @param {Function} props.onBlur - Blur handler
 * @param {string} props.className - Additional CSS classes
 * @returns {React.ReactElement}
 */
const InputField = forwardRef(({
  name,
  label,
  type = 'text',
  error,
  helpText,
  required = false,
  i18nParams = {},
  errorAction,
  onFocus,
  onBlur,
  className = '',
  ...props
}, ref) => {
  // If error is a translation key, translate it
  const translatedError = error && getErrorMessage(error, i18nParams);
  
  // Get help text for error
  const errorHelpText = error && getErrorHelpText(error);
  
  // Handle focus state for accessibility
  const handleFocus = (e) => {
    e.target.parentElement.classList.add('focused');
    if (onFocus) onFocus(e);
  };
  
  const handleBlur = (e) => {
    e.target.parentElement.classList.remove('focused');
    if (onBlur) onBlur(e);
  };
  
  // Generate ID from name for accessibility
  const id = `field-${name}`;
  
  return (
    <FormField
      label={label}
      error={translatedError}
      helpText={helpText}
      required={required}
      errorHelpText={errorHelpText}
      errorAction={errorAction}
      className={className}
    >
      <Input
        id={id}
        name={name}
        type={type}
        ref={ref}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-invalid={!!error}
        aria-required={required}
        className={error ? 'border-red-500' : ''}
        {...props}
      />
    </FormField>
  );
});

InputField.displayName = 'InputField';

export { InputField };
