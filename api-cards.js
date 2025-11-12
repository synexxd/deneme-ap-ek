// API kartları yönetimi
class ApiCardManager {
    constructor() {
        this.apiCards = [];
    }

    // API kartı oluştur
    createApiCard(data) {
        const card = {
            id: Date.now(),
            method: data.method,
            title: data.title,
            endpoint: data.endpoint,
            description: data.description,
            parameters: data.parameters,
            response: data.response,
            date: data.date
        };

        this.apiCards.push(card);
        return card;
    }

    // API kartını HTML'e dönüştür
    renderApiCard(cardData) {
        const parametersHtml = cardData.parameters.map(param => `
            <div class="parameter-item">
                <div class="checkbox ${param.required ? 'checked' : ''}">
                    ${param.required ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <div class="parameter-name">${param.name}</div>
                <div class="parameter-desc">${param.description}</div>
            </div>
        `).join('');

        return `
            <div class="api-card">
                <div class="api-header">
                    <div class="method-badge">
                        <i class="fas fa-paper-plane"></i>
                        ${cardData.method}
                    </div>
                    <div class="api-title">
                        <i class="fas fa-gamepad"></i>
                        ${cardData.title}
                    </div>
                </div>

                <div class="api-endpoint">
                    ${cardData.endpoint}
                </div>

                <div class="api-description">
                    ${cardData.description}
                </div>

                <div class="parameters-section">
                    <div class="section-title">
                        <i class="fas fa-cog"></i>
                        Parameter:
                    </div>
                    ${parametersHtml}
                </div>

                <div class="response-section">
                    <div class="section-title">
                        <i class="fas fa-reply"></i>
                        Dönüş:
                    </div>
                    <div class="response-code">
                        ${cardData.response}
                    </div>
                </div>

                <div class="api-footer">
                    <div class="date">
                        <i class="far fa-calendar"></i>
                        ${cardData.date}
                    </div>
                    <div class="footer-actions">
                        <button class="copy-btn" onclick="copyToClipboard(this)">
                            <i class="far fa-copy"></i>
                            Kopyala
                        </button>
                        <span class="success-message">
                            <i class="fas fa-check"></i>
                            Kopyalandı!
                        </span>
                    </div>
                </div>
            </div>
        `;
    }
}

// Kopyalama fonksiyonu
function copyToClipboard(button) {
    const card = button.closest('.api-card');
    const responseCode = card.querySelector('.response-code').textContent;
    const successMessage = card.querySelector('.success-message');
    
    navigator.clipboard.writeText(responseCode).then(() => {
        successMessage.style.display = 'inline';
        
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 2000);
    }).catch(err => {
        console.error('Kopyalama hatası:', err);
    });
}

// Örnek API verisi
const animeApiData = {
    method: 'POST',
    title: 'Anime',
    endpoint: '/anime',
    description: 'Anime kızı evinde istermisin?',
    parameters: [
        { name: 'tag', description: 'Anime etiketi', required: false },
        { name: 'amount', description: 'Resim miktarı', required: true }
    ],
    response: `{
    "endpoint": "/anime",
    "images": [
        {
            "imageUrl": "https://example.com/image1.jpg"
        },
        {
            "imageUrl": "https://example.com/image2.jpg"
        }
    ]
}`,
    date: '08.02.2025'
};

// Sayfa yüklendiğinde API kartını oluştur
document.addEventListener('DOMContentLoaded', function() {
    const apiManager = new ApiCardManager();
    const animeCard = apiManager.createApiCard(animeApiData);
    
    const container = document.getElementById('api-cards-container');
    if (container) {
        container.innerHTML = apiManager.renderApiCard(animeCard);
    }
});
