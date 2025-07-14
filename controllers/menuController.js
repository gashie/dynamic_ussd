const { getMenuByCode } = require('../models/menuModel');
const sessionModel = require('../models/sessionModel');
const { executeMultipleApiCalls } = require('../utils/apiClient');
const { processTemplateWithHelpers, interpolateTemplate } = require('../utils/templateEngine');
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
  
  // First, get the menu's dynamic options from session
  const sessionVariables = await sessionModel.getAllSessionVariables(session.session_id);
  
  // Determine which options to use
  let options = await getMenuOptions(menu, sessionVariables);
  
  // Validate the input
  const { isValid, selectedOption, error } = parseOptionInput(input, options);
  
  if (!isValid) {
    // Reload menu to show error
    const freshMenu = await loadMenu(app.id, menu.menu_code, session);
    return {
      ...freshMenu,
      text: `${error}\n\n${freshMenu.text}`
    };
  }
  
  // Store the selected input
  await sessionModel.setSessionVariable(session.session_id, menu.menu_code + '_input', input);
  
  // Handle dynamic selection BEFORE navigating to next menu
  await handleDynamicArraySelection(session.session_id, menu.menu_code, input, sessionVariables);
  
  // Navigate to next menu
  const nextMenuCode = selectedOption.next || menu.next_menu;
  if (!nextMenuCode) {
    throw new Error('No next menu defined');
  }
  
  return await loadMenu(app.id, nextMenuCode, session);
};

// Get the correct options for a menu
const getMenuOptions = async (menu, sessionVariables) => {
  // First try the menu's own options
  let options = menu.options;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch (e) {
      options = [];
    }
  }
  
  // If empty, look for dynamic options based on the menu code
  if (!options || options.length === 0) {
    // Map of menu codes to their expected option keys
    const menuOptionMap = {
      'make_contribution_groups': 'groups_options',
      'view_groups_list': 'groups_options',
      'make_contribution_collabos': 'collabos_options',
      'view_collabos_list': 'collabos_options',
      'pending_invitations': 'invitations_options',
      'edit_subgroup': 'subgroup_options'
    };
    
    const expectedKey = menuOptionMap[menu.menu_code];
    if (expectedKey && sessionVariables[expectedKey]) {
      try {
        const parsedOptions = JSON.parse(sessionVariables[expectedKey]);
        if (parsedOptions && parsedOptions.length > 0) {
          options = parsedOptions;
        }
      } catch (e) {
        console.error(`Failed to parse ${expectedKey}:`, e);
      }
    }
  }
  
  return options || [];
};

// Handle dynamic array selection
const handleDynamicArraySelection = async (sessionId, menuCode, userInput, sessionVariables) => {
  const selectedIndex = parseInt(userInput) - 1;
  
  // Map menu codes to their data arrays
  const selectionMap = {
    'make_contribution_groups': 'groups',
    'view_groups_list': 'groups',
    'make_contribution_collabos': 'collabos',
    'view_collabos_list': 'collabos',
    'pending_invitations': 'invitations',
    'edit_subgroup': 'subgroups'
  };
  
  const dataKey = selectionMap[menuCode];
  if (!dataKey) return;
  
  // Get the array data from session
  const arrayData = sessionVariables[dataKey];
  if (!arrayData) return;
  
  try {
    const items = JSON.parse(arrayData);
    if (Array.isArray(items) && selectedIndex >= 0 && selectedIndex < items.length) {
      const selectedItem = items[selectedIndex];
      
      // Store the complete selected item
      await sessionModel.setSessionVariable(sessionId, `${dataKey}_selected`, JSON.stringify(selectedItem));
      
      // Store just the ID for easy access in templates
      if (selectedItem.id) {
        await sessionModel.setSessionVariable(sessionId, `${dataKey}_selected_id`, String(selectedItem.id));
      }
      
      console.log(`Selected ${dataKey}[${selectedIndex}]:`, selectedItem);
    }
  } catch (e) {
    console.error(`Error handling selection for ${dataKey}:`, e);
  }
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
  const variableName = menu.menu_code + '_input';
  await sessionModel.setSessionVariable(session.session_id, variableName, input);
  
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
  const sessionVariables = await sessionModel.getAllSessionVariables(session.session_id);
  
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
          
          // Store API response data as session variables
          for (const [key, value] of Object.entries(result.data)) {
            await sessionModel.setSessionVariable(session.session_id, key, 
              typeof value === 'object' ? JSON.stringify(value) : String(value)
            );
          }
        } else {
          console.warn(`API call ${apiName} failed:`, result.error);
        }
      }
      
      // Re-read session variables after API calls
      const updatedVariables = await sessionModel.getAllSessionVariables(session.session_id);
      Object.assign(templateData, updatedVariables);
      
    } catch (apiError) {
      console.error('API calls failed:', apiError);
    }
  }
  
  // Handle special template variables that might be empty
  // For contribution confirmation, add details if available
  if (!templateData.contribution_details) {
    if (templateData.contribution_member_phone_input) {
      templateData.contribution_details = `For: ${templateData.member_name || templateData.contribution_member_phone_input}`;
    } else {
      templateData.contribution_details = '';
    }
  }
  
  // Process template
  const processedText = processTemplateWithHelpers(menu.text_template, templateData);
  
  // Build final menu text
  let finalText = processedText;
  let correctOptions = menu.options;
  
  if (menu.menu_type === 'options') {
    // Get the correct options for this specific menu
    correctOptions = await getMenuOptions(menu, templateData);
    
    // Only add options if they're not already in the text
    const hasNumberedOptions = /\n\d+\./.test(processedText);
    if (!hasNumberedOptions && correctOptions && correctOptions.length > 0) {
      finalText = buildMenuText(processedText, correctOptions);
    }
  }
  
  // Update session current menu
  await sessionModel.updateSession(session.session_id, { 
    currentMenu: menuCode,
    sessionData: templateData
  });
  
  return {
    ...menu,
    text: finalText,
    options: correctOptions // Return the correct options
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
  const newHistory = history.slice(0, -1);
  
  await sessionModel.updateSession(session.session_id, {
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