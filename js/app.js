import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, getDoc, doc, deleteDoc, 
    query, where, orderBy, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN GLOBAL ---
let PRECIOS = { cuota: 20000, inscripcion: 5000, afiliacion: 3000 };

// --- UTILIDADES GLOBALES (Hacer visibles para el HTML) ---
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

window.showSection = function(sectionId) {
    const sections = ['sec-dashboard', 'sec-planteles', 'sec-cuotas', 'sec-entrenadores', 'sec-historial', 'sec-reportes', 'sec-config'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    
    const target = document.getElementById(`sec-${sectionId}`);
    if(target) target.classList.remove('hidden');

    // Títulos dinámicos
    const titles = {
        dashboard: "Panel Principal", planteles: "Planteles del Club",
        cuotas: "Cuotas Pendientes", entrenadores: "Cuerpo Técnico",
        historial: "Historial de Pagos", reportes: "Reportes Mensuales",
        config: "Ajustes de Sistema"
    };
    document.getElementById('section-title').innerText = titles[sectionId] || "Panel";

    // Cargas automáticas al entrar
    if (sectionId === 'planteles') cargarEquipos();
    if (sectionId === 'cuotas') cargarCuotasPendientes();
    if (sectionId === 'entrenadores') cargarEntrenadores();
    if (sectionId === 'historial') cargarHistorial();
    if (sectionId === 'dashboard') actualizarDashboard();
};

// --- 1. GESTIÓN DE EQUIPOS Y JUGADORES ---
window.cargarEquipos = async () => {
    const eqSnap = await getDocs(collection(db, "equipos"));
    const jugSnap = await getDocs(collection(db, "jugadores"));
    const contenedor = document.getElementById('lista-equipos');
    contenedor.innerHTML = '';
    
    eqSnap.forEach(docEq => {
        const eq = docEq.data();
        const misJugadores = jugSnap.docs.filter(j => j.data().idEquipo === docEq.id);

        contenedor.innerHTML += `
            <div class="bg-white p-6 rounded-3xl shadow-lg border-t-8 border-club mb-4">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-2xl font-black text-club italic leading-none">${eq.nombre}</h3>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${eq.categoria} - ${eq.rama}</p>
                    </div>
                    <button onclick="eliminarEquipo('${docEq.id}')" class="text-red-300 hover:text-red-600 transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                
                <div class="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                    <h4 class="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-tighter">Jugadores en lista (${misJugadores.length})</h4>
                    <ul class="space-y-1">
                        ${misJugadores.map(j => `
                            <li class="text-xs font-bold text-gray-600 flex justify-between items-center border-b border-gray-100 pb-1">
                                <span>${j.data().nombre}</span>
                                <div class="flex items-center gap-2">
                                    ${j.data().beca > 0 ? `<span class="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-black italic">BECADO ${j.data().beca}%</span>` : ''}
                                    <button onclick="eliminarJugador('${j.id}')" class="text-gray-300 hover:text-red-500"><i class="fas fa-times"></i></button>
                                </div>
                            </li>
                        `).join('') || '<li class="text-[10px] text-gray-300 italic">No hay integrantes cargados</li>'}
                    </ul>
                </div>

                <button onclick="prepararNuevoJugador('${docEq.id}', '${eq.nombre}')" class="w-full bg-club text-white text-[10px] py-3 rounded-xl font-black uppercase tracking-widest shadow-md hover:bg-green-700 transition">
                    + JUGADOR
                </button>
            </div>
        `;
    });
};

window.prepararNuevoJugador = (idEquipo, nombreEquipo) => {
    const select = document.getElementById('jug-equipo');
    select.innerHTML = `<option value="${idEquipo}" selected>${nombreEquipo}</option>`;
    window.openModal('modal-jugador');
};

document.getElementById('form-equipo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "equipos"), {
        nombre: document.getElementById('eq-nombre').value,
        categoria: document.getElementById('eq-categoria').value,
        rama: document.getElementById('eq-rama').value,
        creado: serverTimestamp()
    });
    window.closeModal('modal-equipo');
    cargarEquipos();
    e.target.reset();
});

