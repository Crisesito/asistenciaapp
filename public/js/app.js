document.addEventListener("DOMContentLoaded", function () {
  const loginModal = new bootstrap.Modal("#loginModal");
  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");
  const appContent = document.getElementById("appContent");

  // Lista de regiones de Chile
  const REGIONES_CHILE = [
    "Arica y Parinacota",
    "Tarapacá",
    "Antofagasta",
    "Atacama",
    "Coquimbo",
    "Valparaíso",
    "Metropolitana",
    "OHiggins",
    "Maule",
    "Ñuble",
    "Biobío",
    "Araucanía",
    "Los Ríos",
    "Los Lagos",
    "Aysén",
    "Magallanes",
  ];

  // Cargar regiones en los selectores
  function cargarRegiones() {
    const selects = [
      document.getElementById("filtroRegionReporte"),
      document.getElementById("filtroRegionGeneral"),
    ];

    selects.forEach((select) => {
      if (select) {
        REGIONES_CHILE.forEach((region) => {
          const option = document.createElement("option");
          option.value = region;
          option.textContent = region;
          select.appendChild(option);
        });
      }
    });
  }

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
        ).toLocaleDateString()}) - ${act.region}`;
        select.appendChild(option);
      });
    } catch (error) {
      console.error("Error cargando actividades:", error);
      alert("Error al cargar actividades: " + error.message);
    }
  }
  document.getElementById('rutRegistroManual').addEventListener('blur', function() {
    buscarParticipanteExistente(this.value);
});

  // Crear actividad
  document
    .getElementById("actividadForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const actividad = {
        area: document.getElementById("areaActividad").value,
        nombre: document.getElementById("nombreActividad").value,
        fecha: document.getElementById("fechaActividad").value,
        region: document.getElementById("regionActividad").value,
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
  function normalizarRUT(rut) {
    if (!rut) return null;
    return rut
      .toString()
      .replace(/\./g, "")
      .replace(/\s/g, "")
      .replace(/-/g, "")
      .toUpperCase();
  }

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
            range: 1,
            defval: "",
          });

          const datosValidados = jsonData
            .map((row) => ({
              rut: normalizarRUT(row.rut),
              nombre: (row.nombre || "").toString().trim(),
              email: (row.email || "").toString().trim().toLowerCase(),
            }))
            .filter((row) => row.rut && row.nombre);

          resolve(datosValidados);
        } catch (error) {
          reject(new Error("Error al procesar el archivo Excel"));
        }
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo"));
      reader.readAsArrayBuffer(file);
    });
  }
  // Cargar actividades cuando se selecciona un área
  document
    .getElementById("areaRegistroManual")
    .addEventListener("change", function () {
      const area = this.value;
      const actividadSelect = document.getElementById(
        "actividadRegistroManual"
      );

      if (area) {
        loadActivitiesByAreaAndRegion(
          area,
          "", // Todas las regiones
          "", // Sin fecha inicio
          "", // Sin fecha fin
          actividadSelect
        );
      } else {
        actividadSelect.innerHTML =
          '<option value="">Seleccione un área primero</option>';
        actividadSelect.disabled = true;
      }
    });

  // Buscar participante existente por RUT
  async function buscarParticipanteExistente(rut) {
    if (!rut) return;

    try {
      const rutNormalizado = normalizarRUT(rut);
      const response = await fetch(
        `/api/personas/buscar?rut=${rutNormalizado}`
      );

      if (response.ok) {
        const persona = await response.json();
        if (persona) {
          document.getElementById("nombreRegistroManual").value =
            persona.nombre || "";
          document.getElementById("emailRegistroManual").value =
            persona.email || "";
        }
      }
    } catch (error) {
      console.error("Error al buscar participante:", error);
    }
    if (persona) {
      document.getElementById('nombreRegistroManual').value = persona.nombre || '';
      document.getElementById('emailRegistroManual').value = persona.email || '';
      // Marcar como autocompletado
      document.getElementById('nombreRegistroManual').classList.add('autocompletado');
      document.getElementById('emailRegistroManual').classList.add('autocompletado');
  } else {
      // Quitar marca de autocompletado si no se encuentra
      document.getElementById('nombreRegistroManual').classList.remove('autocompletado');
      document.getElementById('emailRegistroManual').classList.remove('autocompletado');
  }
  }

  // Registrar participante manualmente
  document
    .getElementById("registroManualForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const actividadId = document.getElementById(
        "actividadRegistroManual"
      ).value;
      const rut = document.getElementById("rutRegistroManual").value;
      const nombre = document.getElementById("nombreRegistroManual").value;
      const email = document.getElementById("emailRegistroManual").value;

      if (!actividadId || !rut || !nombre) {
        alert("Área, actividad, RUT y nombre son requeridos");
        return;
      }

      const btn = this.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Registrando...';

      try {
        // 1. Crear/actualizar persona
        const personaResponse = await fetch("/api/personas/crear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rut, nombre, email }),
        });

        if (!personaResponse.ok) {
          throw new Error("Error al registrar persona");
        }

        const personaData = await personaResponse.json();

        // 2. Registrar participación
        const participacionResponse = await fetch(
          "/api/participaciones/registrar",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId: personaData.id,
              actividadId: actividadId,
            }),
          }
        );

        if (!participacionResponse.ok) {
          throw new Error("Error al registrar participación");
        }

        alert("Participante registrado exitosamente");

        // Limpiar solo los campos de persona, mantener área y actividad
        document.getElementById("rutRegistroManual").value = "";
        document.getElementById("nombreRegistroManual").value = "";
        document.getElementById("emailRegistroManual").value = "";
      } catch (error) {
        console.error("Error en registro manual:", error);
        alert(`Error: ${error.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = "Registrar Participante";
      }
    });
    document.getElementById('rutRegistroManual').addEventListener('input', function(e) {
      // Validar formato de RUT mientras se escribe
      this.value = this.value.replace(/[^0-9kK\-]/g, '');
  });
  document
    .getElementById("participantesForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const actividadId = document.getElementById("actividadSelect").value;
      const actividadNombre =
        document.getElementById("actividadSelect").selectedOptions[0].text;
      const file = document.getElementById("archivoExcel").files[0];

      if (!actividadId || !file) {
        alert("Debe seleccionar una actividad y un archivo Excel");
        return;
      }

      const btn = this.querySelector("button[type='submit']");
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Importando...';

      try {
        const data = await readExcelFile(file);
        console.log("Datos validados del Excel:", data);

        const response = await fetch("/api/participantes/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actividadId, participantes: data }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Error en la importación");
        }

        alert(
          `Importación a "${actividadNombre}" completada:\n\n` +
            `Participantes importados: ${result.importados}\n` +
            `Errores: ${result.errores}`
        );

        if (result.errores > 0 && result.erroresDetalle?.length > 0) {
          console.error("Errores detallados:", result.erroresDetalle);
        }

        this.reset();
      } catch (error) {
        console.error("Error en importación:", error);
        alert(`Error al importar: ${error.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = "Importar";
      }
    });

  // Función para leer archivo Excel (mejorada)
  function readExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];

          // Leer datos manteniendo el formato de columnas
          const jsonData = XLSX.utils.sheet_to_json(sheet, {
            header: ["rut", "nombre", "email"], // Mapear columnas
            range: 1, // Saltar cabecera
            defval: "", // Valor por defecto
            raw: false, // Obtener valores formateados
          });

          console.log("Datos crudos del Excel:", jsonData); // Para depuración
          resolve(jsonData);
        } catch (error) {
          console.error("Error al procesar archivo Excel:", error);
          reject(new Error("Formato de archivo Excel no válido"));
        }
      };
      reader.onerror = (error) => {
        console.error("Error al leer archivo:", error);
        reject(new Error("No se pudo leer el archivo"));
      };
      reader.readAsArrayBuffer(file);
    });
  }

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

  // Cargar actividades por área y región
  async function loadActivitiesByAreaAndRegion(
    area,
    region,
    fechaInicio,
    fechaFin,
    selectElement
  ) {
    try {
      const params = new URLSearchParams();
      if (area) params.append("area", area);
      if (region) params.append("region", region);
      if (fechaInicio) params.append("fechaInicio", fechaInicio);
      if (fechaFin) params.append("fechaFin", fechaFin);

      const response = await fetch(
        `/api/actividades/filtradas?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error HTTP: ${response.status}`);
      }

      const actividades = await response.json();

      if (!Array.isArray(actividades)) {
        throw new Error("Formato de respuesta inválido");
      }

      selectElement.innerHTML = '<option value="">Seleccionar...</option>';

      actividades.forEach((act) => {
        const option = document.createElement("option");
        option.value = act.id;
        option.textContent = `${act.nombre} (${new Date(
          act.fecha
        ).toLocaleDateString()}) - ${act.region}`;
        selectElement.appendChild(option);
      });

      selectElement.disabled = false;
    } catch (error) {
      console.error("Error cargando actividades:", error);
      selectElement.innerHTML =
        '<option value="">Error cargando actividades</option>';
      selectElement.disabled = true;
    }
  }

  // Filtro de área para reporte
  document
    .getElementById("filtroAreaReporte")
    .addEventListener("change", async function () {
      const area = this.value;
      const actividadSelect = document.getElementById("filtroActividadReporte");

      if (area) {
        await loadActivitiesByAreaAndRegion(
          area,
          document.getElementById("filtroRegionReporte").value,
          document.getElementById("fechaInicioReporte").value,
          document.getElementById("fechaFinReporte").value,
          actividadSelect
        );
      } else {
        actividadSelect.innerHTML =
          '<option value="">Seleccione una actividad</option>';
        actividadSelect.disabled = true;
      }
    });

  // Filtro de región para reporte
  document
    .getElementById("filtroRegionReporte")
    .addEventListener("change", async function () {
      const region = this.value;
      const area = document.getElementById("filtroAreaReporte").value;
      const actividadSelect = document.getElementById("filtroActividadReporte");

      if (area) {
        await loadActivitiesByAreaAndRegion(
          area,
          region,
          document.getElementById("fechaInicioReporte").value,
          document.getElementById("fechaFinReporte").value,
          actividadSelect
        );
      }
    });

  // Filtro de fechas para reporte
  document
    .getElementById("fechaInicioReporte")
    .addEventListener("change", async function () {
      const area = document.getElementById("filtroAreaReporte").value;
      const region = document.getElementById("filtroRegionReporte").value;
      const actividadSelect = document.getElementById("filtroActividadReporte");

      if (area) {
        await loadActivitiesByAreaAndRegion(
          area,
          region,
          this.value,
          document.getElementById("fechaFinReporte").value,
          actividadSelect
        );
      }
    });

  document
    .getElementById("fechaFinReporte")
    .addEventListener("change", async function () {
      const area = document.getElementById("filtroAreaReporte").value;
      const region = document.getElementById("filtroRegionReporte").value;
      const actividadSelect = document.getElementById("filtroActividadReporte");

      if (area) {
        await loadActivitiesByAreaAndRegion(
          area,
          region,
          document.getElementById("fechaInicioReporte").value,
          this.value,
          actividadSelect
        );
      }
    });

  // Generar reporte por actividad
  document
    .getElementById("generarReporteActividadBtn")
    .addEventListener("click", async () => {
      const actividadId = document.getElementById(
        "filtroActividadReporte"
      ).value;
      const rut = document.getElementById("filtroRutGeneral").value;
      if (rut) params.append("rut", normalizarRUT(rut));
      if (!actividadId) return alert("Seleccione una actividad");

      try {
        const response = await fetch(
          `/api/reportes/por-actividad?actividadId=${actividadId}`
        );
        const data = await response.json();

        const tbody = document.querySelector("#reporteActividadTable tbody");
        tbody.innerHTML = data.length
          ? data
              .map(
                (p) => `
            <tr>
                <td>${p.rut}</td>
                <td>${p.nombre}</td>
                <td>${p.email}</td>
            </tr>
        `
              )
              .join("")
          : `<tr><td colspan="3">No hay participantes</td></tr>`;
      } catch (error) {
        console.error("Error:", error);
        alert("Error al generar reporte");
      }
    });

  // Generar Reporte General
  document
    .getElementById("generarReporteGeneralBtn")
    .addEventListener("click", async function () {
      const btn = this;
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Generando...';

      try {
        const params = new URLSearchParams();

        // Añadir áreas seleccionadas
        Array.from(
          document.getElementById("filtroAreaGeneral").selectedOptions
        ).forEach((opt) => params.append("areas", opt.value));

        // Añadir regiones seleccionadas
        Array.from(
          document.getElementById("filtroRegionGeneral").selectedOptions
        ).forEach((opt) => params.append("regiones", opt.value));

        // Añadir fechas si existen
        const fechaInicio = document.getElementById("fechaInicioGeneral").value;
        const fechaFin = document.getElementById("fechaFinGeneral").value;
        if (fechaInicio) params.append("fechaInicio", fechaInicio);
        if (fechaFin) params.append("fechaFin", fechaFin);

        // Añadir RUT si existe
        const rut = document.getElementById("filtroRutGeneral").value;
        if (rut) params.append("rut", rut);

        const response = await fetch(
          `/api/reportes/general?${params.toString()}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Error al generar reporte");
        }

        const reporte = await response.json();

        // Renderizar resultados en la tabla
        const tbody = document.querySelector("#reporteGeneralTable tbody");
        tbody.innerHTML = reporte.length
          ? reporte
              .map(
                (item) => `
          <tr>
              <td>${item.area}</td>
              <td>${item.region}</td>
              <td>${item.rut}</td>
              <td>${item.nombre}</td>
              <td>${item.email}</td>
              <td>${item.asistencias}</td>
              <td>${item.total_actividades}</td>
              <td>${item.porcentaje}%</td>
              <td>${item.actividades_participadas || "N/A"}</td>
          </tr>
      `
              )
              .join("")
          : '<tr><td colspan="9">No se encontraron resultados</td></tr>';
      } catch (error) {
        console.error("Error generando reporte general:", error);
        alert(
          `Error: ${
            error.message.includes("<!DOCTYPE")
              ? "Error en el servidor"
              : error.message
          }`
        );
      } finally {
        btn.disabled = false;
        btn.textContent = "Generar Reporte";
      }
    });
  // Exportar a Excel
  function exportToExcel(tableId, fileName) {
    const table = document.getElementById(tableId);
    const workbook = XLSX.utils.table_to_book(table);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }

  document
    .getElementById("exportarReporteActividadBtn")
    .addEventListener("click", () => {
      exportToExcel("reporteActividadTable", "reporte_actividad");
    });

  document
    .getElementById("exportarReporteGeneralBtn")
    .addEventListener("click", () => {
      exportToExcel("reporteGeneralTable", "reporte_general");
    });

  // Inicialización
  cargarRegiones();
  checkAuthStatus().then((authenticated) => {
    if (authenticated) {
      loadInitialData();
    }
  });
});
