export default async function handler(req, res) {
  // Povolení CORS pro vaši frontendovou aplikaci
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const icloudUrl = "https://icloud.com";

  try {
    const response = await fetch(icloudUrl);
    if (!response.ok) {
      throw new Error(`iCloud server odpověděl kódem: ${response.status}`);
    }
    const data = await response.text();
    
    // Vrátíme iCal data jako čistý text
    res.status(200).send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
