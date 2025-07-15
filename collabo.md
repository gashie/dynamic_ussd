# Dynamic USSD Platform Setup Guide
## Complete Collabo (Group Savings) System Configuration

## 📋 Overview
This guide shows how to configure your dynamic USSD platform to create a complete Collabo system for group savings, investments, and financial management using only the platform's admin APIs.

## 🎯 What You'll Build
- **Service Code:** `*789#` 
- **Features:** Group management, savings tracking, loan requests, member contributions
- **Menus:** 15 interactive menus with complex financial flows
- **APIs:** 8 external API integrations
- **Flows:** Join collabo, make contributions, request loans, view balances

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

## 🏗️ Step 2: Create the Collabo USSD Application

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
  "ussdCode": "*789#",
  "appName": "Collabo Savings System",
  "entryMenu": "main_menu",
  "config": {
    "version": "2.0",
    "features": ["savings", "loans", "investments", "groups"],
    "session_timeout": 900000,
    "max_retries": 3,
    "currency": "GHS",
    "min_contribution": 10,
    "max_loan_ratio": 0.8
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "ussd_code": "*789#",
    "app_name": "Collabo Savings System",
    "entry_menu": "main_menu",
    "config": {...},
    "is_active": true,
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

**Save the `app_id` (e.g., `3`) for subsequent requests.**

---

## 🗂️ Step 3: Create Menu Structure

### 3.1 Main Menu

**Endpoint:** `POST /api/v1/admin/apps/3/menus`

**Payload:**
```json
{
  "menuCode": "main_menu",
  "menuType": "options",
  "textTemplate": "Welcome to Collabo Savings\n{{greeting_message}}\n1. My Collabos\n2. Join New Collabo\n3. Make Contribution\n4. Request Loan\n5. My Wallet\n6. Settings\n7. Exit",
  "options": [
    {"id": "1", "label": "My Collabos", "next": "my_collabos_list"},
    {"id": "2", "label": "Join New Collabo", "next": "available_collabos"},
    {"id": "3", "label": "Make Contribution", "next": "contribution_collabos"},
    {"id": "4", "label": "Request Loan", "next": "loan_collabos"},
    {"id": "5", "label": "My Wallet", "next": "wallet_menu"},
    {"id": "6", "label": "Settings", "next": "settings_menu"},
    {"id": "7", "label": "Exit", "next": "exit_menu"}
  ],
  "validationRules": {},
  "apiCalls": [{"name": "get_user_profile"}],
  "nextMenu": null
}
```

### 3.2 My Collabos List

**Payload:**
```json
{
  "menuCode": "my_collabos_list",
  "menuType": "options",
  "textTemplate": "My Collabos:\n{{my_collabos_list}}\n\n0. Back to main menu",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "get_my_collabos"}],
  "nextMenu": "collabo_details"
}
```

### 3.3 Collabo Details

**Payload:**
```json
{
  "menuCode": "collabo_details",
  "menuType": "options",
  "textTemplate": "{{collabo_name}}\n{{collabo_summary}}\n\n1. View Transactions\n2. Member List\n3. My Balance\n4. Contribute Now\n5. Back to list",
  "options": [
    {"id": "1", "label": "View Transactions", "next": "collabo_transactions"},
    {"id": "2", "label": "Member List", "next": "collabo_members"},
    {"id": "3", "label": "My Balance", "next": "my_collabo_balance"},
    {"id": "4", "label": "Contribute Now", "next": "quick_contribution_amount"},
    {"id": "5", "label": "Back to list", "next": "my_collabos_list"}
  ],
  "validationRules": {},
  "apiCalls": [{"name": "get_collabo_details"}],
  "nextMenu": null
}
```

### 3.4 Available Collabos (Join New)

**Payload:**
```json
{
  "menuCode": "available_collabos",
  "menuType": "options",
  "textTemplate": "Available Collabos:\n{{available_collabos_list}}\n\n0. Back to main menu",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "get_available_collabos"}],
  "nextMenu": "collabo_join_details"
}
```

### 3.5 Collabo Join Details

**Payload:**
```json
{
  "menuCode": "collabo_join_details",
  "menuType": "options",
  "textTemplate": "{{join_collabo_details}}\n\n1. Join Collabo\n2. View Requirements\n3. Back to list",
  "options": [
    {"id": "1", "label": "Join Collabo", "next": "join_collabo_confirm"},
    {"id": "2", "label": "View Requirements", "next": "collabo_requirements"},
    {"id": "3", "label": "Back to list", "next": "available_collabos"}
  ],
  "validationRules": {},
  "apiCalls": [{"name": "get_join_collabo_details"}],
  "nextMenu": null
}
```

### 3.6 Join Collabo Confirmation

**Payload:**
```json
{
  "menuCode": "join_collabo_confirm",
  "menuType": "options",
  "textTemplate": "Join {{collabo_name}}?\n\nEntry Fee: {{currency:entry_fee}}\nMonthly Contribution: {{currency:monthly_amount}}\nDuration: {{duration_months}} months\n\n1. Confirm & Pay\n2. Cancel",
  "options": [
    {"id": "1", "label": "Confirm & Pay", "next": "join_payment_pin"},
    {"id": "2", "label": "Cancel", "next": "available_collabos"}
  ],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

### 3.7 Join Payment PIN

**Payload:**
```json
{
  "menuCode": "join_payment_pin",
  "menuType": "input",
  "textTemplate": "Enter your PIN to pay entry fee of {{currency:entry_fee}}:",
  "options": [],
  "validationRules": {
    "required": true,
    "numeric": true,
    "minLength": 4,
    "maxLength": 4
  },
  "apiCalls": [],
  "nextMenu": "join_collabo_process"
}
```

### 3.8 Join Collabo Processing

**Payload:**
```json
{
  "menuCode": "join_collabo_process",
  "menuType": "final",
  "textTemplate": "{{join_result_message}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "join_collabo"}],
  "nextMenu": null
}
```

### 3.9 Contribution Collabos Selection

**Payload:**
```json
{
  "menuCode": "contribution_collabos",
  "menuType": "options",
  "textTemplate": "Select Collabo to contribute:\n{{contribution_collabos_list}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "get_contribution_collabos"}],
  "nextMenu": "contribution_amount"
}
```

### 3.10 Contribution Amount

**Payload:**
```json
{
  "menuCode": "contribution_amount",
  "menuType": "input",
  "textTemplate": "Enter contribution amount:\n\nMinimum: {{currency:min_contribution}}\nSuggested: {{currency:suggested_amount}}\nYour Balance: {{currency:wallet_balance}}",
  "options": [],
  "validationRules": {
    "required": true,
    "amount": true,
    "minAmount": {"value": 10, "message": "Minimum contribution is GHS 10"}
  },
  "apiCalls": [{"name": "get_contribution_info"}],
  "nextMenu": "contribution_purpose"
}
```

### 3.11 Contribution Purpose

**Payload:**
```json
{
  "menuCode": "contribution_purpose",
  "menuType": "input",
  "textTemplate": "Enter purpose/description (optional):",
  "options": [],
  "validationRules": {
    "maxLength": 100
  },
  "apiCalls": [],
  "nextMenu": "contribution_confirm"
}
```

### 3.12 Contribution Confirmation

**Payload:**
```json
{
  "menuCode": "contribution_confirm",
  "menuType": "options",
  "textTemplate": "Confirm Contribution:\n\nCollabo: {{selected_collabo_name}}\nAmount: {{currency:contribution_amount_input}}\nPurpose: {{contribution_purpose_input}}\nSource: My Wallet\n\n1. Confirm\n2. Cancel",
  "options": [
    {"id": "1", "label": "Confirm", "next": "contribution_pin"},
    {"id": "2", "label": "Cancel", "next": "main_menu"}
  ],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

### 3.13 Contribution PIN

**Payload:**
```json
{
  "menuCode": "contribution_pin",
  "menuType": "input",
  "textTemplate": "Enter your PIN to confirm contribution:",
  "options": [],
  "validationRules": {
    "required": true,
    "numeric": true,
    "minLength": 4,
    "maxLength": 4
  },
  "apiCalls": [],
  "nextMenu": "contribution_process"
}
```

### 3.14 Contribution Processing

**Payload:**
```json
{
  "menuCode": "contribution_process",
  "menuType": "final",
  "textTemplate": "{{contribution_result}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "process_contribution"}],
  "nextMenu": null
}
```

### 3.15 Loan Collabos Selection

**Payload:**
```json
{
  "menuCode": "loan_collabos",
  "menuType": "options",
  "textTemplate": "Select Collabo for loan:\n{{loan_eligible_collabos}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "get_loan_eligible_collabos"}],
  "nextMenu": "loan_amount"
}
```

### 3.16 Loan Amount Request

**Payload:**
```json
{
  "menuCode": "loan_amount",
  "menuType": "input",
  "textTemplate": "Enter loan amount:\n\nMax Available: {{currency:max_loan_amount}}\nYour Savings: {{currency:my_savings}}\nInterest Rate: {{interest_rate}}%",
  "options": [],
  "validationRules": {
    "required": true,
    "amount": true,
    "minAmount": {"value": 50, "message": "Minimum loan is GHS 50"}
  },
  "apiCalls": [{"name": "get_loan_info"}],
  "nextMenu": "loan_purpose"
}
```

### 3.17 Loan Purpose

**Payload:**
```json
{
  "menuCode": "loan_purpose",
  "menuType": "options",
  "textTemplate": "Select loan purpose:\n1. Business\n2. Education\n3. Medical\n4. Emergency\n5. Other",
  "options": [
    {"id": "1", "label": "Business", "next": "loan_duration"},
    {"id": "2", "label": "Education", "next": "loan_duration"},
    {"id": "3", "label": "Medical", "next": "loan_duration"},
    {"id": "4", "label": "Emergency", "next": "loan_duration"},
    {"id": "5", "label": "Other", "next": "loan_purpose_custom"}
  ],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

### 3.18 Custom Loan Purpose

**Payload:**
```json
{
  "menuCode": "loan_purpose_custom",
  "menuType": "input",
  "textTemplate": "Enter loan purpose:",
  "options": [],
  "validationRules": {
    "required": true,
    "minLength": 5,
    "maxLength": 100
  },
  "apiCalls": [],
  "nextMenu": "loan_duration"
}
```

### 3.19 Loan Duration

**Payload:**
```json
{
  "menuCode": "loan_duration",
  "menuType": "options",
  "textTemplate": "Select repayment period:\n1. 3 months\n2. 6 months\n3. 12 months\n4. 18 months",
  "options": [
    {"id": "1", "label": "3 months", "next": "loan_confirm"},
    {"id": "2", "label": "6 months", "next": "loan_confirm"},
    {"id": "3", "label": "12 months", "next": "loan_confirm"},
    {"id": "4", "label": "18 months", "next": "loan_confirm"}
  ],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

### 3.20 Loan Confirmation

**Payload:**
```json
{
  "menuCode": "loan_confirm",
  "menuType": "options",
  "textTemplate": "Loan Application Summary:\n\nAmount: {{currency:loan_amount_input}}\nPurpose: {{loan_purpose_display}}\nDuration: {{loan_duration_display}}\nMonthly Payment: {{currency:monthly_payment}}\nTotal Repayment: {{currency:total_repayment}}\n\n1. Submit Application\n2. Cancel",
  "options": [
    {"id": "1", "label": "Submit Application", "next": "loan_submit"},
    {"id": "2", "label": "Cancel", "next": "main_menu"}
  ],
  "validationRules": {},
  "apiCalls": [{"name": "calculate_loan_terms"}],
  "nextMenu": null
}
```

### 3.21 Loan Submission

**Payload:**
```json
{
  "menuCode": "loan_submit",
  "menuType": "final",
  "textTemplate": "{{loan_application_result}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "submit_loan_application"}],
  "nextMenu": null
}
```

### 3.22 Wallet Menu

**Payload:**
```json
{
  "menuCode": "wallet_menu",
  "menuType": "options",
  "textTemplate": "My Wallet\n\nBalance: {{currency:wallet_balance}}\nPending: {{currency:pending_amount}}\n\n1. Add Money\n2. Withdraw\n3. Transaction History\n4. Back to main menu",
  "options": [
    {"id": "1", "label": "Add Money", "next": "add_money_amount"},
    {"id": "2", "label": "Withdraw", "next": "withdraw_amount"},
    {"id": "3", "label": "Transaction History", "next": "wallet_transactions"},
    {"id": "4", "label": "Back to main menu", "next": "main_menu"}
  ],
  "validationRules": {},
  "apiCalls": [{"name": "get_wallet_info"}],
  "nextMenu": null
}
```

### 3.23 Add Money Amount

**Payload:**
```json
{
  "menuCode": "add_money_amount",
  "menuType": "input",
  "textTemplate": "Enter amount to add to wallet:\n\nMinimum: GHS 5\nMaximum: GHS 5000",
  "options": [],
  "validationRules": {
    "required": true,
    "amount": true,
    "minAmount": 5,
    "maxAmount": 5000
  },
  "apiCalls": [],
  "nextMenu": "add_money_method"
}
```

### 3.24 Add Money Method

**Payload:**
```json
{
  "menuCode": "add_money_method",
  "menuType": "options",
  "textTemplate": "Select payment method:\n\nAmount: {{currency:add_money_amount_input}}\n\n1. Mobile Money\n2. Bank Transfer\n3. Cash Deposit\n4. Cancel",
  "options": [
    {"id": "1", "label": "Mobile Money", "next": "add_money_momo"},
    {"id": "2", "label": "Bank Transfer", "next": "add_money_bank"},
    {"id": "3", "label": "Cash Deposit", "next": "add_money_cash"},
    {"id": "4", "label": "Cancel", "next": "wallet_menu"}
  ],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

### 3.25 Add Money - Mobile Money

**Payload:**
```json
{
  "menuCode": "add_money_momo",
  "menuType": "final",
  "textTemplate": "{{momo_payment_result}}",
  "options": [],
  "validationRules": {},
  "apiCalls": [{"name": "initiate_momo_payment"}],
  "nextMenu": null
}
```

### 3.26 Settings Menu

**Payload:**
```json
{
  "menuCode": "settings_menu",
  "menuType": "options",
  "textTemplate": "Settings\n\n1. Change PIN\n2. Update Profile\n3. Notification Settings\n4. Security Settings\n5. Back to main menu",
  "options": [
    {"id": "1", "label": "Change PIN", "next": "change_pin_current"},
    {"id": "2", "label": "Update Profile", "next": "update_profile_menu"},
    {"id": "3", "label": "Notification Settings", "next": "notification_settings"},
    {"id": "4", "label": "Security Settings", "next": "security_settings"},
    {"id": "5", "label": "Back to main menu", "next": "main_menu"}
  ],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

### 3.27 Exit Menu

**Payload:**
```json
{
  "menuCode": "exit_menu",
  "menuType": "final",
  "textTemplate": "Thank you for using Collabo Savings!\n\nYour financial growth partner.\n\nDial *789# anytime to access your account.",
  "options": [],
  "validationRules": {},
  "apiCalls": [],
  "nextMenu": null
}
```

---

## 🔌 Step 4: Configure API Integrations

### 4.1 Get User Profile API

**Endpoint:** `POST /api/v1/admin/apps/3/api-configs`

**Payload:**
```json
{
  "apiName": "get_user_profile",
  "endpoint": "http://localhost:4002/api/users/{{phone_number}}/profile",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{auth_token}}"
  },
  "bodyTemplate": {},
  "authConfig": {},
  "responseMapping": {
    "greeting_message": "$.greeting",
    "user_name": "$.name",
    "user_id": "$.id",
    "wallet_balance": "$.wallet.balance",
    "auth_token": "$.token"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

### 4.2 Get My Collabos API

**Payload:**
```json
{
  "apiName": "get_my_collabos",
  "endpoint": "http://localhost:4002/api/users/{{phone_number}}/collabos",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{auth_token}}"
  },
  "bodyTemplate": {},
  "authConfig": {},
  "responseMapping": {
    "my_collabos_list": "$.formatted",
    "my_collabos_options": "$.options",
    "my_collabos": "$.collabos"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

### 4.3 Get Collabo Details API

**Payload:**
```json
{
  "apiName": "get_collabo_details",
  "endpoint": "http://localhost:4002/api/collabos/{{my_collabos_selected_id}}/details",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{auth_token}}"
  },
  "bodyTemplate": {},
  "authConfig": {},
  "responseMapping": {
    "collabo_name": "$.name",
    "collabo_summary": "$.summary",
    "total_savings": "$.total_savings",
    "my_balance": "$.my_balance",
    "member_count": "$.member_count",
    "next_meeting": "$.next_meeting"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

### 4.4 Get Available Collabos API

**Payload:**
```json
{
  "apiName": "get_available_collabos",
  "endpoint": "http://localhost:4002/api/collabos/available",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{auth_token}}"
  },
  "bodyTemplate": {
    "user_id": "{{user_id}}",
    "location": "{{user_location}}"
  },
  "authConfig": {},
  "responseMapping": {
    "available_collabos_list": "$.formatted",
    "available_collabos_options": "$.options",
    "available_collabos": "$.collabos"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

### 4.5 Get Join Collabo Details API

**Payload:**
```json
{
  "apiName": "get_join_collabo_details",
  "endpoint": "http://localhost:4002/api/collabos/{{available_collabos_selected_id}}/join-info",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{auth_token}}"
  },
  "bodyTemplate": {},
  "authConfig": {},
  "responseMapping": {
    "join_collabo_details": "$.formatted",
    "collabo_name": "$.name",
    "entry_fee": "$.entry_fee",
    "monthly_amount": "$.monthly_contribution",
    "duration_months": "$.duration",
    "member_limit": "$.max_members",
    "current_members": "$.current_members"
  },
  "timeout": 5000,
  "retryCount": 2
}
```

### 4.6 Join Collabo API

**Payload:**
```json
{
  "apiName": "join_collabo",
  "endpoint": "http://localhost:4002/api/collabos/join",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{auth_token}}"
  },
  "bodyTemplate": {
    "user_id": "{{user_id}}",
    "collabo_id": "{{available_collabos_selected_id}}",
    "entry_fee": "{{entry_fee}}",
    "payment_pin": "{{join_payment_pin_input}}",
    "payment_method": "wallet"
  },
  "authConfig": {},
  "responseMapping": {
    "join_result_message": "$.message",
    "membership_id": "$.membership_id",
    "welcome_package": "$.welcome_info"
  },
  "timeout": 10000,
  "retryCount": 1
}
```

### 4.7 Process Contribution API

**Payload:**
```json
{
  "apiName": "process_contribution",
  "endpoint": "http://localhost:4002/api/contributions/make",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{auth_token}}"
  },
  "bodyTemplate": {
    "user_id": "{{user_id}}",
    "collabo_id": "{{contribution_collabos_selected_id}}",
    "amount": "{{contribution_amount_input}}",
    "purpose": "{{contribution_purpose_input}}",
    "payment_pin": "{{contribution_pin_input}}",
    "source": "wallet"
  },
  "authConfig": {},
  "responseMapping": {
    "contribution_result": "$.message",
    "transaction_id": "$.transaction_id",
    "new_balance": "$.new_balance"
  },
  "timeout": 10000,
  "retryCount": 1
}
```

### 4.8 Submit Loan Application API

**Payload:**
```json
{
  "apiName": "submit_loan_application",
  "endpoint": "http://localhost:4002/api/loans/apply",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{auth_token}}"
  },
  "bodyTemplate": {
    "user_id": "{{user_id}}",
    "collabo_id": "{{loan_collabos_selected_id}}",
    "amount": "{{loan_amount_input}}",
    "purpose": "{{loan_purpose_display}}",
    "duration_months": "{{loan_duration_months}}",
    "monthly_payment": "{{monthly_payment}}"
  },
  "authConfig": {},
  "responseMapping": {
    "loan_application_result": "$.message",
    "application_id": "$.application_id",
    "approval_timeline": "$.approval_info"
  },
  "timeout": 8000,
  "retryCount": 2
}
```

---

## 🧪 Step 5: Testing Your Collabo USSD Service

### 5.1 Verify Setup

**Check App Creation:**
```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps | jq '.data[] | select(.ussd_code == "*789#")'
```

**Check Menus Count:**
```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/3/menus | jq '.data | length'
```

**Check API Configs:**
```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/3/api-configs | jq '.data[] | {api_name, endpoint}'
```

### 5.2 Test Core USSD Flows

**1. Initial Menu:**
```bash
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "COLLABO_001",
    "serviceCode": "*789#",
    "phoneNumber": "+233244567890",
    "text": ""
  }'
```

**Expected Response:**
```
CON Welcome to Collabo Savings
Good morning, John! You have 3 active collabos.

1. My Collabos
2. Join New Collabo  
3. Make Contribution
4. Request Loan
5. My Wallet
6. Settings
7. Exit
```

**2. View My Collabos:**
```bash
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "COLLABO_001",
    "serviceCode": "*789#",
    "phoneNumber": "+233244567890",
    "text": "1"
  }'
```

**3. Make Contribution Flow:**
```bash
# Select contribution
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_002", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "3"}'

# Select collabo
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_002", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "3*1"}'

# Enter amount
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_002", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "3*1*100"}'

# Enter purpose
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_002", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "3*1*100*Monthly savings"}'

# Confirm
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_002", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "3*1*100*Monthly savings*1"}'

# Enter PIN
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_002", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "3*1*100*Monthly savings*1*1234"}'
```

**4. Loan Application Flow:**
```bash
# Request loan
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_003", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "4"}'

# Select collabo
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_003", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "4*1"}'

# Enter loan amount
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_003", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "4*1*500"}'

# Select purpose (Business)
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_003", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "4*1*500*1"}'

# Select duration (6 months)
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_003", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "4*1*500*1*2"}'

# Submit application
curl -X POST http://localhost:3000/api/v1/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "COLLABO_003", "serviceCode": "*789#", "phoneNumber": "+233244567890", "text": "4*1*500*1*2*1"}'
```

---

## 📊 Step 6: Advanced Configuration Examples

### 6.1 Complex Template Variables

**Collabo Summary Template:**
```
"textTemplate": "{{collabo_name}}\nTotal Savings: {{currency:total_savings}}\nMy Balance: {{currency:my_balance}}\nMembers: {{member_count}}/{{max_members}}\nNext Meeting: {{date:next_meeting}}\n\nLast Contribution: {{currency:last_contribution}} on {{date:last_contribution_date}}"
```

### 6.2 Advanced Validation Rules

**Loan Amount Validation:**
```json
{
  "validationRules": {
    "required": true,
    "amount": true,
    "minAmount": {
      "value": 50,
      "message": "Minimum loan amount is GHS 50"
    },
    "maxAmount": {
      "value": "{{max_loan_amount}}",
      "message": "Maximum loan based on your savings: GHS {{max_loan_amount}}"
    }
  }
}
```

### 6.3 Conditional Menu Flow

**Dynamic Next Menu Based on Balance:**
```json
{
  "options": [
    {
      "id": "1",
      "label": "Quick Contribution",
      "next": "{{balance_sufficient ? 'quick_contribution_amount' : 'insufficient_balance'}}"
    }
  ]
}
```

### 6.4 API Authentication with Token Refresh

**Auth Configuration:**
```json
{
  "authConfig": {
    "type": "bearer",
    "token": "{{auth_token}}",
    "refresh_endpoint": "http://localhost:4002/api/auth/refresh",
    "refresh_token": "{{refresh_token}}"
  }
}
```

---

## 🔧 Step 7: Management & Monitoring

### 7.1 Export Complete Configuration

```bash
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/apps/3/export > collabo-config.json
```

### 7.2 Update Menu Templates

```bash
curl -X PUT http://localhost:3000/api/v1/admin/menus/15 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: development-key" \
  -d '{
    "textTemplate": "Welcome to Collabo Savings v2.0\n{{greeting_message}}\n\n1. My Collabos ({{active_collabos_count}})\n2. Join New Collabo\n3. Quick Contribute\n4. Loan Center\n5. Digital Wallet\n6. Account Settings\n7. Exit"
  }'
```

### 7.3 Monitor API Performance

```bash
# Check API call logs
curl -H "X-API-Key: development-key" \
  "http://localhost:3000/api/v1/admin/api-logs?limit=50&status=failed"
```

---

## 🚨 Troubleshooting

### Common Issues

**1. "Collabo not found" Errors**
- Check if `collabos_selected_id` is properly stored in session
- Verify API response mapping for collabo selection

**2. "Insufficient balance" Messages**
- Ensure wallet balance is updated after transactions
- Check minimum contribution amounts in validation rules

**3. Template Variables Not Resolving**
- Verify API response mapping paths
- Check session variable storage and retrieval

**4. Loan Calculation Errors**
- Ensure `calculate_loan_terms` API returns proper numeric values
- Check currency formatting in templates

### Debug Commands

```bash
# Check specific menu configuration
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/menus/20 | jq '.data'

# Verify API response mapping
curl -H "X-API-Key: development-key" \
  http://localhost:3000/api/v1/admin/api-configs/8 | jq '.data.response_mapping'

# Test template variable resolution
echo '{"amount": 100, "currency": "GHS"}' | jq '. as $data | "Amount: {{currency:amount}}" | gsub("{{currency:amount}}"; ($data.currency + " " + ($data.amount | tostring)))'
```

---

## ✅ Success Checklist

### Core Functionality
- [ ] App created with *789# service code
- [ ] All 27 menus created successfully
- [ ] All 8 API configurations added
- [ ] Main menu responds correctly
- [ ] User profile loads on initial access
- [ ] Collabo list displays properly

### Financial Flows  
- [ ] Contribution flow completes end-to-end
- [ ] Loan application submits successfully
- [ ] Wallet operations work correctly
- [ ] PIN validation functions properly
- [ ] Transaction confirmations display

### Advanced Features
- [ ] Template variables resolve correctly
- [ ] Currency formatting works
- [ ] Date formatting works
- [ ] Conditional logic functions
- [ ] Session management works across flows

---

## 🎉 Next Steps

### Immediate Enhancements
1. **Add More Financial Products:**
   - Investment packages
   - Insurance products
   - Fixed deposits
   - Recurring savings plans

2. **Advanced Features:**
   - Biometric authentication
   - Voice OTP verification
   - Multi-language support
   - Offline mode capabilities

3. **Integration Opportunities:**
   - Payment gateway integration
   - Bank API connections
   - Credit bureau integration
   - SMS notification service

### Business Extensions
1. **Create Related Services:**
   - Micro-insurance (*456#)
   - Investment advisory (*321#)
   - Credit scoring (*654#)

2. **Advanced Analytics:**
   - User behavior tracking
   - Financial health scoring
   - Predictive loan defaults
   - Savings goal recommendations

Your Collabo USSD system is now a comprehensive financial services platform that can handle complex group savings, loan management, and digital wallet operations - all configured through your dynamic platform! 🚀💰