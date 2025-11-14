// api/discord.js - Discord.js ile gerçek bağlantı
import { Client, GatewayIntentBits } from 'discord.js';

// Aktif bot bağlantılarını sakla
const activeBots = new Map();

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

    console.log(`🤖 Bot aktif ediliyor ve kanala bağlanıyor...`);

    // Botu başlat ve kanala bağlan
    const result = await startBotAndConnect(token, channelId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      bot_username: result.botUsername,
      connected: true,
      message: 'Bot aktif edildi ve ses kanalına bağlandı!',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Discord Bot Hatası:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      connected: false,
      timestamp: new Date().toISOString()
    });
  }
}

// Botu başlat ve kanala bağlan
async function startBotAndConnect(token, channelId) {
  return new Promise(async (resolve, reject) => {
    try {
      // Yeni Discord client oluştur
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      // Bot ready olduğunda
      client.once('ready', async () => {
        console.log(`✅ Bot giriş yaptı: ${client.user.tag}`);
        
        try {
          // Kanalı bul
          const channel = await client.channels.fetch(channelId);
          
          if (!channel) {
            reject(new Error('Kanal bulunamadı!'));
            return;
          }

          if (channel.type !== 2) { // 2 = GUILD_VOICE
            reject(new Error('Bu bir ses kanalı değil!'));
            return;
          }

          // Ses kanalına bağlan
          const connection = await channel.join();
          console.log(`🎵 Bot ses kanalına bağlandı: ${channel.name}`);

          // Başarılı sonuç
          resolve({
            botUsername: client.user.tag,
            channelName: channel.name,
            guildName: channel.guild.name,
            connected: true
          });

          // 30 saniye sonra bağlantıyı kes (opsiyonel)
          setTimeout(() => {
            connection.destroy();
            client.destroy();
            console.log('🔌 Bot bağlantısı kesildi');
          }, 30000);

        } catch (channelError) {
          reject(new Error(`Kanal bağlantı hatası: ${channelError.message}`));
          client.destroy();
        }
      });

      // Hata durumları
      client.on('error', (error) => {
        console.error('❌ Bot hatası:', error);
        reject(new Error(`Bot hatası: ${error.message}`));
      });

      // Botu login et
      await client.login(token);
      
    } catch (loginError) {
      reject(new Error(`Bot giriş hatası: ${loginError.message}`));
    }
  });
}