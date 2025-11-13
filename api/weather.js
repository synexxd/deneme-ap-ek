// weather.js - Open-Meteo API Entegrasyonu

class WeatherAPI {
    constructor() {
        this.openMeteoBaseUrl = 'https://api.open-meteo.com/v1';
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    // Tüm 81 ilin koordinatları
    getCityCoordinates(city) {
        const cities = {
            'adana': { lat: 37.0000, lon: 35.3213, name: 'Adana' },
            'adiyaman': { lat: 37.7648, lon: 38.2786, name: 'Adıyaman' },
            'afyonkarahisar': { lat: 38.7638, lon: 30.5403, name: 'Afyonkarahisar' },
            'ağrı': { lat: 39.7191, lon: 43.0503, name: 'Ağrı' },
            'amasya': { lat: 40.6499, lon: 35.8353, name: 'Amasya' },
            'ankara': { lat: 39.9334, lon: 32.8597, name: 'Ankara' },
            'antalya': { lat: 36.8969, lon: 30.7133, name: 'Antalya' },
            'artvin': { lat: 41.1828, lon: 41.8183, name: 'Artvin' },
            'aydın': { lat: 37.8560, lon: 27.8416, name: 'Aydın' },
            'balıkesir': { lat: 39.6484, lon: 27.8826, name: 'Balıkesir' },
            'bilecik': { lat: 40.1500, lon: 29.9833, name: 'Bilecik' },
            'bingöl': { lat: 39.0000, lon: 40.5000, name: 'Bingöl' },
            'bitlis': { lat: 38.4000, lon: 42.1000, name: 'Bitlis' },
            'bolu': { lat: 40.7333, lon: 31.6000, name: 'Bolu' },
            'burdur': { lat: 37.7167, lon: 30.2833, name: 'Burdur' },
            'bursa': { lat: 40.1885, lon: 29.0610, name: 'Bursa' },
            'çanakkale': { lat: 40.1553, lon: 26.4142, name: 'Çanakkale' },
            'çankırı': { lat: 40.6000, lon: 33.6167, name: 'Çankırı' },
            'çorum': { lat: 40.5506, lon: 34.9556, name: 'Çorum' },
            'denizli': { lat: 37.7731, lon: 29.0872, name: 'Denizli' },
            'diyarbakır': { lat: 37.9100, lon: 40.2400, name: 'Diyarbakır' },
            'edirne': { lat: 41.6772, lon: 26.5560, name: 'Edirne' },
            'elazığ': { lat: 38.6810, lon: 39.2264, name: 'Elazığ' },
            'erzincan': { lat: 39.7500, lon: 39.5000, name: 'Erzincan' },
            'erzurum': { lat: 39.9000, lon: 41.2700, name: 'Erzurum' },
            'eskişehir': { lat: 39.7767, lon: 30.5206, name: 'Eskişehir' },
            'gaziantep': { lat: 37.0667, lon: 37.3833, name: 'Gaziantep' },
            'giresun': { lat: 40.9128, lon: 38.3895, name: 'Giresun' },
            'gümüşhane': { lat: 40.4603, lon: 39.4814, name: 'Gümüşhane' },
            'hakkari': { lat: 37.5774, lon: 43.7368, name: 'Hakkari' },
            'hatay': { lat: 36.4018, lon: 36.3498, name: 'Hatay' },
            'ısparta': { lat: 37.7648, lon: 30.5566, name: 'Isparta' },
            'mersin': { lat: 36.8000, lon: 34.6333, name: 'Mersin' },
            'istanbul': { lat: 41.0082, lon: 28.9784, name: 'İstanbul' },
            'izmir': { lat: 38.4237, lon: 27.1428, name: 'İzmir' },
            'kars': { lat: 40.5927, lon: 43.0774, name: 'Kars' },
            'kastamonu': { lat: 41.3767, lon: 33.7767, name: 'Kastamonu' },
            'kayseri': { lat: 38.7333, lon: 35.4833, name: 'Kayseri' },
            'kırklareli': { lat: 41.7333, lon: 27.2167, name: 'Kırklareli' },
            'kırşehir': { lat: 39.1458, lon: 34.1639, name: 'Kırşehir' },
            'kocaeli': { lat: 40.8533, lon: 29.8815, name: 'Kocaeli' },
            'konya': { lat: 37.8667, lon: 32.4833, name: 'Konya' },
            'kütahya': { lat: 39.4167, lon: 29.9833, name: 'Kütahya' },
            'malatya': { lat: 38.3552, lon: 38.3095, name: 'Malatya' },
            'manisa': { lat: 38.6191, lon: 27.4289, name: 'Manisa' },
            'kahramanmaraş': { lat: 37.5858, lon: 36.9371, name: 'Kahramanmaraş' },
            'mardin': { lat: 37.3212, lon: 40.7245, name: 'Mardin' },
            'muğla': { lat: 37.2167, lon: 28.3667, name: 'Muğla' },
            'muş': { lat: 38.9462, lon: 41.7539, name: 'Muş' },
            'nevşehir': { lat: 38.6939, lon: 34.6857, name: 'Nevşehir' },
            'niğde': { lat: 37.9667, lon: 34.6833, name: 'Niğde' },
            'ordu': { lat: 40.9839, lon: 37.8764, name: 'Ordu' },
            'rize': { lat: 41.0201, lon: 40.5234, name: 'Rize' },
            'sakarya': { lat: 40.6940, lon: 30.4358, name: 'Sakarya' },
            'samsun': { lat: 41.2867, lon: 36.3300, name: 'Samsun' },
            'siirt': { lat: 37.9443, lon: 41.9329, name: 'Siirt' },
            'sinop': { lat: 42.0264, lon: 35.1551, name: 'Sinop' },
            'sivas': { lat: 39.7477, lon: 37.0179, name: 'Sivas' },
            'tekirdağ': { lat: 40.9833, lon: 27.5167, name: 'Tekirdağ' },
            'tokat': { lat: 40.3167, lon: 36.5500, name: 'Tokat' },
            'trabzon': { lat: 41.0015, lon: 39.7178, name: 'Trabzon' },
            'tunceli': { lat: 39.1071, lon: 39.5400, name: 'Tunceli' },
            'şanlıurfa': { lat: 37.1591, lon: 38.7969, name: 'Şanlıurfa' },
            'uşak': { lat: 38.6823, lon: 29.4082, name: 'Uşak' },
            'van': { lat: 38.4891, lon: 43.4089, name: 'Van' },
            'yozgat': { lat: 39.8200, lon: 34.8044, name: 'Yozgat' },
            'zonguldak': { lat: 41.4564, lon: 31.7987, name: 'Zonguldak' },
            'aksaray': { lat: 38.3687, lon: 34.0370, name: 'Aksaray' },
            'bayburt': { lat: 40.2552, lon: 40.2249, name: 'Bayburt' },
            'karaman': { lat: 37.1819, lon: 33.2181, name: 'Karaman' },
            'kırıkkale': { lat: 39.8468, lon: 33.5153, name: 'Kırıkkale' },
            'batman': { lat: 37.8812, lon: 41.1351, name: 'Batman' },
            'şırnak': { lat: 37.5164, lon: 42.4611, name: 'Şırnak' },
            'bartın': { lat: 41.6344, lon: 32.3375, name: 'Bartın' },
            'ardahan': { lat: 41.1105, lon: 42.7022, name: 'Ardahan' },
            'ığdır': { lat: 39.9167, lon: 44.0333, name: 'Iğdır' },
            'yalova': { lat: 40.6500, lon: 29.2667, name: 'Yalova' },
            'karabük': { lat: 41.2000, lon: 32.6333, name: 'Karabük' },
            'kilis': { lat: 36.7161, lon: 37.1150, name: 'Kilis' },
            'osmaniye': { lat: 37.0686, lon: 36.2619, name: 'Osmaniye' },
            'düzce': { lat: 40.8433, lon: 31.1567, name: 'Düzce' }
        };

        const normalizedCity = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        return cities[normalizedCity] || null;
    }

    // Hava durumu açıklamasını Türkçe'ye çevir
    getWeatherDescription(code) {
        const descriptions = {
            0: 'Açık',
            1: 'Çoğunlukla açık', 
            2: 'Parçalı bulutlu',
            3: 'Bulutlu',
            45: 'Sisli',
            48: 'Kırağılı sis',
            51: 'Hafif çisenti',
            53: 'Orta çisenti', 
            55: 'Yoğun çisenti',
            56: 'Hafif donan çisenti',
            57: 'Yoğun donan çisenti',
            61: 'Hafif yağmurlu',
            63: 'Orta yağmurlu',
            65: 'Şiddetli yağmurlu',
            66: 'Hafif donan yağmur',
            67: 'Şiddetli donan yağmur', 
            71: 'Hafif kar',
            73: 'Orta kar',
            75: 'Şiddetli kar',
            77: 'Kar taneleri',
            80: 'Hafif sağanak',
            81: 'Orta sağanak',
            82: 'Şiddetli sağanak',
            85: 'Hafif kar sağanağı',
            86: 'Şiddetli kar sağanağı',
            95: 'Gök gürültülü fırtına',
            96: 'Hafif dolu fırtınası',
            99: 'Şiddetli dolu fırtınası'
        };

        return descriptions[code] || 'Bilinmeyen';
    }

    // Rüzgar yönünü Türkçe'ye çevir
    getWindDirection(degree) {
        const directions = [
            { min: 337.5, max: 22.5, dir: 'K' },
            { min: 22.5, max: 67.5, dir: 'KD' },
            { min: 67.5, max: 112.5, dir: 'D' },
            { min: 112.5, max: 157.5, dir: 'GD' },
            { min: 157.5, max: 202.5, dir: 'G' },
            { min: 202.5, max: 247.5, dir: 'GB' },
            { min: 247.5, max: 292.5, dir: 'B' },
            { min: 292.5, max: 337.5, dir: 'KB' }
        ];

        for (let direction of directions) {
            if (degree >= direction.min && degree < direction.max) {
                return direction.dir;
            }
        }
        return 'Bilinmiyor';
    }

    // Open-Meteo API'den hava durumu verilerini al
    async getWeatherFromOpenMeteo(city) {
        const cityCoords = this.getCityCoordinates(city);
        
        if (!cityCoords) {
            throw new Error('Şehir bulunamadı. Lütfen Türkiye\'deki 81 ilden birini yazın.');
        }

        // Mevcut hava durumu ve 7 günlük tahmin
        const url = `${this.openMeteoBaseUrl}/forecast?latitude=${cityCoords.lat}&longitude=${cityCoords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('API isteği başarısız oldu');
        }
        
        const data = await response.json();

        if (!data.current || !data.daily) {
            throw new Error('Hava durumu verisi alınamadı');
        }

        return {
            current: data.current,
            forecast: data.daily,
            city: cityCoords.name
        };
    }

    // Hava durumu sorgula
    async getWeather() {
        const cityInput = document.getElementById('weatherCity');
        const city = cityInput.value.trim();
        const resultElement = document.getElementById('weatherResult');

        if (!city) {
            this.showResult('⚠️ Lütfen bir şehir adı girin!', 'error');
            return;
        }

        try {
            this.showResult('⏳ Hava durumu sorgulanıyor...', 'info');

            const weatherData = await this.getWeatherFromOpenMeteo(city);
            this.displayWeather(weatherData);

        } catch (error) {
            console.error('Hava durumu hatası:', error);
            this.showResult(`❌ ${error.message}`, 'error');
        }
    }

    // Hava durumu verilerini göster
    displayWeather(data) {
        const resultElement = document.getElementById('weatherResult');
        const current = data.current;
        const forecast = data.daily;

        // Tarih formatını düzelt
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('tr-TR', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short' 
            });
        };

        const weatherHTML = `
            <div class="weather-card">
                <div class="weather-header">
                    <h3>${data.city}, Türkiye</h3>
                    <div class="weather-main">
                        <div class="weather-temp">${Math.round(current.temperature_2m)}°C</div>
                        <div class="weather-desc">${this.getWeatherDescription(current.weather_code)}</div>
                        <div class="weather-feels">Hissedilen: ${Math.round(current.apparent_temperature)}°C</div>
                    </div>
                </div>
                <div class="weather-details">
                    <div class="weather-detail">
                        <span class="detail-label">Nem:</span>
                        <span class="detail-value">${current.relative_humidity_2m}%</span>
                    </div>
                    <div class="weather-detail">
                        <span class="detail-label">Rüzgar:</span>
                        <span class="detail-value">${Math.round(current.wind_speed_10m)} km/s ${this.getWindDirection(current.wind_direction_10m)}</span>
                    </div>
                    <div class="weather-detail">
                        <span class="detail-label">Basınç:</span>
                        <span class="detail-value">${Math.round(current.pressure_msl)} hPa</span>
                    </div>
                    <div class="weather-detail">
                        <span class="detail-label">Yağış:</span>
                        <span class="detail-value">${current.precipitation || 0} mm</span>
                    </div>
                </div>
                <div class="weather-forecast">
                    <h4>7 Günlük Tahmin</h4>
                    <div class="forecast-items">
                        ${forecast.time.map((date, index) => `
                            <div class="forecast-item">
                                <div class="forecast-date">${formatDate(date)}</div>
                                <div class="forecast-temp">${Math.round(forecast.temperature_2m_min[index])}° / ${Math.round(forecast.temperature_2m_max[index])}°</div>
                                <div class="forecast-desc">${this.getWeatherDescription(forecast.weather_code[index])}</div>
                                <div class="forecast-precip">${forecast.precipitation_sum[index] || 0} mm</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="weather-source">
                    <small>Veri kaynağı: Open-Meteo API</small>
                </div>
            </div>
        `;

        resultElement.innerHTML = weatherHTML;
        resultElement.className = 'weather-result success';
        resultElement.style.display = 'block';
    }

    // Sonuç mesajını göster
    showResult(message, type) {
        const resultElement = document.getElementById('weatherResult');
        resultElement.textContent = message;
        resultElement.className = `weather-result ${type}`;
        resultElement.style.display = 'block';
    }

    // Event listener'ları kur
    setupEventListeners() {
        // Sorgula butonu
        document.getElementById('getWeather').addEventListener('click', () => {
            this.getWeather();
        });

        // Input'ta Enter tuşu desteği
        document.getElementById('weatherCity').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.getWeather();
            }
        });
    }
}

// Sayfa yüklendiğinde Weather API'yi başlat
document.addEventListener('DOMContentLoaded', function() {
    window.weatherAPI = new WeatherAPI();
});