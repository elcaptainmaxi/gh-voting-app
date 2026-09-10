const sections = [
  {
    kicker: "SECCIÓN 1",
    title: "Información básica",
    description: "Datos de identificación y disponibilidad para el experimento.",
    questions: [
      { key: "q1", label: "Nombre Rolero", type: "text", max: 100 },
      { key: "q2", label: "Apellido Rolero", type: "text", max: 100 },
      { key: "q3", label: "Edad Real", type: "number", min: 13, max: 99 },
      { key: "q4", label: "País Real", type: "text", max: 100 },
      { key: "q5", label: "Conectar con Discord mediante el sistema de autenticación/auth existente.", type: "discord" },
      { key: "q6", label: "Conectar con Roblox mediante auth.", type: "roblox" },
      { key: "q7", label: "¿Podrás participar durante los 2 o 3 días completos que dure el reality? Explicá tu disponibilidad.", type: "textarea" },
    ],
  },
  {
    kicker: "SECCIÓN 2",
    title: "Tu personalidad",
    description: "Queremos entender cómo sos antes de verte bajo presión.",
    questions: [
      { key: "q8", label: "Describite en cinco palabras. Luego explicá por qué elegiste cada una.", type: "textarea" },
      { key: "q9", label: "¿Qué aspecto de tu personalidad creés que más sorprendería a alguien que recién te conoce?", type: "textarea" },
      { key: "q10", label: "¿Cuál considerás que es tu mayor virtud dentro de un grupo?", type: "textarea" },
      { key: "q11", label: "¿Cuál es el defecto que más podría perjudicarte dentro del reality?", type: "textarea" },
      { key: "q12", label: "Cuando cometés un error importante, ¿cómo reaccionás normalmente?", type: "textarea" },
    ],
  },
  {
    kicker: "SECCIÓN 3",
    title: "Convivencia",
    description: "El Laboratorio también mide vínculos, fricción y adaptación social.",
    questions: [
      { key: "q13", label: "Un participante comienza a hablar mal de vos con varias personas de la casa. ¿Cuál sería tu primera reacción?", type: "textarea" },
      { key: "q14", label: "Dos de tus aliados empiezan a pelearse entre ellos. Ambos quieren que te pongas de su lado. ¿Qué hacés?", type: "textarea" },
      { key: "q15", label: "¿Qué actitud de otra persona no soportarías durante la convivencia?", type: "textarea" },
      { key: "q16", label: "Contanos un conflicto real que hayas tenido y cómo terminó.", type: "textarea" },
    ],
  },
  {
    kicker: "SECCIÓN 4",
    title: "Estrategia",
    description: "No buscamos una única forma de jugar: buscamos entender la tuya.",
    questions: [
      { key: "q17", label: "El primer día todos están formando grupos. ¿Cómo decidirías con quién juntarte? Explicá tu razonamiento.", type: "textarea" },
      { key: "q18", label: "Si tu estrategia inicial fracasa completamente durante el primer día, ¿cómo intentarías recuperarte?", type: "textarea" },
      { key: "q19", label: "¿Qué tipo de jugador creés que serías?", help: "Opciones orientativas: Líder, Estratega, Social, Competitivo, Provocador, Mediador u Otro. Después explicá por qué.", type: "textarea" },
      { key: "q20", label: "¿Cuál sería el mayor error estratégico que podrías cometer dentro del juego?", type: "textarea" },
      { key: "q21", label: "¿Qué cosas estarías dispuesto a hacer para ganar? ¿Y qué cosas nunca harías?", type: "textarea" },
    ],
  },
  {
    kicker: "SECCIÓN 5",
    title: "Juego social",
    description: "Percepción, manipulación y reputación pueden cambiar una partida completa.",
    questions: [
      { key: "q22", label: "Si descubrieras un secreto que podría cambiar completamente el juego, ¿qué harías con esa información?", type: "textarea" },
      { key: "q23", label: "Si todos creen que sos una amenaza, ¿cómo intentarías cambiar esa percepción?", type: "textarea" },
      { key: "q24", label: "Si alguien consigue manipularte, ¿cómo reaccionarías cuando lo descubras?", type: "textarea" },
      { key: "q25", label: "¿Preferís ser querido por todos o que te teman como jugador? ¿Por qué?", type: "textarea" },
    ],
  },
  {
    kicker: "SECCIÓN 6",
    title: "El Laboratorio",
    description: "Ahora queremos saber qué significaría para vos formar parte del experimento.",
    questions: [
      { key: "q26", label: "¿Por qué querés participar en El Laboratorio?", type: "textarea" },
      { key: "q27", label: "¿Qué creés que aportarías al programa que otros participantes quizás no puedan aportar?", type: "textarea" },
      { key: "q28", label: "Imaginá que sos eliminado en la primera eliminación. ¿Cómo reaccionarías?", type: "textarea" },
      { key: "q29", label: "Imaginá que llegás a la final. ¿Qué creés que hizo que llegaras hasta ahí?", type: "textarea" },
    ],
  },
  {
    kicker: "SECCIÓN FINAL",
    title: "Última evaluación",
    description: "Una última respuesta antes de cerrar tu expediente.",
    questions: [
      { key: "q30", label: "Si Producción solo pudiera recordar una cosa de vos después de leer este casting, ¿qué te gustaría que fuera?", type: "textarea" },
    ],
  },
];

