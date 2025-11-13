// api/doviz.js - Döviz API Route

const currencies = {
    'usd': { name: 'Amerikan Doları', symbol: '$', code: 'USD' },
    'eur': { name: 'Euro', symbol: '€', code: 'EUR' },
    'gbp': { name: 'İngiliz Sterlini', symbol: '£', code: 'GBP' },
    'chf': { name: 'İsviçre Frangı', symbol: 'CHF', code: 'CHF' },
    'cad': { name: 'Kanada Doları', symbol: 'C$', code: 'CAD' },
    'rub': { name: 'Rus Rublesi', symbol: '₽', code: 'RUB' },
    'jpy': { name: 'Japon Yeni', symbol: '¥', code: 'JPY' },
    'cny': { name: 'Çin Yuanı', symbol: '¥', code: 'CNY' },
    'aud': { name: 'Avustralya Doları', symbol: 'A$', code: 'AUD' },
    'dkk': { name: 'Danimarka Kronu', symbol: 'kr', code: 'DKK' },
    'sek': { name: 'İsveç Kronu', symbol: 'kr', code: 'SEK' },
    'nok': { name: 'Norveç Kronu', symbol: 'kr', code: 'NOK' },
    'sar': { name: 'Suudi Arabistan Riyali', symbol: '﷼', code: 'SAR' },
    'aed': { name: 'BAE Dirhemi', symbol: 'د.إ', code: 'AED' },
    'kwd': { name: 'Kuveyt Dinarı', symbol: 'د.ك', code: 'KWD' },
    'bgn': { name: 'Bulgar Levası', symbol: 'лв', code: 'BGN' },
    'ron': { name: 'Romen Leyi', symbol: 'lei', code: 'RON' }
};

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { base = 'usd' } = req.query;

    try {
        // Finans API'den döviz verilerini çek
        const response = await fetch('https://finans.truncgil.com/today.json');
        
        if (!response.ok) {
            throw new Error('Finans API isteği başarısız oldu');
        }
        
        const data = await response.json();

        // Desteklenen döviz kurlarını filtrele
        const supportedCurrencies = {};
        const baseCurrency = currencies[base.toLowerCase()];

        if (!baseCurrency) {
            return res.status(400).json({ 
                error: 'Geçersiz base currency. Desteklenenler: ' + Object.keys(currencies).join(', ')
            });
        }

        for (const [key, currency] of Object.entries(currencies)) {
            const currencyKey = key.toUpperCase();
            if (data[currencyKey]) {
                const rateData = data[currencyKey];
                
                // Oranları parse et
                const buying = parseFloat(rateData.Buying?.replace(',', '.') || rateData.Alış?.replace(',', '.') || '0');
                const selling = parseFloat(rateData.Selling?.replace(',', '.') || rateData.Satış?.replace(',', '.') || '0');
                const rate = parseFloat(rateData.Rate?.replace(',', '.') || rateData.Değişim?.replace(',', '.') || '0');
                const change = parseFloat(rateData.Change?.replace(',', '.') || rateData['Değişim %']?.replace(',', '.') || '0');

                supportedCurrencies[currency.code] = {
                    name: currency.name,
                    symbol: currency.symbol,
                    code: currency.code,
                    buying: isNaN(buying) ? 0 : buying,
                    selling: isNaN(selling) ? 0 : selling,
                    rate: isNaN(rate) ? 0 : rate,
                    change: isNaN(change) ? 0 : change,
                    timestamp: new Date().toISOString()
                };
            }
        }

        // Altın verilerini de ekle
        const goldData = {};
        if (data['gram-altin']) {
            const gold = data['gram-altin'];
            goldData['gold'] = {
                name: 'Gram Altın',
                symbol: 'g',
                code: 'XAU',
                buying: parseFloat(gold.Buying?.replace(',', '.') || gold.Alış?.replace(',', '.') || '0'),
                selling: parseFloat(gold.Selling?.replace(',', '.') || gold.Satış?.replace(',', '.') || '0'),
                rate: parseFloat(gold.Rate?.replace(',', '.') || gold.Değişim?.replace(',', '.') || '0'),
                change: parseFloat(gold.Change?.replace(',', '.') || gold['Değişim %']?.replace(',', '.') || '0'),
                timestamp: new Date().toISOString()
            };
        }

        const result = {
            status: "success",
            endpoint: "/api/doviz",
            base_currency: baseCurrency,
            timestamp: new Date().toISOString(),
            currencies: supportedCurrencies,
            precious_metals: goldData
        };

        res.status(200).json(result);

    } catch (error) {
        console.error('Döviz API hatası:', error);
        
        // Fallback: Örnek veri (API çalışmazsa)
        const fallbackData = {
            status: "success",
            endpoint: "/api/doviz",
            base_currency: currencies[base.toLowerCase()] || currencies.usd,
            timestamp: new Date().toISOString(),
            currencies: {
                'USD': { name: 'Amerikan Doları', symbol: '$', code: 'USD', buying: 28.5, selling: 28.7, rate: 28.6, change: 0.2, timestamp: new Date().toISOString() },
                'EUR': { name: 'Euro', symbol: '€', code: 'EUR', buying: 31.2, selling: 31.4, rate: 31.3, change: -0.1, timestamp: new Date().toISOString() },
                'GBP': { name: 'İngiliz Sterlini', symbol: '£', code: 'GBP', buying: 36.1, selling: 36.3, rate: 36.2, change: 0.3, timestamp: new Date().toISOString() }
            },
            precious_metals: {
                'gold': { name: 'Gram Altın', symbol: 'g', code: 'XAU', buying: 1850.5, selling: 1860.2, rate: 1855.3, change: 5.7, timestamp: new Date().toISOString() }
            },
            note: "Fallback data - API temporarily unavailable"
        };

        res.status(200).json(fallbackData);
    }
};
