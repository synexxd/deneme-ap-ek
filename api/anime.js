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
      
      // Waifu.pics URL'sinden ID'yi çıkar
      const imageUrl = data.url;
      let imageId = 'unknown';
      
      // URL'den ID'yi parse et
      if (imageUrl.includes('waifu.pics/')) {
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        imageId = filename.split('.')[0];
      }
      
      images.push({
        imageUrl: imageUrl,
        id: imageId,
        tag: tag
      });
    }

    res.json({
      status: 'success',
      endpoint: '/api/anime',
      method: req.method,
      parameters: {
        tag: tag,
        amount: amount
      },
      images: images
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Resimler alınırken hata oluştu: ' + error.message
    });
  }
}