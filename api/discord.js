// api/discord.js - DAHA GÜÇLÜ SÜREKLİ BAĞLANTI
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';

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

    console.log(`🤖 BOT AKTİF EDİLİYOR - ASLA DÜŞMEYECEK!`);

    // Eski bot varsa temizle
    if (activeBots.has(token)) {
      const oldBot = activeBots.get(token);
      if (oldBot.voiceConnection) oldBot.voiceConnection.destroy();
      if (oldBot.client) oldBot.client.destroy();
      activeBots.delete(token);
    }

    // YENİ BOTU BAŞLAT
    const result = await startSuperBot(token, channelId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      bot_username: result.botUsername,
      connected: true,
      message: 'Bot aktif! ASLA sesten düşmeyecek! 💪',
      super_persistent: true,
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

// SÜPER BOT - ASLA DÜŞMEZ
async function startSuperBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      // BOT HAZIR OLUNCA
      client.once('ready', async (c) => {
        console.log(`✅ BOT HAZIR: ${c.user.tag}`);
        
        // SÜREKLİ BAĞLANTIYI BAŞLAT
        startSuperConnection(client, channelId, token);
        
        resolve({
          botUsername: c.user.tag,
          connected: true,
          super_persistent: true
        });
      });

      client.on('error', (error) => {
        console.error('❌ Bot hatası:', error);
      });

      await client.login(token);
      
    } catch (error) {
      reject(new Error(`Bot başlatma hatası: ${error.message}`));
    }
  });
}

// SÜPER BAĞLANTI - ASLA DÜŞMEZ
async function startSuperConnection(client, channelId, token) {
  let connectionAttempts = 0;
  const MAX_ATTEMPTS = 1000; // ÇOK YÜKSEK SAYI
  
  const superLoop = async () => {
    try {
      connectionAttempts++;
      console.log(`🔄 Bağlantı denemesi: ${connectionAttempts}`);
      
      // Kanalı al
      const channel = await client.channels.fetch(channelId);
      
      if (!channel || channel.type !== 2) {
        console.log('⏳ Kanal bekleniyor...');
        setTimeout(superLoop, 2000); // 2 saniye
        return;
      }

      console.log(`🎵 Kanal bulundu: ${channel.name}`);

      // SES BAĞLANTISI KUR
      const voiceConnection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true
      });

      console.log(`🔗 BOT KANALDA!: ${channel.name}`);

      // BAĞLANTI EVENT'LERİ
      voiceConnection.on('stateChange', (oldState, newState) => {
        console.log(`🔊 Durum: ${oldState.status} -> ${newState.status}`);
        
        // EĞER BAĞLANTI KOPARSA HEMEN YENİDEN BAĞLAN!
        if (newState.status === 'disconnected') {
          console.log('🚨 BAĞLANTI KOPTU! HEMEN YENİDEN BAĞLANIYOR...');
          
          // Hemen yok et ve yeniden başlat
          setTimeout(() => {
            voiceConnection.destroy();
            superLoop(); // Hemen yeniden başlat
          }, 500); // 0.5 SANİYE!
        }
      });

      voiceConnection.on('error', (error) => {
        console.error('❌ Bağlantı hatası:', error);
        
        // HATA OLURSA HEMEN YENİDEN DENE
        setTimeout(() => {
          voiceConnection.destroy();
          superLoop();
        }, 1000);
      });

      // AKTİF BOTLARA KAYDET
      activeBots.set(token, {
        client: client,
        voiceConnection: voiceConnection,
        channel: channel,
        connectedAt: new Date(),
        connectionAttempts: connectionAttempts
      });

      // HER 10 SANİYEDE BİR BAĞLANTIYI KONTROL ET
      const healthCheck = setInterval(() => {
        if (voiceConnection.state.status === 'disconnected') {
          console.log('🚨 SAĞLIK KONTROLÜ: Bağlantı kopmuş! Yeniden bağlanılıyor...');
          clearInterval(healthCheck);
          voiceConnection.destroy();
          superLoop();
        } else {
          console.log('💚 Sağlık kontrolü: Bot hala kanalda!');
        }
      }, 10000); // 10 saniye

    } catch (error) {
      console.error('❌ Süper döngü hatası:', error);
      
      // HATA OLURSA 3 SANİYE SONRA TEKRAR DENE
      setTimeout(() => {
        superLoop();
      }, 3000);
    }
  };

  // SÜPER DÖNGÜYÜ BAŞLAT
  console.log('🚀 SÜPER BAĞLANTI DÖNGÜSÜ BAŞLATILDI!');
  superLoop();
}

// SÜREKLİ PİNG SİSTEMİ
setInterval(() => {
  activeBots.forEach((bot, token) => {
    if (bot.voiceConnection) {
      const status = bot.voiceConnection.state.status;
      console.log(`🏓 PING: ${bot.client.user?.tag} - Durum: ${status}`);
      
      if (status === 'disconnected') {
        console.log(`🚨 ${bot.client.user?.tag} DÜŞTÜ! Yeniden bağlanılıyor...`);
        bot.voiceConnection.destroy();
        startSuperConnection(bot.client, bot.channel.id, token);
      }
    }
  });
}, 15000); // 15 saniye