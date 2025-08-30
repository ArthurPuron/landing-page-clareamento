// SUBSTITUA O CÓDIGO DE create-appointment.js POR ESTE

const { google } = require("googleapis");
const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { date, time, patientName, patientBirthdate, patientWhatsapp } = JSON.parse(event.body);

    // Validação básica
    if (!patientName || !patientWhatsapp) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Nome e WhatsApp são obrigatórios." }),
      };
    }

    // Se a data e a hora não forem enviadas, é um lead da Landing Page
    const isLandingPageLead = !date || !time;

    // --- Bloco de Envio de E-mail ---
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_SENDER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const emailSubject = isLandingPageLead 
      ? `Novo Lead (Landing Page Clareamento) - ${patientName}`
      : `Novo Pré-Agendamento Recebido - ${patientName}`;
      
    const emailBody = isLandingPageLead 
      ? `
          <h1>Novo Lead da Landing Page de Clareamento</h1>
          <p>Um novo paciente preencheu o formulário. Entre em contato para agendar.</p>
          <ul>
              <li><strong>Nome:</strong> ${patientName}</li>
              <li><strong>WhatsApp:</strong> ${patientWhatsapp}</li>
          </ul>
        `
      : `
          <h1>Novo Pré-Agendamento pelo Site</h1>
          <p>Um novo paciente solicitou um horário. Entre em contato para confirmar.</p>
          <ul>
              <li><strong>Nome:</strong> ${patientName}</li>
              <li><strong>Data de Nascimento:</strong> ${patientBirthdate}</li>
              <li><strong>WhatsApp:</strong> ${patientWhatsapp}</li>
              <li><strong>Horário Solicitado:</strong> ${date.split('-').reverse().join('/')} às ${time}</li>
          </ul>
        `;

    await transporter.sendMail({
      from: `"Site Dra. Amanda" <${process.env.EMAIL_SENDER}>`,
      to: process.env.EMAIL_SENDER,
      subject: emailSubject,
      html: emailBody
    });

    // --- Bloco do Google Calendar (só executa se NÃO for lead da landing page) ---
    if (!isLandingPageLead) {
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
      const endTime = new Date(startTime.getTime() + 60 * 60000);

      await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: {
          summary: `Pré-Agendamento: ${patientName}`,
          description: `Paciente: ${patientName}\nData de Nascimento: ${patientBirthdate}\nWhatsApp: ${patientWhatsapp}\n\nStatus: AGUARDANDO CONFIRMAÇÃO.`,
          start: { dateTime: startTime.toISOString(), timeZone: "America/Sao_Paulo" },
          end: { dateTime: endTime.toISOString(), timeZone: "America/Sao_Paulo" },
        },
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Solicitação enviada com sucesso!" }),
    };

  } catch (error) {
    console.error("Erro na função:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Falha ao processar a solicitação.", details: error.message }),
    };
  }
};
