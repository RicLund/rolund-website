const CONTACT_TO = "info@rolundmusic.com";
const CONTACT_FROM = "info@rolundmusic.com";
const MAX_BODY_BYTES = 8192;

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const cleanText = (value, maxLength) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const cleanMessage = (value) =>
  String(value || "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 1400);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const handleContact = async (request, env) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Message is too large." }, 413);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid message." }, 400);
  }

  if (cleanText(payload.website, 200)) {
    return jsonResponse({ ok: true });
  }

  const name = cleanText(payload.name, 80);
  const email = cleanText(payload.email, 120);
  const message = cleanMessage(payload.message);

  if (!name || !isValidEmail(email) || message.length < 8) {
    return jsonResponse({ error: "Please include your name, email, and message." }, 400);
  }

  if (!env.CONTACT_EMAIL || typeof env.CONTACT_EMAIL.send !== "function") {
    return jsonResponse({ error: "Contact email is not configured yet." }, 503);
  }

  const subject = `Rolund website contact: ${name}`;
  const text = [
    "New message from rolundmusic.com",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    "",
    "Message:",
    message,
  ].join("\n");

  try {
    await env.CONTACT_EMAIL.send({
      to: CONTACT_TO,
      from: CONTACT_FROM,
      replyTo: email,
      subject,
      text,
    });
  } catch (error) {
    console.error("Contact email failed", error);
    return jsonResponse({ error: "Message could not be sent." }, 502);
  }

  return jsonResponse({ ok: true });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
