// api/site.js
export default async function handler(req, res) {
  try {
    let { site = 'discord' } = req.method === 'POST' ? req.body : req.query;
    
    const response = await fetch(`https://free.zirveexec.com/api_public.php?site=${site}`);
    const textData = await response.text();
    
    // JSON'a çevir
    let jsonData;
    try {
      jsonData = JSON.parse(textData);
    } catch {
      // JSON değilse manuel çevir
      jsonData = {
        raw_data: textData,
        site: site,
        timestamp: new Date().toISOString(),
        status: "success"
      };
    }
    
    res.json(jsonData);

  } catch (error) {
    res.status(500).json({
      error: error.message,
      status: "error"
    });
  }
}