// api/test-db.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  try {
    // Test basic connection
    const result = await pool.query('SELECT NOW() as current_time, COUNT(*) as user_count FROM users');
    
    // Test our helper function
    const statsTest = await pool.query('SELECT get_user_dashboard_stats($1) as stats', ['00000000-0000-0000-0000-000000000000']);
    
    res.status(200).json({
      success: true,
      database_time: result.rows[0].current_time,
      total_users: result.rows[0].user_count,
      message: 'Database connection successful! 🎉',
      tables_created: [
        'users',
        'user_profiles', 
        'subscriptions',
        'search_history',
        'generated_reports',
        'usage_analytics'
      ]
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: 'Check your DATABASE_URL environment variable'
    });
  }
}
