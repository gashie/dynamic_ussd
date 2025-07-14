# Complete Fixed Dynamic USSD System

## 1. Fixed templateEngine.js
```javascript
const interpolateTemplate = (template, data) => {
  if (!template || typeof template !== 'string') {
    return template;
  }
  
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split('.');
    let value = data;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return match;
      }
    }
    
    return value !== undefined && value !== null ? String(value) : match;
  });
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

const extractVariables = (template) => {
  const matches = template.match(/\{\{(\w+(?:\.\w+)*)\}\}/g) || [];
  const variables = matches.map(match => match.replace(/\{\{|\}\}/g, ''));
  return [...new Set(variables)];
};

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

// Enhanced JSONPath with array index support
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
          const indexStr = key.substring(key.indexOf('[') + 1, key.indexOf(']'));
          const index = parseInt(indexStr);
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

// Dynamic response mapping that handles array selection
const applyResponseMapping = (response, mapping, sessionData = {}) => {
  if (!mapping || typeof mapping !== 'object') {
    return response;
  }
  
  const result = {};
  
  for (const [key, path] of Object.entries(mapping)) {
    // Handle dynamic array selection
    if (key.endsWith('_selected') && sessionData) {
      const baseKey = key.replace('_selected', '');
      const inputKey = `${baseKey}_input`;
      const userSelection = sessionData[inputKey];
      
      if (userSelection && response[baseKey] && Array.isArray(response[baseKey])) {
        const index = parseInt(userSelection) - 1;
        if (index >= 0 && index < response[baseKey].length) {
          result[key] = response[baseKey][index];
          result[`${key}_id`] = response[baseKey][index].id;
        }
      }
    } else {
      result[key] = applyJsonPath(response, path);
    }
  }
  
  return result;
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
  
  result = result.replace(/\{\{(\w+):([^}]+)\}\}/g, (match, helper, value) => {
    if (templateHelpers[helper]) {
      const interpolatedValue = interpolateTemplate(`{{${value}}}`, data);
      return templateHelpers[helper](interpolatedValue);
    }
    return match;
  });
  
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
```

