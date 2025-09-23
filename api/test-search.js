// api/test-search.js
export default async function handler(req, res) {
  try {
    // Test 1: Check if API key exists
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'GOOGLE_PLACES_API_KEY environment variable not set',
        test: 'env_check'
      });
    }

    // Test 2: Try a simple geocode request
    const testLocation = "Charlotte, NC";
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(testLocation)}&key=${apiKey}`;
    
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status !== 'OK') {
      return res.status(500).json({
        error: `Google API returned: ${geocodeData.status}`,
        details: geocodeData.error_message || 'No details',
        test: 'geocode_test'
      });
    }

    // Test 3: Try a places search
    const { lat, lng } = geocodeData.results[0].geometry.location;
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1609&keyword=restaurant&key=${apiKey}`;
    
    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();
    
    return res.status(200).json({
      success: true,
      geocode_status: geocodeData.status,
      places_status: placesData.status,
      found_businesses: placesData.results ? placesData.results.length : 0,
      test: 'full_test_passed'
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      test: 'catch_block'
    });
  }
}
