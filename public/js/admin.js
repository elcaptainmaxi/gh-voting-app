const state = {
  csrfToken: null,
  user: null,
  plates: [],
  catalog: [],
  currentPanel: "create",
  openPlateIds: new Set(),
  selectedCatalogByPlate: {},
};

const userNameEl = document.getElementById("userName");
const userAvatarEl = document.getElementById("userAvatar");
const logoutBtn = document.getElementById("logoutBtn");

const createPlateForm = document.getElementById("createPlateForm");
const createPlateMessage = document.getElementById("createPlateMessage");

const catalogForm = document.getElementById("catalogForm");
const catalogMessage = document.getElementById("catalogMessage");
const catalogList = document.getElementById("catalogList");

const platesList = document.getElementById("platesList");
const plateTemplate = document.getElementById("plateTemplate");

const adminTrack = document.getElementById("adminTrack");
const navButtons = document.querySelectorAll(".admin-nav-btn");

let draggedNomineeId = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(state.csrfToken ? { "x-csrf-token": state.csrfToken } : {}),
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

function avatarUrl(user) {
  if (!user?.avatar || !user?.discordId) return "";
  return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=128`;
}

function setMessage(element, message, type = "success") {
  element.textContent = message;
  element.classList.remove("hidden", "error");
  if (type === "error") element.classList.add("error");
  else element.classList.remove("error");
}

function clearMessage(element) {
  element.textContent = "";
  element.classList.add("hidden");
  element.classList.remove("error");
}

function renderUser() {
  userNameEl.textContent =
    state.user?.globalName || state.user?.username || "Admin";

  const avatar = avatarUrl(state.user);
  if (avatar) {
    userAvatarEl.src = avatar;
    userAvatarEl.classList.remove("hidden");
  }
}

function setPanel(panel) {
  state.currentPanel = panel;

  navButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.panel === panel);
  });

  const index = panel === "create" ? 0 : panel === "plates" ? 1 : 2;
  adminTrack.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
}

async function loadSession() {
  const me = await api("/api/me");
  state.user = me.user;
  state.csrfToken = me.csrfToken;

  if (!state.user?.isAdmin) {
    window.location.href = "/vote.html";
    return;
  }

  renderUser();
}

async function loadPlates() {
  const data = await api("/api/admin/plates");
  state.plates = data.plates || [];
  renderPlates();
}

async function loadCatalog() {
  const data = await api("/api/admin/catalog");
  state.catalog = data.participants || [];
  renderCatalog();
  renderPlates();
}

function renderCatalog() {
  catalogList.innerHTML = "";

  if (!state.catalog.length) {
    catalogList.innerHTML = `<div class="empty-card"><p>No hay participantes cargados todavía.</p></div>`;
    return;
  }

  catalogList.innerHTML = state.catalog
    .map(
      (participant) => `
        <article class="catalog-item">
          <div class="catalog-item-left">
            <img
              class="catalog-thumb"
              src="${escapeHtml(participant.imageUrl || "https://placehold.co/100x100/png?text=P")}"
              alt="${escapeHtml(participant.displayName)}"
            />
            <div>
              <strong>${escapeHtml(participant.displayName)}</strong>
              <div class="catalog-meta">${participant.isActive ? "Activo" : "Inactivo"}</div>
            </div>
          </div>

          <div class="catalog-actions">
            <button
              type="button"
              class="btn btn-secondary btn-sm btn-toggle-catalog"
              data-id="${participant.id}"
              data-active="${participant.isActive ? "1" : "0"}"
            >
              ${participant.isActive ? "Desactivar" : "Activar"}
            </button>

            <button
              type="button"
              class="btn btn-danger btn-sm btn-delete-catalog"
              data-id="${participant.id}"
            >
              Eliminar
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

function nomineeAdminRow(nominee) {
  const image = nominee.imageUrl || "https://placehold.co/92x92/png?text=N";
  const displayName = nominee.displayName || "Sin nombre";

  return `
    <div class="nominee-admin-row draggable-nominee" draggable="true" data-nominee-id="${nominee.id}">
      <div class="nominee-admin-left">
        <span class="drag-handle">⋮⋮</span>
        <img class="nominee-admin-thumb" src="${escapeHtml(image)}" alt="${escapeHtml(displayName)}" />
        <div class="nominee-admin-name">${escapeHtml(displayName)}</div>
      </div>

      <button
        type="button"
        class="btn btn-danger btn-sm btn-remove-nominee"
        data-nominee-id="${nominee.id}"
      >
        Eliminar
      </button>
    </div>
  `;
}

function resultRow(result) {
  const displayName = result.displayName || "Sin nombre";

  return `
    <div class="result-row">
      <div class="result-left">
        <div class="result-name">${escapeHtml(displayName)}</div>
      </div>
      <div class="result-votes">${Number(result.votes || 0)} votos</div>
    </div>
  `;
}

function getAvailableCatalogForPlate(plate) {
  const usedNames = new Set((plate.nominees || []).map((n) => n.displayName.toLowerCase()));

  return state.catalog.filter(
    (participant) =>
      participant.isActive &&
      !usedNames.has(participant.displayName.toLowerCase())
  );
}

function renderCatalogDropdown(plate) {
  const available = getAvailableCatalogForPlate(plate);
  const selected = state.selectedCatalogByPlate[plate.id] || [];

  if (!available.length) {
    return `
      <div class="catalog-dropdown-empty">
        No hay participantes disponibles para agregar.
      </div>
    `;
  }

  const selectedNames = available
    .filter((participant) => selected.includes(participant.id))
    .map((participant) => participant.displayName);

  return `
    <div class="catalog-dropdown" data-plate-id="${plate.id}">
      <button type="button" class="catalog-dropdown-trigger btn btn-secondary btn-sm">
        ${selectedNames.length ? escapeHtml(selectedNames.join(", ")) : "Seleccionar nominados"}
      </button>

      <div class="catalog-dropdown-menu hidden">
        ${available
          .map(
            (participant) => `
              <label class="catalog-dropdown-option">
                <input
                  type="checkbox"
                  class="catalog-dropdown-checkbox"
                  value="${participant.id}"
                  ${selected.includes(participant.id) ? "checked" : ""}
                />
                <img
                  class="catalog-picker-thumb"
                  src="${escapeHtml(participant.imageUrl || "https://placehold.co/92x92/png?text=P")}"
                  alt="${escapeHtml(participant.displayName)}"
                />
                <span>${escapeHtml(participant.displayName)}</span>
              </label>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderPlates() {
  platesList.innerHTML = "";

  if (!state.plates.length) {
    platesList.innerHTML = `
      <div class="empty-card">
        <p>No hay placas todavía.</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const plate of state.plates) {
    const node = plateTemplate.content.cloneNode(true);
    const root = node.querySelector(".plate-card-admin-collapsible");
    const collapseBody = node.querySelector(".plate-collapse-body");
    const trigger = node.querySelector(".plate-collapse-trigger");

    root.dataset.plateId = plate.id;
    root.querySelector(".plate-admin-title").textContent = plate.title;
    root.querySelector(".plate-admin-description").textContent =
      plate.description || "Sin descripción";
    root.querySelector(".plate-admin-status").textContent = plate.status;

    const editForm = root.querySelector(".edit-plate-form");
    editForm.elements.plateId.value = plate.id;
    editForm.elements.title.value = plate.title;
    editForm.elements.description.value = plate.description || "";
    editForm.elements.maxVotesPerIp.value = plate.maxVotesPerIp;
    editForm.elements.status.value = plate.status;

    const nomineesList = root.querySelector(".nominees-admin-list");
    nomineesList.dataset.plateId = plate.id;
    nomineesList.innerHTML = plate.nominees?.length
      ? plate.nominees.map(nomineeAdminRow).join("")
      : `<div class="empty-card"><p>Esta placa todavía no tiene nominados.</p></div>`;

    const catalogPickerList = root.querySelector(".catalog-picker-list");
    catalogPickerList.innerHTML = renderCatalogDropdown(plate);

    const isOpen = state.openPlateIds.has(plate.id);
    collapseBody.classList.toggle("hidden", !isOpen);
    root.classList.toggle("is-open", isOpen);

    trigger.addEventListener("click", () => {
      const nowOpen = collapseBody.classList.contains("hidden");
      collapseBody.classList.toggle("hidden");
      root.classList.toggle("is-open");

      if (nowOpen) state.openPlateIds.add(plate.id);
      else state.openPlateIds.delete(plate.id);
    });

    fragment.appendChild(node);
  }

  platesList.appendChild(fragment);
  attachDragAndDrop();
}

function attachDragAndDrop() {
  const draggables = document.querySelectorAll(".draggable-nominee");

  draggables.forEach((item) => {
    item.addEventListener("dragstart", () => {
      draggedNomineeId = item.dataset.nomineeId;
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      draggedNomineeId = null;
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    item.addEventListener("drop", async (event) => {
      event.preventDefault();

      const target = event.currentTarget;
      const source = document.querySelector(`[data-nominee-id="${draggedNomineeId}"]`);
      if (!source || source === target) return;

      const list = target.closest(".draggable-nominees");
      if (!list) return;

      const nodes = [...list.querySelectorAll(".draggable-nominee")];
      const sourceIndex = nodes.indexOf(source);
      const targetIndex = nodes.indexOf(target);

      if (sourceIndex < targetIndex) {
        target.after(source);
      } else {
        target.before(source);
      }

      const orderedIds = [...list.querySelectorAll(".draggable-nominee")].map(
        (row) => row.dataset.nomineeId
      );

      const plateId = list.dataset.plateId;

      try {
        state.openPlateIds.add(plateId);
        await api(`/api/admin/plates/${plateId}/nominees/reorder`, {
          method: "PATCH",
          body: JSON.stringify({ orderedIds }),
        });
        await loadPlates();
      } catch (error) {
        alert(error.message);
        await loadPlates();
      }
    });
  });
}

async function createPlate(event) {
  event.preventDefault();
  clearMessage(createPlateMessage);

  const formData = new FormData(createPlateForm);

  try {
    await api("/api/admin/plates", {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        maxVotesPerIp: Number(formData.get("maxVotesPerIp")),
        status: formData.get("status"),
      }),
    });

    createPlateForm.reset();
    createPlateForm.elements.maxVotesPerIp.value = 2;
    createPlateForm.elements.status.value = "DRAFT";

    setMessage(createPlateMessage, "Placa creada correctamente.");
    setPanel("plates");
    await loadPlates();
  } catch (error) {
    setMessage(createPlateMessage, error.message, "error");
  }
}

async function createCatalogParticipant(event) {
  event.preventDefault();
  clearMessage(catalogMessage);

  const formData = new FormData(catalogForm);

  try {
    await api("/api/admin/catalog", {
      method: "POST",
      body: JSON.stringify({
        displayName: formData.get("displayName"),
        imageUrl: formData.get("imageUrl"),
      }),
    });

    catalogForm.reset();
    setMessage(catalogMessage, "Participante agregado al catálogo.");
    await loadCatalog();
  } catch (error) {
    setMessage(catalogMessage, error.message, "error");
  }
}

async function handleCatalogActions(event) {
  const deleteBtn = event.target.closest(".btn-delete-catalog");
  const toggleBtn = event.target.closest(".btn-toggle-catalog");

  if (deleteBtn) {
    try {
      await api(`/api/admin/catalog/${deleteBtn.dataset.id}`, {
        method: "DELETE",
      });
      await loadCatalog();
    } catch (error) {
      setMessage(catalogMessage, error.message, "error");
    }
    return;
  }

  if (toggleBtn) {
    try {
      await api(`/api/admin/catalog/${toggleBtn.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: toggleBtn.dataset.active !== "1",
        }),
      });
      await loadCatalog();
    } catch (error) {
      setMessage(catalogMessage, error.message, "error");
    }
  }
}

