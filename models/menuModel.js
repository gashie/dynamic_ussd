const { query } = require('../config/database');

// Get menu by code and app ID
const getMenuByCode = async (appId, menuCode) => {
  const sql = `
    SELECT id, app_id, menu_code, menu_type, text_template, 
           options, validation_rules, api_calls, next_menu
    FROM ussd_menus
    WHERE app_id = $1 AND menu_code = $2
  `;
  
  const result = await query(sql, [appId, menuCode]);
  return result.rows[0] || null;
};

// Get all menus for an app
const getMenusByAppId = async (appId) => {
  const sql = `
    SELECT id, menu_code, menu_type, text_template, options, next_menu
    FROM ussd_menus
    WHERE app_id = $1
    ORDER BY menu_code
  `;
  
  const result = await query(sql, [appId]);
  return result.rows;
};

// Create new menu
const createMenu = async (menuData) => {
  const {
    appId,
    menuCode,
    menuType = 'options',
    textTemplate,
    options = [],
    validationRules = {},
    apiCalls = [],
    nextMenu = null
  } = menuData;
  
  const sql = `
    INSERT INTO ussd_menus (
      app_id, menu_code, menu_type, text_template, 
      options, validation_rules, api_calls, next_menu
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  
  const result = await query(sql, [
    appId, menuCode, menuType, textTemplate,
    JSON.stringify(options), JSON.stringify(validationRules),
    JSON.stringify(apiCalls), nextMenu
  ]);
  
  return result.rows[0];
};

// Update menu
const updateMenu = async (menuId, updates) => {
  const {
    textTemplate,
    options,
    validationRules,
    apiCalls,
    nextMenu,
    menuType
  } = updates;
  
  const sql = `
    UPDATE ussd_menus
    SET text_template = COALESCE($2, text_template),
        options = COALESCE($3, options),
        validation_rules = COALESCE($4, validation_rules),
        api_calls = COALESCE($5, api_calls),
        next_menu = COALESCE($6, next_menu),
        menu_type = COALESCE($7, menu_type),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const params = [
    menuId,
    textTemplate,
    options ? JSON.stringify(options) : null,
    validationRules ? JSON.stringify(validationRules) : null,
    apiCalls ? JSON.stringify(apiCalls) : null,
    nextMenu,
    menuType
  ];
  
  const result = await query(sql, params);
  return result.rows[0];
};

// Delete menu
const deleteMenu = async (menuId) => {
  const sql = `
    DELETE FROM ussd_menus
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await query(sql, [menuId]);
  return result.rows[0];
};

// Get menu flow (for visualization)
const getMenuFlow = async (appId) => {
  const sql = `
    SELECT menu_code, menu_type, next_menu, options
    FROM ussd_menus
    WHERE app_id = $1
  `;
  
  const result = await query(sql, [appId]);
  return result.rows;
};

module.exports = {
  getMenuByCode,
  getMenusByAppId,
  createMenu,
  updateMenu,
  deleteMenu,
  getMenuFlow
};