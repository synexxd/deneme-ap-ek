// api/discord.js - Gerçek Discord Bot API
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

    if (req.method === 'POST') {
      token = req.body.token;
      channelId = req.body.channel_id;
      guildId = req.body.guild_id;
    } else {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece POST methodu destekleniyor'
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

    // Discord Voice Connection işlemi
    const result = await connectToVoiceChannel(token, channelId, guildId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: 'POST',
      channel_id: channelId,
      guild_id: guildId || 'auto',
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Discord API Hatası:', error);
    res.status(500).json({
      status: 'error',
      message: 'Discord bağlantı hatası: ' + error.message
    });
  }
}

// Discord ses kanalına bağlanma
async function connectToVoiceChannel(token, channelId, guildId) {
  const baseURL = 'https://discord.com/api/v10';

  // 1. Bot bilgilerini doğrula
  const botResponse = await fetch(`${baseURL}/users/@me`, {
    headers: {
      'Authorization': `Bot ${token}`
    }
  });

  if (!botResponse.ok) {
    throw new Error('Geçersiz bot token veya yetki yok');
  }

  const botData = await botResponse.json();
  console.log(`✅ Bot Doğrulandı: ${botData.username}#${botData.discriminator}`);

  // 2. Kanal bilgilerini al
  const channelResponse = await fetch(`${baseURL}/channels/${channelId}`, {
    headers: {
      'Authorization': `Bot ${token}`
    }
  });

  if (!channelResponse.ok) {
    throw new Error('Kanal bulunamadı veya erişim izni yok');
  }

  const channelData = await channelResponse.json();
  
  if (channelData.type !== 2) {
    throw new Error('Bu kanal bir ses kanalı değil');
  }

  const actualGuildId = guildId || channelData.guild_id;
  console.log(`🎵 Ses Kanalı: ${channelData.name} | Sunucu: ${actualGuildId}`);

  // 3. Botun sunucuda olup olmadığını kontrol et
  const guildsResponse = await fetch(`${baseURL}/users/@me/guilds`, {
    headers: {
      'Authorization': `Bot ${token}`
    }
  });

  if (guildsResponse.ok) {
    const guilds = await guildsResponse.json();
    const botInGuild = guilds.some(guild => guild.id === actualGuildId);
    
    if (!botInGuild) {
      throw new Error('Bot bu sunucuda bulunmuyor. Botu sunucuya ekleyin.');
    }
  }

  // 4. Voice State Update - Botu ses kanalına bağla
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

  if (!voiceResponse.ok) {
    const errorText = await voiceResponse.text();
    console.error('Voice connection error:', errorText);
    throw new Error('Ses kanalına bağlanılamadı: ' + voiceResponse.status);
  }

  console.log(`✅ Bot ses kanalına bağlandı: ${channelData.name}`);

  return {
    success: true,
    message: 'Bot ses kanalına başarıyla bağlandı',
    bot: {
      id: botData.id,
      username: botData.username,
      discriminator: botData.discriminator
    },
    channel: {
      id: channelData.id,
      name: channelData.name,
      type: channelData.type
    },
    guild: {
      id: actualGuildId
    },
    connection: {
      status: 'connected',
      timestamp: new Date().toISOString()
    }
  };
}
