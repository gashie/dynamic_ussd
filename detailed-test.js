const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
const MOCK_API_URL = 'http://localhost:4000';

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Simple test to verify USSD endpoint
async function testBasicUSSD() {
  console.log(`\n${colors.blue}Testing Basic USSD Endpoint${colors.reset}\n`);
  
  try {
    const response = await axios.post(`${BASE_URL}/ussd`, {
      sessionId: 'TEST_BASIC_' + Date.now(),
      serviceCode: '*384#',
      phoneNumber: '+1234567890',
      text: ''
    });
    
    console.log(`${colors.green}✓ USSD Endpoint Working${colors.reset}`);
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ USSD Endpoint Failed${colors.reset}`);
    console.error('Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
    return false;
  }
}

// Test server health
async function testServerHealth() {
  console.log(`\n${colors.blue}Testing Server Health${colors.reset}\n`);
  
  try {
    const response = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    console.log(`${colors.green}✓ Server is healthy${colors.reset}`);
    console.log('Health:', response.data);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Server health check failed${colors.reset}`);
    console.error('Error:', error.message);
    return false;
  }
}

// Test database connection
async function testDatabaseConnection() {
  console.log(`\n${colors.blue}Testing Database Connection${colors.reset}\n`);
  
  try {
    // Try to get apps (requires database)
    const response = await axios.get(`${BASE_URL}/admin/apps`, {
      headers: { 'X-API-Key': 'development-key' }
    });
    console.log(`${colors.green}✓ Database Connected${colors.reset}`);
    console.log('Apps found:', response.data.data?.length || 0);
    
    // Check if contribution app exists
    const contribApp = response.data.data?.find(app => app.ussd_code === '*384#');
    if (contribApp) {
      console.log(`${colors.green}✓ Contribution App Found${colors.reset}`);
      console.log('App ID:', contribApp.id);
      console.log('App Name:', contribApp.app_name);
    } else {
      console.log(`${colors.yellow}⚠ Contribution App Not Found${colors.reset}`);
      console.log('Run: psql -U postgres -d ussd_db -f database/contribution.sql');
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Database test failed${colors.reset}`);
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

// Test mock API
async function testMockAPI() {
  console.log(`\n${colors.blue}Testing Mock API Server${colors.reset}\n`);
  
  try {
    const response = await axios.get(`${MOCK_API_URL}/health`);
    console.log(`${colors.green}✓ Mock API Running${colors.reset}`);
    console.log('Status:', response.data);
    
    // Test a specific endpoint
    const checkAccount = await axios.post(`${MOCK_API_URL}/api/account/check`, {
      phone: '+1234567890'
    });
    console.log(`${colors.green}✓ Mock API Endpoints Working${colors.reset}`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Mock API test failed${colors.reset}`);
    console.error('Error:', error.message);
    console.error(`\nMake sure to run: node mock-api-server.js`);
    return false;
  }
}

// Test single USSD interaction
async function testSingleInteraction(sessionId, text, expectedContent) {
  try {
    console.log(`\n${colors.yellow}Request:${colors.reset}`);
    console.log(`  Session: ${sessionId}`);
    console.log(`  Text: "${text}"`);
    
    const response = await axios.post(`${BASE_URL}/ussd`, {
      sessionId,
      serviceCode: '*384#',
      phoneNumber: '+1234567890',
      text
    }, {
      timeout: 5000,
      validateStatus: () => true // Don't throw on any status
    });
    
    if (response.status !== 200) {
      console.log(`${colors.red}  Status: ${response.status}${colors.reset}`);
      console.log(`  Error:`, response.data);
      return false;
    }
    
    const responseText = response.data;
    console.log(`${colors.green}Response:${colors.reset}`);
    console.log(`  Type: ${responseText.substring(0, 3)}`);
    console.log(`  Text: ${responseText.substring(4, 100)}...`);
    
    if (expectedContent && !responseText.includes(expectedContent)) {
      console.log(`${colors.red}  ✗ Expected "${expectedContent}" not found${colors.reset}`);
      return false;
    } else if (expectedContent) {
      console.log(`${colors.green}  ✓ Found "${expectedContent}"${colors.reset}`);
    }
    
    return true;
  } catch (error) {
    console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
    if (error.code === 'ECONNREFUSED') {
      console.log('  Server not running on port 3000');
    }
    return false;
  }
}

