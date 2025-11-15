// api/site.js
export default async function handler(req, res) {
  try {
    let { site = 'discord' } = req.method === 'POST' ? req.body : req.query;
    
    const response = await fetch(`https://free.zirveexec.com/api_public.php?site=${site}`);
    const data = await response.text();
    
    // JSON parse etmeye çalış, değilse direkt döndür
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch {
      res.send(data);
    }

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}