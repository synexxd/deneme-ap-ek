// api/anime.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { tag = 'waifu', amount = 1 } = req.body;

      // Waifu.pics API'den resimleri çek
      const images = [];
      
      for (let i = 0; i < amount; i++) {
        const response = await fetch(`https://api.waifu.pics/sfw/${tag}`);
        const data = await response.json();
        
        images.push({
          imageUrl: data.url,
          id: i + 1,
          tag: tag
        });
      }

      res.json({
        status: 'success',
        endpoint: '/anime',
        images: images
      });

    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Resimler alınırken hata oluştu'
      });
    }
  } else {
    res.status(405).json({
      status: 'error', 
      message: 'Sadece POST methodu kabul edilir'
    });
  }
}
