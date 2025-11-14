// api/discord.js - KENDİ KENDİNİ KONTROL EDEN BOT
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus } from '@discordjs/voice';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let token, channelId;

    if (req.method === 'GET') {
      token = req.query.token;
      channelId = req.query.channel_id;
    } else if (req.method === 'POST') {
      token = req.body.token;
      channelId = req.body.channel_id;
    } else {
      return res.status(405).json({
        status: 'error',
        message: 'Sadece GET ve POST methodu destekleniyor'
      });
    }

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Bot token gereklidir'
      });
    }

    if (!channelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Ses kanalı ID gereklidir'
      });
    }

    console.log(`🚀 YENİ BOT BAŞLATILIYOR: ${channelId}`);

    // HEMEN BOTU BAŞLAT (async - response'u bekleme)
    startSelfHealingBot(token, channelId);
    
    res.status(200).json({
      status: 'success',
      endpoint: '/api/discord',
      method: req.method,
      channel_id: channelId,
      connected: true,
      message: 'Bot başlatıldı! KENDİ KENDİNİ sürekli kontrol edecek! 🔄',
      self_healing: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bot Hatası:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      connected: false,
      timestamp: new Date().toISOString()
    });
  }
}

// KENDİ KENDİNİ İYİLEŞTİREN BOT
async function startSelfHealingBot(token, channelId) {
  try {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
      ]
    });

    let voiceConnection = null;
    let checkInterval = null;
    let reconnectAttempts = 0;

    // BOT HAZIR OLUNCA
    client.once('ready', async () => {
      console.log(`✅ BOT AKTİF: ${client.user.tag}`);
      
      // İLK BAĞLANTI
      await connectToChannel();
      
      // SÜREKLİ KONTROL DÖNGÜSÜ
      startSelfCheck();
    });

    // BAĞLANTI FONKSİYONU
    async function connectToChannel() {
      try {
        const channel = await client.channels.fetch(channelId);
        
        if (!channel || channel.type !== 2) {
          console.log('❌ Kanal bulunamadı');
          return false;
        }

        console.log(`🎵 Kanala bağlanılıyor: ${channel.name}`);
        
        // Eski bağlantıyı temizle
        if (voiceConnection) {
          voiceConnection.destroy();
        }

        // YENİ BAĞLANTI
        voiceConnection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: true
        });

        // BAĞLANTI DURUMU TAKİBİ
        voiceConnection.on('stateChange', async (oldState, newState) => {
          console.log(`🔊 ${client.user.tag} durumu: ${oldState.status} -> ${newState.status}`);
          
          // BAĞLANTI KOPARSA HEMEN YENİDEN BAĞLAN
          if (newState.status === VoiceConnectionStatus.Disconnected) {
            console.log('🚨 BAĞLANTI KOPTU! Yeniden bağlanılıyor...');
            setTimeout(connectToChannel, 1000);
          }
        });

        // BAĞLANTI HATASI
        voiceConnection.on('error', (error) => {
          console.error('❌ Ses hatası:', error);
          setTimeout(connectToChannel, 2000);
        });

        console.log(`✅ BAĞLANTI KURULDU: ${channel.name}`);
        reconnectAttempts = 0;
        return true;
        
      } catch (error) {
        console.error('❌ Bağlantı hatası:', error);
        reconnectAttempts++;
        
        // 5 saniye sonra tekrar dene
        setTimeout(connectToChannel, 5000);
        return false;
      }
    }

    // KENDİ KENDİNİ KONTROL ET
    function startSelfCheck() {
      checkInterval = setInterval(async () => {
        try {
          const channel = await client.channels.fetch(channelId);
          
          if (!channel) {
            console.log('❌ Kanal bulunamadı');
            return;
          }

          // BOTUN SES DURUMUNU KONTROL ET
          const guild = channel.guild;
          const botVoiceState = guild.voiceStates.cache.get(client.user.id);
          const isInVoice = botVoiceState && botVoiceState.channelId === channelId;
          
          if (!isInVoice) {
            console.log('🚨 BOT SESTEN DÜŞTÜ! HEMEN YENİDEN BAĞLANIYOR...');
            await connectToChannel();
          } else {
            // Her 10 kontrolde bir logla
            if (Math.random() < 0.1) {
              console.log(`✅ ${client.user.tag} hala seste!`);
            }
          }
          
        } catch (error) {
          console.error('❌ Kontrol hatası:', error);
        }
      }, 2000); // 2 SANİYEDE BİR KONTROL
    }

    // BOT HATALARI
    client.on('error', (error) => {
      console.error('❌ Bot hatası:', error);
    });

    // BOT DİSCONNECT
    client.on('disconnect', () => {
      console.log('🔌 Bot bağlantısı kesildi, yeniden bağlanılıyor...');
      setTimeout(() => {
        client.login(token);
      }, 5000);
    });

    // BOTU BAŞLAT
    await client.login(token);
    
    // 24 SAAT SONRA BOTU YENİDEN BAŞLAT (memory leak önlemek için)
    setTimeout(() => {
      console.log('🔄 24 saat doldu, bot yeniden başlatılıyor...');
      if (checkInterval) clearInterval(checkInterval);
      if (voiceConnection) voiceConnection.destroy();
      client.destroy();
      startSelfHealingBot(token, channelId);
    }, 24 * 60 * 60 * 1000); // 24 saat
    
  } catch (error) {
    console.error('❌ Bot başlatma hatası:', error);
    
    // Hata olursa 10 saniye sonra tekrar dene
    setTimeout(() => {
      startSelfHealingBot(token, channelId);
    }, 10000);
  }
}