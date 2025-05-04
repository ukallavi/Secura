// frontend/components/ui/error-message.jsx
"use client";

import { useId } from 'react';
import { AlertCircle, HelpCircle, XCircle } from 'lucide-react';
import { cva } from 'class-variance-authority';

const errorVariants = cva(
  "flex items-start gap-2 text-sm rounded-md p-2.5", 
  {
    variants: {
      variant: {
        default: "bg-red-50 text-red-700 border border-red-200",
        warning: "bg-amber-50 text-amber-700 border border-amber-200",
        info: "bg-blue-50 text-blue-700 border border-blue-200",
      },
      size: {
        default: "text-sm",
        sm: "text-xs p-1.5",
        lg: "text-base p-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const iconMap = {
  default: XCircle,
  warning: AlertCircle,
  info: HelpCircle,
};

/**
 * Accessible error message component
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Error message to display
 * @param {string} props.fieldId - ID of the field this error is associated with
 * @param {string} props.variant - Visual variant (default, warning, info)
 * @param {string} props.size - Size variant (default, sm, lg)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.helpText - Optional help text for resolving the error
 * @param {React.ReactNode} props.action - Optional action component (button, link)
 * @param {Function} props.onDismiss - Optional callback when dismissed
 * @returns {React.ReactElement}
 */
export function ErrorMessage({
  message,
  fieldId,
  variant = "default",
  size = "default",
  className = "",
  helpText,
  action,
  onDismiss,
  ...props
}) {
  const errorId = useId();
  const helpId = useId();
  const Icon = iconMap[variant] || iconMap.default;
  
  return (
    <div
      id={errorId}
      role="alert"
      aria-live="assertive"
      className={errorVariants({ variant, size, className })}
      {...(fieldId && { 'aria-describedby': fieldId })}
      {...props}
    >
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      
      <div className="flex-1">
        <p>{message}</p>
        
        {helpText && (
          <p id={helpId} className="mt-1 text-xs opacity-90">
            {helpText}
          </p>
        )}
        
        {action && (
          <div className="mt-2">
            {action}
          </div>
        )}
      </div>
      
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 rounded-full p-1 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label="Dismiss error"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
