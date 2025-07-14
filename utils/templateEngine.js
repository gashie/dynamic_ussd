// Simple template engine for replacing variables
const interpolateTemplate = (template, data) => {
  if (!template || typeof template !== 'string') {
    return template;
  }
  
  // Replace {{variable}} with actual values
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split('.');
    let value = data;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return match; // Return original if path not found
      }
    }
    
    return value !== undefined && value !== null ? String(value) : match;
  });
};

// Process JSON template (for API body templates)
const processJsonTemplate = (template, data) => {
  if (!template || typeof template !== 'object') {
    return template;
  }
  
  const processValue = (value) => {
    if (typeof value === 'string') {
      return interpolateTemplate(value, data);
    } else if (Array.isArray(value)) {
      return value.map(processValue);
    } else if (value && typeof value === 'object') {
      return processJsonTemplate(value, data);
    }
    return value;
  };
  
  const result = {};
  for (const key in template) {
    result[key] = processValue(template[key]);
  }
  
  return result;
};

// Extract variables from template
const extractVariables = (template) => {
  const matches = template.match(/\{\{(\w+(?:\.\w+)*)\}\}/g) || [];
  const variables = matches.map(match => match.replace(/\{\{|\}\}/g, ''));
  return [...new Set(variables)]; // Remove duplicates
};

// Validate required variables
const validateRequiredVariables = (template, data) => {
  const requiredVars = extractVariables(template);
  const missingVars = [];
  
  for (const varPath of requiredVars) {
    const keys = varPath.split('.');
    let value = data;
    let found = true;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        found = false;
        break;
      }
    }
    
    if (!found || value === undefined || value === null) {
      missingVars.push(varPath);
    }
  }
  
  return {
    isValid: missingVars.length === 0,
    missingVariables: missingVars
  };
};

// Apply JSONPath-like mapping
const applyJsonPath = (data, path) => {
  if (!path || typeof path !== 'string') {
    return data;
  }
  
  // Simple JSONPath implementation
  if (path.startsWith('$.')) {
    const keys = path.substring(2).split('.');
    let result = data;
    
    for (const key of keys) {
      if (result && typeof result === 'object') {
        if (key.includes('[') && key.includes(']')) {
          // Handle array notation
          const arrayKey = key.substring(0, key.indexOf('['));
          const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
          result = result[arrayKey] && result[arrayKey][index];
        } else {
          result = result[key];
        }
      } else {
        return undefined;
      }
    }
    
    return result;
  }
  
  return data[path] || undefined;
};

// Apply response mapping
const applyResponseMapping = (response, mapping) => {
  if (!mapping || typeof mapping !== 'object') {
    return response;
  }
  
  const result = {};
  
  for (const [key, path] of Object.entries(mapping)) {
    result[key] = applyJsonPath(response, path);
  }
  
  return result;
};

// Format currency
const formatCurrency = (amount, currency = 'USD') => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(num);
};

// Format date
const formatDate = (date, format = 'short') => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  
  const options = {
    short: { year: 'numeric', month: '2-digit', day: '2-digit' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' }
  };
  
  return d.toLocaleDateString('en-US', options[format] || options.short);
};

// Template helpers
const templateHelpers = {
  currency: formatCurrency,
  date: formatDate,
  uppercase: (str) => String(str).toUpperCase(),
  lowercase: (str) => String(str).toLowerCase(),
  capitalize: (str) => String(str).charAt(0).toUpperCase() + String(str).slice(1)
};

// Process template with helpers
const processTemplateWithHelpers = (template, data) => {
  let result = template;
  
  // Process helper functions {{helper:value}}
  result = result.replace(/\{\{(\w+):([^}]+)\}\}/g, (match, helper, value) => {
    if (templateHelpers[helper]) {
      // First interpolate the value
      const interpolatedValue = interpolateTemplate(`{{${value}}}`, data);
      return templateHelpers[helper](interpolatedValue);
    }
    return match;
  });
  
  // Then process regular variables
  result = interpolateTemplate(result, data);
  
  return result;
};

module.exports = {
  interpolateTemplate,
  processJsonTemplate,
  extractVariables,
  validateRequiredVariables,
  applyJsonPath,
  applyResponseMapping,
  formatCurrency,
  formatDate,
  templateHelpers,
  processTemplateWithHelpers
};