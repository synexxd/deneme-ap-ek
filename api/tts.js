// api/tts.js
export default async function handler(req, res) {
  try {
    let text, lang;

    if (req.method === 'POST') {
      let body;
      try {
        body = JSON.parse(req.body);
      } catch {
        body = req.body || {};
      }
      text = body.text;
      lang = body.lang || 'tr';
    } else {
      // GET isteğini de destekle ama POST'a yönlendir
      text = req.query.text;
      lang = req.query.lang || 'tr';
    }

    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'text parametresi gereklidir'
      });
    }

    if (text.length > 200) {
      return res.status(400).json({
        status: 'error',
        message: 'Metin çok uzun (max 200 karakter)'
      });
    }

    // Google TTS'den ses dosyasını al
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(ttsUrl);
    
    if (!response.ok) {
      throw new Error('Ses dosyası alınamadı');
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Video olarak döndür
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `inline; filename="tts_${Date.now()}.mp4"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Ses dönüştürülürken hata oluştu: ' + error.message
    });
  }
}