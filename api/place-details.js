// api/place-details.js - Vercel serverless function (CommonJS)
module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { placeId } = req.body;
        
        if (!placeId) {
            return res.status(400).json({ error: 'Place ID is required' });
        }
        
        // Your Google Places API key (should be in environment variables)
        const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
        
        if (!API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }
        
        // Get place details with specific fields
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,website,opening_hours,price_level,photos,url,rating,user_ratings_total,business_status&key=${API_KEY}`;
        
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status !== 'OK') {
            console.error('Place Details API error:', detailsData.status);
            return res.status(400).json({ error: `Place Details API error: ${detailsData.status}` });
        }
        
        return res.status(200).json({
            result: detailsData.result
        });
        
    } catch (error) {
        console.error('Place Details API Error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
