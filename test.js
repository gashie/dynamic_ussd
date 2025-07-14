const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
const MOCK_API_URL = 'http://localhost:4000';

// Test scenarios
const testScenarios = [
  {
    name: 'Check Account - Existing User',
    description: 'User with account checks balance',
    phone: '+1234567890',
    flow: [
      { input: '', expect: 'Welcome to Contribution Manager' },
      { input: '1', expect: 'Welcome back!' },
      { input: '1', expect: 'Select a group' },
      { input: '1', expect: 'Select a collabo' },
      { input: '1', expect: 'Contributing for' },
      { input: '1', expect: 'Outstanding: $2000' },
      { input: '500', expect: 'Enter reference' },
      { input: 'Monthly payment', expect: 'Display preference' },
      { input: '1', expect: 'Confirm contribution' },
      { input: '1', expect: 'Enter your PIN' },
      { input: '1234', expect: 'Contribution successful' }
    ]
  },
  {
    name: 'New User Sign Up',
    description: 'New user creates account',
    phone: '+5555555555',
    flow: [
      { input: '', expect: 'Welcome to Contribution Manager' },
      { input: '1', expect: 'No account found' },
      { input: '2', expect: 'Enter your first name' },
      { input: 'Alice', expect: 'Enter your last name' },
      { input: 'Johnson', expect: 'Enter your email' },
      { input: 'alice@example.com', expect: 'Confirm your details' },
      { input: '1', expect: 'Registration successful' }
    ]
  },
  {
    name: 'View Contributions',
    description: 'User views collabo metrics',
    phone: '+1234567890',
    flow: [
      { input: '', expect: 'Welcome to Contribution Manager' },
      { input: '2', expect: 'Select a group' },
      { input: '1', expect: 'Select a collabo' },
      { input: '1', expect: 'View:' },
      { input: '1', expect: 'Collabo Metrics' },
      { input: '1', expect: 'Total Raised: $' },
      { input: '1', expect: 'Collabo Metrics' },
      { input: '6', expect: 'View:' }
    ]
  },
  {
    name: 'Profile Management',
    description: 'User views and edits profile',
    phone: '+1234567890',
    flow: [
      { input: '', expect: 'Welcome to Contribution Manager' },
      { input: '4', expect: 'My Profile' },
      { input: '1', expect: 'Profile Details' },
      { input: '2', expect: 'My Profile' },
      { input: '2', expect: 'Edit:' },
      { input: '1', expect: 'Enter new first name' },
      { input: 'Jonathan', expect: 'First name updated successfully' }
    ]
  },
  {
    name: 'Join Group',
    description: 'User checks and accepts group invitation',
    phone: '+5555555555',
    flow: [
      { input: '', expect: 'Welcome to Contribution Manager' },
      { input: '3', expect: 'Investment Club' },
      { input: '1', expect: 'Group: Investment Club' },
      { input: '1', expect: 'successfully joined' }
    ]
  },
  {
    name: 'Contribute for Another Member',
    description: 'User makes contribution on behalf of another member',
    phone: '+1234567890',
    flow: [
      { input: '', expect: 'Welcome to Contribution Manager' },
      { input: '1', expect: 'Welcome back!' },
      { input: '1', expect: 'Select a group' },
      { input: '1', expect: 'Select a collabo' },
      { input: '1', expect: 'Contributing for' },
      { input: '2', expect: 'Enter member phone number' },
      { input: '+9876543210', expect: 'Member found: Jane Smith' },
      { input: '1', expect: 'Enter amount for Jane Smith' },
      { input: '300', expect: 'Enter reference' },
      { input: 'Helping Jane', expect: 'Display preference' },
      { input: '2', expect: 'Confirm contribution' },
      { input: '1', expect: 'Enter your PIN' },
      { input: '1234', expect: 'Contribution successful' }
    ]
  }
];

// Test runner
async function runTest(scenario) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${scenario.name}`);
  console.log(`DESC: ${scenario.description}`);
  console.log(`PHONE: ${scenario.phone}`);
  console.log('='.repeat(60));
  
  const sessionId = `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let text = '';
  let allPassed = true;
  
  for (let i = 0; i < scenario.flow.length; i++) {
    const step = scenario.flow[i];
    
    if (step.input) {
      text = text ? `${text}*${step.input}` : step.input;
    }
    
    try {
      console.log(`\nStep ${i + 1}: Input "${step.input}"`);
      
      const response = await axios.post(`${BASE_URL}/ussd`, {
        sessionId,
        serviceCode: '*384#',
        phoneNumber: scenario.phone,
        text
      });
      
      const responseText = response.data;
      console.log(`Response: ${responseText.substring(0, 100)}...`);
      
      if (!responseText.includes(step.expect)) {
        console.error(`❌ FAILED: Expected "${step.expect}" not found in response`);
        allPassed = false;
      } else {
        console.log(`✓ PASS: Found "${step.expect}"`);
      }
      
      // If response ends, reset for next flow
      if (responseText.startsWith('END')) {
        text = '';
      }
      
    } catch (error) {
      console.error(`❌ ERROR: ${error.message}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Check mock API health
async function checkMockAPI() {
  try {
    const response = await axios.get(`${MOCK_API_URL}/health`);
    console.log('Mock API Status:', response.data);
    return true;
  } catch (error) {
    console.error('Mock API is not running. Please start it with: node mock-api-server.js');
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n🚀 Starting Contribution App Tests\n');
  
  // Check if mock API is running
  const mockAPIReady = await checkMockAPI();
  if (!mockAPIReady) {
    console.log('\n❌ Tests aborted: Mock API not available\n');
    return;
  }
  
  // Wait a bit for everything to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let passedCount = 0;
  
  // Run each test scenario
  for (const scenario of testScenarios) {
    const passed = await runTest(scenario);
    if (passed) passedCount++;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testScenarios.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${testScenarios.length - passedCount}`);
  console.log(`Success Rate: ${((passedCount / testScenarios.length) * 100).toFixed(2)}%`);
  console.log('='.repeat(60));
  
  if (passedCount === testScenarios.length) {
    console.log('\n✅ ALL TESTS PASSED! 🎉\n');
  } else {
    console.log('\n❌ Some tests failed. Please check the logs above.\n');
  }
}

// API Test Endpoints
async function testAPICalls() {
  console.log('\n📡 Testing Individual API Endpoints\n');
  
  const apiTests = [
    {
      name: 'Check Account',
      method: 'POST',
      url: '/api/account/check',
      data: { phone: '+1234567890' }
    },
    {
      name: 'Get User Groups',
      method: 'GET',
      url: '/api/groups/user/+1234567890',
      data: null
    },
    {
      name: 'Get Profile',
      method: 'GET',
      url: '/api/profile/+1234567890',
      data: null
    }
  ];
  
  for (const test of apiTests) {
    try {
      console.log(`Testing: ${test.name}`);
      const response = await axios({
        method: test.method,
        url: `${MOCK_API_URL}${test.url}`,
        data: test.data
      });
      console.log(`✓ Success:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
    }
    console.log('-'.repeat(40));
  }
}

// Run tests based on command line argument
const args = process.argv.slice(2);

if (args.includes('--api-only')) {
  testAPICalls();
} else if (args.includes('--ussd-only')) {
  runAllTests();
} else {
  // Run both
  (async () => {
    await testAPICalls();
    await runAllTests();
  })();
}

module.exports = { runAllTests, testAPICalls };