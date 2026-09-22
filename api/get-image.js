export default async function handler(req, res) {
  // CORS hlavičky
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const icloudUrl = "https://icloud.com";

  try {
    const response = await fetch(icloudUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) throw new Error("Chyba iCloudu");
    const text = await response.text();

    // 1. Zjednodušené vytažení událostí z iCal textu
    const events = [];
    const blocks = text.split(/BEGIN:VEVENT/i);
    blocks.shift();

    for (let block of blocks) {
      const summaryMatch = block.match(/SUMMARY(?:\s*;.*?)?:(.*)/i);
      const dtstartMatch = block.match(/DTSTART(?:\s*;.*?)?:(.*)/i);
      if (dtstartMatch) {
        const cleanStr = dtstartMatch[1].replace(/[\r\n]/g, "").trim();
        const year = cleanStr.substring(0, 4);
        const month = cleanStr.substring(4, 6) - 1;
        const day = cleanStr.substring(6, 8);
        const date = new Date(year, month, day);
        
        events.push({
          summary: summaryMatch ? summaryMatch[1].replace(/[\r\n]/g, "").trim() : "Bez názvu",
          date: date
        });
      }
    }

    // Seřadit a vyfiltrovat budoucí
    events.sort((a, b) => a.date - b.date);
    const dnes = new Date(); dnes.setHours(0,0,0,0);
    const budouciEvents = events.filter(e => e.date >= dnes).slice(0, 5); // vezmeme max 5 událostí

    // 2. Vygenerování SVG obrázku (vektory o rozlišení 800x480)
    // ESP32 umí snadno zpracovat SVG nebo ho můžeme poslat jako monochromatický bitmapový kód
    // Pro nejvyšší kompatibilitu vygenerujeme jednoduché čisté SVG s tmavým pozadím
    
    let svgRows = "";
    let yOffset = 120;
    
    if (budouciEvents.length === 0) {
      svgRows = `<text x="400" y="240" fill="#86868b" font-size="24" text-anchor="middle">Zadne nadchazejici udalosti</text>`;
    } else {
      budouciEvents.forEach(ev => {
        const dateStr = ev.date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
        svgRows += `
          <g transform="translate(50, ${yOffset})">
            <rect width="700" height="50" rx="8" fill="#2c2c2e"/>
            <text x="20" y="32" fill="#0a84ff" font-size="20" font-weight="bold">${dateStr}</text>
            <text x="100" y="32" fill="#f5f5f7" font-size="20">${ev.summary}</text>
          </g>
        `;
        yOffset += 65;
      });
    }

    const svg = `
      <svg xmlns="http://w3.org" width="800" height="480" viewBox="0 0 800 480">
        <rect width="800" height="480" fill="#1c1c1e"/>
        <text x="400" y="50" fill="#f5f5f7" font-size="28" font-weight="bold" text-anchor="middle">Kalendar Rodina</text>
        <line x1="50" y1="75" x2="750" y2="75" stroke="#3a3a3c" stroke-width="2"/>
        ${svgRows}
      </svg>
    `.trim();

    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);

  } catch (error) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(500).send(`<svg width="800" height="480"><rect width="800" height="480" fill="red"/><text x="20" y="40" fill="white">Chyba API</text></svg>`);
  }
}
