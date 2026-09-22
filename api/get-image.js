export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

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

      if (dtstartMatch && dtstartMatch[1]) {
        const cleanStr = dtstartMatch[1].replace(/[\r\n]/g, "").trim();
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
          summary: summaryMatch && summaryMatch[1] ? summaryMatch[1].replace(/[\r\n]/g, "").trim() : "Bez nazvu",
          start: startDate,
          isAllDay: isAllDay
        });
      }
    }

    // Řazení událostí chronologicky
    events.sort((a, b) => a.start - b.start);

    // Filtrovat pouze dnešní a budoucí události
    const dnes = new Date();
    dnes.setHours(0,0,0,0);
    const budouciEvents = events.filter(ev => ev.start >= dnes).slice(0, 5); // Max 5 událostí pro čistý design

    // Generování informací pro LEVÝ HODINOVÝ SLOUPEC
    const dnyTyždne = ["NEDĚLE", "PONDĚLÍ", "ÚTERÝ", "STŘEDA", "ČTVRTEK", "PÁTEK", "SOBOTA"];
    const mesice = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
    
    const aktualniDatum = new Date();
    const jmenoDne = dnyTyždne[aktualniDatum.getDay()];
    const cisloDne = aktualniDatum.getDate();
    const jmenoMesice = mesice[aktualniDatum.getMonth()];
    const casAktualizace = aktualniDatum.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

    // Generování PRAVÉHO SLOUPCE s událostmi
    let svgEventsHtml = "";
    let yOffset = 40; // Výchozí pozice první události v pravém sloupci
    
    if (budouciEvents.length === 0) {
      svgEventsHtml = `
        <text x="530" y="240" fill="#a0a0ab" font-size="22" font-family="-apple-system, sans-serif" font-weight="500" text-anchor="middle">
          Žádné nadcházející události
        </text>`;
    } else {
      budouciEvents.forEach((ev, index) => {
        const evDencislo = ev.start.getDate();
        const evMesiccislo = ev.start.getMonth() + 1;
        const evDenvTyzdni = ev.start.toLocaleString('cs-CZ', { weekday: 'short' }).toUpperCase();
        
        const dateStr = `${evDencislo}. ${evMesiccislo}.`;
        const timeStr = ev.isAllDay ? "Celý den" : ev.start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        
        // Vyčištění textu události od paznaků a diakritiky (pro jistotu kvůli ESP32)
        const cleanSummary = ev.summary
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        svgEventsHtml += `
          <!-- Řádek události č. ${index + 1} -->
          <g transform="translate(280, ${yOffset})">
            <!-- Datumový čtverec / odznak -->
            <rect width="65" height="55" rx="10" fill="#27272a"/>
            <text x="32.5" y="23" fill="#ef4444" font-size="12" font-weight="800" font-family="-apple-system, sans-serif" text-anchor="middle">${evDenvTyzdni}</text>
            <text x="32.5" y="45" fill="#ffffff" font-size="20" font-weight="700" font-family="-apple-system, sans-serif" text-anchor="middle">${evDencislo}</text>
            
            <!-- Čas události -->
            <text x="85" y="34" fill="#3b82f6" font-size="16" font-weight="700" font-family="-apple-system, sans-serif">🕒 ${timeStr}</text>
            
            <!-- Hlavní text události -->
            <text x="230" y="34" fill="#f4f4f5" font-size="20" font-weight="600" font-family="-apple-system, sans-serif">${cleanSummary}</text>
            
            <!-- Dělící linka (vynecháme u poslední události) -->
            ${index < budouciEvents.length - 1 ? `<line x1="0" y1="72" x2="480" y2="72" stroke="#27272a" stroke-width="1"/>` : ''}
          </g>
        `;
        yOffset += 85; // Mezera mezi řádky
      });
    }

    // FINÁLNÍ SESTAVENÍ SVG VE VELIKOSTI DISPLEJE (800x480)
    const svg = `
      <svg xmlns="http://w3.org" width="800" height="480" viewBox="0 0 800 480">
        <!-- Celkové tmavé břidlicové pozadí -->
        <rect width="800" height="480" fill="#09090b"/>
        
        <!-- ================= LEVÝ SLOUPEC (PANELEK DNES) ================= -->
        <g transform="translate(0, 0)">
          <!-- Pozadí levého panelu -->
          <rect width="250" height="480" fill="#18181b"/>
          <!-- Vertikální předěl -->
          <line x1="250" y1="0" x2="250" y2="480" stroke="#27272a" stroke-width="2"/>
          
          <!-- Jméno dne (např. ÚTERÝ) -->
          <text x="125" y="110" fill="#ef4444" font-size="18" font-weight="800" font-family="-apple-system, sans-serif" letter-spacing="2" text-anchor="middle">${jmenoDne}</text>
          
          <!-- Velké číslo dne -->
          <text x="125" y="240" fill="#ffffff" font-size="110" font-weight="900" font-family="-apple-system, sans-serif" text-anchor="middle">${cisloDne}</text>
          
          <!-- Název měsíce -->
          <text x="125" y="290" fill="#a0a0ab" font-size="22" font-weight="600" font-family="-apple-system, sans-serif" text-anchor="middle">${jmenoMesice}</text>
          
          <!-- Malý popisek dole o aktualizaci panýlku -->
          <rect x="35" y="415" width="180" height="30" rx="15" fill="#27272a"/>
          <text x="125" y="434" fill="#71717a" font-size="12" font-weight="700" font-family="-apple-system, sans-serif" text-anchor="middle">AKTUALIZOVÁNO v ${casAktualizace}</text>
        </g>
        
        <!-- ================= PRAVÝ SLOUPEC (UDÁLOSTI) ================= -->
        <!-- Velký elegantní nadpis kalendáře navrchu -->
        <text x="280" y="40" fill="#a0a0ab" font-size="14" font-weight="800" font-family="-apple-system, sans-serif" letter-spacing="1.5">RODINNÝ KALENDÁŘ</text>
        
        <g transform="translate(0, 25)">
            ${svgEventsHtml}
        </g>
      </svg>
    `.trim();

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.status(200).send(svg);

  } catch (error) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(500).send(`<svg width="800" height="480"><rect width="800" height="480" fill="#7f1d1d"/><text x="20" y="40" fill="white" font-family="sans-serif">Chyba dashboardu: ${error.message}</text></svg>`);
  }
}
