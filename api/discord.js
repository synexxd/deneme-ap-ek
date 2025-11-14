// api/discord.js - 1 SANİYELİK KONTROL SİSTEMİ
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';

// Aktif botlar
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

    console.log(`🤖 BOT AKTİF EDİLİYOR: ${channelId}`);

    // Eski bot varsa temizle
    if (activeBots.has(token)) {
      const oldBot = activeBots.get(token);
      if (oldBot.voiceConnection) oldBot.voiceConnection.destroy();
      if (oldBot.client) oldBot.client.destroy();
      clearInterval(oldBot.checkInterval);
      activeBots.delete(token);
    }

    // YENİ BOTU BAŞLAT
    const result = await startUltraBot(token, channelId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      bot_username: result.botUsername,
      connected: true,
      message: 'Bot aktif! 1 SANİYEDE BİR kontrol edilecek! ⚡',
      check_interval: '1 second',
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

// ULTRA BOT - 1 SANİYELİK KONTROL
async function startUltraBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      let voiceConnection = null;
      let checkInterval = null;

      // BOT HAZIR OLUNCA
      client.once('ready', async (c) => {
        console.log(`✅ BOT HAZIR: ${c.user.tag}`);
        
        // İLK BAĞLANTIYI KUR
        await connectToVoice(client, channelId);
        
        // 1 SANİYELİK KONTROL DÖNGÜSÜNÜ BAŞLAT
        checkInterval = setInterval(async () => {
          await checkAndReconnect(client, channelId, token);
        }, 1000); // 1 SANİYE!
        
        // AKTİF BOTLARA KAYDET
        activeBots.set(token, {
          client: client,
          voiceConnection: voiceConnection,
          channelId: channelId,
          checkInterval: checkInterval,
          connectedAt: new Date()
        });

        resolve({
          botUsername: c.user.tag,
          connected: true
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

// SES KANALINA BAĞLAN
async function connectToVoice(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel || channel.type !== 2) {
      console.log('❌ Kanal bulunamadı veya ses kanalı değil');
      return false;
    }

    console.log(`🎵 Kanala bağlanılıyor: ${channel.name}`);
    
    const voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    console.log(`✅ Bağlantı kuruldu: ${channel.name}`);
    return voiceConnection;
    
  } catch (error) {
    console.error('❌ Bağlantı hatası:', error);
    return false;
  }
}

// KONTROL ET VE YENİDEN BAĞLAN
async function checkAndReconnect(client, channelId, token) {
  try {
    // Kanalı al
    const channel = await client.channels.fetch(channelId);
    
    if (!channel || channel.type !== 2) {
      console.log('❌ Kanal geçersiz');
      return;
    }

    // Botun ses durumunu kontrol et
    const guild = channel.guild;
    const voiceStates = guild.voiceStates.cache;
    const botVoiceState = voiceStates.get(client.user.id);
    
    // BOT SESTE Mİ? 🤔
    const isInVoice = botVoiceState && botVoiceState.channelId === channelId;
    
    if (!isInVoice) {
      console.log('🚨 BOT SESTE DEĞİL! HEMEN BAĞLANIYOR...');
      
      // Eski bağlantıyı temizle
      const oldConnection = getVoiceConnection(guild.id);
      if (oldConnection) {
        oldConnection.destroy();
      }
      
      // HEMEN YENİDEN BAĞLAN
      await connectToVoice(client, channelId);
      
    } else {
      // Bot seste - her 10 kontrolde bir logla (spam önlemek için)
      if (Math.random() < 0.1) { // %10 ihtimal
        console.log('✅ Bot hala seste!');
      }
    }
    
  } catch (error) {
    console.error('❌ Kontrol hatası:', error);
    
    // Hata olursa yeniden bağlanmayı dene
    setTimeout(async () => {
      await connectToVoice(client, channelId);
    }, 1000);
  }
}

// TÜM BOTLARI KONTROL ET (ek güvenlik)
setInterval(() => {
  activeBots.forEach(async (bot, token) => {
    if (bot.client && bot.channelId) {
      try {
        await checkAndReconnect(bot.client, bot.channelId, token);
      } catch (error) {
        console.error(`Bot kontrol hatası (${token.substring(0, 10)}...):`, error);
      }
    }
  });
}, 5000); // 5 saniyede bir tüm botları kontrol et