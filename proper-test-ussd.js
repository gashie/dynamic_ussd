const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1/ussd';

// IMPORTANT: In USSD, the text field accumulates all inputs separated by *
// Example flow:
// - Initial: text = ""
// - Select 1: text = "1"
// - Select 2: text = "1*2"
// - Select 3: text = "1*2*3"

async function testUSSDFlow() {
  console.log('Proper USSD Flow Test');
  console.log('====================\n');
  
  const sessionId = 'PROPER_TEST_' + Date.now();
  let accumulatedText = '';
  
  // Step 1: Initial menu
  console.log('Step 1: Initial Menu');
  console.log('Sending: text=""');
  let response = await sendUSSD(sessionId, '');
  console.log('Response:', response);
  console.log('\n---\n');
  
  // Step 2: Select "Make a contribution" (option 1)
  accumulatedText = '1';
  console.log('Step 2: Select "Make a contribution" (option 1)');
  console.log(`Sending: text="${accumulatedText}"`);
  response = await sendUSSD(sessionId, accumulatedText);
  console.log('Response:', response);
  console.log('\n---\n');
  
  // Step 3: Select "Continue" (option 1)
  accumulatedText = '1*1';
  console.log('Step 3: Select "Continue" (option 1)');
  console.log(`Sending: text="${accumulatedText}"`);
  response = await sendUSSD(sessionId, accumulatedText);
  console.log('Response:', response);
  console.log('\n---\n');
  
  // Step 4: Select "Savings Club" (option 1)
  accumulatedText = '1*1*1';
  console.log('Step 4: Select "Savings Club" (option 1)');
  console.log(`Sending: text="${accumulatedText}"`);
  response = await sendUSSD(sessionId, accumulatedText);
  console.log('Response:', response);
  console.log('\n---\n');
  
  // Step 5: Select "December Savings" (option 1)
  accumulatedText = '1*1*1*1';
  console.log('Step 5: Select "December Savings" (option 1)');
  console.log(`Sending: text="${accumulatedText}"`);
  response = await sendUSSD(sessionId, accumulatedText);
  console.log('Response:', response);
  console.log('\n---\n');
  
  // Step 6: Select "Myself" (option 1)
  accumulatedText = '1*1*1*1*1';
  console.log('Step 6: Select "Myself" (option 1)');
  console.log(`Sending: text="${accumulatedText}"`);
  response = await sendUSSD(sessionId, accumulatedText);
  console.log('Response:', response);
}

async function sendUSSD(sessionId, text) {
  try {
    const response = await axios.post(BASE_URL, {
      sessionId,
      serviceCode: '*384#',
      phoneNumber: '+1234567890',
      text
    });
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

// Test with manual session management
async function testManualFlow() {
  console.log('\n\nManual Flow Test (Simulating Real USSD)');
  console.log('======================================\n');
  
  const sessionId = 'MANUAL_' + Date.now();
  
  // This simulates what actually happens in a real USSD session
  const steps = [
    { input: '', description: 'Initial menu' },
    { input: '1', description: 'Select "Make a contribution"' },
    { input: '1*1', description: 'Previous + Select "Continue"' },
    { input: '1*1*1', description: 'Previous + Select "Savings Club"' },
    { input: '1*1*1*1', description: 'Previous + Select "December Savings"' },
    { input: '1*1*1*1*1', description: 'Previous + Select "Myself"' }
  ];
  
  for (const step of steps) {
    console.log(`\n${step.description}`);
    console.log(`Text: "${step.input}"`);
    
    const response = await sendUSSD(sessionId, step.input);
    if (response) {
      const lines = response.split('\n');
      console.log('Response:', lines[0]); // First line
      if (lines.length > 1) {
        console.log('Options:', lines.slice(1, 6).join('\n')); // Show first few options
      }
    }
  }
}

// Show the difference between wrong and right approach
async function demonstrateCommonMistake() {
  console.log('\n\nCommon Mistake Demo');
  console.log('==================\n');
  
  const sessionId = 'MISTAKE_' + Date.now();
  
  console.log('WRONG WAY (sending only last input):');
  await sendUSSD(sessionId, '');
  await sendUSSD(sessionId, '1');
  await sendUSSD(sessionId, '1'); // This will take you back to the account check menu!
  
  console.log('\nRIGHT WAY (accumulating inputs):');
  const correctSession = 'CORRECT_' + Date.now();
  await sendUSSD(correctSession, '');
  await sendUSSD(correctSession, '1');
  await sendUSSD(correctSession, '1*1'); // This continues forward correctly
}

// Test your specific case
async function testYourCase() {
  console.log('\n\nTesting Your Specific Case');
  console.log('=========================\n');
  
  const data = {
    sessionId: "fake10",
    serviceCode: "*384#",
    phoneNumber: "+1234567890",
    text: "1*1*1"  // Should be accumulated, not just "1"
  };
  
  console.log('Sending:', JSON.stringify(data, null, 2));
  
  const response = await axios.post(BASE_URL, data);
  console.log('\nResponse:', response.data);
}

// Run all tests
async function runAllTests() {
  await testUSSDFlow();
  await testManualFlow();
  await demonstrateCommonMistake();
  await testYourCase();
}

runAllTests().catch(console.error);