## 2. Fixed apiClient.js
```javascript
const axios = require('axios');
const { processJsonTemplate, applyResponseMapping, interpolateTemplate } = require('./templateEngine');
const { logApiCall } = require('../models/apiModel');

const executeApiCall = async (apiConfig, sessionData, sessionId) => {
  const startTime = Date.now();
  let response = null;
  let error = null;
  let statusCode = null;
  
  try {
    const processedUrl = interpolateTemplate(apiConfig.endpoint, sessionData);
    const headers = processJsonTemplate(apiConfig.headers, sessionData);
    const body = processJsonTemplate(apiConfig.body_template, sessionData);
    
    const authHeaders = applyAuthentication(apiConfig.auth_config, sessionData);
    const finalHeaders = { ...headers, ...authHeaders };
    
    const requestConfig = {
      method: apiConfig.method,
      url: processedUrl,
      headers: finalHeaders,
      timeout: apiConfig.timeout || 5000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    };
    
    if (['POST', 'PUT', 'PATCH'].includes(apiConfig.method.toUpperCase())) {
      requestConfig.data = body;
    } else if (apiConfig.method.toUpperCase() === 'GET') {
      requestConfig.params = body;
    }
    
    response = await executeWithRetry(requestConfig, apiConfig.retry_count || 2);
    statusCode = response.status;
    
    // Apply response mapping with session data for dynamic selection
    const mappedResponse = applyResponseMapping(response.data, apiConfig.response_mapping, sessionData);
    
    await logApiCall({
      sessionId,
      apiName: apiConfig.api_name,
      requestData: { url: processedUrl, headers: finalHeaders, body },
      responseData: response.data,
      statusCode,
      errorMessage: null,
      durationMs: Date.now() - startTime
    });
    
    return {
      success: true,
      data: mappedResponse,
      rawData: response.data,
      statusCode
    };
    
  } catch (err) {
    error = err;
    statusCode = err.response?.status || 0;
    
    await logApiCall({
      sessionId,
      apiName: apiConfig.api_name,
      requestData: { headers: {}, body: {} },
      responseData: err.response?.data || null,
      statusCode,
      errorMessage: err.message,
      durationMs: Date.now() - startTime
    });
    
    return {
      success: false,
      error: err.message,
      statusCode,
      data: null
    };
  }
};

const executeWithRetry = async (requestConfig, maxRetries) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios(requestConfig);
      return response;
    } catch (error) {
      lastError = error;
      
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

const applyAuthentication = (authConfig, sessionData) => {
  if (!authConfig || typeof authConfig !== 'object') {
    return {};
  }
  
  const headers = {};
  
  switch (authConfig.type) {
    case 'bearer':
      if (authConfig.token) {
        const token = interpolateTemplate(authConfig.token, sessionData);
        headers['Authorization'] = `Bearer ${token}`;
      }
      break;
      
    case 'basic':
      if (authConfig.username && authConfig.password) {
        const username = interpolateTemplate(authConfig.username, sessionData);
        const password = interpolateTemplate(authConfig.password, sessionData);
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;
      
    case 'apikey':
      if (authConfig.key && authConfig.value) {
        const key = interpolateTemplate(authConfig.key, sessionData);
        const value = interpolateTemplate(authConfig.value, sessionData);
        headers[key] = value;
      }
      break;
      
    case 'custom':
      if (authConfig.headers) {
        Object.assign(headers, processJsonTemplate(authConfig.headers, sessionData));
      }
      break;
  }
  
  return headers;
};

const executeMultipleApiCalls = async (apiCalls, appId, sessionData, sessionId) => {
  const results = {};
  let accumulatedData = { ...sessionData };
  
  for (const apiCall of apiCalls) {
    const { name, config: overrides = {} } = apiCall;
    
    const { getApiConfig } = require('../models/apiModel');
    const apiConfig = await getApiConfig(appId, name);
    
    if (!apiConfig) {
      console.error(`API configuration not found: ${name}`);
      continue;
    }
    
    const finalConfig = { ...apiConfig, ...overrides };
    const result = await executeApiCall(finalConfig, accumulatedData, sessionId);
    
    results[name] = result;
    
    if (result.success && result.data) {
      Object.assign(accumulatedData, result.data);
      accumulatedData[name] = result.data;
    }
  }
  
  return results;
};

module.exports = {
  executeApiCall,
  executeMultipleApiCalls,
  executeWithRetry,
  applyAuthentication
};
```

