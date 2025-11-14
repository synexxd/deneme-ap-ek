// Nüfus API endpoint
const POPULATION_API_URL = 'https://restcountries.com/v3.1/all?fields=name,population';

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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
            endpoint: '/api/population'
        });
    }

    try {
        const { country, limit = '50', sort = 'desc' } = req.query;

        // RestCountries API'den veri çek
        const response = await fetch(POPULATION_API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let countries = await response.json();

        // Ülke filtreleme
        if (country) {
            const searchTerm = country.toLowerCase();
            countries = countries.filter(c => 
                c.name.common.toLowerCase().includes(searchTerm) ||
                (c.name.official && c.name.official.toLowerCase().includes(searchTerm))
            );
        }

        // Nüfusa göre sıralama
        countries.sort((a, b) => {
            if (sort === 'asc') {
                return (a.population || 0) - (b.population || 0);
            } else {
                return (b.population || 0) - (a.population || 0);
            }
        });

        // Limit uygula
        const limitNum = parseInt(limit);
        if (limitNum > 0) {
            countries = countries.slice(0, limitNum);
        }

        // Toplam nüfus hesapla
        const totalPopulation = countries.reduce((sum, country) => sum + (country.population || 0), 0);

        // Format response
        const formattedCountries = countries.map(country => ({
            name: {
                common: country.name.common,
                official: country.name.official
            },
            population: country.population || 0,
            population_formatted: formatPopulation(country.population || 0)
        }));

        res.json({
            status: 'success',
            endpoint: '/api/population',
            method: 'GET',
            total_countries: countries.length,
            total_population: totalPopulation,
            total_population_formatted: formatPopulation(totalPopulation),
            countries: formattedCountries,
            filters: {
                country: country || 'all',
                limit: limitNum,
                sort: sort
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Population API error:', error);
        
        // Fallback data
        const fallbackData = {
            status: "success",
            endpoint: "/api/population",
            method: "GET",
            total_countries: 3,
            total_population: 1500000000,
            total_population_formatted: "1.5B",
            countries: [
                {
                    name: { common: "Turkey", official: "Republic of Turkey" },
                    population: 84339067,
                    population_formatted: "84.3M"
                },
                {
                    name: { common: "Germany", official: "Federal Republic of Germany" },
                    population: 83240525,
                    population_formatted: "83.2M"
                },
                {
                    name: { common: "France", official: "French Republic" },
                    population: 67391582,
                    population_formatted: "67.4M"
                }
            ],
            filters: {
                country: "all",
                limit: 50,
                sort: "desc"
            },
            timestamp: new Date().toISOString(),
            note: "Fallback data - API temporarily unavailable"
        };

        res.status(200).json(fallbackData);
    }
};

// Nüfus formatlama fonksiyonu
function formatPopulation(population) {
    if (population >= 1000000000) {
        return (population / 1000000000).toFixed(1) + 'B';
    } else if (population >= 1000000) {
        return (population / 1000000).toFixed(1) + 'M';
    } else if (population >= 1000) {
        return (population / 1000).toFixed(1) + 'K';
    }
    return population.toString();
}
