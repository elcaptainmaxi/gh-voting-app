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
      { key: "q5", label: "Discord vinculado", type: "discord" },
      { key: "q6", label: "Roblox vinculado", type: "roblox" },
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
    kicker: "SECCIÓN 7",
    title: "Última evaluación",
    description: "Una última respuesta antes de revisar tu expediente.",
    questions: [
      { key: "q30", label: "Si Producción solo pudiera recordar una cosa de vos después de leer este casting, ¿qué te gustaría que fuera?", type: "textarea" },
    ],
  },
];

const REVIEW_STEP = sections.length;
const TOTAL_STEPS = sections.length + 1;
const FALLBACK_IMPORTANT = new Set(["q8", "q16", "q17", "q18", "q21", "q26", "q27", "q29", "q30"]);

let currentSection = 0;
let answers = {};
let castingState = null;
let submitting = false;
let draftKey = "";
let hasUnsubmittedDraft = false;
let allowNavigation = false;

const loadingState = document.querySelector("#loadingState");
const loadErrorState = document.querySelector("#loadErrorState");
const loadErrorMessage = document.querySelector("#loadErrorMessage");
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
const draftStatus = document.querySelector("#draftStatus");

function showOnly(state) {
  loadingState.hidden = state !== "loading";
  loadErrorState.hidden = state !== "error";
  loginGate.hidden = state !== "login";
  submittedState.hidden = state !== "submitted";
  wizard.hidden = state !== "wizard";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function startsWithUppercase(value) {
  const first = Array.from(String(value || "").trim())[0] || "";
  return /\p{Lu}/u.test(first);
}

function requirementFor(key) {
  const validation = castingState?.validation;
  const important = validation?.importantQuestions?.includes(key) ?? FALLBACK_IMPORTANT.has(key);
  if (important) return validation?.important || { minChars: 120, minWords: 20 };
  return validation?.normal || { minChars: 80, minWords: 15 };
}

function discordAvatar(identity) {
  if (!identity?.avatar) return "";
  return `https://cdn.discordapp.com/avatars/${identity.id}/${identity.avatar}.png?size=96`;
}

function identityMarkup(identity, provider) {
  if (!identity) {
    return provider === "roblox"
      ? `<div class="identity-card"><div class="identity-main"><div class="identity-avatar fallback">R</div><div class="identity-copy"><strong>Roblox no vinculado</strong><span>Obligatorio para enviar la postulación</span></div></div><a class="button primary compact" data-roblox-link href="/auth/roblox/login">Conectar Roblox</a></div>`
      : "";
  }

  const image = provider === "discord" ? discordAvatar(identity) : identity.avatar;
  const title = identity.displayName || identity.globalName || identity.username;
  const subtitle = `@${identity.username || "usuario"} · ID ${identity.id}`;

  return `<div class="identity-card"><div class="identity-main">${image ? `<img class="identity-avatar" src="${escapeHtml(image)}" alt="" />` : `<div class="identity-avatar fallback">${provider === "discord" ? "D" : "R"}</div>`}<div class="identity-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div></div><span class="linked-badge">VINCULADO</span></div>`;
}

function validationMessage(question) {
  const value = String(answers[question.key] || "").trim();

  if (question.type === "discord") return castingState?.identity?.discord ? "" : "Tenés que vincular Discord.";
  if (question.type === "roblox") return castingState?.identity?.roblox ? "" : "Tenés que vincular Roblox.";
  if (!value) return "Esta pregunta es obligatoria.";

  if (question.key === "q1" || question.key === "q2") {
    if (value.length < 2) return "Debe tener al menos 2 caracteres.";
    if (!startsWithUppercase(value)) return "La primera letra debe estar en mayúscula.";
  }

  if (question.key === "q3") {
    if (!/^\d{2}$/.test(value) || Number(value) < 13 || Number(value) > 99) {
      return "La edad debe ser un número entero entre 13 y 99.";
    }
  }

  if (question.key === "q4" && value.length < 2) return "Ingresá un país válido.";

  if (Number(question.key.slice(1)) >= 7) {
    const { minChars, minWords } = requirementFor(question.key);
    if (value.length < minChars || countWords(value) < minWords) {
      return `Mínimo ${minChars} caracteres y ${minWords} palabras.`;
    }
  }

  return "";
}

function sectionIsComplete(index) {
  return sections[index].questions.every((question) => !validationMessage(question));
}

function firstInvalidSection() {
  return sections.findIndex((_, index) => !sectionIsComplete(index));
}

function collectVisibleAnswers() {
  questionsContainer.querySelectorAll("[data-answer-key]").forEach((field) => {
    answers[field.dataset.answerKey] = field.value.trim();
  });
}

function saveDraft() {
  if (!draftKey || submitting) return;
  collectVisibleAnswers();

  const meaningful = Object.values(answers).some((value) => String(value || "").trim());
  if (!meaningful) {
    hasUnsubmittedDraft = false;
    try { localStorage.removeItem(draftKey); } catch {}
    draftStatus.textContent = "Borrador local activo";
    return;
  }

  try {
    localStorage.setItem(draftKey, JSON.stringify({
      answers,
      currentSection,
      updatedAt: new Date().toISOString(),
    }));
    hasUnsubmittedDraft = true;
    draftStatus.textContent = `Borrador guardado · ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    draftStatus.textContent = "No se pudo guardar el borrador local";
  }
}

function restoreDraft() {
  if (!draftKey) return;
  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft?.answers && typeof draft.answers === "object") answers = draft.answers;
    if (Number.isInteger(draft?.currentSection)) {
      currentSection = Math.max(0, Math.min(REVIEW_STEP, draft.currentSection));
    }
    hasUnsubmittedDraft = Object.values(answers).some((value) => String(value || "").trim());
    if (draft?.updatedAt) {
      const when = new Date(draft.updatedAt);
      draftStatus.textContent = `Borrador recuperado · ${when.toLocaleString("es-AR")}`;
    }
  } catch {
    answers = {};
    currentSection = 0;
  }
}

function clearDraft() {
  if (draftKey) {
    try { localStorage.removeItem(draftKey); } catch {}
  }
  hasUnsubmittedDraft = false;
}

function counterMarkup(question, value) {
  if (question.type === "number" || question.type === "discord" || question.type === "roblox") return "";
  if (Number(question.key.slice(1)) >= 7) {
    const { minChars, minWords } = requirementFor(question.key);
    return `<div class="answer-counter" data-counter="${question.key}">${value.length} / ${minChars} caracteres · ${countWords(value)} / ${minWords} palabras</div>`;
  }
  return `<div class="answer-counter" data-counter="${question.key}">${value.length} caracteres</div>`;
}

function helperFor(question) {
  const helpers = [];
  if (question.help) helpers.push(question.help);
  if (question.key === "q1" || question.key === "q2") helpers.push("La primera letra debe estar en mayúscula.");
  if (question.key === "q3") helpers.push("Solo se acepta una edad entera entre 13 y 99 años.");
  if (Number(question.key.slice(1)) >= 7) {
    const { minChars, minWords } = requirementFor(question.key);
    helpers.push(`Respuesta obligatoria: mínimo ${minChars} caracteres y ${minWords} palabras.`);
  }
  return helpers.length ? `<p class="question-help">${escapeHtml(helpers.join(" "))}</p>` : "";
}

function renderQuestion(question, number) {
  const value = String(answers[question.key] || "");

  if (question.type === "discord") {
    return `<div class="question" data-key="${question.key}"><div class="question-label"><span class="question-number">${number}.</span>${escapeHtml(question.label)} <span class="required-mark">*</span></div>${identityMarkup(castingState.identity.discord, "discord")}</div>`;
  }

  if (question.type === "roblox") {
    return `<div class="question" data-key="${question.key}"><div class="question-label"><span class="question-number">${number}.</span>${escapeHtml(question.label)} <span class="required-mark">*</span></div>${identityMarkup(castingState.identity.roblox, "roblox")}</div>`;
  }

  const common = `data-answer-key="${question.key}" id="${question.key}" required`;
  let input = "";

  if (question.type === "textarea") {
    input = `<textarea ${common} maxlength="6000">${escapeHtml(value)}</textarea>`;
  } else if (question.type === "number") {
    input = `<input ${common} type="number" inputmode="numeric" min="13" max="99" step="1" value="${escapeHtml(value)}" />`;
  } else {
    input = `<input ${common} type="text" maxlength="${question.max || 500}" autocomplete="off" autocapitalize="words" value="${escapeHtml(value)}" />`;
  }

  return `<div class="question" data-key="${question.key}"><label class="question-label" for="${question.key}"><span class="question-number">${number}.</span>${escapeHtml(question.label)} <span class="required-mark">*</span></label>${helperFor(question)}${input}<p class="field-error" data-error="${question.key}" hidden></p>${counterMarkup(question, value)}</div>`;
}

function updateCounter(key) {
  const counter = document.querySelector(`[data-counter="${key}"]`);
  if (!counter) return;
  const value = String(answers[key] || "");
  const number = Number(key.slice(1));
  if (number >= 7) {
    const { minChars, minWords } = requirementFor(key);
    const valid = value.length >= minChars && countWords(value) >= minWords;
    counter.textContent = `${value.length} / ${minChars} caracteres · ${countWords(value)} / ${minWords} palabras`;
    counter.classList.toggle("complete", valid);
  } else {
    counter.textContent = `${value.length} caracteres`;
  }
}

function markQuestion(question) {
  const message = validationMessage(question);
  const field = document.querySelector(`[data-answer-key="${question.key}"]`);
  const error = document.querySelector(`[data-error="${question.key}"]`);
  field?.classList.toggle("invalid", Boolean(message));
  if (error) {
    error.textContent = message;
    error.hidden = !message;
  }
  return !message;
}

function validateCurrentSection() {
  collectVisibleAnswers();
  formError.hidden = true;
  if (currentSection === REVIEW_STEP) return validateAll();

  const section = sections[currentSection];
  const valid = section.questions.every((question) => markQuestion(question));
  if (!valid) {
    formError.textContent = "Revisá las respuestas marcadas antes de continuar.";
    formError.hidden = false;
    const firstBad = section.questions.find((question) => validationMessage(question));
    document.querySelector(`[data-key="${firstBad?.key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  renderProgress();
  return valid;
}

function validateAll() {
  collectVisibleAnswers();
  const invalidSection = firstInvalidSection();
  if (invalidSection === -1) return true;
  currentSection = invalidSection;
  saveDraft();
  render();
  formError.textContent = "Todavía hay respuestas incompletas o que no cumplen el mínimo requerido.";
  formError.hidden = false;
  return false;
}

function reviewAnswer(question) {
  if (question.type === "discord") return identityMarkup(castingState.identity.discord, "discord");
  if (question.type === "roblox") return identityMarkup(castingState.identity.roblox, "roblox");
  return `<p>${escapeHtml(answers[question.key] || "—")}</p>`;
}

function renderReview() {
  document.querySelector("#sectionKicker").textContent = "REVISIÓN FINAL";
  document.querySelector("#sectionTitle").textContent = "Revisá tu postulación";
  document.querySelector("#sectionDescription").textContent = "Esta es tu última oportunidad para revisar las respuestas. Una vez enviada, solo Producción podrá eliminarla para que la rehagas.";

  questionsContainer.innerHTML = sections.map((section, index) => `
    <section class="review-group">
      <div class="review-group-heading"><div><span>Sección ${index + 1}</span><h3>${escapeHtml(section.title)}</h3></div><button class="button secondary compact" type="button" data-edit-section="${index}">Editar</button></div>
      ${section.questions.map((question) => `<article class="review-answer"><h4><span>${question.key.slice(1)}.</span> ${escapeHtml(question.label)}</h4>${reviewAnswer(question)}</article>`).join("")}
    </section>
  `).join("");
}

function renderProgress() {
  document.querySelector("#stepLabel").textContent = `Etapa ${currentSection + 1} de ${TOTAL_STEPS}`;
  const percent = Math.round(((currentSection + 1) / TOTAL_STEPS) * 100);
  document.querySelector("#progressPercent").textContent = `${percent}%`;
  document.querySelector("#progressBar").style.width = `${percent}%`;

  const dots = [];
  for (let index = 0; index < sections.length; index += 1) {
    const state = index === currentSection ? "current" : sectionIsComplete(index) ? "done" : "incomplete";
    dots.push(`<span class="section-dot ${state}" title="${escapeHtml(sections[index].title)}"></span>`);
  }
  dots.push(`<span class="section-dot ${currentSection === REVIEW_STEP ? "current" : "incomplete"}" title="Revisión final"></span>`);
  document.querySelector("#sectionNav").innerHTML = dots.join("");
}

function render() {
  formError.hidden = true;
  renderProgress();

  if (currentSection === REVIEW_STEP) {
    renderReview();
    previousButton.disabled = false;
    nextButton.hidden = true;
    submitButton.hidden = false;
  } else {
    const section = sections[currentSection];
    document.querySelector("#sectionKicker").textContent = section.kicker;
    document.querySelector("#sectionTitle").textContent = section.title;
    document.querySelector("#sectionDescription").textContent = section.description;
    questionsContainer.innerHTML = section.questions.map((question) => renderQuestion(question, Number(question.key.slice(1)))).join("");
    previousButton.disabled = currentSection === 0;
    nextButton.hidden = false;
    nextButton.textContent = currentSection === sections.length - 1 ? "Revisar postulación" : "Siguiente";
    submitButton.hidden = true;
  }

  saveDraft();
  window.scrollTo({ top: wizard.offsetTop - 18, behavior: "smooth" });
}

questionsContainer.addEventListener("input", (event) => {
  const field = event.target.closest("[data-answer-key]");
  if (!field) return;

  if (field.dataset.answerKey === "q3") {
    const digits = field.value.replace(/\D/g, "").slice(0, 2);
    if (field.value !== digits) field.value = digits;
  }

  answers[field.dataset.answerKey] = field.value.trim();
  field.classList.remove("invalid");
  document.querySelector(`[data-error="${field.dataset.answerKey}"]`)?.setAttribute("hidden", "");
  updateCounter(field.dataset.answerKey);
  saveDraft();
  renderProgress();
});

questionsContainer.addEventListener("focusout", (event) => {
  const field = event.target.closest("[data-answer-key]");
  if (!field || currentSection === REVIEW_STEP) return;
  const question = sections[currentSection].questions.find((item) => item.key === field.dataset.answerKey);
  if (question) markQuestion(question);
});

questionsContainer.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-section]");
  if (edit) {
    currentSection = Number(edit.dataset.editSection);
    saveDraft();
    render();
    return;
  }

  const robloxLink = event.target.closest("[data-roblox-link]");
  if (robloxLink) {
    saveDraft();
    allowNavigation = true;
  }
});

