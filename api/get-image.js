import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import ical from 'node-ical';
import path from 'path';

try {
  const fontPath = path.join(process.cwd(), 'api', 'font.ttf');
  GlobalFonts.registerFromPath(fontPath, 'DisplejFont');
} catch (e) {
  console.error('Nepodařilo se načíst lokální font:', e);
}

// POMOCNÁ FUNKCE: Převede Date objekt do časové zóny Europe/Prague
function ziskejCeskyCas(vstupniDatum = new Date()) {
  const czString = vstupniDatum.toLocaleString('en-US', { timeZone: 'Europe/Prague' });
  return new Date(czString);
}

// POMOCNÁ FUNKCE: Mapování kódů Open-Meteo na český text
function interpretujPocasivText(kod) {
  const k = Number(kod);
  if (k === 0) return 'Jasno';
  if ([1, 2, 3].includes(k)) return 'Polojasno';
  if ([45, 48].includes(k)) return 'Mlha';
  if ([51, 53, 55, 56, 57].includes(k)) return 'Mrholení';
  if ([61, 63, 65, 66, 67].includes(k)) return 'Déšť';
  if ([71, 73, 75, 77, 85, 86].includes(k)) return 'Sněžení';
  if ([80, 81, 82].includes(k)) return 'Přeháňky';
  if ([95, 96, 99].includes(k)) return 'Bouřka';
  return 'Polojasno';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const icloudUrl = "https://p41-calendars.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk00_qS7cioqmCe26e9wjXEI7QQzsDADgoUP7pulJyg9tlRP3MPsrl4uTdeXFEymRFI";
    const pocalUrl = "https://open-meteo.com";
    
    // Souběžné stažení kalendáře a počasí
    const [calendarResponse, weatherResponse] = await Promise.all([
      ical.fromURL(icloudUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => ({})),
      fetch(pocalUrl, { headers: { 'Accept': 'application/json' } }).then(r => r.json()).catch(() => null)
    ]);

    // Zpracování času a kalendáře
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

    // FIX: Přístup k nultému prvku pole z Open-Meteo API response
    let pocasiText = "Polojasno";
    let teplotaMaxMin = "-- / -- °C";
    
    if (weatherResponse && weatherResponse.daily && Array.isArray(weatherResponse.daily.weather_code)) {
      const kod = weatherResponse.daily.weather_code[0]; 
      const maxT = Math.round(weatherResponse.daily.temperature_2m_max[0]);
      const minT = Math.round(weatherResponse.daily.temperature_2m_min[0]);
      
      pocasiText = interpretujPocasivText(kod);
      teplotaMaxMin = `${maxT}°C / ${minT}°C`;
    }

    // Inicializace plátna (800x480)
    const width = 800;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Pozadí a předěl
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 280, height);
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(276, 0, 4, height);

    // ----------------------------------------------------
    // LEVÝ PANEL: HODINY A DATUM (ZACHOVÁNY POZICE)
    // ----------------------------------------------------
    ctx.textAlign = 'center';
    
    const aktHodiny = String(ted.getHours()).padStart(2, '0');
    const aktMinuty = String(ted.getMinutes()).padStart(2, '0');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px DisplejFont';
    ctx.fillText(`${aktHodiny}:${aktMinuty}`, 140, 85);

    const dnyTydnePlne = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '18px DisplejFont';
    ctx.fillText(dnyTydnePlne[ted.getDay()], 140, 125);

    ctx.fillStyle = '#3B82F6';
    ctx.font = 'bold 70px DisplejFont';
    ctx.fillText(ted.getDate(), 140, 210);

    const mesicePlne = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px DisplejFont';
    ctx.fillText(`${mesicePlne[ted.getMonth()]} ${ted.getFullYear()}`, 140, 250);

    // ----------------------------------------------------
    // LEVÝ PANEL: PŘEDPOVĚĎ POČASÍ (ZACHOVÁNY POZICE)
    // ----------------------------------------------------
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 285);
    ctx.lineTo(250, 285);
    ctx.stroke();

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '13px DisplejFont';
    ctx.fillText('DNEŠNÍ POČASÍ', 140, 315);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px DisplejFont';
    ctx.fillText(pocasiText, 140, 355);

    ctx.fillStyle = '#3B82F6';
    ctx.font = 'bold 24px DisplejFont';
    ctx.fillText(teplotaMaxMin, 140, 400);

    // Reset zarovnání pro pravý panel
    ctx.textAlign = 'left';

    // ----------------------------------------------------
    // PRAVÝ PANEL: KALENDÁŘ (ZACHOVÁNY POZICE)
    // ----------------------------------------------------
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 24px DisplejFont';
    ctx.fillText('Nadcházející události', 315, 50);

    let yOffset = 85;
    const maxUdalosti = 5;

    if (udalosti.length === 0) {
      ctx.fillStyle = '#F3F4F6';
      stiskniZaoblenyObdelnik(ctx, 315, yOffset, 450, 80, 8);
      ctx.fill();
      ctx.fillStyle = '#6B7280';
      ctx.font = 'italic 18px DisplejFont';
      ctx.fillText('Žádné plánované události', 340, yOffset + 45);
    } else {
      const kZobrazeni = udalosti.slice(0, maxUdalosti);
      kZobrazeni.forEach((udalost) => {
        const dnyKratke = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
        const denTydneKratky = dnyKratke[udalost.start.getDay()];
        const formatovaneDatum = `${denTydneKratky} ${udalost.start.getDate()}. ${udalost.start.getMonth() + 1}.`;
        
        const hod = String(udalost.start.getHours()).padStart(2, '0');
        const min = String(udalost.start.getMinutes()).padStart(2, '0');
        const formatovanyCas = `${hod}:${min}`;

        const jeDnes = fieldsAreSameDay(ted, udalost.start);
        
        ctx.fillStyle = jeDnes ? '#EFF6FF' : '#FFFFFF'; 
        ctx.shadowColor = 'rgba(0, 0, 0, 0.03)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        stiskniZaoblenyObdelnik(ctx, 315, yOffset, 450, 64, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillStyle = jeDnes ? '#2563EB' : '#D1D5DB';
        ctx.fillRect(315, yOffset, 5, 64); 

        ctx.fillStyle = '#2563EB';
        ctx.font = 'bold 16px DisplejFont';
        ctx.fillText(formatovanyCas, 335, yOffset + 28);
        ctx.fillStyle = '#6B7280';
        ctx.font = '13px DisplejFont';
        ctx.fillText(formatovaneDatum, 335, yOffset + 48);

        ctx.fillStyle = '#111827';
        ctx.font = 'bold 17px DisplejFont';
        let nazev = udalost.title;
        if (nazev.length > 34) {
          nazev = nazev.substring(0, 31) + '...';
        }
        ctx.fillText(nazev, 450, yOffset + 38);

        yOffset += 76;
      });
    }

    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=10, must-revalidate'); 
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('Kritická chyba:', error);
    const errorCanvas = createCanvas(800, 480);
    const errorCtx = errorCanvas.getContext('2d');
    errorCtx.fillStyle = '#111827';
    errorCtx.fillRect(0, 0, 800, 480);
    errorCtx.fillStyle = '#EF4444';
    errorCtx.font = 'bold 24px DisplejFont';
    errorCtx.fillText('Chyba systému', 50, 80);
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(errorCanvas.toBuffer('image/png'));
  }
}

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

function fieldsAreSameDay(date1, date2) {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
}
