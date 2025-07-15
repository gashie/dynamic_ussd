const crypto = require('crypto');
const { query } = require('../config/database');

// Use environment variable or generate a key (store this securely!)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32);

const ALGORITHM = 'aes-256-gcm';

const encryptField = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

const decryptField = (encrypted, iv, authTag) => {
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    ENCRYPTION_KEY, 
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

const storeEncryptedValue = async (sessionId, fieldName, value) => {
  const { encrypted, iv, authTag } = encryptField(value);
  
  const sql = `
    INSERT INTO encrypted_session_values 
    (session_id, field_name, encrypted_value, iv, auth_tag)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (session_id, field_name)
    DO UPDATE SET 
      encrypted_value = $3,
      iv = $4,
      auth_tag = $5,
      created_at = NOW()
  `;
  
  await query(sql, [sessionId, fieldName, encrypted, iv, authTag]);
  
  // Return masked value for display
  return '****';
};

const getEncryptedValue = async (sessionId, fieldName) => {
  const sql = `
    SELECT encrypted_value, iv, auth_tag
    FROM encrypted_session_values
    WHERE session_id = $1 AND field_name = $2
  `;
  
  const result = await query(sql, [sessionId, fieldName]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const { encrypted_value, iv, auth_tag } = result.rows[0];
  
  try {
    return decryptField(encrypted_value, iv, auth_tag);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Generate a secure encryption key (run this once and save the output)
const generateEncryptionKey = () => {
  const key = crypto.randomBytes(32);
  console.log('Add this to your .env file:');
  console.log(`ENCRYPTION_KEY=${key.toString('hex')}`);
  return key.toString('hex');
};

module.exports = { 
  encryptField, 
  decryptField, 
  storeEncryptedValue,
  getEncryptedValue,
  generateEncryptionKey
};