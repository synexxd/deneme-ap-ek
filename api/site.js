// api/site.js
export default async function handler(req, res) {
  try {
    let { site = 'discord' } = req.method === 'POST' ? req.body : req.query;
    
    const apiData = await fetch(`https://free.zirveexec.com/api_public.php?site=${site}`)
      .then(r => r.json())
      .catch(() => ({ error: 'API çalışmıyor' }));

    res.json(apiData);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}
