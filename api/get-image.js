import https from 'https';

// Pomocná funkce pro stahování dat na jakékoliv verzi Node.js na Vercelu
function serverFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = options.headers || {};
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    }).on('error', (err) => reject(err));
  });
}

export default async function handler(req, res) {
  // HLAVNÍ OPRAVA PRO CACHE: Vercel nebude stránku ukládat do mezipaměti a pokaždé ji načte znovu live
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const icloudUrl = "https://p41-calendars.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk00_qS7cioqmCe26e9wjXEI7QQzsDADgoUP7pulJyg9tlRP3MPsrl4uTdeXFEymRFI";
  const weatherUrl = "https://open-meteo.com";

  let icalRawText = "";
  let weatherData = null;

  try {
    const [icalRes, weatherRes] = await Promise.all([
      serverFetch(icloudUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      serverFetch(weatherUrl)
    ]);
    
    if (icalRes.ok) icalRawText = await icalRes.text();
    if (weatherRes.ok) weatherData = await weatherRes.json();
  } catch (e) {
    console.error("Chyba při stahování dat:", e);
  }

  const events = [];
  if (icalRawText) {
    const lines = icalRawText.split(/\r?\n/);
    let currentEvent = null;

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed === "BEGIN:VEVENT") {
        currentEvent = { summary: "Bez názvu", start: null, isAllDay: false };
      } else if (trimmed === "END:VEVENT" && currentEvent) {
        if (currentEvent.start) events.push(currentEvent);
        currentEvent = null;
      } else if (currentEvent) {
        if (trimmed.startsWith("SUMMARY:")) {
          currentEvent.summary = trimmed.replace("SUMMARY:", "").trim();
        } else if (trimmed.startsWith("DTSTART")) {
          const cleanPart = trimmed.split(":").pop().trim();
          
          const yStr = cleanPart.substring(0, 4);
          const mStr = cleanPart.substring(4, 6);
          const dStr = cleanPart.substring(6, 8);
          
          if (trimmed.includes("VALUE=DATE") || cleanPart.length < 9) {
            // Bezpečné lokální datum pro celodenní události (jako je 29.9. sběr odpadu)
            currentEvent.start = new Date(`${yStr}-${mStr}-${dStr}T00:00:00`);
            currentEvent.isAllDay = true;
          } else {
            const hour = parseInt(cleanPart.substring(9, 11)) || 0;
            const minute = parseInt(cleanPart.substring(11, 13)) || 0;
            
            if (cleanPart.endsWith("Z")) {
              currentEvent.start = new Date(Date.UTC(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr), hour, minute, 0));
            } else {
              currentEvent.start = new Date(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr), hour, minute, 0);
            }
          }
        }
      }
    }
  }

  events.sort((a, b) => a.start - b.start);
  
  const dnesPulnoc = new Date();
  dnesPulnoc.setHours(0, 0, 0, 0);
  
  // Filtrujeme události od dnešní půlnoci, aby se zobrazilo přesně 5 nadcházejících událostí
  const budouciEvents = events.filter(ev => {
    const evKopie = new Date(ev.start.getTime());
    evKopie.setHours(0, 0, 0, 0);
    return evKopie >= dnesPulnoc;
  }).slice(0, 5);

  const dnyTyždne = ["NEDĚLE", "PONDĚLÍ", "ÚTERÝ", "STŘEDA", "ČTVRTEK", "PÁTEK", "SOBOTA"];
  const mesice = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
  
  const ceskyCas = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
  const jmenoDne = dnyTyždne[ceskyCas.getDay()];
  const cisloDne = ceskyCas.getDate();
  const jmenoMesice = mesice[ceskyCas.getMonth()];
  const casAktualizace = ceskyCas.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

  let htmlEvents = "";
  if (budouciEvents.length === 0) {
    htmlEvents = `<div style="color:#86868b; text-align:center; padding:50px 0; font-size:15px; font-weight:500;">Žádné nadcházející události</div>`;
  } else {
    budouciEvents.forEach(ev => {
      const evDencislo = ev.start.getDate();
      const evDenvTyzdni = ev.start.toLocaleString('cs-CZ', { weekday: 'short' }).toUpperCase();
      const timeString = ev.isAllDay ? "Celý den" : ev.start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      const cleanSummary = ev.summary.replace(/\\,/g, ",").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      htmlEvents += `
        <div style="display:flex; align-items:center; background:#2c2c2e; padding:5px 10px; margin-bottom:4px; border-radius:8px; border-left:4px solid #0a84ff;">
          <div style="background:#1c1c1e; padding:4px 6px; border-radius:6px; text-align:center; min-width:44px; margin-right:12px;">
            <span style="font-size:9px; font-weight:800; color:#ef4444; display:block; margin-bottom:1px;">${evDenvTyzdni}</span>
            <span style="font-size:15px; font-weight:700; color:#ffffff; display:block; line-height:15px;">${evDencislo}</span>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:600; color:#f5f5f7; margin-bottom:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cleanSummary}</div>
            <div style="font-size:11px; color:#3b82f6; font-weight:700;">🕒 ${timeString}</div>
          </div>
        </div>`;
    });
  }

  let htmlWeather = "";
  if (weatherData && weatherData.daily) {
    const codes = {
      0: { ico: "☀️" }, 1: { ico: "⛅" }, 2: { ico: "⛅" }, 3: { ico: "⛅" },
      45: { ico: "🌫️" }, 48: { ico: "🌫️" }, 51: { ico: "🌧️" }, 53: { ico: "🌧️" },
      55: { ico: "🌧️" }, 61: { ico: "🌧️" }, 63: { ico: "🌧️" }, 65: { ico: "🌧️" },
      71: { ico: "❄️" }, 73: { ico: "❄️" }, 75: { ico: "❄️" }, 77: { ico: "❄️" }
    };

    const dnyKratke = ["DNES", "ZÍTRA", "POZÍTŘÍ"];
    for (let i = 0; i < 3; i++) {
      const maxT = Math.round(weatherData.daily.temperature_2m_max[i]);
      const minT = Math.round(weatherData.daily.temperature_2m_min[i]);
      const code = weatherData.daily.weathercode[i];
      const wInfo = codes[code] || { ico: "☁️" };
      const denLabel = dnyKratke[i];

      htmlWeather += `
        <div class="weather-day">
          <span style="font-weight:800; color:#a0a0ab; text-transform:uppercase; font-size:10px; letter-spacing:0.5px; margin-bottom:2px;">${denLabel}</span>
          <span style="font-size:26px; margin:2px 0; display:block;">${wInfo.ico}</span>
          <span style="font-weight:600; font-size:13px; color:#ffffff;">${maxT}° / <span style="color:#71717a;">${minT}°</span></span>
        </div>`;
    }
  } else {
    htmlWeather = `<div style="color:#ef4444; font-size:12px; width:100%; text-align:center; padding:10px 0;">⚠️ Problém s daty počasí</div>`;
  }

  const finalHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; }
        html, body { margin:0; padding:0; background:#09090b; font-family:-apple-system, BlinkMacSystemFont, sans-serif; overflow:hidden; width:800px; height:480px; }
        .dashboard { width:800px; height:480px; display:flex; background:#09090b; align-items:stretch; }
        .left-panel { width:220px; height:100%; background:#111113; border-right:2px solid #27272a; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:15px; text-align:center; }
        .right-panel { width:580px; height:100%; padding:15px 20px 12px 20px; display:flex; flex-direction:column; justify-content:space-between; }
        .weather-box { display:flex; justify-content:space-between; background:#18181b; border:1px solid #27272a; padding:10px 6px; border-radius:12px; width:100%; height:76px; align-items:center; }
        .weather-day { text-align: center; flex: 1; color: #f5f5f7; }
        .weather-day span { display: block; }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <div class="left-panel">
          <div style="font-size: 13px; font-weight: 800; color: #ef4444; letter-spacing: 2px; margin-bottom: 12px; text-transform: uppercase;">${jmenoDne}</div>
          <div style="font-size: 95px; font-weight: 900; color: #ffffff; line-height: 80px; margin-bottom: 0px;">${cisloDne}</div>
          <div style="font-size: 20px; font-weight: 600; color: #a0a0ab; margin-bottom: 10px;">${jmenoMesice}</div>
          
          <!-- PŘIDANÉ SRDÍČKO POD DATUMEM -->
          <div style="font-size: 24px; margin-bottom: 15px; filter: drop-shadow(0 2px 4px rgba(239,68,68,0.2));">❤️</div>
          
          <div style="background: #27272a; color: #a0a0ab; padding: 5px 10px; border-radius: 15px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;">AKTUALIZOVÁNO v ${casAktualizace}</div>
        </div>
        <div class="right-panel">
          <div style="width:100%; display:flex; flex-direction:column;">
            <div style="font-size: 11px; font-weight: 800; color: #a0a0ab; letter-spacing: 1.5px; margin-bottom: 8px;">RODINNÝ KALENDÁŘ</div>
            ${htmlEvents}
          </div>
