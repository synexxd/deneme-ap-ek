// api/spotify.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS isteği için handling
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let query, type, market, limit;

    // GET isteği - query parametrelerinden al
    if (req.method === 'GET') {
      ({ 
        q: query = '', 
        type = 'track', 
        market = 'DE', 
        limit = 3 
      } = req.query);
    }
    
    // POST isteği - body'den al
    else if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      ({ 
        q: query = '', 
        type = 'track', 
        market = 'DE', 
        limit = 3 
      } = body);
    }
    
    else {
      return res.status(405).json({ 
        success: false,
        error: 'Method not allowed. Use GET or POST.' 
      });
    }

    // Query parametresi kontrolü
    if (!query.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Query parameter "q" is required',
        example: {
          GET: '/api/spotify?q=despacito&type=track&market=DE&limit=3',
          POST: '{ "q": "despacito", "type": "track", "market": "DE", "limit": 3 }'
        }
      });
    }

    // Spotify API endpoint
    const searchParams = new URLSearchParams({
      q: query.trim(),
      type,
      market,
      limit: Math.min(parseInt(limit), 50)
    });

    const url = `https://api.spotify.com/v1/search?${searchParams}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer c891e8bb6a9848e184506171e0d231da`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spotify API Error:', response.status, errorText);
      
      return res.status(response.status).json({ 
        success: false,
        error: `Spotify API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    
    // Basitleştirilmiş response
    const simplifiedResponse = {
      success: true,
      query: query,
      type: type,
      market: market,
      limit: parseInt(limit),
      results: data.tracks ? data.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(artist => ({
          id: artist.id,
          name: artist.name
        })),
        album: {
          id: track.album.id,
          name: track.album.name,
          images: track.album.images
        },
        preview_url: track.preview_url,
        external_urls: track.external_urls,
        duration_ms: track.duration_ms,
        popularity: track.popularity,
        uri: track.uri
      })) : []
    };

    return res.status(200).json(simplifiedResponse);

  } catch (error) {
    console.error('Internal server error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
}
