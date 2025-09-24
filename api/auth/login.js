// api/auth/login.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Handle test user login (for development)
    if (email === 'test@example.com' && password === 'password123') {
      const token = jwt.sign(
        { 
          userId: 1, 
          email: 'test@example.com',
          plan: 'professional'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Set secure cookie
      res.setHeader('Set-Cookie', [
        `auth-token=${token}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Lax; Max-Age=604800; Path=/`
      ]);

      return res.status(200).json({
        success: true,
        user: {
          id: 1,
          email: 'test@example.com',
          full_name: 'Test User',
          business_name: 'Test Business',
          plan_type: 'professional'
        },
        token: token // Also return token for client-side storage
      });
    }

    // Real user authentication
    const userQuery = `
      SELECT u.*, up.business_name, s.plan_type 
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('active', 'trialing')
      WHERE u.email = $1 AND u.is_active = true
      ORDER BY s.created_at DESC
      LIMIT 1
    `;
    
    const userResult = await pool.query(userQuery, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        plan: user.plan_type || 'starter'
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set secure cookie
    res.setHeader('Set-Cookie', [
      `auth-token=${token}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Lax; Max-Age=604800; Path=/`
    ]);

    // Return user data and token
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        business_name: user.business_name || user.full_name,
        plan_type: user.plan_type || 'starter',
        email_verified: user.email_verified
      },
      token: token // Include token for client-side storage
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
};