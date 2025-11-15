// api/discord.js - SELF TOKEN DESTEKLİ SİSTEM
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';

const activeBots = new Map();
const MAX_BOT_LIFETIME = 60 * 60 * 1000; // 1 saat (self token için daha uzun)
const CHECK_INTERVAL = 10000; // 10 saniye (self token için daha güvenli)
const RECONNECT_DELAY = 3000; // 3 saniye

// Bot temizleme fonksiyonu
function cleanupBot(token) {
  if (activeBots.has(token)) {
    const bot = activeBots.get(token);
    console.log(`🧹 Bot temizleniyor: ${maskToken(token)}`);
    
    if (bot.checkInterval) clearInterval(bot.checkInterval);
    if (bot.cleanupInterval) clearInterval(bot.cleanupInterval);
    if (bot.reconnectTimeout) clearTimeout(bot.reconnectTimeout);
    
    try {
      if (bot.voiceConnection) {
        bot.voiceConnection.destroy();
      }
      if (bot.client && !bot.client.destroyed) {
        bot.client.destroy();
      }
    } catch (error) {
      console.error('Temizleme hatası:', error);
    }
    
    activeBots.delete(token);
  }
}

// Token maskeleme fonksiyonu
function maskToken(token) {
  if (!token) return '???';
  if (token.length < 10) return token;
  return token.substring(0, 10) + '...' + token.substring(token.length - 5);
}

// Self token kontrolü
function isSelfToken(token) {
  // Self token'lar genellikle "user token" formatındadır
  // Bot token: MTExxxx.x.x (24 karakter base64)
  // User token: xxx (daha uzun ve farklı format)
  return token && !token.includes('.') && token.length > 30;
}

