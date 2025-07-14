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