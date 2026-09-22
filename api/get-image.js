export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // TADY JE VAŠE SPRÁVNÁ ADRESA S CALDAV (Změněno na funkční subdoménu calendars)
  const icloudUrl = "https://p41-calendars.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk00_qS7cioqmCe26e9wjXEI7QQzsDADgoUP7pulJyg9tlRP3MPsrl4uTdeXFEymRFI";

  try {
    const response = await fetch(icloudUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) throw new Error("Chyba iCloudu");
    const text = await response.text();

    const events = [];
    const veventBlocks = text.split(/BEGIN:VEVENT/i);
    veventBlocks.shift(); 

    for (let block of veventBlocks) {
      const summaryMatch = block.match(/SUMMARY(?:\s*;.*?)?:(.*)/i);
      const dtstartMatch = block.match(/DTSTART(?:\s*;.*?)?:(.*)/i);
      const isAllDay = block.includes("VALUE=DATE");

      if (dtstartMatch) {
        const cleanStr = dtstartMatch.replace(/[\r\n]/g, "").trim();
        const year = parseInt(cleanStr.substring(0, 4));
        const month = parseInt(cleanStr.substring(4, 6)) - 1;
        const day = parseInt(cleanStr.substring(6, 8));
        
        let startDate;
        if (isAllDay || cleanStr.length < 9) {
          startDate = new Date(year, month, day, 0, 0, 0);
        } else {
          const hour = parseInt(cleanStr.substring(9, 11)) || 0;
          const minute = parseInt(cleanStr.substring(11, 13)) || 0;
          if (cleanStr.endsWith("Z")) {
            startDate = new Date(Date.UTC(year, month, day, hour, minute, 0));
          } else {
            startDate = new Date(year, month, day, hour, minute, 0);
          }
        }

        events.push({
          summary: summaryMatch ? summaryMatch.replace(/[\r\n]/g, "").trim() : "Bez názvu",
          start: startDate,
          isAllDay: isAllDay
        });
      }
    }

    // Seřadit chronologicky
    events.sort((a, b) => a.start - b.start);

    // Filtr: Ukážeme vše od dnešního dne
    const dnes = new Date();
    dnes.setHours(0,0,0,0);
    const budouciEvents = events.filter(ev => ev.start >= dnes).slice(0, 5);

    let svgRows = "";
    let yOffset = 120;
    
    if (budouciEvents.length === 0) {
      svgRows = `<text x="400" y="240" fill="#86868b" font-size="24" text-anchor="middle">Zadne nadchazejici udalosti</text>`;
    } else {
      budouciEvents.forEach(ev => {
        const dateStr = ev.start.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
        const timeStr = ev.isAllDay ? "Cely den" : ev.start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        
        const cleanSummary = ev.summary
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        svgRows += `
          <g transform="translate(50, ${yOffset})">
            <rect width="700" height="55" rx="10" fill="#2c2c2e"/>
            <text x="20" y="35" fill="#0a84ff" font-size="20" font-weight="bold" font-family="sans-serif">${dateStr}</text>
            <text x="100" y="35" fill="#86868b" font-size="16" font-family="sans-serif">🕒 ${timeStr}</text>
            <text x="220" y="35" fill="#f5f5f7" font-size="20" font-weight="600" font-family="sans-serif">${cleanSummary}</text>
          </g>
        `;
        yOffset += 68;
      });
    }

    const svg = `
      <svg xmlns="http://w3.org" width="800" height="480" viewBox="0 0 800 480">
        <rect width="800" height="480" fill="#1c1c1e"/>
        <text x="400" y="50" fill="#f5f5f7" font-size="28" font-weight="bold" font-family="sans-serif" text-anchor="middle">Kalendar Rodina</text>
        <line x1="50" y1="75" x2="750" y2="75" stroke="#3a3a3c" stroke-width="2"/>
        ${svgRows}
      </svg>
    `.trim();

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.status(200).send(svg);

  } catch (error) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(500).send(`<svg width="800" height="480"><rect width="800" height="480" fill="red"/><text x="20" y="40" fill="white">Chyba: ${error.message}</text></svg>`);
  }
}
