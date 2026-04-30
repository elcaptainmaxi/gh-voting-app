const state = {
  plate: null,
  voteStatus: null,
  selectedNominee: null,
  submitting: false,
};

const plateNoticeSection = document.getElementById("plateNoticeSection");
const voteStatusBanner = document.getElementById("voteStatusBanner");
const activePlateSection = document.getElementById("activePlateSection");
const emptyPlateState = document.getElementById("emptyPlateState");
const plateTitleEl = document.getElementById("plateTitle");
const plateDescriptionEl = document.getElementById("plateDescription");
const plateStatusBadge = document.getElementById("plateStatusBadge");
const nomineesGrid = document.getElementById("nomineesGrid");

const voteModal = document.getElementById("voteModal");
const voteModalText = document.getElementById("voteModalText");
const closeVoteModalBtn = document.getElementById("closeVoteModal");
const cancelVoteBtn = document.getElementById("cancelVoteBtn");
const confirmVoteBtn = document.getElementById("confirmVoteBtn");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof data === "object" && data?.error
        ? data.error
        : "Ocurrió un error inesperado.";
    throw new Error(errorMessage);
  }

  return data;
}

function setBanner(message, type = "success") {
  plateNoticeSection?.classList.remove("hidden");
  voteStatusBanner.textContent = message;
  voteStatusBanner.classList.remove("hidden", "error");

  if (type === "error") {
    voteStatusBanner.classList.add("error");
  }
}

function clearBanner() {
  voteStatusBanner.textContent = "";
  voteStatusBanner.classList.add("hidden");
  voteStatusBanner.classList.remove("error");
  plateNoticeSection?.classList.add("hidden");
}

function openModal() {
  voteModal.classList.remove("hidden");
  voteModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  voteModal.classList.add("hidden");
  voteModal.setAttribute("aria-hidden", "true");
}

function nomineeCardTemplate(nominee) {
  const image =
    nominee.imageUrl || "https://placehold.co/600x600/png?text=Nominado";
  const displayName = nominee.displayName || "Sin nombre";

  const platePaused = state.plate?.status === "PAUSED";
  const alreadyVoted = state.voteStatus?.hasVoted;
  const disableVote = platePaused || alreadyVoted;

  return `
    <article class="nominee-card">
      <div class="nominee-image-wrap">
        <img
          class="nominee-image"
          src="${escapeHtml(image)}"
          alt="${escapeHtml(displayName)}"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div class="nominee-body">
        <h3 class="nominee-name">${escapeHtml(displayName)}</h3>

        <div class="vote-actions">
          <span class="vote-helper">
            ${platePaused ? "Placa pausada" : "1 voto por placa"}
          </span>

          <button
            class="btn btn-primary btn-sm vote-btn"
            data-nominee-id="${nominee.id}"
            data-nominee-name="${escapeHtmlAttr(displayName)}"
            ${disableVote ? "disabled" : ""}
          >
            Votar
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderPlate() {
  const plate = state.plate;

  if (!plate) {
    activePlateSection?.classList.add("hidden");
    emptyPlateState?.classList.remove("hidden");

    if (nomineesGrid) {
      nomineesGrid.innerHTML = "";
    }

    return;
  }

  emptyPlateState?.classList.add("hidden");
  activePlateSection?.classList.remove("hidden");

  plateTitleEl.textContent = plate.title;
  plateDescriptionEl.textContent =
    plate.description || "Elegí al participante que querés votar.";

  plateStatusBadge.textContent = plate.status;
  plateStatusBadge.classList.remove("badge-live");

  if (plate.status === "ACTIVE") {
    plateStatusBadge.classList.add("badge-live");
  }

  nomineesGrid.innerHTML = (plate.nominees || [])
    .map(nomineeCardTemplate)
    .join("");
}

function renderVoteStatus() {
  clearBanner();

  if (!state.plate) return;

  if (state.plate.status === "PAUSED") {
    setBanner("La placa está pausada en este momento. No se puede votar hasta que vuelva a activarse.", "error");
    return;
  }

  const remainingVotes = Number(state.voteStatus?.remainingVotes || 0);

  if (remainingVotes > 0) {
    setBanner(`${remainingVotes} votos disponibles en esta placa.`);
    return;
  }

  setBanner("Ya alcanzaste el máximo de votos disponibles desde esta conexión.", "error");
}

async function loadPlateAndStatus() {
  const [plateResponse, voteStatus] = await Promise.all([
    api("/api/active-plate"),
    api("/api/my-vote-status"),
  ]);

  state.plate = plateResponse?.plate || null;
  state.voteStatus = voteStatus || { hasVoted: false };

  renderPlate();
  renderVoteStatus();
}

function onGridClick(event) {
  const button = event.target.closest(".vote-btn");
  if (!button || state.submitting) return;

  if (state.plate?.status !== "ACTIVE") return;
  if (state.voteStatus?.hasVoted) return;

  const nomineeId = button.dataset.nomineeId;
  const nomineeName = button.dataset.nomineeName;

  state.selectedNominee = {
    id: nomineeId,
    name: nomineeName,
  };

  voteModalText.textContent = `¿Querés votar por ${nomineeName}? Esta acción no se puede deshacer.`;
  openModal();
}

async function submitVote() {
  if (!state.selectedNominee || state.submitting) return;
  if (state.plate?.status !== "ACTIVE") return;

  state.submitting = true;
  confirmVoteBtn.disabled = true;
  cancelVoteBtn.disabled = true;

  try {
    await api("/api/vote", {
      method: "POST",
      body: JSON.stringify({
        nomineeId: state.selectedNominee.id,
      }),
    });

    state.voteStatus = {
      ...state.voteStatus,
      remainingVotes: Number(result.remainingVotes || 0),
      hasVoted: Number(result.remainingVotes || 0) <= 0,
    };
    setBanner("Voto contabilizado.", "success");
    renderPlate();
    renderVoteStatus();
    closeModal();
  } catch (error) {
    setBanner(error.message || "No se pudo registrar el voto.", "error");
  } finally {
    state.submitting = false;
    confirmVoteBtn.disabled = false;
    cancelVoteBtn.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value);
}

async function init() {
  try {
    await loadPlateAndStatus();
  } catch (error) {
    console.error(error);
    setBanner(error.message || "No se pudo cargar la placa.", "error");
  }
}

nomineesGrid?.addEventListener("click", onGridClick);
confirmVoteBtn?.addEventListener("click", submitVote);
cancelVoteBtn?.addEventListener("click", closeModal);
closeVoteModalBtn?.addEventListener("click", closeModal);

voteModal?.addEventListener("click", (event) => {
  const shouldClose = event.target?.dataset?.closeModal === "true";
  if (shouldClose) closeModal();
});

init();