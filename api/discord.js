// api/discord.js - Vercel Optimized
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';

// Vercel serverless ortamında global state dikkatli kullanılmalı
if (!global.activeBots) {
  global.activeBots = new Map();
}

const activeBots = global.activeBots;
const MAX_BOT_LIFETIME = 55 * 60 * 1000; // 55 dakika (Vercel timeout'dan önce)
const CHECK_INTERVAL = 30000; // 30 saniye (Vercel için güvenli)
const RECONNECT_DELAY = 10000; // 10 saniye

// Bot temizleme fonksiyonu
function cleanupBot(token) {
  if (activeBots.has(token)) {
    const bot = activeBots.get(token);
    console.log(`🧹 Bot temizleniyor: ${maskToken(token)}`);
    
    // Interval'leri temizle
    if (bot.checkInterval) {
      clearInterval(bot.checkInterval);
    }
    if (bot.reconnectTimeout) {
      clearTimeout(bot.reconnectTimeout);
    }
    if (bot.cleanupTimeout) {
      clearTimeout(bot.cleanupTimeout);
    }
    
    // Bağlantıları destroy et
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
  if (!token || typeof token !== 'string') return '???';
  if (token.length <= 15) return token;
  return `${token.substring(0, 10)}...${token.substring(token.length - 5)}`;
}

// Token tipi kontrolü
function isSelfToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length !== 3; // Bot token 3 parça, self token tek parça
}

// Vercel için optimized başlatma
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    const isSelf = isSelfToken(token);
    let client;

    try {
      // Client configuration
      const clientOptions = {
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates,
          ...(isSelf ? [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] : [])
        ],
        // Vercel için optimize edilmiş ayarlar
        rest: {
          timeout: 10000,
          retries: 2,
        },
        ws: {
          large_threshold: 50,
          compress: true,
        }
      };

      client = new Client(clientOptions);

      // Ready event - Vercel'de hızlı bağlantı için
      client.once('ready', async (c) => {
        console.log(`✅ ${isSelf ? 'SELF' : 'BOT'} HAZIR: ${c.user.tag}`);
        
        try {
          // Hızlı bağlantı kur
          const voiceConnection = await connectToVoice(client, channelId);
          
          if (!voiceConnection) {
            reject(new Error('Ses kanalına bağlanılamadı'));
            return;
          }

          // Kontrol mekanizması - Vercel için daha uzun aralıklarla
          const checkInterval = setInterval(() => {
            checkAndReconnect(client, channelId, token).catch(console.error);
          }, CHECK_INTERVAL);

          // Otomatik temizlik timeout'u
          const cleanupTimeout = setTimeout(() => {
            console.log(`⏰ Otomatik temizlik: ${maskToken(token)}`);
            cleanupBot(token);
          }, MAX_BOT_LIFETIME);

          // State'i kaydet
          activeBots.set(token, {
            client,
            voiceConnection,
            channelId,
            checkInterval,
            cleanupTimeout,
            connectedAt: Date.now(),
            botUsername: c.user.tag,
            userId: c.user.id,
            isSelfToken: isSelf
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

      // Error handling - Vercel için daha az agresif
      client.on('error', (error) => {
        console.error(`❌ Client error (${maskToken(token)}):`, error.message);
      });

      // Debug - Vercel'de sadece önemli loglar
      client.on('debug', (info) => {
        if (info.includes('VOICE_') || info.includes('Session')) {
          console.log(`🔍 Debug (${maskToken(token)}):`, info.substring(0, 100));
        }
      });

      // Login işlemi
      await client.login(token);

    } catch (error) {
      // Client'ı temizle
      if (client && !client.destroyed) {
        client.destroy().catch(() => {});
      }
      reject(new Error(`Login failed: ${error.message}`));
    }
  });
}

// Ses bağlantısı - Vercel optimized
async function connectToVoice(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error('Kanal bulunamadı');
    }

    if (channel.type !== 2) {
      throw new Error('Ses kanalı değil');
    }

    // İzin kontrolü
    const permissions = channel.permissionsFor(client.user);
    if (!permissions?.has('Connect')) {
      throw new Error('Kanala bağlanma izni yok');
    }

    console.log(`🎵 Bağlanılıyor: ${channel.name}`);
    
    const voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    // Bağlantı event'leri
    voiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('🔌 Ses bağlantısı kesildi');
      setTimeout(() => {
        reconnectVoice(client, channelId).catch(console.error);
      }, RECONNECT_DELAY);
    });

    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log('✅ Ses bağlantısı hazır');
    });

    return voiceConnection;
    
  } catch (error) {
    console.error('❌ Bağlantı hatası:', error.message);
    throw error;
  }
}