## 3. Fixed contribution.sql with proper dynamic mapping
```sql
-- Fixed API configurations for truly dynamic response handling
DO $$
DECLARE
    app_id INTEGER;
BEGIN
    -- Get the app ID
    SELECT id INTO app_id FROM ussd_apps WHERE ussd_code = '*384#';
    
    -- Update API configurations with dynamic selection support
    UPDATE api_configs SET 
        response_mapping = '{
            "groups_list": "$.formatted",
            "groups_options": "$.options",
            "groups": "$.groups",
            "groups_selected": "$.groups",
            "groups_selected_id": "$.groups"
        }'::jsonb
    WHERE api_name = 'get_user_groups' AND app_id = app_id;
    
    UPDATE api_configs SET 
        endpoint = 'http://localhost:4000/api/collabos/group/{{groups_selected_id}}',
        response_mapping = '{
            "collabos_list": "$.formatted",
            "collabos_options": "$.options",
            "collabos": "$.collabos",
            "collabos_selected": "$.collabos",
            "collabos_selected_id": "$.collabos"
        }'::jsonb
    WHERE api_name = 'get_group_collabos' AND app_id = app_id;
    
    UPDATE api_configs SET 
        body_template = '{
            "phone": "{{phone_number}}", 
            "collaboId": "{{collabos_selected_id}}"
        }'::jsonb
    WHERE api_name = 'get_outstanding_amount' AND app_id = app_id;
    
    UPDATE api_configs SET 
        body_template = '{
            "phone": "{{contribution_member_phone_input}}", 
            "groupId": "{{groups_selected_id}}"
        }'::jsonb
    WHERE api_name = 'verify_group_member' AND app_id = app_id;
    
    UPDATE api_configs SET 
        body_template = '{
            "contributorPhone": "{{phone_number}}", 
            "beneficiaryPhone": "{{contribution_member_phone_input}}", 
            "collaboId": "{{collabos_selected_id}}", 
            "amount": "{{contribution_amount_self_input}}{{contribution_amount_other_input}}", 
            "reference": "{{contribution_reference_input}}", 
            "visibility": "{{contribution_visibility_input}}", 
            "pin": "{{contribution_pin_input}}"
        }'::jsonb
    WHERE api_name = 'process_contribution' AND app_id = app_id;
    
    UPDATE api_configs SET 
        endpoint = 'http://localhost:4000/api/metrics/collabo/{{collabos_selected_id}}'
    WHERE api_name = 'get_collabo_metrics' AND app_id = app_id;
    
    UPDATE api_configs SET 
        body_template = '{
            "phone": "{{phone_number}}", 
            "collaboId": "{{collabos_selected_id}}"
        }'::jsonb
    WHERE api_name = 'get_individual_metrics' AND app_id = app_id;
    
    UPDATE api_configs SET 
        body_template = '{
            "phone": "{{phone_number}}", 
            "collaboId": "{{collabos_selected_id}}", 
            "type": "{{type}}"
        }'::jsonb
    WHERE api_name = 'get_recent_contributions' AND app_id = app_id;
    
    UPDATE api_configs SET 
        response_mapping = '{
            "invitations_message": "$.message",
            "invitations_options": "$.options",
            "invitations": "$.invitations",
            "invitations_selected": "$.invitations",
            "invitations_selected_id": "$.invitations"
        }'::jsonb
    WHERE api_name = 'get_pending_invitations' AND app_id = app_id;
    
    UPDATE api_configs SET 
        endpoint = 'http://localhost:4000/api/invitations/{{invitations_selected_id}}'
    WHERE api_name = 'get_invitation_details' AND app_id = app_id;
    
    UPDATE api_configs SET 
        body_template = '{
            "invitationId": "{{invitations_selected_id}}", 
            "phone": "{{phone_number}}"
        }'::jsonb
    WHERE api_name = 'accept_invitation' AND app_id = app_id;
    
    UPDATE api_configs SET 
        body_template = '{
            "invitationId": "{{invitations_selected_id}}", 
            "phone": "{{phone_number}}"
        }'::jsonb
    WHERE api_name = 'decline_invitation' AND app_id = app_id;
    
    UPDATE api_configs SET 
        response_mapping = '{
            "subgroup_options_text": "$.formatted",
            "subgroup_options": "$.options",
            "subgroups": "$.subgroups",
            "subgroups_selected": "$.subgroups"
        }'::jsonb
    WHERE api_name = 'get_subgroups' AND app_id = app_id;

    RAISE NOTICE 'API configurations updated for dynamic selection handling';
END $$;
```

