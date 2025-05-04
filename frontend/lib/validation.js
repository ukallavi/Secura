// frontend/lib/validation.js

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password validation regex (at least 8 characters, one uppercase, one lowercase, one number)
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;

// Password strength validation
const passwordStrengthRegex = {
  weak: /^.{0,7}$/,
  medium: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/,
  strong: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[a-zA-Z\d!@#$%^&*]{8,}$/,
  veryStrong: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[a-zA-Z\d!@#$%^&*]{12,}$/
};

export function validateEmail(email) {
  return emailRegex.test(email);
}

export function validatePassword(password) {
  return passwordRegex.test(password);
}

export function validatePasswordStrength(password) {
  if (passwordStrengthRegex.veryStrong.test(password)) {
    return 'veryStrong';
  } else if (passwordStrengthRegex.strong.test(password)) {
    return 'strong';
  } else if (passwordStrengthRegex.medium.test(password)) {
    return 'medium';
  } else {
    return 'weak';
  }
}

// Form validation functions
export const validateLoginForm = (formData) => {
  const errors = {};
  
  if (!formData.email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(formData.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  if (!formData.password) {
    errors.password = 'Password is required';
  }
  
  return errors;
};

export const validateRegistrationForm = (formData) => {
  const errors = {};
  
  if (!formData.email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(formData.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  if (!formData.password) {
    errors.password = 'Password is required';
  } else if (!validatePassword(formData.password)) {
    errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and numbers';
  }
  
  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  
  return errors;
};

export const validatePasswordChangeForm = (formData) => {
  const errors = {};
  
  if (!formData.currentPassword) {
    errors.currentPassword = 'Current password is required';
  }
  
  if (!formData.newPassword) {
    errors.newPassword = 'New password is required';
  } else if (!validatePassword(formData.newPassword)) {
    errors.newPassword = 'Password must be at least 8 characters with uppercase, lowercase, and numbers';
  }
  
  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password';
  } else if (formData.newPassword !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  
  return errors;
};

export const validatePasswordForm = (formData) => {
  const errors = {};
  
  if (!formData.accountName) {
    errors.accountName = 'Account name is required';
  }
  
  if (!formData.password) {
    errors.password = 'Password is required';
  }
  
  return errors;
};