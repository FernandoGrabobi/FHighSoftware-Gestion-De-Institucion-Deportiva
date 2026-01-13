import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, getDoc, doc, 
    query, where, orderBy, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIABLES GLOBALES DE CONFIGURACIÓN ---
let PRECIOS = { cuota: 20000, inscripcion: 0, afiliacion: 0 };

// --- 1. NAVEGACIÓN Y UI ---
window.showSection = function(sectionId) {
    // Ocultar todas las secciones
    const sections = ['sec-dashboard', 'sec-planteles', 'sec-cuotas', 'sec-entrenadores', 'sec-historial', 'sec-reportes', 'sec-config'];
    sections.forEach(id => document.getElementById(id)?.classList.add('hidden'));

    // Mostrar la seleccionada
    document.getElementById(`sec-${sectionId}`).classList.remove('hidden');

    // Actualizar título del header
    const titles = {
        dashboard: "Panel Principal", planteles: "Gestión de Planteles",
        cuotas: "Cuotas Pendientes", entrenadores: "Entrenadores",
        historial: "Historial de Pagos", reportes: "Reportes y Estadísticas",
        config: "Configuración de Montos"
    };
    document.getElementById('section-title').innerText = titles[sectionId];

    // Cargar datos específicos de la sección
    if (sectionId === 'planteles') cargarEquipos();
    if (sectionId === 'cuotas') cargarCuotasPendientes();
    if (sectionId === 'historial') cargarHistorial();
    if (sectionId === 'reportes') cargarSelectEquipos('rep-equipo');
    if (sectionId === 'dashboard') actualizarDashboard();
};

window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

// --- 2. GESTIÓN DE PRECIOS (CONFIG) ---
async function cargarConfiguracion() {
    const docSnap = await getDoc(doc(db, "configuracion", "precios"));
    if (docSnap.exists()) {
        PRECIOS = docSnap.data();
        if(document.getElementById('conf-cuota')) {
            document.getElementById('conf-cuota').value = PRECIOS.cuota;
            document.getElementById('conf-inscripcion').value = PRECIOS.inscripcion;
            document.getElementById('conf-afiliacion').value = PRECIOS.afiliacion;
        }
    }
}

document.getElementById('form-config')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevosPrecios = {
        cuota: Number(document.getElementById('conf-cuota').value),
        inscripcion: Number(document.getElementById('conf-inscripcion').value),
        afiliacion: Number(document.getElementById('conf-afiliacion').value)
    };
    await setDoc(doc(db, "configuracion", "precios"), nuevosPrecios);
    alert("Precios actualizados");
    PRECIOS = nuevosPrecios;
});

// --- 3. GESTIÓN DE EQUIPOS Y JUGADORES ---
window.cargarEquipos = async () => {
    const snap = await getDocs(collection(db, "equipos"));
    const contenedor = document.getElementById('lista-equipos');
    contenedor.innerHTML = '';
    
    snap.forEach(doc => {
        const eq = doc.data();
        contenedor.innerHTML += `
            <div class="bg-white p-6 rounded-xl shadow-sm border-t-4 border-club">
                <h3 class="text-lg font-bold">${eq.categoria} - ${eq.rama}</h3>
                <p class="text-xs text-gray-400 mb-4 tracking-widest uppercase">ID: ${doc.id.substring(0,6)}</p>
                <div class="flex gap-2">
                    <button onclick="prepararNuevoJugador('${doc.id}', '${eq.categoria}')" class="bg-club text-white text-xs px-3 py-2 rounded-lg font-bold">
                        <i class="fas fa-user-plus mr-1"></i> Jugador
                    </button>
                    <button class="bg-gray-100 text-gray-600 text-xs px-3 py-2 rounded-lg"><i class="fas fa-edit"></i></button>
                </div>
            </div>
        `;
    });
};

document.getElementById('form-equipo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const eq = {
        categoria: document.getElementById('eq-categoria').value,
        rama: document.getElementById('eq-rama').value,
        creado: serverTimestamp()
    };
    await addDoc(collection(db, "equipos"), eq);
    closeModal('modal-equipo');
    cargarEquipos();
});

