// captcha.js - Google Resimli CAPTCHA Sistemi

class ImageCaptcha {
    constructor() {
        this.currentChallenge = null;
        this.selectedImages = [];
        this.categories = [
            {
                name: 'trafik',
                question: 'Trafik ışıklarını seçin',
                keywords: ['traffic light', 'stop light', 'signal light']
            },
            {
                name: 'araba',
                question: 'Arabaları seçin',
                keywords: ['car', 'automobile', 'vehicle']
            },
            {
                name: 'köpek',
                question: 'Köpekleri seçin',
                keywords: ['dog', 'puppy', 'canine']
            },
            {
                name: 'kedi',
                question: 'Kedileri seçin',
                keywords: ['cat', 'kitten', 'feline']
            },
            {
                name: 'ağaç',
                question: 'Ağaçları seçin',
                keywords: ['tree', 'forest', 'wood']
            },
            {
                name: 'bina',
                question: 'Binaları seçin',
                keywords: ['building', 'house', 'architecture']
            }
        ];
        this.init();
    }

    init() {
        this.generateCaptcha();
        this.setupEventListeners();
    }

    // Düzgün çalışan resim URL'leri
    getImageUrls(keyword) {
        const imageCollections = {
            'trafik': [
                'https://images.unsplash.com/photo-1580391565090-8a0d1d14528f?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1558553955-45344058d6fb?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1580560010415-67527b764848?w=200&h=150&fit=crop'
            ],
            'araba': [
                'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=200&h=150&fit=crop'
            ],
            'köpek': [
                'https://images.unsplash.com/photo-1517423738875-5ce310acd3da?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=200&h=150&fit=crop'
            ],
            'kedi': [
                'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=200&h=150&fit=crop'
            ],
            'ağaç': [
                'https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1503435980610-a51f3ddfee50?w=200&h=150&fit=crop'
            ],
            'bina': [
                'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1503387769-00ec6eccf2e7?w=200&h=150&fit=crop',
                'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=200&h=150&fit=crop'
            ]
        };
        
        return imageCollections[keyword] || [
            'https://images.unsplash.com/photo-1579546929662-711aa81148cf?w=200&h=150&fit=crop',
            'https://images.unsplash.com/photo-1557683316-973673baf926?w=200&h=150&fit=crop',
            'https://images.unsplash.com/photo-1558636508-e2180cb7c4e9?w=200&h=150&fit=crop'
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
        const correctImages = this.getImageUrls(correctCategory.name);
        for (let i = 0; i < 3; i++) {
            images.push({
                url: correctImages[i % correctImages.length],
                category: correctCategory.name,
                isCorrect: true
            });
        }
        
        // Yanlış kategorilerden 6 resim
        for (let i = 0; i < 6; i++) {
            const randomCategory = otherCategories[Math.floor(Math.random() * otherCategories.length)];
            const wrongImages = this.getImageUrls(randomCategory.name);
            images.push({
                url: wrongImages[i % wrongImages.length],
                category: randomCategory.name,
                isCorrect: false
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
                <img src="${image.url}" alt="CAPTCHA resim ${index + 1}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x150/667eea/ffffff?text=Resim+Yükleniyor'">
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