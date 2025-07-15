// utils/apiClient.js - Dynamic API Client with Better Response Handling

const axios = require('axios');
const { processJsonTemplate, applyResponseMapping, interpolateTemplate } = require('./templateEngine');
const { logApiCall } = require('../models/apiModel');

const executeApiCall = async (apiConfig, sessionData, sessionId) => {
  const startTime = Date.now();
  let response = null;
  let error = null;
  let statusCode = null;
  
  try {
    // Process URL and body templates
    const processedUrl = interpolateTemplate(apiConfig.endpoint, sessionData);
    const headers = processJsonTemplate(apiConfig.headers, sessionData);
    const body = processJsonTemplate(apiConfig.body_template, sessionData);
    
    console.log(`API Call: ${apiConfig.api_name}`);
    console.log(`URL: ${processedUrl}`);
    console.log(`Body:`, body);
    
    const requestConfig = {
      method: apiConfig.method,
      url: processedUrl,
      headers: headers,
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
    
    console.log(`API Response for ${apiConfig.api_name}:`, response.data);
    
    // Apply response mapping
    const mappedResponse = applyResponseMapping(response.data, apiConfig.response_mapping);
    
    console.log(`Mapped Response for ${apiConfig.api_name}:`, mappedResponse);
    
    // Log the API call
    await logApiCall({
      sessionId,
      apiName: apiConfig.api_name,
      requestData: { url: processedUrl, headers, body },
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
    
    console.error(`API Error for ${apiConfig.api_name}:`, err.message);
    
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
      
      // Don't retry client errors (4xx)
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

const executeMultipleApiCalls = async (apiCalls, appId, sessionData, sessionId) => {
  const results = {};
  let accumulatedData = { ...sessionData };
  
  console.log(`Executing ${apiCalls.length} API calls for session ${sessionId}`);
  
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
    
    // If successful, add data to accumulated data for next API calls
    if (result.success && result.data) {
      Object.assign(accumulatedData, result.data);
    }
  }
  
  return results;
};

module.exports = {
  executeApiCall,
  executeMultipleApiCalls,
  executeWithRetry
};