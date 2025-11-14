// api/tts.js
export default async function handler(req, res) {
  try {
    let { text, lang = 'tr' } = req.body;

    if (req.method !== 'POST') {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece POST methodu destekleniyor'
      });
    }

    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'text parametresi gereklidir'
      });
    }

    // Metin uzunluğu kontrolü
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
      method: 'POST',
      input_text: text,
      language: lang,
      audio_url: ttsUrl,
      character_count: text.length,
      timestamp: new Date().toISOString(),
      note: "Ses dosyasını oynatmak için audio_url'yi kullanın"
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Ses dönüştürülürken hata oluştu: ' + error.message
    });
  }
}
