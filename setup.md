# Event Registration USSD System - Complete Setup Guide

## 📋 Prerequisites
- PostgreSQL running on localhost:5432
- Node.js installed
- Your dynamic USSD system running
- Ports 3000 (USSD) and 4001 (Event API) available

## 🚀 Step-by-Step Setup

### Step 1: Start the Event API Server

Create `event-mock-api-server.js`:
```bash
# Download or copy the event API code
node event-mock-api-server.js
```

**Expected Output:**
```
Event Registration API running on port 4001
Health check: http://localhost:4001/health
Admin stats: http://localhost:4001/api/admin/stats

Available Events:
1. Tech Conference 2025 - 2025-03-15 (245/500)
2. Startup Pitch Night - 2025-02-28 (67/100)  
3. Digital Marketing Workshop - 2025-04-10 (12/50)
```

### Step 2: Verify API is Working

```bash
# Test API health
curl http://localhost:4001/health

# Expected response:
{
  "status": "healthy",
  "service": "Event Registration API", 
  "timestamp": "2025-01-15T10:30:00.000Z"
}

# Test events endpoint
curl http://localhost:4001/api/events

# Expected response (truncated):
{
  "events": [...],
  "formatted": "1. Tech Conference 2025 (2025-03-15)\n2. Startup Pitch Night (2025-02-28)\n3. Digital Marketing Workshop (2025-04-10)",
  "options": "[{\"id\":\"1\",\"label\":\"Tech Conference 2025 (2025-03-15)\",\"next\":\"event_details\"}...]"
}
```

### Step 3: Setup Database

Create `event-registration-setup.sql` and run:
```bash
psql -U postgres -d ussd_db -f event-registration-setup.sql
```

**Expected Output:**
```
NOTICE:  Event Registration System created successfully with app_id: 2 and USSD code: *567#
DO
```

### Step 4: Verify Database Setup

```bash
# Check if app was created
psql -U postgres -d ussd_db -c "SELECT * FROM ussd_apps WHERE ussd_code = '*567#';"

# Check menus
psql -U postgres -d ussd_db -c "SELECT menu_code, menu_type FROM ussd_menus WHERE app_id = (SELECT id FROM ussd_apps WHERE ussd_code = '*567#');"

# Check API configs  
psql -U postgres -d ussd_db -c "SELECT api_name, endpoint FROM api_configs WHERE app_id = (SELECT id FROM ussd_apps WHERE ussd_code = '*567#');"
```

### Step 5: Start USSD Server

```bash
npm run dev
```

**Expected Output:**
```
Database connected successfully
USSD Server running on port 3000
Environment: development
Health check: http://localhost:3000/health
```

### Step 6: Test Complete System

#### Option A: Interactive Tester
```bash
node interactive-ussd-tester.js

# When prompted, use: *567#
```

#### Option B: Manual curl Tests

**1. Initial Menu:**
```bash
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "TEST_001", 
    "serviceCode": "*567#", 
    "phoneNumber": "+233244567890", 
    "text": ""
  }'
```

**Expected Response:**
```
CON Welcome to Event Registration
1. Browse Events
2. My Registrations  
3. Verify Code
4. Exit
```

**2. Browse Events:**
```bash
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "TEST_001",
    "serviceCode": "*567#", 
    "phoneNumber": "+233244567890",
    "text": "1"
  }'
```

**Expected Response:**
```
CON Available Events:
1. Tech Conference 2025 (2025-03-15)
2. Startup Pitch Night (2025-02-28)
3. Digital Marketing Workshop (2025-04-10)
```

**3. Select Event Details:**
```bash
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "TEST_001",
    "serviceCode": "*567#",
    "phoneNumber": "+233244567890", 
    "text": "1*1"
  }'
```

**Expected Response:**
```
CON Event: Tech Conference 2025
Date: 2025-03-15
Location: Accra Convention Center
Price: $50
Available Spots: 255/500

Annual technology conference featuring AI, blockchain, and web development.

1. Register
2. Back to events
3. Main menu
```

**4. Complete Registration Flow:**
```bash
# Start registration
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "TEST_001", "serviceCode": "*567#", "phoneNumber": "+233244567890", "text": "1*1*1"}'

# Enter name
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "TEST_001", "serviceCode": "*567#", "phoneNumber": "+233244567890", "text": "1*1*1*John Doe"}'

# Enter email  
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "TEST_001", "serviceCode": "*567#", "phoneNumber": "+233244567890", "text": "1*1*1*John Doe*john@example.com"}'

# Confirm registration
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "TEST_001", "serviceCode": "*567#", "phoneNumber": "+233244567890", "text": "1*1*1*John Doe*john@example.com*1"}'
```

**Expected Final Response:**
```
END Registration successful!
Event: Tech Conference 2025
Name: John Doe
Date: 2025-03-15
Location: Accra Convention Center

Your verification code: EVT123ABC

Please save this code for event entry.
```

**5. Test Code Verification:**
```bash
# New session for verification
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "TEST_002", "serviceCode": "*567#", "phoneNumber": "+233244567890", "text": "3"}'

# Enter the code you received
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "TEST_002", "serviceCode": "*567#", "phoneNumber": "+233244567890", "text": "3*EVT123ABC"}'
```

## 🔧 Configuration URLs

### API Endpoints (Port 4001)
- **Health Check:** `GET http://localhost:4001/health`
- **Events List:** `GET http://localhost:4001/api/events`  
- **Event Details:** `GET http://localhost:4001/api/events/{id}`
- **Register:** `POST http://localhost:4001/api/events/register`
- **My Registrations:** `GET http://localhost:4001/api/registrations/{phone}`
- **Verify Code:** `POST http://localhost:4001/api/verify`
- **Admin Stats:** `GET http://localhost:4001/api/admin/stats`

### USSD Endpoints (Port 3000)
- **USSD Gateway:** `POST http://localhost:3000/api/v1/ussd`
- **Health Check:** `GET http://localhost:3000/health`
- **Admin API:** `http://localhost:3000/api/v1/admin/*`

## 📱 Test Phone Numbers
- Primary: `+233244567890`
- Secondary: `+233555666777` 
- Test: `+233999888777`

## 🎯 Service Code
**`*567#`** - Event Registration System

## 🐛 Troubleshooting

### Common Issues:

1. **"Service not available"**
   - Check if database setup ran successfully
   - Verify app exists: `SELECT * FROM ussd_apps WHERE ussd_code = '*567#';`

2. **"No options available"**
   - Check if Event API is running on port 4001
   - Test: `curl http://localhost:4001/health`

3. **API timeout errors**
   - Ensure both servers are running
   - Check network connectivity between services

4. **Template variables not resolving**
   - Check API response mapping in database
   - Verify session variables are being stored

### Debug Commands:
```bash
# Check all apps
curl -H "X-API-Key: development-key" http://localhost:3000/api/v1/admin/apps

# Check app menus
curl -H "X-API-Key: development-key" http://localhost:3000/api/v1/admin/apps/2/menus

# Check API configs
curl -H "X-API-Key: development-key" http://localhost:3000/api/v1/admin/apps/2/api-configs

# Event API stats
curl http://localhost:4001/api/admin/stats
```

## ✅ Success Indicators
- ✅ Event API shows 3 available events
- ✅ USSD responds to *567# with welcome menu
- ✅ Event list loads dynamically from API
- ✅ Registration flow completes with code generation
- ✅ Code verification works correctly
- ✅ User can view their registrations

## 🎉 Next Steps
Once working, you can:
- Add more events via API
- Customize event fields
- Add payment integration
- Implement notifications
- Add event capacity management