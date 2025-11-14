// api/tts.js
export default async function handler(req, res) {
  try {
    let text, lang;

    // GET ve POST desteği
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

    // Metin uzunluğu kontrolü
    if (text.length > 200) {
      return res.status(400).json({
        status: 'error',
        message: 'Metin çok uzun (max 200 karakter)'
      });
    }

    // Google TTS URL'sini oluştur
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
    
    // HTML response döndür (video/audio elementi)
    const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <title>Ses Çıktısı - ${text}</title>
    <meta charset="UTF-8">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            background: white;
            color: #333;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            max-width: 500px;
            margin: 0 auto;
        }
        audio, video {
            width: 100%;
            margin: 20px 0;
            border-radius: 10px;
        }
        .text-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 Text-to-Speech</h1>
        
        <div class="text-info">
            <strong>Metin:</strong> "${text}"<br>
            <strong>Dil:</strong> ${lang}<br>
            <strong>Karakter:</strong> ${text.length}
        </div>

        <h3>Audio Player:</h3>
        <audio controls autoplay>
            <source src="${ttsUrl}" type="audio/mpeg">
            Tarayıcınız audio elementi desteklemiyor.
        </audio>

        <h3>Video Player (Audio):</h3>
        <video controls width="400">
            <source src="${ttsUrl}" type="audio/mpeg">
            Tarayıcınız video elementi desteklemiyor.
        </video>

        <div style="margin-top: 20px;">
            <a href="${ttsUrl}" download="speech_${Date.now()}.mp3">
                <button style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    📥 Ses Dosyasını İndir
                </button>
            </a>
        </div>

        <p style="margin-top: 20px; color: #666;">
            <small>Oluşturulma: ${new Date().toLocaleString('tr-TR')}</small>
        </p>
    </div>

    <script>
        // Otomatik oynat
        document.addEventListener('DOMContentLoaded', function() {
            const audio = document.querySelector('audio');
            if(audio) audio.play().catch(e => console.log('Otomatik oynatma engellendi'));
        });
    </script>
</body>
</html>
    `;

    // HTML response döndür
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlResponse);

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Ses dönüştürülürken hata oluştu: ' + error.message
    });
  }
}