// api/discord.js - clientReady event ile
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';

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

    console.log(`🤖 Bot aktif ediliyor (SONSUZ)...`);

    // Botu başlat ve kanala sonsuz bağlan
    const result = await startInfiniteBot(token, channelId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      bot_username: result.botUsername,
      connected: true,
      message: 'Bot aktif edildi ve ses kanalına SONSUZ bağlandı! 🔄',
      infinite: true,
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

// Sonsuz döngü ile botu başlat
async function startInfiniteBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      // clientReady event'i kullan (ready değil)
      client.once('clientReady', async (c) => {
        console.log(`✅ Bot giriş yaptı: ${c.user.tag}`);
        
        // Sonsuz bağlantı döngüsünü başlat
        startInfiniteConnection(client, channelId, token);
        
        resolve({
          botUsername: c.user.tag,
          connected: true,
          infinite: true
        });
      });

      // Hata durumları
      client.on('error', (error) => {
        console.error('❌ Bot hatası:', error);
      });

      // Botu login et
      await client.login(token);
      
    } catch (loginError) {
      reject(new Error(`Bot giriş hatası: ${loginError.message}`));
    }
  });
}

// SONSÜZ BAĞLANTI DÖNGÜSÜ
async function startInfiniteConnection(client, channelId, token) {
  let voiceConnection = null;
  let isConnected = false;
  
  const infiniteLoop = async () => {
    try {
      // Kanalı bul
      const channel = await client.channels.fetch(channelId);
      
      if (!channel || channel.type !== 2) {
        console.log('⏳ Kanal bekleniyor...');
        setTimeout(infiniteLoop, 5000);
        return;
      }

      console.log(`🎵 Kanal bulundu: ${channel.name}`);

      // SES KANALINA BAĞLAN
      voiceConnection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true
      });

      console.log(`🔗 Bot ses kanalına bağlandı: ${channel.name}`);
      isConnected = true;

      // Bağlantı event'leri
      voiceConnection.on('stateChange', (oldState, newState) => {
        console.log(`🔊 Ses durumu: ${oldState.status} -> ${newState.status}`);
        
        // BAĞLANTI KESİLİRSE HEMEN YENİDEN BAĞLAN
        if (newState.status === 'disconnected' && isConnected) {
          console.log('🔄 Bağlantı kesildi, YENİDEN BAĞLANIYOR...');
          isConnected = false;
          
          setTimeout(() => {
            if (voiceConnection) {
              voiceConnection.destroy();
            }
            infiniteLoop();
          }, 1000);
        }
      });

      voiceConnection.on('error', (error) => {
        console.error('❌ Ses bağlantı hatası:', error);
        isConnected = false;
        
        setTimeout(() => {
          if (voiceConnection) {
            voiceConnection.destroy();
          }
          infiniteLoop();
        }, 3000);
      });

      // Aktif botları kaydet
      activeBots.set(token, {
        client: client,
        voiceConnection: voiceConnection,
        channel: channel,
        connectedAt: new Date(),
        infinite: true
      });

    } catch (error) {
      console.error('❌ Bağlantı hatası:', error);
      isConnected = false;
      
      setTimeout(() => {
        if (voiceConnection) {
          voiceConnection.destroy();
        }
        infiniteLoop();
      }, 5000);
    }
  };

  // SONSÜZ DÖNGÜYÜ BAŞLAT
  console.log('🔄 SONSÜZ BAĞLANTI DÖNGÜSÜ BAŞLATILDI!');
  infiniteLoop();
}

// Ping sistemi
function startPingSystem() {
  setInterval(() => {
    activeBots.forEach((bot, token) => {
      if (bot.voiceConnection && bot.channel) {
        console.log(`🏓 Ping: ${bot.client.user?.tag} hala kanalda`);
        
        if (bot.voiceConnection.state.status === 'disconnected') {
          console.log(`🔄 ${bot.client.user?.tag} bağlantısı kesildi, yeniden bağlanılıyor...`);
          bot.voiceConnection.destroy();
          startInfiniteConnection(bot.client, bot.channel.id, token);
        }
      }
    });
  }, 30000);
}

// Ping sistemini başlat
startPingSystem();