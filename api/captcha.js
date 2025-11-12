// api/captcha.js - Basit ve çalışan CAPTCHA
const captchaStore = new Map();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { action, captchaId, answer } = req.query;
      
      if (action === 'verify') {
        return verifyCaptcha(captchaId, answer, 'GET', res);
      } else {
        return generateCaptcha(req.query, 'GET', res);
      }
    } 
    else if (req.method === 'POST') {
      const { action, captchaId, answer, ...params } = req.body;
      
      if (action === 'verify') {
        return verifyCaptcha(captchaId, answer, 'POST', res);
      } else {
        return generateCaptcha(params, 'POST', res);
      }
    } 
    else {
      return res.status(405).json({
        status: 'error',
        message: 'Method not allowed. Use GET or POST.'
      });
    }
  } catch (error) {
    console.error('CAPTCHA Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}

// CAPTCHA oluştur
function generateCaptcha(params, method, res) {
  const { text, width = 200, height = 80 } = params;
  
  // Rastgele CAPTCHA metni
  const captchaText = text || generateRandomText(6);
  const captchaId = 'cap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  
  // Basit SVG CAPTCHA
  const svg = createSimpleCaptchaSVG(captchaText, parseInt(width), parseInt(height));
  const imageUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  
  // Store'a kaydet
  captchaStore.set(captchaId, {
    text: captchaText,
    created: Date.now()
  });
  
  // 10 dakika sonra temizle
  setTimeout(() => {
    captchaStore.delete(captchaId);
  }, 10 * 60 * 1000);
  
  return res.json({
    status: 'success',
    captchaId: captchaId,
    imageUrl: imageUrl,
    text: captchaText,
    expiresIn: '10 minutes',
    method: method
  });
}

// CAPTCHA doğrula
function verifyCaptcha(captchaId, answer, method, res) {
  if (!captchaId || !answer) {
    return res.status(400).json({
      status: 'error',
      message: 'captchaId and answer are required'
    });
  }
  
  const captcha = captchaStore.get(captchaId);
  
  if (!captcha) {
    return res.status(404).json({
      status: 'error',
      message: 'CAPTCHA not found or expired'
    });
  }
  
  // Büyük/küçük harf fark etmez, boşlukları temizle
  const isCorrect = captcha.text.toLowerCase().trim() === answer.toString().toLowerCase().trim();
  
  if (isCorrect) {
    captchaStore.delete(captchaId);
    return res.json({
      status: 'success',
      message: 'CAPTCHA verified successfully',
      verified: true,
      method: method
    });
  } else {
    return res.json({
      status: 'error',
      message: 'CAPTCHA verification failed',
      verified: false,
      method: method
    });
  }
}

// Basit SVG CAPTCHA oluştur
function createSimpleCaptchaSVG(text, width, height) {
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f8f9fa"/>
  
  <!-- Background noise lines -->
  <line x1="10" y1="15" x2="190" y2="25" stroke="#dee2e6" stroke-width="1"/>
  <line x1="20" y1="60" x2="180" y2="40" stroke="#dee2e6" stroke-width="1"/>
  <line x1="50" y1="10" x2="60" y2="70" stroke="#dee2e6" stroke-width="1"/>
  <line x1="150" y1="5" x2="140" y2="75" stroke="#dee2e6" stroke-width="1"/>
  
  <!-- Text -->
  <text x="50%" y="55%" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="24" 
        font-weight="bold" 
        fill="#495057"
        style="letter-spacing: 3px;">
    ${text}
  </text>
  
  <!-- Dots -->
  <circle cx="30" cy="20" r="1.5" fill="#adb5bd"/>
  <circle cx="170" cy="15" r="1" fill="#adb5bd"/>
  <circle cx="80" cy="65" r="2" fill="#adb5bd"/>
  <circle cx="120" cy="10" r="1" fill="#adb5bd"/>
  <circle cx="40" cy="50" r="1.5" fill="#adb5bd"/>
  <circle cx="160" cy="60" r="1" fill="#adb5bd"/>
</svg>
  `.trim();
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