let currentSection = 0;
let answers = {};
let castingState = null;
let submitting = false;

const wizard = document.querySelector("#wizard");
const loginGate = document.querySelector("#loginGate");
const submittedState = document.querySelector("#submittedState");
const accountSummary = document.querySelector("#accountSummary");
const form = document.querySelector("#castingForm");
const questionsContainer = document.querySelector("#questionsContainer");
const previousButton = document.querySelector("#previousButton");
const nextButton = document.querySelector("#nextButton");
const submitButton = document.querySelector("#submitButton");
const formError = document.querySelector("#formError");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function discordAvatar(identity) {
  if (!identity?.avatar) return "";
  return `https://cdn.discordapp.com/avatars/${identity.id}/${identity.avatar}.png?size=96`;
}

function identityMarkup(identity, provider) {
  if (!identity) {
    return provider === "roblox"
      ? `<div class="identity-card"><div class="identity-main"><div class="identity-avatar fallback">R</div><div class="identity-copy"><strong>Roblox no vinculado</strong><span>Necesario para enviar la postulación</span></div></div><a class="button primary compact" href="/auth/roblox/login">Conectar Roblox</a></div>`
      : "";
  }

  const image = provider === "discord" ? discordAvatar(identity) : identity.avatar;
  const title = identity.displayName || identity.globalName || identity.username;
  const subtitle = `@${identity.username || "usuario"} · ID ${identity.id}`;

  return `<div class="identity-card"><div class="identity-main">${image ? `<img class="identity-avatar" src="${escapeHtml(image)}" alt="" />` : `<div class="identity-avatar fallback">${provider === "discord" ? "D" : "R"}</div>`}<div class="identity-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div></div><span class="linked-badge">VINCULADO</span></div>`;
}

function renderQuestion(question, number) {
  const value = answers[question.key] || "";
  const help = question.help ? `<p class="question-help">${escapeHtml(question.help)}</p>` : "";

  if (question.type === "discord") {
    return `<div class="question" data-key="${question.key}"><div class="question-label"><span class="question-number">${number}.</span>${escapeHtml(question.label)}</div>${identityMarkup(castingState.identity.discord, "discord")}</div>`;
  }

  if (question.type === "roblox") {
    return `<div class="question" data-key="${question.key}"><div class="question-label"><span class="question-number">${number}.</span>${escapeHtml(question.label)}</div>${identityMarkup(castingState.identity.roblox, "roblox")}</div>`;
  }

  const common = `data-answer-key="${question.key}" id="${question.key}" required`;
  let input = "";

  if (question.type === "textarea") {
    input = `<textarea ${common} maxlength="6000">${escapeHtml(value)}</textarea>`;
  } else if (question.type === "number") {
    input = `<input ${common} type="number" min="${question.min}" max="${question.max}" value="${escapeHtml(value)}" />`;
  } else {
    input = `<input ${common} type="text" maxlength="${question.max || 500}" value="${escapeHtml(value)}" />`;
  }

  return `<div class="question" data-key="${question.key}"><label class="question-label" for="${question.key}"><span class="question-number">${number}.</span>${escapeHtml(question.label)}</label>${help}${input}</div>`;
}

function questionNumber(key) {
  return Number(key.slice(1));
}

function collectVisibleAnswers() {
  questionsContainer.querySelectorAll("[data-answer-key]").forEach((field) => {
    answers[field.dataset.answerKey] = field.value.trim();
  });
}

