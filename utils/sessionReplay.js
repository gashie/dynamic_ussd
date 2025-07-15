// utils/sessionReplay.js
const replaySession = async (sessionId) => {
  const sql = `
    SELECT 
      created_at,
      menu_code,
      user_input,
      response_text,
      api_calls_made,
      processing_time_ms
    FROM ussd_audit_trail
    WHERE session_id = $1
    ORDER BY created_at
  `;
  
  const result = await query(sql, [sessionId]);
  
  console.log(`\n=== Session Replay: ${sessionId} ===\n`);
  
  result.rows.forEach((step, index) => {
    console.log(`Step ${index + 1} - ${step.created_at}`);
    console.log(`Menu: ${step.menu_code}`);
    console.log(`User Input: ${step.user_input || '(none)'}`);
    console.log(`Response: ${step.response_text.substring(0, 100)}...`);
    console.log(`Processing Time: ${step.processing_time_ms}ms`);
    
    if (step.api_calls_made && step.api_calls_made.length > 0) {
      console.log(`API Calls: ${JSON.stringify(step.api_calls_made)}`);
    }
    
    console.log('-'.repeat(50));
  });
};

// Visual flow generator
const generateFlowDiagram = async (sessionId) => {
  const sql = `
    SELECT menu_code, user_input
    FROM ussd_audit_trail
    WHERE session_id = $1
    ORDER BY created_at
  `;
  
  const result = await query(sql, [sessionId]);
  
  const flow = result.rows.map((step, index) => {
    const input = step.user_input ? `[${step.user_input}]` : '';
    return `${step.menu_code} ${input}`;
  }).join(' → ');
  
  return flow;
};