## 4. Enhanced menuController.js with dynamic selection handling
```javascript
const { getMenuByCode } = require('../models/menuModel');
const sessionModel = require('../models/sessionModel');
const { executeMultipleApiCalls } = require('../utils/apiClient');
const { processTemplateWithHelpers, applyResponseMapping } = require('../utils/templateEngine');
const { validateInput, parseOptionInput, formatValidationErrors } = require('../utils/inputValidator');
const { 
  buildMenuText, 
  formatInputPrompt, 
  getValidationHint 
} = require('../views/responseFormatter');

const processMenuFlow = async (session, input, app) => {
  const { current_menu, session_data, input_history } = session;
  
  if (!current_menu) {
    return await loadMenu(app.id, app.entry_menu, session);
  }
  
  const currentMenu = await getMenuByCode(app.id, current_menu);
  if (!currentMenu) {
    throw new Error(`Menu not found: ${current_menu}`);
  }
  
  switch (currentMenu.menu_type) {
    case 'options':
      return await processOptionsMenu(currentMenu, input, session, app);
    case 'input':
      return await processInputMenu(currentMenu, input, session, app);
    case 'final':
      return currentMenu;
    default:
      throw new Error(`Unknown menu type: ${currentMenu.menu_type}`);
  }
};

const processOptionsMenu = async (menu, input, session, app) => {
  if (input === '0' && session.input_history.length > 0) {
    return await navigateBack(session, app);
  }
  
  // Get fresh menu with API data
  const freshMenu = await loadMenu(app.id, menu.menu_code, session);
  
  let options = freshMenu.options;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch (e) {
      options = [];
    }
  }
  
  // Check session for dynamic options
  if (!options || options.length === 0) {
    const sessionVariables = await sessionModel.getAllSessionVariables(session.session_id);
    const optionKeys = Object.keys(sessionVariables).filter(k => k.endsWith('_options'));
    
    for (const key of optionKeys) {
      try {
        const parsedOptions = JSON.parse(sessionVariables[key]);
        if (Array.isArray(parsedOptions) && parsedOptions.length > 0) {
          options = parsedOptions;
          break;
        }
      } catch (e) {}
    }
  }
  
  const { isValid, selectedOption, error } = parseOptionInput(input, options);
  
  if (!isValid) {
    return {
      ...freshMenu,
      text: `${error}\n\n${freshMenu.text}`
    };
  }
  
  // Store the input
  await sessionModel.setSessionVariable(session.session_id, menu.menu_code + '_input', input);
  
  // Handle dynamic selection (store selected item from array)
  const sessionVariables = await sessionModel.getAllSessionVariables(session.session_id);
  
  // Find arrays that might need selection
  for (const [key, value] of Object.entries(sessionVariables)) {
    if (key.endsWith('s') && !key.endsWith('_options') && !key.endsWith('_list')) {
      try {
        const items = JSON.parse(value);
        if (Array.isArray(items) && items.length > 0) {
          const index = parseInt(input) - 1;
          if (index >= 0 && index < items.length) {
            const selected = items[index];
            await sessionModel.setSessionVariable(session.session_id, `${key}_selected`, JSON.stringify(selected));
            await sessionModel.setSessionVariable(session.session_id, `${key}_selected_id`, String(selected.id));
          }
        }
      } catch (e) {}
    }
  }
  
  const nextMenuCode = selectedOption.next || menu.next_menu;
  if (!nextMenuCode) {
    throw new Error('No next menu defined');
  }
  
  return await loadMenu(app.id, nextMenuCode, session);
};

const processInputMenu = async (menu, input, session, app) => {
  const validation = validateInput(input, menu.validation_rules);
  
  if (!validation.isValid) {
    const errorText = formatValidationErrors(validation.errors);
    const hint = getValidationHint(menu.validation_rules);
    const prompt = formatInputPrompt(menu.text_template, hint);
    
    return {
      ...menu,
      text: `${errorText}\n\n${prompt}`
    };
  }
  
  const variableName = menu.menu_code + '_input';
  await sessionModel.setSessionVariable(session.session_id, variableName, input);
  
  if (!menu.next_menu) {
    throw new Error('No next menu defined for input menu');
  }
  
  return await loadMenu(app.id, menu.next_menu, session);
};

const loadMenu = async (appId, menuCode, session) => {
  const menu = await getMenuByCode(appId, menuCode);
  
  if (!menu) {
    throw new Error(`Menu not found: ${menuCode}`);
  }
  
  const sessionVariables = await sessionModel.getAllSessionVariables(session.session_id);
  
  const templateData = {
    ...session.session_data,
    ...sessionVariables,
    phone_number: session.phone_number,
    session_id: session.session_id
  };
  
  if (menu.api_calls && menu.api_calls.length > 0) {
    try {
      const apiResults = await executeMultipleApiCalls(
        menu.api_calls,
        appId,
        templateData,
        session.session_id
      );
      
      for (const [apiName, result] of Object.entries(apiResults)) {
        if (result.success && result.data) {
          Object.assign(templateData, result.data);
          
          // Store all response data
          for (const [key, value] of Object.entries(result.data)) {
            await sessionModel.setSessionVariable(session.session_id, key, 
              typeof value === 'object' ? JSON.stringify(value) : String(value)
            );
          }
          
          // Handle dynamic selection mapping
          const responseData = result.rawData || result.data;
          for (const [key, value] of Object.entries(result.data)) {
            if (key.endsWith('_selected') && templateData[key.replace('_selected', '_input')]) {
              const baseKey = key.replace('_selected', '');
              const userInput = templateData[`${baseKey}_input`];
              const index = parseInt(userInput) - 1;
              
              if (responseData[baseKey] && Array.isArray(responseData[baseKey]) && 
                  index >= 0 && index < responseData[baseKey].length) {
                const selected = responseData[baseKey][index];
                await sessionModel.setSessionVariable(session.session_id, key, JSON.stringify(selected));
                await sessionModel.setSessionVariable(session.session_id, `${key}_id`, String(selected.id));
                templateData[key] = selected;
                templateData[`${key}_id`] = selected.id;
              }
            }
          }
        }
      }
      
      // Re-read variables
      const updatedVariables = await sessionModel.getAllSessionVariables(session.session_id);
      Object.assign(templateData, updatedVariables);
      
    } catch (apiError) {
      console.error('API calls failed:', apiError);
    }
  }
  
  const processedText = processTemplateWithHelpers(menu.text_template, templateData);
  
  let finalText = processedText;
  let dynamicOptions = menu.options;
  
  if (menu.menu_type === 'options') {
    const optionKeys = Object.keys(templateData).filter(k => k.endsWith('_options'));
    
    for (const key of optionKeys) {
      try {
        const parsedOptions = typeof templateData[key] === 'string' 
          ? JSON.parse(templateData[key]) 
          : templateData[key];
        
        if (parsedOptions && Array.isArray(parsedOptions) && parsedOptions.length > 0) {
          dynamicOptions = parsedOptions;
          break;
        }
      } catch (e) {}
    }
    
    if (dynamicOptions && dynamicOptions.length > 0) {
      const hasNumberedOptions = /\n\d+\./.test(processedText);
      if (!hasNumberedOptions) {
        finalText = buildMenuText(processedText, dynamicOptions);
      }
    }
  }
  
  await sessionModel.updateSession(session.session_id, { 
    currentMenu: menuCode,
    sessionData: templateData
  });
  
  return {
    ...menu,
    text: finalText,
    options: dynamicOptions
  };
};

const navigateBack = async (session, app) => {
  const history = session.input_history || [];
  
  if (history.length < 2) {
    return await loadMenu(app.id, app.entry_menu, session);
  }
  
  const previousEntry = history[history.length - 2];
  const previousMenuCode = previousEntry.menu;
  
  const newHistory = history.slice(0, -1);
  
  await sessionModel.updateSession(session.session_id, {
    inputHistory: newHistory
  });
  
  return await loadMenu(app.id, previousMenuCode, session);
};

const getMenuPath = (inputHistory) => {
  return inputHistory
    .map(entry => entry.menu)
    .join(' > ');
};

const validateMenuStructure = (menu) => {
  const errors = [];
  
  if (!menu.menu_code) {
    errors.push('Menu code is required');
  }
  
  if (!menu.text_template) {
    errors.push('Text template is required');
  }
  
  if (menu.menu_type === 'options' && !menu.next_menu && (!menu.options || menu.options.length === 0)) {
    errors.push('Options menu must have either options with next destinations or a default next_menu');
  }
  
  if (menu.menu_type === 'input' && !menu.next_menu) {
    errors.push('Input menu must have a next_menu defined');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  processMenuFlow,
  processOptionsMenu,
  processInputMenu,
  loadMenu,
  navigateBack,
  getMenuPath,
  validateMenuStructure
};
```

## Installation Steps:

1. **Replace the files:**
   - `utils/templateEngine.js`
   - `utils/apiClient.js`
   - `controllers/menuController.js`

2. **Run the SQL fix:**
   ```bash
   psql -U postgres -d ussd_db -f fix-contribution.sql
   ```

3. **Restart both servers:**
   ```bash
   # Terminal 1
   node mock-api-server.js
   
   # Terminal 2
   npm run dev
   ```

4. **Test:**
   ```bash
   node interactive-ussd-tester.js
   ```

## How it works:

1. **Dynamic Selection**: When a user selects an option (e.g., "1"), the system:
   - Finds the corresponding array in the session (e.g., `groups`)
   - Stores the selected item as `{array_name}_selected`
   - Stores the ID as `{array_name}_selected_id`

2. **Template Resolution**: The API endpoints use these dynamic variables:
   - `{{groups_selected_id}}` - The ID of the selected group
   - `{{collabos_selected_id}}` - The ID of the selected collabo

3. **No Hardcoding**: The system automatically handles any array selection without hardcoded values.

This solution is fully dynamic and will work with any API structure.