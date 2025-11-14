// api/discord.js - CRON ile sürekli aktif
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';

// Bot konfigürasyonları
const botConfigs = new Map();

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

    console.log(`🤖 BOT KAYDI OLUŞTURULUYOR: ${channelId}`);

    // Bot konfigürasyonunu kaydet
    botConfigs.set(token, {
      channelId: channelId,
      token: token,
      lastConnection: new Date(),
      active: true
    });

    // Hemen bağlan
    await connectBot(token, channelId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      connected: true,
      message: 'Bot kaydedildi! Her 5 dakikada bir otomatik bağlanacak! ⚡',
      auto_reconnect: true,
      reconnect_interval: '5 minutes',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bot Hatası:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      connected: false,
      timestamp: new Date().toISOString()
    });
  }
}

// Bot bağlantısı
async function connectBot(token, channelId) {
  try {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
      ]
    });

    client.once('ready', async (c) => {
      console.log(`✅ BOT BAĞLANDI: ${c.user.tag}`);
      
      try {
        const channel = await client.channels.fetch(channelId);
        
        if (channel && channel.type === 2) {
          const voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true
          });

          console.log(`🎵 BOT KANALDA: ${channel.name}`);
          
          // Bağlantı durumunu güncelle
          if (botConfigs.has(token)) {
            const config = botConfigs.get(token);
            config.lastConnection = new Date();
            config.client = client;
            config.voiceConnection = voiceConnection;
          }

          // Bağlantı kesilirse logla
          voiceConnection.on('stateChange', (oldState, newState) => {
            console.log(`🔊 ${c.user.tag} durumu: ${oldState.status} -> ${newState.status}`);
          });

        }
      } catch (channelError) {
        console.error('Kanal hatası:', channelError);
      }
    });

    await client.login(token);
    
  } catch (error) {
    console.error('Bağlantı hatası:', error);
  }
}

// OTOMATİK YENİDEN BAĞLANMA SİSTEMİ
setInterval(async () => {
  console.log('🔄 OTOMATİK BOT KONTROLÜ...');
  
  for (const [token, config] of botConfigs.entries()) {
    if (config.active) {
      const now = new Date();
      const lastConn = new Date(config.lastConnection);
      const diffMinutes = (now - lastConn) / (1000 * 60);
      
      // Son 4 dakika içinde bağlanmadıysa yeniden bağlan
      if (diffMinutes > 4) {
        console.log(`🔁 Bot yeniden bağlanıyor: ${token.substring(0, 10)}...`);
        
        // Eski bağlantıyı temizle
        if (config.client) {
          try {
            if (config.voiceConnection) config.voiceConnection.destroy();
            config.client.destroy();
          } catch (e) {
            console.error('Temizleme hatası:', e);
          }
        }
        
        // Yeniden bağlan
        await connectBot(token, config.channelId);
      } else {
        console.log(`✅ Bot aktif: ${token.substring(0, 10)}... (${Math.floor(diffMinutes)} dakika önce)`);
      }
    }
  }
}, 60000); // 1 dakikada bir kontrol

// Her 5 dakikada bir TÜM botları yeniden bağla (güvence)
setInterval(async () => {
  console.log('🔄 5 DAKİKALIK YENİDEN BAĞLANMA...');
  
  for (const [token, config] of botConfigs.entries()) {
    if (config.active) {
      console.log(`🔁 Zorunlu yeniden bağlanma: ${token.substring(0, 10)}...`);
      
      // Eski bağlantıyı temizle
      if (config.client) {
        try {
          if (config.voiceConnection) config.voiceConnection.destroy();
          config.client.destroy();
        } catch (e) {
          console.error('Temizleme hatası:', e);
        }
      }
      
      // Yeniden bağlan
      await connectBot(token, config.channelId);
    }
  }
}, 300000); // 5 dakika