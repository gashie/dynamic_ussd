const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const { testConnection } = require('./config/database');
const ussdRoutes = require('./routes/ussdRoutes');
const adminRoutes = require('./routes/adminRoutes');
const {
  authenticateAdmin,
  rateLimiter,
  requestLogger,
  errorHandler,
  cors
} = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/v1', rateLimiter(200, 60000), ussdRoutes); // 200 requests per minute
app.use('/api/v1/admin', authenticateAdmin, adminRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database');
      process.exit(1);
    }
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`USSD Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();