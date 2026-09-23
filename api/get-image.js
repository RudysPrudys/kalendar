import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import ical from 'node-ical';
import path from 'path';

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
    const icloudUrl = "https://icloud.com";

    const webEvents = await ical.fromURL(icloudUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    // Aktuální čas pro widget a pro filtraci
    const ted = new Date();
    const udalosti = [];

    for (const k in webEvents) {
      if (webEvents.hasOwnProperty(k)) {
        const ev = webEvents[k];
        if (ev.type === 'VEVENT') {
          const startDate = new Date(ev.start);
          if (startDate.getTime() > ted.getTime() - (2 * 60 * 60 * 1000)) {
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

    // ----------------------------------------------------
    // GRAFICKÝ NÁVRH: POZADÍ A ROZDĚLENÍ DISPLEJE
    // ----------------------------------------------------
    
    // Základní pozadí (Pravá strana pro události)
    ctx.fillStyle = '#F9FAFB'; // Velmi světle šedá
    ctx.fillRect(0, 0, width, height);

    // LEVÝ PANEL (Widget s časem a datem)
    ctx.fillStyle = '#111827'; // Elegantní tmavě grafitová
    ctx.fillRect(0, 0, 280, height);

    // Dekorační barevný pruh na předělu panelů (Modrý akcent)
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(276, 0, 4, height);

    // ----------------------------------------------------
    // LEVÝ PANEL: AKTUÁLNÍ ČAS A DATUM (Český formát)
    // ----------------------------------------------------
    const dnyTydnePlne = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
    const mesicePlne = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

    // 1. Aktuální čas (Velký digitální ciferník)
    const aktHodiny = String(ted.getHours()).padStart(2, '0');
    const aktMinuty = String(ted.getMinutes()).padStart(2, '0');
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px DisplejFont';
    ctx.textAlign = 'center';
    ctx.fillText(`${aktHodiny}:${aktMinuty}`, 140, 100);

    // 2. Název dne (např. Pondělí)
    ctx.fillStyle = '#9CA3AF'; // Světle šedá pro sekundární text
    ctx.font = '22px DisplejFont';
    ctx.fillText(dnyTydnePlne[ted.getDay()], 140, 150);

    // 3. Velké číslo dne v měsíci
    ctx.fillStyle = '#3B82F6'; // Modrá pro zvýraznění dne
    ctx.font = 'bold 80px DisplejFont';
    ctx.fillText(ted.getDate(), 140, 250);

    // 4. Měsíc a rok (např. prosince 2026)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px DisplejFont';
    ctx.fillText(mesicePlne[ted.getMonth()], 140, 295);
    
    ctx.fillStyle = '#6B7280';
    ctx.font = '16px DisplejFont';
    ctx.fillText(ted.getFullYear(), 140, 325);

    // reset zarovnání textu na doleva pro zbytek kreslení
    ctx.textAlign = 'left';

    // ----------------------------------------------------
    // PRAVÝ PANEL: NADCHÁZEJÍCÍ UDÁLOSTI
    // ----------------------------------------------------
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 24px DisplejFont';
    ctx.fillText('Nadcházející události', 315, 50);

    let yOffset = 85;
    const maxUdalosti = 5; // Vejde se 5 krásných karet

    if (udalosti.length === 0) {
      // Stav, kdy je kalendář prázdný
      ctx.fillStyle = '#F3F4F6';
      // Zaoblená karta pro prázdný stav
      stiskniZaoblenyObdelnik(ctx, 315, yOffset, 450, 80, 8);
      ctx.fill();
      
      ctx.fillStyle = '#6B7280';
      ctx.font = 'italic 18px DisplejFont';
      ctx.fillText('Žádné plánované události', 340, yOffset + 45);
    } else {
      const kZobrazeni = udalosti.slice(0, maxUdalosti);

      kZobrazeni.forEach((udalost) => {
        // Příprava dat pro řádek
        const dnyKratke = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
        const denTydneKratky = dnyKratke[udalost.start.getDay()];
        const formatovaneDatum = `${denTydneKratky} ${udalost.start.getDate()}. ${udalost.start.getMonth() + 1}.`;
        
        const hod = String(udalost.start.getHours()).padStart(2, '0');
        const min = String(udalost.start.getMinutes()).padStart(2, '0');
        const formatovanyCas = `${hod}:${min}`;

        // Kontrola, zda událost není náhodou už dnes (dáme jí jemné modré pozadí)
        const jeDnes = fieldsAreSameDay(ted, udalost.start);
        
        // Vykreslení bílé/modré zaoblené karty pro událost
        ctx.fillStyle = jeDnes ? '#EFF6FF' : '#FFFFFF'; 
        ctx.shadowColor = 'rgba(0, 0, 0, 0.03)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        
        stiskniZaoblenyObdelnik(ctx, 315, yOffset, 450, 64, 8);
        ctx.fill();
        
        // Reset stínů, aby se neaplikovaly na text
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Barevný indikátor na začátku karty (Dnes = tmavě modrá, jindy = světlá)
        ctx.fillStyle = jeDnes ? '#2563EB' : '#D1D5DB';
        ctx.fillRect(315, yOffset, 5, 64); 

        // Čas a Datum
        ctx.fillStyle = '#2563EB';
        ctx.font = 'bold 16px DisplejFont';
        ctx.fillText(formatovanyCas, 335, yOffset + 28);
        
        ctx.fillStyle = '#6B7280';
        ctx.font = '13px DisplejFont';
        ctx.fillText(formatovaneDatum, 335, yOffset + 48);

        // Název události
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 17px DisplejFont';
        
        let nazev = udalost.title;
        if (nazev.length > 34) {
          nazev = nazev.substring(0, 31) + '...';
        }
        ctx.fillText(nazev, 450, yOffset + 38);

        yOffset += 76; // Posun na další kartu (64px karta + 12px mezera)
      });
    }

    // Odeslání PNG obrázku
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=10, must-revalidate'); 
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('Kritická chyba:', error);
    // Vykreslení chybové obrazovky v novém stylu
    const errorCanvas = createCanvas(800, 480);
    const errorCtx = errorCanvas.getContext('2d');
    errorCtx.fillStyle = '#111827';
    errorCtx.fillRect(0, 0, 800, 480);
    errorCtx.fillStyle = '#EF4444';
    errorCtx.font = 'bold 24px DisplejFont';
    errorCtx.fillText('Chyba systému', 50, 80);
    errorCtx.fillStyle = '#9CA3AF';
    errorCtx.font = '16px DisplejFont';
    errorCtx.fillText(error.message || 'Neznámá chyba', 50, 130);
    
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(errorCanvas.toBuffer('image/png'));
  }
}

// Pomocná funkce pro kreslení zaoblených obdélníků (karet)
function stiskniZaoblenyObdelnik(ctx, x, y, width, height, radius) {
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

// Pomocná funkce pro ověření, zda je událost dnes
function fieldsAreSameDay(date1, date2) {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
}
