const express = require('express');
const router = express.Router();
const {
  handleUSSDRequest,
  handleUSSDCallback,
  getSessionInfo,
  testUSSDFlow
} = require('../controllers/ussdController');

// USSD endpoints
router.post('/ussd', handleUSSDRequest);
router.post('/ussd/callback', handleUSSDCallback);

// Debug endpoints (protect in production)
if (process.env.NODE_ENV !== 'production') {
  router.get('/session/:sessionId', getSessionInfo);
  router.post('/test', testUSSDFlow);
}

module.exports = router;