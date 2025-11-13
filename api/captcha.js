// captcha.js - Basit Resimli CAPTCHA Sistemi

class SimpleCaptcha {
    constructor() {
        this.currentCaptcha = '';
        this.captchaLength = 6;
        this.chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O ve 0, I ve 1 karışmaması için
        this.init();
    }

    init() {
        this.generateCaptcha();
        this.setupEventListeners();
    }

    // CAPTCHA kodu oluştur
    generateCaptcha() {
        let captcha = '';
        for (let i = 0; i < this.captchaLength; i++) {
            captcha += this.chars.charAt(Math.floor(Math.random() * this.chars.length));
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
        
        // Arkaplan
        ctx.fillStyle = '#667eea';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Gürültü çizgileri
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
            ctx.lineWidth = Math.random() * 2 + 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }
        
        // Noktalar
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                Math.random() * 2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        
        // Metin
        ctx.font = 'bold 35px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Her karakter için farklı efekt
        const charSpacing = 30;
        const startX = canvas.width / 2 - ((this.captchaLength - 1) * charSpacing) / 2;
        
        for (let i = 0; i < this.captchaLength; i++) {
            const char = this.currentCaptcha[i];
            const x = startX + i * charSpacing;
            const y = canvas.height / 2;
            
            // Hafif döndürme
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((Math.random() - 0.5) * 0.4);
            
            // Gölge efekti
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            ctx.fillText(char, 0, 0);
            ctx.restore();
        }
    }

    // CAPTCHA doğrulama
    verifyCaptcha() {
        const userInput = document.getElementById('captchaInput').value.toUpperCase();
        const resultElement = document.getElementById('captchaResult');
        
        // Giriş kontrolü
        if (!userInput) {
            this.showResult('⚠️ Lütfen CAPTCHA kodunu girin!', 'error');
            return false;
        }
        
        if (userInput.length !== this.captchaLength) {
            this.showResult(`⚠️ Kod ${this.captchaLength} karakter olmalı!`, 'error');
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
    
    verify: function(input) {
        return window.simpleCaptcha.verifyCaptcha(input);
    },
    
    refresh: function() {
        return window.simpleCaptcha.refresh();
    },
    
    getCurrent: function() {
        return window.simpleCaptcha.getCurrentCaptcha();
    }
};