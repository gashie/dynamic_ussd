const axios = require('axios');
require('dotenv').config();

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const ADMIN_URL = `${BASE_URL}/admin`;
const API_KEY = process.env.ADMIN_API_KEY || 'development-key';

// Test utilities
const log = (message, data = null) => {
  console.log(`\n[TEST] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
};

const error = (message, err) => {
  console.error(`\n[ERROR] ${message}`);
  console.error(err.response?.data || err.message);
};

// Test data
const testApp = {
  ussdCode: '*789#',
  appName: 'Test Banking App',
  entryMenu: 'main_menu',
  config: { testMode: true }
};

const testMenus = [
  {
    menuCode: 'main_menu',
    menuType: 'options',
    textTemplate: 'Welcome to Test Bank\n1. Check Balance\n2. Send Money\n3. Exit',
    options: [
      { id: '1', label: 'Check Balance', next: 'balance_menu' },
      { id: '2', label: 'Send Money', next: 'send_money_phone' },
      { id: '3', label: 'Exit', next: 'exit_menu' }
    ]
  },
  {
    menuCode: 'balance_menu',
    menuType: 'final',
    textTemplate: 'Your balance is ${{balance}}.00',
    apiCalls: [{ name: 'get_balance' }]
  },
  {
    menuCode: 'send_money_phone',
    menuType: 'input',
    textTemplate: 'Enter recipient phone number:',
    validationRules: {
      required: true,
      phone: true
    },
    nextMenu: 'send_money_amount'
  },
  {
    menuCode: 'send_money_amount',
    menuType: 'input',
    textTemplate: 'Enter amount to send:',
    validationRules: {
      required: true,
      amount: true,
      minAmount: { value: 1, message: 'Minimum amount is 1' },
      maxAmount: { value: 10000, message: 'Maximum amount is 10,000' }
    },
    nextMenu: 'send_money_confirm'
  },
  {
    menuCode: 'send_money_confirm',
    menuType: 'options',
    textTemplate: 'Send {{send_money_amount_input}} to {{send_money_phone_input}}?\n1. Confirm\n2. Cancel',
    options: [
      { id: '1', label: 'Confirm', next: 'send_money_process' },
      { id: '2', label: 'Cancel', next: 'main_menu' }
    ]
  },
  {
    menuCode: 'send_money_process',
    menuType: 'final',
    textTemplate: 'Transfer successful!\nTransaction ID: {{transactionId}}\nAmount: ${{send_money_amount_input}}\nTo: {{send_money_phone_input}}',
    apiCalls: [{ name: 'process_transfer' }]
  },
  {
    menuCode: 'exit_menu',
    menuType: 'final',
    textTemplate: 'Thank you for using Test Bank!'
  }
];

const testApiConfigs = [
  {
    apiName: 'get_balance',
    endpoint: 'https://jsonplaceholder.typicode.com/users/1',
    method: 'GET',
    responseMapping: {
      balance: '$.id',
      currency: '$.address.zipcode'
    }
  },
  {
    apiName: 'process_transfer',
    endpoint: 'https://jsonplaceholder.typicode.com/posts',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    bodyTemplate: {
      title: 'Transfer',
      body: 'Transfer {{send_money_amount_input}} to {{send_money_phone_input}}',
      userId: 1
    },
    responseMapping: {
      transactionId: '$.id',
      amount: '$.userId',
      recipient: '$.title'
    }
  }
];

// Test functions
async function testAdminEndpoints() {
  log('Testing Admin Endpoints...');
  
  try {
    // Create app
    log('Creating test app...');
    const appResponse = await axios.post(`${ADMIN_URL}/apps`, testApp, {
      headers: { 'X-API-Key': API_KEY }
    });
    const appId = appResponse.data.data.id;
    log('App created', { appId });
    
    // Create menus
    log('Creating menus...');
    for (const menu of testMenus) {
      await axios.post(`${ADMIN_URL}/apps/${appId}/menus`, menu, {
        headers: { 'X-API-Key': API_KEY }
      });
    }
    log('Menus created');
    
    // Create API configs
    log('Creating API configurations...');
    for (const config of testApiConfigs) {
      await axios.post(`${ADMIN_URL}/apps/${appId}/api-configs`, config, {
        headers: { 'X-API-Key': API_KEY }
      });
    }
    log('API configurations created');
    
    // Test export
    log('Testing export...');
    const exportResponse = await axios.get(`${ADMIN_URL}/apps/${appId}/export`, {
      headers: { 'X-API-Key': API_KEY }
    });
    log('Export successful', { 
      menus: exportResponse.data.data.menus.length,
      apis: exportResponse.data.data.apiConfigs.length 
    });
    
    return appId;
    
  } catch (err) {
    error('Admin endpoint test failed', err);
    throw err;
  }
}

async function testUSSDFlow() {
  log('Testing USSD Flow...');
  
  try {
    const phoneNumber = '+1234567890';
    
    // Test sequence - each group uses same session
    const testGroups = [
      // Test 1: Check balance flow
      {
        sessionId: 'TEST_BALANCE_' + Date.now(),
        tests: [
          { input: '', expected: 'Welcome to Test Bank' },
          { input: '1', expected: 'Your balance is' }
        ]
      },
      // Test 2: Transfer flow
      {
        sessionId: 'TEST_TRANSFER_' + Date.now(),
        tests: [
          { input: '', expected: 'Welcome to Test Bank' },
          { input: '2', expected: 'Enter recipient phone number' },
          { input: '+9876543210', expected: 'Enter amount to send' },
          { input: '100', expected: 'Send 100 to +9876543210?' },
          { input: '1', expected: 'Transfer successful!' }
        ]
      },
      // Test 3: Exit flow
      {
        sessionId: 'TEST_EXIT_' + Date.now(),
        tests: [
          { input: '', expected: 'Welcome to Test Bank' },
          { input: '3', expected: 'Thank you for using Test Bank!' }
        ]
      }
    ];
    
    for (const group of testGroups) {
      let text = '';
      log(`\nTesting flow with session: ${group.sessionId}`);
      
      for (const test of group.tests) {
        if (test.input) {
          text = text ? `${text}*${test.input}` : test.input;
        }
        
        log(`Input: "${test.input}" (full text: "${text}")`);
        
        const response = await axios.post(`${BASE_URL}/ussd`, {
          sessionId: group.sessionId,
          serviceCode: '*789#',
          phoneNumber,
          text
        });
        
        const responseText = response.data;
        log('Response', responseText.substring(0, 100) + '...');
        
        if (!responseText.includes(test.expected)) {
          throw new Error(`Expected "${test.expected}" but got "${responseText}"`);
        }
      }
    }
    
    log('USSD flow test completed successfully');
    
  } catch (err) {
    error('USSD flow test failed', err);
    throw err;
  }
}

async function testValidation() {
  log('Testing Input Validation...');
  
  try {
    const sessionId = 'VALIDATION_' + Date.now();
    
    // Test invalid phone number
    await axios.post(`${BASE_URL}/ussd`, {
      sessionId: sessionId + '_1',
      serviceCode: '*789#',
      phoneNumber: '+1234567890',
      text: '2'
    });
    
    const invalidPhoneResponse = await axios.post(`${BASE_URL}/ussd`, {
      sessionId: sessionId + '_1',
      serviceCode: '*789#',
      phoneNumber: '+1234567890',
      text: '2*abc123'
    });
    
    if (!invalidPhoneResponse.data.includes('valid phone number')) {
      throw new Error('Phone validation failed');
    }
    log('Phone validation passed');
    
    // Test invalid amount
    await axios.post(`${BASE_URL}/ussd`, {
      sessionId: sessionId + '_2',
      serviceCode: '*789#',
      phoneNumber: '+1234567890',
      text: '2*+9876543210'
    });
    
    const invalidAmountResponse = await axios.post(`${BASE_URL}/ussd`, {
      sessionId: sessionId + '_2',
      serviceCode: '*789#',
      phoneNumber: '+1234567890',
      text: '2*+9876543210*0'
    });
    
    if (!invalidAmountResponse.data.includes('Minimum amount')) {
      throw new Error('Amount validation failed');
    }
    log('Amount validation passed');
    
  } catch (err) {
    error('Validation test failed', err);
    throw err;
  }
}

async function testRateLimiting() {
  log('Testing Rate Limiting...');
  
  try {
    const promises = [];
    for (let i = 0; i < 201; i++) {
      promises.push(
        axios.get(`${BASE_URL}/health`)
          .catch(err => err.response)
      );
    }
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.some(r => r && r.status === 429);
    
    if (!rateLimited) {
      throw new Error('Rate limiting not working');
    }
    
    log('Rate limiting test passed');
    
  } catch (err) {
    error('Rate limiting test failed', err);
    throw err;
  }
}

async function cleanup(appId) {
  log('Cleaning up test data...');
  
  try {
    await axios.delete(`${ADMIN_URL}/apps/${appId}`, {
      headers: { 'X-API-Key': API_KEY }
    });
    log('Cleanup completed');
  } catch (err) {
    error('Cleanup failed', err);
  }
}

// Run tests
async function runTests() {
  console.log('\n========== Starting USSD System Tests ==========\n');
  
  let appId;
  
  try {
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run test suite
    appId = await testAdminEndpoints();
    await testUSSDFlow();
    await testValidation();
    await testRateLimiting();
    
    console.log('\n========== All Tests Passed! ==========\n');
    
  } catch (err) {
    console.log('\n========== Tests Failed ==========\n');
    process.exit(1);
  } finally {
    if (appId) {
      await cleanup(appId);
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };