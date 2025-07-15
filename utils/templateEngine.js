// utils/templateEngine.js - Fully Dynamic Template Processing

const interpolateTemplate = (template, data) => {
  if (!template || typeof template !== 'string') {
    return template;
  }
  
  // Handle ALL variables individually - don't group concatenated ones
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path);
    
    // Return the value if it exists, otherwise return empty string
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
    
    return '';
  });
};

const getNestedValue = (obj, path) => {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
};

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

// DYNAMIC response mapping - NO hardcoding
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

const applyJsonPath = (data, path) => {
  if (!path || typeof path !== 'string') {
    return data;
  }
  
  if (path.startsWith('$.')) {
    const keys = path.substring(2).split('.');
    let result = data;
    
    for (const key of keys) {
      if (result && typeof result === 'object') {
        if (key.includes('[') && key.includes(']')) {
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

const formatCurrency = (amount, currency = 'USD') => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(num);
};

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

const templateHelpers = {
  currency: formatCurrency,
  date: formatDate,
  uppercase: (str) => String(str).toUpperCase(),
  lowercase: (str) => String(str).toLowerCase(),
  capitalize: (str) => String(str).charAt(0).toUpperCase() + String(str).slice(1)
};

const processTemplateWithHelpers = (template, data) => {
  let result = template;
  
  // Process helper functions first
  result = result.replace(/\{\{(\w+):([^}]+)\}\}/g, (match, helper, value) => {
    if (templateHelpers[helper]) {
      const interpolatedValue = interpolateTemplate(`{{${value}}}`, data);
      if (interpolatedValue && interpolatedValue !== `{{${value}}}`) {
        return templateHelpers[helper](interpolatedValue);
      }
    }
    return '';
  });
  
  // Then process regular variables
  result = interpolateTemplate(result, data);
  
  return result;
};

module.exports = {
  interpolateTemplate,
  processJsonTemplate,
  applyJsonPath,
  applyResponseMapping,
  formatCurrency,
  formatDate,
  templateHelpers,
  processTemplateWithHelpers,
  getNestedValue
};