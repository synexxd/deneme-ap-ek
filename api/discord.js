// api/discord.js - ÇOKLU TOKEN DESTEKLİ SİSTEM
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';

const activeBots = new Map();
const MAX_BOT_LIFETIME = 30 * 60 * 1000; // 30 dakika
const CHECK_INTERVAL = 5000; // 5 saniye
const RECONNECT_DELAY = 2000; // 2 saniye

// Bot temizleme fonksiyonu
function cleanupBot(token) {
  if (activeBots.has(token)) {
    const bot = activeBots.get(token);
    console.log(`🧹 Bot temizleniyor: ${token.substring(0, 10)}...`);
    
    if (bot.checkInterval) clearInterval(bot.checkInterval);
    if (bot.cleanupInterval) clearInterval(bot.cleanupInterval);
    
    try {
      if (bot.voiceConnection) {
        bot.voiceConnection.destroy();
      }
      if (bot.client && bot.client.isReady()) {
        bot.client.destroy();
      }
    } catch (error) {
      console.error('Temizleme hatası:', error);
    }
    
    activeBots.delete(token);
  }
}

// Düzenli temizlik
setInterval(() => {
  const now = Date.now();
  activeBots.forEach((bot, token) => {
    if (now - bot.connectedAt > MAX_BOT_LIFETIME) {
      console.log(`⏰ Bot zaman aşımı: ${token.substring(0, 10)}...`);
      cleanupBot(token);
    }
  });
}, 60000);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let tokens = [];
    let channelId;

    // Token ve channel_id'yi al
    if (req.method === 'GET') {
      tokens = req.query.tokens ? req.query.tokens.split(',') : [req.query.token];
      channelId = req.query.channel_id;
    } else if (req.method === 'POST') {
      tokens = req.body.tokens ? req.body.tokens.split(',') : [req.body.token];
      channelId = req.body.channel_id;
    } else {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece GET ve POST methodu destekleniyor'
      });
    }

    // Tokenları temizle (boşlukları kaldır)
    tokens = tokens.map(token => token.trim()).filter(token => token);

    if (!tokens || tokens.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'En az bir bot token gereklidir'
      });
    }

    if (!channelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Ses kanalı ID gereklidir'
      });
    }

    console.log(`🤖 ${tokens.length} BOT AKTİF EDİLİYOR: ${channelId}`);

    const results = [];
    const errors = [];

    // Tüm tokenlar için bot başlat
    for (const token of tokens) {
      try {
        // Eski bot varsa temizle
        if (activeBots.has(token)) {
          cleanupBot(token);
        }

        // Yeni botu başlat
        const result = await startBot(token, channelId);
        results.push({
          token: token.substring(0, 10) + '...', // Güvenlik için kısmi gösterim
          status: 'success',
          bot_username: result.botUsername,
          connected: true
        });
        
        console.log(`✅ Bot başlatıldı: ${result.botUsername}`);
        
      } catch (error) {
        errors.push({
          token: token.substring(0, 10) + '...',
          status: 'error',
          message: error.message
        });
        console.error(`❌ Bot hatası (${token.substring(0, 10)}...):`, error.message);
      }
    }

    // Başarılı ve başarısız sonuçları döndür
    res.status(200).json({
      status: 'completed',
      total_tokens: tokens.length,
      successful: results.length,
      failed: errors.length,
      results: results,
      errors: errors,
      message: `${results.length} bot başarıyla aktif edildi!`,
      check_interval: `${CHECK_INTERVAL/1000} saniye`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Genel hata:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// BOT BAŞLATMA FONKSİYONU
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      let checkInterval = null;

      // Bot hazır olunca
      client.once('ready', async (c) => {
        console.log(`✅ BOT HAZIR: ${c.user.tag}`);
        
        // İlk bağlantıyı kur
        const voiceConnection = await connectToVoice(client, channelId);
        
        if (!voiceConnection) {
          reject(new Error('Ses kanalına bağlanılamadı'));
          return;
        }

        // Kontrol döngüsünü başlat
        checkInterval = setInterval(async () => {
          await checkAndReconnect(client, channelId, token);
        }, CHECK_INTERVAL);

        // Aktif botlara kaydet
        activeBots.set(token, {
          client: client,
          voiceConnection: voiceConnection,
          channelId: channelId,
          checkInterval: checkInterval,
          connectedAt: new Date(),
          botUsername: c.user.tag
        });

        resolve({
          botUsername: c.user.tag,
          connected: true
        });
      });

      client.on('error', (error) => {
        console.error(`❌ Bot hatası (${token.substring(0, 10)}...):`, error);
      });

      // Token geçersizse hata ver
      client.on('invalidated', () => {
        reject(new Error('Token geçersiz veya bot yetkisi yok'));
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
      throw new Error('Kanal bulunamadı veya ses kanalı değil');
    }

    console.log(`🎵 Kanala bağlanılıyor: ${channel.name}`);
    
    const voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    // Bağlantı eventlerini dinle
    voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log('🔌 Ses bağlantısı kesildi, yeniden bağlanılıyor...');
      setTimeout(async () => {
        try {
          voiceConnection.destroy();
          await connectToVoice(client, channelId);
        } catch (error) {
          console.error('Yeniden bağlanma hatası:', error);
        }
      }, RECONNECT_DELAY);
    });

    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log('✅ Ses bağlantısı hazır');
    });

    return voiceConnection;
    
  } catch (error) {
    console.error('❌ Bağlantı hatası:', error);
    throw error;
  }
}

// KONTROL ET VE YENİDEN BAĞLAN
async function checkAndReconnect(client, channelId, token) {
  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel || channel.type !== 2) {
      console.log('❌ Kanal geçersiz');
      return;
    }

    const guild = channel.guild;
    const voiceStates = guild.voiceStates.cache;
    const botVoiceState = voiceStates.get(client.user.id);
    
    const isInVoice = botVoiceState && botVoiceState.channelId === channelId;
    
    if (!isInVoice) {
      console.log('🚨 BOT SESTE DEĞİL! YENİDEN BAĞLANIYOR...');
      
      const oldConnection = getVoiceConnection(guild.id);
      if (oldConnection) {
        oldConnection.destroy();
      }
      
      await connectToVoice(client, channelId);
    }
    
  } catch (error) {
    console.error('❌ Kontrol hatası:', error);
  }
}

// Aktif botları listeleme endpoint'i (opsiyonel)
export async function getActiveBots() {
  const bots = [];
  activeBots.forEach((bot, token) => {
    bots.push({
      token: token.substring(0, 10) + '...',
      username: bot.botUsername,
      channelId: bot.channelId,
      connectedAt: bot.connectedAt,
      uptime: Date.now() - bot.connectedAt
    });
  });
  return bots;
}