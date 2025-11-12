// api/captcha.js - XXXX-XXXX-XXXX formatında
const captchaStore = new Map();

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { action, id, code } = req.query;
      
      if (action === 'verify') {
        return verifyCaptcha(id, code, res);
      } else {
        return generateCaptcha(res);
      }
    } 
    else if (req.method === 'POST') {
      const { action, id, code } = req.body;
      
      if (action === 'verify') {
        return verifyCaptcha(id, code, res);
      } else {
        return generateCaptcha(res);
      }
    } 
    else {
      return res.status(405).json({
        status: 'error',
        message: 'Method not allowed'
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
}

// CAPTCHA oluştur
function generateCaptcha(res) {
  const code = generateFormattedCode(); // XXXX-XXXX-XXXX formatında
  const id = 'cap_' + Date.now().toString(36);
  
  captchaStore.set(id, {
    code: code,
    created: Date.now()
  });

  // 10 dakika sonra temizle
  setTimeout(() => {
    captchaStore.delete(id);
  }, 10 * 60 * 1000);

  return res.json({
    status: 'success',
    id: id,
    code: code,
    expiresIn: '10 minutes'
  });
}

// CAPTCHA doğrula
function verifyCaptcha(id, userCode, res) {
  if (!id || !userCode) {
    return res.status(400).json({
      status: 'error',
      message: 'ID and code are required'
    });
  }
  
  const captcha = captchaStore.get(id);
  
  if (!captcha) {
    return res.status(404).json({
      status: 'error',
      message: 'CAPTCHA not found or expired'
    });
  }
  
  // Büyük/küçük harf fark etmez, boşlukları ve tireleri temizle
  const cleanUserCode = userCode.toString().toUpperCase().replace(/[-\s]/g, '');
  const cleanStoredCode = captcha.code.toUpperCase().replace(/[-\s]/g, '');
  
  const isCorrect = cleanUserCode === cleanStoredCode;
  
  if (isCorrect) {
    captchaStore.delete(id);
    return res.json({
      status: 'success',
      message: 'CAPTCHA verified successfully',
      verified: true
    });
  } else {
    return res.json({
      status: 'error',
      message: 'Invalid CAPTCHA code',
      verified: false
    });
  }
}

// XXXX-XXXX-XXXX formatında kod oluştur
function generateFormattedCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O/0 ve I/1 karışmaması için
  let code = '';
  
  // 12 karakterlik kod oluştur (4+4+4)
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    // 4 ve 8. karakterlerden sonra tire ekle
    if (i === 3 || i === 7) {
      code += '-';
    }
  }
  
  return code; // Örnek: A3B8-C2D9-E4F7
}

// Alternatif: Sayı ve harf karışık format
function generateMixedFormattedCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  
  let part1 = '';
  let part2 = '';
  let part3 = '';
  
  // İlk bölüm: 2 harf + 2 sayı
  for (let i = 0; i < 2; i++) {
    part1 += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 2; i++) {
    part1 += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  // İkinci bölüm: 4 sayı
  for (let i = 0; i < 4; i++) {
    part2 += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  // Üçüncü bölüm: 4 harf
  for (let i = 0; i < 4; i++) {
    part3 += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  return `${part1}-${part2}-${part3}`; // Örnek: AB34-5678-XYZK
}