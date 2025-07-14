const http = require('http');

// Simple HTTP request without axios
function testUSSD() {
  const data = JSON.stringify({
    sessionId: 'SIMPLE_TEST_' + Date.now(),
    serviceCode: '*384#',
    phoneNumber: '+1234567890',
    text: ''
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/ussd',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('Making request to:', `http://${options.hostname}:${options.port}${options.path}`);
  console.log('Request data:', data);

  const req = http.request(options, (res) => {
    console.log('\nResponse Status:', res.statusCode);
    console.log('Response Headers:', res.headers);

    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('\nResponse Body:', responseData);
      
      if (responseData) {
        // Try to identify the response format
        if (responseData.startsWith('CON ') || responseData.startsWith('END ')) {
          console.log('\n✓ Valid USSD response format');
          console.log('Type:', responseData.substring(0, 3));
          console.log('Content:', responseData.substring(4));
        } else {
          console.log('\n⚠ Unexpected response format');
        }
      } else {
        console.log('\n✗ Empty response received');
      }
    });
  });

  req.on('error', (error) => {
    console.error('\n✗ Request failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\nThe server is not running on port 3000');
      console.log('Please check:');
      console.log('1. Is the server running? (npm run dev)');
      console.log('2. Is it using the correct port? Check .env file');
      console.log('3. Any startup errors in the server console?');
    }
  });

  req.write(data);
  req.end();
}

// Test health endpoint
function testHealth() {
  console.log('Testing health endpoint...\n');
  
  http.get('http://localhost:3000/health', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Health check response:', data);
      console.log('\nNow testing USSD endpoint...\n');
      setTimeout(testUSSD, 1000);
    });
  }).on('error', (err) => {
    console.error('Health check failed:', err.message);
    console.log('\nTrying USSD endpoint anyway...\n');
    testUSSD();
  });
}

// Start test
console.log('Simple USSD Test');
console.log('================\n');
testHealth();