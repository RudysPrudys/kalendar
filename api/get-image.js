import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import ical from 'node-ical';
import path from 'path';

try {
  const fontPath = path.join(process.cwd(), 'api', 'font.ttf');
  GlobalFonts.registerFromPath(fontPath, 'DisplejFont');
} catch (e) {
  console.error('Nepodařilo se načíst lokální font:', e);
}

function ziskejCeskyCas(vstupniDatum = new Date()) {
  const czString = vstupniDatum.toLocaleString('en-US', { timeZone: 'Europe/Prague' });
  return new Date(czString);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const icloudUrl = "https://p41-calendars.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk00_qS7cioqmCe26e9wjXEI7QQzsDADgoUP7pulJyg9tlRP3MPsrl4uTdeXFEymRFI";

    const calendarResponse = await ical.fromURL(icloudUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => ({}));
    
    const ted = ziskejCeskyCas(new Date());
    const udalosti = [];

    for (const k in calendarResponse) {
      if (calendarResponse.hasOwnProperty(k)) {
        const ev = calendarResponse[k];
        if (ev.type === 'VEVENT') {
          const startDate = ziskejCeskyCas(new Date(ev.start));
          if (startDate.getTime() > ted.getTime() - (2 * 60 * 60 * 1000)) {
            udalosti.push({
              title: ev.summary || 'Bez názvu',
              start: startDate,
            });
          }
        }
      }
    }
    udalosti.sort((a, b) => a.start - b.start);

    const width = 800;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Pozadí
    ctx.fillStyle = '#0F172A'; 
    ctx.fillRect(0, 0, width, height);

    // Ambientní efekt
    const gradient = ctx.createRadialGradient(80, 240, 10, 100, 240, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 320, height);

    // Dělící linka
    const lineGrad = ctx.createLinearGradient(290, 40, 290, 440);
    lineGrad.addColorStop(0, 'rgba(51, 65, 85, 0.2)');
    lineGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.6)');
    lineGrad.addColorStop(1, 'rgba(51, 65, 85, 0.2)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(290, 30);
    ctx.lineTo(290, 450);
    ctx.stroke();

    // LEVÝ PANEL - ČAS A DATUM
    ctx.textAlign = 'center';
    const aktHodiny = String(ted.getHours()).padStart(2, '0');
    const aktMinuty = String(ted.getMinutes()).padStart(2, '0');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 68px DisplejFont';
    ctx.fillText(`${aktHodiny}:${aktMinuty}`, 145, 110);

    const dnyTydnePlne = ['NEDĚLE', 'PONDĚLÍ', 'ÚTERÝ', 'STŘEDA', 'ČTVRTEK', 'PÁTEK', 'SOBOTA'];
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 16px DisplejFont';
    ctx.fillText(dnyTydnePlne[ted.getDay()], 145, 155);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 90px DisplejFont';
    ctx.fillText(ted.getDate(), 145, 265);

    const mesicePlne = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 20px DisplejFont';
    ctx.fillText(mesicePlne[ted.getMonth()], 145, 315);
    
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 15px DisplejFont';
    ctx.fillText(ted.getFullYear(), 145, 345);

    ctx.textAlign = 'left';

    // PRAVÝ PANEL - UDÁLOSTI
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 22px DisplejFont';
    ctx.fillText('NADCHÁZEJÍCÍ UDÁLOSTI', 330, 60);

    let yOffset = 95;
    const maxUdalosti = 5;

    if (udalosti.length === 0) {
      ctx.fillStyle = '#1E293B';
      stiskniZaoblenyObdelnik(ctx, 330, yOffset, 430, 75, 12);
      ctx.fill();
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 18px DisplejFont';
      ctx.fillText('Žádné plánované události', 360, yOffset + 43);
    } else {
      const kZobrazeni = udalosti.slice(0, maxUdalosti);
      kZobrazeni.forEach((udalost) => {
        const dnyKratke = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
        const denTydneKratky = dnyKratke[udalost.start.getDay()];
        const formatovaneDatum = `${denTydneKratky} ${udalost.start.getDate()}. ${udalost.start.getMonth() + 1}.`;
        
        const hod = String(udalost.start.getHours()).padStart(2, '0');
        const min = String(udalost.start.getMinutes()).padStart(2, '0');
        const formatovanyCas = `${hod}:${min}`;

        const jeDnes = (ted.getDate() === udalost.start.getDate() && ted.getMonth() === udalost.start.getMonth());
        
        ctx.fillStyle = jeDnes ? 'rgba(56, 189, 248, 0.08)' : 'rgba(30, 41, 59, 0.6)'; 
        stiskniZaoblenyObdelnik(ctx, 330, yOffset, 435, 60, 10);
        ctx.fill();
        
        ctx.strokeStyle = jeDnes ? 'rgba(56, 189, 248, 0.4)' : 'rgba(51, 65, 85, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = jeDnes ? '#38BDF8' : '#334155';
        ctx.fillRect(330, yOffset + 10, 4, 40); 

        ctx.fillStyle = jeDnes ? '#38BDF8' : '#94A3B8';
        ctx.font = 'bold 16px DisplejFont';
        ctx.fillText(formatovanyCas, 350, yOffset + 35);
        
        ctx.fillStyle = '#64748B';
        ctx.font = '13px DisplejFont';
        ctx.fillText(formatovaneDatum, 415, yOffset + 35);

        ctx.fillStyle = jeDnes ? '#FFFFFF' : '#E2E8F0';
        ctx.font = 'bold 16px DisplejFont';
        
        let nazev = udalost.title;
        if (nazev.length > 28) {
          nazev = nazev.substring(0, 25) + '...';
        }
        ctx.fillText(nazev, 510, yOffset + 35);
        yOffset += 72;
      });
    }

    // ----------------------------------------------------
    // KRITICKÁ OPRAVA PRO ESP32 SÍŤOVÝ DEKODÉR
    // ----------------------------------------------------
    // toBuffer() s explicitní konfigurací: vypne prokládání (interlace: 0)
    // a vynutí standardní PNG formát bez optimalizací, které pletou PNGdec v Arduinu
    const buffer = canvas.toBuffer('image/png', {
      compressionLevel: 6,
      filters: canvas.PNG_FILTER_NONE,
      palette:        null,
      backgroundIndex: 0,
      interlace:       0  // 0 = ZAKÁZAT PROKLÁDÁNÍ (Klíč k odstranění chyby 7)
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=10, must-revalidate'); 
    return res.status(200).send(buffer);

  } catch (error) {
    res.setHeader('Content-Type', 'image/png');
    const canvasChyba = createCanvas(800, 480);
    return res.status(200).send(canvasChyba.toBuffer('image/png'));
  }
}

void function stiskniZaoblenyObdelnik(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
