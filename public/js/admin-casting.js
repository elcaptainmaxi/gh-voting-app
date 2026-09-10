const QUESTION_LABELS = {
  q1: "Nombre Rolero",
  q2: "Apellido Rolero",
  q3: "Edad Real",
  q4: "País Real",
  q5: "Discord vinculado",
  q6: "Roblox vinculado",
  q7: "¿Podrás participar durante los 2 o 3 días completos que dure el reality? Explicá tu disponibilidad.",
  q8: "Describite en cinco palabras. Luego explicá por qué elegiste cada una.",
  q9: "¿Qué aspecto de tu personalidad creés que más sorprendería a alguien que recién te conoce?",
  q10: "¿Cuál considerás que es tu mayor virtud dentro de un grupo?",
  q11: "¿Cuál es el defecto que más podría perjudicarte dentro del reality?",
  q12: "Cuando cometés un error importante, ¿cómo reaccionás normalmente?",
  q13: "Un participante comienza a hablar mal de vos con varias personas de la casa. ¿Cuál sería tu primera reacción?",
  q14: "Dos de tus aliados empiezan a pelearse entre ellos. Ambos quieren que te pongas de su lado. ¿Qué hacés?",
  q15: "¿Qué actitud de otra persona no soportarías durante la convivencia?",
  q16: "Contanos un conflicto real que hayas tenido y cómo terminó.",
  q17: "El primer día todos están formando grupos. ¿Cómo decidirías con quién juntarte? Explicá tu razonamiento.",
  q18: "Si tu estrategia inicial fracasa completamente durante el primer día, ¿cómo intentarías recuperarte?",
  q19: "¿Qué tipo de jugador creés que serías?",
  q20: "¿Cuál sería el mayor error estratégico que podrías cometer dentro del juego?",
  q21: "¿Qué cosas estarías dispuesto a hacer para ganar? ¿Y qué cosas nunca harías?",
  q22: "Si descubrieras un secreto que podría cambiar completamente el juego, ¿qué harías con esa información?",
  q23: "Si todos creen que sos una amenaza, ¿cómo intentarías cambiar esa percepción?",
  q24: "Si alguien consigue manipularte, ¿cómo reaccionarías cuando lo descubras?",
  q25: "¿Preferís ser querido por todos o que te teman como jugador? ¿Por qué?",
  q26: "¿Por qué querés participar en El Laboratorio?",
  q27: "¿Qué creés que aportarías al programa que otros participantes quizás no puedan aportar?",
  q28: "Imaginá que sos eliminado en la primera eliminación. ¿Cómo reaccionarías?",
  q29: "Imaginá que llegás a la final. ¿Qué creés que hizo que llegaras hasta ahí?",
  q30: "Si Producción solo pudiera recordar una cosa de vos después de leer este casting, ¿qué te gustaría que fuera?",
};

let csrfToken = "";
let applications = [];
let currentApplication = null;
let searchTimer = null;

const body = document.querySelector("#applicationsBody");
const emptyState = document.querySelector("#emptyState");
const panelMessage = document.querySelector("#panelMessage");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const overlay = document.querySelector("#detailOverlay");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusLabel(status) {
  return { PENDING: "Pendiente", APPROVED: "Aprobado", REJECTED: "Rechazado" }[status] || status;
}

