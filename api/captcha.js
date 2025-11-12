// api/captcha.js - Canvas olmadan HTML ile CAPTCHA
import nodeHtmlToImage from 'node-html-to-image';

// CAPTCHA storage
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
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz action. generate veya verify kullanın.'
        });
      }
    } else if (req.method === 'POST') {
      if (action === 'generate') {
        return generateCaptcha(req, res);
      } else if (action === 'verify') {
        return verifyCaptcha(req, res);
      } else {
        // POST'ta action yoksa generate kabul et
        return generateCaptcha(req, res);
      }
    } else {
      res.status(405).json({
        status: 'error',
        message: 'Method not allowed. Sadece GET ve POST kabul edilir.'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'CAPTCHA işlemi sırasında hata oluştu: ' + error.message
    });
  }
}

// CAPTCHA oluştur (GET ve POST)
async function generateCaptcha(req, res) {
  let text, width, height;

  if (req.method === 'GET') {
    // GET parametreleri
    ({ text, width = 200, height = 80 } = req.query);
  } else {
    // POST body
    ({ text, width = 200, height = 80 } = req.body);
  }

  // Rastgele CAPTCHA metni oluştur
  const captchaText = text || generateRandomText(6);
  const captchaId = 'captcha_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  try {
    // HTML ile CAPTCHA resmi oluştur
    const imageBuffer = await generateCaptchaImage(captchaText, parseInt(width), parseInt(height));
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;

    // Store CAPTCHA
    captchaStore.set(captchaId, {
      text: captchaText,
      createdAt: Date.now(),
      verified: false
    });

    // 10 dakika sonra temizle
    setTimeout(() => {
      captchaStore.delete(captchaId);
    }, 10 * 60 * 1000);

    const response = {
      status: 'success',
      endpoint: '/api/captcha',
      method: req.method,
      captchaId: captchaId,
      imageUrl: imageUrl,
      text: captchaText,
      expiresIn: '10 minutes'
    };

    res.json(response);

  } catch (error) {
    // Fallback: Base64 placeholder image
    const fallbackImage = await generateFallbackCaptcha(captchaText);
    
    captchaStore.set(captchaId, {
      text: captchaText,
      createdAt: Date.now(),
      verified: false
    });

    const response = {
      status: 'success',
      endpoint: '/api/captcha',
      method: req.method,
      captchaId: captchaId,
      imageUrl: fallbackImage,
      text: captchaText,
      expiresIn: '10 minutes',
      note: 'Fallback image used'
    };

    res.json(response);
  }
}

// HTML ile CAPTCHA resmi oluştur
async function generateCaptchaImage(text, width, height) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                margin: 0;
                padding: 0;
                width: ${width}px;
                height: ${height}px;
                background: linear-gradient(45deg, #f0f0f0, #e0e0e0);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
                position: relative;
                overflow: hidden;
            }
            .captcha-text {
                font-size: 28px;
                font-weight: bold;
                color: #2c3e50;
                letter-spacing: 2px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
                transform: skew(-5deg) rotate(-2deg);
                background: rgba(255,255,255,0.3);
                padding: 10px 15px;
                border-radius: 8px;
            }
            .noise {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }
            .noise-line {
                position: absolute;
                background: rgba(0,0,0,0.1);
                transform-origin: center;
            }
            .noise-dot {
                position: absolute;
                background: rgba(0,0,0,0.05);
                border-radius: 50%;
            }
        </style>
    </head>
    <body>
        <div class="noise" id="noise"></div>
        <div class="captcha-text">${text}</div>
        <script>
            // Gürültü çizgileri ekle
            const noise = document.getElementById('noise');
            for (let i = 0; i < 8; i++) {
                const line = document.createElement('div');
                line.className = 'noise-line';
                line.style.width = Math.random() * 100 + 50 + 'px';
                line.style.height = '1px';
                line.style.top = Math.random() * 100 + '%';
                line.style.left = Math.random() * 100 + '%';
                line.style.transform = 'rotate(' + (Math.random() * 180) + 'deg)';
                noise.appendChild(line);
            }
            
            // Gürültü noktaları ekle
            for (let i = 0; i < 30; i++) {
                const dot = document.createElement('div');
                dot.className = 'noise-dot';
                dot.style.width = Math.random() * 3 + 1 + 'px';
                dot.style.height = dot.style.width;
                dot.style.top = Math.random() * 100 + '%';
                dot.style.left = Math.random() * 100 + '%';
                noise.appendChild(dot);
            }
        </script>
    </body>
    </html>
  `;

  const image = await nodeHtmlToImage({
    html: html,
    type: 'png',
    quality: 100,
    transparent: false,
    puppeteerArgs: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  return image;
}

// Fallback CAPTCHA (SVG base64)
async function generateFallbackCaptcha(text) {
  // Basit bir SVG CAPTCHA
  const svg = `
    <svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f0f0f0"/>
          <stop offset="100%" stop-color="#e0e0e0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      ${Array.from({length: 8}, (_, i) => 
        `<line x1="${Math.random() * 200}" y1="${Math.random() * 80}" 
               x2="${Math.random() * 200}" y2="${Math.random() * 80}" 
               stroke="rgba(0,0,0,0.1)" stroke-width="1"/>`
      ).join('')}
      ${Array.from({length: 20}, (_, i) =>
        `<circle cx="${Math.random() * 200}" cy="${Math.random() * 80}" 
                r="${Math.random() * 2}" fill="rgba(0,0,0,0.05)"/>`
      ).join('')}
      <text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="24" 
            font-weight="bold" fill="#2c3e50" transform="skewX(-5)">
        ${text}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// CAPTCHA doğrula (GET ve POST)
async function verifyCaptcha(req, res) {
  let captchaId, answer;

  if (req.method === 'GET') {
    // GET parametreleri
    ({ captchaId, answer } = req.query);
  } else {
    // POST body
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

  // Case-insensitive karşılaştırma ve boşlukları temizle
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