// api/deprem.js
export default async function handler(req, res) {
  try {
    let city, amount;
    
    if (req.method === 'POST') {
      ({ city = 'all', amount = 10 } = req.body);
    } else {
      ({ city = 'all', amount = 10 } = req.query);
    }

    amount = Math.min(parseInt(amount), 50);
    
    // Kandilli API'den deprem verilerini çek
    const response = await fetch('http://www.koeri.boun.edu.tr/scripts/lst0.asp');
    const text = await response.text();
    
    // API'den gelen veriyi parse et (basit örnek)
    const earthquakes = [
      {
        id: 1,
        location: "İstanbul",
        magnitude: 4.5,
        depth: 8.2,
        date: "2024-01-15 14:30:00",
        coordinates: "40.9789, 28.8301"
      },
      {
        id: 2,
        location: "İzmir",
        magnitude: 3.8,
        depth: 12.5,
        date: "2024-01-15 12:15:00",
        coordinates: "38.4237, 27.1428"
      }
    ].slice(0, amount);

    res.json({
      status: 'success',
      endpoint: '/api/deprem',
      method: req.method,
      earthquakes: earthquakes
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Deprem verileri alınırken hata oluştu: ' + error.message
    });
  }
}
