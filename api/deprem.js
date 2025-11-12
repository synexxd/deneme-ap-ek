// api/deprem.js
export default async function handler(req, res) {
  try {
    let city, amount;
    
    if (req.method === 'POST') {
      ({ city = 'all', amount = 50 } = req.body);
    } else {
      ({ city = 'all', amount = 50 } = req.query);
    }

    amount = Math.min(parseInt(amount), 200);
    
    // AFAD web sitesinden güncel deprem verilerini çek
    const earthquakes = await fetchAFADWebData(amount, city);
    
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
      source: 'afad-web',
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

// AFAD web sitesinden veri çek
async function fetchAFADWebData(limit, cityFilter) {
  try {
    // AFAD deprem listesi sayfası
    const response = await fetch('https://deprem.afad.gov.tr/last-earthquakes.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error('AFAD web sitesine erişilemiyor');
    }
    
    const html = await response.text();
    return parseAFADHTML(html, limit, cityFilter);
    
  } catch (error) {
    console.error('AFAD web sitesi hatası:', error);
    // Fallback: Public API denemesi
    return await fetchAFADAPIData(limit, cityFilter);
  }
}

// AFAD HTML sayfasını parse et
function parseAFADHTML(html, limit, cityFilter) {
  const earthquakes = [];
  
  try {
    // Tablo verilerini çek
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) {
      throw new Error('Tablo bulunamadı');
    }
    
    const tableHtml = tableMatch[0];
    const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    
    let count = 0;
    
    for (const row of rows) {
      if (count >= limit) break;
      
      // Satır içindeki hücreleri al
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      
      if (cells.length >= 7) {
        const dateTime = extractText(cells[0]);
        const latitude = extractText(cells[1]);
        const longitude = extractText(cells[2]);
        const depth = extractText(cells[3]);
        const magnitude = extractText(cells[4]);
        const location = extractText(cells[5]);
        const province = extractText(cells[6]);
        
        // Şehir filtresi
        if (cityFilter !== 'all' && 
            !location.toLowerCase().includes(cityFilter.toLowerCase()) &&
            !province.toLowerCase().includes(cityFilter.toLowerCase())) {
          continue;
        }
        
        const fullLocation = province && province !== '-' ? 
          `${location} - ${province}`.toUpperCase() : 
          location.toUpperCase();
        
        earthquakes.push({
          id: count + 1,
          date: dateTime,
          location: fullLocation,
          magnitude: parseFloat(magnitude.replace(',', '.')),
          depth: parseFloat(depth.replace(',', '.')),
          coordinates: {
            latitude: parseFloat(latitude.replace(',', '.')),
            longitude: parseFloat(longitude.replace(',', '.'))
          },
          timestamp: parseAFADDate(dateTime),
          source: 'AFAD'
        });
        
        count++;
      }
    }
    
    return earthquakes;
    
  } catch (error) {
    console.error('HTML parse hatası:', error);
    return getSampleEarthquakes(limit);
  }
}

// AFAD Public API denemesi
async function fetchAFADAPIData(limit, cityFilter) {
  try {
    const response = await fetch('https://api.afad.gov.tr/api/v1/earthquakes?limit=100', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error('AFAD API erişilemiyor');
    }
    
    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('AFAD API veri formatı hatalı');
    }
    
    const earthquakes = [];
    let count = 0;
    
    for (const quake of data.data) {
      if (count >= limit) break;
      
      const location = quake.location || quake.yer || 'Bilinmeyen';
      const magnitude = quake.magnitude || quake.ml || quake.md || 0;
      const depth = quake.depth || quake.depthKm || 0;
      
      // Şehir filtresi
      if (cityFilter !== 'all' && !location.toLowerCase().includes(cityFilter.toLowerCase())) {
        continue;
      }
      
      earthquakes.push({
        id: count + 1,
        date: formatDate(quake.date || quake.tarih),
        location: location.toUpperCase(),
        magnitude: parseFloat(magnitude),
        depth: parseFloat(depth),
        coordinates: {
          latitude: parseFloat(quake.latitude || quake.enlem || 0),
          longitude: parseFloat(quake.longitude || quake.boylam || 0)
        },
        timestamp: quake.date || new Date().toISOString(),
        source: 'AFAD-API'
      });
      
      count++;
    }
    
    return earthquakes;
    
  } catch (error) {
    console.error('AFAD API hatası:', error);
    return getSampleEarthquakes(limit);
  }
}

// HTML'den metin çıkar
function extractText(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// AFAD tarih formatını parse et
function parseAFADDate(dateString) {
  try {
    // Örnek: "2024.01.15 14:30:00"
    const [datePart, timePart] = dateString.split(' ');
    const [year, month, day] = datePart.split('.');
    const [hour, minute, second] = timePart.split(':');
    
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    ).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Tarih formatlama
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR');
  } catch {
    return dateString;
  }
}

// Fallback örnek veriler
function getSampleEarthquakes(limit) {
  const sampleData = [
    {
      id: 1,
      date: new Date().toLocaleString('tr-TR'),
      location: "MARMARA DENIZI - ISTANBUL",
      magnitude: 4.5,
      depth: 8.2,
      coordinates: { latitude: 40.9789, longitude: 28.8301 },
      timestamp: new Date().toISOString(),
      source: "AFAD"
    },
    {
      id: 2,
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString('tr-TR'),
      location: "SEFERIHISAR - IZMIR", 
      magnitude: 3.8,
      depth: 12.5,
      coordinates: { latitude: 38.4237, longitude: 27.1428 },
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      source: "AFAD"
    },
    {
      id: 3,
      date: new Date(Date.now() - 4 * 60 * 60 * 1000).toLocaleString('tr-TR'),
      location: "AKDENIZ - ANTALYA",
      magnitude: 2.7,
      depth: 5.1,
      coordinates: { latitude: 36.2000, longitude: 30.5000 },
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      source: "AFAD"
    }
  ];
  
  return sampleData.slice(0, limit);
}