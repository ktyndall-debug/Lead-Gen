// api/search/businesses.js - FIXED VERSION
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { location, businessType, radius = 10, maxResults = 20 } = req.body;
    
    if (!location || !businessType) {
      return res.status(400).json({ error: 'Location and business type are required' });
    }
    
    // Search Google Places
    const businesses = await searchGooglePlaces(location, businessType, parseInt(radius), parseInt(maxResults));
    
    res.status(200).json({
      success: true,
      results: businesses,
      total_found: businesses.length,
      showing: businesses.length
    });
    
  } catch (error) {
    console.error('Business search error:', error);
    res.status(500).json({ 
      error: error.message || 'Search failed',
      success: false 
    });
  }
}

async function searchGooglePlaces(location, businessType, radius, maxResults) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Places API key not configured - check environment variables');
  }
  
  try {
    // First, geocode the location
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
    
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
      throw new Error(`Location "${location}" not found. Try "Wallace, NC" or "Charlotte, NC"`);
    }
    
    const { lat, lng } = geocodeData.results[0].geometry.location;
    
    // Search for businesses
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius * 1609}&keyword=${encodeURIComponent(businessType)}&key=${apiKey}`;
    
    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();
    
    if (placesData.status !== 'OK') {
      if (placesData.status === 'ZERO_RESULTS') {
        return []; 
      }
      throw new Error(`Google Places API error: ${placesData.status}`);
    }
    
    // Process results
    const businesses = placesData.results.slice(0, maxResults).map(place => {
      // Calculate opportunity score
      let score = 40;
      
      if (!place.website) score += 25;
      if (!place.formatted_phone_number) score += 15;
      if ((place.rating || 0) < 4.0) score += 15;
      if ((place.user_ratings_total || 0) < 10) score += 20;
      if (!place.photos || place.photos.length < 2) score += 10;
      
      score = Math.min(95, Math.max(25, score));
      const opportunity = score > 70 ? 'high' : score > 50 ? 'medium' : 'low';
      
      return {
        name: place.name || 'Unknown Business',
        type: (place.types?.[0] || 'establishment').replace(/_/g, ' '),
        address: place.vicinity || place.formatted_address || 'Address not available',
        phone: place.formatted_phone_number || place.international_phone_number || 'Phone not listed',
        website: place.website || null,
        rating: place.rating || 0,
        reviews: place.user_ratings_total || 0,
        score: score,
        opportunity: opportunity,
        place_id: place.place_id,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
      };
    });
    
    return businesses.sort((a, b) => b.score - a.score);
    
  } catch (error) {
    console.error('Google Places API Error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }
}
