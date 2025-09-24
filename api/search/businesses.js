// api/search/businesses.js - CORRECTED VERSION
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { location, businessType, radius = 10, maxResults = 20 } = req.body;
    
    if (!location || !businessType) {
      return res.status(400).json({ error: 'Location and business type are required' });
    }
    
    const businesses = await searchGooglePlacesCorrect(location, businessType, parseInt(radius), parseInt(maxResults));
    
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

async function searchGooglePlacesCorrect(location, businessType, radius, maxResults) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Places API key not configured');
  }
  
  try {
    // Step 1: Text search for businesses
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(businessType + ' in ' + location)}&key=${apiKey}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (searchData.status !== 'OK') {
      if (searchData.status === 'ZERO_RESULTS') {
        return [];
      }
      throw new Error(`Search failed: ${searchData.status}`);
    }
    
    // Step 2: Get detailed info for each business
    const businesses = [];
    const places = searchData.results.slice(0, maxResults);
    
    for (const place of places) {
      try {
        const details = await getPlaceDetailsSimple(place.place_id, apiKey);
        businesses.push(details);
      } catch (error) {
        console.error(`Details failed for ${place.name}:`, error.message);
        // Use basic data as fallback
        businesses.push(createSimpleBusiness(place));
      }
    }
    
    return businesses.sort((a, b) => b.score - a.score);
    
  } catch (error) {
    throw error;
  }
}

async function getPlaceDetailsSimple(placeId, apiKey) {
  const fields = 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types,place_id';
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
  
  const response = await fetch(detailsUrl);
  const data = await response.json();
  
  if (data.status !== 'OK') {
    throw new Error(`Details API returned: ${data.status}`);
  }
  
  const place = data.result;
  
  // FIXED: Properly extract website
  let website = null;
  if (place.website) {
    website = place.website;
    // Only filter out if it's literally just a Google Maps link
    if (website.startsWith('https://maps.google.com') || website.startsWith('https://www.google.com/maps')) {
      website = null;
    }
  }
  
  // Calculate score based on missing elements
  let score = 40;
  if (!website) score += 25;
  if (!place.formatted_phone_number) score += 20;
  if (!place.rating || place.rating < 4) score += 10;
  if (!place.user_ratings_total || place.user_ratings_total < 15) score += 10;
  
  score = Math.min(90, Math.max(30, score + Math.floor(Math.random() * 15) - 7));
  
  return {
    name: place.name || 'Unknown Business',
    type: getSimpleBusinessType(place.types),
    address: place.formatted_address || 'Address not available',
    phone: place.formatted_phone_number || 'Phone not listed', 
    website: website,
    rating: place.rating || 0,
    reviews: place.user_ratings_total || 0,
    score: score,
    opportunity: score > 70 ? 'high' : score > 50 ? 'medium' : 'low',
    place_id: place.place_id,
    google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
  };
}

function getSimpleBusinessType(types) {
  if (!types || !types.length) return 'Business';
  
  const typeMap = {
    'restaurant': 'Restaurant',
    'food': 'Restaurant', 
    'car_repair': 'Auto Repair',
    'beauty_salon': 'Beauty Salon',
    'hair_care': 'Hair Salon',
    'dentist': 'Dental Practice',
    'doctor': 'Medical Practice',
    'lawyer': 'Law Firm'
  };
  
  for (const type of types) {
    if (typeMap[type]) return typeMap[type];
  }
  
  return types[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function createSimpleBusiness(place) {
  const score = Math.floor(Math.random() * 30) + 50;
  
  return {
    name: place.name || 'Unknown Business',
    type: getSimpleBusinessType(place.types),
    address: place.formatted_address || 'Address not available',
    phone: 'Phone not available',
    website: null,
    rating: place.rating || 0,
    reviews: place.user_ratings_total || 0, 
    score: score,
    opportunity: score > 70 ? 'high' : score > 50 ? 'medium' : 'low',
    place_id: place.place_id,
    google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
  };
}
