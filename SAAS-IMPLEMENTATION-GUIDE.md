# SaaS Implementation Guide
## Database Schema & API Structure for Business Intelligence Pro

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP
);
```

#### User Profiles Table
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    phone VARCHAR(20),
    website VARCHAR(255),
    address TEXT,
    tagline VARCHAR(255),
    services TEXT,
    brand_color VARCHAR(7) DEFAULT '#667eea',
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Subscriptions Table
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('starter', 'professional', 'agency')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Search History Table
```sql
CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location VARCHAR(255) NOT NULL,
    business_type VARCHAR(255) NOT NULL,
    radius INTEGER NOT NULL,
    max_results INTEGER NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Generated Reports Table
```sql
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    search_id UUID REFERENCES search_history(id) ON DELETE SET NULL,
    business_name VARCHAR(255) NOT NULL,
    business_data JSONB NOT NULL,
    report_type VARCHAR(50) DEFAULT 'business_analysis',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP
);
```

#### Usage Analytics Table
```sql
CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);
```

### API Endpoints Structure

#### Authentication Endpoints
```javascript
// POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securePassword",
  "full_name": "John Doe",
  "plan_type": "professional"
}

// POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securePassword"
}

// POST /api/auth/logout
// Headers: Authorization: Bearer <token>

// POST /api/auth/forgot-password
{
  "email": "user@example.com"
}
```

#### User Profile Endpoints
```javascript
// GET /api/profile
// Headers: Authorization: Bearer <token>
// Returns user profile data

// PUT /api/profile
// Headers: Authorization: Bearer <token>
{
  "business_name": "Your Business",
  "industry": "marketing-agency",
  "phone": "(555) 123-4567",
  "website": "https://yourbusiness.com",
  "address": "123 Main St, City, State 12345",
  "tagline": "Your professional tagline",
  "services": "Web Design, SEO, Marketing",
  "brand_color": "#667eea"
}

// POST /api/profile/logo
// Headers: Authorization: Bearer <token>
// Content-Type: multipart/form-data
// Body: logo file
```

#### Subscription Management
```javascript
// GET /api/subscription
// Headers: Authorization: Bearer <token>
// Returns current subscription details

// POST /api/subscription/create-checkout
// Headers: Authorization: Bearer <token>
{
  "plan_type": "professional",
  "success_url": "https://yourdomain.com/success",
  "cancel_url": "https://yourdomain.com/cancel"
}

// POST /api/subscription/cancel
// Headers: Authorization: Bearer <token>

// POST /api/webhooks/stripe
// Stripe webhook for subscription events
```

#### Business Search Endpoints
```javascript
// POST /api/search/businesses
// Headers: Authorization: Bearer <token>
{
  "location": "Austin, TX",
  "business_type": "restaurants",
  "radius": 10,
  "max_results": 20
}

// GET /api/search/history
// Headers: Authorization: Bearer <token>
// Returns paginated search history

// GET /api/search/history/:id
// Headers: Authorization: Bearer <token>
// Returns specific search results
```

#### Report Generation
```javascript
// POST /api/reports/generate
// Headers: Authorization: Bearer <token>
{
  "business_data": { /* business object */ },
  "report_type": "business_analysis"
}

// GET /api/reports
// Headers: Authorization: Bearer <token>
// Returns user's generated reports

// GET /api/reports/:id
// Headers: Authorization: Bearer <token>
// Returns specific report data

// DELETE /api/reports/:id
// Headers: Authorization: Bearer <token>
```

#### Analytics Endpoints
```javascript
// GET /api/analytics/dashboard
// Headers: Authorization: Bearer <token>
// Returns dashboard metrics

// GET /api/analytics/usage
// Headers: Authorization: Bearer <token>
// Returns usage statistics

// POST /api/analytics/track
// Headers: Authorization: Bearer <token>
{
  "action_type": "report_generated",
  "metadata": { /* additional data */ }
}
```

### Serverless Functions (Vercel)

#### Authentication Function
```javascript
// api/auth/login.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  
  try {
    // Validate credentials
    const user = await validateUser(email, password);
    
    // Generate JWT token
    const token = generateJWT(user);
    
    // Set secure cookie
    res.setHeader('Set-Cookie', [
      `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
    ]);
    
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
}
```

#### Business Search Function
```javascript
// api/search/businesses.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const user = await verifyToken(req);
    
    // Check subscription limits
    await checkUsageLimits(user.id, req.body.max_results);
    
    // Perform Google Places search
    const results = await searchPlaces(req.body);
    
    // Save search history
    await saveSearchHistory(user.id, req.body, results.length);
    
    // Track usage
    await trackUsage(user.id, 'business_search', req.body);
    
    res.status(200).json({ results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
```

#### Report Generation Function
```javascript
// api/reports/generate.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const user = await verifyToken(req);
    
    // Get user profile for branding
    const profile = await getUserProfile(user.id);
    
    // Generate report
    const report = await generateBusinessReport(req.body, profile);
    
    // Save report to database
    const savedReport = await saveReport(user.id, report);
    
    // Track usage
    await trackUsage(user.id, 'report_generated', {
      business_name: req.body.business_data.name,
      report_type: req.body.report_type
    });
    
    res.status(200).json({
      report_id: savedReport.id,
      report_url: `/reports/${savedReport.id}`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
```

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/business_intel
DATABASE_SSL=require

# Authentication
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=7d

# Google Places API
GOOGLE_PLACES_API_KEY=your-google-places-api-key

# Stripe (Payment Processing)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email Service (SendGrid/AWS SES)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com

# File Storage (AWS S3/Cloudinary)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-s3-bucket-name

# Application
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-nextauth-secret
APP_ENV=production
```

### Subscription Plans & Limits
```javascript
const PLAN_LIMITS = {
  starter: {
    monthly_searches: 100,
    reports_per_month: 50,
    price: 97,
    features: [
      'Basic business search',
      'Standard reports',
      'Email support',
      'Basic branding'
    ]
  },
  professional: {
    monthly_searches: 500,
    reports_per_month: 250,
    price: 197,
    features: [
      'Advanced business search',
      'Custom branded reports',
      'Priority support',
      'CRM integration',
      'Analytics dashboard'
    ]
  },
  agency: {
    monthly_searches: -1, // Unlimited
    reports_per_month: -1, // Unlimited
    price: 397,
    features: [
      'Unlimited searches',
      'White-label platform',
      'Dedicated account manager',
      'API access',
      'Team collaboration',
      'Custom integrations'
    ]
  }
};
```

### Security Considerations
1. **Input Validation**: Sanitize all user inputs
2. **Rate Limiting**: Implement per-user rate limits
3. **SQL Injection**: Use parameterized queries
4. **XSS Protection**: Sanitize HTML output
5. **CSRF Protection**: Implement CSRF tokens
6. **Secure Headers**: Set appropriate security headers
7. **Data Encryption**: Encrypt sensitive data at rest
8. **Audit Logging**: Log all significant actions

### Deployment Checklist
- [ ] Set up PostgreSQL database
- [ ] Configure Stripe for payments
- [ ] Set up Google Places API
- [ ] Configure email service
- [ ] Set up file storage
- [ ] Deploy to Vercel
- [ ] Set environment variables
- [ ] Configure custom domain
- [ ] Set up SSL certificates
- [ ] Configure monitoring & logging
- [ ] Test payment flows
- [ ] Test email notifications
- [ ] Set up analytics tracking

This architecture provides a solid foundation for scaling your business intelligence tool into a full SaaS platform with user authentication, payments, and personalized experiences.
