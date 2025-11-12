// api/captcha.js
import { createCanvas } from 'canvas';

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

  // CAPTCHA resmi oluştur
  const canvas = createCanvas(parseInt(width), parseInt(height));
  const ctx = canvas.getContext('2d');

  // Arkaplan
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Gürültü çizgileri
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = `rgba(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100}, 0.3)`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  // Gürültü noktaları
  for (let i = 0; i < 50; i++) {
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
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#2c3e50';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Metin distort etme
  const textWidth = ctx.measureText(captchaText).width;
  const startX = (canvas.width - textWidth) / 2;

  for (let i = 0; i < captchaText.length; i++) {
    const char = captchaText[i];
    const x = startX + (i * textWidth / captchaText.length) + (Math.random() * 8 - 4);
    const y = canvas.height / 2 + (Math.random() * 6 - 3);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() * 0.4 - 0.2));
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