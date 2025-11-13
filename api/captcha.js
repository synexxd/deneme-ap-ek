// captcha.js - Placeholder Resimli CAPTCHA Sistemi

class ImageCaptcha {
    constructor() {
        this.currentChallenge = null;
        this.selectedImages = [];
        this.categories = [
            {
                name: 'trafik',
                question: 'Trafik ışıklarını seçin',
                color: '#FF6B6B'
            },
            {
                name: 'araba',
                question: 'Arabaları seçin',
                color: '#4ECDC4'
            },
            {
                name: 'köpek',
                question: 'Köpekleri seçin',
                color: '#45B7D1'
            },
            {
                name: 'kedi',
                question: 'Kedileri seçin',
                color: '#FFD93D'
            },
            {
                name: 'ağaç',
                question: 'Ağaçları seçin',
                color: '#6BCF7F'
            },
            {
                name: 'bina',
                question: 'Binaları seçin',
                color: '#9B59B6'
            }
        ];
        this.init();
    }

    init() {
        this.generateCaptcha();
        this.setupEventListeners();
    }

    // Placeholder resim URL'leri
    getImageUrls(categoryName, categoryColor) {
        const baseColor = categoryColor || '#667eea';
        const text = categoryName.toUpperCase();
        
        return [
            `https://via.placeholder.com/200x150/${baseColor.replace('#', '')}/FFFFFF?text=${text}+1`,
            `https://via.placeholder.com/200x150/${baseColor.replace('#', '')}/FFFFFF?text=${text}+2`,
            `https://via.placeholder.com/200x150/${baseColor.replace('#', '')}/FFFFFF?text=${text}+3`
        ];
    }

    // CAPTCHA oluştur
    generateCaptcha() {
        // Rastgele kategori seç
        const correctCategory = this.categories[Math.floor(Math.random() * this.categories.length)];
        const otherCategories = this.categories.filter(cat => cat.name !== correctCategory.name);
        
        // 9 resim oluştur (3 doğru, 6 yanlış)
        const images = [];
        
        // Doğru kategoriden 3 resim
        const correctImages = this.getImageUrls(correctCategory.name, correctCategory.color);
        for (let i = 0; i < 3; i++) {
            images.push({
                url: correctImages[i],
                category: correctCategory.name,
                isCorrect: true,
                color: correctCategory.color
            });
        }
        
        // Yanlış kategorilerden 6 resim
        for (let i = 0; i < 6; i++) {
            const randomCategory = otherCategories[Math.floor(Math.random() * otherCategories.length)];
            const wrongImages = this.getImageUrls(randomCategory.name, randomCategory.color);
            images.push({
                url: wrongImages[i % wrongImages.length],
                category: randomCategory.name,
                isCorrect: false,
                color: randomCategory.color
            });
        }
        
        // Resimleri karıştır
        this.shuffleArray(images);
        
        this.currentChallenge = {
            question: correctCategory.question,
            images: images,
            correctCategory: correctCategory.name
        };
        
        this.selectedImages = [];
        this.renderCaptcha();
        this.hideResult();
        
        return this.currentChallenge;
    }

    // CAPTCHA'yı ekranda göster
    renderCaptcha() {
        const questionElement = document.getElementById('captchaQuestion');
        const imagesContainer = document.getElementById('captchaImages');
        
        questionElement.textContent = this.currentChallenge.question;
        imagesContainer.innerHTML = '';
        
        this.currentChallenge.images.forEach((image, index) => {
            const imageElement = document.createElement('div');
            imageElement.className = 'captcha-image';
            imageElement.innerHTML = `
                <img src="${image.url}" alt="${image.category} resim ${index + 1}" loading="lazy">
                <div class="captcha-image-overlay">✓</div>
            `;
            
            imageElement.addEventListener('click', () => {
                this.toggleImageSelection(index);
            });
            
            imagesContainer.appendChild(imageElement);
        });
    }

    // Resim seçimi
    toggleImageSelection(index) {
        const imageElement = document.querySelectorAll('.captcha-image')[index];
        const isSelected = this.selectedImages.includes(index);
        
        if (isSelected) {
            // Seçimi kaldır
            this.selectedImages = this.selectedImages.filter(i => i !== index);
            imageElement.classList.remove('selected');
        } else {
            // Seçimi ekle
            this.selectedImages.push(index);
            imageElement.classList.add('selected');
        }
        
        // Otomatik doğrulama (3 resim seçildiğinde)
        if (this.selectedImages.length === 3) {
            setTimeout(() => {
                this.verifyCaptcha();
            }, 500);
        }
    }

    // CAPTCHA doğrulama
    verifyCaptcha() {
        if (this.selectedImages.length === 0) {
            this.showResult('⚠️ Lütfen resimleri seçin!', 'error');
            return false;
        }
        
        // Doğru resimleri kontrol et
        const correctSelections = this.selectedImages.filter(index => 
            this.currentChallenge.images[index].isCorrect
        );
        
        const allCorrect = correctSelections.length === 3 && 
                          this.selectedImages.length === 3;
        
        if (allCorrect) {
            this.showResult('✅ CAPTCHA başarıyla doğrulandı!', 'success');
            return true;
        } else {
            this.showResult('❌ Yanlış seçim! Lütfen tekrar deneyin.', 'error');
            // Hatalı girişte yeni CAPTCHA
            setTimeout(() => {
                this.generateCaptcha();
            }, 2000);
            return false;
        }
    }

    // Dizi karıştırma
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
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

    // Event listener'ları kur
    setupEventListeners() {
        // Yenile butonu
        document.getElementById('reloadCaptcha').addEventListener('click', () => {
            this.generateCaptcha();
        });
    }

    // CAPTCHA'yı manuel olarak yenile
    refresh() {
        return this.generateCaptcha();
    }

    // Mevcut CAPTCHA'yı al
    getCurrentChallenge() {
        return this.currentChallenge;
    }
}

// Sayfa yüklendiğinde CAPTCHA'yı başlat
document.addEventListener('DOMContentLoaded', function() {
    window.imageCaptcha = new ImageCaptcha();
});

// API fonksiyonları
window.CaptchaAPI = {
    generate: function() {
        return window.imageCaptcha.generateCaptcha();
    },
    
    verify: function() {
        return window.imageCaptcha.verifyCaptcha();
    },
    
    refresh: function() {
        return window.imageCaptcha.refresh();
    },
    
    getCurrent: function() {
        return window.imageCaptcha.getCurrentChallenge();
    }
};