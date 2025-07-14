const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

async function debugFlow() {
  const sessionId = 'DEBUG_FLOW_' + Date.now();
  console.log('Debug Flow - Session:', sessionId);
  console.log('=' .repeat(60));
  
  // Step 1: Initial menu
  console.log('\nStep 1: Initial Menu');
  let response = await makeRequest(sessionId, '');
  
  // Step 2: Select "Make a contribution" (option 1)
  console.log('\nStep 2: Select "Make a contribution"');
  response = await makeRequest(sessionId, '1');
  
  // Step 3: Select "Continue" (option 1) - should load groups
  console.log('\nStep 3: Select "Continue" to see groups');
  response = await makeRequest(sessionId, '1*1');
  
  // Let's also check what's in the session
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('\nChecking session state:');
      const sessionInfo = await axios.get(`${BASE_URL}/session/${sessionId}`);
      console.log('Session:', JSON.stringify(sessionInfo.data, null, 2));
    } catch (e) {
      console.log('(Session debug endpoint not available)');
    }
  }
}

async function makeRequest(sessionId, text) {
  try {
    const response = await axios.post(`${BASE_URL}/ussd`, {
      sessionId,
      serviceCode: '*384#',
      phoneNumber: '+1234567890',
      text
    });
    
    const data = response.data;
    console.log('Request text:', text || '(empty)');
    console.log('Response:', data.substring(0, 200) + (data.length > 200 ? '...' : ''));
    
    // Extract menu type and content
    const type = data.substring(0, 3);
    const content = data.substring(4);
    
    // Check for template variables
    const templateVars = content.match(/\{\{[^}]+\}\}/g);
    if (templateVars) {
      console.log('⚠️  Unprocessed template variables found:', templateVars);
    }
    
    return data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

// Also test the API endpoints directly
async function testDirectAPI() {
  console.log('\n\nDirect API Tests');
  console.log('=' .repeat(60));
  
  try {
    // Check account
    console.log('\n1. Check Account:');
    const checkAccount = await axios.post('http://localhost:4000/api/account/check', {
      phone: '+1234567890'
    });
    console.log('account_status_message:', checkAccount.data.account_status_message);
    
    // Get user groups
    console.log('\n2. Get User Groups:');
    const groups = await axios.get('http://localhost:4000/api/groups/user/+1234567890');
    console.log('groups_list:', groups.data.groups_list);
    console.log('groups_options (type):', typeof groups.data.groups_options);
    console.log('groups_options (value):', groups.data.groups_options);
    
    // Parse and display options
    if (groups.data.groups_options) {
      const parsed = JSON.parse(groups.data.groups_options);
      console.log('Parsed options:');
      parsed.forEach((opt, i) => {
        console.log(`  ${i}: id="${opt.id}", label="${opt.label}", next="${opt.next}"`);
      });
    }
    
  } catch (error) {
    console.error('API Error:', error.message);
  }
}

// Run both tests
async function run() {
  await testDirectAPI();
  console.log('\n');
  await debugFlow();
}

run();