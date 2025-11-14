// HercAI API endpoint
const HERCAI_URL = 'https://hercai.onrender.com/v3/hercai';

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Sadece GET methodunu kabul et
    if (req.method !== 'GET') {
        return res.status(405).json({
            status: 'error',
            message: 'Method not allowed. Use GET.',
            endpoint: '/api/chat'
        });
    }

    try {
        const { question } = req.query;

        // Validasyon
        if (!question) {
            return res.status(400).json({
                status: 'error',
                message: 'question parametresi zorunludur',
                endpoint: '/api/chat'
            });
        }

        if (question.length > 1000) {
            return res.status(400).json({
                status: 'error',
                message: 'Soru çok uzun! Maksimum 1000 karakter.',
                endpoint: '/api/chat'
            });
        }

        // HercAI API'ye fetch ile istek at
        const response = await fetch(`${HERCAI_URL}?question=${encodeURIComponent(question)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.reply) {
            res.json({
                status: 'success',
                endpoint: '/api/chat',
                method: 'GET',
                question: question,
                reply: data.reply,
                model: data.model || 'GPT-4',
                character_count: question.length,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'AI yanıt vermedi',
                endpoint: '/api/chat'
            });
        }

    } catch (error) {
        console.error('Chat API error:', error);
        
        // Fallback: Örnek veri (API çalışmazsa)
        const fallbackData = {
            status: "success",
            endpoint: "/api/chat",
            method: "GET",
            question: req.query.question || "Test sorusu",
            reply: "Merhaba! Ben HercAI asistanıyım. Şu anda API geçici olarak kullanılamıyor, ancak normalde GPT-4 ile size yardımcı olurdum.",
            model: "GPT-4",
            character_count: req.query.question ? req.query.question.length : 13,
            timestamp: new Date().toISOString(),
            note: "Fallback data - AI service temporarily unavailable"
        };

        res.status(200).json(fallbackData);
    }
};
