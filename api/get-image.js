import { createCanvas } from '@napi-rs/canvas';
import ical from 'node-ical';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Přímá URL na váš iCloud kalendář (převzato z get-calendar.js)
    const icloudUrl = "https://p41-calendars.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk00_qS7cioqmCe26e9wjXEI7QQzsDADgoUP7pulJyg9tlRP3MPsrl4uTdeXFEymRFI";

    // 2. Stažení a naparsování ICS textu s User-Agentem, který Apple vyžaduje
    const webEvents = await ical.fromURL(icloudUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    // 3. Zpracování a filtrace událostí
    const ted = new Date();
    const udalosti = [];

    for (const k in webEvents) {
      if (webEvents.hasOwnProperty(k)) {
        const ev = webEvents[k];
        if (ev.type === 'VEVENT') {
          const startDate = new Date(ev.start);
          
          // Zobrazíme události, které ještě neskončily, nebo začínají v budoucnu
          // (Ponecháme události, které začaly max před 3 hodinami)
          if (startDate.getTime() > ted.getTime() - (3 * 60 * 60 * 1000)) {
            udalosti.push({
              title: ev.summary || 'Bez názvu',
              start: startDate,
            });
          }
        }
      }
    }

    // Seřazení od nejbližší
    udalosti.sort((a, b) => a.start - b.start);

    // 4. Inicializace plátna (800x480)
    const width = 800;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Bílé pozadí
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Záhlaví
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Můj iCloud Kalendář', 40, 60);

    // Hlavní linka
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 85);
    ctx.lineTo(760, 85);
    ctx.stroke();

    // 5. Vykreslení textů událostí
    let yOffset = 140;
    const maxUdalosti = 5;

    if (udalosti.length === 0) {
      // Pokud je pole prázdné, vypíšeme to na displej, abychom viděli, že kód běží
      ctx.fillStyle = '#6B7280';
      ctx.font = 'italic 24px sans-serif';
      ctx.fillText('Žádné nadcházející události v iCloudu.', 40, yOffset);
    } else {
      const kZobrazeni = udalosti.slice(0, maxUdalosti);

      kZobrazeni.forEach((udalost) => {
        const dny = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
        const denTydne = dny[udalost.start.getDay()];
        
        // Formátování dne a měsíce
        const formatovaneDatum = `${denTydne} ${udalost.start.getDate()}. ${udalost.start.getMonth() + 1}.`;
        
        // Bezpečné formátování času pro Node.js prostředí na Vercelu
        const hodiny = String(udalost.start.getHours()).padStart(2, '0');
        const minuty = String(udalost.start.getMinutes()).padStart(2, '0');
        const formatovanyCas = `${hodiny}:${minuty}`;

        // Vykreslení data a času (Modrá)
        ctx.fillStyle = '#2563EB';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`${formatovaneDatum} v ${formatovanyCas}`, 40, yOffset);

        // Vykreslení názvu (Černá)
        ctx.fillStyle = '#111827';
        ctx.font = '22px sans-serif';
        
        let nazev = udalost.title;
        if (nazev.length > 35) {
          nazev = nazev.substring(0, 32) + '...';
        }
        ctx.fillText(nazev, 340, yOffset);

        // Mezirádková linka
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, yOffset + 20);
        ctx.lineTo(760, yOffset + 20);
        ctx.stroke();

        yOffset += 65;
      });
    }

    // 6. Odeslání PNG obrázku
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate'); // Snížena cache na 1 minutu pro testování
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('Chyba na Vercelu:', error);
    
    // Pokud selže úplně všechno, vykreslíme chybu přímo do obrázku, abyste ji viděl na mobilu
    const errorCanvas = createCanvas(800, 480);
    const errorCtx = errorCanvas.getContext('2d');
    errorCtx.fillStyle = '#FFFFFF';
    errorCtx.fillRect(0, 0, 800, 480);
    errorCtx.fillStyle = '#DC2626';
    errorCtx.font = 'bold 20px sans-serif';
    errorCtx.fillText('Chyba při generování obrázku:', 40, 100);
    errorCtx.fillStyle = '#111827';
    errorCtx.font = '16px sans-serif';
    errorCtx.fillText(error.message, 40, 140);
    
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(errorCanvas.toBuffer('image/png'));
  }
}
