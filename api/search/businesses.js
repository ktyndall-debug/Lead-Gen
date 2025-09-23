// api/search/businesses.js
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Verify JWT token
function verifyToken(req) {
  const token = req.cookies['auth-token'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Check user's usage limits
async function checkUsageLimits(userId, requestedSearches) {
  const client = await pool.connect();
  
  try {
    // Get user's subscription
    const subResult = await client.query(
      'SELECT plan_type, status FROM subscriptions WHERE user_id = $1 AND status IN ($2, $3)',
      [userId, 'active', 'trialing']
    );
    
    if (subResult.rows.length === 0) {
      throw new Error('No active subscription found');
    }
    
    const { plan_type } = subResult.rows[0];
    
    // Define plan limits
    const limits = {
      starter: 100,
      professional: 500,
      agency: -1 // unlimited
    };
    
    if (plan_type === 'agency') {
      return; // unlimited
    }
    
    // Check current month usage
    const usageResult = await client.query(
      `SELECT COUNT(*) as count FROM search_history 
       WHERE user_id = $1 AND search_timestamp >= date_trunc('month', CURRENT_TIMESTAMP)`,
      [userId]
    );
    
    const currentUsage = parseInt(usageResult.rows[0].count);
    const monthlyLimit = limits[plan_type] || 100;
    
    if (currentUsage + requestedSearches > monthlyLimit) {
      throw new Error(`Monthly search limit exceeded. Used: ${currentUsage}/${monthlyLimit}`);
    }
    
  } finally {
    client.release();
  }
}

// Google Places API search
async function searchGooglePlaces(location, businessType, radius) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Places API key not configured');
  }
  
  // First, geocode the location to get coordinates
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
  
  const geocodeResponse = await fetch(geocodeUrl);
  const geocodeData = await geocodeResponse.json();
  
  if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
    throw new Error(`Location not found: ${location}`);
  }
  
  const { lat, lng } = geocodeData.results[0].geometry.location;
  
  // Search for businesses using Places API
  const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius * 1609}&type=establishment&keyword=${encodeURIComponent(businessType)}&key=${apiKey}`;
  
  const placesResponse = await fetch(placesUrl);
  const placesData = await placesResponse.json();
  
  if (placesData.status !== 'OK') {
    throw new Error(`Places API error: ${placesData.status}`);
  }
  
  // Process results and analyze for opportunities
  const businesses = placesData.results.map(place => {
    const hasWebsite = place.website ? true : false;
    const rating = place.rating || 0;
    const reviewCount = place.user_ratings_total || 0;
    
    // Calculate opportunity score based on missing digital presence
    let score = 50; // base score
    
    if (!hasWebsite) score += 30; // big opportunity if no website
    if (rating < 4.0) score += 15; // opportunity to improve reputation
    if (reviewCount < 10) score += 20; // needs more reviews
    if (!place.photos || place.photos.length < 3) score += 10; // needs better photos
    
    score = Math.min(100, Math.max(20, score)); // cap between 20-100
    
    const opportunity = score > 70 ? 'high' : score > 50 ? 'medium' : 'low';
    
    return {
      name: place.name,
      type: place.types?.[0]?.replace(/_/g, ' ') || 'business',
      address: place.vicinity || place.formatted_address || 'Address not available',
      phone: place.formatted_phone_number || 'Phone not available',
      website: place.website || null,
      rating: rating,
      reviews: reviewCount,
      score: score,
      opportunity: opportunity,
      place_id: place.place_id,
      google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
    };
  });
  
  return businesses.sort((a, b) => b.score - a.score);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Verify authentication
    const user = verifyToken(req);
    
    const { location, businessType, radius = 10, maxResults = 20 } = req.body;
    
    if (!location || !businessType) {
      return res.status(400).json({ error: 'Location and business type are required' });
    }
    
    // Check usage limits
    await checkUsageLimits(user.userId, 1);
    
    // Search Google Places
    const businesses = await searchGooglePlaces(location, businessType, parseInt(radius));
    
    // Limit results
    const limitedResults = businesses.slice(0, parseInt(maxResults));
    
    // Save search history
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO search_history (user_id, location, business_type, radius, max_results, results_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.userId, location, businessType, parseInt(radius), parseInt(maxResults), limitedResults.length]
      );
      
      // Track usage analytics
      await client.query(
        `INSERT INTO usage_analytics (user_id, action_type, metadata)
         VALUES ($1, $2, $3)`,
        [user.userId, 'business_search', JSON.stringify({ location, businessType, radius, results: limitedResults.length })]
      );
    } finally {
      client.release();
    }
    
    res.status(200).json({
      success: true,
      results: limitedResults,
      total_found: businesses.length,
      showing: limitedResults.length
    });
    
  } catch (error) {
    console.error('Business search error:', error);
    res.status(500).json({ 
      error: error.message || 'Search failed',
      success: false 
    });
  }
}
