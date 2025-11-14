// api/discord.js - Basitleştirilmiş ve Hızlı
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let token, channelId;

    if (req.method === 'GET') {
      token = req.query.token;
      channelId = req.query.channel_id;
    } else if (req.method === 'POST') {
      token = req.body.token;
      channelId = req.body.channel_id;
    } else {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece GET ve POST methodu destekleniyor'
      });
    }

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Bot token gereklidir'
      });
    }

    if (!channelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Ses kanalı ID gereklidir'
      });
    }

    console.log(`🤖 Discord Bot Bağlanıyor...`);

    // Direkt ses kanalına bağlan (kontrol yapmadan)
    const result = await directVoiceConnect(token, channelId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      connected: true,
      message: 'Bot ses kanalına bağlandı',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Discord API Hatası:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      connected: false,
      timestamp: new Date().toISOString()
    });
  }
}

// Direkt ses bağlantısı (kontrolsüz)
async function directVoiceConnect(token, channelId) {
  const baseURL = 'https://discord.com/api/v10';

  try {
    // 1. Önce kanal bilgisini al (guild_id için)
    const channelResponse = await fetch(`${baseURL}/channels/${channelId}`, {
      headers: {
        'Authorization': `Bot ${token}`
      }
    });

    let guildId;
    
    if (channelResponse.ok) {
      const channelData = await channelResponse.json();
      guildId = channelData.guild_id;
      console.log(`🎵 Kanal: ${channelData.name} | Sunucu: ${guildId}`);
    } else {
      // Kanal bilgisi alınamazsa, guild_id olmadan dene
      console.log('⚠️ Kanal bilgisi alınamadı, guild_id olmadan deneniyor...');
      guildId = 'auto';
    }

    // 2. Direkt voice state update yap
    console.log('🔗 Ses kanalına bağlanılıyor...');
    
    let voiceResponse;
    
    if (guildId && guildId !== 'auto') {
      // Guild ID ile
      voiceResponse = await fetch(`${baseURL}/guilds/${guildId}/voice-states/@me`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel_id: channelId,
          suppress: false
        })
      });
    } else {
      // Guild ID olmadan (daha basit)
      // Discord API genellikle guild_id gerektirir, bu yüzden alternatif yöntem
      throw new Error('Guild ID bulunamadı. Botun sunucuda olduğundan emin olun.');
    }

    if (voiceResponse.ok) {
      console.log('✅ Bot ses kanalına bağlandı!');
      return { success: true };
    } else {
      const errorText = await voiceResponse.text();
      console.error('❌ Ses bağlantı hatası:', voiceResponse.status, errorText);
      
      // Hata mesajlarını iyileştir
      switch (voiceResponse.status) {
        case 400:
          throw new Error('Geçersiz istek. Token veya kanal ID hatalı.');
        case 403:
          throw new Error('Botun yetkisi yok. "Connect" ve "Speak" yetkilerini verin.');
        case 404:
          throw new Error('Kanal veya sunucu bulunamadı. ID\'leri kontrol edin.');
        default:
          throw new Error(`Discord API hatası: ${voiceResponse.status}`);
      }
    }

  } catch (error) {
    console.error('Bağlantı hatası:', error);
    throw error;
  }
}