// CÓDIGO NOVO E COMPLETO PARA create-appointment.js
const { google } = require("googleapis");
const nodemailer = require("nodemailer");

const TIMEZONE = "America/Sao_Paulo";

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  try {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 1. Capturar o novo campo WhatsApp
    const { date, time, patientName, patientBirthdate, patientWhatsapp } = JSON.parse(event.body);

    if (!date || !time || !patientName || !patientBirthdate || !patientWhatsapp) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Todos os campos são obrigatórios." }),
      };
    }

    // 2. Criar o evento na agenda (código existente)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    const [hour, minute] = time.split(':');
    const startTime = new Date(`${date}T${hour}:${minute}:00.000-03:00`);
    const endTime = new Date(startTime.getTime() + 60 * 60000); // Adiciona 60 min para o fim

    const eventDetails = {
      summary: `Pré-Agendamento: ${patientName}`,
      description: `Paciente: ${patientName}\nData de Nascimento: ${patientBirthdate}\nWhatsApp: ${patientWhatsapp}\n\nStatus: AGUARDANDO CONFIRMAÇÃO.`,
      start: { dateTime: startTime.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: endTime.toISOString(), timeZone: TIMEZONE },
    };

    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: eventDetails,
    });
    
    // 3. Enviar o e-mail de notificação
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_SENDER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });

    await transporter.sendMail({
        from: `"Site Agendamento" <${process.env.EMAIL_SENDER}>`,
        to: process.env.EMAIL_SENDER, // Envia para o email da Dra. Amanda
        subject: `Novo Pré-Agendamento Recebido - ${patientName}`,
        html: `
            <h1>Novo Pré-Agendamento pelo Site</h1>
            <p>Um novo paciente solicitou um horário. Entre em contato para confirmar.</p>
            <ul>
                <li><strong>Nome:</strong> ${patientName}</li>
                <li><strong>Data de Nascimento:</strong> ${patientBirthdate}</li>
                <li><strong>WhatsApp:</strong> ${patientWhatsapp}</li>
                <li><strong>Horário Solicitado:</strong> ${date.split('-').reverse().join('/')} às ${time}</li>
            </ul>
        `
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Agendamento confirmado com sucesso!" }),
    };

  } catch (error) {
    console.error("Erro ao criar evento ou enviar e-mail:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Falha ao criar o agendamento.", details: error.message }),
    };
  }
};
