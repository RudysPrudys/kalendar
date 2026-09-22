export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const icloudUrl = "https://p41-calendars.icloud.com/published/2/MTIyNTc4MDU4MjQxMjI1N7HBRe4SrbOMeY3BYc83Tk00_qS7cioqmCe26e9wjXEI7QQzsDADgoUP7pulJyg9tlRP3MPsrl4uTdeXFEymRFI";
  const weatherUrl = "https://open-meteo.com";

  let icalRawText = "";
  let weatherData = null;

  // 1. STAŽENÍ KALENDÁŘE
  try {
    const response = await fetch(icloudUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (response.ok) icalRawText = await response.text();
  } catch (e) {
    console.error("iCloud error:", e);
  }

  // 2. STAŽENÍ POČASÍ
  try {
    const wResponse = await fetch(weatherUrl, { headers: { 'User-Agent': 'ElecrowPanel/1.0' } });
    if (wResponse.ok) weatherData = await wResponse.json();
  } catch (e) {
    console.error("Počasí error:", e);
  }

  // Helper funkce pro převod iCal času na JS datum
  function parseRawDate(str, isAllDay) {
    try {
      const clean = str.split(":").pop().replace(/[\r\n]/g, "").trim();
      const year = parseInt(clean.substring(0, 4));
      const month = parseInt(clean.substring(4, 6)) - 1;
      const day = parseInt(clean.substring(6, 8));
      
      if (isAllDay || clean.length < 9) {
        return new Date(year, month, day, 0, 0, 0);
      }
      
      const hour = parseInt(clean.substring(9, 11)) || 0;
      // STRKTNÍ OPRAVA: Odstraněn překlep s cleanStr assignmentem
      const minute = parseInt(clean.substring(11, 13)) || 0;
      
      if (clean.endsWith("Z")) {
        return new Date(Date.UTC(year, month, day, hour, minute, 0));
      }
      return new Date(year, month, day, hour, minute, 0);
    } catch (e) {
      return null;
    }
  }

  // 3. PARSOVÁNÍ KALENDÁŘE
  const events = [];
  if (icalRawText) {
    const lines = icalRawText.split(/\r?\n/);
    let currentEvent = null;

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed === "BEGIN:VEVENT") {
        currentEvent = { summary: "Bez názvu", start: null, isAllDay: false };
      } else if (trimmed === "END:VEVENT" && currentEvent) {
        if (currentEvent.start) {
          events.push(currentEvent);
        }
        currentEvent = null;
      } else if (currentEvent) {
        if (trimmed.startsWith("SUMMARY:")) {
          currentEvent.summary = trimmed.replace("SUMMARY:", "").trim();
        } else if (trimmed.startsWith("DTSTART:")) {
          currentEvent.start = parseRawDate(trimmed.replace("DTSTART:", "").trim(), false);
        } else if (trimmed.startsWith("DTSTART;VALUE=DATE:")) {
          currentEvent.start = parseRawDate(trimmed.replace("DTSTART;VALUE=DATE:", "").trim(), true);
          currentEvent.isAllDay = true;
        }
      }
    }
  }

  events.sort((a, b) => a.start - b.start);
  const dnes = new Date();
  dnes.setHours(0,0,0,0);
  const budouciEvents = events.filter(ev => ev.start >= dnes).slice(0, 4);

  // ČESKÉ POPISKY A LOKÁLNÍ ČAS
  const dnyTyždne = ["NEDĚLE", "PONDĚLÍ", "ÚTERÝ", "STŘEDA", "ČTVRTEK", "PÁTEK", "SOBOTA"];
  const dnyKratke = ["Dnes", "Zítra", "Pozítří"];
  const mesice = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
  
  const ceskyCas = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
  const jmenoDne = dnyTyždne[ceskyCas.getDay()];
  const cisloDne = ceskyCas.getDate();
  const jmenoMesice = mesice[ceskyCas.getMonth()];
  const casAktualizace = ceskyCas.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

  // GENERUJI KALENDÁŘ DO HTML
  let htmlEvents = "";
  if (budouciEvents.length === 0) {
    htmlEvents = `<div style="color:#86868b; text-align:center; padding:50px 0; font-size:18px;">Žádné nadcházející události</div>`;
  } else {
    budouciEvents.forEach(ev => {
      const evDencislo = ev.start.getDate();
      const evDenvTyzdni = ev.start.toLocaleString('cs-CZ', { weekday: 'short' }).toUpperCase();
      const timeString = ev.isAllDay ? "Celý den" : ev.start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      const cleanSummary = ev.summary.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      htmlEvents += `
        <div style="display:flex; align-items:center; background:#2c2c2e; padding:8px 12px; margin-bottom:5px; border-radius:10px; border-left:4px solid #0a84ff;">
          <div style="background:#1c1c1e; padding:4px 8px; border-radius:6px; text-align:center; min-width:42px; margin-right:12px;">
            <span style="font-size:9px; font-weight:800; color:#ef4444; display:block; margin-bottom:1px;">${evDenvTyzdni}</span>
            <span style="font-size:16px; font-weight:700; color:#ffffff; display:block; line-height:16px;">${evDencislo}</span>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:600; color:#f5f5f7; margin-bottom:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cleanSummary}</div>
            <div style="font-size:11px; color:#3b82f6; font-weight:700;">🕒 ${timeString}</div>
          </div>
        </div>`;
    });
  }

  // GENERUJI POČASÍ DO HTML
  let htmlWeather = "";
  if (weatherData && weatherData.daily) {
    const codes = {
      0: { txt: "Jasno", ico: "☀️" }, 1: { txt: "Polojasno", ico: "⛅" }, 2: { txt: "Polojasno", ico: "⛅" }, 3: { txt: "Polojasno", ico: "⛅" },
      45: { txt: "Mlha", ico: "🌫️" }, 48: { txt: "Mlha", ico: "🌫️" }, 51: { txt: "Mrholení", ico: "🌧️" }, 53: { txt: "Mrholení", ico: "🌧️" },
      55: { txt: "Mrholení", ico: "🌧️" }, 61: { txt: "Déšť", ico: "🌧️" }, 63: { txt: "Déšť", ico: "🌧️" }, 65: { txt: "Déšť", ico: "🌧️" },
      71: { txt: "Sněžení", ico: "❄️" }, 73: { txt: "Sněžení", ico: "❄️" }, 75: { txt: "Sněžení", ico: "❄️" }, 77: { txt: "Sněžení", ico: "❄️" }
    };

    htmlWeather += `<div style="display:flex; justify-content:space-between; background:#18181b; border:1px solid #27272a; padding:10px; border-radius:12px; margin-top:10px; width:100%;">`;
    for (let i = 0; i < 3; i++) {
      const maxT = Math.round(weatherData.daily.temperature_2m_max[i]);
      const minT = Math.round(weatherData.daily.temperature_2m_min[i]);
      const code = weatherData.daily.weathercode[i];
      const wInfo = codes[code] || { txt: "Mraky", ico: "☁️" };

      let denLabel = dnyKratke[i];
      if (i === 2) {
        const budiciDen = new Date(ceskyCas);
        budiciDen.setDate(budiciDen.getDate() + 2);
        denLabel = budiciDen.toLocaleString('cs-CZ', { weekday: 'short' });
      }

      htmlWeather += `
        <div style="text-align:center; flex:1; border-right:${i < 2 ? '1px solid #27272a' : 'none'};">
          <div style="font-size:10px; font-weight:800; color:#a0a0ab; text-transform:uppercase; margin-bottom:1px;">${denLabel}</div>
          <div style="font-size:22px; margin-bottom:1px; line-height:24px;">${wInfo.ico}</div>
          <div style="font-size:12px; font-weight:700; color:#f5f5f7;">${maxT}° / <span style="color:#71717a; font-weight:500;">${minT}°</span></div>
          <div style="font-size:9px; color:#86868b; margin-top:1px;">${wInfo.txt}</div>
        </div>`;
    }
    htmlWeather += `</div>`;
  } else {
    htmlWeather = `<div style="color:#71717a; text-align:center; font-size:12px; padding:15px; width:100%; background:#18181b; border-radius:12px; border:1px solid #27272a;">Předpověď počasí nedostupná</div>`;
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
        .left-panel { width:240px; height:100%; background:#111113; border-right:2px solid #27272a; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px 20px; text-align:center; }
        .right-panel { width:560px; height:100%; padding:25px 25px 15px 25px; display:flex; flex-direction:column; justify-content:space-between; }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <div class="left-panel">
          <div style="font-size: 14px; font-weight: 800; color: #ef4444; letter-spacing: 2px; margin-bottom: 20px; text-transform: uppercase;">${jmenoDne}</div>
          <div style="font-size: 110px; font-weight: 900; color: #ffffff; line-height: 95px; margin-bottom: 0px;">${cisloDne}</div>
          <div style="font-size: 22px; font-weight: 600; color: #a0a0ab; margin-bottom: 30px;">${jmenoMesice}</div>
          <div style="background: #27272a; color: #71717a; padding: 6px 15px; border-radius: 15px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">AKTUALIZOVÁNO v ${casAktualizace}</div>
        </div>
        <div class="right-panel">
          <div style="width:100%; display:flex; flex-direction:column;">
            <div style="font-size: 13px; font-weight: 800; color: #a0a0ab; letter-spacing: 1.5px; margin-bottom: 15px;">RODINNÝ KALENDÁŘ</div>
            ${htmlEvents}
          </div>
          ${htmlWeather}
        </div>
      </div>
    </body>
    </html>`.trim();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(finalHtml);
}