function closeAllCatalogMenus(except = null) {
  document.querySelectorAll(".catalog-dropdown-menu").forEach((menu) => {
    if (menu !== except) {
      menu.classList.add("hidden");
    }
  });
}

async function handlePlateActions(event) {
  const plateCard = event.target.closest(".plate-card-admin-collapsible");
  if (!plateCard) return;

  const plateId = plateCard.dataset.plateId;
  const messageEl = plateCard.querySelector(".plate-admin-message");
  clearMessage(messageEl);

  const removeButton = event.target.closest(".btn-remove-nominee");
  const resultsButton = event.target.closest(".btn-load-results");
  const deletePlateButton = event.target.closest(".btn-delete-plate");
  const addSelectedCatalogBtn = event.target.closest(".btn-add-selected-catalog");
  const dropdownTrigger = event.target.closest(".catalog-dropdown-trigger");

  if (dropdownTrigger) {
    const dropdown = dropdownTrigger.closest(".catalog-dropdown");
    const menu = dropdown.querySelector(".catalog-dropdown-menu");
    const willOpen = menu.classList.contains("hidden");

    closeAllCatalogMenus(willOpen ? menu : null);
    menu.classList.toggle("hidden", !willOpen);
    return;
  }

  if (removeButton) {
    try {
      state.openPlateIds.add(plateId);
      await api(`/api/admin/plates/${plateId}/nominees/${removeButton.dataset.nomineeId}`, {
        method: "DELETE",
      });
      setMessage(messageEl, "Nominado eliminado.");
      await loadPlates();
      await loadCatalog();
    } catch (error) {
      setMessage(messageEl, error.message, "error");
    }
    return;
  }

  if (resultsButton) {
    const resultsBox = plateCard.querySelector(".results-box");
    const resultsList = plateCard.querySelector(".results-list");

    try {
      state.openPlateIds.add(plateId);
      const data = await api(`/api/admin/plates/${plateId}/results`);
      resultsList.innerHTML = (data.results || []).length
        ? data.results.map(resultRow).join("")
        : `<div class="empty-card"><p>No hay votos todavía.</p></div>`;

      resultsBox.classList.remove("hidden");
    } catch (error) {
      setMessage(messageEl, error.message, "error");
    }
    return;
  }

  if (deletePlateButton) {
    const confirmed = confirm("¿Eliminar esta placa y todos sus datos?");
    if (!confirmed) return;

    try {
      state.openPlateIds.delete(plateId);
      delete state.selectedCatalogByPlate[plateId];

      await api(`/api/admin/plates/${plateId}`, {
        method: "DELETE",
      });
      await loadPlates();
      await loadCatalog();
    } catch (error) {
      setMessage(messageEl, error.message, "error");
    }
    return;
  }

  if (addSelectedCatalogBtn) {
    const selectedIds = state.selectedCatalogByPlate[plateId] || [];

    if (!selectedIds.length) {
      setMessage(messageEl, "Seleccioná participantes del catálogo.", "error");
      return;
    }

    try {
      state.openPlateIds.add(plateId);
      await api(`/api/admin/plates/${plateId}/nominees/from-catalog`, {
        method: "POST",
        body: JSON.stringify({
          participantIds: selectedIds,
        }),
      });

      state.selectedCatalogByPlate[plateId] = [];
      setMessage(messageEl, "Participantes agregados a la placa.");
      await loadPlates();
      await loadCatalog();
    } catch (error) {
      setMessage(messageEl, error.message, "error");
    }
  }
}

