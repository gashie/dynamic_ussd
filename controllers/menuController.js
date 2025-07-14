const { getMenuByCode } = require('../models/menuModel');
const { executeMultipleApiCalls } = require('../utils/apiClient');
const { processTemplateWithHelpers } = require('../utils/templateEngine');
const { validateInput, parseOptionInput, formatValidationErrors } = require('../utils/inputValidator');
const { 
  buildMenuText, 
  formatInputPrompt, 
  getValidationHint 
} = require('../views/responseFormatter');

// Process menu flow based on input
const processMenuFlow = async (session, input, app) => {
  const { current_menu, session_data, input_history } = session;
  
  // If no current menu, go to entry menu
  if (!current_menu) {
    return await loadMenu(app.id, app.entry_menu, session);
  }
  
  // Get current menu
  const currentMenu = await getMenuByCode(app.id, current_menu);
  if (!currentMenu) {
    throw new Error(`Menu not found: ${current_menu}`);
  }
  
  // Process based on menu type
  switch (currentMenu.menu_type) {
    case 'options':
      return await processOptionsMenu(currentMenu, input, session, app);
      
    case 'input':
      return await processInputMenu(currentMenu, input, session, app);
      
    case 'final':
      return currentMenu; // Final menus don't process input
      
    default:
      throw new Error(`Unknown menu type: ${currentMenu.menu_type}`);
  }
};

// Process options menu
const processOptionsMenu = async (menu, input, session, app) => {
  // Handle back navigation
  if (input === '0' && session.input_history.length > 0) {
    return await navigateBack(session, app);
  }
  
  // Parse option selection
  const { isValid, selectedOption, error } = parseOptionInput(input, menu.options);
  
  if (!isValid) {
    return {
      ...menu,
      text: `${error}\n\n${menu.text_template}`
    };
  }
  
  // Navigate to next menu
  const nextMenuCode = selectedOption.next || menu.next_menu;
  if (!nextMenuCode) {
    throw new Error('No next menu defined');
  }
  
  return await loadMenu(app.id, nextMenuCode, session);
};

// Process input menu
const processInputMenu = async (menu, input, session, app) => {
  // Validate input
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
  
  // Store input in session
  const { setSessionVariable } = require('../models/sessionModel');
  const variableName = menu.menu_code + '_input';
  await setSessionVariable(session.session_id, variableName, input);
  
  // Navigate to next menu
  if (!menu.next_menu) {
    throw new Error('No next menu defined for input menu');
  }
  
  return await loadMenu(app.id, menu.next_menu, session);
};

// Load menu and execute API calls
const loadMenu = async (appId, menuCode, session) => {
  const menu = await getMenuByCode(appId, menuCode);
  
  if (!menu) {
    throw new Error(`Menu not found: ${menuCode}`);
  }
  
  // Get all session variables
  const { getAllSessionVariables } = require('../models/sessionModel');
  const sessionVariables = await getAllSessionVariables(session.session_id);
  
  // Combine session data
  const templateData = {
    ...session.session_data,
    ...sessionVariables,
    phone_number: session.phone_number,
    session_id: session.session_id
  };
  
  // Execute API calls if defined
  if (menu.api_calls && menu.api_calls.length > 0) {
    try {
      const apiResults = await executeMultipleApiCalls(
        menu.api_calls,
        appId,
        templateData,
        session.session_id
      );
      
      // Add successful API results to template data
      for (const [apiName, result] of Object.entries(apiResults)) {
        if (result.success && result.data) {
          Object.assign(templateData, result.data);
        } else {
          // Add default values for failed API calls
          console.warn(`API call ${apiName} failed:`, result.error);
          // Continue without the API data rather than failing completely
        }
      }
    } catch (apiError) {
      console.error('API calls failed:', apiError);
      // Continue without API data - better than complete failure
    }
  }
  
  // Process template
  const processedText = processTemplateWithHelpers(menu.text_template, templateData);
  
  // Build final menu text
  const finalText = buildMenuText(processedText, menu.options);
  
  // Update session current menu
  const { updateSession } = require('../models/sessionModel');
  await updateSession(session.session_id, { 
    currentMenu: menuCode,
    sessionData: templateData
  });
  
  return {
    ...menu,
    text: finalText
  };
};

// Navigate back in menu history
const navigateBack = async (session, app) => {
  const history = session.input_history || [];
  
  if (history.length < 2) {
    // Go to main menu if no history
    return await loadMenu(app.id, app.entry_menu, session);
  }
  
  // Get previous menu from history
  const previousEntry = history[history.length - 2];
  const previousMenuCode = previousEntry.menu;
  
  // Remove last entry from history
  const { updateSession } = require('../models/sessionModel');
  const newHistory = history.slice(0, -1);
  
  await updateSession(session.session_id, {
    inputHistory: newHistory
  });
  
  return await loadMenu(app.id, previousMenuCode, session);
};

// Get menu path (for debugging/logging)
const getMenuPath = (inputHistory) => {
  return inputHistory
    .map(entry => entry.menu)
    .join(' > ');
};

// Validate menu structure
const validateMenuStructure = (menu) => {
  const errors = [];
  
  if (!menu.menu_code) {
    errors.push('Menu code is required');
  }
  
  if (!menu.text_template) {
    errors.push('Text template is required');
  }
  
  if (menu.menu_type === 'options' && (!menu.options || menu.options.length === 0)) {
    errors.push('Options menu must have at least one option');
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