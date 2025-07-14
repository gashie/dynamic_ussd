const axios = require('axios');
const { processJsonTemplate, applyResponseMapping } = require('./templateEngine');
const { logApiCall } = require('../models/apiModel');

// Execute API call with configuration
const executeApiCall = async (apiConfig, sessionData, sessionId) => {
  const startTime = Date.now();
  let response = null;
  let error = null;
  let statusCode = null;
  
  try {
    // Process templates
    const headers = processJsonTemplate(apiConfig.headers, sessionData);
    const body = processJsonTemplate(apiConfig.body_template, sessionData);
    
    // Apply authentication
    const authHeaders = applyAuthentication(apiConfig.auth_config, sessionData);
    const finalHeaders = { ...headers, ...authHeaders };
    
    // Prepare request config
    const requestConfig = {
      method: apiConfig.method,
      url: apiConfig.endpoint,
      headers: finalHeaders,
      timeout: apiConfig.timeout || 5000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    };
    
    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(apiConfig.method.toUpperCase())) {
      requestConfig.data = body;
    } else if (apiConfig.method.toUpperCase() === 'GET') {
      requestConfig.params = body;
    }
    
    // Execute request with retries
    response = await executeWithRetry(requestConfig, apiConfig.retry_count || 2);
    statusCode = response.status;
    
    // Apply response mapping
    const mappedResponse = applyResponseMapping(response.data, apiConfig.response_mapping);
    
    // Log successful call
    await logApiCall({
      sessionId,
      apiName: apiConfig.api_name,
      requestData: { headers: finalHeaders, body },
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
    
    // Log failed call
    await logApiCall({
      sessionId,
      apiName: apiConfig.api_name,
      requestData: { headers: {}, body: {} }, // Don't log sensitive data on error
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

// Execute request with retry logic
const executeWithRetry = async (requestConfig, maxRetries) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios(requestConfig);
      return response;
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// Apply authentication configuration
const applyAuthentication = (authConfig, sessionData) => {
  if (!authConfig || typeof authConfig !== 'object') {
    return {};
  }
  
  const headers = {};
  
  switch (authConfig.type) {
    case 'bearer':
      if (authConfig.token) {
        const token = processJsonTemplate(authConfig.token, sessionData);
        headers['Authorization'] = `Bearer ${token}`;
      }
      break;
      
    case 'basic':
      if (authConfig.username && authConfig.password) {
        const username = processJsonTemplate(authConfig.username, sessionData);
        const password = processJsonTemplate(authConfig.password, sessionData);
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;
      
    case 'apikey':
      if (authConfig.key && authConfig.value) {
        const key = processJsonTemplate(authConfig.key, sessionData);
        const value = processJsonTemplate(authConfig.value, sessionData);
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

// Execute multiple API calls
const executeMultipleApiCalls = async (apiCalls, appId, sessionData, sessionId) => {
  const results = {};
  
  for (const apiCall of apiCalls) {
    const { name, config: overrides = {} } = apiCall;
    
    // Get API configuration
    const { getApiConfig } = require('../models/apiModel');
    const apiConfig = await getApiConfig(appId, name);
    
    if (!apiConfig) {
      console.error(`API configuration not found: ${name}`);
      continue;
    }
    
    // Merge with overrides
    const finalConfig = { ...apiConfig, ...overrides };
    
    // Execute call
    const result = await executeApiCall(finalConfig, sessionData, sessionId);
    
    // Store result
    results[name] = result;
    
    // Add response data to session data for next calls
    if (result.success && result.data) {
      sessionData[name] = result.data;
    }
  }
  
  return results;
};

// Mock API call for testing
const executeMockApiCall = async (apiConfig, sessionData) => {
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data based on API name
  const mockData = {
    check_balance: {
      balance: '1,234.56',
      currency: 'USD',
      available: '1,000.00'
    },
    get_user_info: {
      name: 'John Doe',
      phone: sessionData.phone_number,
      email: 'john.doe@example.com'
    },
    transfer_money: {
      success: true,
      transactionId: 'TXN' + Date.now(),
      message: 'Transfer successful'
    }
  };
  
  return {
    success: true,
    data: mockData[apiConfig.api_name] || { message: 'Mock response' },
    statusCode: 200
  };
};

module.exports = {
  executeApiCall,
  executeMultipleApiCalls,
  executeWithRetry,
  applyAuthentication,
  executeMockApiCall
};