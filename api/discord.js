// api/discord.js - GET ve POST desteği
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
    let token, channelId, guildId;

    if (req.method === 'GET') {
      token = req.query.token;
      channelId = req.query.channel_id;
      guildId = req.query.guild_id;
    } else if (req.method === 'POST') {
      token = req.body.token;
      channelId = req.body.channel_id;
      guildId = req.body.guild_id;
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

    console.log(`🤖 Discord Bot Bağlanıyor: ${channelId}`);

    // Botu ses kanalına otomatik bağla
    const result = await connectBotToVoiceChannel(token, channelId, guildId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      guild_id: result.guild_id,
      bot_username: result.bot_username,
      connected: true,
      message: 'Bot ses kanalına başarıyla bağlandı',
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

// Botu ses kanalına otomatik bağlama (aynı fonksiyon)
async function connectBotToVoiceChannel(token, channelId, guildId) {
  const baseURL = 'https://discord.com/api/v10';

  // 1. Bot bilgilerini doğrula
  console.log('🔐 Bot token doğrulanıyor...');
  const botResponse = await fetch(`${baseURL}/users/@me`, {
    headers: {
      'Authorization': `Bot ${token}`
    }
  });

  if (!botResponse.ok) {
    throw new Error('Geçersiz bot token! Tokeni kontrol edin.');
  }

  const botData = await botResponse.json();
  console.log(`✅ Bot Doğrulandı: ${botData.username}`);

  // 2. Kanal bilgilerini al ve kontrol et
  console.log(`🔍 Kanal bilgileri alınıyor: ${channelId}`);
  const channelResponse = await fetch(`${baseURL}/channels/${channelId}`, {
    headers: {
      'Authorization': `Bot ${token}`
    }
  });

  if (!channelResponse.ok) {
    throw new Error('Kanal bulunamadı! Kanal ID\'sini kontrol edin.');
  }

  const channelData = await channelResponse.json();
  
  // Ses kanalı kontrolü
  if (channelData.type !== 2) {
    throw new Error('Bu bir ses kanalı değil! Ses kanalı ID\'si girin.');
  }

  const actualGuildId = guildId || channelData.guild_id;
  console.log(`🎵 Kanal: ${channelData.name} | Sunucu: ${actualGuildId}`);

  // 3. Botun sunucuda olup olmadığını kontrol et
  console.log('🔍 Bot sunucu kontrolü...');
  const guildsResponse = await fetch(`${baseURL}/users/@me/guilds`, {
    headers: {
      'Authorization': `Bot ${token}`
    }
  });

  if (guildsResponse.ok) {
    const guilds = await guildsResponse.json();
    const botInGuild = guilds.some(guild => guild.id === actualGuildId);
    
    if (!botInGuild) {
      throw new Error('Bot bu sunucuda değil! Botu sunucuya ekleyin.');
    }
    console.log('✅ Bot sunucuda bulundu');
  }

  // 4. BOTU SES KANALINA BAĞLA - Voice State Update
  console.log('🔗 Ses kanalına bağlanılıyor...');
  const voiceResponse = await fetch(`${baseURL}/guilds/${actualGuildId}/voice-states/@me`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel_id: channelId,
      suppress: false,
      request_to_speak_timestamp: null
    })
  });

  if (voiceResponse.ok) {
    console.log('✅ Bot ses kanalına bağlandı!');
    
    return {
      success: true,
      bot_username: botData.username,
      bot_id: botData.id,
      guild_id: actualGuildId,
      channel_name: channelData.name,
      channel_id: channelData.id,
      connection_status: 'connected'
    };
  } else {
    const errorData = await voiceResponse.text();
    console.error('❌ Ses bağlantı hatası:', errorData);
    
    if (voiceResponse.status === 403) {
      throw new Error('Botun yetkisi yok! "Connect" ve "Speak" yetkilerini verin.');
    } else if (voiceResponse.status === 404) {
      throw new Error('Kanal veya sunucu bulunamadı!');
    } else {
      throw new Error(`Ses bağlantı hatası: ${voiceResponse.status}`);
    }
  }
}