async function handlePlateForms(event) {
  const plateCard = event.target.closest(".plate-card-admin-collapsible");
  if (!plateCard) return;

  const plateId = plateCard.dataset.plateId;
  const messageEl = plateCard.querySelector(".plate-admin-message");
  clearMessage(messageEl);

  if (event.target.matches(".edit-plate-form")) {
    event.preventDefault();

    const form = event.target;

    try {
      state.openPlateIds.add(plateId);

      await api(`/api/admin/plates/${plateId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.elements.title.value,
          description: form.elements.description.value,
          maxVotesPerIp: Number(form.elements.maxVotesPerIp.value),
          status: form.elements.status.value,
        }),
      });

      setMessage(messageEl, "Placa actualizada.");
      await loadPlates();
    } catch (error) {
      setMessage(messageEl, error.message, "error");
    }
  }
}

function handlePlateInputChange(event) {
  const checkbox = event.target.closest(".catalog-dropdown-checkbox");
  if (!checkbox) return;

  const dropdown = checkbox.closest(".catalog-dropdown");
  const plateId = dropdown.dataset.plateId;

  if (!state.selectedCatalogByPlate[plateId]) {
    state.selectedCatalogByPlate[plateId] = [];
  }

  if (checkbox.checked) {
    if (!state.selectedCatalogByPlate[plateId].includes(checkbox.value)) {
      state.selectedCatalogByPlate[plateId].push(checkbox.value);
    }
  } else {
    state.selectedCatalogByPlate[plateId] = state.selectedCatalogByPlate[plateId].filter(
      (id) => id !== checkbox.value
    );
  }

  const plate = state.plates.find((p) => p.id === plateId);
  if (!plate) return;

  const available = getAvailableCatalogForPlate(plate);
  const selectedNames = available
    .filter((participant) => (state.selectedCatalogByPlate[plateId] || []).includes(participant.id))
    .map((participant) => participant.displayName);

  const trigger = dropdown.querySelector(".catalog-dropdown-trigger");
  trigger.textContent = selectedNames.length
    ? selectedNames.join(", ")
    : "Seleccionar nominados";
}

async function logout() {
  try {
    await api("/auth/logout", {
      method: "POST",
    });
  } catch (_) {
  } finally {
    window.location.href = "/";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function init() {
  try {
    await loadSession();
    await Promise.all([loadCatalog(), loadPlates()]);
    setPanel("create");
  } catch (error) {
    console.error(error);
    window.location.href = "/auth/login";
  }
}

createPlateForm.addEventListener("submit", createPlate);
catalogForm.addEventListener("submit", createCatalogParticipant);
platesList.addEventListener("click", handlePlateActions);
platesList.addEventListener("submit", handlePlateForms);
platesList.addEventListener("change", handlePlateInputChange);
catalogList.addEventListener("click", handleCatalogActions);
logoutBtn.addEventListener("click", logout);

document.addEventListener("click", (event) => {
  const insideDropdown = event.target.closest(".catalog-dropdown");
  if (!insideDropdown) {
    closeAllCatalogMenus();
  }
});

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => setPanel(btn.dataset.panel));
});

init();