// Test complete flow
async function testCompleteFlow() {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}Testing Complete USSD Flow${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  
  const sessionId = 'TEST_FLOW_' + Date.now();
  
  // Test sequence
  const steps = [
    { text: '', expect: 'Welcome to Contribution Manager' },
    { text: '1', expect: 'Welcome back!' },
    { text: '1*1', expect: 'Select a group' }
  ];
  
  let allPassed = true;
  
  for (const step of steps) {
    const passed = await testSingleInteraction(sessionId, step.text, step.expect);
    if (!passed) {
      allPassed = false;
      break;
    }
  }
  
  return allPassed;
}

// Debug session state
async function debugSession(sessionId) {
  console.log(`\n${colors.blue}Debugging Session${colors.reset}\n`);
  
  try {
    const response = await axios.get(`${BASE_URL}/session/${sessionId}`);
    console.log('Session Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('Session debug not available in production mode');
  }
}

// Main diagnostic function
async function runDiagnostics() {
  console.log(`\n${colors.blue}USSD System Diagnostics${colors.reset}`);
  console.log('='.repeat(60));
  
  const tests = [
    { name: 'Server Health', fn: testServerHealth },
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Mock API Server', fn: testMockAPI },
    { name: 'Basic USSD Endpoint', fn: testBasicUSSD },
    { name: 'Complete Flow', fn: testCompleteFlow }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const passed = await test.fn();
    results.push({ name: test.name, passed });
    
    if (!passed && test.name === 'Mock API Server') {
      console.log(`\n${colors.yellow}Skipping remaining tests - Mock API required${colors.reset}`);
      break;
    }
  }
  
  // Summary
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}DIAGNOSTIC SUMMARY${colors.reset}`);
  console.log('='.repeat(60));
  
  results.forEach(result => {
    const icon = result.passed ? `${colors.green}✓` : `${colors.red}✗`;
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`${icon} ${result.name}: ${status}${colors.reset}`);
  });
  
  const allPassed = results.every(r => r.passed);
  
  if (!allPassed) {
    console.log(`\n${colors.yellow}Troubleshooting Steps:${colors.reset}`);
    console.log('1. Ensure PostgreSQL is running: sudo service postgresql start');
    console.log('2. Check database exists: psql -U postgres -c "\\l" | grep ussd_db');
    console.log('3. Run schema: psql -U postgres -d ussd_db -f database/schema.sql');
    console.log('4. Run contribution app: psql -U postgres -d ussd_db -f database/contribution.sql');
    console.log('5. Start mock API: node mock-api-server.js (in another terminal)');
    console.log('6. Start USSD server: npm run dev (in another terminal)');
    console.log('7. Check .env file has correct DB_PASSWORD');
  } else {
    console.log(`\n${colors.green}All diagnostics passed! System is ready.${colors.reset}`);
  }
  
  console.log('\n');
}

// Test with curl command
function showCurlExamples() {
  console.log(`\n${colors.blue}Manual Testing with CURL${colors.reset}`);
  console.log('='.repeat(60));
  
  console.log('\nTest initial menu:');
  console.log(`curl -X POST ${BASE_URL}/ussd \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "TEST_'${Date.now()}'",
    "serviceCode": "*384#",
    "phoneNumber": "+1234567890",
    "text": ""
  }'`);
  
  console.log('\n\nTest with input:');
  console.log(`curl -X POST ${BASE_URL}/ussd \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "TEST_'${Date.now()}'",
    "serviceCode": "*384#",
    "phoneNumber": "+1234567890",
    "text": "1"
  }'`);
}

// Run based on arguments
const args = process.argv.slice(2);

if (args.includes('--curl')) {
  showCurlExamples();
} else if (args.includes('--quick')) {
  testBasicUSSD().then(() => process.exit(0));
} else {
  runDiagnostics().then(() => {
    if (args.includes('--examples')) {
      showCurlExamples();
    }
  });
}

module.exports = { runDiagnostics, testBasicUSSD };