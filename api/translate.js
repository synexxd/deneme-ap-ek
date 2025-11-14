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

// CORS middleware
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// POST /api/translate - Metin çevirisi
router.post('/translate', async (req, res) => {
    try {
        const { text, target, source = 'auto' } = req.body;

        // Validasyon
        if (!text || !target) {
            return res.status(400).json({
                status: 'error',
                message: 'text ve target parametreleri zorunludur',
                endpoint: '/api/translate'
            });
        }

        if (text.length > 500) {
            return res.status(400).json({
                status: 'error',
                message: 'Metin çok uzun! Maksimum 500 karakter.',
                endpoint: '/api/translate'
            });
        }

        if (!SUPPORTED_LANGUAGES[target]) {
            return res.status(400).json({
                status: 'error',
                message: 'Desteklenmeyen hedef dil',
                endpoint: '/api/translate'
            });
        }

        // Gerçek source dilini belirle
        let actualSource = source;
        if (source === 'auto') {
            // Basit dil tespiti
            const isEnglish = /^[a-zA-Z\s.,!?']+$/.test(text);
            actualSource = isEnglish ? 'en' : 'tr';
        }

        // MyMemory Translate API'ye istek at
        const response = await axios.get(MYMEMORY_URL, {
            params: {
                q: text,
                langpair: `${actualSource}|${target}`,
                de: 'synexapi@example.com'
            },
            timeout: 10000
        });

        const data = response.data;

        if (data.responseStatus === 200) {
            res.json({
                status: 'success',
                endpoint: '/api/translate',
                method: 'POST',
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
                error: data.responseDetails || 'Bilinmeyen hata',
                endpoint: '/api/translate'
            });
        }

    } catch (error) {
        console.error('Translate error:', error);
        
        if (error.response) {
            res.status(500).json({
                status: 'error',
                message: 'Çeviri servisi hatası',
                error: error.response.data?.responseDetails || 'API hatası',
                endpoint: '/api/translate'
            });
        } else if (error.request) {
            res.status(503).json({
                status: 'error',
                message: 'Çeviri servisine ulaşılamıyor',
                endpoint: '/api/translate'
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Sunucu hatası',
                endpoint: '/api/translate'
            });
        }
    }
});

// GET /api/translate/languages - Desteklenen diller
router.get('/translate/languages', (req, res) => {
    res.json({
        status: 'success',
        endpoint: '/api/translate/languages',
        method: 'GET',
        languages: SUPPORTED_LANGUAGES,
        total_languages: Object.keys(SUPPORTED_LANGUAGES).length,
        timestamp: new Date().toISOString()
    });
});

// GET /api/translate/health - Sağlık kontrolü
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
                endpoint: '/api/translate/health',
                method: 'GET',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                status: 'error',
                message: 'Translate API hatalı yanıt veriyor',
                service: 'MyMemory Translate',
                endpoint: '/api/translate/health',
                method: 'GET',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(503).json({
            status: 'error',
            message: 'Translate API çalışmıyor',
            service: 'MyMemory Translate',
            endpoint: '/api/translate/health',
            method: 'GET',
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/translate/usage - Kullanım bilgileri
router.get('/translate/usage', (req, res) => {
    res.json({
        status: 'success',
        endpoint: '/api/translate/usage',
        method: 'GET',
        limits: {
            max_text_length: 500,
            supported_languages: Object.keys(SUPPORTED_LANGUAGES).length,
            rate_limit: '100 requests/hour',
            service: 'MyMemory Translate'
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;