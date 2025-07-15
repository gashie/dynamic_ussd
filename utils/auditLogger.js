const { query } = require('../config/database');

const logAuditTrail = async (auditData) => {
  const {
    sessionId,
    phoneNumber,
    appId,
    menuCode,
    menuType,
    userInput,
    responseText,
    apiCallsMade,
    processingTime,
    ipAddress,
    userAgent
  } = auditData;
  
  // Mask sensitive data before logging
  const maskedInput = maskSensitiveData(menuCode, userInput);
  const maskedResponse = maskSensitiveResponse(responseText);
  
  const sql = `
    INSERT INTO ussd_audit_trail (
      session_id, phone_number, app_id, menu_code, menu_type,
      user_input, response_text, api_calls_made, processing_time_ms,
      ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `;
  
  await query(sql, [
    sessionId, phoneNumber, appId, menuCode, menuType,
    maskedInput, maskedResponse, JSON.stringify(apiCallsMade),
    processingTime, ipAddress, userAgent
  ]);
};

// Complete replacement for utils/auditLogger.js maskSensitiveData function

const maskSensitiveData = (menuCode, input) => {
  if (!input) return input;
  
  const sensitiveMenus = ['contribution_pin', 'enter_pin', 'verify_pin', 'pin_input'];
  
  // For PIN input menus, always mask
  if (sensitiveMenus.includes(menuCode)) {
    return '****';
  }
  
  // For any menu, if the input contains multiple parts separated by *
  if (input.includes('*')) {
    const parts = input.split('*');
    
    // Check each part for sensitive data
    const maskedParts = parts.map((part, index) => {
      // If it's exactly 4 digits, it might be a PIN
      if (/^\d{4}$/.test(part)) {
        // Check if this appears after known PIN menu positions
        // Typically PIN comes after several menu selections
        if (index >= 5) {  // Adjust based on your flow
          return '****';
        }
      }
      return part;
    });
    
    return maskedParts.join('*');
  }
  
  // For single inputs, check if it's a 4-digit PIN pattern
  if (/^\d{4}$/.test(input)) {
    // Only mask if we're in a context where this could be a PIN
    const contextMenus = ['payment_process', 'transaction_process', 'contribution_process'];
    if (contextMenus.includes(menuCode)) {
      return '****';
    }
  }
  
  return input;
};

const maskSensitiveResponse = (response) => {
  // Mask any 4-digit numbers that might be PINs in responses
  return response.replace(/\b\d{4}\b/g, '****');
};

const getSessionAuditTrail = async (sessionId) => {
  const sql = `
    SELECT * FROM ussd_audit_trail 
    WHERE session_id = $1 
    ORDER BY created_at
  `;
  
  const result = await query(sql, [sessionId]);
  return result.rows;
};

module.exports = { 
  logAuditTrail, 
  getSessionAuditTrail,
  maskSensitiveData,
  maskSensitiveResponse
};