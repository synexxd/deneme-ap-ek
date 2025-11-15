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

  // Sadece GET ve POST isteklerine izin ver
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use GET or POST.' 
    });
  }

  try {
    let query, type, market, limit;

    // GET isteği - query parametrelerinden al
    if (req.method === 'GET') {
      query = req.query.q || '';
      type = req.query.type || 'track';
      market = req.query.market || 'DE';
      limit = req.query.limit || 3;
    }
    
    // POST isteği - body'den al
    else if (req.method === 'POST') {
      let body;
      
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON body'
        });
      }
      
      query = body.q || '';
      type = body.type || 'track';
      market = body.market || 'DE';
      limit = body.limit || 3;
    }

    // Query parametresi kontrolü
    if (!query || !query.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Query parameter "q" is required',
        example: {
          GET: '/api/spotify?q=despacito&type=track&market=DE&limit=3',
          POST: { q: "despacito", type: "track", market: "DE", limit: 3 }
        }
      });
    }

    // Limit değerini kontrol et
    const limitNumber = Math.min(parseInt(limit) || 3, 50);

    // Spotify API endpoint
    const searchParams = new URLSearchParams({
      q: query.trim(),
      type: type,
      market: market,
      limit: limitNumber.toString()
    });

    const url = `https://api.spotify.com/v1/search?${searchParams}`;

    console.log('Spotify API Calling:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer c891e8bb6a9848e184506171e0d231da`,
        'Content-Type': 'application/json'
      }
    });

    // Response'u kontrol et
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Spotify API Error:', response.status, errorData);
      
      return res.status(response.status).json({ 
        success: false,
        error: `Spotify API error: ${response.status} ${response.statusText}`,
        details: errorData
      });
    }

    const data = await response.json();
    
    // Başarılı response
    return res.status(200).json({
      success: true,
      query: query,
      type: type,
      market: market,
      limit: limitNumber,
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
    });

  } catch (error) {
    console.error('Internal server error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
}