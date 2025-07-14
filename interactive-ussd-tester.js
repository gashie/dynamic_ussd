const readline = require('readline');
const axios = require('axios');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const BASE_URL = 'http://localhost:3000/api/v1/ussd';

class USSDTester {
  constructor() {
    this.sessionId = 'INTERACTIVE_' + Date.now();
    this.phoneNumber = '+1234567890';
    this.serviceCode = '*384#';
    this.textHistory = [];
  }

  async start() {
    console.log('Interactive USSD Tester');
    console.log('======================');
    console.log(`Session ID: ${this.sessionId}`);
    console.log(`Phone: ${this.phoneNumber}`);
    console.log(`Service Code: ${this.serviceCode}`);
    console.log('\nType your selection and press Enter');
    console.log('Type "exit" to quit, "reset" to start over\n');

    // Start with initial request
    await this.sendRequest();
  }

  async sendRequest(input = null) {
    // Build text field
    if (input !== null && input !== '') {
      this.textHistory.push(input);
    }
    
    const text = this.textHistory.join('*');
    
    try {
      console.log(`\n[Sending: text="${text}"]`);
      
      const response = await axios.post(BASE_URL, {
        sessionId: this.sessionId,
        serviceCode: this.serviceCode,
        phoneNumber: this.phoneNumber,
        text
      });
      
      const responseData = response.data;
      
      // Display response
      console.log('\n' + '─'.repeat(50));
      console.log(responseData);
      console.log('─'.repeat(50));
      
      // Check if session ended
      if (responseData.startsWith('END')) {
        console.log('\n[Session ended]');
        this.promptForNewSession();
      } else {
        this.promptForInput();
      }
      
    } catch (error) {
      console.error('\n[Error]:', error.response?.data || error.message);
      this.promptForInput();
    }
  }

  promptForInput() {
    rl.question('\nYour selection: ', async (input) => {
      input = input.trim();
      
      if (input.toLowerCase() === 'exit') {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      } else if (input.toLowerCase() === 'reset') {
        this.reset();
        await this.sendRequest();
      } else if (input === '0' && this.textHistory.length > 0) {
        // Go back
        this.textHistory.pop();
        await this.sendRequest();
      } else {
        await this.sendRequest(input);
      }
    });
  }

  promptForNewSession() {
    rl.question('\nStart new session? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        this.reset();
        await this.sendRequest();
      } else {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }
    });
  }

  reset() {
    this.sessionId = 'INTERACTIVE_' + Date.now();
    this.textHistory = [];
    console.log(`\n[New session: ${this.sessionId}]`);
  }
}

// Quick test mode
async function quickTest() {
  console.log('Quick Test Mode');
  console.log('===============\n');
  
  const sessionId = 'QUICK_' + Date.now();
  
  // Predefined flow
  const flow = [
    { text: '', expect: 'Welcome to Contribution Manager' },
    { text: '1', expect: 'Welcome back!' },
    { text: '1*1', expect: 'Select a group' },
    { text: '1*1*1', expect: 'Select a collabo' },
    { text: '1*1*1*1', expect: 'Contributing for' },
    { text: '1*1*1*1*1', expect: 'Enter amount' }
  ];
  
  for (const step of flow) {
    console.log(`\nSending: "${step.text}"`);
    
    try {
      const response = await axios.post(BASE_URL, {
        sessionId,
        serviceCode: '*384#',
        phoneNumber: '+1234567890',
        text: step.text
      });
      
      const data = response.data;
      const firstLine = data.split('\n')[0];
      
      if (data.includes(step.expect)) {
        console.log(`✓ Found: "${step.expect}"`);
      } else {
        console.log(`✗ Expected: "${step.expect}"`);
        console.log(`  Got: ${firstLine}`);
      }
      
    } catch (error) {
      console.error('✗ Error:', error.message);
      break;
    }
  }
}

// Main
const args = process.argv.slice(2);

if (args.includes('--quick')) {
  quickTest();
} else {
  const tester = new USSDTester();
  tester.start();
}