(() => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    const isInitialCastingLoad = url === "/api/casting/me";

    try {
      const response = await originalFetch(...args);

      if (isInitialCastingLoad) {
        const loadingState = document.querySelector("#loadingState");
        if (loadingState) loadingState.hidden = true;

        if (!response.ok && response.status !== 401) {
          const errorState = document.querySelector("#loadErrorState");
          const errorMessage = document.querySelector("#loadErrorMessage");
          if (errorState) errorState.hidden = false;
          if (errorMessage) errorMessage.textContent = "No se pudo verificar tu sesión. Recargá la página e intentá nuevamente.";
          setTimeout(() => {
            const loginGate = document.querySelector("#loginGate");
            if (loginGate) loginGate.hidden = true;
          }, 0);
        }
      }

      return response;
    } catch (error) {
      if (isInitialCastingLoad) {
        const loadingState = document.querySelector("#loadingState");
        const errorState = document.querySelector("#loadErrorState");
        const errorMessage = document.querySelector("#loadErrorMessage");
        if (loadingState) loadingState.hidden = true;
        if (errorState) errorState.hidden = false;
        if (errorMessage) errorMessage.textContent = "No se pudo conectar con el servidor. Revisá tu conexión e intentá nuevamente.";
        setTimeout(() => {
          const loginGate = document.querySelector("#loginGate");
          if (loginGate) loginGate.hidden = true;
        }, 0);
      }
      throw error;
    }
  };
})();
