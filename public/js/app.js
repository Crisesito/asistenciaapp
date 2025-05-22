document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const loginModal = new bootstrap.Modal('#loginModal');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const appContent = document.getElementById('appContent');
    
    // Mostrar modal al inicio
    loginModal.show();

    // ======================
    // 1. Sistema de Login
    // ======================
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Credenciales incorrectas');
            }

            loginModal.hide();
            checkAuthStatus();
            loadInitialData();
            
        } catch (error) {
            console.error('Error en login:', error);
            alert(error.message);
        }
    });

    // Cerrar sesión
    logoutBtn.addEventListener('click', async function() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            appContent.style.display = 'none';
            logoutBtn.classList.add('d-none');
            loginModal.show();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    });

    // Verificar autenticación
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            
            if (data.authenticated) {
                appContent.style.display = 'block';
                logoutBtn.classList.remove('d-none');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error verificando sesión:', error);
            return false;
        }
    }

    // ======================
    // 2. Funcionalidad Principal
    // ======================
    async function loadInitialData() {
        if (!await checkAuthStatus()) return;
        
        // Cargar actividades en el select
        try {
            const response = await fetch('/api/actividades');
            const actividades = await response.json();
            
            const select = document.getElementById('actividadSelect');
            select.innerHTML = '<option value="">Seleccionar...</option>';
            
            actividades.forEach(act => {
                const option = document.createElement('option');
                option.value = act.id;
                option.textContent = `${act.nombre} (${new Date(act.fecha).toLocaleDateString()})`;
                select.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error cargando actividades:', error);
        }
    }

    // Crear nueva actividad
    document.getElementById('actividadForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const actividad = {
            nombre: document.getElementById('nombreActividad').value,
            fecha: document.getElementById('fechaActividad').value
        };

        try {
            const response = await fetch('/api/actividades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(actividad)
            });

            if (!response.ok) throw new Error('Error al crear actividad');
            
            alert('Actividad creada!');
            loadInitialData();
            this.reset();
            
        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        }
    });

    // Importar participantes desde Excel
    document.getElementById('participantesForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const actividadId = document.getElementById('actividadSelect').value;
        const file = document.getElementById('archivoExcel').files[0];
        
        if (!actividadId || !file) {
            alert('Seleccione una actividad y un archivo');
            return;
        }

        try {
            const data = await readExcelFile(file);
            const response = await fetch('/api/participantes/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actividadId, participantes: data })
            });

            if (!response.ok) throw new Error('Error al importar');
            
            alert(`Importados ${data.length} participantes`);
            this.reset();
            
        } catch (error) {
            console.error('Error importando:', error);
            alert(error.message);
        }
    });

    // Leer archivo Excel
    function readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: ['rut', 'nombre'] });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // Generar reporte
    document.getElementById('generarReporteBtn').addEventListener('click', async function() {
        try {
            const response = await fetch('/api/reportes');
            const reportes = await response.json();
            
            const tbody = document.querySelector('#reporteTable tbody');
            tbody.innerHTML = '';
            
            reportes.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.rut || 'N/A'}</td>
                    <td>${item.nombre || 'N/A'}</td>
                    <td>${item.asistencias}</td>
                    <td>${item.totalActividades}</td>
                    <td>${item.porcentaje}%</td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error generando reporte:', error);
            alert('Error al generar reporte');
        }
    });

    // Inicializar
    checkAuthStatus().then(authenticated => {
        if (authenticated) {
            loadInitialData();
        }
    });
});