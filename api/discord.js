// api/discord.js - Rate Limit Fix (3s Aralıklı)
import { Client, GatewayIntentBits, Options } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';

// Global state for Vercel
if (!global.activeBots) {
  global.activeBots = new Map();
}

const activeBots = global.activeBots;
const MAX_BOT_LIFETIME = 55 * 60 * 1000;
const DELAY_BETWEEN_BOTS = 3000; // 3 saniye

// Bot temizleme
function cleanupBot(token) {
  if (activeBots.has(token)) {
    const bot = activeBots.get(token);
    console.log(`🧹 Bot temizleniyor: ${maskToken(token)}`);
    
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
function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates
    ],
    makeCache: Options.cacheWithLimits({
      MessageManager: 0,
      ThreadManager: 0,  
    }),
    rest: {
      timeout: 15000,
      retries: 1,
    }
  });
}

// Bot başlatma - RATE LIMIT FIX
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    const isSelf = isSelfToken(token);
    let client;
    let readyResolved = false;

    try {
      console.log(`🚀 ${isSelf ? 'SELF' : 'BOT'} başlatılıyor: ${maskToken(token)}`);
      
      client = createClient();

      // READY EVENT - rate limit için daha güvenli
      const handleReady = async (c) => {
        if (readyResolved) return;
        readyResolved = true;
        
        console.log(`✅ ${isSelf ? 'SELF' : 'BOT'} HAZIR: ${c.user.tag}`);
        
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
      };

      // İki event'i de dinle (rate limit için)
      client.once('clientReady', handleReady);
      client.once('ready', handleReady);

      // Error handling
      client.on('error', (error) => {
        console.error(`❌ ${isSelf ? 'Self' : 'Bot'} hatası:`, error.message);
        if (!readyResolved) {
          readyResolved = true;
          reject(error);
        }
      });

      // Rate limit handling
      client.on('rateLimit', (info) => {
        console.log(`⏳ Rate limit: ${maskToken(token)} - ${info.timeout}ms`);
      });

      // Timeout (25 saniye)
      const timeout = setTimeout(() => {
        if (!readyResolved) {
          readyResolved = true;
          console.error(`⏰ Timeout: ${maskToken(token)}`);
          reject(new Error('Bot başlatma timeout (25s)'));
        }
      }, 25000);

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

    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`✅ ${client.user.tag} ses bağlantısı hazır`);
    });

    voiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log(`🔌 ${client.user.tag} bağlantı kesildi`);
    });

    return voiceConnection;
    
  } catch (error) {
    console.error(`❌ ${client.user?.tag || 'Unknown'} bağlantı hatası:`, error.message);
    throw error;
  }
}

// 3 SANIYE ARALIKLI BAŞLATMA
async function startTokensWithDelay(tokens, channelId) {
  console.log(`🚀 TOKENLAR 3 SANIYE ARALIKLARLA BAŞLATILIYOR: ${tokens.length} token`);
  
  const startTime = Date.now();
  const results = [];
  const errors = [];

  // Önce tüm mevcut botları temizle
  for (const token of tokens) {
    if (activeBots.has(token)) {
      cleanupBot(token);
    }
  }

  // 2 saniye bekle temizlik için
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Token'ları sırayla başlat (3 saniye aralıklarla)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isSelf = isSelfToken(token);
    
    try {
      console.log(`\n🔧 [${i + 1}/${tokens.length}] Başlatılıyor: ${maskToken(token)}`);
      
      const result = await startBot(token, channelId);
      
      results.push({
        token: maskToken(token),
        token_type: isSelf ? 'self_token' : 'bot_token',
        status: 'success',
        bot_username: result.botUsername,
        user_id: result.userId,
        connected: true,
        start_order: i + 1
      });

      console.log(`✅ [${i + 1}/${tokens.length}] BAŞARILI: ${result.botUsername}`);

      // Son token değilse 3 saniye bekle
      if (i < tokens.length - 1) {
        console.log(`⏳ ${DELAY_BETWEEN_BOTS/1000} saniye sonraki token...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BOTS));
      }

    } catch (error) {
      errors.push({
        token: maskToken(token),
        token_type: isSelf ? 'self_token' : 'bot_token',
        status: 'error',
        message: error.message,
        start_order: i + 1
      });
      
      console.error(`❌ [${i + 1}/${tokens.length}] HATA: ${error.message}`);
      
      // Hata olsa bile 3 saniye bekle (rate limit koruması)
      if (i < tokens.length - 1) {
        console.log(`⏳ ${DELAY_BETWEEN_BOTS/1000} saniye sonraki token...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BOTS));
      }
    }
  }

  const endTime = Date.now();
  console.log(`⏱️  Tüm tokenlar ${(endTime - startTime) / 1000} saniyede işlendi`);
  
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

    console.log(`🤖 ${tokens.length} TOKEN 3 SANIYE ARALIKLARLA BAŞLATILIYOR!`);
    console.log(`📊 Token Dağılımı: ${tokens.filter(t => isSelfToken(t)).length} Self, ${tokens.filter(t => !isSelfToken(t)).length} Bot`);

    // 3 SANIYE ARALIKLI BAŞLATMA
    const { results, errors } = await startTokensWithDelay(tokens, channelId);

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
      message: `${results.length} token başarıyla aktif edildi! (3s aralıklarla)`,
      delay_between_bots: `${DELAY_BETWEEN_BOTS/1000}s`,
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