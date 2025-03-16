// Password strength analyzer utility

// Entropy calculation based on character sets and length
const calculateEntropy = (password) => {
  // Define character sets
  const charSets = {
    lowercase: /[a-z]/,
    uppercase: /[A-Z]/,
    numbers: /[0-9]/,
    symbols: /[^a-zA-Z0-9]/
  };
  
  // Calculate pool size based on character sets used
  let poolSize = 0;
  if (charSets.lowercase.test(password)) poolSize += 26;
  if (charSets.uppercase.test(password)) poolSize += 26;
  if (charSets.numbers.test(password)) poolSize += 10;
  if (charSets.symbols.test(password)) poolSize += 33; // Approximate for common symbols
  
  // Calculate entropy: log2(poolSize^length)
  // This is equivalent to length * log2(poolSize)
  const entropy = Math.log2(poolSize) * password.length;
  
  return entropy;
};

// Check if password contains sequential characters
const hasSequentialChars = (password) => {
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm'
  ];
  
  for (const seq of sequences) {
    for (let i = 0; i < seq.length - 2; i++) {
      const pattern = seq.substring(i, i + 3);
      if (password.includes(pattern)) {
        return true;
      }
    }
  }
  
  return false;
};

// Check if password contains repeated characters
const hasRepeatedChars = (password) => {
  for (let i = 0; i < password.length - 2; i++) {
    if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
      return true;
    }
  }
  return false;
};

// Analyze password strength
const analyzePassword = (password) => {
  if (!password) {
    return {
      score: 0,
      strength: 'Very Weak',
      entropy: 0,
      feedback: ['Password is empty']
    };
  }
  
  // Calculate base entropy
  const entropy = calculateEntropy(password);
  
  // Initialize feedback array
  const feedback = [];
  
  // Check password length
  if (password.length < 8) {
    feedback.push('Password is too short (minimum 8 characters)');
  } else if (password.length >= 16) {
    feedback.push('Good password length');
  }
  
  // Check character variety
  if (!/[a-z]/.test(password)) {
    feedback.push('Add lowercase letters');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add uppercase letters');
  }
  if (!/[0-9]/.test(password)) {
    feedback.push('Add numbers');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Add special characters');
  }
  
  // Check for sequential characters
  if (hasSequentialChars(password)) {
    feedback.push('Avoid sequential characters (abc, 123, etc.)');
  }
  
  // Check for repeated characters
  if (hasRepeatedChars(password)) {
    feedback.push('Avoid repeated characters (aaa, 111, etc.)');
  }
  
  // Common password patterns
  if (/^[A-Z][a-z]+[0-9]{1,2}$/.test(password)) {
    feedback.push('Avoid common patterns (Capitalized word followed by numbers)');
  }
  
  // Check for common password substitutions
  if (/[0-9]/.test(password)) {
    const substitutions = {
      a: '4',
      e: '3',
      i: '1',
      o: '0',
      s: '5',
      t: '7'
    };
    
    let hasSimpleSubstitution = false;
    for (const [letter, num] of Object.entries(substitutions)) {
      if (password.includes(num) && !password.includes(letter)) {
        hasSimpleSubstitution = true;
        break;
      }
    }
    
    if (hasSimpleSubstitution) {
      feedback.push('Simple letter-to-number substitutions are predictable');
    }
  }
  
  // Determine score and strength based on entropy
  let score, strength;
  
  if (entropy < 28) {
    score = 1;
    strength = 'Very Weak';
    if (feedback.length === 0) {
      feedback.push('Password is too simple');
    }
  } else if (entropy < 36) {
    score = 2;
    strength = 'Weak';
    if (feedback.length === 0) {
      feedback.push('Password needs improvement');
    }
  } else if (entropy < 60) {
    score = 3;
    strength = 'Moderate';
    if (feedback.length === 0 || (feedback.length === 1 && feedback[0].startsWith('Good'))) {
      feedback.push('Password is decent but could be stronger');
    }
  } else if (entropy < 80) {
    score = 4;
    strength = 'Strong';
    if (feedback.length === 0 || (feedback.length === 1 && feedback[0].startsWith('Good'))) {
      feedback.push('Password is strong');
    }
  } else {
    score = 5;
    strength = 'Very Strong';
    if (feedback.length === 0 || (feedback.length === 1 && feedback[0].startsWith('Good'))) {
      feedback.push('Password is very strong');
    }
  }
  
  // Apply penalties for common issues
  if (hasSequentialChars(password) || hasRepeatedChars(password)) {
    score = Math.max(1, score - 1);
  }
  
  return {
    score,         // 1-5 score
    strength,      // Text representation of strength
    entropy,       // Calculated entropy value
    feedback       // Array of feedback messages
  };
};

// Check if password is in common password list
// This would be more comprehensive in a real implementation
const isCommonPassword = (password) => {
  const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty', 'admin',
    'welcome', 'football', 'letmein', 'monkey', 'abc123', '111111',
    'baseball', 'dragon', 'master', 'sunshine', 'ashley', 'bailey',
    'passw0rd', 'shadow', '123123', 'superman', 'qazwsx', 'trustno1',
    'princess', '12345', '12345678', '123456789', '1234567890'
  ];
  
  return commonPasswords.includes(password.toLowerCase());
};

// Estimate time to crack based on entropy
const estimateCrackTime = (password) => {
  const entropy = calculateEntropy(password);
  
  // Average guesses needed is 2^(entropy-1)
  const avgGuesses = Math.pow(2, entropy - 1);
  
  // Guessing speeds for different attack scenarios (guesses per second)
  const speeds = {
    onlineThrottled: 1,                // Online attack with throttling
    onlineUnthrottled: 100,            // Online attack without throttling
    offlineSimple: 1e6,                // Simple offline attack
    offlineFast: 1e10,                 // Fast offline attack (GPU)
    offlineVeryFast: 1e12              // Very fast offline attack (specialized hardware)
  };
  
  // Calculate time in seconds for each scenario
  const times = {};
  for (const [scenario, speed] of Object.entries(speeds)) {
    times[scenario] = avgGuesses / speed;
  }
  
  return {
    entropy,
    times
  };
};

// Format time in a human-readable way
const formatCrackTime = (seconds) => {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)} minutes`;
  } else if (seconds < 86400) {
    return `${Math.round(seconds / 3600)} hours`;
  } else if (seconds < 31536000) {
    return `${Math.round(seconds / 86400)} days`;
  } else if (seconds < 315360000) { // 10 years
    return `${Math.round(seconds / 31536000)} years`;
  } else if (seconds < 3153600000) { // 100 years
    return `${Math.round(seconds / 31536000)} years`;
  } else {
    // For very large numbers, use scientific notation
    const years = seconds / 31536000;
    if (years < 1e6) {
      return `${Math.round(years).toLocaleString()} years`;
    } else {
      return `${years.toExponential(2)} years`;
    }
  }
};

// Comprehensive password evaluation
const evaluatePassword = (password) => {
  // Basic analysis
  const analysis = analyzePassword(password);
  
  // Check if it's a common password
  const isCommon = isCommonPassword(password);
  if (isCommon) {
    analysis.score = 1;
    analysis.strength = 'Very Weak';
    analysis.feedback.unshift('This is a commonly used password');
  }
  
  // Estimate crack time
  const crackTimeData = estimateCrackTime(password);
  
  // Format crack times
  const formattedCrackTimes = {};
  for (const [scenario, seconds] of Object.entries(crackTimeData.times)) {
    formattedCrackTimes[scenario] = formatCrackTime(seconds);
  }
  
  return {
    ...analysis,
    isCommonPassword: isCommon,
    crackTimes: formattedCrackTimes
  };
};

module.exports = {
  analyzePassword,
  evaluatePassword,
  isCommonPassword,
  estimateCrackTime,
  formatCrackTime
};