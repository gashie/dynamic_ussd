const axios = require('axios');

async function testAPIResponses() {
  console.log('Testing Mock API Responses\n');
  
  try {
    // Test get_user_groups
    console.log('1. Testing get_user_groups API:');
    const groupsResponse = await axios.get('http://localhost:4000/api/groups/user/+1234567890');
    console.log('Response:', JSON.stringify(groupsResponse.data, null, 2));
    
    // Check the structure
    if (groupsResponse.data.groups_options) {
      console.log('\nParsing groups_options:');
      const options = JSON.parse(groupsResponse.data.groups_options);
      console.log('Parsed options:', options);
    }
    
    // Test get_group_collabos
    console.log('\n2. Testing get_group_collabos API:');
    const collabosResponse = await axios.get('http://localhost:4000/api/collabos/group/1');
    console.log('Response:', JSON.stringify(collabosResponse.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPIResponses();