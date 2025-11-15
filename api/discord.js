// api/discord.js - ClientReady Fix (No Reconnect)
import { Client, GatewayIntentBits, Options } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';

// Global state for Vercel
if (!global.activeBots) {
  global.activeBots = new Map();
}

const activeBots = global.activeBots;
const MAX_BOT_LIFETIME = 55 * 60 * 1000;

// Bot temizleme
function cleanupBot(token) {
  if (activeBots.has(token)) {
    const bot = activeBots.get(token);
    console.log(`🧹 Bot temizleniyor: ${maskToken(token)}`);
    
    if (bot.checkInterval) clearInterval(bot.checkInterval);
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

// Client oluşturma - Basit ve temiz
function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates
    ],
    // Minimal cache
    makeCache: Options.cacheWithLimits({
      MessageManager: 0,
      ThreadManager: 0,  
    }),
    rest: {
      timeout: 10000,
      retries: 1,
    }
  });
}

// Bot başlatma - CLIENTREADY FIX (No Reconnect)
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    const isSelf = isSelfToken(token);
    let client;
    let readyResolved = false;

    try {
      console.log(`🚀 ${isSelf ? 'SELF' : 'BOT'} başlatılıyor: ${maskToken(token)}`);
      
      client = createClient();

      // CLIENTREADY EVENT - FIX
      client.once('clientReady', async (c) => {
        if (readyResolved) return;
        readyResolved = true;
        
        console.log(`✅ ${isSelf ? 'SELF' : 'BOT'} HAZIR: ${c.user.tag}`);
        
        try {
          // Ses bağlantısı - YENIDEN BAĞLANMA YOK
          const voiceConnection = await connectToVoice(client, channelId);
          
          if (!voiceConnection) {
            reject(new Error('Ses kanalına bağlanılamadı'));
            return;
          }

          // Sadece temizlik timeout'u
          const cleanupTimeout = setTimeout(() => {
            console.log(`⏰ Otomatik temizlik: ${maskToken(token)}`);
            cleanupBot(token);
          }, MAX_BOT_LIFETIME);

          activeBots.set(token, {
            client,
            voiceConnection,
            channelId,
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

      // Eski ready event için fallback
      client.once('ready', async (c) => {
        if (readyResolved) return;
        readyResolved = true;
        
        console.log(`✅ ${isSelf ? 'SELF' : 'BOT'} READY (fallback): ${c.user.tag}`);
        
        try {
          const voiceConnection = await connectToVoice(client, channelId);
          
          if (!voiceConnection) {
            reject(new Error('Ses kanalına bağlanılamadı'));
            return;
          }

          const cleanupTimeout = setTimeout(() => {
            console.log(`⏰ Otomatik temizlik: ${maskToken(token)}`);
            cleanupBot(token);
          }, MAX_BOT_LIFETIME);

          activeBots.set(token, {
            client,
            voiceConnection,
            channelId,
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
        console.error(`❌ ${isSelf ? 'Self' : 'Bot'} hatası:`, error.message);
        if (!readyResolved) {
          readyResolved = true;
          reject(error);
        }
      });

      // Timeout ekle (20 saniye)
      const timeout = setTimeout(() => {
        if (!readyResolved) {
          readyResolved = true;
          console.error(`⏰ Timeout: ${maskToken(token)}`);
          reject(new Error('Bot başlatma timeout (20s)'));
        }
      }, 20000);

      // Login
      await client.login(token);

      // Timeout'u temizle
      clearTimeout(timeout);

    } catch (error) {
      console.error(`💥 Başlatma hatası (${maskToken(token)}):`, error.message);
      
      if (client && !client.destroyed) {
        client.destroy().catch(() => {});
      }
      
      reject(error);
    }
  });
}

// Ses bağlantısı - YENIDEN BAĞLANMA YOK
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

    // YENIDEN BAĞLANMA YOK - sadece bağlantı kur
    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`✅ ${client.user.tag} ses bağlantısı hazır`);
    });

    voiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log(`🔌 ${client.user.tag} bağlantı kesildi (yeniden bağlanma YOK)`);
      // YENIDEN BAĞLANMA YOK - sadece log
    });

    return voiceConnection;
    
  } catch (error) {
    console.error(`❌ ${client.user?.tag || 'Unknown'} bağlantı hatası:`, error.message);
    throw error;
  }
}

// TÜM TOKENLARI AYNI ANDA BAŞLAT
async function startAllTokensParallel(tokens, channelId) {
  console.log(`🚀 TÜM TOKENLAR AYNI ANDA BAŞLATILIYOR: ${tokens.length} token`);
  
  const startTime = Date.now();
  
  // Önce tüm mevcut botları temizle
  tokens.forEach(token => {
    if (activeBots.has(token)) {
      cleanupBot(token);
    }
  });

  // 1 saniye bekle temizlik için
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Tüm token'ları aynı anda başlat
  const promises = tokens.map(async (token, index) => {
    try {
      console.log(`⚡ [${index + 1}/${tokens.length}] Başlatılıyor: ${maskToken(token)}`);
      
      const result = await startBot(token, channelId);
      
      return {
        token: maskToken(token),
        token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
        status: 'success',
        bot_username: result.botUsername,
        user_id: result.userId,
        connected: true,
        start_order: index + 1
      };
      
    } catch (error) {
      return {
        token: maskToken(token),
        token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
        status: 'error',
        message: error.message,
        start_order: index + 1
      };
    }
  });

  // Tüm promise'ları bekle
  const results = await Promise.allSettled(promises);
  
  const successful = [];
  const errors = [];
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.status === 'success') {
        successful.push(result.value);
        console.log(`✅ [${result.value.start_order}/${tokens.length}] BAŞARILI: ${result.value.bot_username}`);
      } else {
        errors.push(result.value);
        console.log(`❌ [${result.value.start_order}/${tokens.length}] HATA: ${result.value.message}`);
      }
    } else {
      errors.push({
        token: maskToken(tokens[index]),
        token_type: isSelfToken(tokens[index]) ? 'self_token' : 'bot_token',
        status: 'error',
        message: result.reason?.message || 'Bilinmeyen hata',
        start_order: index + 1
      });
      console.log(`💥 [${index + 1}/${tokens.length}] PROMISE HATASI: ${result.reason}`);
    }
  });

  const endTime = Date.now();
  console.log(`⏱️  Tüm tokenlar ${(endTime - startTime) / 1000} saniyede işlendi`);
  
  return { results: successful, errors };
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

    console.log(`🤖 ${tokens.length} TOKEN AYNI ANDA BAŞLATILIYOR!`);
    console.log(`📊 Token Dağılımı: ${tokens.filter(t => isSelfToken(t)).length} Self, ${tokens.filter(t => !isSelfToken(t)).length} Bot`);

    // TÜM TOKENLARI AYNI ANDA BAŞLAT
    const { results, errors } = await startAllTokensParallel(tokens, channelId);

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
      message: `${results.length} token aynı anda başarıyla aktif edildi! ⚡`,
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