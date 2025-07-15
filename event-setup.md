# Dynamic USSD Platform Setup Guide
## Complete Event Registration System Configuration

## 📋 Overview
This guide shows how to configure your dynamic USSD platform to create a complete Event Registration system using only the platform's admin APIs - no external services needed.

## 🎯 What You'll Build
- **Service Code:** `*567#` 
- **Features:** Event browsing, registration, verification, user management
- **Menus:** 10 interactive menus with dynamic options
- **APIs:** 5 external API integrations
- **Flows:** Registration, verification, user management

---

## 🚀 Step 1: Platform Preparation

### Prerequisites
```bash
# 1. Ensure your USSD platform is running
npm run dev

# 2. Verify database is accessible
psql -U postgres -d ussd_db -c "SELECT COUNT(*) FROM ussd_apps;"

# 3. Check admin API access
curl -H "X-API-Key: development-key" http://localhost:3000/api/v1/admin/apps
```

### Platform Endpoints
- **USSD Gateway:** `POST http://localhost:3000/api/v1/ussd`
- **Admin API Base:** `http://localhost:3000/api/v1/admin/`
- **Health Check:** `GET http://localhost:3000/health`

---

## 🏗️ Step 2: Create the USSD Application

### 2.1 Create App via Admin API

**Endpoint:** `POST /api/v1/admin/apps`

**Headers:**
```
Content-Type: application/json
X-API-Key: development-key
```