previousButton.addEventListener("click", () => {
  collectVisibleAnswers();
  if (currentSection > 0) {
    currentSection -= 1;
    saveDraft();
    render();
  }
});

nextButton.addEventListener("click", () => {
  if (!validateCurrentSection()) return;
  if (currentSection < REVIEW_STEP) {
    currentSection += 1;
    saveDraft();
    render();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting || currentSection !== REVIEW_STEP || !validateAll()) return;

  submitting = true;
  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";
  allowNavigation = true;

  try {
    const response = await fetch("/api/casting/applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": castingState.csrfToken,
      },
      body: JSON.stringify({ answers }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (Array.isArray(data.invalidKeys) && data.invalidKeys.length) {
        const firstKey = data.invalidKeys[0];
        const sectionIndex = sections.findIndex((section) => section.questions.some((question) => question.key === firstKey));
        if (sectionIndex >= 0) {
          currentSection = sectionIndex;
          render();
        }
      }
      throw new Error(data.error || "No se pudo enviar la postulación.");
    }

    clearDraft();
    showSubmitted(data.application);
  } catch (error) {
    allowNavigation = false;
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
  clearDraft();
  allowNavigation = true;
  showOnly("submitted");
  const date = new Date(application.submittedAt);
  document.querySelector("#submittedMeta").textContent = `Enviada el ${date.toLocaleString("es-AR")} · Estado: ${statusLabel(application.status)}`;
}

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsubmittedDraft || submitting || allowNavigation) return;
  event.preventDefault();
  event.returnValue = "";
});

async function init() {
  showOnly("loading");

  try {
    const response = await fetch("/api/casting/me", { headers: { Accept: "application/json" } });

    if (response.status === 401) {
      showOnly("login");
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `No se pudo cargar el casting (HTTP ${response.status}).`);

    castingState = data;
    const discordName = data.identity.discord.globalName || data.identity.discord.username;
    accountSummary.textContent = `Discord: ${discordName}${data.identity.roblox ? ` · Roblox: @${data.identity.roblox.username}` : ""}`;
    accountSummary.hidden = false;

    draftKey = `el-laboratorio-casting-draft:${data.identity.discord.id}`;

    if (data.application) {
      showSubmitted(data.application);
      return;
    }

    restoreDraft();
    if (currentSection === REVIEW_STEP && firstInvalidSection() !== -1) {
      currentSection = firstInvalidSection();
    }

    showOnly("wizard");
    render();
  } catch (error) {
    loadErrorMessage.textContent = error.message || "No se pudo verificar tu sesión. Recargá la página e intentá nuevamente.";
    showOnly("error");
  }
}

init();
