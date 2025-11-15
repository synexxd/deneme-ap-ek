// api/discord.js - Self Token Fix
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';

// Global state for Vercel
if (!global.activeBots) {
  global.activeBots = new Map();
}

const activeBots = global.activeBots;
const MAX_BOT_LIFETIME = 55 * 60 * 1000;
const CHECK_INTERVAL = 30000;
const RECONNECT_DELAY = 10000;

// Bot temizleme
function cleanupBot(token) {
  if (activeBots.has(token)) {
    const bot = activeBots.get(token);
    console.log(`🧹 Bot temizleniyor: ${maskToken(token)}`);
    
    if (bot.checkInterval) clearInterval(bot.checkInterval);
    if (bot.reconnectTimeout) clearTimeout(bot.reconnectTimeout);
    if (bot.cleanupTimeout) clearTimeout(bot.cleanupTimeout);
    
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
  return `${token.substring(0, 10)}...${token.substring(token.length - 5)}`;
}

// Token tipi kontrolü (geliştirilmiş)
function isSelfToken(token) {
  if (!token || typeof token !== 'string') return false;
  
  // Bot token: MTExxxx.x.x (3 parça, base64 format)
  // Self token: genellikle tek parça ve daha uzun
  const parts = token.split('.');
  
  if (parts.length === 3) {
    try {
      // İlk parçayı base64 decode etmeye çalış
      const firstPart = Buffer.from(parts[0], 'base64').toString();
      // Bot token'ın ilk parçası genellikle sayısal ID içerir
      return !/^\d+$/.test(firstPart);
    } catch {
      return true; // Base64 decode edilemezse self token
    }
  }
  
  return true; // 3 parça değilse self token
}

// Self Token için özel client oluşturma
function createClientForToken(token) {
  const isSelf = isSelfToken(token);
  
  console.log(`🔧 ${isSelf ? 'SELF TOKEN' : 'BOT TOKEN'} için client oluşturuluyor`);
  
  const baseOptions = {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    rest: {
      timeout: 20000,
      retries: 3,
    },
    ws: {
      large_threshold: 100,
      compress: false,
    }
  };

  // Self token için özel ayarlar
  if (isSelf) {
    return new Client({
      ...baseOptions,
      // Self token için ek optimizasyonlar
      makeCache: true,
      partials: [],
      presence: {
        status: 'online',
        activities: [{
          name: 'Voice Channel',
          type: 2 // Listening
        }]
      }
    });
  }
  
  // Bot token için standart ayarlar
  return new Client(baseOptions);
}

// Self token login işlemi
async function loginWithToken(client, token) {
  const isSelf = isSelfToken(token);
  
  if (isSelf) {
    console.log(`🔐 Self token ile giriş yapılıyor...`);
    
    try {
      // Discord.js'nin user token login'i için workaround
      // Token'ı direkt REST manager'a set et
      client.rest.setToken(token);
      
      // WebSocket bağlantısını manual başlat
      await client.login(token).catch(async (error) => {
        console.log(`⚠️  İlk login denemesi başarısız, alternatif yöntem deneniyor...`);
        
        // Alternatif yöntem - token'ı farklı şekilde kullan
        await alternativeLogin(client, token);
      });
      
      return true;
    } catch (error) {
      console.error(`❌ Self token login hatası:`, error.message);
      throw new Error(`Self token authentication failed: ${error.message}`);
    }
  } else {
    // Bot token normal login
    return client.login(token);
  }
}

// Alternatif login yöntemi
async function alternativeLogin(client, token) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Alternatif login yöntemi deneniyor...`);
    
    // Client'ı manual olarak hazırla
    client.token = token;
    
    // WebSocket bağlantısını başlat
    client.ws.connect()
      .then(() => {
        console.log(`✅ Alternatif login başarılı`);
        resolve(true);
      })
      .catch(error => {
        console.error(`❌ Alternatif login başarısız:`, error.message);
        reject(error);
      });
  });
}

// Bot başlatma
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    const isSelf = isSelfToken(token);
    let client;

    try {
      console.log(`🚀 ${isSelf ? 'SELF TOKEN' : 'BOT'} başlatılıyor...`);
      
      // Token için uygun client oluştur
      client = createClientForToken(token);

      // Ready event
      client.once('ready', async (c) => {
        console.log(`✅ ${isSelf ? 'SELF TOKEN' : 'BOT'} HAZIR: ${c.user.tag} (${c.user.id})`);
        
        try {
          // Ses kanalına bağlan
          const voiceConnection = await connectToVoice(client, channelId);
          
          if (!voiceConnection) {
            reject(new Error('Ses kanalına bağlanılamadı'));
            return;
          }

          // Kontrol mekanizması
          const checkInterval = setInterval(() => {
            checkAndReconnect(client, channelId, token).catch(console.error);
          }, CHECK_INTERVAL);

          // Otomatik temizlik
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

      // Error handling
      client.on('error', (error) => {
        console.error(`❌ ${isSelf ? 'Self Token' : 'Bot'} hatası:`, error.message);
      });

      // Debug info
      client.on('debug', (info) => {
        if (info.includes('Authentication') || info.includes('VOICE_')) {
          console.log(`🔍 ${maskToken(token)}:`, info.substring(0, 100));
        }
      });

      // Invalid session handling (self token için önemli)
      client.on('invalidated', () => {
        console.log(`🔄 Session invalidated: ${maskToken(token)}`);
        if (isSelf) {
          setTimeout(() => {
            cleanupBot(token);
            startBot(token, channelId).catch(console.error);
          }, 5000);
        }
      });

      // Login işlemi
      await loginWithToken(client, token);

    } catch (error) {
      console.error(`💥 Başlatma hatası (${maskToken(token)}):`, error.message);
      
      if (client && !client.destroyed) {
        client.destroy().catch(() => {});
      }
      
      reject(error);
    }
  });
}

// Ses bağlantısı
async function connectToVoice(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error('Kanal bulunamadı');
    }

    if (channel.type !== 2) {
      throw new Error('Ses kanalı değil');
    }

    console.log(`🎵 Bağlanılıyor: ${channel.name} (${channel.guild.name})`);
    
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
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const oldConnection = getVoiceConnection(guild.id);
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
      console.log(`🚨 ${maskToken(token)} seste değil, yeniden bağlanılıyor...`);
      await reconnectVoice(client, channelId);
    }
    
  } catch (error) {
    console.error('Kontrol hatası:', error);
  }
}

// API Handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let tokens = [];
    let channelId;

    // Request parsing
    if (req.method === 'GET') {
      const { token, tokens: tokensParam, channel_id } = req.query;
      tokens = tokensParam ? 
        tokensParam.split(',').map(t => t.trim()).filter(Boolean) 
        : [token].filter(Boolean);
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

    if (!channelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Channel ID gereklidir'
      });
    }

    console.log(`🤖 ${tokens.length} token işleniyor...`);

    const results = [];
    const errors = [];

    // Token'ları işle
    for (const token of tokens) {
      try {
        const isSelf = isSelfToken(token);
        console.log(`🔍 Token tipi: ${isSelf ? 'SELF' : 'BOT'} - ${maskToken(token)}`);

        // Mevcut bot varsa temizle
        if (activeBots.has(token)) {
          cleanupBot(token);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Yeni bot başlat
        const result = await startBot(token, channelId);
        
        results.push({
          token: maskToken(token),
          token_type: isSelf ? 'self_token' : 'bot_token',
          status: 'success',
          bot_username: result.botUsername,
          user_id: result.userId,
          connected: true
        });

        console.log(`✅ ${isSelf ? 'SELF TOKEN' : 'BOT'} başlatıldı: ${result.botUsername}`);

      } catch (error) {
        const isSelf = isSelfToken(token);
        errors.push({
          token: maskToken(token),
          token_type: isSelf ? 'self_token' : 'bot_token',
          status: 'error',
          message: error.message
        });
        
        console.error(`❌ ${isSelf ? 'SELF TOKEN' : 'BOT'} hatası:`, error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Response
    return res.status(200).json({
      status: 'completed',
      total_tokens: tokens.length,
      successful: results.length,
      failed: errors.length,
      token_types: {
        self_tokens: tokens.filter(t => isSelfToken(t)).length,
        bot_tokens: tokens.filter(t => !isSelfToken(t)).length
      },
      results,
      errors,
      message: `${results.length} token başarıyla aktif edildi!`,
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

// Cleanup on SIGTERM
process.on('SIGTERM', () => {
  console.log('🔚 Cleaning up...');
  activeBots.forEach((bot, token) => {
    cleanupBot(token);
  });
});