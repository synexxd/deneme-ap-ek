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
    
    // Örnek deprem verileri
    const earthquakes = [
      {
        id: 1,
        location: "İstanbul - Silivri",
        magnitude: 4.5,
        depth: 8.2,
        date: "2024-01-15 14:30:00",
        coordinates: "40.9789, 28.8301"
      },
      {
        id: 2,
        location: "İzmir - Seferihisar",
        magnitude: 3.8,
        depth: 12.5,
        date: "2024-01-15 12:15:00",
        coordinates: "38.4237, 27.1428"
      },
      {
        id: 3,
        location: "Ankara - Çankaya",
        magnitude: 2.7,
        depth: 5.1,
        date: "2024-01-15 10:45:00",
        coordinates: "39.9334, 32.8597"
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