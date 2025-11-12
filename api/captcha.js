// api/captcha.js - Basit versiyon (canvas ve html-to-image olmadan)
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
      message: 'CAPTCHA işlemi sırasında hata oluştu'
    });
  }
}

// Basit CAPTCHA oluştur
async function generateCaptcha(req, res) {
  const captchaText = generateRandomText(6);
  const captchaId = 'captcha_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // Basit bir placeholder image URL'si
  const imageUrl = `https://via.placeholder.com/200x80/f0f0f0/2c3e50?text=${encodeURIComponent(captchaText)}`;

  captchaStore.set(captchaId, {
    text: captchaText,
    createdAt: Date.now()
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
    note: 'Placeholder image used - implement custom CAPTCHA generation'
  });
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