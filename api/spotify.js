// api/spotify.js

// BU TOKEN'I YENİSİYLE DEĞİŞTİRİN!
const SPOTIFY_TOKEN = "055e02a66e36400eb74b22553d32362f";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    let query, type, market, limit;

    if (req.method === 'GET') {
      query = req.query.q || '';
      type = req.query.type || 'track';
      market = req.query.market || 'DE';
      limit = req.query.limit || 3;
    } else {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      query = body.q || '';
      type = body.type || 'track';
      market = body.market || 'DE';
      limit = body.limit || 3;
    }

    if (!query.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const limitNumber = Math.min(parseInt(limit), 50);
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&market=${market}&limit=${limitNumber}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SPOTIFY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({
        success: false,
        error: `Spotify API error: ${response.status}`,
        message: error.error?.message
      });
    }

    const data = await response.json();
    
    res.status(200).json({
      success: true,
      query: query,
      results: data.tracks?.items || []
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}