const { query, transaction } = require('../config/database');

// Get active session
const getActiveSession = async (sessionId) => {
  const sql = `
    SELECT id, session_id, phone_number, app_id, current_menu, 
           session_data, input_history, is_active
    FROM ussd_sessions
    WHERE session_id = $1 AND is_active = true
  `;
  
  const result = await query(sql, [sessionId]);
  return result.rows[0] || null;
};

// Create new session
const createSession = async (sessionData) => {
  const { sessionId, phoneNumber, appId, currentMenu = null } = sessionData;
  
  const sql = `
    INSERT INTO ussd_sessions (
      session_id, phone_number, app_id, current_menu, 
      session_data, input_history
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  
  const result = await query(sql, [
    sessionId, phoneNumber, appId, currentMenu, '{}', '[]'
  ]);
  
  return result.rows[0];
};

// Update session
const updateSession = async (sessionId, updates) => {
  const { currentMenu, sessionData, inputHistory, isActive } = updates;
  
  const sql = `
    UPDATE ussd_sessions
    SET current_menu = COALESCE($2, current_menu),
        session_data = COALESCE($3, session_data),
        input_history = COALESCE($4, input_history),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
    WHERE session_id = $1
    RETURNING *
  `;
  
  const params = [
    sessionId,
    currentMenu,
    sessionData ? JSON.stringify(sessionData) : null,
    inputHistory ? JSON.stringify(inputHistory) : null,
    isActive
  ];
  
  const result = await query(sql, params);
  return result.rows[0];
};

// Add input to history
// Update models/sessionModel.js - Replace the addInputToHistory function

const addInputToHistory = async (sessionId, input, menuCode) => {
  // Check if this is a PIN menu and mask the input
  const pinMenus = ['contribution_pin', 'enter_pin', 'verify_pin', 'pin_input', 'confirm_pin'];
  const maskedInput = pinMenus.includes(menuCode) ? '****' : input;
  
  const sql = `
    UPDATE ussd_sessions
    SET input_history = input_history || $2::jsonb,
        updated_at = NOW()
    WHERE session_id = $1
    RETURNING *
  `;
  
  const inputEntry = JSON.stringify([{
    input: maskedInput,  // Store masked value in history
    menu: menuCode,
    timestamp: new Date().toISOString()
  }]);
  
  const result = await query(sql, [sessionId, inputEntry]);
  return result.rows[0];
};

// Get or create session
const getOrCreateSession = async (sessionId, phoneNumber, appId) => {
  const existingSession = await getActiveSession(sessionId);
  
  if (existingSession) {
    return existingSession;
  }
  
  return await createSession({ sessionId, phoneNumber, appId });
};

// End session
const endSession = async (sessionId) => {
  const sql = `
    UPDATE ussd_sessions
    SET is_active = false,
        updated_at = NOW()
    WHERE session_id = $1
    RETURNING *
  `;
  
  const result = await query(sql, [sessionId]);
  return result.rows[0];
};

// Clean up old sessions
const cleanupOldSessions = async (timeoutMs) => {
  const sql = `
    UPDATE ussd_sessions
    SET is_active = false
    WHERE is_active = true 
    AND updated_at < NOW() - INTERVAL '1 millisecond' * $1
    RETURNING session_id
  `;
  
  const result = await query(sql, [timeoutMs]);
  return result.rows;
};

// Session variables operations
const setSessionVariable = async (sessionId, variableName, variableValue) => {
  const sql = `
    INSERT INTO session_variables (session_id, variable_name, variable_value)
    VALUES ($1, $2, $3)
    ON CONFLICT (session_id, variable_name)
    DO UPDATE SET variable_value = $3
    RETURNING *
  `;
  
  const result = await query(sql, [sessionId, variableName, variableValue]);
  return result.rows[0];
};

const getSessionVariable = async (sessionId, variableName) => {
  const sql = `
    SELECT variable_value
    FROM session_variables
    WHERE session_id = $1 AND variable_name = $2
  `;
  
  const result = await query(sql, [sessionId, variableName]);
  return result.rows[0]?.variable_value || null;
};

const getAllSessionVariables = async (sessionId) => {
  const sql = `
    SELECT variable_name, variable_value
    FROM session_variables
    WHERE session_id = $1
  `;
  
  const result = await query(sql, [sessionId]);
  
  // Convert to object
  const variables = {};
  result.rows.forEach(row => {
    variables[row.variable_name] = row.variable_value;
  });
  
  return variables;
};

module.exports = {
  getActiveSession,
  createSession,
  updateSession,
  addInputToHistory,
  getOrCreateSession,
  endSession,
  cleanupOldSessions,
  setSessionVariable,
  getSessionVariable,
  getAllSessionVariables
};