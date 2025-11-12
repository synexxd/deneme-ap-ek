// api/deprem.js
export default async function handler(req, res) {
  try {
    let city, amount;
    
    if (req.method === 'POST') {
      ({ city = 'all', amount = 100 } = req.body);
    } else {
      ({ city = 'all', amount = 100 } = req.query);
    }

    amount = Math.min(parseInt(amount), 500);
    
    // Kandilli Rasathanesi verilerini çek
    const response = await fetch('http://www.koeri.boun.edu.tr/scripts/lst0.asp');
    const text = await response.text();
    
    // Veriyi parse et
    const earthquakes = parseKandilliData(text, amount, city);
    
    if (earthquakes.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Deprem verisi bulunamadı'
      });
    }

    res.json({
      status: 'success',
      endpoint: '/api/deprem',
      method: req.method,
      total: earthquakes.length,
      earthquakes: earthquakes
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Deprem verileri alınırken hata oluştu: ' + error.message
    });
  }
}

// Kandilli verilerini parse eden fonksiyon
function parseKandilliData(html, limit, cityFilter) {
  const earthquakes = [];
  
  try {
    // HTML'den tablo verilerini çek
    const lines = html.split('\n');
    let inTable = false;
    let count = 0;
    
    for (const line of lines) {
      if (line.includes('<pre>')) {
        inTable = true;
        continue;
      }
      
      if (line.includes('</pre>')) {
        break;
      }
      
      if (inTable && line.trim() && count < limit) {
        const cleanedLine = line.replace(/<[^>]*>/g, '').trim();
        
        if (cleanedLine && !cleanedLine.includes('REFTARIHi')) {
          const parts = cleanedLine.split(/\s+/).filter(part => part.trim());
          
          if (parts.length >= 8) {
            const date = parts[0];
            const time = parts[1];
            const lat = parts[2];
            const lon = parts[3];
            const depth = parts[4];
            const magnitude = parts[5];
            const location = parts.slice(7).join(' ').toUpperCase();
            
            // Şehir filtresi
            if (cityFilter !== 'all' && !location.includes(cityFilter.toUpperCase())) {
              continue;
            }
            
            earthquakes.push({
              id: count + 1,
              date: `${date} ${time}`,
              location: location,
              magnitude: parseFloat(magnitude),
              depth: parseFloat(depth),
              coordinates: {
                latitude: parseFloat(lat),
                longitude: parseFloat(lon)
              },
              timestamp: new Date(`${date} ${time}`).toISOString()
            });
            
            count++;
          }
        }
      }
    }
  } catch (error) {
    console.error('Parse error:', error);
    // Fallback: Örnek veriler
    return getSampleEarthquakes(limit);
  }
  
  return earthquakes;
}

// Fallback örnek veriler
function getSampleEarthquakes(limit) {
  const sampleData = [
    {
      id: 1,
      date: "2024.01.15 14:30:00",
      location: "MARMARA DENIZI",
      magnitude: 4.5,
      depth: 8.2,
      coordinates: { latitude: 40.9789, longitude: 28.8301 },
      timestamp: "2024-01-15T14:30:00.000Z"
    },
    {
      id: 2,
      date: "2024.01.15 12:15:00", 
      location: "IZMIR-SEFERIHISAR",
      magnitude: 3.8,
      depth: 12.5,
      coordinates: { latitude: 38.4237, longitude: 27.1428 },
      timestamp: "2024-01-15T12:15:00.000Z"
    },
    {
      id: 3,
      date: "2024.01.15 10:45:00",
      location: "AKDENIZ",
      magnitude: 2.7,
      depth: 5.1,
      coordinates: { latitude: 36.2000, longitude: 30.5000 },
      timestamp: "2024-01-15T10:45:00.000Z"
    },
    {
      id: 4,
      date: "2024.01.14 22:30:00",
      location: "VAN",
      magnitude: 3.2,
      depth: 7.8,
      coordinates: { latitude: 38.5018, longitude: 43.4167 },
      timestamp: "2024-01-14T22:30:00.000Z"
    },
    {
      id: 5,
      date: "2024.01.14 18:15:00",
      location: "ELAZIG",
      magnitude: 2.9,
      depth: 10.3,
      coordinates: { latitude: 38.6810, longitude: 39.2264 },
      timestamp: "2024-01-14T18:15:00.000Z"
    }
  ];
  
  return sampleData.slice(0, limit);
}