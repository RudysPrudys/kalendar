export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const icloudUrl = "https://p41-calendars.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk00_qS7cioqmCe26e9wjXEI7QQzsDADgoUP7pulJyg9tlRP3MPsrl4uTdeXFEymRFI";
  // Souřadnice pro Černou Horu, parametry upraveny pro 100% kompatibilitu
  const weatherUrl = "https://open-meteo.com";

  let icalRawText = "";
  let weatherData = null;

  // 1. Paralelní stahování dat
  try {
    const [icalRes, weatherRes] = await Promise.all([
      fetch(icloudUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(weatherUrl)
    ]);
    
    if (icalRes.ok) icalRawText = await icalRes.text();
    if (weatherRes.ok) weatherData = await weatherRes.json();
  } catch (e) {
    console.error("Chyba při stahování dat:", e);
  }

  // 2. Parser iCal kalendáře
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
          const year = parseInt(cleanPart.substring(0, 4));
          const month = parseInt(cleanPart.substring(4, 6)) - 1;
          const day = parseInt(cleanPart.substring(6, 8));
          
          if (trimmed.includes("VALUE=DATE") || cleanPart.length < 9) {
            currentEvent.start = new Date(year, month, day, 0, 0, 0);
            currentEvent.isAllDay = true;
          } else {
            const hour = parseInt(cleanPart.substring(9, 11)) || 0;
            const minute = parseInt(cleanPart.substring(11, 13)) || 0;
            
            if (cleanPart.endsWith("Z")) {
              currentEvent.start = new Date(Date.UTC(year, month, day, hour, minute, 0));
            } else {
              currentEvent.start = new Date(year, month, day, hour, minute, 0);
            }
          }
        }
      }
    }
  }

  // Řazení a filtrace
  events.sort((a, b) => a.start - b.start);
  const dnes = new Date();
  dnes.setHours(0,0,0,0);
  const budouciEvents = events.filter(ev => ev.start >= dnes).slice(0, 5);

  // 3. Český čas a datum
  const dnyTyždne = ["NEDĚLE", "PONDĚLÍ", "ÚTERÝ", "STŘEDA", "ČTVRTEK", "PÁTEK", "SOBOTA"];
  const mesice = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
  
  const ceskyCas = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
  const jmenoDne = dnyTyždne[ceskyCas.getDay()];
  const cisloDne = ceskyCas.getDate();
  const jmenoMesice = mesice[ceskyCas.getMonth()];
  const casAktualizace = ceskyCas.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

  // 4. HTML pro Kalendář (Kompaktnější padding pro 5 událostí)
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
        <div style="display:flex; align-items:center; background:#2c2c2e; padding:6px 12px; margin-bottom:5px; border-radius:8px; border-left:4px solid #0a84ff;">
          <div style="background:#1c1c1e; padding:4px 6px; border-radius:6px; text-align:center; min-width:44px; margin-right:12px;">
            <span style="font-size:9px; font-weight:800; color:#ef4444; display:block; margin-bottom:1px;">${evDenvTyzdni}</span>
            <span style="font-size:16px; font-weight:700; color:#ffffff; display:block; line-height:16px;">${evDencislo}</span>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:15px; font-weight:600; color:#f5f5f7; margin-bottom:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cleanSummary}</div>
            <div style="font-size:12px; color:#3b82f6; font-weight:700;">🕒 ${timeString}</div>
          </div>
        </div>`;
    });
  }

  // 5. HTML pro živé Počasí (Zpracováno přímo na serveru)
  let htmlWeather = "";
  if (weatherData && weatherData.daily) {
    const codes = {
      0: { txt: "Jasno", ico: "☀️" }, 1: { txt: "Polojasno", ico: "⛅" }, 2: { txt: "Polojasno", ico: "⛅" }, 3: { txt: "Polojasno", ico: "⛅" },
      45: { txt: "Mlha", ico: "🌫️" }, 48: { txt: "Mlha", ico: "🌫️" }, 51: { txt: "Mrholení", ico: "🌧️" }, 53: { txt: "Mrholení", ico: "🌧️" },
      55: { txt: "Mrholení", ico: "🌧️" }, 61: { txt: "Déšť", ico: "🌧️" }, 63: { txt: "Déšť", ico: "🌧️" }, 65: { txt: "Déšť", ico: "🌧️" },
      71: { txt: "Sněžení", ico: "❄️" }, 73: { txt: "Sněžení", ico: "❄️" }, 75: { txt: "Sněžení", ico: "❄️" }, 77: { txt: "Sněžení", ico: "❄️" }
    };

    const dnyKratke = ["Dnes", "Zítra", "Pozítří"];
    for (let i = 0; i < 3; i++) {
      const maxT = Math.round(weatherData.daily.temperature_2m_max[i]);
      const minT = Math.round(weatherData.daily.temperature_2m_min[i]);
      const code = weatherData.daily.weathercode[i];
      const wInfo = codes[code] || { txt: "Mraky", ico: "☁️" };
      const denLabel = dnyKratke[i];

      htmlWeather += `
        <div class="weather-day">
          <span style="font-weight:700; color:#a0a0ab; text-transform:uppercase; font-size:10px; margin-bottom:2px;">${denLabel}</span>
          <span style="font-size:24px; margin:2px 0; display:block;">${wInfo.ico}</span>
          <span style="font-weight:600; font-size:14px;">${maxT}° / <span style="color:#71717a;">${minT}°</span></span>
        </div>`;
    }
  } else {
    htmlWeather = `<div style="color:#ef4444; font-size:13px; width:100%; text-align:center; padding:15px 0; font-weight:600;">⚠️ Data o počasí nebyla přijata</div>`;
  }

  // 6. Finální sestavení šablony
  const finalHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; }
        html, body { margin:0; padding:0; background:#09090b; font-family:-apple-system, BlinkMacSystemFont, sans-serif; overflow:hidden; width:800px; height:480px; }
        .dashboard { width:800px; height:480px; display:flex; background:#09090b; align-items:stretch; }
        .left-panel { width:230px; height:100%; background:#111113; border-right:2px solid #27272a; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center; }
        .right-panel { width:570px; height:100%; padding:20px 20px 15px 20px; display:flex; flex-direction:column; justify-content:space-between; }
        .weather-box { display:flex; justify-content:space-between; background:#18181b; border:1px solid #27272a; padding:12px 8px; border-radius:12px; width:100%; }
        .weather-day { text-align: center; flex: 1; color: #f5f5f7; }
        .weather-day span { display: block; }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <div class="left-panel">
          <div style="font-size: 14px; font-weight: 800; color: #ef4444; letter-spacing: 2px; margin-bottom: 15px; text-transform: uppercase;">${jmenoDne}</div>
          <div style="font-size: 100px; font-weight: 900; color: #ffffff; line-height: 85px; margin-bottom: 0px;">${cisloDne}</div>
          <div style="font-size: 22px; font-weight: 600; color: #a0a0ab; margin-bottom: 25px;">${jmenoMesice}</div>
          <div style="background: #27272a; color: #a0a0ab; padding: 6px 12px; border-radius: 15px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">AKTUALIZOVÁNO v ${casAktualizace}</div>
        </div>
        <div class="right-panel">
          <div style="width:100%; display:flex; flex-direction:column;">
            <div style="font-size: 12px; font-weight: 800; color: #a0a0ab; letter-spacing: 1.5px; margin-bottom: 10px;">RODINNÝ KALENDÁŘ</div>
            ${htmlEvents}
          </div>
          <div class="weather-box">${htmlWeather}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  res.status(200).send(finalHtml);
}
