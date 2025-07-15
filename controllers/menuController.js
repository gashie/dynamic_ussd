// controllers/menuController.js - 100% Dynamic Solution (NO HARDCODING)

const { getMenuByCode } = require('../models/menuModel');
const sessionModel = require('../models/sessionModel');
const { executeMultipleApiCalls } = require('../utils/apiClient');
const { processTemplateWithHelpers } = require('../utils/templateEngine');
const { validateInput, parseOptionInput, formatValidationErrors } = require('../utils/inputValidator');
const { 
  buildMenuText, 
  formatInputPrompt, 
  getValidationHint 
} = require('../views/responseFormatter');

const processMenuFlow = async (session, input, app) => {
  const { current_menu } = session;
  
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
  
  // Get session variables
  const sessionVariables = await sessionModel.getAllSessionVariables(session.session_id);
  
  // Find options dynamically
  let options = findDynamicOptions(menu, sessionVariables);
  
  console.log(`Menu: ${menu.menu_code}, Found ${options.length} options`);
  
  if (!options || options.length === 0) {
    return {
      ...menu,
      text: `No options available for this menu.\n\n0. Back to main menu`
    };
  }
  
  // Validate input
  const { isValid, selectedOption, error } = parseOptionInput(input, options);
  
  if (!isValid) {
    const freshMenu = await loadMenu(app.id, menu.menu_code, session);
    return {
      ...freshMenu,
      text: `${error}\n\n${freshMenu.text}`
    };
  }
  
  // Store user input
  await sessionModel.setSessionVariable(session.session_id, menu.menu_code + '_input', input);
  
  // Store selected item data dynamically
  await storeSelectedData(session.session_id, input, sessionVariables);
  
  // Navigate to next menu
  const nextMenuCode = selectedOption.next || menu.next_menu;
  if (!nextMenuCode) {
    throw new Error('No next menu defined');
  }
  
  return await loadMenu(app.id, nextMenuCode, session);
};

// FULLY DYNAMIC option finder
const findDynamicOptions = (menu, sessionVariables) => {
  console.log(`Looking for options for menu: ${menu.menu_code}`);
  
  // 1. Try menu's built-in options first
  if (menu.options && menu.options !== '[]') {
    try {
      const parsed = typeof menu.options === 'string' ? JSON.parse(menu.options) : menu.options;
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`Found static options in menu definition`);
        return parsed;
      }
    } catch (e) {}
  }
  
  // 2. Look for ANY variable ending with '_options'
  console.log('Searching session variables for *_options...');
  const optionKeys = Object.keys(sessionVariables)
    .filter(key => key.endsWith('_options'))
    .sort(); // Sort for consistency
  
  console.log(`Found option keys:`, optionKeys);
  
  for (const key of optionKeys) {
    try {
      const options = JSON.parse(sessionVariables[key]);
      if (Array.isArray(options) && options.length > 0) {
        console.log(`Using options from session variable: ${key}`);
        return options;
      }
    } catch (e) {
      console.log(`Failed to parse ${key}:`, e.message);
    }
  }
  
  console.log('No valid options found');
  return [];
};

