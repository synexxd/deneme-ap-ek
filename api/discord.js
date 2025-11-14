// api/discord.js - Bot süresiz kanalda kalsın
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource } from '@discordjs/voice';

// Aktif botları sakla
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

    console.log(`🤖 Bot aktif ediliyor (süresiz)...`);

    // Eğer bu token zaten aktifse, önceki bağlantıyı kes
    if (activeBots.has(token)) {
      console.log('♻️ Önceki bot bağlantısı temizleniyor...');
      const oldBot = activeBots.get(token);
      if (oldBot.voiceConnection) {
        oldBot.voiceConnection.destroy();
      }
      if (oldBot.client) {
        oldBot.client.destroy();
      }
      activeBots.delete(token);
    }

    // Botu başlat ve kanala bağlan
    const result = await startBotAndConnect(token, channelId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      bot_username: result.botUsername,
      connected: true,
      message: 'Bot aktif edildi ve ses kanalına süresiz bağlandı! 🎵',
      persistent: true,
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

// Botu başlat ve kanala süresiz bağlan
async function startBotAndConnect(token, channelId) {
  return new Promise(async (resolve, reject) => {
    try {
      // Yeni Discord client oluştur
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.GuildMessages
        ]
      });

      let voiceConnection = null;
      let audioPlayer = null;

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

          console.log(`🎵 Kanal bulundu: ${channel.name}`);

          // SES KANALINA BAĞLAN - Süresiz
          voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true, // Bot kendini sağır yapsın
            selfMute: true  // Bot kendini sessiz yapsın (sadece bağlı kalsın)
          });

          console.log(`🔗 Bot ses kanalına SÜRESİZ bağlandı: ${channel.name}`);

          // Audio player oluştur (bağlantıyı aktif tutmak için)
          audioPlayer = createAudioPlayer();
          voiceConnection.subscribe(audioPlayer);

          // Bağlantı event'leri
          voiceConnection.on('stateChange', (oldState, newState) => {
            console.log(`🔊 Ses durumu: ${oldState.status} -> ${newState.status}`);
            
            // Eğer bağlantı kesilirse yeniden bağlanmayı dene
            if (newState.status === 'disconnected') {
              console.log('⚠️ Bağlantı kesildi, yeniden bağlanılıyor...');
              setTimeout(() => {
                if (channel && channel.guild) {
                  voiceConnection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: true,
                    selfMute: true
                  });
                  voiceConnection.subscribe(audioPlayer);
                }
              }, 5000);
            }
          });

          voiceConnection.on('error', (error) => {
            console.error('❌ Ses bağlantı hatası:', error);
          });

          // Aktif botları kaydet
          activeBots.set(token, {
            client: client,
            voiceConnection: voiceConnection,
            audioPlayer: audioPlayer,
            channel: channel,
            connectedAt: new Date()
          });

          console.log(`💾 Bot aktif botlar listesine kaydedildi: ${client.user.tag}`);

          // Başarılı sonuç
          resolve({
            botUsername: client.user.tag,
            channelName: channel.name,
            guildName: channel.guild.name,
            connected: true,
            persistent: true
          });

        } catch (channelError) {
          console.error('Kanal hatası:', channelError);
          reject(new Error(`Kanal bağlantı hatası: ${channelError.message}`));
          if (client) client.destroy();
        }
      });

      // Hata durumları
      client.on('error', (error) => {
        console.error('❌ Bot hatası:', error);
      });

      // Client destroy olduğunda
      client.on('disconnect', () => {
        console.log('🔌 Bot bağlantısı kesildi');
      });

      // Botu login et
      await client.login(token);
      
    } catch (loginError) {
      console.error('Login hatası:', loginError);
      reject(new Error(`Bot giriş hatası: ${loginError.message}`));
    }
  });
}

// Aktif botları listeleme endpoint'i (opsiyonel)
export async function getActiveBots(req, res) {
  const bots = [];
  
  activeBots.forEach((bot, token) => {
    bots.push({
      botUsername: bot.client.user?.tag,
      channelName: bot.channel?.name,
      connectedAt: bot.connectedAt,
      token: token.substring(0, 10) + '...' // Tokeni gizle
    });
  });
  
  res.json({
    status: 'success',
    active_bots: bots,
    total: bots.length
  });
}