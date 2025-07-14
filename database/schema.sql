-- Dynamic USSD System Database Schema
-- PostgreSQL

-- USSD Applications table
CREATE TABLE ussd_apps (
  id SERIAL PRIMARY KEY,
  ussd_code VARCHAR(20) UNIQUE NOT NULL,
  app_name VARCHAR(100) NOT NULL,
  entry_menu VARCHAR(50) NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic menus table
CREATE TABLE ussd_menus (
  id SERIAL PRIMARY KEY,
  app_id INTEGER REFERENCES ussd_apps(id) ON DELETE CASCADE,
  menu_code VARCHAR(50) NOT NULL,
  menu_type VARCHAR(20) DEFAULT 'options', -- options, input, final
  text_template TEXT NOT NULL,
  options JSONB DEFAULT '[]',
  validation_rules JSONB DEFAULT '{}',
  api_calls JSONB DEFAULT '[]',
  next_menu VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(app_id, menu_code)
);

-- API configurations table
CREATE TABLE api_configs (
  id SERIAL PRIMARY KEY,
  app_id INTEGER REFERENCES ussd_apps(id) ON DELETE CASCADE,
  api_name VARCHAR(100) NOT NULL,
  endpoint TEXT NOT NULL,
  method VARCHAR(10) DEFAULT 'GET',
  headers JSONB DEFAULT '{}',
  body_template JSONB DEFAULT '{}',
  auth_config JSONB DEFAULT '{}',
  response_mapping JSONB DEFAULT '{}',
  timeout INTEGER DEFAULT 5000,
  retry_count INTEGER DEFAULT 2,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(app_id, api_name)
);

-- User sessions table
CREATE TABLE ussd_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  app_id INTEGER REFERENCES ussd_apps(id),
  current_menu VARCHAR(50),
  session_data JSONB DEFAULT '{}',
  input_history JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Session variables table (for storing dynamic data)
CREATE TABLE session_variables (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) REFERENCES ussd_sessions(session_id) ON DELETE CASCADE,
  variable_name VARCHAR(100) NOT NULL,
  variable_value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, variable_name)
);

-- API call logs table
CREATE TABLE api_call_logs (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100),
  api_name VARCHAR(100),
  request_data JSONB,
  response_data JSONB,
  status_code INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ussd_sessions_active ON ussd_sessions(session_id) WHERE is_active = true;
CREATE INDEX idx_ussd_menus_app_code ON ussd_menus(app_id, menu_code);
CREATE INDEX idx_api_configs_app_name ON api_configs(app_id, api_name);
CREATE INDEX idx_session_variables_session ON session_variables(session_id);

-- Sample data for testing
INSERT INTO ussd_apps (ussd_code, app_name, entry_menu) VALUES 
('*123#', 'Mobile Banking', 'main_menu'),
('*456#', 'Airtime Service', 'airtime_menu');

-- Sample menu for Mobile Banking
INSERT INTO ussd_menus (app_id, menu_code, menu_type, text_template, options, next_menu) VALUES 
(1, 'main_menu', 'options', 'Welcome to Mobile Banking\n1. Check Balance\n2. Transfer Money\n3. Buy Airtime\n4. Exit', 
'[
  {"id": "1", "label": "Check Balance", "next": "balance_menu"},
  {"id": "2", "label": "Transfer Money", "next": "transfer_menu"},
  {"id": "3", "label": "Buy Airtime", "next": "airtime_menu"},
  {"id": "4", "label": "Exit", "next": "exit"}
]', NULL),
(1, 'balance_menu', 'final', 'Your balance is {{balance}}', '[]', NULL),
(1, 'transfer_menu', 'input', 'Enter recipient phone number:', '[]', 'transfer_amount'),
(1, 'transfer_amount', 'input', 'Enter amount to transfer:', '[]', 'transfer_confirm'),
(1, 'transfer_confirm', 'options', 'Transfer {{amount}} to {{recipient}}?\n1. Confirm\n2. Cancel',
'[
  {"id": "1", "label": "Confirm", "next": "transfer_process"},
  {"id": "2", "label": "Cancel", "next": "main_menu"}
]', NULL),
(1, 'exit', 'final', 'Thank you for using Mobile Banking!', '[]', NULL);

-- Sample API configuration
INSERT INTO api_configs (app_id, api_name, endpoint, method, headers, body_template, response_mapping) VALUES 
(1, 'check_balance', 'https://api.example.com/balance', 'POST', 
'{"Content-Type": "application/json", "Authorization": "Bearer {{api_token}}"}',
'{"phone": "{{phone_number}}"}',
'{"balance": "$.data.balance", "currency": "$.data.currency"}');