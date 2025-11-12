// api/captcha.js - Gerçek CAPTCHA generation
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

// CAPTCHA oluştur - SVG ile gerçek CAPTCHA
async function generateCaptcha(req, res) {
  let text, width = 200, height = 80;

  if (req.method === 'GET') {
    ({ text, width = 200, height = 80 } = req.query);
  } else {
    ({ text, width = 200, height = 80 } = req.body);
  }

  const captchaText = text || generateRandomText(6);
  const captchaId = 'captcha_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // SVG CAPTCHA oluştur
  const svgCaptcha = generateSVGCaptcha(captchaText, parseInt(width), parseInt(height));
  
  captchaStore.set(captchaId, {
    text: captchaText,
    createdAt: Date.now(),
    imageUrl: svgCaptcha
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
    imageUrl: svgCaptcha,
    text: captchaText,
    expiresIn: '10 minutes'
  });
}

// Gerçek CAPTCHA SVG oluşturma
function generateSVGCaptcha(text, width, height) {
  // Rastgele renkler
  const bgColor = `hsl(${Math.random() * 360}, 25%, 95%)`;
  const textColor = `hsl(${Math.random() * 360}, 70%, 30%)`;
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg${Date.now()}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgColor}"/>
          <stop offset="100%" stop-color="${lightenColor(bgColor, -10)}"/>
        </linearGradient>
      </defs>
      
      <!-- Arkaplan -->
      <rect width="100%" height="100%" fill="url(#bg${Date.now()})"/>
      
      <!-- Gürültü çizgileri -->
      ${Array.from({length: 12}, (_, i) => {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = x1 + (Math.random() * 80 - 40);
        const y2 = y1 + (Math.random() * 80 - 40);
        const opacity = 0.1 + Math.random() * 0.2;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                     stroke="${textColor}" stroke-width="${0.5 + Math.random()}" opacity="${opacity}"/>`;
      }).join('')}
      
      <!-- Gürültü noktaları -->
      ${Array.from({length: 50}, (_, i) => {
        const cx = Math.random() * width;
        const cy = Math.random() * height;
        const r = Math.random() * 2;
        const opacity = 0.05 + Math.random() * 0.1;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${textColor}" opacity="${opacity}"/>`;
      }).join('')}
      
      <!-- CAPTCHA metni -->
      <text x="50%" y="55%" 
            text-anchor="middle" 
            font-family="'Arial', 'Helvetica', sans-serif" 
            font-size="${22 + Math.random() * 6}" 
            font-weight="bold" 
            fill="${textColor}"
            style="letter-spacing: 2px;"
            transform="rotate(${Math.random() * 10 - 5}, ${width/2}, ${height/2})">
        ${addTextDistortion(text)}
      </text>
      
      <!-- Dalga efekti -->
      <path d="${generateWavePath(width, height)}" 
            fill="none" 
            stroke="${textColor}" 
            stroke-width="0.5" 
            opacity="0.1"/>
    </svg>
  `;

  const base64SVG = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64SVG}`;
}

// Metni distort et
function addTextDistortion(text) {
  return text.split('').map((char, index) => {
    const rotation = (Math.random() * 20 - 10);
    const scale = 0.8 + Math.random() * 0.4;
    return `
      <tspan x="${50 + (index - text.length/2) * 12}%" 
             dy="${Math.random() * 4 - 2}" 
             transform="rotate(${rotation}) scale(${scale})">
        ${char}
      </tspan>
    `;
  }).join('');
}

// Dalga path'i oluştur
function generateWavePath(width, height) {
  const points = [];
  const segments = 8;
  
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width;
    const y = height / 2 + Math.sin(i * 0.8) * 10;
    points.push(`${x},${y}`);
  }
  
  return `M ${points.join(' L ')}`;
}

// Renk açıklaştırma
function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
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