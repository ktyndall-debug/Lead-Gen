-- Business Intelligence Pro SaaS Database Schema
-- Run this entire script in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (core user data)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE
);

-- User profiles table (business customization)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Subscriptions table (billing and plan management)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('starter', 'professional', 'agency')),
    status VARCHAR(20) DEFAULT 'trialing' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'incomplete')),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Search history table (track user searches)
CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location VARCHAR(255) NOT NULL,
    business_type VARCHAR(255) NOT NULL,
    radius INTEGER NOT NULL,
    max_results INTEGER NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Generated reports table (track all reports created)
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    search_id UUID REFERENCES search_history(id) ON DELETE SET NULL,
    business_name VARCHAR(255) NOT NULL,
    business_data JSONB NOT NULL,
    report_type VARCHAR(50) DEFAULT 'business_analysis',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accessed_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE
);

-- Usage analytics table (track all user actions)
CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_timestamp ON search_history(search_timestamp);
CREATE INDEX idx_generated_reports_user_id ON generated_reports(user_id);
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_timestamp ON usage_analytics(timestamp);
CREATE INDEX idx_usage_analytics_action ON usage_analytics(action_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (you can remove this later)
INSERT INTO users (email, password_hash, full_name, email_verified) VALUES 
('test@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5wSRNQgj/YyOm', 'Test User', true);

-- Get the test user ID for profile creation
INSERT INTO user_profiles (user_id, business_name, industry, phone, website, tagline, services, brand_color) 
SELECT id, 'Test Marketing Agency', 'marketing-agency', '(555) 123-4567', 'https://testmarketing.com', 
       'Growing businesses through digital marketing', 'SEO, PPC, Social Media', '#667eea'
FROM users WHERE email = 'test@example.com';

-- Create test subscription
INSERT INTO subscriptions (user_id, plan_type, status, trial_end, current_period_start, current_period_end)
SELECT id, 'professional', 'trialing', 
       CURRENT_TIMESTAMP + INTERVAL '14 days',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP + INTERVAL '14 days'
FROM users WHERE email = 'test@example.com';

-- Create function to get user dashboard stats
CREATE OR REPLACE FUNCTION get_user_dashboard_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'searches_this_month', (
            SELECT COUNT(*) 
            FROM search_history 
            WHERE user_id = user_uuid 
            AND search_timestamp >= date_trunc('month', CURRENT_TIMESTAMP)
        ),
        'reports_generated', (
            SELECT COUNT(*) 
            FROM generated_reports 
            WHERE user_id = user_uuid
        ),
        'total_searches', (
            SELECT COUNT(*) 
            FROM search_history 
            WHERE user_id = user_uuid
        ),
        'plan_type', (
            SELECT plan_type 
            FROM subscriptions 
            WHERE user_id = user_uuid 
            AND status IN ('active', 'trialing')
            LIMIT 1
        ),
        'subscription_status', (
            SELECT status 
            FROM subscriptions 
            WHERE user_id = user_uuid 
            AND status IN ('active', 'trialing')
            LIMIT 1
        ),
        'trial_end', (
            SELECT trial_end 
            FROM subscriptions 
            WHERE user_id = user_uuid 
            AND status = 'trialing'
            LIMIT 1
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(user_uuid UUID, requested_searches INTEGER DEFAULT 1)
RETURNS JSON AS $$
DECLARE
    plan_limits JSON;
    current_usage INTEGER;
    subscription_record RECORD;
    result JSON;
BEGIN
    -- Get subscription info
    SELECT plan_type, status INTO subscription_record
    FROM subscriptions 
    WHERE user_id = user_uuid 
    AND status IN ('active', 'trialing')
    LIMIT 1;
    
    -- Define plan limits
    plan_limits := json_build_object(
        'starter', 100,
        'professional', 500,
        'agency', -1
    );
    
    -- Get current month usage
    SELECT COUNT(*) INTO current_usage
    FROM search_history 
    WHERE user_id = user_uuid 
    AND search_timestamp >= date_trunc('month', CURRENT_TIMESTAMP);
    
    -- Check limits
    IF subscription_record.plan_type = 'agency' THEN
        -- Unlimited for agency
        result := json_build_object(
            'allowed', true,
            'current_usage', current_usage,
            'limit', 'unlimited',
            'remaining', 'unlimited'
        );
    ELSE
        DECLARE
            monthly_limit INTEGER;
        BEGIN
            monthly_limit := (plan_limits ->> subscription_record.plan_type)::INTEGER;
            
            result := json_build_object(
                'allowed', (current_usage + requested_searches) <= monthly_limit,
                'current_usage', current_usage,
                'limit', monthly_limit,
                'remaining', monthly_limit - current_usage
            );
        END;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Database schema created successfully! 🎉' as message;
