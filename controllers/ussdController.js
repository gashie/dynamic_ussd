const { getAppByCode } = require('../models/appModel');
const { 
  getOrCreateSession, 
  addInputToHistory, 
  endSession,
  cleanupOldSessions 
} = require('../models/sessionModel');
const { processMenuFlow } = require('./menuController');
const { sanitizeInput } = require('../utils/inputValidator');
const { 
  formatUSSDResponse, 
  formatErrorResponse,
  formatTimeoutResponse 
} = require('../views/responseFormatter');
const { logAuditTrail } = require('../utils/auditLogger');
const { checkUserBlocked, trackFailedAttempt } = require('../utils/userBlocking');

// Main USSD request handler with audit and security
const handleUSSDRequest = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Extract USSD parameters
    const {
      sessionId,
      serviceCode,
      phoneNumber,
      text = ''
    } = req.body;
    
    // Log request
    console.log('USSD Request:', { sessionId, serviceCode, phoneNumber, text });
    
    // Validate required parameters
    if (!sessionId || !serviceCode || !phoneNumber) {
      return res.status(400).send(
        formatErrorResponse('Invalid request parameters', false)
      );
    }
    
    // Check if user is blocked
    const blockStatus = await checkUserBlocked(phoneNumber);
    
    if (blockStatus.isBlocked) {
      const message = blockStatus.unblockAt 
        ? `Your access is temporarily blocked. Reason: ${blockStatus.reason}. Try again after ${new Date(blockStatus.unblockAt).toLocaleString()}`
        : `Your access is blocked. Reason: ${blockStatus.reason}. Contact support.`;
      
      // Log blocked attempt
      await logAuditTrail({
        sessionId,
        phoneNumber,
        appId: null,
        menuCode: 'BLOCKED',
        menuType: 'blocked',
        userInput: text,
        responseText: message,
        apiCallsMade: [],
        processingTime: Date.now() - startTime,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.send(formatErrorResponse(message, false));
    }
    
    // Clean up old sessions periodically
    if (Math.random() < 0.1) { // 10% chance
      cleanupOldSessions(process.env.SESSION_TIMEOUT || 300000)
        .catch(err => console.error('Cleanup error:', err));
    }
    
    // Get app configuration
    const app = await getAppByCode(serviceCode);
    if (!app || !app.is_active) {
      return res.send(
        formatErrorResponse('Service not available', false)
      );
    }
    
    // Get or create session
    const session = await getOrCreateSession(sessionId, phoneNumber, app.id);
    
    // Parse input
    const inputs = text.split('*').filter(Boolean);
    const currentInput = inputs[inputs.length - 1] || '';
    const sanitizedInput = sanitizeInput(currentInput);
    
    // Process menu flow
    let menu;
    let apiCallsMade = [];
    
    try {
      const menuResult = await processMenuFlow(session, sanitizedInput, app);
      menu = menuResult.menu || menuResult;
      apiCallsMade = menuResult.apiCallsMade || [];
    } catch (error) {
      console.error('Menu processing error:', error);
      
      // Check if it's a timeout
      if (error.message.includes('timeout')) {
        await endSession(sessionId);
        
        // Log timeout
        await logAuditTrail({
          sessionId,
          phoneNumber,
          appId: app.id,
          menuCode: 'TIMEOUT',
          menuType: 'timeout',
          userInput: sanitizedInput,
          responseText: 'Session timed out',
          apiCallsMade: [],
          processingTime: Date.now() - startTime,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
        
        return res.send(formatTimeoutResponse());
      }
      
      // Track failed attempts for certain errors
      if (error.message.includes('Invalid PIN') || error.message.includes('Wrong PIN')) {
        await trackFailedAttempt(phoneNumber, 'wrong_pin', session.current_menu, sessionId);
      }
      
      // Log error
      await logAuditTrail({
        sessionId,
        phoneNumber,
        appId: app.id,
        menuCode: 'ERROR',
        menuType: 'error',
        userInput: sanitizedInput,
        responseText: error.message,
        apiCallsMade: [],
        processingTime: Date.now() - startTime,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Other errors - allow retry
      return res.send(
        formatErrorResponse('An error occurred. Please try again.', true)
      );
    }
    
    // Add input to history
    if (sanitizedInput && session.current_menu) {
      await addInputToHistory(sessionId, sanitizedInput, session.current_menu);
    }
    
    // Check if this is a final menu
    const isEnd = menu.menu_type === 'final';
    
    // Format response
    const response = formatUSSDResponse(menu, isEnd);
    
    // Log successful interaction
    await logAuditTrail({
      sessionId,
      phoneNumber,
      appId: app.id,
      menuCode: menu.menu_code || session.current_menu,
      menuType: menu.menu_type,
      userInput: sanitizedInput,
      responseText: menu.text || response,
      apiCallsMade: apiCallsMade,
      processingTime: Date.now() - startTime,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // End session if final menu
    if (isEnd) {
      await endSession(sessionId);
    }
    
    // Send response
    res.send(response);
    
  } catch (error) {
    console.error('USSD Handler Error:', error);
    
    // Try to log the error
    try {
      await logAuditTrail({
        sessionId: req.body.sessionId || 'UNKNOWN',
        phoneNumber: req.body.phoneNumber || 'UNKNOWN',
        appId: null,
        menuCode: 'FATAL_ERROR',
        menuType: 'error',
        userInput: req.body.text || '',
        responseText: error.message,
        apiCallsMade: [],
        processingTime: Date.now() - startTime,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    res.status(500).send(
      formatErrorResponse('System error. Please try again later.', false)
    );
  }
};

// Handle USSD callback/notification
const handleUSSDCallback = async (req, res) => {
  try {
    const { sessionId, status, reason } = req.body;
    
    console.log('USSD Callback:', { sessionId, status, reason });
    
    // Handle session end
    if (status === 'END' || status === 'TIMEOUT') {
      await endSession(sessionId);
    }
    
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Callback Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get session info (for debugging - protect in production)
const getSessionInfo = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Check if debugging is allowed
    if (process.env.NODE_ENV === 'production' && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const { getActiveSession } = require('../models/sessionModel');
    const session = await getActiveSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get audit trail for this session
    const { query } = require('../config/database');
    const auditResult = await query(
      'SELECT * FROM ussd_audit_trail WHERE session_id = $1 ORDER BY created_at',
      [sessionId]
    );
    
    // Don't expose sensitive data
    const safeSession = {
      sessionId: session.session_id,
      phoneNumber: session.phone_number.slice(0, -4) + '****',
      currentMenu: session.current_menu,
      isActive: session.is_active,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      auditTrail: auditResult.rows.map(row => ({
        menuCode: row.menu_code,
        userInput: row.user_input === '****' ? '****' : row.user_input,
        timestamp: row.created_at,
        processingTime: row.processing_time_ms
      }))
    };
    
    res.json(safeSession);
    
  } catch (error) {
    console.error('Get Session Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Test USSD flow (development only)
const testUSSDFlow = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  try {
    const { serviceCode, phoneNumber, inputs = [] } = req.body;
    
    const sessionId = 'TEST_' + Date.now();
    const responses = [];
    
    // Initial request
    let text = '';
    let response = await simulateUSSDRequest(
      sessionId, serviceCode, phoneNumber, text
    );
    responses.push({ input: '', output: response });
    
    // Process each input
    for (const input of inputs) {
      if (response.startsWith('END')) break;
      
      text = text ? `${text}*${input}` : input;
      response = await simulateUSSDRequest(
        sessionId, serviceCode, phoneNumber, text
      );
      responses.push({ input, output: response });
    }
    
    res.json({ sessionId, responses });
    
  } catch (error) {
    console.error('Test Flow Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Simulate USSD request
const simulateUSSDRequest = async (sessionId, serviceCode, phoneNumber, text) => {
  const mockReq = {
    body: { sessionId, serviceCode, phoneNumber, text },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-client' }
  };
  
  let responseText = '';
  const mockRes = {
    send: (response) => { responseText = response; },
    status: () => mockRes
  };
  
  await handleUSSDRequest(mockReq, mockRes);
  return responseText;
};

module.exports = {
  handleUSSDRequest,
  handleUSSDCallback,
  getSessionInfo,
  testUSSDFlow
};