// api/discord.js - ClientReady Fix
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';

// Global state
if (!global.activeBots) {
  global.activeBots = new Map();
}

const activeBots = global.activeBots;
const DELAY_BETWEEN_BOTS = 3000; // 3 saniye

// Token maskeleme
function maskToken(token) {
  if (!token) return '???';
  return `${token.substring(0, 10)}...${token.substring(token.length - 5)}`;
}

// ClientReady ile bot başlatma
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    let client;
    let resolved = false;

    try {
      console.log(`🚀 Bot başlatılıyor: ${maskToken(token)}`);
      
      // Client oluştur
      client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      // CLIENTREADY EVENT - BU SEFER ÇALIŞACAK
      client.once('clientReady', async (c) => {
        console.log(`✅ ClientReady tetiklendi: ${c.user.tag}`);
        
        if (resolved) return;
        resolved = true;
        
        try {
          // Kanalı al
          const channel = await client.channels.fetch(channelId);
          if (!channel || channel.type !== 2) {
            throw new Error('Geçersiz ses kanalı');
          }

          console.log(`🎵 ${c.user.tag} kanala bağlanıyor: ${channel.name}`);

          // Ses bağlantısı kur
          const voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true
          });

          // Bağlantı hazır olunca
          voiceConnection.on('stateChange', (oldState, newState) => {
            if (newState.status === 'ready') {
              console.log(`🔊 ${c.user.tag} ses bağlantısı hazır`);
            }
          });

          // State'i kaydet
          activeBots.set(token, {
            client,
            voiceConnection,
            channelId,
            botUsername: c.user.tag,
            userId: c.user.id,
            connectedAt: Date.now()
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

      // Ready event fallback (sadece debug için)
      client.once('ready', (c) => {
        console.log(`ℹ️  Ready event tetiklendi: ${c.user.tag}`);
      });

      // Error handling
      client.on('error', (error) => {
        console.error(`❌ Bot hatası:`, error.message);
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      // Debug info
      client.on('debug', (info) => {
        if (info.includes('Authenticated') || info.includes('Session')) {
          console.log(`🔍 ${maskToken(token)}: ${info.substring(0, 80)}`);
        }
      });

      // Timeout (30 saniye)
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error(`⏰ Timeout: ${maskToken(token)}`);
          reject(new Error('Bot başlatma timeout (30s)'));
        }
      }, 30000);

      console.log(`🔐 Login başlatılıyor: ${maskToken(token)}`);
      
      // Login işlemi
      await client.login(token);
      
      console.log(`🔓 Login başarılı: ${maskToken(token)}`);
      clearTimeout(timeout);

    } catch (error) {
      console.error(`💥 Başlatma hatası:`, error.message);
      if (client && !client.destroyed) {
        client.destroy().catch(() => {});
      }
      reject(error);
    }
  });
}

// 3 saniye aralıklı başlatma
async function startBotsSequentially(tokens, channelId) {
  console.log(`🤖 ${tokens.length} TOKEN BAŞLATILIYOR (3s aralıklarla)`);
  
  const results = [];
  const errors = [];

  // Önce temizlik
  console.log('🧹 Eski botlar temizleniyor...');
  tokens.forEach(token => {
    if (activeBots.has(token)) {
      const bot = activeBots.get(token);
      try {
        if (bot.voiceConnection) bot.voiceConnection.destroy();
        if (bot.client) bot.client.destroy();
      } catch (e) {}
      activeBots.delete(token);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Token'ları sırayla başlat
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    try {
      console.log(`\n🔧 [${i + 1}/${tokens.length}] Başlatılıyor: ${maskToken(token)}`);
      
      const result = await startBot(token, channelId);
      
      results.push({
        token: maskToken(token),
        status: 'success',
        bot_username: result.botUsername,
        user_id: result.userId,
        connected: true,
        order: i + 1
      });

      console.log(`✅ [${i + 1}/${tokens.length}] BAŞARILI: ${result.botUsername}`);

      // 3 saniye bekle (son token hariç)
      if (i < tokens.length - 1) {
        console.log(`⏳ 3 saniye sonra diğer bot...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BOTS));
      }

    } catch (error) {
      errors.push({
        token: maskToken(token),
        status: 'error',
        message: error.message,
        order: i + 1
      });
      
      console.error(`❌ [${i + 1}/${tokens.length}] HATA: ${error.message}`);
      
      // Hata olsa da 3 saniye bekle
      if (i < tokens.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BOTS));
      }
    }
  }

  console.log(`🎯 İşlem tamamlandı: ${results.length} başarılı, ${errors.length} hatalı`);
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

    // Request parsing
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

    // Validation
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

    console.log(`🎯 İşleniyor: ${tokens.length} token, kanal: ${channelId}`);

    // Botları başlat
    const { results, errors } = await startBotsSequentially(tokens, channelId);

    // Response
    return res.status(200).json({
      status: 'completed',
      total_tokens: tokens.length,
      successful: results.length,
      failed: errors.length,
      results: results,
      errors: errors,
      message: `${results.length} bot clientReady ile başarıyla bağlandı! 🚀`,
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
  console.log('🔚 Temizlik yapılıyor...');
  activeBots.forEach((bot, token) => {
    try {
      if (bot.voiceConnection) bot.voiceConnection.destroy();
      if (bot.client) bot.client.destroy();
    } catch (e) {}
  });
  activeBots.clear();
});