document.getElementById('form-jugador')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "jugadores"), {
        nombre: document.getElementById('jug-nombre').value,
        dni: document.getElementById('jug-dni').value,
        fechaNacimiento: document.getElementById('jug-nacimiento').value,
        beca: Number(document.getElementById('jug-beca').value),
        idEquipo: document.getElementById('jug-equipo').value,
        nombreEquipo: document.getElementById('jug-equipo').options[0].text
    });
    window.closeModal('modal-jugador');
    cargarEquipos();
    e.target.reset();
});

window.eliminarEquipo = async (id) => { if(confirm("¿Eliminar equipo?")) { await deleteDoc(doc(db, "equipos", id)); cargarEquipos(); } };
window.eliminarJugador = async (id) => { if(confirm("¿Eliminar jugador?")) { await deleteDoc(doc(db, "jugadores", id)); cargarEquipos(); } };

// --- 2. COBROS Y CUOTAS ---
window.cargarCuotasPendientes = async () => {
    const mes = new Date().getMonth() + 1;
    const anio = new Date().getFullYear();
    const dia = new Date().getDate();

    const jugSnap = await getDocs(collection(db, "jugadores"));
    const pagosSnap = await getDocs(query(collection(db, "pagos"), where("mes", "==", mes), where("anio", "==", anio)));
    const pagados = pagosSnap.docs.map(d => d.data().idJugador);

    const tabla = document.getElementById('tabla-pendientes');
    tabla.innerHTML = '';

    jugSnap.forEach(docJug => {
        const jug = docJug.data();
        if (!pagados.includes(docJug.id)) {
            let monto = PRECIOS.cuota * (1 - (jug.beca / 100));
            let recargo = 0;
            if (dia > 20) recargo = 0.40; else if (dia > 15) recargo = 0.20;
            const total = monto + (monto * recargo);

            tabla.innerHTML += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-4 font-bold text-gray-700">${jug.nombre}</td>
                    <td class="p-4 text-[10px] font-black text-gray-400 uppercase">${jug.nombreEquipo}</td>
                    <td class="p-4 font-black text-club italic">$${total.toLocaleString()}</td>
                    <td class="p-4 text-center">
                        <button onclick="abrirModalPago('${docJug.id}', '${jug.nombre}', ${total}, '${jug.idEquipo}', '${jug.nombreEquipo}')" class="bg-club text-white px-6 py-1 rounded-full text-[10px] font-black uppercase">Cobrar</button>
                    </td>
                </tr>
            `;
        }
    });
};

window.abrirModalPago = (id, nombre, monto, idEq, nomEq) => {
    document.getElementById('pago-id-jug').value = id;
    document.getElementById('pago-monto').value = monto;
    document.getElementById('pago-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('detalles-jug-pago').innerText = `${nombre} | ${nomEq}`;
    window.pagoData = { id, nombre, idEq, nomEq };
    window.openModal('modal-pago');
};

document.getElementById('form-pago-final')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pago = {
        idJugador: window.pagoData.id,
        nombreJugador: window.pagoData.nombre,
        idEquipo: window.pagoData.idEq,
        nombreEquipo: window.pagoData.nomEq,
        monto: Number(document.getElementById('pago-monto').value),
        metodo: document.getElementById('pago-metodo').value,
        fechaPago: document.getElementById('pago-fecha').value,
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear(),
        tipo: "cuota",
        fechaRegistro: new Date().toISOString()
    };
    await addDoc(collection(db, "pagos"), pago);
    window.closeModal('modal-pago');
    cargarCuotasPendientes();
    actualizarDashboard();
});

// --- 3. ENTRENADORES ---
window.cargarEntrenadores = async () => {
    const snap = await getDocs(collection(db, "entrenadores"));
    const contenedor = document.getElementById('lista-entrenadores');
    contenedor.innerHTML = '';
    snap.forEach(d => {
        const ent = d.data();
        contenedor.innerHTML += `
            <div class="bg-white p-6 rounded-3xl shadow-lg border-l-8 border-blue-500">
                <h3 class="text-xl font-black italic">${ent.nombre}</h3>
                <p class="text-xs font-bold text-blue-600 mb-4">Sueldo: $${Number(ent.sueldo).toLocaleString()}</p>
                <button onclick="abrirPagoEntrenador('${d.id}', '${ent.nombre}', ${ent.sueldo})" class="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase">Registrar Pago</button>
            </div>
        `;
    });
};

window.abrirPagoEntrenador = (id, nombre, sueldo) => {
    document.getElementById('pago-ent-id').value = id;
    document.getElementById('pago-ent-monto').value = sueldo;
    document.getElementById('pago-ent-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('label-entrenador-pago').innerText = nombre;
    window.openModal('modal-pago-entrenador');
};

document.getElementById('form-pago-ent-final')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "pagos_entrenadores"), {
        idEntrenador: document.getElementById('pago-ent-id').value,
        nombre: document.getElementById('label-entrenador-pago').innerText,
        monto: Number(document.getElementById('pago-ent-monto').value),
        metodo: document.getElementById('pago-ent-metodo').value,
        fecha: document.getElementById('pago-ent-fecha').value,
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear()
    });
    window.closeModal('modal-pago-entrenador');
    actualizarDashboard();
});

// --- 4. HISTORIAL ---
window.cargarHistorial = async () => {
    const q = query(collection(db, "pagos"), orderBy("fechaRegistro", "desc"));
    const snap = await getDocs(q);
    const tabla = document.getElementById('tabla-historial-body');
    tabla.innerHTML = '';
    
    snap.forEach(d => {
        const p = d.data();
        tabla.innerHTML += `
            <tr class="border-b text-[10px]">
                <td class="p-3 font-bold text-gray-400">${p.fechaPago}</td>
                <td class="p-3 font-black text-gray-700 uppercase">${p.nombreJugador}</td>
                <td class="p-3 italic text-gray-500">${p.nombreEquipo}</td>
                <td class="p-3 font-black text-club">$${p.monto.toLocaleString()}</td>
                <td class="p-3 font-bold text-blue-500 tracking-tighter">${p.metodo}</td>
            </tr>
        `;
    });
};

// --- 5. REPORTES ---
window.generarReporte = async () => {
    const mes = Number(document.getElementById('rep-mes').value);
    const anio = new Date().getFullYear();
    const snapP = await getDocs(query(collection(db, "pagos"), where("mes", "==", mes), where("anio", "==", anio)));
    const snapE = await getDocs(query(collection(db, "pagos_entrenadores"), where("mes", "==", mes), where("anio", "==", anio)));
    
    let ingresos = 0; snapP.forEach(p => ingresos += p.data().monto);
    let egresos = 0; snapE.forEach(p => egresos += p.data().monto);
    
    document.getElementById('stats-reporte').innerHTML = `
        <div class="p-6 bg-green-50 rounded-2xl border-2 border-green-100"><p class="text-[9px] font-black text-green-700 uppercase">Ingresos</p><p class="text-2xl font-black text-green-900">$${ingresos.toLocaleString()}</p></div>
        <div class="p-6 bg-red-50 rounded-2xl border-2 border-red-100"><p class="text-[9px] font-black text-red-700 uppercase">Gastos</p><p class="text-2xl font-black text-red-900">$${egresos.toLocaleString()}</p></div>
        <div class="p-6 bg-gray-900 rounded-2xl shadow-xl"><p class="text-[9px] font-black text-green-400 uppercase">Neto</p><p class="text-2xl font-black text-white">$${(ingresos - egresos).toLocaleString()}</p></div>
    `;
};

// --- 6. INICIO (DASHBOARD) ---
async function actualizarDashboard() {
    const mes = new Date().getMonth() + 1;
    const anio = new Date().getFullYear();
    const jugS = await getDocs(collection(db, "jugadores"));
    const eqS = await getDocs(collection(db, "equipos"));
    const pagS = await getDocs(query(collection(db, "pagos"), where("mes", "==", mes), where("anio", "==", anio)));
    
    let total = 0; pagS.forEach(p => total += p.data().monto);
    
    document.getElementById('dash-jugadores').innerText = jugS.size;
    document.getElementById('dash-equipos').innerText = eqS.size;
    document.getElementById('dash-ingresos').innerText = `$${total.toLocaleString()}`;
}

// ARRANQUE
async function init() {
    const dConfig = await getDoc(doc(db, "configuracion", "precios"));
    if(dConfig.exists()) PRECIOS = dConfig.data();
    actualizarDashboard();
}
init();