export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const icloudUrl = "https://icloud.com";

  try {
    // Použijeme hlavičku 'Wget' nebo 'curl', aby Apple věděl, že chceme čistá iCal data a ne HTML stránku
    const response = await fetch(icloudUrl, {
      headers: {
        'User-Agent': 'Wget/1.21.1',
        'Accept': 'text/calendar, text/plain'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `iCloud odpověděl kódem ${response.status}` });
    }

    const data = await response.text();
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    return res.status(200).send(data);

  } catch (error) {
    return res.status(500).json({ error: "Chyba při komunikaci s iCloudem", details: error.message });
  }
}
