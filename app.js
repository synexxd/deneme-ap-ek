// app.js
async function testAnimeAPI() {
    const resultsDiv = document.getElementById('demoResults');
    const tag = document.getElementById('demoTag').value;
    const amount = document.getElementById('demoAmount').value;
    const method = document.getElementById('demoMethod').value;

    resultsDiv.innerHTML = '<div class="loading">🔄 Resimler yükleniyor...</div>';

    try {
        let response;
        const url = `/api/anime?tag=${tag}&amount=${amount}`;

        if (method === 'GET') {
            // GET request
            response = await fetch(url);
        } else {
            // POST request
            response = await fetch('/api/anime', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tag: tag,
                    amount: parseInt(amount)
                })
            });
        }

        const result = await response.json();

        if (result.status === 'success') {
            resultsDiv.innerHTML = `
                <div class="success">
                    ✅ ${result.images.length} resim başarıyla yüklendi!
                </div>
                <div class="request-info">
                    Method: ${result.method} | Tag: ${tag} | Amount: ${amount}
                </div>
            `;

            // Resimleri grid olarak göster
            const imagesGrid = document.createElement('div');
            imagesGrid.className = 'images-grid';
            
            result.images.forEach(image => {
                const imageDiv = document.createElement('div');
                imageDiv.className = 'image-result';
                imageDiv.innerHTML = `
                    <img src="${image.imageUrl}" alt="${image.tag}" 
                         onload="this.style.opacity='1'" 
                         style="opacity:0; transition: opacity 0.3s;">
                    <div class="image-info">
                        ${image.tag} - #${image.id}
                    </div>
                `;
                imagesGrid.appendChild(imageDiv);
            });
            
            resultsDiv.appendChild(imagesGrid);

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
    const code = `// GET Request
fetch('/api/anime?tag=waifu&amount=2')
  .then(response => response.json())
  .then(data => console.log(data));

// POST Request  
fetch('/api/anime', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tag: 'waifu',
    amount: 2
  })
})
.then(response => response.json())
.then(data => console.log(data));`;

    navigator.clipboard.writeText(code).then(() => {
        alert('✅ Kod panoya kopyalandı!');
    });
}

// Sayfa yüklendiğinde örnek çalıştır
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎌 Anime API hazır! GET ve POST destekli.');
});