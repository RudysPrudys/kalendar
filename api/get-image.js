import { createCanvas } from '@napi-rs/canvas';
import ical from 'node-ical';

export default async function handler(req, res) {
  // CORS hlavičky pro jistotu, pokud byste obrázek načítali odjinud
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Získání domény pro volání vašeho get-calendar.js
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const calendarUrl = `${protocol}://${host}/api/get-calendar`; // Zkontrolujte, zda máte v názvu souboru "calendar" nebo "kalendar"

    // 2. Načtení a naparsování .ics dat přímo z vašeho API
    const webEvents = await ical.fromURL(calendarUrl);
    
    // 3. Zpracování a filtrace událostí (chceme jen budoucí nebo dnešní)
    const ted = new Date();
    const udalosti = [];

    for (const k in webEvents) {
      if (webEvents.hasOwnProperty(k)) {
        const ev = webEvents[k];
        if (ev.type === 'VEVENT') {
          const startDate = new Date(ev.start);
          
          // Ignorujeme události starší než 2 hodiny, aby na displeji chvíli zůstala i právě probíhající událost
          if (startDate.getTime() > ted.getTime() - (2 * 60 * 60 * 1000)) {
            udalosti.push({
              title: ev.summary || 'Bez názvu',
              start: startDate,
            });
          }
        }
      }
    }

    // Seřadíme události od nejbližší po nejvzdálenější
    udalosti.sort((a, b) => a.start - b.start);

    // 4. Inicializace plátna (Canvas) pro CrowPanel (800x480)
    const width = 800;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Čisté bílé pozadí
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Záhlaví kalendáře
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Můj iCloud Kalendář', 40, 60);

    // Hlavní dělící čára pod záhlavím
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 85);
    ctx.lineTo(760, 85);
    ctx.stroke();

    // 5. Vykreslení seznamu událostí
    let yOffset = 140;
    const maxUdalosti = 5; // Kolik řádků se bezpečně vejde pod sebe

    if (udalosti.length === 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = 'italic 24px sans-serif';
      ctx.fillText('Žádné nadcházející události.', 40, yOffset);
    } else {
      // Vezmeme jen prvních X událostí
      const kZobrazeni = udalosti.slice(0, maxUdalosti);

      kZobrazeni.forEach((udalost) => {
        // Formátování data a času pro ČR prostředí
        const dny = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
        const denTydne = dny[udalost.start.getDay()];
        const formatovaneDatum = `${denTydne} ${udalost.start.getDate()}. ${udalost.start.getMonth() + 1}.`;
        const formatovanyCas = udalost.start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

        // Čas a datum (Levý sloupec) - Výrazná tmavá/modrá
        ctx.fillStyle = '#2563EB';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`${formatovaneDatum} v ${formatovanyCas}`, 40, yOffset);

        // Název události (Pravý sloupec)
        ctx.fillStyle = '#111827';
        ctx.font = '22px sans-serif';
        
        // Ochrana proti přetečení textu mimo obrazovku (zkrácení dlouhých názvů)
        let nazev = udalost.title;
        if (nazev.length > 35) {
          nazev = nazev.substring(0, 32) + '...';
        }
        ctx.fillText(nazev, 340, yOffset);

        // Jemná linka mezi událostmi
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, yOffset + 20);
        ctx.lineTo(760, yOffset + 20);
        ctx.stroke();

        yOffset += 65; // Posun na další řádek
      });
    }

    // 6. Vygenerování PNG obrázku
    const buffer = canvas.toBuffer('image/png');

    // 7. Odeslání do displeje
    res.setHeader('Content-Type', 'image/png');
    // Cache na 5 minut, ať šetříte procesor i Cloud funkce na Vercelu
    res.setHeader('Cache-Control', 'public, max-age=300'); 
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('Chyba při generování obrázku:', error);
    return res.status(500).json({ error: 'Nepodařilo se vygenerovat obrázek kalendáře', details: error.message });
  }
}