**Payload:**
```json
{
  "ussdCode": "*567#",
  "appName": "Event Registration System",
  "entryMenu": "main_menu",
  "config": {
    "version": "1.0",
    "features": ["registration", "verification", "events"],
    "session_timeout": 600000,
    "max_retries": 3
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "ussd_code": "*567#",
    "app_name": "Event Registration System",
    "entry_menu": "main_menu",
    "config": {...},
    "is_active": true,
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

**Save the `app_id` (e.g., `2`) for subsequent requests.**

---

## 🗂️ Step 3: Create Menu Structure

### 3.1 Main Menu

**Endpoint:** `POST /api/v1/admin/apps/2/menus`

**Payload:**
```json
{
  "menuCode": "main_menu",
  "menuType": "options",
  "textTemplate": "Welcome to Event Registration\n1. Browse Events\n2. My Registrations\n3. Verify Code\n4. Exit",
  "options": [
    {"id": "1", "label": "Browse Events", "next": "event_list"},
    {"id": "2", "label": "My Registrations", "next": "my_registrations"},
    {"id": "3", "label": "Verify Code", "next": "verify_code_input"},
    {"id": "4", "label": "Exit", "next": "exit_menu"}
  ],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

### 3.2 Event List Menu (Dynamic Options)

**Payload:**
```json
{
  "menuCode": "event_list",
  "menuType": "options", 
  "textTemplate": "Available Events:\n{{events_list}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "get_events"}],
  "nextMenu": "event_details"
}
```

### 3.3 Event Details Menu

**Payload:**
```json
{
  "menuCode": "event_details",
  "menuType": "options",
  "textTemplate": "{{event_details}}\n\n1. Register\n2. Back to events\n3. Main menu",
  "options": [
    {"id": "1", "label": "Register", "next": "registration_form"},
    {"id": "2", "label": "Back to events", "next": "event_list"},
    {"id": "3", "label": "Main menu", "next": "main_menu"}
  ],
  "validationRules": {},
  "apiCalls": [{"name": "get_event_details"}],
  "nextMenu": null
}
```

### 3.4 Registration Form - Name Input

**Payload:**
```json
{
  "menuCode": "registration_form",
  "menuType": "input",
  "textTemplate": "Enter your full name:",
  "options": [],
  "validationRules": {
    "required": true,
    "minLength": 2,
    "maxLength": 50
  },
  "apiCalls": [],
  "nextMenu": "registration_email"
}
```

### 3.5 Registration Form - Email Input

**Payload:**
```json
{
  "menuCode": "registration_email",
  "menuType": "input",
  "textTemplate": "Enter your email address:",
  "options": [],
  "validationRules": {
    "required": true,
    "email": true
  },
  "apiCalls": [],
  "nextMenu": "registration_confirm"
}
```

### 3.6 Registration Confirmation

**Payload:**
```json
{
  "menuCode": "registration_confirm",
  "menuType": "options",
  "textTemplate": "Confirm Registration:\nEvent: {{event_name}}\nName: {{registration_form_input}}\nEmail: {{registration_email_input}}\nPhone: {{phone_number}}\n\n1. Confirm\n2. Cancel",
  "options": [
    {"id": "1", "label": "Confirm", "next": "registration_process"},
    {"id": "2", "label": "Cancel", "next": "main_menu"}
  ],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

### 3.7 Registration Processing (Final)

**Payload:**
```json
{
  "menuCode": "registration_process",
  "menuType": "final",
  "textTemplate": "{{registration_result}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "register_for_event"}],
  "nextMenu": null
}
```

### 3.8 My Registrations Menu

**Payload:**
```json
{
  "menuCode": "my_registrations",
  "menuType": "options",
  "textTemplate": "My Registrations:\n{{my_registrations_list}}\n\n0. Back to main menu",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "get_my_registrations"}],
  "nextMenu": null
}
```

### 3.9 Code Verification Input

**Payload:**
```json
{
  "menuCode": "verify_code_input",
  "menuType": "input",
  "textTemplate": "Enter your verification code:",
  "options": [],
  "validationRules": {
    "required": true,
    "minLength": 6,
    "maxLength": 10
  },
  "apiCalls": [],
  "nextMenu": "verify_code_process"
}
```

### 3.10 Code Verification Processing

**Payload:**
```json
{
  "menuCode": "verify_code_process",
  "menuType": "final",
  "textTemplate": "{{verification_result}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "verify_registration_code"}],
  "nextMenu": null
}
```

### 3.11 Exit Menu

**Payload:**
```json
{
  "menuCode": "exit_menu",
  "menuType": "final",
  "textTemplate": "Thank you for using Event Registration System!",
  "options": [],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

---

## 🔌 Step 4: Configure API Integrations

### 4.1 Get Events API

**Endpoint:** `POST /api/v1/admin/apps/2/api-configs`

**Payload:**
```json
{
  "apiName": "get_events",
  "endpoint": "http://localhost:4001/api/events",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json"
  },
  "bodyTemplate": {},
  "authConfig": {},
  "responseMapping": {
    "events_list": "$.formatted",
    "events_options": "$.options", 
    "events": "$.events"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

### 4.2 Get Event Details API

**Payload:**
```json
{
  "apiName": "get_event_details",
  "endpoint": "http://localhost:4001/api/events/{{events_selected_id}}",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json"
  },
  "bodyTemplate": {},
  "authConfig": {},
  "responseMapping": {
    "event_details": "$.formatted",
    "event_name": "$.name",
    "event_date": "$.date",
    "event_location": "$.location",
    "event_price": "$.price"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

### 4.3 Register for Event API

**Payload:**
```json
{
  "apiName": "register_for_event",
  "endpoint": "http://localhost:4001/api/events/register",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "bodyTemplate": {
    "eventId": "{{events_selected_id}}",
    "name": "{{registration_form_input}}",
    "email": "{{registration_email_input}}",
    "phone": "{{phone_number}}"
  },
  "authConfig": {},
  "responseMapping": {
    "registration_result": "$.message",
    "registration_code": "$.code",
    "registration_id": "$.registrationId"
  },
  "timeout": 10000,
  "retryCount": 1
}
```

### 4.4 Get My Registrations API

**Payload:**
```json
{
  "apiName": "get_my_registrations",
  "endpoint": "http://localhost:4001/api/registrations/{{phone_number}}",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json"
  },
  "bodyTemplate": {},
  "authConfig": {},
  "responseMapping": {
    "my_registrations_list": "$.formatted",
    "registrations": "$.registrations"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

### 4.5 Verify Registration Code API

**Payload:**
```json
{
  "apiName": "verify_registration_code",
  "endpoint": "http://localhost:4001/api/verify",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "bodyTemplate": {
    "code": "{{verify_code_input_input}}",
    "phone": "{{phone_number}}"
  },
  "authConfig": {},
  "responseMapping": {
    "verification_result": "$.message",
    "event_name": "$.eventName",
    "status": "$.status"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

---

## 🧪 Step 5: Testing Your USSD Service

### 5.1 Verify Setup

**Check App Creation:**
```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps
```

**Check Menus:**
```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/2/menus
```

**Check API Configs:**
```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/2/api-configs
```

### 5.2 Test USSD Flow

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

**3. Registration Flow:**
```bash
# Select event
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "TEST_001", "serviceCode": "*567#", "phoneNumber": "+233244567890", "text": "1*1"}'

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

# Confirm
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "TEST_001", "serviceCode": "*567#", "phoneNumber": "+233244567890", "text": "1*1*1*John Doe*john@example.com*1"}'
```

---

## 📊 Step 6: Management & Monitoring

### 6.1 View Configuration

**Export Complete App Config:**
```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/2/export
```

**View Menu Flow:**
```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/2/flow
```

### 6.2 Update Configuration

**Update Menu:**
```bash
curl -X PUT http://localhost:3000/api/v1/admin/menus/1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: development-key" \
  -d '{
    "textTemplate": "Welcome to Event Registration v2.0\n1. Browse Events\n2. My Account\n3. Verify Code\n4. Exit"
  }'
```

**Update API Config:**
```bash
curl -X PUT http://localhost:3000/api/v1/admin/api-configs/1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: development-key" \
  -d '{
    "timeout": 8000,
    "retryCount": 3
  }'
```

---

## 🔧 Step 7: Advanced Configuration

### 7.1 Template Variables

**Available Variables:**
- `{{phone_number}}` - User's phone number
- `{{session_id}}` - Current session ID
- `{{menu_code_input}}` - User input from any menu
- `{{variable_name}}` - Any session variable
- `{{api_response_field}}` - Any API response field

**Template Helpers:**
- `{{currency:amount}}` - Format as currency
- `{{date:date_field}}` - Format as date
- `{{uppercase:text}}` - Convert to uppercase

### 7.2 Validation Rules

**Available Validators:**
```json
{
  "required": true,
  "minLength": 2,
  "maxLength": 50,
  "numeric": true,
  "phone": true,
  "email": true,
  "amount": true,
  "minAmount": 10,
  "maxAmount": 1000,
  "regex": "^[A-Z0-9]+$"
}
```

### 7.3 API Authentication

**Bearer Token:**
```json
{
  "authConfig": {
    "type": "bearer",
    "token": "{{api_token}}"
  }
}
```

**API Key:**
```json
{
  "authConfig": {
    "type": "apikey", 
    "key": "X-API-Key",
    "value": "your-api-key"
  }
}
```

---

## 🚨 Troubleshooting

### Common Issues

**1. "Service not available"**
- Check app is active: `SELECT * FROM ussd_apps WHERE ussd_code = '*567#';`
- Verify entry_menu exists in ussd_menus table

**2. "Invalid option"**
- Check menu options are properly formatted JSON arrays
- Verify option IDs match user input

**3. "Template variables not resolving"**
- Check API response mapping paths (use JSONPath syntax)
- Verify session variables are being stored

**4. "API timeout errors"**
- Increase timeout values in api_configs
- Check external API availability

### Debug Commands

```bash
# Check app status
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps | jq '.data[] | select(.ussd_code == "*567#")'

# Validate menu structure  
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/2/menus | jq '.data[] | {menu_code, menu_type, has_options: (.options | length > 0)}'

# Check API configs
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/2/api-configs | jq '.data[] | {api_name, endpoint, method}'
```

---

## ✅ Success Checklist

- [ ] App created with correct USSD code
- [ ] All 11 menus created successfully  
- [ ] All 5 API configurations added
- [ ] Initial menu responds to *567#
- [ ] Event list loads (with or without external API)
- [ ] Registration flow completes
- [ ] Code verification works
- [ ] Template variables resolve correctly
- [ ] Input validation works
- [ ] Session management functions properly

---

## 🎉 Next Steps

Once your Event Registration system is working:

1. **Add More Features:**
   - Payment integration
   - Event categories
   - User preferences
   - Notification settings

2. **Create New Apps:**
   - Banking services (*123#)
   - Survey system (*456#) 
   - Support tickets (*789#)

3. **Advanced Features:**
   - Multi-language support
   - Dynamic triggers
   - Analytics integration
   - A/B testing

Your dynamic USSD platform can now handle any business use case with just JSON configuration! 🚀