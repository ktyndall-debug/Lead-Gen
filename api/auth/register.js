// api/auth/register.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, full_name, company, plan_type = 'starter' } = req.body;

  // Validation
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await client.query(`
      INSERT INTO users (email, password_hash, full_name, email_verified)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, full_name, created_at
    `, [email.toLowerCase(), passwordHash, full_name, false]);

    const user = userResult.rows[0];

    // Create initial profile
    await client.query(`
      INSERT INTO user_profiles (user_id, business_name, industry)
      VALUES ($1, $2, $3)
    `, [user.id, company || full_name, 'other']);

    // Create trial subscription
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14); // 14-day free trial

    await client.query(`
      INSERT INTO subscriptions (user_id, plan_type, status, trial_end, current_period_start, current_period_end)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [user.id, plan_type, 'trialing', trialEnd, new Date(), trialEnd]);

    // Track registration
    await client.query(`
      INSERT INTO usage_analytics (user_id, action_type, metadata, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      user.id, 
      'user_registered', 
      JSON.stringify({ plan_type, company }), 
      req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      req.headers['user-agent']
    ]);

    await client.query('COMMIT');

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        plan: plan_type
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set secure cookie
    res.setHeader('Set-Cookie', [
      `auth-token=${token}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Strict; Max-Age=604800; Path=/`
    ]);

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        plan_type: plan_type,
        trial_end: trialEnd,
        created_at: user.created_at
      },
      message: 'Account created successfully! You have a 14-day free trial.'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  } finally {
    client.release();
  }
}
