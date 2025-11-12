// api/captcha.js - External CAPTCHA servisleri ile
const captchaStore = new Map();

export default async function handler(req, res) {
  try {
    const { action } = req.query;

    if (req.method === 'GET') {
      if (action === 'generate') {
        return generateCaptcha(req, res);
      } else if (action === 'verify') {
        return verifyCaptcha(req, res);
      } else {
        return generateCaptcha(req, res);
      }
    } else if (req.method === 'POST') {
      if (action === 'verify') {
        return verifyCaptcha(req, res);
      } else {
        return generateCaptcha(req, res);
      }
    } else {
      res.status(405).json({
        status: 'error',
        message: 'Method not allowed'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'CAPTCHA işlemi sırasında hata oluştu: ' + error.message
    });
  }
}

// CAPTCHA oluştur - External servislerle
async function generateCaptcha(req, res) {
  let text, width = 200, height = 80;

  if (req.method === 'GET') {
    ({ text, width = 200, height = 80 } = req.query);
  } else {
    ({ text, width = 200, height = 80 } = req.body);
  }

  const captchaText = text || generateRandomText(6);
  const captchaId = 'captcha_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  try {
    // 1. Önce Lorem Picsum deneyelim (çalışan bir image servisi)
    const imageUrl = await generateWithLoremPicsum(captchaText, width, height);
    
    captchaStore.set(captchaId, {
      text: captchaText,
      createdAt: Date.now(),
      imageUrl: imageUrl
    });

    // 10 dakika sonra temizle
    setTimeout(() => {
      captchaStore.delete(captchaId);
    }, 10 * 60 * 1000);

    res.json({
      status: 'success',
      endpoint: '/api/captcha',
      method: req.method,
      captchaId: captchaId,
      imageUrl: imageUrl,
      text: captchaText,
      expiresIn: '10 minutes',
      source: 'lorem-picsum'
    });

  } catch (error) {
    // 2. Fallback: DummyImage servisi
    try {
      const fallbackImage = await generateWithDummyImage(captchaText, width, height);
      
      captchaStore.set(captchaId, {
        text: captchaText,
        createdAt: Date.now(),
        imageUrl: fallbackImage
      });

      res.json({
        status: 'success',
        endpoint: '/api/captcha',
        method: req.method,
        captchaId: captchaId,
        imageUrl: fallbackImage,
        text: captchaText,
        expiresIn: '10 minutes',
        source: 'dummyimage'
      });

    } catch (fallbackError) {
      // 3. Son çare: Base64 SVG
      const svgImage = generateSVGCaptcha(captchaText, width, height);
      
      captchaStore.set(captchaId, {
        text: captchaText,
        createdAt: Date.now(),
        imageUrl: svgImage
      });

      res.json({
        status: 'success',
        endpoint: '/api/captcha',
        method: req.method,
        captchaId: captchaId,
        imageUrl: svgImage,
        text: captchaText,
        expiresIn: '10 minutes',
        source: 'svg'
      });
    }
  }
}

// Lorem Picsum ile CAPTCHA oluştur
async function generateWithLoremPicsum(text, width, height) {
  // Lorem Picsum rastgele resim + text overlay için
  const imageId = Math.floor(Math.random() * 1000);
  return `https://picsum.photos/${width}/${height}?random=${imageId}&text=${encodeURIComponent(text)}`;
}

// DummyImage servisi ile CAPTCHA oluştur
async function generateWithDummyImage(text, width, height) {
  // DummyImage.com - güvenilir bir placeholder servisi
  const bgColor = 'f0f0f0';
  const textColor = '2c3e50';
  return `https://dummyimage.com/${width}x${height}/${bgColor}/${textColor}&text=${encodeURIComponent(text)}`;
}

// SVG ile CAPTCHA oluştur (her zaman çalışır)
function generateSVGCaptcha(text, width, height) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8f9fa"/>
          <stop offset="100%" stop-color="#e9ecef"/>
        </linearGradient>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
        </filter>
      </defs>
      
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" filter="url(#noise)" opacity="0.1"/>
      
      <!-- Gürültü çizgileri -->
      ${Array.from({length: 6}, (_, i) => {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = x1 + (Math.random() * 60 - 30);
        const y2 = y1 + (Math.random() * 60 - 30);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                     stroke="rgba(0,0,0,0.15)" stroke-width="1"/>`;
      }).join('')}
      
      <!-- CAPTCHA metni -->
      <text x="50%" y="55%" 
            text-anchor="middle" 
            font-family="Arial, sans-serif" 
            font-size="24" 
            font-weight="bold" 
            fill="#2c3e50"
            style="letter-spacing: 2px;">
        ${text}
      </text>
      
      <!-- Ek gürültü noktaları -->
      ${Array.from({length: 25}, (_, i) => {
        const cx = Math.random() * width;
        const cy = Math.random() * height;
        const r = Math.random() * 1.5;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0,0,0,0.1)"/>`;
      }).join('')}
    </svg>
  `;

  // SVG'yi base64'e çevir
  const base64SVG = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64SVG}`;
}

// CAPTCHA doğrula
async function verifyCaptcha(req, res) {
  let captchaId, answer;

  if (req.method === 'GET') {
    ({ captchaId, answer } = req.query);
  } else {
    ({ captchaId, answer } = req.body);
  }

  if (!captchaId || !answer) {
    return res.status(400).json({
      status: 'error',
      message: 'captchaId ve answer parametreleri gereklidir'
    });
  }

  const captcha = captchaStore.get(captchaId);

  if (!captcha) {
    return res.status(404).json({
      status: 'error',
      message: 'CAPTCHA bulunamadı veya süresi dolmuş'
    });
  }

  const isCorrect = captcha.text.toLowerCase() === answer.toString().toLowerCase().trim();

  const response = {
    status: isCorrect ? 'success' : 'error',
    message: isCorrect ? 'CAPTCHA doğrulandı' : 'CAPTCHA yanlış',
    verified: isCorrect,
    method: req.method
  };

  if (isCorrect) {
    captchaStore.delete(captchaId);
  }

  res.json(response);
}

// Rastgele metin oluştur
function generateRandomText(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}