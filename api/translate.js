// translate.js - MyMemory Translate API backend
const express = require('express');
const router = express.Router();
const axios = require('axios');

// MyMemory Translate API endpoint
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

// Desteklenen diller
const SUPPORTED_LANGUAGES = {
    'auto': 'Auto Detect',
    'en': 'English',
    'tr': 'Turkish',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'nl': 'Dutch',
    'pl': 'Polish',
    'sv': 'Swedish',
    'da': 'Danish',
    'fi': 'Finnish',
    'no': 'Norwegian'
};

// Translate API endpoint
router.post('/translate', async (req, res) => {
    try {
        const { text, target, source = 'auto' } = req.body;

        // Validasyon
        if (!text || !target) {
            return res.status(400).json({
                status: 'error',
                message: 'text ve target parametreleri zorunludur'
            });
        }

        if (text.length > 500) {
            return res.status(400).json({
                status: 'error',
                message: 'Metin çok uzun! Maksimum 500 karakter.'
            });
        }

        if (!SUPPORTED_LANGUAGES[target]) {
            return res.status(400).json({
                status: 'error',
                message: 'Desteklenmeyen hedef dil'
            });
        }

        // Gerçek source dilini belirle
        let actualSource = source;
        if (source === 'auto') {
            // Basit dil tespiti (İngilizce veya Türkçe)
            const isEnglish = /^[a-zA-Z\s.,!?']+$/.test(text);
            actualSource = isEnglish ? 'en' : 'tr';
        }

        // MyMemory Translate API'ye istek at
        const response = await axios.get(MYMEMORY_URL, {
            params: {
                q: text,
                langpair: `${actualSource}|${target}`,
                de: 'synexapi@example.com' // Email for higher limits
            },
            timeout: 10000
        });

        const data = response.data;

        if (data.responseStatus === 200) {
            res.json({
                status: 'success',
                endpoint: '/api/translate',
                original_text: text,
                translated_text: data.responseData.translatedText,
                source_language: actualSource,
                target_language: target,
                translation_service: 'MyMemory Translate',
                character_count: text.length,
                match: data.responseData.match,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Çeviri başarısız',
                error: data.responseDetails || 'Bilinmeyen hata'
            });
        }

    } catch (error) {
        console.error('Translate error:', error);
        
        if (error.response) {
            res.status(500).json({
                status: 'error',
                message: 'Çeviri servisi hatası',
                error: error.response.data?.responseDetails || 'API hatası'
            });
        } else if (error.request) {
            res.status(503).json({
                status: 'error',
                message: 'Çeviri servisine ulaşılamıyor'
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Sunucu hatası'
            });
        }
    }
});

// Çeviri geçmişi (basit in-memory storage)
let translationHistory = [];

// Çeviri geçmişi endpoint'i
router.get('/translate/history', (req, res) => {
    res.json({
        status: 'success',
        endpoint: '/api/translate/history',
        history: translationHistory.slice(-10), // Son 10 çeviri
        total: translationHistory.length,
        timestamp: new Date().toISOString()
    });
});

// Desteklenen dilleri listeleme endpoint'i
router.get('/translate/languages', (req, res) => {
    res.json({
        status: 'success',
        endpoint: '/api/translate/languages',
        languages: SUPPORTED_LANGUAGES,
        total_languages: Object.keys(SUPPORTED_LANGUAGES).length,
        timestamp: new Date().toISOString()
    });
});

// Sağlık kontrolü endpoint'i
router.get('/translate/health', async (req, res) => {
    try {
        const response = await axios.get(MYMEMORY_URL, {
            params: {
                q: 'hello',
                langpair: 'en|tr',
                de: 'synexapi@example.com'
            },
            timeout: 5000
        });

        if (response.data.responseStatus === 200) {
            res.json({
                status: 'success',
                message: 'Translate API çalışıyor',
                service: 'MyMemory Translate',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                status: 'error',
                message: 'Translate API hatalı yanıt veriyor',
                service: 'MyMemory Translate',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(503).json({
            status: 'error',
            message: 'Translate API çalışmıyor',
            service: 'MyMemory Translate',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
