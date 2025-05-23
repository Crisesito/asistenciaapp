document.addEventListener("DOMContentLoaded", function () {
  const loginModal = new bootstrap.Modal("#loginModal");
  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");
  const appContent = document.getElementById("appContent");

  loginModal.show();

  // Login
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Credenciales incorrectas");
      }

      loginModal.hide();
      checkAuthStatus();
      loadInitialData();
    } catch (error) {
      console.error("Error en login:", error);
      alert(error.message);
    }
  });

  // Logout
  logoutBtn.addEventListener("click", async function () {
    try {
      await fetch("/api/logout", { method: "POST" });
      appContent.style.display = "none";
      logoutBtn.classList.add("d-none");
      loginModal.show();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  });

  // Verificar autenticación
  async function checkAuthStatus() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();

      if (data.authenticated) {
        appContent.style.display = "block";
        logoutBtn.classList.remove("d-none");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error verificando sesión:", error);
      return false;
    }
  }

  // Cargar datos iniciales
  async function loadInitialData() {
    if (!(await checkAuthStatus())) return;

    try {
      const response = await fetch("/api/actividades");
      if (!response.ok) throw new Error("Error al cargar actividades");

      const actividades = await response.json();

      if (!Array.isArray(actividades)) {
        throw new Error("Formato de actividades inválido");
      }

      const select = document.getElementById("actividadSelect");
      select.innerHTML = '<option value="">Seleccionar...</option>';

      actividades.forEach((act) => {
        const option = document.createElement("option");
        option.value = act.id;
        option.textContent = `${act.nombre} (${new Date(
          act.fecha
        ).toLocaleDateString()})`;
        select.appendChild(option);
      });
    } catch (error) {
      console.error("Error cargando actividades:", error);
      alert("Error al cargar actividades: " + error.message);
    }
  }

  // Crear actividad
  document
    .getElementById("actividadForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const actividad = {
        area: document.getElementById("areaActividad").value,
        nombre: document.getElementById("nombreActividad").value,
        fecha: document.getElementById("fechaActividad").value,
      };

      try {
        const response = await fetch("/api/actividades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actividad),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al crear actividad");
        }

        const result = await response.json();
        alert(`Actividad creada con ID: ${result.id}`);
        loadInitialData();
        this.reset();
      } catch (error) {
        console.error("Error:", error);
        alert(`Error: ${error.message}`);
      }
    });

  // Importar participantes
  document
    .getElementById("participantesForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const actividadId = document.getElementById("actividadSelect").value;
      const file = document.getElementById("archivoExcel").files[0];

      if (!actividadId || !file) {
        alert("Seleccione una actividad y un archivo");
        return;
      }

      try {
        const data = await readExcelFile(file);
        const response = await fetch("/api/participantes/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actividadId, participantes: data }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al importar participantes");
        }

        const result = await response.json();
        alert(
          `Importados ${result.importados} participantes, ${result.errores} errores`
        );
        this.reset();
      } catch (error) {
        console.error("Error importando:", error);
        alert(error.message);
      }
    });

  // Leer Excel
  function readExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet, {
            header: ["rut", "nombre", "email"],
          });
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Cargar actividades por área
  async function loadActivitiesByArea(area, selectElement) {
    try {
      const response = await fetch(
        `/api/actividades/por-area?area=${encodeURIComponent(area)}`
      );
      if (!response.ok) throw new Error("Error al cargar actividades");

      const actividades = await response.json();

      if (!Array.isArray(actividades)) {
        throw new Error("Formato de actividades inválido");
      }

      selectElement.innerHTML = '<option value="">Seleccionar...</option>';

      actividades.forEach((act) => {
        const option = document.createElement("option");
        option.value = act.id;
        option.textContent = `${act.nombre} (${new Date(
          act.fecha
        ).toLocaleDateString()})`;
        selectElement.appendChild(option);
      });

      selectElement.disabled = false;
    } catch (error) {
      console.error("Error cargando actividades:", error);
      selectElement.innerHTML =
        '<option value="">Error cargando actividades</option>';
    }
  }

  // Filtro de área para reporte
  document
    .getElementById("filtroAreaReporte")
    .addEventListener("change", async function () {
      const area = this.value;
      const actividadSelect = document.getElementById("filtroActividadReporte");

      if (area) {
        await loadActivitiesByArea(area, actividadSelect);
      } else {
        actividadSelect.innerHTML =
          '<option value="">Seleccione una actividad</option>';
        actividadSelect.disabled = true;
      }
    });

  // Generar reporte por actividad
  document
    .getElementById("generarReporteActividadBtn")
    .addEventListener("click", async function () {
      const actividadId = document.getElementById(
        "filtroActividadReporte"
      ).value;

      if (!actividadId) {
        alert("Seleccione una actividad");
        return;
      }

      try {
        console.log("Solicitando reporte para actividad ID:", actividadId);
        const response = await fetch(
          `/api/reportes/por-actividad?actividadId=${actividadId}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error del servidor:", errorData);
          throw new Error(errorData.error || "Error al generar reporte");
        }

        const reporte = await response.json();
        console.log("Reporte recibido:", reporte);

        const tbody = document.querySelector("#reporteActividadTable tbody");
        tbody.innerHTML = "";

        if (!Array.isArray(reporte)) {
          throw new Error("Formato de respuesta no válido");
        }

        if (reporte.length === 0) {
          const row = document.createElement("tr");
          row.innerHTML = `<td colspan="3" class="text-center">No hay participantes registrados</td>`;
          tbody.appendChild(row);
        } else {
          reporte.forEach((item) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                        <td>${item.rut || "N/A"}</td>
                        <td>${item.nombre || "N/A"}</td>
                        <td>${item.email || "N/A"}</td>
                    `;
            tbody.appendChild(row);
          });
        }
      } catch (error) {
        console.error("Error completo:", error);
        alert(
          `Error al generar reporte: ${error.message}\n\nVer consola para más detalles`
        );
      }
    });

  // Generar reporte general
  document
    .getElementById("generarReporteGeneralBtn")
    .addEventListener("click", async function () {
      const filtroArea = document.getElementById("filtroAreaGeneral");
      const areasSeleccionadas = Array.from(filtroArea.selectedOptions).map(
        (option) => option.value
      );

      try {
        const response = await fetch(
          `/api/reportes?areas=${areasSeleccionadas.join(",")}`
        );
        if (!response.ok) throw new Error("Error al generar reporte");

        const reportes = await response.json();

        const tbody = document.querySelector("#reporteGeneralTable tbody");
        tbody.innerHTML = "";

        if (!Array.isArray(reportes)) {
          throw new Error("Formato de reporte inválido");
        }

        reportes.forEach((item) => {
          const row = document.createElement("tr");
          row.innerHTML = `
                    <td>${item.area}</td>
                    <td>${item.rut || "N/A"}</td>
                    <td>${item.nombre || "N/A"}</td>
                    <td>${item.email || "N/A"}</td>
                    <td>${item.asistencias}</td>
                    <td>${item.totalActividades}</td>
                    <td>${item.porcentaje}%</td>
                `;
          tbody.appendChild(row);
        });
      } catch (error) {
        console.error("Error generando reporte general:", error);
        alert("Error al generar reporte general: " + error.message);
      }
    });

  // Exportar a Excel
  function exportToExcel(tableId, fileName) {
    try {
      const table = document.getElementById(tableId);
      const workbook = XLSX.utils.table_to_book(table);
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
    } catch (error) {
      console.error("Error exportando a Excel:", error);
      alert("Error al exportar a Excel");
    }
  }

  document
    .getElementById("exportarReporteActividadBtn")
    .addEventListener("click", function () {
      exportToExcel("reporteActividadTable", "reporte_actividad");
    });

  document
    .getElementById("exportarReporteGeneralBtn")
    .addEventListener("click", function () {
      exportToExcel("reporteGeneralTable", "reporte_general");
    });

  // Inicialización
  checkAuthStatus().then((authenticated) => {
    if (authenticated) {
      loadInitialData();
    }
  });
});
