// api/discord.js - SELF TOKEN FIX SİSTEMİ
import { Client, GatewayIntentBits, OAuth2Scopes } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';

const activeBots = new Map();
const MAX_BOT_LIFETIME = 60 * 60 * 1000; // 1 saat
const CHECK_INTERVAL = 15000; // 15 saniye (self token için daha güvenli)
const RECONNECT_DELAY = 5000; // 5 saniye

// Bot temizleme fonksiyonu
function cleanupBot(token) {
  if (activeBots.has(token)) {
    const bot = activeBots.get(token);
    console.log(`🧹 Bot temizleniyor: ${maskToken(token)}`);
    
    if (bot.checkInterval) clearInterval(bot.checkInterval);
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

// Token maskeleme
function maskToken(token) {
  if (!token) return '???';
  return token.substring(0, 10) + '...' + token.substring(token.length - 5);
}

// Self token kontrolü (geliştirilmiş)
function isSelfToken(token) {
  if (!token || typeof token !== 'string') return false;
  
  // Bot token formatı: MTExxxx.x.x (3 parçalı base64)
  // Self token formatı: xxx (tek parça, genellikle daha uzun)
  const parts = token.split('.');
  
  if (parts.length === 3) {
    // Bot token kontrolü
    try {
      // İlk parça base64 mi kontrol et
      atob(parts[0]);
      return false; // Bot token
    } catch {
      return true; // Self token (base64 değil)
    }
  }
  
  return true; // Tek parça ise self token
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
}, 30000);

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
      tokens = req.query.tokens ? 
        (Array.isArray(req.query.tokens) ? req.query.tokens : req.query.tokens.split(',')) 
        : [req.query.token].filter(Boolean);
      channelId = req.query.channel_id;
    } else if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      tokens = body.tokens ? 
        (Array.isArray(body.tokens) ? body.tokens : body.tokens.split(',')) 
        : [body.token].filter(Boolean);
      channelId = body.channel_id;
    } else {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece GET ve POST methodu destekleniyor'
      });
    }

    // Tokenları temizle
    tokens = tokens
      .filter(token => token && typeof token === 'string')
      .map(token => token.trim())
      .filter(token => token.length > 0);

    if (tokens.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Geçerli bir token gereklidir'
      });
    }

    if (!channelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Ses kanalı ID gereklidir'
      });
    }

    console.log(`🤖 ${tokens.length} TOKEN AKTİF EDİLİYOR: ${channelId}`);
    console.log(`🔍 Token Tipleri: ${tokens.map(t => isSelfToken(t) ? 'Self' : 'Bot').join(', ')}`);

    const results = [];
    const errors = [];

    // Tokenları paralel işle
    await Promise.all(
      tokens.map(async (token) => {
        try {
          // Eski bot varsa temizle
          if (activeBots.has(token)) {
            cleanupBot(token);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          // Yeni botu başlat
          const result = await startBot(token, channelId);
          results.push({
            token: maskToken(token),
            token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
            status: 'success',
            bot_username: result.botUsername,
            user_id: result.userId,
            connected: true,
            session_id: result.sessionId
          });
          
          console.log(`✅ ${isSelfToken(token) ? 'SELF TOKEN' : 'BOT'} başlatıldı: ${result.botUsername}`);
          
        } catch (error) {
          errors.push({
            token: maskToken(token),
            token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
            status: 'error',
            message: error.message,
            error_code: error.code
          });
          console.error(`❌ Başlatma hatası (${maskToken(token)}):`, error.message);
        }
      })
    );

    // Sonuçları döndür
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

// SELF TOKEN ÖZEL BAŞLATMA FONKSİYONU
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    const isSelf = isSelfToken(token);
    let client;
    let checkInterval;

    try {
      // SELF TOKEN İÇİN ÖZEL AYARLAR
      if (isSelf) {
        client = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
          ],
          // Self token için kritik ayarlar
          rest: {
            timeout: 30000,
            retries: 5,
            offset: 50
          },
          ws: {
            large_threshold: 100,
            compress: true,
            properties: {
              $os: 'linux',
              $browser: 'discord',
              $device: 'discord'
            }
          },
          // User agent ayarı
          http: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
            }
          }
        });
      } else {
        // BOT TOKEN STANDART AYARLAR
        client = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates
          ]
        });
      }

      // BAĞLANTI EVENTLERİ
      client.once('ready', async (c) => {
        console.log(`✅ ${isSelf ? 'SELF TOKEN' : 'BOT'} HAZIR: ${c.user.tag} (${c.user.id})`);
        
        try {
          // Ses kanalına bağlan
          const voiceConnection = await connectToVoice(client, channelId);
          
          if (!voiceConnection) {
            reject(new Error('Ses kanalına bağlanılamadı'));
            return;
          }

          // Kontrol döngüsü
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
            botUsername: c.user.tag,
            userId: c.user.id,
            isSelfToken: isSelf
          });

          resolve({
            botUsername: c.user.tag,
            userId: c.user.id,
            sessionId: client.ws.sessionId || 'unknown',
            connected: true
          });

        } catch (error) {
          reject(error);
        }
      });

      // SELF TOKEN ÖZEL HATA YÖNETİMİ
      client.on('error', (error) => {
        console.error(`❌ ${isSelf ? 'Self Token' : 'Bot'} hatası (${maskToken(token)}):`, {
          message: error.message,
          code: error.code,
          stack: error.stack
        });

        // Self token için özel hata handling
        if (isSelf) {
          if (error.code === 'TOKEN_INVALID') {
            console.log(`🔑 Token invalid - yeniden deneniyor: ${maskToken(token)}`);
            setTimeout(() => {
              if (client && !client.destroyed) {
                client.destroy().catch(() => {});
                startBot(token, channelId).catch(reject);
              }
            }, 5000);
          }
        }
      });

      // RATE LIMIT HANDLING
      client.on('rateLimit', (info) => {
        console.log(`⏳ Rate limit: ${maskToken(token)} - ${info.timeout}ms bekle`);
      });

      // DEBUG EVENTLERİ
      client.on('debug', (info) => {
        if (info.includes('VOICE_STATE_UPDATE') || info.includes('SESSIONS_REPLACE')) {
          console.log(`🔍 ${isSelf ? 'Self' : 'Bot'} Debug:`, info.substring(0, 100));
        }
      });

      // SELF TOKEN İÇİN LOGIN
      if (isSelf) {
        console.log(`🔑 Self token ile giriş yapılıyor: ${maskToken(token)}`);
        
        // User token ile giriş (bot değil)
        await client.login(token).catch(async (error) => {
          console.error(`❌ Self token login hatası:`, error.message);
          
          // Token invalid hatası için özel mesaj
          if (error.message.includes('token') || error.code === 'TOKEN_INVALID') {
            reject(new Error(`Self token geçersiz: Token formatı veya yetkileri kontrol edin`));
          } else {
            reject(new Error(`Self token hatası: ${error.message}`));
          }
        });
      } else {
        // BOT TOKEN İLE GİRİŞ
        await client.login(token).catch(reject);
      }

    } catch (error) {
      reject(new Error(`Başlatma hatası: ${error.message}`));
    }
  });
}

// SES BAĞLANTISI (Self Token Optimizasyonu)
async function connectToVoice(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error('Kanal bulunamadı');
    }

    if (channel.type !== 2) {
      throw new Error('Bu kanal bir ses kanalı değil');
    }

    console.log(`🎵 Kanala bağlanılıyor: ${channel.name} (${channel.guild.name})`);
    
    const voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
      debug: false
    });

    // Bağlantı eventleri
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

    return voiceConnection;
    
  } catch (error) {
    console.error('❌ Bağlantı hatası:', error);
    throw error;
  }
}

// KONTROL VE YENİDEN BAĞLANMA
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
      console.log('🚨 SESTE DEĞİL! YENİDEN BAĞLANIYOR...');
      
      const oldConnection = getVoiceConnection(guild.id);
      if (oldConnection) {
        oldConnection.destroy();
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      await connectToVoice(client, channelId);
    }
    
  } catch (error) {
    console.error('❌ Kontrol hatası:', error);
  }
}