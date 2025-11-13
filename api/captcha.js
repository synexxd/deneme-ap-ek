// captcha.js - Canvas Kullanmadan CAPTCHA Sistemi

class SimpleCaptcha {
    constructor() {
        this.currentCaptcha = '';
        this.captchaLength = 7;
        this.apiBaseUrl = window.location.origin + '/api';
        this.init();
    }

    init() {
        this.generateCaptcha();
        this.setupEventListeners();
    }

    // CAPTCHA kodu oluştur (7 haneli sayı)
    generateCaptcha() {
        let captcha = '';
        for (let i = 0; i < this.captchaLength; i++) {
            captcha += Math.floor(Math.random() * 10);
        }
        this.currentCaptcha = captcha;
        this.renderCaptchaDisplay();
        this.clearInput();
        this.hideResult();
        return captcha;
    }

    // CAPTCHA görselini oluştur (canvas yerine HTML/CSS)
    renderCaptchaDisplay() {
        const captchaDisplay = document.getElementById('captchaDisplay');
        
        // CAPTCHA kodunu parçalara ayır ve stil uygula
        const captchaHTML = this.currentCaptcha.split('').map((digit, index) => {
            // Her rakam için rastgele stil
            const rotation = (Math.random() - 0.5) * 15; // -15° ile +15° arası
            const scale = 0.8 + Math.random() * 0.4; // 0.8x ile 1.2x arası
            const colorVariation = Math.floor(Math.random() * 50); // Renk varyasyonu
            
            return `
                <span class="captcha-digit" 
                      style="transform: rotate(${rotation}deg) scale(${scale});
                             color: rgb(${50 + colorVariation}, ${50 + colorVariation}, ${50 + colorVariation});
                             display: inline-block;
                             margin: 0 2px;
                             font-weight: bold;
                             font-size: ${24 + Math.random() * 8}px;">
                    ${digit}
                </span>
            `;
        }).join('');

        captchaDisplay.innerHTML = `
            <div class="captcha-container-inner">
                <div class="captcha-background">
                    ${this.generateNoiseLines()}
                    ${captchaHTML}
                    ${this.generateNoiseDots()}
                </div>
            </div>
        `;
    }

    // Gürültü çizgileri oluştur
    generateNoiseLines() {
        let linesHTML = '';
        for (let i = 0; i < 8; i++) {
            const width = 60 + Math.random() * 80;
            const rotation = (Math.random() - 0.5) * 60;
            const opacity = 0.1 + Math.random() * 0.3;
            const top = Math.random() * 100;
            const left = Math.random() * 100;
            
            linesHTML += `
                <div class="noise-line" 
                     style="width: ${width}px;
                            transform: rotate(${rotation}deg);
                            opacity: ${opacity};
                            top: ${top}%;
                            left: ${left}%;">
                </div>
            `;
        }
        return linesHTML;
    }

    // Gürültü noktaları oluştur
    generateNoiseDots() {
        let dotsHTML = '';
        for (let i = 0; i < 20; i++) {
            const size = 1 + Math.random() * 3;
            const opacity = 0.1 + Math.random() * 0.4;
            const top = Math.random() * 100;
            const left = Math.random() * 100;
            
            dotsHTML += `
                <div class="noise-dot" 
                     style="width: ${size}px;
                            height: ${size}px;
                            opacity: ${opacity};
                            top: ${top}%;
                            left: ${left}%;">
                </div>
            `;
        }
        return dotsHTML;
    }

