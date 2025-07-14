const { query } = require('../config/database');

// Get API configuration
const getApiConfig = async (appId, apiName) => {
  const sql = `
    SELECT id, app_id, api_name, endpoint, method, headers,
           body_template, auth_config, response_mapping, timeout, retry_count
    FROM api_configs
    WHERE app_id = $1 AND api_name = $2
  `;
  
  const result = await query(sql, [appId, apiName]);
  return result.rows[0] || null;
};

// Get all API configs for an app
const getApiConfigsByAppId = async (appId) => {
  const sql = `
    SELECT id, api_name, endpoint, method
    FROM api_configs
    WHERE app_id = $1
    ORDER BY api_name
  `;
  
  const result = await query(sql, [appId]);
  return result.rows;
};

// Create API configuration
const createApiConfig = async (configData) => {
  const {
    appId,
    apiName,
    endpoint,
    method = 'GET',
    headers = {},
    bodyTemplate = {},
    authConfig = {},
    responseMapping = {},
    timeout = 5000,
    retryCount = 2
  } = configData;
  
  const sql = `
    INSERT INTO api_configs (
      app_id, api_name, endpoint, method, headers,
      body_template, auth_config, response_mapping, timeout, retry_count
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;
  
  const result = await query(sql, [
    appId, apiName, endpoint, method,
    JSON.stringify(headers), JSON.stringify(bodyTemplate),
    JSON.stringify(authConfig), JSON.stringify(responseMapping),
    timeout, retryCount
  ]);
  
  return result.rows[0];
};

// Update API configuration
const updateApiConfig = async (configId, updates) => {
  const {
    endpoint,
    method,
    headers,
    bodyTemplate,
    authConfig,
    responseMapping,
    timeout,
    retryCount
  } = updates;
  
  const sql = `
    UPDATE api_configs
    SET endpoint = COALESCE($2, endpoint),
        method = COALESCE($3, method),
        headers = COALESCE($4, headers),
        body_template = COALESCE($5, body_template),
        auth_config = COALESCE($6, auth_config),
        response_mapping = COALESCE($7, response_mapping),
        timeout = COALESCE($8, timeout),
        retry_count = COALESCE($9, retry_count)
    WHERE id = $1
    RETURNING *
  `;
  
  const params = [
    configId,
    endpoint,
    method,
    headers ? JSON.stringify(headers) : null,
    bodyTemplate ? JSON.stringify(bodyTemplate) : null,
    authConfig ? JSON.stringify(authConfig) : null,
    responseMapping ? JSON.stringify(responseMapping) : null,
    timeout,
    retryCount
  ];
  
  const result = await query(sql, params);
  return result.rows[0];
};

// Delete API configuration
const deleteApiConfig = async (configId) => {
  const sql = `
    DELETE FROM api_configs
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await query(sql, [configId]);
  return result.rows[0];
};

// Log API call
const logApiCall = async (logData) => {
  const {
    sessionId,
    apiName,
    requestData,
    responseData,
    statusCode,
    errorMessage,
    durationMs
  } = logData;
  
  const sql = `
    INSERT INTO api_call_logs (
      session_id, api_name, request_data, response_data,
      status_code, error_message, duration_ms
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;
  
  const result = await query(sql, [
    sessionId,
    apiName,
    JSON.stringify(requestData),
    JSON.stringify(responseData),
    statusCode,
    errorMessage,
    durationMs
  ]);
  
  return result.rows[0];
};

// Get API call logs
const getApiCallLogs = async (sessionId, limit = 10) => {
  const sql = `
    SELECT api_name, status_code, error_message, duration_ms, created_at
    FROM api_call_logs
    WHERE session_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  
  const result = await query(sql, [sessionId, limit]);
  return result.rows;
};

module.exports = {
  getApiConfig,
  getApiConfigsByAppId,
  createApiConfig,
  updateApiConfig,
  deleteApiConfig,
  logApiCall,
  getApiCallLogs
};