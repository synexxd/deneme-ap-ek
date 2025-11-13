// captcha.js - 7 Haneli Sayı CAPTCHA Sistemi

class SimpleCaptcha {
    constructor() {
        this.currentCaptcha = '';
        this.captchaLength = 7;
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
            captcha += Math.floor(Math.random() * 10); // 0-9 arası rakam
        }
        this.currentCaptcha = captcha;
        this.renderCaptchaImage();
        this.clearInput();
        this.hideResult();
        return captcha;
    }

    // CAPTCHA görselini oluştur
    renderCaptchaImage() {
        const canvas = document.getElementById('captchaCanvas');
        const ctx = canvas.getContext('2d');
        
        // Canvas'ı temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Arkaplan gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Gürültü çizgileri (harfleri tam kaplamayacak)
        for (let i = 0; i < 15; i++) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.4 + 0.2})`;
            ctx.lineWidth = Math.random() * 1.5 + 0.5;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }
        
        // Noktalar
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
            ctx.beginPath();
            ctx.arc(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                Math.random() * 1.5,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        
        // Metin (7 haneli sayı)
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Her rakam için farklı efekt
        const charSpacing = 35;
        const startX = canvas.width / 2 - ((this.captchaLength - 1) * charSpacing) / 2;
        
        for (let i = 0; i < this.captchaLength; i++) {
            const char = this.currentCaptcha[i];
            const x = startX + i * charSpacing;
            const y = canvas.height / 2;
            
            // Hafif döndürme (-10° ile +10° arası)
            const rotation = (Math.random() - 0.5) * 0.3;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            
            // Gölge efekti
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            ctx.fillText(char, 0, 0);
            ctx.restore();
        }
        
        // Ek çizgiler (rakamların üstüne ama tam kaplamayacak)
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = `rgba(0, 0, 0, ${Math.random() * 0.3 + 0.1})`;
            ctx.lineWidth = Math.random() * 2 + 1;
            ctx.beginPath();
            
            const startX = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
            const startY = Math.random() * canvas.height * 0.6 + canvas.height * 0.2;
            const endX = startX + (Math.random() - 0.5) * 100;
            const endY = startY + (Math.random() - 0.5) * 50;
            
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    // CAPTCHA doğrulama
    verifyCaptcha() {
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
        
        // Doğrulama
        if (userInput === this.currentCaptcha) {
            this.showResult('✅ CAPTCHA başarıyla doğrulandı!', 'success');
            return true;
        } else {
            this.showResult('❌ CAPTCHA kodu hatalı! Lütfen tekrar deneyin.', 'error');
            this.generateCaptcha(); // Hatalı girişte yeni CAPTCHA
            return false;
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
            this.generateCaptcha();
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
        return this.generateCaptcha();
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
        return window.simpleCaptcha.generateCaptcha();
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