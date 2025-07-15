# Dynamic USSD System - Complete Flow Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Request Flow Architecture](#request-flow-architecture)
3. [Detailed Processing Steps](#detailed-processing-steps)
4. [Database Interactions](#database-interactions)
5. [API Integration Flow](#api-integration-flow)
6. [Template Engine](#template-engine)
7. [Session Management](#session-management)
8. [Dynamic Selection Handling](#dynamic-selection-handling)
9. [Code Examples](#code-examples)

## System Overview

The Dynamic USSD System is a fully database-driven USSD application framework that allows you to create and manage USSD services without code changes. Everything is configured through database records - menus, flows, API calls, and responses.

### Key Features
- **100% Dynamic**: All menus and flows are database-driven
- **Multi-App Support**: One codebase can serve multiple USSD codes
- **API Integration**: Dynamic external API calls with template support
- **Session Management**: Automatic session handling with variable storage
- **Template Engine**: Variable interpolation and formatting helpers

## Request Flow Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│    User     │────▶│  USSD GW    │────▶│   Express    │
│   (Phone)   │     │  Provider   │     │   Server     │
└─────────────┘     └─────────────┘     └──────┬───────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           ▼                           │
                    │         ┌─────────────────────────────┐               │
                    │         │   ussdController.js         │               │
                    │         │   handleUSSDRequest()       │               │
                    │         └──────────────┬──────────────┘               │
                    │                        │                              │
                    │      ┌─────────────────┼─────────────────┐            │
                    │      ▼                 ▼                 ▼            │
                    │ ┌─────────┐     ┌─────────┐      ┌──────────┐         │
                    │ │ Session │     │   App   │      │   Menu   │         │
                    │ │  Model  │     │  Model  │      │Controller│         │
                    │ └─────────┘     └─────────┘      └──────────┘         │
                    │      │               │                  │             │
                    │      ▼               ▼                  ▼             │
                    │ ┌─────────────────────────────────────────────┐       │
                    │ │              PostgreSQL                     │       │
                    │ │  - ussd_apps    - ussd_sessions             │        │
                    │ │  - ussd_menus   - session_variables         │        │
                    │ │  - api_configs  - api_call_logs             │        │
                    │ └─────────────────────────────────────────────┘       │
                    └─────────────────────────────────────────────────────  ┘
```

## Detailed Processing Steps

### 1. Initial Request Reception

When a user dials `*384#`, the USSD gateway sends a POST request:

```json
{
  "sessionId": "UNIQUE_SESSION_123",
  "serviceCode": "*384#",
  "phoneNumber": "+1234567890",
  "text": ""
}
```

### 2. Request Processing Flow

```javascript
// Step 1: ussdController receives request
handleUSSDRequest(req, res) {
  // Extract parameters
  const { sessionId, serviceCode, phoneNumber, text } = req.body;
  
  // Step 2: Find the app configuration
  const app = await getAppByCode(serviceCode); // Queries: SELECT * FROM ussd_apps WHERE ussd_code = '*384#'
  
  // Step 3: Get or create session
  const session = await getOrCreateSession(sessionId, phoneNumber, app.id);
  
  // Step 4: Parse input history
  // text = "1*2*3" means: selected 1, then 2, then 3
  const inputs = text.split('*').filter(Boolean);
  const currentInput = inputs[inputs.length - 1] || '';
  
  // Step 5: Process menu flow
  const menu = await processMenuFlow(session, currentInput, app);
  
  // Step 6: Format and send response
  const response = formatUSSDResponse(menu, menu.menu_type === 'final');
  res.send(response); // "CON Welcome to Contribution Manager\n1. Make a contribution..."
}
```

### 3. Menu Processing Logic

```javascript
processMenuFlow(session, input, app) {
  // If no current menu, load entry menu
  if (!session.current_menu) {
    return loadMenu(app.id, app.entry_menu, session); // entry_menu = 'main_menu'
  }
  
  // Get current menu from database
  const currentMenu = await getMenuByCode(app.id, session.current_menu);
  
  // Process based on menu type
  switch (currentMenu.menu_type) {
    case 'options':
      // User selecting from a list
      return processOptionsMenu(currentMenu, input, session, app);
      
    case 'input':
      // User entering free text
      return processInputMenu(currentMenu, input, session, app);
      
    case 'final':
      // End of flow
      return currentMenu;
  }
}
```

## Database Interactions

### 1. Menu Structure

```sql
-- Example menu record
{
  id: 1,
  app_id: 8,
  menu_code: 'make_contribution_groups',
  menu_type: 'options',
  text_template: 'Select a group:\n{{groups_list}}',
  options: '[]', -- Empty because loaded dynamically
  api_calls: '[{"name": "get_user_groups", "config": {}}]',
  next_menu: 'make_contribution_collabos'
}
```

### 2. Loading a Menu

When loading `make_contribution_groups`:

```javascript
loadMenu(appId, 'make_contribution_groups', session) {
  // 1. Get menu from database
  const menu = await getMenuByCode(appId, 'make_contribution_groups');
  
  // 2. Get session variables
  const sessionVariables = await getAllSessionVariables(session.session_id);
  // Returns: { phone_number: '+1234567890', make_contribution_groups_input: '1', ... }
  
  // 3. Execute API calls defined in menu
  if (menu.api_calls.length > 0) {
    // Call 'get_user_groups' API
    const results = await executeMultipleApiCalls(menu.api_calls, appId, sessionVariables);
    
    // API returns:
    // {
    //   groups_list: "1. Savings Club\n2. Investment Group",
    //   groups_options: '[{"id":"1","label":"Savings Club","next":"make_contribution_collabos"},...]',
    //   groups: '[{"id":1,"name":"Savings Club"},{"id":2,"name":"Investment Group"}]'
    // }
    
    // Store results in session
    for (const [key, value] of Object.entries(results.get_user_groups.data)) {
      await setSessionVariable(session.session_id, key, value);
    }
  }
  
  // 4. Process template
  // {{groups_list}} → "1. Savings Club\n2. Investment Group"
  const processedText = processTemplateWithHelpers(menu.text_template, sessionVariables);
  
  // 5. Return processed menu
  return {
    ...menu,
    text: "Select a group:\n1. Savings Club\n2. Investment Group"
  };
}
```

## API Integration Flow

### 1. API Configuration

```sql
-- API configuration in database
{
  api_name: 'get_group_collabos',
  endpoint: 'http://localhost:4000/api/collabos/group/{{groups_selected_id}}',
  method: 'GET',
  headers: '{"Content-Type": "application/json"}',
  response_mapping: '{
    "collabos_list": "$.formatted",
    "collabos_options": "$.options",
    "collabos": "$.collabos"
  }'
}
```

### 2. API Execution Process

```javascript
executeApiCall(apiConfig, sessionData) {
  // 1. Process endpoint template
  // {{groups_selected_id}} → "1" (from session)
  const url = interpolateTemplate(apiConfig.endpoint, sessionData);
  // Result: http://localhost:4000/api/collabos/group/1
  
  // 2. Make HTTP request
  const response = await axios.get(url);
  
  // 3. Apply response mapping
  // response.data = { formatted: "1. December Savings", options: [...], collabos: [...] }
  // mapping = { "collabos_list": "$.formatted", ... }
  const mappedData = applyResponseMapping(response.data, apiConfig.response_mapping);
  // Result: { collabos_list: "1. December Savings", ... }
  
  return mappedData;
}
```

## Template Engine

### 1. Variable Interpolation

```javascript
// Template: "Welcome {{name}}, you have {{currency:balance}}"
// Data: { name: "John", balance: 1234.56 }

processTemplateWithHelpers(template, data) {
  // Step 1: Process helper functions
  // {{currency:balance}} → formatCurrency(1234.56) → "$1,234.56"
  
  // Step 2: Process simple variables
  // {{name}} → "John"
  
  // Result: "Welcome John, you have $1,234.56"
}
```

### 2. Conditional Templates

```javascript
// Template: "Amount: {{contribution_amount_self_input}}{{contribution_amount_other_input}}"
// Only one will have a value

interpolateTemplate(template, data) {
  // data = { contribution_amount_self_input: "500", contribution_amount_other_input: "" }
  // Result: "Amount: 500" (empty variable is removed)
}
```

## Session Management

### 1. Session Variables Storage

```sql
-- session_variables table
session_id              | variable_name                | variable_value
------------------------|------------------------------|----------------
INTERACTIVE_123         | groups                       | '[{"id":1,"name":"Savings Club"},...]'
INTERACTIVE_123         | groups_selected             | '{"id":1,"name":"Savings Club"}'
INTERACTIVE_123         | groups_selected_id          | '1'
INTERACTIVE_123         | make_contribution_groups_input | '1'
```

### 2. Session Flow

```javascript
// User selects option "1" in groups menu
processOptionsMenu(menu, input='1', session) {
  // 1. Store user input
  await setSessionVariable(session.session_id, 'make_contribution_groups_input', '1');
  
  // 2. Handle dynamic selection
  // - Get 'groups' array from session
  // - Extract groups[0] (user selected "1")
  // - Store as groups_selected and groups_selected_id
  await handleDynamicArraySelection(session.session_id, 'make_contribution_groups', '1');
  
  // 3. Navigate to next menu
  return loadMenu(app.id, 'make_contribution_collabos', session);
}
```

## Dynamic Selection Handling

### The Challenge
When a user selects from a dynamic list, we need to:
1. Know which item they selected
2. Use that selection in subsequent API calls

### The Solution

```javascript
handleDynamicArraySelection(sessionId, menuCode, userInput) {
  // Map menu to its data array
  const selectionMap = {
    'make_contribution_groups': 'groups',
    'make_contribution_collabos': 'collabos'
  };
  
  const dataKey = selectionMap[menuCode]; // 'groups'
  const selectedIndex = parseInt(userInput) - 1; // User selected "1" → index 0
  
  // Get array from session
  const items = JSON.parse(sessionVariables.groups);
  // [{"id":1,"name":"Savings Club"}, {"id":2,"name":"Investment Group"}]
  
  const selectedItem = items[selectedIndex];
  // {"id":1,"name":"Savings Club"}
  
  // Store for future use
  await setSessionVariable(sessionId, 'groups_selected', JSON.stringify(selectedItem));
  await setSessionVariable(sessionId, 'groups_selected_id', '1');
}
```

Now, when the next API needs `{{groups_selected_id}}`, it's available!

## Code Examples

### Example 1: Complete Flow - Making a Contribution

```
1. User dials *384#
   → Load main_menu
   → Response: "CON Welcome to Contribution Manager\n1. Make a contribution..."

2. User selects "1"
   → Load contribution_check_account
   → API call: check_account
   → Response: "CON Welcome back! You have an active account.\n1. Continue\n2. Sign up"

3. User selects "1"
   → Load make_contribution_groups
   → API call: get_user_groups
   → Store: groups, groups_options, groups_list
   → Response: "CON Select a group:\n1. Savings Club\n2. Investment Group"

4. User selects "1"
   → Store: make_contribution_groups_input = "1"
   → Store: groups_selected_id = "1"
   → Load make_contribution_collabos
   → API call: get_group_collabos (using groups_selected_id)
   → Response: "CON Select a collabo:\n1. December Savings"

5. User selects "1"
   → Store: make_contribution_collabos_input = "1"
   → Store: collabos_selected_id = "1"
   → Load contribution_type
   → Response: "CON Contributing for:\n1. Myself\n2. Another member"

6. User enters amount "500"
   → Store: contribution_amount_self_input = "500"
   → Continue through flow...

7. Final API call: process_contribution
   → Uses all stored variables: groups_selected_id, collabos_selected_id, amount, etc.
   → Response: "END Contribution successful!"
```

### Example 2: Adding a New USSD App

```sql
-- 1. Create the app
INSERT INTO ussd_apps (ussd_code, app_name, entry_menu) 
VALUES ('*999#', 'New Service', 'welcome_menu');

-- 2. Create menus
INSERT INTO ussd_menus (app_id, menu_code, menu_type, text_template, options) 
VALUES 
(app_id, 'welcome_menu', 'options', 'Welcome! Choose:\n{{options_list}}', '[
  {"id": "1", "label": "Option 1", "next": "option1_menu"},
  {"id": "2", "label": "Option 2", "next": "option2_menu"}
]');

-- 3. Create API config
INSERT INTO api_configs (app_id, api_name, endpoint, response_mapping) 
VALUES 
(app_id, 'get_data', 'https://api.example.com/data', '{
  "options_list": "$.formatted"
}');

-- That's it! No code changes needed.
```

## Best Practices

1. **Menu Design**
   - Keep text concise (160 char limit)
   - Always provide clear options
   - Include "0. Back" option where appropriate

2. **API Integration**
   - Use meaningful response mapping keys
   - Handle API failures gracefully
   - Log all API calls for debugging

3. **Template Variables**
   - Use descriptive variable names
   - Document required variables
   - Provide default values where possible

4. **Session Management**
   - Clean up old sessions regularly
   - Don't store sensitive data in sessions
   - Use appropriate timeouts

## Troubleshooting

### Common Issues

1. **Template variables not resolving**
   - Check if variable exists in session
   - Verify API response mapping
   - Check for typos in variable names

2. **Wrong menu appearing**
   - Verify next_menu configuration
   - Check option next destinations
   - Review session current_menu

3. **API calls failing**
   - Check endpoint URL templates
   - Verify all required variables exist
   - Review API logs in api_call_logs table

### Debug Queries

```sql
-- Check current session state
SELECT * FROM ussd_sessions WHERE session_id = 'YOUR_SESSION_ID';
SELECT * FROM session_variables WHERE session_id = 'YOUR_SESSION_ID';

-- View menu flow
SELECT menu_code, menu_type, next_menu, api_calls 
FROM ussd_menus 
WHERE app_id = (SELECT id FROM ussd_apps WHERE ussd_code = '*384#')
ORDER BY id;

-- Check API logs
SELECT * FROM api_call_logs 
WHERE session_id = 'YOUR_SESSION_ID' 
ORDER BY created_at DESC;
```

## Conclusion

The Dynamic USSD System provides a powerful, flexible framework for building USSD services without code changes. By understanding the flow of data through sessions, templates, and API calls, you can create complex USSD applications entirely through database configuration.