// Düzenli temizlik
setInterval(() => {
  const now = Date.now();
  activeBots.forEach((bot, token) => {
    if (now - bot.connectedAt > MAX_BOT_LIFETIME) {
      console.log(`⏰ Bot zaman aşımı: ${maskToken(token)}`);
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
      tokens = req.body.tokens ? 
        (Array.isArray(req.body.tokens) ? req.body.tokens : req.body.tokens.split(',')) 
        : [req.body.token];
      channelId = req.body.channel_id;
    } else {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece GET ve POST methodu destekleniyor'
      });
    }

    // Tokenları temizle ve filtrele
    tokens = tokens
      .filter(token => token && typeof token === 'string')
      .map(token => token.trim())
      .filter(token => token.length > 0);

    if (tokens.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Geçerli bir bot token gereklidir'
      });
    }

    if (!channelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Ses kanalı ID gereklidir'
      });
    }

    console.log(`🤖 ${tokens.length} BOT/SELF TOKEN AKTİF EDİLİYOR: ${channelId}`);

    const results = [];
    const errors = [];

    // Tüm tokenlar için paralel başlatma
    await Promise.allSettled(
      tokens.map(async (token) => {
        try {
          // Eski bot varsa temizle
          if (activeBots.has(token)) {
            cleanupBot(token);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1sn bekle
          }

          // Yeni botu başlat
          const result = await startBot(token, channelId);
          results.push({
            token: maskToken(token),
            token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
            status: 'success',
            bot_username: result.botUsername,
            user_id: result.userId,
            connected: true
          });
          
          console.log(`✅ ${isSelfToken(token) ? 'SELF TOKEN' : 'BOT'} başlatıldı: ${result.botUsername}`);
          
        } catch (error) {
          errors.push({
            token: maskToken(token),
            token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
            status: 'error',
            message: error.message
          });
          console.error(`❌ Başlatma hatası (${maskToken(token)}):`, error.message);
        }
      })
    );

    // Başarılı ve başarısız sonuçları döndür
    res.status(200).json({
      status: 'completed',
      total_tokens: tokens.length,
      successful: results.length,
      failed: errors.length,
      token_types: {
        self_tokens: tokens.filter(t => isSelfToken(t)).length,
        bot_tokens: tokens.filter(t => !isSelfToken(t)).length
      },
      results: results,
      errors: errors,
      message: `${results.length} token başarıyla aktif edildi!`,
      check_interval: `${CHECK_INTERVAL/1000} saniye`,
      max_lifetime: `${MAX_BOT_LIFETIME/60000} dakika`,
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

// BOT BAŞLATMA FONKSİYONU (Self Token Desteği)
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates,
          // Self token için ek intent'ler
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ],
        // Self token optimizasyonları
        rest: {
          timeout: 30000,
          retries: 3
        },
        // Daha agresif heartbeat (self token için)
        ws: {
          large_threshold: 250,
          compress: false
        }
      });

      let checkInterval = null;
      let reconnectTimeout = null;
      let isReconnecting = false;

      // Bot hazır olunca
      client.once('ready', async (c) => {
        console.log(`✅ ${isSelfToken(token) ? 'SELF TOKEN' : 'BOT'} HAZIR: ${c.user.tag} (${c.user.id})`);
        
        try {
          // İlk bağlantıyı kur
          const voiceConnection = await connectToVoice(client, channelId);
          
          if (!voiceConnection) {
            reject(new Error('Ses kanalına bağlanılamadı'));
            return;
          }

          // Kontrol döngüsünü başlat
          checkInterval = setInterval(async () => {
            if (!isReconnecting) {
              await checkAndReconnect(client, channelId, token);
            }
          }, CHECK_INTERVAL);

          // Aktif botlara kaydet
          activeBots.set(token, {
            client: client,
            voiceConnection: voiceConnection,
            channelId: channelId,
            checkInterval: checkInterval,
            reconnectTimeout: reconnectTimeout,
            connectedAt: new Date(),
            botUsername: c.user.tag,
            userId: c.user.id,
            isSelfToken: isSelfToken(token)
          });

          resolve({
            botUsername: c.user.tag,
            userId: c.user.id,
            connected: true
          });
        } catch (error) {
          reject(error);
        }
      });

      // Self token için özel hata yönetimi
      client.on('error', (error) => {
        console.error(`❌ ${isSelfToken(token) ? 'Self Token' : 'Bot'} hatası (${maskToken(token)}):`, error);
        
        // Rate limit hatasıysa bekleyip yeniden dene
        if (error.code === 429 || error.message.includes('rate limited')) {
          console.log(`⏳ Rate limit, 10 saniye bekleniyor...`);
          setTimeout(() => {
            if (client && !client.destroyed) {
              client.destroy().catch(() => {});
              startBot(token, channelId).catch(() => {});
            }
          }, 10000);
        }
      });

      // Invalid session (self token için sık görülür)
      client.on('invalidated', () => {
        console.log(`🔁 Session invalidated: ${maskToken(token)}`);
        if (client && !client.destroyed) {
          client.destroy().catch(() => {});
          setTimeout(() => {
            startBot(token, channelId).catch(() => {});
          }, 5000);
        }
      });

      // WebSocket bağlantı sorunları
      client.on('shardDisconnect', (event, shardId) => {
        console.log(`🔌 Shard disconnected (${maskToken(token)}):`, event);
      });

      client.on('shardReconnecting', (shardId) => {
        console.log(`🔄 Shard reconnecting (${maskToken(token)})`);
      });

      // Token geçersizse
      client.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${maskToken(token)}`);
      });

      await client.login(token).catch(reject);
      
    } catch (error) {
      reject(new Error(`Başlatma hatası: ${error.message}`));
    }
  });
}

// SES KANALINA BAĞLAN (Self Token Optimizasyonu)
async function connectToVoice(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    
    if (!channel) {
      throw new Error('Kanal bulunamadı');
    }

    if (channel.type !== 2) {
      throw new Error('Bu kanal bir ses kanalı değil');
    }

    // Kanal erişim kontrolü
    const permissions = channel.permissionsFor(client.user);
    if (!permissions) {
      throw new Error('Kanal erişim izni yok');
    }

    if (!permissions.has('Connect')) {
      throw new Error('Kanala bağlanma izni yok');
    }

    if (!permissions.has('Speak')) {
      console.log('⚠️  Mikrofon izni yok (sadece bağlanma)');
    }

    console.log(`🎵 Kanala bağlanılıyor: ${channel.name} (${channel.guild.name})`);
    
    const voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true, // Self token için mute önemli
      debug: false
    });

    // Bağlantı eventlerini dinle
    voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log('🔌 Ses bağlantısı kesildi, yeniden bağlanılıyor...');
      try {
        voiceConnection.destroy();
        await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
        await connectToVoice(client, channelId);
      } catch (error) {
        console.error('Yeniden bağlanma hatası:', error);
      }
    });

    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log('✅ Ses bağlantısı hazır');
    });

    voiceConnection.on(VoiceConnectionStatus.Signalling, () => {
      console.log('📞 Ses sinyalileşmesi başladı');
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
    const channel = await client.channels.fetch(channelId).catch(() => null);
    
    if (!channel || channel.type !== 2) {
      console.log('❌ Kanal geçersiz veya silinmiş');
      return;
    }

    const guild = channel.guild;
    const voiceStates = guild.voiceStates.cache;
    const botVoiceState = voiceStates.get(client.user.id);
    
    const isInVoice = botVoiceState && botVoiceState.channelId === channelId;
    
    if (!isInVoice) {
      console.log('🚨 SESTE DEĞİL! YENİDEN BAĞLANIYOR...');
      
      const oldConnection = getVoiceConnection(guild.id);
      if (oldConnection) {
        oldConnection.destroy();
      }
      
      // Yeniden bağlanmadan önce kısa bekle
      await new Promise(resolve => setTimeout(resolve, 1000));
      await connectToVoice(client, channelId);
    }
    
  } catch (error) {
    console.error('❌ Kontrol hatası:', error);
  }
}

// Aktif tokenları listeleme endpoint'i
export async function getActiveBots() {
  const bots = [];
  activeBots.forEach((bot, token) => {
    bots.push({
      token: maskToken(token),
      username: bot.botUsername,
      user_id: bot.userId,
      channelId: bot.channelId,
      token_type: bot.isSelfToken ? 'self_token' : 'bot_token',
      connectedAt: bot.connectedAt,
      uptime: Date.now() - bot.connectedAt
    });
  });
  return bots;
}