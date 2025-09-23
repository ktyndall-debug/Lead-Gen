# Business Intelligence Pro - SaaS Platform

A comprehensive SaaS platform for business intelligence and prospect discovery, designed for agencies and marketing professionals.

## 🚀 Quick Setup

### 1. Database Setup (Supabase)
1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the SQL script in `database-schema.sql` in your Supabase SQL Editor
4. Copy your connection string from Supabase

### 2. Deploy to Vercel
1. Connect this repository to Vercel
2. Add these environment variables in Vercel:
   ```
   DATABASE_URL=your-supabase-connection-string
   JWT_SECRET=your-super-long-random-secret-key
   GOOGLE_PLACES_API_KEY=your-google-places-api-key
   ```
3. Deploy!

### 3. Test Your Installation
- Visit: `https://your-app.vercel.app/api/test-db` to test database connection
- Visit: `https://your-app.vercel.app/index-saas.html` for the main SaaS landing page

## 📁 File Structure

```
├── api/
│   ├── auth/
│   │   ├── login.js          # User authentication
│   │   └── register.js       # User registration
│   └── test-db.js            # Database connection test
├── dashboard.html            # User dashboard
├── index-saas.html          # SaaS landing page
├── onboarding.html          # User profile setup
├── report.html              # Customized business reports
├── tool.html                # Original business intelligence tool
├── package.json             # Dependencies
├── vercel.json              # Vercel configuration
├── database-schema.sql      # Complete database setup
└── SAAS-IMPLEMENTATION-GUIDE.md  # Detailed implementation guide
```

## 💰 Subscription Plans

- **Starter ($97/mo):** 100 searches, basic features
- **Professional ($197/mo):** 500 searches, custom branding, CRM integration
- **Agency ($397/mo):** Unlimited searches, white-label, API access

## 🔧 Features

- ✅ Multi-tenant user authentication
- ✅ Subscription management
- ✅ Custom branded reports
- ✅ Business prospect discovery
- ✅ Usage analytics and limits
- ✅ Professional client proposals
- ✅ White-label capabilities

## 📞 Support

For implementation questions, refer to `SAAS-IMPLEMENTATION-GUIDE.md`

## 🎯 Next Steps

1. Set up your database with the provided schema
2. Configure environment variables in Vercel
3. Test the authentication system
4. Add Stripe integration for payments
5. Launch and start acquiring customers!

---

**Transform your business intelligence tool into a profitable SaaS platform!**
