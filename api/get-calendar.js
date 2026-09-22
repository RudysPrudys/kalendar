export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // OPRAVA: Změněno caldav.icloud.com na calendars.icloud.com, což obchází HTML přihlašovací smyčku Applu
  const icloudUrl = "https://p41-caldav.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk31hjFDdqWDNGVWlWQfYhaP2CsHUq8WVCaQbZTnxrs1zpRHvU8KsBFr0Qf1zubAb4k";

  try {
    const response = await fetch(icloudUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
