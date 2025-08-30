// CÓDIGO NOVO E COMPLETO PARA get-available-slots.js
const { google } = require("googleapis");

// Lista fixa de horários permitidos
const HORARIOS_PERMITIDOS = ['10:10', '11:40', '13:00', '14:30', '15:45'];
const TIMEZONE = "America/Sao_Paulo";

exports.handler = async (event) => {
  const { date } = event.queryStringParameters;

  if (!date) {
    return { statusCode: 400, body: JSON.stringify({ error: "A data é obrigatória." }) };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    const startOfDay = new Date(`${date}T00:00:00.000-03:00`);
    const endOfDay = new Date(`${date}T23:59:59.999-03:00`);

    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      timeZone: TIMEZONE,
    });

    const busySlots = response.data.items.map((event) => ({
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
    }));

    const availableSlots = [];
    const now = new Date();

    for (const time of HORARIOS_PERMITIDOS) {
      const [hour, minute] = time.split(':');
      const slotStart = new Date(`${date}T${hour}:${minute}:00.000-03:00`);

      if (slotStart < now) {
        continue;
      }

      // Vamos considerar um evento como ocupado se ele se sobrepuser por 1 minuto que seja.
      const slotEnd = new Date(slotStart.getTime() + 1 * 60000);

      let isBusy = false;
      for (const busy of busySlots) {
        if (slotStart < busy.end && slotEnd > busy.start) {
          isBusy = true;
          break;
        }
      }

      if (!isBusy) {
        availableSlots.push(time);
      }
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ slots: availableSlots }),
    };

  } catch (error) {
    console.error("Erro ao acessar a API do Google Calendar:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Não foi possível buscar os horários." }) };
  }
};
