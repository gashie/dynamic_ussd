const { query } = require('../config/database');

// Get USSD app by code
const getAppByCode = async (ussdCode) => {
  const sql = `
    SELECT id, ussd_code, app_name, entry_menu, config, is_active
    FROM ussd_apps
    WHERE ussd_code = $1 AND is_active = true
  `;
  
  const result = await query(sql, [ussdCode]);
  return result.rows[0] || null;
};

// Get all active apps
const getAllActiveApps = async () => {
  const sql = `
    SELECT id, ussd_code, app_name, entry_menu, config
    FROM ussd_apps
    WHERE is_active = true
    ORDER BY ussd_code
  `;
  
  const result = await query(sql);
  return result.rows;
};

// Create new app
const createApp = async (appData) => {
  const { ussdCode, appName, entryMenu, config = {} } = appData;
  
  const sql = `
    INSERT INTO ussd_apps (ussd_code, app_name, entry_menu, config)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  
  const result = await query(sql, [ussdCode, appName, entryMenu, config]);
  return result.rows[0];
};

// Update app
const updateApp = async (appId, updates) => {
  const { appName, entryMenu, config, isActive } = updates;
  
  const sql = `
    UPDATE ussd_apps
    SET app_name = COALESCE($2, app_name),
        entry_menu = COALESCE($3, entry_menu),
        config = COALESCE($4, config),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await query(sql, [appId, appName, entryMenu, config, isActive]);
  return result.rows[0];
};

// Delete app (soft delete)
const deleteApp = async (appId) => {
  const sql = `
    UPDATE ussd_apps
    SET is_active = false,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await query(sql, [appId]);
  return result.rows[0];
};

module.exports = {
  getAppByCode,
  getAllActiveApps,
  createApp,
  updateApp,
  deleteApp
};