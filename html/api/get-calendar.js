export default async function handler(req, res) {
  // Nastavení CORS hlaviček, aby frontend mohl data přečíst
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const icloudUrl = "https://icloud.com";

  try {
    // Přidáváme User-Agent hlavičku, protože Apple servery občas požadavky bez ní odmítají
    const response = await fetch(icloudUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `iCloud odpověděl kódem ${response.status}` });
    }

    const data = await response.text();
    
    // Explicitně nastavíme, že vracíme text/calendar
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    return res.status(200).send(data);

  } catch (error) {
    // Zachytíme chybu, aby server nespadl s kódem 500/Runtime Error
    return res.status(500).json({ error: "Chyba při komunikaci s iCloudem", details: error.message });
  }
}
