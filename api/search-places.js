// api/search-places.js - Vercel serverless function (CommonJS)
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
        const { location, businessType, radius, maxResults } = req.body;
        
        const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
        
        if (!API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }
        
        // Geocode the location
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${API_KEY}`;
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();
        
        if (!geocodeData.results || geocodeData.results.length === 0) {
            return res.status(400).json({ error: 'Location not found' });
        }
        
        const { lat, lng } = geocodeData.results[0].geometry.location;
        
        // Convert miles to meters
        const radiusInMeters = radius * 1609.34;
        
        let allResults = [];
        
        // Strategy 1: Use the exact search term as keyword
        try {
            const keywordSearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusInMeters}&keyword=${encodeURIComponent(businessType)}&key=${API_KEY}`;
            
            const keywordResponse = await fetch(keywordSearchUrl);
            const keywordData = await keywordResponse.json();
            
            if (keywordData.status === 'OK' && keywordData.results) {
                allResults = allResults.concat(keywordData.results);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.warn('Keyword search failed:', error);
        }
        
        // Strategy 2: Text search (often more comprehensive)
        try {
            const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(businessType + ' near ' + location)}&radius=${radiusInMeters}&key=${API_KEY}`;
            
            const textResponse = await fetch(textSearchUrl);
            const textData = await textResponse.json();
            
            if (textData.status === 'OK' && textData.results) {
                allResults = allResults.concat(textData.results);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.warn('Text search failed:', error);
        }
        
        // Strategy 3: If it's a business name search, try that as well
        if (!businessType.toLowerCase().includes('restaurant') && 
            !businessType.toLowerCase().includes('shop') && 
            !businessType.toLowerCase().includes('service') &&
            businessType.split(' ').length <= 3) {
            
            try {
                const nameSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(businessType)}&location=${lat},${lng}&radius=${radiusInMeters}&key=${API_KEY}`;
                
                const nameResponse = await fetch(nameSearchUrl);
                const nameData = await nameResponse.json();
                
                if (nameData.status === 'OK' && nameData.results) {
                    allResults = allResults.concat(nameData.results);
                }
            } catch (error) {
                console.warn('Name search failed:', error);
            }
        }
        
        // Remove duplicates based on place_id
        const uniqueResults = allResults.filter((place, index, arr) => 
            arr.findIndex(p => p.place_id === place.place_id) === index
        );
        
        // Filter by actual radius and add distance calculation
        const filteredResults = uniqueResults.filter(place => {
            if (!place.geometry || !place.geometry.location) return false;
            
            const placeLat = place.geometry.location.lat;
            const placeLng = place.geometry.location.lng;
            
            // Calculate distance using Haversine formula
            const distance = calculateDistance(lat, lng, placeLat, placeLng);
            const distanceInMiles = distance * 0.621371;
            
            // Add distance to the place object for later use
            place.distance_miles = distanceInMiles.toFixed(1);
            
            return distanceInMiles <= radius;
        });
        
        // Sort by relevance (combination of rating and distance)
        filteredResults.sort((a, b) => {
            // Prefer businesses with ratings, then by rating quality, then by distance
            const aRating = a.rating || 0;
            const bRating = b.rating || 0;
            const aDistance = parseFloat(a.distance_miles) || 999;
            const bDistance = parseFloat(b.distance_miles) || 999;
            
            // Score: higher rating is better, closer distance is better
            const aScore = aRating * 2 - aDistance * 0.1;
            const bScore = bRating * 2 - bDistance * 0.1;
            
            return bScore - aScore;
        });
        
        // Limit to requested number of results
        const finalResults = filteredResults.slice(0, maxResults);
        
        return res.status(200).json({
            results: finalResults,
            location: { lat, lng },
            searchRadius: radius,
            radiusInMeters: radiusInMeters,
            total: finalResults.length,
            searchTerm: businessType,
            strategiesUsed: ['keyword', 'text', 'name'].filter(Boolean).length
        });
        
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in kilometers
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}
