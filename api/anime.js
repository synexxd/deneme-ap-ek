//	Moduller
const express = require("express");
const app = express();
const fs = require('fs');
const path = require('path');
const files = path.join(__dirname, 'api');

//	Sunucu tarafı.
app.set('trust proxy', true);
app.use(express.json());
app.use(express.static('.'));

//	Ana Sayfa
app.get('/', (req, res) => {
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.setHeader('Pragma', 'no-cache');
	res.setHeader('Expires', '0');
	return res.sendFile(path.join(__dirname, 'index.html'));
});

//	Bakım modu
app.use((req, res, next) => {
	const maintenance = false;
	if(maintenance) {
		return res.status(403).send("Sunucu bakımda!");
	}
	next();
});

//	Bu liste web tarafında kullanılacak
app.get('/endpoint', (req, res) => {
	const apis = [];
	fs.readdirSync(files).forEach((file) => {
		const module = require(path.join(files, file));
		const endpoint = file.replace('.js', '');
		const modulez = module.info;
		
		modulez.route = endpoint;
		apis.push(modulez);
	});
	
	return res.status(200).json(apis);
});

//	Dinamik Yönlendirme
app.use(async (req, res, next) => {
	const apis = [];
	const route = req.originalUrl.split('/');
	
	if(route.length < 4 && !route[3]) {
		return res.status(500).send("Mevcut bir api rotası belirtiniz.");
	}
	
	const router = route[3].split('?');
	
	fs.readdirSync(files).forEach((file) => {
		const module = require(path.join(files, file));
		const endpoint = file.replace('.js', '');
		const func = module.function;
		apis.push({
			apiRoute: anime,
			apiFunction: func
		});
	});
	
	const index = apis.find(api => api.apiRoute === router[0])
	
	if( index ) {
		app.all('/api/v1/' + index.apiRoute, index.apiFunction);
	} else if( !index ) {
		return res.status(500).send("Lütfen mevcut olan apileri kullanın");
	}
		
	next();
});// api/anime.js
export default async function handler(req, res) {
  try {
    let tag, amount;
    
    if (req.method === 'POST') {
      ({ tag = 'waifu', amount = 1 } = req.body);
    } else {
      ({ tag = 'waifu', amount = 1 } = req.query);
    }

    amount = Math.min(parseInt(amount), 10);
    const images = [];
    
    for (let i = 0; i < amount; i++) {
      const response = await fetch(`https://api.waifu.pics/sfw/${tag}`);
      const data = await response.json();
      
      images.push({
        imageUrl: data.url
      });
    }

    res.json({
      status: 'success',
      endpoint: '/api/anime',
      method: req.method,
      images: images
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Resimler alınırken hata oluştu: ' + error.message
    });
  }
}