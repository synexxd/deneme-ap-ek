// api/discord.js - Çoklu Token Fix
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

// Token tipi kontrolü
function isSelfToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length !== 3;
}

// Client oluşturma
function createClient(token) {
  const isSelf = isSelfToken(token);
  
  const clientOptions = {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    rest: {
      timeout: 30000,
      retries: 2,
    },
    ws: {
      large_threshold: 100,
      compress: false,
    }
  };

  return new Client(clientOptions);
}

// Bot başlatma - Geliştirilmiş
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    const isSelf = isSelfToken(token);
    let client;

    try {
      console.log(`🚀 ${isSelf ? 'SELF TOKEN' : 'BOT'} başlatılıyor: ${maskToken(token)}`);
      
      client = createClient(token);

      // Ready event
      client.once('ready', async (c) => {
        console.log(`✅ ${isSelf ? 'SELF TOKEN' : 'BOT'} HAZIR: ${c.user.tag}`);
        
        try {
          const voiceConnection = await connectToVoice(client, channelId);
          
          if (!voiceConnection) {
            reject(new Error('Ses kanalına bağlanılamadı'));
            return;
          }

          const checkInterval = setInterval(() => {
            checkAndReconnect(client, channelId, token).catch(console.error);
          }, CHECK_INTERVAL);

          const cleanupTimeout = setTimeout(() => {
            console.log(`⏰ Otomatik temizlik: ${maskToken(token)}`);
            cleanupBot(token);
          }, MAX_BOT_LIFETIME);

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

      // Debug
      client.on('debug', (info) => {
        if (info.includes('Authenticated') || info.includes('VOICE_')) {
          console.log(`🔍 ${maskToken(token)}:`, info.substring(0, 80));
        }
      });

      // Rate limit handling
      client.on('rateLimit', (info) => {
        console.log(`⏳ Rate limit: ${maskToken(token)} - ${info.timeout}ms`);
      });

      // Login
      await client.login(token);

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

    console.log(`🎵 ${client.user.tag} bağlanıyor: ${channel.name}`);
    
    const voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    voiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log(`🔌 ${client.user.tag} ses bağlantısı kesildi`);
      setTimeout(() => {
        reconnectVoice(client, channelId).catch(console.error);
      }, RECONNECT_DELAY);
    });

    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`✅ ${client.user.tag} ses bağlantısı hazır`);
    });

    return voiceConnection;
    
  } catch (error) {
    console.error(`❌ ${client.user?.tag || 'Unknown'} bağlantı hatası:`, error.message);
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

// Kontrol
async function checkAndReconnect(client, channelId, token) {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const voiceStates = channel.guild.voiceStates.cache;
    const botVoiceState = voiceStates.get(client.user.id);
    
    const isInVoice = botVoiceState?.channelId === channelId;
    
    if (!isInVoice) {
      console.log(`🚨 ${client.user.tag} seste değil, yeniden bağlanılıyor...`);
      await reconnectVoice(client, channelId);
    }
    
  } catch (error) {
    console.error('Kontrol hatası:', error);
  }
}

// Çoklu token işleme - SEQUENTIAL (Sıralı)
async function processMultipleTokensSequentially(tokens, channelId) {
  const results = [];
  const errors = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isSelf = isSelfToken(token);
    
    try {
      console.log(`\n🔧 [${i + 1}/${tokens.length}] ${isSelf ? 'SELF TOKEN' : 'BOT'} işleniyor...`);
      
      // Mevcut bot varsa temizle
      if (activeBots.has(token)) {
        cleanupBot(token);
        await new Promise(resolve => setTimeout(resolve, 2000));
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

      console.log(`✅ [${i + 1}/${tokens.length}] ${isSelf ? 'SELF TOKEN' : 'BOT'} başarılı: ${result.botUsername}`);

      // Her bot arasında 3 saniye bekle (rate limit önlemi)
      if (i < tokens.length - 1) {
        console.log(`⏳ ${3 - (i % 3)} saniye sonra diğer token başlatılacak...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      errors.push({
        token: maskToken(token),
        token_type: isSelf ? 'self_token' : 'bot_token',
        status: 'error',
        message: error.message
      });
      
      console.error(`❌ [${i + 1}/${tokens.length}] ${isSelf ? 'SELF TOKEN' : 'BOT'} hatası:`, error.message);
      
      // Hata olsa bile diğer token'ları denemeye devam et
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return { results, errors };
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

    // REQUEST PARSING
    if (req.method === 'GET') {
      const { token, tokens: tokensParam, channel_id } = req.query;
      
      if (tokensParam) {
        tokens = Array.isArray(tokensParam) ? tokensParam : tokensParam.split(',');
      } else if (token) {
        tokens = Array.isArray(token) ? token : [token];
      }
      
      channelId = channel_id;
      
    } else if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { token, tokens: tokensParam, channel_id } = body;
      
      if (tokensParam) {
        tokens = Array.isArray(tokensParam) ? tokensParam : tokensParam.split(',');
      } else if (token) {
        tokens = Array.isArray(token) ? token : [token];
      }
      
      channelId = channel_id;
    }

    // TOKEN VALIDATION
    tokens = tokens
      .filter(token => token && typeof token === 'string')
      .map(token => token.trim())
      .filter(token => token.length > 10);

    console.log('🔍 Alınan tokenlar:', tokens.map(t => maskToken(t)));

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

    console.log(`🤖 ${tokens.length} TOKEN SIRALI BAŞLATILIYOR...`);
    console.log(`📊 Token Dağılımı: ${tokens.filter(t => isSelfToken(t)).length} Self, ${tokens.filter(t => !isSelfToken(t)).length} Bot`);

    // ÇOKLU TOKEN İŞLEME - SEQUENTIAL
    const { results, errors } = await processMultipleTokensSequentially(tokens, channelId);

    // RESPONSE
    return res.status(200).json({
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

// Cleanup
process.on('SIGTERM', () => {
  console.log('🔚 Cleaning up...');
  activeBots.forEach((bot, token) => {
    cleanupBot(token);
  });
});