import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines multiple class names into a single string, handling conflicts with Tailwind CSS
 * @param {...string} inputs - Class names to combine
 * @returns {string} - Combined class names
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Clears the clipboard after a specified delay
 * @param {number} delay - Time in milliseconds before clearing the clipboard
 */
export const clearClipboardAfterDelay = (delay = 10000) => {
  setTimeout(() => {
    navigator.clipboard.writeText('');
    console.log('Clipboard cleared for security');
  }, delay);
};

/**
 * Formats a date string to a human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

/**
 * Generates a password based on the provided options
 * @param {object} options - Password generation options
 * @returns {string} - Generated password
 */
export const generatePassword = (options = {}) => {
  const length = options.length || 16;
  const useUppercase = options.useUppercase !== false;
  const useNumbers = options.useNumbers !== false;
  const useSpecial = options.useSpecial !== false;
  
  let charset = 'abcdefghijklmnopqrstuvwxyz';
  if (useUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (useNumbers) charset += '0123456789';
  if (useSpecial) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  return password;
};