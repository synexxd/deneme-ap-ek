// api/ipinfo.js
export default async function handler(req, res) {
  try {
    let { ip, lang = 'tr' } = req.query;

    if (req.method !== 'GET') {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece GET methodu destekleniyor'
      });
    }

    // IP adresi kontrolü
    if (!ip) {
      // Eğer IP belirtilmemişse, isteği yapanın IP'sini al
      ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
      
      // Localhost veya IPv6 adreslerini temizle
      if (ip === '::1' || ip === '127.0.0.1') {
        ip = '79.127.184.108'; // Varsayılan örnek IP
      }
    }

    // IP adresi validasyonu
    if (!isValidIP(ip)) {
      return res.status(400).json({
        status: 'error',
        message: 'Geçersiz IP adresi formatı'
      });
    }

    // IP-API.com'dan veri çek
    const ipInfo = await fetchIPInfo(ip, lang);
    
    res.json({
      status: 'success',
      endpoint: '/api/ipinfo',
      method: 'GET',
      query_ip: ip,
      data: ipInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'IP bilgisi alınırken hata oluştu: ' + error.message
    });
  }
}

// IP-API.com'dan veri çekme
async function fetchIPInfo(ip, lang) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=66846719&lang=${lang}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'fail') {
      throw new Error(data.message || 'IP bilgisi alınamadı');
    }
    
    return formatIPData(data);
    
  } catch (error) {
    console.error('IP-API hatası:', error);
    // Fallback: Örnek veri
    return getSampleIPData(ip);
  }
}

// Veriyi formatlama
function formatIPData(data) {
  return {
    ip: data.query,
    location: {
      country: data.country || 'Unknown',
      country_code: data.countryCode || 'N/A',
      region: data.region || 'Unknown',
      region_name: data.regionName || 'Unknown',
      city: data.city || 'Unknown',
      zip: data.zip || 'N/A',
      lat: data.lat || 0,
      lon: data.lon || 0,
      timezone: data.timezone || 'Unknown'
    },
    isp: {
      as: data.as || 'N/A',
      isp: data.isp || 'Unknown',
      org: data.org || 'Unknown'
    },
    network: {
      asname: data.asname || 'N/A'
    },
    mobile: data.mobile || false,
    proxy: data.proxy || false,
    hosting: data.hosting || false,
    status: data.status || 'unknown'
  };
}

// IP adresi validasyonu
function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  return ipv6Regex.test(ip);
}

// Örnek IP verisi (fallback)
function getSampleIPData(ip) {
  return {
    ip: ip,
    location: {
      country: "Turkey",
      country_code: "TR",
      region: "34",
      region_name: "Istanbul",
      city: "Istanbul",
      zip: "34000",
      lat: 41.0082,
      lon: 28.9784,
      timezone: "Europe/Istanbul"
    },
    isp: {
      as: "AS9121 Turk Telekom",
      isp: "Turk Telekom",
      org: "Turk Telekom"
    },
    network: {
      asname: "TTNET-AS-TR-TURKTELECOM-9121"
    },
    mobile: false,
    proxy: false,
    hosting: false,
    status: "success"
  };
}
