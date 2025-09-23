// api/places/autocomplete.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { input } = req.query;
    
    if (!input || input.length < 2) {
      return res.status(400).json({ error: 'Input parameter required (minimum 2 characters)' });
    }
    
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google Places API key not configured');
    }
    
    // Use Google Places Autocomplete API
    const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=(cities)&components=country:us&key=${apiKey}`;
    
    const response = await fetch(autocompleteUrl);
    const data = await response.json();
    
    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        return res.status(200).json({
          success: true,
          predictions: []
        });
      }
      throw new Error(`Google Places API error: ${data.status}`);
    }
    
    // Process predictions to return clean city names
    const predictions = data.predictions.map(prediction => ({
      description: prediction.description,
      place_id: prediction.place_id,
      main_text: prediction.structured_formatting?.main_text || prediction.description,
      secondary_text: prediction.structured_formatting?.secondary_text || ''
    }));
    
    res.status(200).json({
      success: true,
      predictions: predictions.slice(0, 5) // Limit to 5 suggestions
    });
    
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ 
      error: error.message || 'Autocomplete failed',
      success: false 
    });
  }
}
