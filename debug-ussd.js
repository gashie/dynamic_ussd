const axios = require('axios');
require('dotenv').config();

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api/v1`;

// Test the USSD endpoint directly
async function testUSSDEndpoint() {
  console.log('\n========== Testing USSD Endpoint ==========\n');
  
  const testData = {
    sessionId: 'DEBUG_' + Date.now(),
    serviceCode: '*384#',
    phoneNumber: '+1234567890',
    text: ''
  };
  
  console.log('Request Data:', JSON.stringify(testData, null, 2));
  
  try {
    const response = await axios.post(`${BASE_URL}/ussd`, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      validateStatus: () => true // Accept any status code
    });
    
    console.log('\nResponse Status:', response.status);
    console.log('Response Headers:', response.headers);
    console.log('Response Data:', response.data);
    
    if (response.status === 200) {
      console.log('\n✓ USSD endpoint is working');
      
      // Parse the response
      const responseText = response.data;
      const responseType = responseText.substring(0, 3);
      const responseContent = responseText.substring(4);
      
      console.log('\nParsed Response:');
      console.log('  Type:', responseType);
      console.log('  Content:', responseContent);
    } else {
      console.log('\n✗ USSD endpoint returned error');
    }
    
  } catch (error) {
    console.error('\n✗ Failed to connect to USSD endpoint');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nThe USSD server is not running.');
      console.error('Please run: npm run dev');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\nRequest timed out. The server might be stuck.');
    }
  }
}

// Check if the app exists in database
async function checkDatabase() {
  console.log('\n========== Checking Database ==========\n');
  
  try {
    const response = await axios.get(`${BASE_URL}/admin/apps`, {
      headers: {
        'X-API-Key': process.env.ADMIN_API_KEY || 'development-key'
      }
    });
    
    console.log('Total apps found:', response.data.data.length);
    
    const contribApp = response.data.data.find(app => app.ussd_code === '*384#');
    
    if (contribApp) {
      console.log('\n✓ Contribution app found in database');
      console.log('  ID:', contribApp.id);
      console.log('  Name:', contribApp.app_name);
      console.log('  Entry Menu:', contribApp.entry_menu);
      
      // Get menus for this app
      const menusResponse = await axios.get(`${BASE_URL}/admin/apps/${contribApp.id}/menus`, {
        headers: {
          'X-API-Key': process.env.ADMIN_API_KEY || 'development-key'
        }
      });
      
      console.log('\nMenus found:', menusResponse.data.data.length);
      
      // Check main menu
      const mainMenu = menusResponse.data.data.find(m => m.menu_code === 'main_menu');
      if (mainMenu) {
        console.log('\n✓ Main menu found');
        console.log('  Text:', mainMenu.text_template.substring(0, 50) + '...');
      } else {
        console.log('\n✗ Main menu not found');
      }
      
    } else {
      console.log('\n✗ Contribution app not found in database');
      console.log('Please run: psql -U postgres -d ussd_db -f database/contribution.sql');
    }
    
  } catch (error) {
    console.error('\n✗ Database check failed');
    console.error('Error:', error.response?.data || error.message);
  }
}

// Test the actual flow step by step
async function testFlowStepByStep() {
  console.log('\n========== Testing Flow Step by Step ==========\n');
  
  const sessionId = 'STEP_TEST_' + Date.now();
  
  // Step 1: Initial request
  console.log('Step 1: Initial request (empty text)');
  
  try {
    const response1 = await axios.post(`${BASE_URL}/ussd`, {
      sessionId,
      serviceCode: '*384#',
      phoneNumber: '+1234567890',
      text: ''
    });
    
    console.log('Response:', response1.data);
    
    if (!response1.data.includes('Welcome to Contribution Manager')) {
      console.log('✗ Unexpected response');
      return;
    }
    console.log('✓ Got welcome menu');
    
    // Step 2: Select option 1
    console.log('\nStep 2: Select option 1 (Make a contribution)');
    
    const response2 = await axios.post(`${BASE_URL}/ussd`, {
      sessionId,
      serviceCode: '*384#',
      phoneNumber: '+1234567890',
      text: '1'
    });
    
    console.log('Response:', response2.data);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Check server logs
function showLogInstructions() {
  console.log('\n========== Server Log Instructions ==========\n');
  console.log('To see detailed server logs, add console.log statements in:');
  console.log('1. controllers/ussdController.js - handleUSSDRequest function');
  console.log('2. controllers/menuController.js - processMenuFlow function');
  console.log('3. models/sessionModel.js - getOrCreateSession function');
  console.log('\nAdd this at the start of handleUSSDRequest:');
  console.log(`
console.log('=== USSD Request ===');
console.log('Body:', req.body);
console.log('Session ID:', sessionId);
console.log('Service Code:', serviceCode);
console.log('Phone:', phoneNumber);
console.log('Text:', text);
`);
}

// Main debug function
async function runDebug() {
  console.log('USSD System Debugger');
  console.log('====================\n');
  
  console.log('Environment:');
  console.log('  PORT:', process.env.PORT || 3000);
  console.log('  DB_NAME:', process.env.DB_NAME);
  console.log('  DB_HOST:', process.env.DB_HOST);
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  
  await testUSSDEndpoint();
  await checkDatabase();
  await testFlowStepByStep();
  
  showLogInstructions();
}

// Run the debugger
runDebug();