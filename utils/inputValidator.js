// Validation rules
const validators = {
  required: (value) => {
    return value !== null && value !== undefined && value.trim() !== '';
  },
  
  minLength: (value, min) => {
    return value && value.length >= min;
  },
  
  maxLength: (value, max) => {
    return !value || value.length <= max;
  },
  
  numeric: (value) => {
    return /^\d+$/.test(value);
  },
  
  decimal: (value) => {
    return /^\d+(\.\d+)?$/.test(value);
  },
  
  phone: (value) => {
    // Basic phone validation (can be customized per region)
    return /^[\d\s\-\+\(\)]+$/.test(value) && value.replace(/\D/g, '').length >= 10;
  },
  
  email: (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },
  
  amount: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  },
  
  minAmount: (value, min) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min;
  },
  
  maxAmount: (value, max) => {
    const num = parseFloat(value);
    return !isNaN(num) && num <= max;
  },
  
  regex: (value, pattern) => {
    return new RegExp(pattern).test(value);
  },
  
  inList: (value, list) => {
    return Array.isArray(list) && list.includes(value);
  },
  
  date: (value) => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },
  
  futureDate: (value) => {
    const date = new Date(value);
    return !isNaN(date.getTime()) && date > new Date();
  },
  
  pastDate: (value) => {
    const date = new Date(value);
    return !isNaN(date.getTime()) && date < new Date();
  }
};

// Validate input against rules
const validateInput = (input, rules) => {
  if (!rules || typeof rules !== 'object') {
    return { isValid: true, errors: [] };
  }
  
  const errors = [];
  
  for (const [ruleName, ruleConfig] of Object.entries(rules)) {
    const validator = validators[ruleName];
    
    if (!validator) {
      console.warn(`Unknown validation rule: ${ruleName}`);
      continue;
    }
    
    let isValid = false;
    let errorMessage = '';
    
    if (typeof ruleConfig === 'boolean' && ruleConfig) {
      // Simple rule like { required: true }
      isValid = validator(input);
      errorMessage = getDefaultErrorMessage(ruleName);
    } else if (typeof ruleConfig === 'object') {
      // Complex rule like { minLength: { value: 5, message: "Too short" } }
      const { value, message } = ruleConfig;
      isValid = validator(input, value);
      errorMessage = message || getDefaultErrorMessage(ruleName, value);
    } else {
      // Direct value like { minLength: 5 }
      isValid = validator(input, ruleConfig);
      errorMessage = getDefaultErrorMessage(ruleName, ruleConfig);
    }
    
    if (!isValid) {
      errors.push(errorMessage);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Get default error message
const getDefaultErrorMessage = (rule, value) => {
  const messages = {
    required: 'This field is required',
    minLength: `Minimum length is ${value} characters`,
    maxLength: `Maximum length is ${value} characters`,
    numeric: 'Please enter numbers only',
    decimal: 'Please enter a valid decimal number',
    phone: 'Please enter a valid phone number',
    email: 'Please enter a valid email address',
    amount: 'Please enter a valid amount',
    minAmount: `Minimum amount is ${value}`,
    maxAmount: `Maximum amount is ${value}`,
    regex: 'Invalid format',
    inList: 'Invalid selection',
    date: 'Please enter a valid date',
    futureDate: 'Please enter a future date',
    pastDate: 'Please enter a past date'
  };
  
  return messages[rule] || 'Invalid input';
};

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Remove leading/trailing whitespace
  let sanitized = input.trim();
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limit length to prevent DoS
  const MAX_INPUT_LENGTH = 1000;
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_INPUT_LENGTH);
  }
  
  return sanitized;
};

// Parse option input
const parseOptionInput = (input, options) => {
  const sanitized = sanitizeInput(input);
  
  // Check if input matches an option ID
  const option = options.find(opt => opt.id === sanitized);
  
  if (option) {
    return {
      isValid: true,
      selectedOption: option,
      nextMenu: option.next
    };
  }
  
  return {
    isValid: false,
    error: 'Invalid option. Please try again.'
  };
};

// Format validation errors for display
const formatValidationErrors = (errors) => {
  if (!errors || errors.length === 0) {
    return '';
  }
  
  if (errors.length === 1) {
    return errors[0];
  }
  
  return 'Please fix the following:\n' + errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
};

module.exports = {
  validators,
  validateInput,
  sanitizeInput,
  parseOptionInput,
  formatValidationErrors,
  getDefaultErrorMessage
};