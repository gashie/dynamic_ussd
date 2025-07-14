// Format USSD response based on menu type
const formatUSSDResponse = (menu, isEnd = false) => {
  const responseType = isEnd || menu.menu_type === 'final' 
    ? process.env.RESPONSE_TYPE_END || 'END'
    : process.env.RESPONSE_TYPE_CONTINUE || 'CON';
  
  // Clean up the text - remove any duplicate options that might have been added
  let cleanText = menu.text || '';
  
  // If the text has numbered options at the end, make sure they're not duplicated
  const lines = cleanText.split('\n');
  const uniqueLines = [];
  const seenOptions = new Set();
  
  for (const line of lines) {
    const optionMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (optionMatch) {
      const optionKey = `${optionMatch[1]}-${optionMatch[2].trim()}`;
      if (!seenOptions.has(optionKey)) {
        seenOptions.add(optionKey);
        uniqueLines.push(line);
      }
    } else {
      uniqueLines.push(line);
    }
  }
  
  cleanText = uniqueLines.join('\n').trim();
  
  return `${responseType} ${cleanText}`;
};

// Build menu text with options - avoid duplicates
const buildMenuText = (textTemplate, options = []) => {
  let text = textTemplate;
  
  // Check if options are already in the template
  const hasNumberedOptions = /\n\d+\.\s+/.test(textTemplate);
  
  if (!hasNumberedOptions && options.length > 0) {
    // Add a newline if text doesn't end with one
    if (!text.endsWith('\n')) {
      text += '\n';
    }
    
    // Add each option
    options.forEach((option) => {
      text += `${option.id}. ${option.label}\n`;
    });
  }
  
  return text.trim();
};

// Format error response
const formatErrorResponse = (errorMessage, allowRetry = true) => {
  const responseType = allowRetry 
    ? process.env.RESPONSE_TYPE_CONTINUE || 'CON'
    : process.env.RESPONSE_TYPE_END || 'END';
  
  let text = errorMessage;
  
  if (allowRetry) {
    text += '\n\n0. Back to main menu';
  }
  
  return `${responseType} ${text}`;
};

// Format timeout response
const formatTimeoutResponse = () => {
  const responseType = process.env.RESPONSE_TYPE_END || 'END';
  return `${responseType} Session timed out. Please dial again to continue.`;
};

// Format back navigation
const formatBackNavigation = (menu, previousMenu) => {
  let text = menu.text;
  
  // Add back option if not a final menu
  if (menu.menu_type !== 'final' && previousMenu) {
    text += '\n0. Back';
  }
  
  return text;
};

// Build breadcrumb trail
const buildBreadcrumb = (menuHistory, separator = ' > ') => {
  return menuHistory
    .map(menu => menu.title || menu.menu_code)
    .join(separator);
};

// Format input prompt
const formatInputPrompt = (prompt, validationHint = '') => {
  let text = prompt;
  
  if (validationHint) {
    text += `\n(${validationHint})`;
  }
  
  return text;
};

// Format confirmation message
const formatConfirmation = (data, template) => {
  const defaultTemplate = `
Please confirm:
{{details}}

1. Confirm
2. Cancel
`;
  
  const finalTemplate = template || defaultTemplate;
  
  // Build details string
  const details = Object.entries(data)
    .map(([key, value]) => `${formatLabel(key)}: ${value}`)
    .join('\n');
  
  return finalTemplate.replace('{{details}}', details);
};

// Format label (convert snake_case to Title Case)
const formatLabel = (key) => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Format list response
const formatListResponse = (items, template = '{{index}}. {{item}}') => {
  return items
    .map((item, index) => {
      return template
        .replace('{{index}}', index + 1)
        .replace('{{item}}', item);
    })
    .join('\n');
};

// Format paginated response
const formatPaginatedResponse = (items, page, pageSize, totalPages) => {
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);
  const pageItems = items.slice(startIndex, endIndex);
  
  let text = formatListResponse(pageItems);
  
  // Add navigation
  text += '\n\n';
  if (page > 1) text += '7. Previous\n';
  if (page < totalPages) text += '8. Next\n';
  text += '9. Back to menu\n';
  text += '0. Exit';
  
  return text;
};

// Format success message
const formatSuccessMessage = (message, details = {}) => {
  let text = `✓ ${message}`;
  
  if (Object.keys(details).length > 0) {
    text += '\n\n';
    text += Object.entries(details)
      .map(([key, value]) => `${formatLabel(key)}: ${value}`)
      .join('\n');
  }
  
  return text;
};

// Format failure message
const formatFailureMessage = (message, retryOption = true) => {
  let text = `✗ ${message}`;
  
  if (retryOption) {
    text += '\n\n1. Try again\n2. Main menu';
  }
  
  return text;
};

// Get validation hint based on rules
const getValidationHint = (rules) => {
  const hints = [];
  
  if (rules.numeric) hints.push('numbers only');
  if (rules.minLength) hints.push(`min ${rules.minLength.value || rules.minLength} characters`);
  if (rules.maxLength) hints.push(`max ${rules.maxLength.value || rules.maxLength} characters`);
  if (rules.phone) hints.push('valid phone number');
  if (rules.email) hints.push('valid email');
  if (rules.amount) hints.push('valid amount');
  
  return hints.join(', ');
};

module.exports = {
  formatUSSDResponse,
  buildMenuText,
  formatErrorResponse,
  formatTimeoutResponse,
  formatBackNavigation,
  buildBreadcrumb,
  formatInputPrompt,
  formatConfirmation,
  formatLabel,
  formatListResponse,
  formatPaginatedResponse,
  formatSuccessMessage,
  formatFailureMessage,
  getValidationHint
};