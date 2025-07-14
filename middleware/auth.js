// Simple API key authentication for admin routes
const authenticateAdmin = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  // In production, use environment variable
  const validApiKey = process.env.ADMIN_API_KEY || 'development-key';
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }
  
  if (apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  next();
};

// Rate limiting middleware
const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean old entries
    for (const [k, v] of requests.entries()) {
      if (now - v.firstRequest > windowMs) {
        requests.delete(k);
      }
    }
    
    // Check rate limit
    const userRequests = requests.get(key) || { count: 0, firstRequest: now };
    
    if (userRequests.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests'
      });
    }
    
    // Update count
    userRequests.count++;
    requests.set(key, userRequests);
    
    next();
  };
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Database errors
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry'
    });
  }
  
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced entity not found'
    });
  }
  
  // Default error
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
};

// CORS middleware
const cors = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
};

module.exports = {
  authenticateAdmin,
  rateLimiter,
  requestLogger,
  errorHandler,
  cors
};