// api/captcha.js
import { createCanvas } from 'canvas';

// CAPTCHA storage (gerçek uygulamada database kullanın)
const captchaStore = new Map();

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      return generateCaptcha(req, res);
    } else if (req.method === 'GET') {
      return getCaptcha(req, res);
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

// CAPTCHA oluştur
async function generateCaptcha(req, res) {
  const { text, width = 200, height = 80 } = req.body;

  // Rastgele CAPTCHA metni oluştur
  const captchaText = text || generateRandomText(6);
  const captchaId = 'captcha_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // CAPTCHA resmi oluştur
  const canvas = createCanvas(parseInt(width), parseInt(height));
  const ctx = canvas.getContext('2d');

  // Arkaplan
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Gürültü çizgileri
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100}, 0.3)`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  // Gürültü noktaları
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgba(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100}, 0.2)`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Metin
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Metin distort etme
  const textWidth = ctx.measureText(captchaText).width;
  const startX = (canvas.width - textWidth) / 2;

  for (let i = 0; i < captchaText.length; i++) {
    const char = captchaText[i];
    const x = startX + (i * textWidth / captchaText.length) + (Math.random() * 10 - 5);
    const y = canvas.height / 2 + (Math.random() * 10 - 5);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() * 0.5 - 0.25));
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }

  // Base64 image
  const imageBuffer = canvas.toBuffer('image/png');
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

  res.json({
    status: 'success',
    endpoint: '/api/captcha',
    captchaId: captchaId,
    imageUrl: imageUrl,
    text: captchaText,
    expiresIn: '10 minutes'
  });
}

// CAPTCHA doğrula
async function getCaptcha(req, res) {
  const { captchaId, answer } = req.query;

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

  // Case-insensitive karşılaştırma
  const isCorrect = captcha.text.toLowerCase() === answer.toLowerCase().trim();

  if (isCorrect) {
    captchaStore.delete(captchaId);
    
    res.json({
      status: 'success',
      message: 'CAPTCHA doğrulandı',
      verified: true
    });
  } else {
    res.json({
      status: 'error',
      message: 'CAPTCHA yanlış',
      verified: false
    });
  }
}

// Rastgele metin oluştur
function generateRandomText(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O ve 0, I ve 1 karışmaması için
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}
