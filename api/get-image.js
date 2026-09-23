import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import ical from 'node-ical';
import path from 'path';

// 1. Registrace fontu, aby Vercel věděl, jak vykreslit text
try {
  const fontPath = path.join(process.cwd(), 'api', 'font.ttf');
  GlobalFonts.registerFromPath(fontPath, 'DisplejFont');
} catch (e) {
  console.error('Nepodařilo se načíst lokální font:', e);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const icloudUrl = "https://p41-calendars.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk00_qS7cioqmCe26e9wjXEI7QQzsDADgoUP7pulJyg9tlRP3MPsrl4uTdeXFEymRFI";

    // Stažení dat z iCloudu
    const webEvents = await ical.fromURL(icloudUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const ted = new Date();
    const udalosti = [];

    for (const k in webEvents) {
      if (webEvents.hasOwnProperty(k)) {
        const ev = webEvents[k];
        if (ev.type === 'VEVENT') {
          const startDate = new Date(ev.start);
          // Události, které začaly max před 3 hodinami nebo teprve začnou
          if (startDate.getTime() > ted.getTime() - (3 * 60 * 60 * 1000)) {
            udalosti.push({
              title: ev.summary || 'Bez názvu',
              start: startDate,
            });
          }
        }
      }
    }

    // Seřazení událostí podle času
    udalosti.sort((a, b) => a.start - b.start);

    // Inicializace plátna 800x480
    const width = 800;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Bílé pozadí
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Záhlaví - POUŽITÍ REGISTROVANÉHO FONTU
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 32px DisplejFont';
    ctx.fillText('Můj iCloud Kalendář', 40, 60);

    // Hlavní linka
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 85);
    ctx.lineTo(760, 85);
    ctx.stroke();

    let yOffset = 140;
    const maxUdalosti = 5;

    if (udalosti.length === 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = 'italic 24px DisplejFont';
      ctx.fillText('Žádné nadcházející události v iCloudu.', 40, yOffset);
    } else {
      const kZobrazeni = udalosti.slice(0, maxUdalosti);

      kZobrazeni.forEach((udalost) => {
        const dny = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
        const denTydne = dny[udalost.start.getDay()];
        const formatovaneDatum = `${denTydne} ${udalost.start.getDate()}. ${udalost.start.getMonth() + 1}.`;
        
        const hodiny = String(udalost.start.getHours()).padStart(2, '0');
        const minuty = String(udalost.start.getMinutes()).padStart(2, '0');
        const formatovanyCas = `${hodiny}:${minuty}`;

        // Datum a čas (Modrá)
        ctx.fillStyle = '#2563EB';
        ctx.font = 'bold 22px DisplejFont';
        ctx.fillText(`${formatovaneDatum} v ${formatovanyCas}`, 40, yOffset);

        // Název události (Černá)
        ctx.fillStyle = '#111827';
        ctx.font = '22px DisplejFont';
        
        let nazev = udalost.title;
        if (nazev.length > 35) {
          nazev = nazev.substring(0, 32) + '...';
        }
        ctx.fillText(nazev, 340, yOffset);

        // Dělící čára mezi řádky
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, yOffset + 20);
        ctx.lineTo(760, yOffset + 20);
        ctx.stroke();

        yOffset += 65;
      });
    }

    // Odeslání výsledného PNG obrázku
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=10, must-revalidate'); 
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('Kritická chyba:', error);
    
    // Nouzové vykreslení chybové hlášky, pokud selže iCloudu / parsování
    const errorCanvas = createCanvas(800, 480);
    const errorCtx = errorCanvas.getContext('2d');
    errorCtx.fillStyle = '#FFFFFF';
    errorCtx.fillRect(0, 0, 800, 480);
    
    errorCtx.fillStyle = '#DC2626';
    errorCtx.font = 'bold 22px DisplejFont';
    errorCtx.fillText('Chyba při generování obrázku:', 40, 80);
    
    errorCtx.fillStyle = '#111827';
    errorCtx.font = '16px DisplejFont';
    errorCtx.fillText(error.message || 'Neznámá chyba', 40, 130);
    
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(errorCanvas.toBuffer('image/png'));
  }
}
