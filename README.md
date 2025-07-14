# Dynamic USSD System

A fully dynamic USSD application system built with Node.js and PostgreSQL. This system allows you to create and manage multiple USSD applications with dynamic menus, responses, and external API integrations - all configurable through a database without code changes.

## Features

- **Fully Dynamic**: All menus, flows, and API calls are database-driven
- **Multi-App Support**: Host multiple USSD applications on the same codebase
- **Dynamic API Integration**: Configure external API calls with response mapping
- **Template Engine**: Support for variable interpolation in text and API calls
- **Input Validation**: Built-in validators for phone numbers, amounts, etc.
- **Session Management**: Automatic session handling with timeout support
- **Admin API**: RESTful API for managing apps, menus, and configurations
- **No OOP**: Pure functional JavaScript approach with MVC pattern
- **Production Ready**: Rate limiting, error handling, and logging included

## Quick Start

### 1. Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### 2. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd dynamic-ussd-system

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Database Setup

```bash
# Create database
createdb ussd_db

# Run schema
psql -U postgres -d ussd_db -f database/schema.sql
```

### 4. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 5. Run Tests

```bash
npm test
```

## Project Structure

```
dynamic-ussd-system/
├── config/
│   └── database.js         # Database connection and helpers
├── controllers/
│   ├── ussdController.js   # Main USSD request handler
│   ├── menuController.js   # Menu flow processing
│   └── adminController.js  # Admin API endpoints
├── models/
│   ├── appModel.js         # USSD app operations
│   ├── menuModel.js        # Menu CRUD operations
│   ├── sessionModel.js     # Session management
│   └── apiModel.js         # API configuration
├── routes/
│   ├── ussdRoutes.js       # USSD endpoints
│   └── adminRoutes.js      # Admin endpoints
├── utils/
│   ├── templateEngine.js   # Template processing
│   ├── inputValidator.js   # Input validation
│   └── apiClient.js        # External API calls
├── views/
│   └── responseFormatter.js # USSD response formatting
├── middleware/
│   └── auth.js             # Authentication & middleware
├── server.js               # Main server file
├── test.js                 # Test suite
└── package.json
```

## API Documentation

### USSD Endpoint

**POST** `/api/v1/ussd`

Request body:
```json
{
  "sessionId": "unique-session-id",
  "serviceCode": "*123#",
  "phoneNumber": "+1234567890",
  "text": "1*2*100"
}
```

Response:
```
CON Welcome to Mobile Banking
1. Check Balance
2. Transfer Money
3. Exit
```

### Admin Endpoints

All admin endpoints require `X-API-Key` header.

#### Apps Management

- **GET** `/api/v1/admin/apps` - List all apps
- **POST** `/api/v1/admin/apps` - Create new app
- **PUT** `/api/v1/admin/apps/:id` - Update app
- **DELETE** `/api/v1/admin/apps/:id` - Delete app

#### Menus Management

- **GET** `/api/v1/admin/apps/:appId/menus` - List menus
- **POST** `/api/v1/admin/apps/:appId/menus` - Create menu
- **PUT** `/api/v1/admin/menus/:id` - Update menu
- **DELETE** `/api/v1/admin/menus/:id` - Delete menu

#### API Configuration

- **GET** `/api/v1/admin/apps/:appId/api-configs` - List API configs
- **POST** `/api/v1/admin/apps/:appId/api-configs` - Create API config
- **PUT** `/api/v1/admin/api-configs/:id` - Update API config
- **DELETE** `/api/v1/admin/api-configs/:id` - Delete API config

## Configuration Examples

### Creating a New USSD App

```javascript
POST /api/v1/admin/apps
{
  "ussdCode": "*123#",
  "appName": "Mobile Banking",
  "entryMenu": "main_menu"
}
```

### Creating a Menu

```javascript
POST /api/v1/admin/apps/1/menus
{
  "menuCode": "main_menu",
  "menuType": "options",
  "textTemplate": "Welcome {{name}}\n1. Check Balance\n2. Transfer",
  "options": [
    {"id": "1", "label": "Check Balance", "next": "balance_menu"},
    {"id": "2", "label": "Transfer", "next": "transfer_menu"}
  ]
}
```

### Creating an API Configuration

```javascript
POST /api/v1/admin/apps/1/api-configs
{
  "apiName": "check_balance",
  "endpoint": "https://api.bank.com/balance",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{api_token}}"
  },
  "bodyTemplate": {
    "account": "{{phone_number}}"
  },
  "responseMapping": {
    "balance": "$.data.balance",
    "currency": "$.data.currency"
  }
}
```

## Template Variables

The template engine supports variable interpolation:

- `{{variable}}` - Simple variable replacement
- `{{object.property}}` - Nested property access
- `{{currency:amount}}` - Helper functions (currency, date, uppercase, etc.)

Available variables in templates:
- Session data
- User inputs (stored as `{menu_code}_input`)
- API response data
- System variables (phone_number, session_id)

## Input Validation Rules

Available validators:
- `required` - Field is required
- `numeric` - Numbers only
- `phone` - Valid phone number
- `email` - Valid email address
- `amount` - Valid monetary amount
- `minLength` / `maxLength` - Length constraints
- `minAmount` / `maxAmount` - Amount constraints
- `regex` - Custom pattern matching

Example:
```json
{
  "validationRules": {
    "required": true,
    "phone": true,
    "minLength": 10
  }
}
```

## Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ussd_db
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=development

# Session
SESSION_TIMEOUT=300000  # 5 minutes

# API
API_TIMEOUT=5000
MAX_RETRIES=2

# Admin
ADMIN_API_KEY=your-secret-key

# USSD Response Types
RESPONSE_TYPE_CONTINUE=CON
RESPONSE_TYPE_END=END
```

## Testing

The test suite includes:
- Admin API endpoint tests
- USSD flow simulation
- Input validation tests
- Rate limiting verification

Run tests:
```bash
npm test
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a process manager (PM2, systemd)
3. Set up a reverse proxy (nginx)
4. Enable HTTPS
5. Configure proper database credentials
6. Set strong `ADMIN_API_KEY`
7. Monitor logs and performance

## Troubleshooting

### Common Issues

1. **Database connection errors**
   - Check PostgreSQL is running
   - Verify credentials in .env
   - Ensure database exists

2. **Session timeouts**
   - Adjust SESSION_TIMEOUT in .env
   - Check session cleanup is working

3. **API integration failures**
   - Verify endpoint URLs
   - Check authentication headers
   - Review response mapping paths

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request