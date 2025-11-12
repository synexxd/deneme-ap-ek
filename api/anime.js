// api/anime.js
export default async function handler(req, res) {
  try {
    let tag, amount;
    
    if (req.method === 'POST') {
      ({ tag = 'waifu', amount = 1 } = req.body);
    } else {
      ({ tag = 'waifu', amount = 1 } = req.query);
    }

    amount = Math.min(parseInt(amount), 10);
    const images = [];
    
    for (let i = 0; i < amount; i++) {
      const response = await fetch(`https://api.waifu.pics/sfw/${tag}`);
      const data = await response.json();
      
      images.push({
        imageUrl: data.url
      });
    }

    res.json({
      status: 'success',
      endpoint: '/api/anime',
      method: req.method,
      images: images
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Resimler alınırken hata oluştu: ' + error.message
    });
  }
}