function discordAvatar(user) {
  if (!user?.avatar) return "";
  return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=96`;
}

function avatarMarkup(url, fallback) {
  return url
    ? `<img class="avatar" src="${escapeHtml(url)}" alt="" />`
    : `<div class="avatar fallback">${escapeHtml(fallback)}</div>`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("es-AR") : "—";
}

function renderRows() {
  body.innerHTML = applications.map((application) => {
    const applicantName = `${application.applicant.roleroName} ${application.applicant.roleroSurname}`.trim() || "Sin nombre";
    const discordName = application.user.globalName || application.user.username;
    const robloxName = application.user.robloxDisplayName || application.user.robloxUsername || "No vinculado";

    return `<tr data-id="${application.id}">
      <td><div class="person">${avatarMarkup(discordAvatar(application.user), "D")}<div><strong>${escapeHtml(applicantName)}</strong><span>${escapeHtml(application.id)}</span></div></div></td>
      <td><strong>${escapeHtml(discordName)}</strong><div class="subtle">@${escapeHtml(application.user.username)} · ${escapeHtml(application.user.discordId)}</div></td>
      <td><strong>${escapeHtml(robloxName)}</strong><div class="subtle">${application.user.robloxUsername ? `@${escapeHtml(application.user.robloxUsername)} · ${escapeHtml(application.user.robloxId)}` : "—"}</div></td>
      <td>${escapeHtml(application.applicant.country || "—")}<div class="subtle">${escapeHtml(application.applicant.age || "—")} años</div></td>
      <td>${escapeHtml(formatDate(application.submittedAt))}</td>
      <td><span class="status ${application.status}">${statusLabel(application.status)}</span></td>
      <td><button class="open-button" type="button" data-open="${application.id}">Abrir</button></td>
    </tr>`;
  }).join("");

  emptyState.hidden = applications.length > 0;
  document.querySelector("#totalMetric").textContent = applications.length;
  document.querySelector("#pendingMetric").textContent = applications.filter((item) => item.status === "PENDING").length;
  document.querySelector("#approvedMetric").textContent = applications.filter((item) => item.status === "APPROVED").length;
  document.querySelector("#rejectedMetric").textContent = applications.filter((item) => item.status === "REJECTED").length;
}

async function loadApplications() {
  panelMessage.hidden = true;
  const params = new URLSearchParams();
  const search = searchInput.value.trim();
  const status = statusFilter.value;
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  try {
    const response = await fetch(`/api/admin/casting/applications?${params.toString()}`);
    if (response.status === 401) {
      location.href = "/auth/login?returnTo=%2Fadmin%2Fcasting";
      return;
    }
    if (response.status === 403) {
      location.href = "/";
      return;
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudieron cargar las postulaciones.");
    applications = data.applications;
    renderRows();
  } catch (error) {
    panelMessage.textContent = error.message;
    panelMessage.className = "panel-message error";
    panelMessage.hidden = false;
  }
}

function identityCard(provider, user) {
  const isDiscord = provider === "Discord";
  const title = isDiscord
    ? user.globalName || user.username
    : user.robloxDisplayName || user.robloxUsername || "No vinculado";
  const username = isDiscord ? user.username : user.robloxUsername;
  const id = isDiscord ? user.discordId : user.robloxId;
  const image = isDiscord ? discordAvatar(user) : user.robloxAvatar;

  return `<article class="identity-card"><div class="provider">${provider.toUpperCase()}</div><div class="person">${avatarMarkup(image, isDiscord ? "D" : "R")}<div><strong>${escapeHtml(title)}</strong><span>${username ? `@${escapeHtml(username)} · ` : ""}${escapeHtml(id || "Sin ID")}</span></div></div></article>`;
}

function renderDetail(application) {
  currentApplication = application;
  const answers = application.answers || {};
  const rolero = `${answers.q1 || ""} ${answers.q2 || ""}`.trim() || "Postulación";

  document.querySelector("#detailTitle").textContent = rolero;
  document.querySelector("#detailIdentity").innerHTML = identityCard("Discord", application.user) + identityCard("Roblox", application.user);
  document.querySelector("#detailStatus").value = application.status;
  document.querySelector("#internalNotes").value = application.internalNotes || "";
  document.querySelector("#submittedAt").textContent = `Enviado: ${formatDate(application.submittedAt)}`;
  document.querySelector("#saveMessage").textContent = "";
  document.querySelector("#answersList").innerHTML = Object.keys(QUESTION_LABELS).map((key) => {
    const number = key.slice(1);
    return `<article class="answer-card"><h4><span class="answer-number">${number}.</span>${escapeHtml(QUESTION_LABELS[key])}</h4><p>${escapeHtml(answers[key] || "—")}</p></article>`;
  }).join("");
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

async function openApplication(id) {
  try {
    const response = await fetch(`/api/admin/casting/applications/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo abrir la postulación.");
    renderDetail(data.application);
  } catch (error) {
    panelMessage.textContent = error.message;
    panelMessage.className = "panel-message error";
    panelMessage.hidden = false;
  }
}

function closeDetail() {
  overlay.hidden = true;
  currentApplication = null;
  document.body.style.overflow = "";
}

async function saveReview() {
  if (!currentApplication) return;
  const button = document.querySelector("#saveReview");
  const message = document.querySelector("#saveMessage");
  button.disabled = true;
  message.textContent = "Guardando...";

  try {
    const response = await fetch(`/api/admin/casting/applications/${encodeURIComponent(currentApplication.id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        status: document.querySelector("#detailStatus").value,
        internalNotes: document.querySelector("#internalNotes").value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar la revisión.");
    currentApplication = data.application;
    message.textContent = "Guardado.";
    await loadApplications();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

body.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-open]") || event.target.closest("tr[data-id]");
  if (!trigger) return;
  openApplication(trigger.dataset.open || trigger.dataset.id);
});

document.querySelector("#closeDetail").addEventListener("click", closeDetail);
overlay.addEventListener("click", (event) => { if (event.target === overlay) closeDetail(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay.hidden) closeDetail(); });
document.querySelector("#saveReview").addEventListener("click", saveReview);
document.querySelector("#refreshButton").addEventListener("click", loadApplications);
statusFilter.addEventListener("change", loadApplications);
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadApplications, 250);
});

async function init() {
  try {
    const response = await fetch("/api/me");
    if (response.status === 401) {
      location.href = "/auth/login?returnTo=%2Fadmin%2Fcasting";
      return;
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo validar la sesión.");
    if (!data.user?.isAdmin) {
      location.href = "/";
      return;
    }
    csrfToken = data.csrfToken;
    await loadApplications();
  } catch (error) {
    panelMessage.textContent = error.message;
    panelMessage.className = "panel-message error";
    panelMessage.hidden = false;
  }
}

init();