    // CAPTCHA doğrulama
    async verifyCaptcha() {
        const userInput = document.getElementById('captchaInput').value;
        const resultElement = document.getElementById('captchaResult');
        
        // Giriş kontrolü
        if (!userInput) {
            this.showResult('⚠️ Lütfen CAPTCHA kodunu girin!', 'error');
            return false;
        }
        
        if (userInput.length !== this.captchaLength) {
            this.showResult(`⚠️ Kod ${this.captchaLength} haneli olmalı!`, 'error');
            return false;
        }
        
        // Sadece sayı kontrolü
        if (!/^\d+$/.test(userInput)) {
            this.showResult('⚠️ Sadece rakam giriniz!', 'error');
            return false;
        }
        
        // Backend API'ye doğrulama isteği gönder
        try {
            this.showResult('⏳ Doğrulanıyor...', 'info');
            
            // Backend API'yi kullan
            const response = await fetch(this.apiBaseUrl + '/captcha/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: userInput
                })
            });
            
            const data = await response.json();
            
            if (data.verified) {
                this.showResult('✅ CAPTCHA başarıyla doğrulandı!', 'success');
                return true;
            } else {
                this.showResult('❌ CAPTCHA kodu hatalı!', 'error');
                this.generateCaptcha();
                return false;
            }
            
        } catch (error) {
            // Backend API çalışmıyorsa client-side doğrulama
            console.log('Backend API hatası, client-side doğrulama kullanılıyor:', error);
            
            if (userInput === this.currentCaptcha) {
                this.showResult('✅ CAPTCHA başarıyla doğrulandı!', 'success');
                return true;
            } else {
                this.showResult('❌ CAPTCHA kodu hatalı!', 'error');
                this.generateCaptcha();
                return false;
            }
        }
    }

    // Backend API'den CAPTCHA oluştur
    async generateCaptchaFromAPI() {
        try {
            const response = await fetch(this.apiBaseUrl + '/captcha');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.currentCaptcha = data.code;
                this.renderCaptchaDisplay();
                this.clearInput();
                this.hideResult();
            }
        } catch (error) {
            console.log('Backend API hatası, client-side CAPTCHA kullanılıyor:', error);
            this.generateCaptcha();
        }
    }

    // Sonuç mesajını göster
    showResult(message, type) {
        const resultElement = document.getElementById('captchaResult');
        resultElement.textContent = message;
        resultElement.className = `captcha-result ${type}`;
        resultElement.style.display = 'block';
    }

    // Sonuç mesajını gizle
    hideResult() {
        const resultElement = document.getElementById('captchaResult');
        resultElement.style.display = 'none';
    }

    // Input'u temizle
    clearInput() {
        document.getElementById('captchaInput').value = '';
    }

    // Event listener'ları kur
    setupEventListeners() {
        // Input'ta Enter tuşu desteği
        document.getElementById('captchaInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.verifyCaptcha();
            }
        });
        
        // Sadece rakam girişi
        document.getElementById('captchaInput').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        });
        
        // Yenile butonu
        document.getElementById('reloadCaptcha').addEventListener('click', () => {
            this.generateCaptchaFromAPI();
        });
        
        // Doğrula butonu
        document.getElementById('verifyCaptcha').addEventListener('click', () => {
            this.verifyCaptcha();
        });
        
        // Input temizleme
        document.getElementById('captchaInput').addEventListener('focus', () => {
            this.hideResult();
        });
    }

    // CAPTCHA'yı manuel olarak yenile
    refresh() {
        return this.generateCaptchaFromAPI();
    }

    // Mevcut CAPTCHA kodunu al
    getCurrentCaptcha() {
        return this.currentCaptcha;
    }
}

// Sayfa yüklendiğinde CAPTCHA'yı başlat
document.addEventListener('DOMContentLoaded', function() {
    window.simpleCaptcha = new SimpleCaptcha();
});

// API fonksiyonları
window.CaptchaAPI = {
    generate: function() {
        return window.simpleCaptcha.generateCaptchaFromAPI();
    },
    
    verify: function() {
        return window.simpleCaptcha.verifyCaptcha();
    },
    
    refresh: function() {
        return window.simpleCaptcha.refresh();
    },
    
    getCurrent: function() {
        return window.simpleCaptcha.getCurrentCaptcha();
    }
};