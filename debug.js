const axios = require('axios');

async function debugApiFlow() {
  console.log('Debugging API Flow\n');
  
  // Step 1: Get groups
  console.log('1. Getting user groups:');
  const groupsRes = await axios.get('http://localhost:4000/api/groups/user/+1234567890');
  console.log('Groups response:');
  console.log('- groups_list:', groupsRes.data.groups_list);
  console.log('- groups array:', groupsRes.data.groups);
  console.log('- groups_options:', typeof groupsRes.data.groups_options);
  
  // Step 2: Simulate selecting group 1
  const selectedGroupIndex = 0; // User selected "1"
  const selectedGroup = groupsRes.data.groups[selectedGroupIndex];
  console.log('\n2. User selected group index', selectedGroupIndex);
  console.log('Selected group:', selectedGroup);
  console.log('Group ID:', selectedGroup.id);
  
  // Step 3: Try to get collabos
  console.log('\n3. Getting collabos for group ID:', selectedGroup.id);
  try {
    const collabosRes = await axios.get(`http://localhost:4000/api/collabos/group/${selectedGroup.id}`);
    console.log('Collabos response:');
    console.log('- collabos_list:', collabosRes.data.collabos_list);
    console.log('- collabos array:', collabosRes.data.collabos);
  } catch (error) {
    console.error('Error getting collabos:', error.message);
  }
  
  // Step 4: Check the template variable issue
  console.log('\n4. Testing template resolution:');
  console.log('The system expects {{groups_selected_id}} to be resolved');
  console.log('But this requires proper handling in menuController.js');
}

async function testDatabaseQueries() {
  console.log('\n\nChecking Database Configuration\n');
  
  const { Client } = require('pg');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ussd_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'admin'
  });
  
  try {
    await client.connect();
    
    // Check API config for get_group_collabos
    const result = await client.query(`
      SELECT api_name, endpoint, response_mapping 
      FROM api_configs 
      WHERE api_name = 'get_group_collabos' 
      AND app_id = (SELECT id FROM ussd_apps WHERE ussd_code = '*384#')
    `);
    
    console.log('API Config for get_group_collabos:');
    console.log('Endpoint:', result.rows[0]?.endpoint);
    console.log('Response mapping:', JSON.stringify(result.rows[0]?.response_mapping, null, 2));
    
    await client.end();
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

// Run both tests
async function run() {
  await debugApiFlow();
  await testDatabaseQueries();
}

run();