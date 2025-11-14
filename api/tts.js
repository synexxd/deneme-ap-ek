// api/tts.js
export default async function handler(req, res) {
  try {
    let text, lang;

    if (req.method === 'GET') {
      text = req.query.text;
      lang = req.query.lang || 'tr';
    } else if (req.method === 'POST') {
      let body;
      try {
        body = JSON.parse(req.body);
      } catch {
        body = req.body || {};
      }
      text = body.text;
      lang = body.lang || 'tr';
    } else {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece GET ve POST methodu destekleniyor'
      });
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

    // Google TTS URL'sini oluştur
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
    
    res.json({
      status: 'success',
      endpoint: '/api/tts',
      method: req.method,
      input_text: text,
      language: lang,
      audio_url: ttsUrl,
      video_url: ttsUrl,
      character_count: text.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Ses dönüştürülürken hata oluştu: ' + error.message
    });
  }
}