// Yeniden bağlanma
async function reconnectVoice(client, channelId) {
  try {
    const oldConnection = getVoiceConnection(client.guilds.cache.first()?.id);
    if (oldConnection) {
      oldConnection.destroy();
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await connectToVoice(client, channelId);
  } catch (error) {
    console.error('Yeniden bağlanma hatası:', error);
  }
}

// Kontrol ve yeniden bağlanma
async function checkAndReconnect(client, channelId, token) {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const voiceStates = channel.guild.voiceStates.cache;
    const botVoiceState = voiceStates.get(client.user.id);
    
    const isInVoice = botVoiceState?.channelId === channelId;
    
    if (!isInVoice) {
      console.log('🚨 Yeniden bağlanılıyor...');
      await reconnectVoice(client, channelId);
    }
    
  } catch (error) {
    console.error('Kontrol hatası:', error);
  }
}

// Vercel serverless handler
export default async function handler(req, res) {
  // CORS headers - Vercel için
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS isteği
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Sadece GET ve POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed'
    });
  }

  try {
    // Request parsing
    let tokens = [];
    let channelId;

    if (req.method === 'GET') {
      const { token, tokens: tokensParam, channel_id } = req.query;
      tokens = tokensParam ? tokensParam.split(',').map(t => t.trim()) : [token].filter(Boolean);
      channelId = channel_id;
    } else {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { token, tokens: tokensParam, channel_id } = body;
      tokens = tokensParam ? 
        (Array.isArray(tokensParam) ? tokensParam : tokensParam.split(',').map(t => t.trim())) 
        : [token].filter(Boolean);
      channelId = channel_id;
    }

    // Validation
    tokens = tokens.filter(token => token && typeof token === 'string' && token.length > 10);
    
    if (tokens.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Geçerli token gereklidir'
      });
    }

    if (!channelId || typeof channelId !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Geçerli channel_id gereklidir'
      });
    }

    console.log(`🚀 ${tokens.length} token işleniyor...`);

    const results = [];
    const errors = [];

    // Token'ları sırayla işle (Vercel concurrency limiti için)
    for (const token of tokens) {
      try {
        // Mevcut bot varsa temizle
        if (activeBots.has(token)) {
          cleanupBot(token);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Yeni bot başlat
        const result = await startBot(token, channelId);
        results.push({
          token: maskToken(token),
          token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
          status: 'success',
          bot_username: result.botUsername,
          user_id: result.userId,
          connected: true
        });

        console.log(`✅ Başarılı: ${result.botUsername}`);

      } catch (error) {
        errors.push({
          token: maskToken(token),
          token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
          status: 'error',
          message: error.message
        });
        console.error(`❌ Hata: ${error.message}`);
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Response - Vercel için optimized
    return res.status(200).json({
      status: 'completed',
      environment: 'vercel',
      total_tokens: tokens.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      check_interval: `${CHECK_INTERVAL / 1000}s`,
      max_lifetime: `${MAX_BOT_LIFETIME / 60000}m`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Vercel fonksiyon timeout'u için cleanup
process.on('SIGTERM', () => {
  console.log('🔚 SIGTERM received, cleaning up...');
  activeBots.forEach((bot, token) => {
    cleanupBot(token);
  });
});

// Health check endpoint (opsiyonel)
export async function getStatus() {
  const bots = [];
  activeBots.forEach((bot, token) => {
    bots.push({
      token: maskToken(token),
      username: bot.botUsername,
      channelId: bot.channelId,
      connectedAt: new Date(bot.connectedAt).toISOString(),
      uptime: Date.now() - bot.connectedAt
    });
  });
  
  return {
    status: 'ok',
    active_bots: bots.length,
    bots,
    timestamp: new Date().toISOString()
  };
}