// --- 4. LÓGICA DE CUOTAS Y PAGOS ---
window.prepararNuevoJugador = async (idEquipo, nombreEquipo) => {
    const select = document.getElementById('jug-equipo');
    select.innerHTML = `<option value="${idEquipo}" selected>${nombreEquipo}</option>`;
    openModal('modal-jugador');
};

document.getElementById('form-jugador')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const jug = {
        nombre: document.getElementById('jug-nombre').value,
        dni: document.getElementById('jug-dni').value,
        fechaNacimiento: document.getElementById('jug-nacimiento').value,
        beca: Number(document.getElementById('jug-beca').value),
        idEquipo: document.getElementById('jug-equipo').value,
        categoriaEquipo: document.getElementById('jug-equipo').options[document.getElementById('jug-equipo').selectedIndex].text,
        estado: 'activo'
    };
    await addDoc(collection(db, "jugadores"), jug);
    alert("Jugador inscripto con éxito");
    closeModal('modal-jugador');
});

window.cargarCuotasPendientes = async () => {
    const mesActual = new Date().getMonth() + 1;
    const anioActual = new Date().getFullYear();
    const diaActual = new Date().getDate();

    const jugSnap = await getDocs(collection(db, "jugadores"));
    const pagosSnap = await getDocs(query(collection(db, "pagos"), where("mes", "==", mesActual), where("anio", "==", anioActual)));
    
    const pagados = pagosSnap.docs.map(d => d.data().idJugador);
    const tabla = document.getElementById('tabla-pendientes');
    tabla.innerHTML = '';

    jugSnap.forEach(docJug => {
        const jug = docJug.data();
        if (!pagados.includes(docJug.id)) {
            // Calcular monto con beca
            let monto = PRECIOS.cuota * (1 - (jug.beca / 100));
            // Calcular recargo
            let recargoText = "0%";
            if (diaActual > 20) { monto *= 1.40; recargoText = "40%"; }
            else if (diaActual > 15) { monto *= 1.20; recargoText = "20%"; }

            tabla.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="p-4 font-bold">${jug.nombre}</td>
                    <td class="p-4 text-xs">${jug.categoriaEquipo}</td>
                    <td class="p-4 text-blue-600 font-bold">${jug.beca}%</td>
                    <td class="p-4 font-black text-club">$${monto.toLocaleString()} <span class="text-[10px] text-red-500">(+${recargoText} recargo)</span></td>
                    <td class="p-4 text-center">
                        <button onclick="registrarPago('${docJug.id}', '${jug.nombre}', ${monto}, '${jug.idEquipo}', '${jug.categoriaEquipo}')" class="bg-green-600 text-white px-4 py-1 rounded-full text-xs font-bold hover:bg-green-700">COBRAR</button>
                    </td>
                </tr>
            `;
        }
    });
};

window.registrarPago = async (idJug, nombre, monto, idEq, catEq) => {
    if(!confirm(`¿Confirmar cobro de $${monto.toLocaleString()} a ${nombre}?`)) return;

    const pago = {
        idJugador: idJug,
        nombreJugador: nombre,
        idEquipo: idEq,
        categoriaEquipo: catEq,
        monto: monto,
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear(),
        metodo: "Efectivo", // Por defecto, se puede mejorar con un select
        tipo: "cuota",
        fechaRegistro: new Date().toISOString()
    };

    await addDoc(collection(db, "pagos"), pago);
    alert("Pago registrado");
    cargarCuotasPendientes();
};

// --- 5. REPORTES Y DASHBOARD ---
async function actualizarDashboard() {
    const jugSnap = await getDocs(collection(db, "jugadores"));
    const eqSnap = await getDocs(collection(db, "equipos"));
    document.getElementById('dash-jugadores').innerText = jugSnap.size;
    document.getElementById('dash-equipos').innerText = eqSnap.size;
}

// Inicialización
cargarConfiguracion();
actualizarDashboard();