function validateCurrentSection() {
  collectVisibleAnswers();
  formError.hidden = true;
  questionsContainer.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));

  const section = sections[currentSection];
  const missing = [];

  for (const question of section.questions) {
    if (question.type === "discord") continue;
    if (question.type === "roblox") {
      if (!castingState.identity.roblox) missing.push(question.key);
      continue;
    }
    if (!answers[question.key]) missing.push(question.key);
  }

  if (missing.includes("q3")) {
    const age = Number.parseInt(answers.q3, 10);
    if (Number.isInteger(age) && age >= 13 && age <= 99) {
      missing.splice(missing.indexOf("q3"), 1);
    }
  } else if (section.questions.some((q) => q.key === "q3")) {
    const age = Number.parseInt(answers.q3, 10);
    if (!Number.isInteger(age) || age < 13 || age > 99) missing.push("q3");
  }

  if (missing.length) {
    missing.forEach((key) => document.querySelector(`[data-answer-key="${key}"]`)?.classList.add("invalid"));
    formError.textContent = missing.includes("q6")
      ? "Vinculá tu cuenta de Roblox y completá todas las respuestas de esta sección."
      : "Completá todas las respuestas de esta sección para continuar.";
    formError.hidden = false;
    document.querySelector(`[data-key="${missing[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  return true;
}

function render() {
  const section = sections[currentSection];
  document.querySelector("#sectionKicker").textContent = section.kicker;
  document.querySelector("#sectionTitle").textContent = section.title;
  document.querySelector("#sectionDescription").textContent = section.description;
  document.querySelector("#stepLabel").textContent = `Etapa ${currentSection + 1} de ${sections.length}`;

  const percent = Math.round(((currentSection + 1) / sections.length) * 100);
  document.querySelector("#progressPercent").textContent = `${percent}%`;
  document.querySelector("#progressBar").style.width = `${percent}%`;
  document.querySelector("#sectionNav").innerHTML = sections
    .map((_, index) => `<span class="section-dot ${index < currentSection ? "done" : index === currentSection ? "current" : ""}"></span>`)
    .join("");

  questionsContainer.innerHTML = section.questions.map((question) => renderQuestion(question, questionNumber(question.key))).join("");
  previousButton.disabled = currentSection === 0;
  nextButton.hidden = currentSection === sections.length - 1;
  submitButton.hidden = currentSection !== sections.length - 1;
  formError.hidden = true;
  window.scrollTo({ top: document.querySelector("#wizard").offsetTop - 18, behavior: "smooth" });
}

previousButton.addEventListener("click", () => {
  collectVisibleAnswers();
  if (currentSection > 0) {
    currentSection -= 1;
    render();
  }
});

nextButton.addEventListener("click", () => {
  if (!validateCurrentSection()) return;
  if (currentSection < sections.length - 1) {
    currentSection += 1;
    render();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting || !validateCurrentSection()) return;

  submitting = true;
  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";

  try {
    const response = await fetch("/api/casting/applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": castingState.csrfToken,
      },
      body: JSON.stringify({ answers }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo enviar la postulación.");

    showSubmitted(data.application);
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
    submitButton.disabled = false;
    submitButton.textContent = "Enviar postulación";
    submitting = false;
  }
});

function statusLabel(status) {
  return { PENDING: "Pendiente", APPROVED: "Aprobado", REJECTED: "Rechazado" }[status] || status;
}

function showSubmitted(application) {
  wizard.hidden = true;
  submittedState.hidden = false;
  const date = new Date(application.submittedAt);
  document.querySelector("#submittedMeta").textContent = `Enviada el ${date.toLocaleString("es-AR")} · Estado: ${statusLabel(application.status)}`;
}

async function init() {
  try {
    const response = await fetch("/api/casting/me", { headers: { Accept: "application/json" } });
    if (response.status === 401) {
      loginGate.hidden = false;
      return;
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo cargar el casting.");

    castingState = data;
    const discordName = data.identity.discord.globalName || data.identity.discord.username;
    accountSummary.textContent = `Discord: ${discordName}${data.identity.roblox ? ` · Roblox: @${data.identity.roblox.username}` : ""}`;
    accountSummary.hidden = false;

    if (data.application) {
      showSubmitted(data.application);
      return;
    }

    wizard.hidden = false;
    render();
  } catch (error) {
    loginGate.hidden = false;
    loginGate.querySelector("p:last-child").textContent = error.message;
  }
}

init();