// FULLY DYNAMIC selection storage
const storeSelectedData = async (sessionId, userInput, sessionVariables) => {
  const selectedIndex = parseInt(userInput) - 1;
  console.log(`Storing selection for index: ${selectedIndex}`);
  
  // Find ALL arrays in session variables
  const arrayKeys = [];
  
  for (const [key, value] of Object.entries(sessionVariables)) {
    // Skip processed/derived keys
    if (key.includes('_options') || key.includes('_list') || 
        key.includes('_input') || key.includes('_selected')) {
      continue;
    }
    
    try {
      const data = JSON.parse(value);
      if (Array.isArray(data) && data.length > 0) {
        arrayKeys.push({ key, data, length: data.length });
      }
    } catch (e) {
      // Not JSON, skip
    }
  }
  
  console.log(`Found ${arrayKeys.length} arrays in session:`, arrayKeys.map(a => `${a.key}(${a.length})`));
  
  // Store selection from arrays that have the right index
  for (const { key, data } of arrayKeys) {
    if (selectedIndex >= 0 && selectedIndex < data.length) {
      const selectedItem = data[selectedIndex];
      
      console.log(`Storing selection from ${key}[${selectedIndex}]:`, selectedItem);
      
      // Store the complete selected item
      await sessionModel.setSessionVariable(sessionId, `${key}_selected`, JSON.stringify(selectedItem));
      
      // Store the ID if it exists
      if (selectedItem && typeof selectedItem === 'object' && selectedItem.id) {
        await sessionModel.setSessionVariable(sessionId, `${key}_selected_id`, String(selectedItem.id));
        console.log(`Stored ${key}_selected_id = ${selectedItem.id}`);
      }
      
      // For debugging - also store a readable name if available
      if (selectedItem && typeof selectedItem === 'object' && selectedItem.name) {
        await sessionModel.setSessionVariable(sessionId, `${key}_selected_name`, selectedItem.name);
      }
    }
  }
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
  console.log(`\nLoading menu: ${menuCode}`);
  
  const menu = await getMenuByCode(appId, menuCode);
  if (!menu) {
    throw new Error(`Menu not found: ${menuCode}`);
  }
  
  // Get current session data
  const sessionVariables = await sessionModel.getAllSessionVariables(session.session_id);
  
  console.log(`Session variables for ${menuCode}:`, Object.keys(sessionVariables));
  
  const templateData = {
    ...session.session_data,
    ...sessionVariables,
    phone_number: session.phone_number,
    session_id: session.session_id
  };
  
  // Execute API calls if defined
  if (menu.api_calls && menu.api_calls.length > 0) {
    console.log(`Executing ${menu.api_calls.length} API calls for menu: ${menuCode}`);
    
    try {
      const apiResults = await executeMultipleApiCalls(
        menu.api_calls,
        appId,
        templateData,
        session.session_id
      );
      
      console.log(`API results:`, Object.keys(apiResults));
      
      // Process ALL API results
      for (const [apiName, result] of Object.entries(apiResults)) {
        if (result.success && result.data) {
          console.log(`Processing successful API result for ${apiName}:`, Object.keys(result.data));
          
          // Add to template data
          Object.assign(templateData, result.data);
          
          // Store ALL response data as session variables
          for (const [key, value] of Object.entries(result.data)) {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            await sessionModel.setSessionVariable(session.session_id, key, stringValue);
          }
        } else {
          console.log(`API call ${apiName} failed:`, result.error);
        }
      }
      
      // Refresh session variables after API calls
      const updatedVariables = await sessionModel.getAllSessionVariables(session.session_id);
      Object.assign(templateData, updatedVariables);
      
    } catch (apiError) {
      console.error('API calls failed:', apiError);
    }
  }
  
  // Process text template
  const processedText = processTemplateWithHelpers(menu.text_template, templateData);
  
  // Handle options for display
  let finalText = processedText;
  let dynamicOptions = [];
  
  if (menu.menu_type === 'options') {
    dynamicOptions = findDynamicOptions(menu, templateData);
    
    // Only add options if they're not already in the text
    if (dynamicOptions.length > 0) {
      const hasNumberedOptions = /\n\d+\./.test(processedText);
      if (!hasNumberedOptions) {
        finalText = buildMenuText(processedText, dynamicOptions);
      }
    }
  }
  
  // Update session
  await sessionModel.updateSession(session.session_id, { 
    currentMenu: menuCode,
    sessionData: templateData
  });
  
  console.log(`Menu ${menuCode} loaded with ${dynamicOptions.length} options`);
  
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

module.exports = {
  processMenuFlow,
  processOptionsMenu,
  processInputMenu,
  loadMenu,
  navigateBack
};