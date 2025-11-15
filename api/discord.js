// api/discord.js - ACİL FIX
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';

// Global state
if (!global.activeBots) {
  global.activeBots = new Map();
}

const activeBots = global.activeBots;
const DELAY_BETWEEN_BOTS = 3000; // 3 saniye

// Basit token maskeleme
function maskToken(token) {
  if (!token) return '???';
  return `${token.substring(0, 10)}...${token.substring(token.length - 5)}`;
}

// Basit bot başlatma - EVENT PROBLEMI FIX
async function startBot(token, channelId) {
  return new Promise(async (resolve, reject) => {
    let client;
    let resolved = false;

    try {
      console.log(`🚀 Bot başlatılıyor: ${maskToken(token)}`);
      
      // Basit client
      client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      // TEK EVENT - ready kullan, clientReady ile uğraşma
      client.once('ready', async (c) => {
        if (resolved) return;
        resolved = true;
        
        console.log(`✅ Bot hazır: ${c.user.tag}`);
        
        try {
          // Kanalı al
          const channel = await client.channels.fetch(channelId);
          if (!channel || channel.type !== 2) {
            throw new Error('Geçersiz ses kanalı');
          }

          // Ses bağlantısı kur
          const voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true
          });

          console.log(`🎵 ${c.user.tag} ses kanalına bağlandı: ${channel.name}`);

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

      // Hata handling
      client.on('error', (error) => {
        console.error(`❌ Bot hatası:`, error.message);
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      // Timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Bot başlatma timeout (20s)'));
        }
      }, 20000);

      // Login
      await client.login(token);
      clearTimeout(timeout);

    } catch (error) {
      console.error(`💥 Başlatma hatası:`, error.message);
      if (client) client.destroy().catch(() => {});
      reject(error);
    }
  });
}

// 3 saniye aralıklı başlatma
async function startBotsSequentially(tokens, channelId) {
  console.log(`🤖 ${tokens.length} TOKEN 3 SANIYE ARALIKLARLA BAŞLATILIYOR`);
  
  const results = [];
  const errors = [];

  // Önce temizlik
  tokens.forEach(token => {
    if (activeBots.has(token)) {
      const bot = activeBots.get(token);
      if (bot.client) bot.client.destroy().catch(() => {});
      if (bot.voiceConnection) bot.voiceConnection.destroy();
      activeBots.delete(token);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Sırayla başlat
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    try {
      console.log(`\n🔧 [${i + 1}/${tokens.length}] Başlatılıyor...`);
      
      const result = await startBot(token, channelId);
      
      results.push({
        token: maskToken(token),
        status: 'success',
        bot_username: result.botUsername,
        user_id: result.userId,
        connected: true
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
        message: error.message
      });
      
      console.error(`❌ [${i + 1}/${tokens.length}] HATA: ${error.message}`);
      
      // Hata olsa da 3 saniye bekle
      if (i < tokens.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BOTS));
      }
    }
  }

  return { results, errors };
}

// API Handler
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let tokens = [];
    let channelId;

    // Request parsing
    if (req.method === 'GET') {
      const { tokens: tokensParam, channel_id } = req.query;
      tokens = tokensParam ? tokensParam.split(',') : [];
      channelId = channel_id;
    } else {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { tokens: tokensParam, channel_id } = body;
      tokens = tokensParam ? (Array.isArray(tokensParam) ? tokensParam : tokensParam.split(',')) : [];
      channelId = channel_id;
    }

    // Validation
    tokens = tokens.filter(token => token && token.length > 10);
    
    if (tokens.length === 0 || !channelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Token ve channel_id gerekli'
      });
    }

    console.log(`🎯 İşleniyor: ${tokens.length} token, kanal: ${channelId}`);

    // Botları başlat
    const { results, errors } = await startBotsSequentially(tokens, channelId);

    // Response
    res.status(200).json({
      status: 'completed',
      total: tokens.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      message: `${results.length} bot başarıyla bağlandı!`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Cleanup
process.on('SIGTERM', () => {
  console.log('🔚 Temizlik...');
  activeBots.forEach((bot, token) => {
    if (bot.client) bot.client.destroy().catch(() => {});
    if (bot.voiceConnection) bot.voiceConnection.destroy();
  });
  activeBots.clear();
});