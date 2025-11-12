// app.js
async function testAnimeAPI() {
    const resultsDiv = document.getElementById('demoResults');
    resultsDiv.innerHTML = '<div class="loading">🔄 Resimler yükleniyor...</div>';

    try {
        const response = await fetch('/api/anime', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tag: 'waifu',
                amount: 3
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            resultsDiv.innerHTML = `
                <div class="success">
                    ✅ ${result.images.length} resim başarıyla yüklendi!
                </div>
            `;

            // Resimleri göster
            result.images.forEach(image => {
                const imageDiv = document.createElement('div');
                imageDiv.className = 'image-result';
                imageDiv.innerHTML = `
                    <img src="${image.imageUrl}" alt="${image.tag}" 
                         onload="this.style.display='block'" 
                         style="display:none;">
                    <div style="margin-top: 5px; color: #666; font-size: 14px;">
                        Tag: ${image.tag} | ID: ${image.id}
                    </div>
                `;
                resultsDiv.appendChild(imageDiv);
            });

        } else {
            resultsDiv.innerHTML = `
                <div class="error">
                    ❌ Hata: ${result.message}
                </div>
            `;
        }

    } catch (error) {
        resultsDiv.innerHTML = `
            <div class="error">
                ❌ API hatası: ${error.message}
            </div>
        `;
    }
}

function copyCode() {
    const code = `{
  "status": "success",
  "endpoint": "/api/anime",
  "images": [
    {
      "imageUrl": "https://i.waifu.pics/...",
      "id": 1,
      "tag": "waifu"
    }
  ]
}`;

    navigator.clipboard.writeText(code).then(() => {
        alert('✅ Kod panoya kopyalandı!');
    });
}

// Sayfa yüklendiğinde API'yi otomatik test et
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎌 Anime API hazır!');
});
