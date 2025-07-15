const { query } = require('../config/database');

const checkUserBlocked = async (phoneNumber) => {
  const sql = `
    SELECT * FROM blocked_users
    WHERE phone_number = $1
    AND is_active = true
    AND (unblock_at IS NULL OR unblock_at > NOW())
  `;
  
  const result = await query(sql, [phoneNumber]);
  
  if (result.rows.length > 0) {
    const block = result.rows[0];
    return {
      isBlocked: true,
      reason: block.reason,
      unblockAt: block.unblock_at
    };
  }
  
  return { isBlocked: false };
};

const blockUser = async (phoneNumber, reason, durationMinutes = null, blockedBy = 'SYSTEM') => {
  const unblockAt = durationMinutes 
    ? new Date(Date.now() + durationMinutes * 60000) 
    : null;
  
  const sql = `
    INSERT INTO blocked_users (phone_number, reason, blocked_by, unblock_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (phone_number)
    DO UPDATE SET 
      reason = $2,
      blocked_by = $3,
      blocked_at = NOW(),
      unblock_at = $4,
      is_active = true
  `;
  
  await query(sql, [phoneNumber, reason, blockedBy, unblockAt]);
};

const trackFailedAttempt = async (phoneNumber, attemptType, menuCode, sessionId) => {
  // Log the failed attempt
  const sql = `
    INSERT INTO failed_attempts (phone_number, attempt_type, menu_code, session_id)
    VALUES ($1, $2, $3, $4)
  `;
  
  await query(sql, [phoneNumber, attemptType, menuCode, sessionId]);
  
  // Check if user should be blocked based on rules
  await checkBlockingRules(phoneNumber);
};

const checkBlockingRules = async (phoneNumber) => {
  // Check failed PIN attempts in last 5 minutes
  const recentAttempts = await query(`
    SELECT COUNT(*) as count
    FROM failed_attempts
    WHERE phone_number = $1
    AND attempt_type = 'wrong_pin'
    AND created_at > NOW() - INTERVAL '5 minutes'
  `, [phoneNumber]);
  
  if (recentAttempts.rows[0].count >= 3) {
    await blockUser(
      phoneNumber, 
      'Too many failed PIN attempts', 
      30, // 30 minutes
      'AUTOMATIC_RULE'
    );
  }
  
  // Check total failed attempts in last hour
  const hourlyAttempts = await query(`
    SELECT COUNT(*) as count
    FROM failed_attempts
    WHERE phone_number = $1
    AND created_at > NOW() - INTERVAL '1 hour'
  `, [phoneNumber]);
  
  if (hourlyAttempts.rows[0].count >= 10) {
    await blockUser(
      phoneNumber, 
      'Suspicious activity detected', 
      60, // 60 minutes
      'AUTOMATIC_RULE'
    );
  }
};

const unblockUser = async (phoneNumber) => {
  const sql = `
    UPDATE blocked_users 
    SET is_active = false 
    WHERE phone_number = $1
  `;
  
  await query(sql, [phoneNumber]);
};

module.exports = { 
  checkUserBlocked, 
  blockUser, 
  trackFailedAttempt,
  unblockUser,
  checkBlockingRules
};