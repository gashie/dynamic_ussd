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

// Main USSD request handler
const handleUSSDRequest = async (req, res) => {
  try {
    // Extract USSD parameters (adjust based on your provider)
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
    try {
      menu = await processMenuFlow(session, sanitizedInput, app);
    } catch (error) {
      console.error('Menu processing error:', error);
      
      // Check if it's a timeout
      if (error.message.includes('timeout')) {
        await endSession(sessionId);
        return res.send(formatTimeoutResponse());
      }
      
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
    
    // End session if final menu
    if (isEnd) {
      await endSession(sessionId);
    }
    
    // Format and send response
    const response = formatUSSDResponse(menu, isEnd);
    res.send(response);
    
  } catch (error) {
    console.error('USSD Handler Error:', error);
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

// Get session info (for debugging)
const getSessionInfo = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { getActiveSession } = require('../models/sessionModel');
    const session = await getActiveSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Don't expose sensitive data
    const safeSession = {
      sessionId: session.session_id,
      phoneNumber: session.phone_number.slice(0, -4) + '****',
      currentMenu: session.current_menu,
      isActive: session.is_active,
      createdAt: session.created_at,
      updatedAt: session.updated_at
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
    body: { sessionId, serviceCode, phoneNumber, text }
  };
  
  const mockRes = {
    send: (response) => response,
    status: () => mockRes
  };
  
  await handleUSSDRequest(mockReq, mockRes);
  return mockRes.send.calls[0] || 'No response';
};

module.exports = {
  handleUSSDRequest,
  handleUSSDCallback,
  getSessionInfo,
  testUSSDFlow
};