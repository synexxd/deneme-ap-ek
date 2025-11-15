// api/discord.js - SELF TOKEN AUTH SİSTEMİ
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import fetch from 'node-fetch';

const activeBots = new Map();
const MAX_BOT_LIFETIME = 60 * 60 * 1000;
const CHECK_INTERVAL = 15000;
const RECONNECT_DELAY = 5000;

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

// Self token kontrolü
function isSelfToken(token) {
  if (!token || typeof token !== 'string') return false;
  
  // Bot token: MTExxxx.x.x formatında (3 parça)
  // Self token: genellikle tek parça ve daha uzun
  const parts = token.split('.');
  return parts.length !== 3;
}

// Self Token Validation
async function validateSelfToken(token) {
  try {
    console.log(`🔐 Self token doğrulanıyor: ${maskToken(token)}`);
    
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('Self token geçersiz veya süresi dolmuş');
    }

    if (!response.ok) {
      throw new Error(`Token validation failed: ${response.status}`);
    }

    const userData = await response.json();
    console.log(`✅ Self token doğrulandı: ${userData.username}#${userData.discriminator}`);
    
    return {
      valid: true,
      user: userData,
      requires2FA: userData.mfa_enabled || false
    };
  } catch (error) {
    console.error(`❌ Self token doğrulama hatası:`, error.message);
    return {
      valid: false,
      error: error.message
    };
  }
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

    // Request parsing
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
    }

    // Token validation
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

    console.log(`🤖 ${tokens.length} TOKEN İŞLENİYOR: ${channelId}`);

    const results = [];
    const errors = [];

    // Process tokens sequentially to avoid rate limits
    for (const token of tokens) {
      try {
        const isSelf = isSelfToken(token);
        
        // Self token validation
        if (isSelf) {
          const validation = await validateSelfToken(token);
          if (!validation.valid) {
            throw new Error(`Self token geçersiz: ${validation.error}`);
          }
        }

        // Cleanup existing bot
        if (activeBots.has(token)) {
          cleanupBot(token);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Start bot
        const result = await startBot(token, channelId, isSelf);
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
        errors.push({
          token: maskToken(token),
          token_type: isSelfToken(token) ? 'self_token' : 'bot_token',
          status: 'error',
          message: error.message
        });
        console.error(`❌ Hata (${maskToken(token)}):`, error.message);
      }
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Response
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

// SELF TOKEN İÇİN ÖZEL CLIENT
async function startBot(token, channelId, isSelfToken = false) {
  return new Promise(async (resolve, reject) => {
    let client;

    try {
      if (isSelfToken) {
        // 🔥 SELF TOKEN İÇİN ÖZEL AYARLAR
        console.log(`🔑 Self token ile client oluşturuluyor: ${maskToken(token)}`);
        
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
            retries: 3,
          },
          ws: {
            large_threshold: 100,
            compress: false,
            properties: {
              $os: 'windows',
              $browser: 'chrome',
              $device: 'desktop'
            }
          },
          // User token için özel auth
          makeCache: false,
          partials: []
        });

        // SELF TOKEN AUTH FIX
        client.rest.setToken(token);
        
      } else {
        // BOT TOKEN STANDART AYARLAR
        client = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates
          ]
        });
      }

      // READY EVENT
      client.once('ready', async (c) => {
        console.log(`✅ ${isSelfToken ? 'SELF TOKEN' : 'BOT'} HAZIR: ${c.user.tag} (${c.user.id})`);
        
        try {
          const voiceConnection = await connectToVoice(client, channelId);
          
          if (!voiceConnection) {
            reject(new Error('Ses kanalına bağlanılamadı'));
            return;
          }

          // Kontrol döngüsü
          const checkInterval = setInterval(async () => {
            await checkAndReconnect(client, channelId, token);
          }, CHECK_INTERVAL);

          // Kaydet
          activeBots.set(token, {
            client: client,
            voiceConnection: voiceConnection,
            channelId: channelId,
            checkInterval: checkInterval,
            connectedAt: new Date(),
            botUsername: c.user.tag,
            userId: c.user.id,
            isSelfToken: isSelfToken
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

      // ERROR HANDLING
      client.on('error', (error) => {
        console.error(`❌ ${isSelfToken ? 'Self Token' : 'Bot'} hatası:`, error.message);
        
        if (isSelfToken) {
          // Self token özel hata yönetimi
          if (error.message.includes('token') || error.code === 'TOKEN_INVALID') {
            console.log(`🔄 Self token yeniden deneniyor: ${maskToken(token)}`);
            setTimeout(() => {
              cleanupBot(token);
              startBot(token, channelId, isSelfToken).catch(reject);
            }, 10000);
          }
        }
      });

      // DEBUG
      client.on('debug', (info) => {
        if (info.includes('Authentication') || info.includes('token')) {
          console.log(`🔍 ${isSelfToken ? 'Self' : 'Bot'} Debug:`, info);
        }
      });

      // SELF TOKEN LOGIN FIX
      if (isSelfToken) {
        console.log(`🚀 Self token login başlatılıyor...`);
        
        // Discord.js user token login workaround
        try {
          // Önce WebSocket bağlantısını manual başlat
          await client.login(token).catch(async (loginError) => {
            console.log(`⚠️  Standart login başarısız, alternatif yöntem deneniyor...`);
            
            // Alternatif auth yöntemi
            await alternativeSelfTokenLogin(client, token);
          });
        } catch (finalError) {
          console.error(`💥 Self token login hatası:`, finalError.message);
          reject(new Error(`Self token authentication failed: ${finalError.message}`));
        }
      } else {
        // Bot token normal login
        await client.login(token);
      }

    } catch (error) {
      reject(new Error(`Başlatma hatası: ${error.message}`));
    }
  });
}

// ALTERNATİF SELF TOKEN LOGIN
async function alternativeSelfTokenLogin(client, token) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Alternatif self token login deneniyor...`);
    
    // Manual WebSocket connection
    const WebSocket = require('ws');
    
    // Discord Gateway URL'sini al
    fetch('https://discord.com/api/v10/gateway')
      .then(res => res.json())
      .then(gateway => {
        const ws = new WebSocket(`${gateway.url}?v=10&encoding=json`);
        
        ws.on('open', () => {
          console.log('🔗 WebSocket bağlantısı açıldı');
          
          // Identify payload
          const identify = {
            op: 2,
            d: {
              token: token,
              properties: {
                $os: 'windows',
                $browser: 'chrome',
                $device: 'desktop'
              },
              compress: false,
              large_threshold: 250,
              presence: {
                status: 'online',
                since: 0,
                activities: [],
                afk: false
              }
            }
          };
          
          ws.send(JSON.stringify(identify));
        });
        
        ws.on('message', (data) => {
          const payload = JSON.parse(data);
          
          if (payload.op === 10) { // Hello
            console.log('👋 Hello received, heartbeats starting');
          }
          
          if (payload.t === 'READY') {
            console.log('✅ Self token READY event received');
            ws.close();
            resolve(true);
          }
          
          if (payload.op === 9) { // Invalid session
            reject(new Error('Invalid session - token may be invalid'));
          }
        });
        
        ws.on('error', (error) => {
          reject(new Error(`WebSocket error: ${error.message}`));
        });
        
        setTimeout(() => {
          reject(new Error('Self token login timeout'));
        }, 30000);
      })
      .catch(error => {
        reject(new Error(`Gateway fetch error: ${error.message}`));
      });
  });
}

// SES BAĞLANTISI
async function connectToVoice(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error('Kanal bulunamadı');
    }

    if (channel.type !== 2) {
      throw new Error('Bu kanal bir ses kanalı değil');
    }

    console.log(`🎵 Kanala bağlanılıyor: ${channel.name}`);
    
    const voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

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
    
    if (!channel || channel.type !== 2) return;

    const guild = channel.guild;
    const voiceStates = guild.voiceStates.cache;
    const botVoiceState = voiceStates.get(client.user.id);
    
    const isInVoice = botVoiceState && botVoiceState.channelId === channelId;
    
    if (!isInVoice) {
      console.log('🚨 SESTE DEĞİL! YENİDEN BAĞLANIYOR...');
      
      const oldConnection = getVoiceConnection(guild.id);
      if (oldConnection) oldConnection.destroy();
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      await connectToVoice(client, channelId);
    }
    
  } catch (error) {
    console.error('❌ Kontrol hatası:', error);
  }
}