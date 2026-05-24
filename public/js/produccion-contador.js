const grid = document.getElementById("counterGrid");
const modalBg = document.getElementById("modalBg");
const counterName = document.getElementById("counterName");

const addCounterBtn = document.getElementById("addCounterBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const cancelBtn = document.getElementById("cancelBtn");
const createCounterBtn = document.getElementById("createCounterBtn");

const STORAGE_KEY = "productionCounters";

let counters = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");

if (!Array.isArray(counters)) {
  counters = [
    { id: makeId(), name: "Abril", votes: 0 },
    { id: makeId(), name: "Adriano", votes: 0 },
    { id: makeId(), name: "Ben", votes: 0 }
  ];
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
}

function render() {
  grid.innerHTML = "";

  counters.forEach(counter => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-top">
        <button class="remove-btn" data-action="remove" data-id="${counter.id}">⋮</button>
        <div class="name">${counter.name}</div>
        <div class="count">${counter.votes}</div>
      </div>

      <div class="controls">
        <button data-action="minus" data-id="${counter.id}">⊖</button>
        <button data-action="plus" data-id="${counter.id}">⊕</button>
      </div>
    `;

    grid.appendChild(card);
  });

  save();
}

function changeVotes(id, amount) {
  counters = counters.map(counter => {
    if (counter.id !== id) return counter;

    return {
      ...counter,
      votes: Math.max(0, counter.votes + amount)
    };
  });

  render();
}

function openModal() {
  modalBg.classList.add("show");
  counterName.value = "";
  counterName.focus();
}

function closeModal() {
  modalBg.classList.remove("show");
}

function addCounter() {
  const name = counterName.value.trim();
  if (!name) return;

  counters.push({
    id: makeId(),
    name,
    votes: 0
  });

  closeModal();
  render();
}

function removeCounter(id) {
  const counter = counters.find(c => c.id === id);
  if (!counter) return;

  if (!confirm(`¿Eliminar el contador de ${counter.name}?`)) return;

  counters = counters.filter(c => c.id !== id);
  render();
}

grid.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "plus") changeVotes(id, 1);
  if (action === "minus") changeVotes(id, -1);
  if (action === "remove") removeCounter(id);
});

addCounterBtn.addEventListener("click", openModal);
cancelBtn.addEventListener("click", closeModal);
createCounterBtn.addEventListener("click", addCounter);

resetAllBtn.addEventListener("click", () => {
  if (!confirm("¿Reiniciar todos los votos a 0?")) return;

  counters = counters.map(counter => ({
    ...counter,
    votes: 0
  }));

  render();
});

deleteAllBtn.addEventListener("click", () => {
  if (!confirm("¿Borrar todos los contadores?")) return;

  counters = [];
  render();
});

counterName.addEventListener("keydown", event => {
  if (event.key === "Enter") addCounter();
  if (event.key === "Escape") closeModal();
});

modalBg.addEventListener("click", event => {
  if (event.target === modalBg) closeModal();
});

render();