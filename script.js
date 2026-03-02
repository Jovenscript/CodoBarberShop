import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const authError = document.getElementById('auth-error');

let currentUser = null;
let transacoes = [];
let chartInstance = null;

// ==========================================
// 1. SESSÃO E AUTENTICAÇÃO (CORTINA CONSERTADA)
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário logado: Tira a tela de login da frente e mostra o App
        currentUser = user;
        document.getElementById('user-email-display').textContent = user.email;
        
        authContainer.classList.remove('active'); // O erro estava aqui! Faltava essa linha.
        authContainer.classList.add('hidden');
        
        appContainer.classList.remove('hidden');
        appContainer.classList.add('active');
        
        iniciarApp();
    } else {
        // Ninguém logado: Esconde o App e mostra o Login
        currentUser = null;
        
        appContainer.classList.remove('active');
        appContainer.classList.add('hidden');
        
        authContainer.classList.remove('hidden');
        authContainer.classList.add('active');
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnLogin.disabled = true;
    btnLogin.textContent = "Verificando...";
    authError.textContent = "";
    
    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    } catch (error) {
        console.error("Erro Firebase:", error);
        authError.textContent = "Erro: " + error.message; 
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar no Sistema";
    }
});

btnRegister.addEventListener('click', async () => {
    if(!emailInput.value || !passInput.value) {
        authError.textContent = "Preencha e-mail e senha para registrar.";
        return;
    }
    btnRegister.disabled = true;
    btnRegister.textContent = "Aguarde...";
    authError.textContent = "";
    
    try {
        await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    } catch (error) {
        console.error("Erro Firebase:", error);
        authError.textContent = "Erro ao registrar: " + error.message;
    } finally {
        btnRegister.disabled = false;
        btnRegister.textContent = "Registrar Novo Usuário";
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// Modo Escuro
const btnDarkMode = document.getElementById('btn-dark-mode');
if (btnDarkMode) {
    btnDarkMode.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        btnDarkMode.textContent = document.body.classList.contains('dark-mode') ? "☀️ Modo Claro" : "🌙 Modo Escuro";
    });
}

// ==========================================
// 2. NAVEGAÇÃO 3D E MENU LATERAL
// ==========================================
const carousel = document.getElementById('carousel');
let currentAngle = 0;
document.getElementById('next-face').addEventListener('click', () => { currentAngle -= 90; carousel.style.transform = `translateZ(-210px) rotateY(${currentAngle}deg)`; });
document.getElementById('prev-face').addEventListener('click', () => { currentAngle += 90; carousel.style.transform = `translateZ(-210px) rotateY(${currentAngle}deg)`; });

document.querySelectorAll('.menu-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        currentAngle = parseInt(link.getAttribute('data-face')) * -90;
        carousel.style.transform = `translateZ(-210px) rotateY(${currentAngle}deg)`;
        document.getElementById('sidebar').classList.remove('open');
    });
});
document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
document.getElementById('close-sidebar').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

// ==========================================
// 3. TRANSAÇÕES E METAS INTELIGENTES
// ==========================================
function iniciarApp() {
    const q = query(collection(db, "transacoes"), where("userId", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        transacoes = [];
        snapshot.forEach((doc) => transacoes.push({ id: doc.id, ...doc.data() }));
        transacoes.sort((a, b) => new Date(b.data) - new Date(a.data));
        renderizarTransacoes();
        atualizarDashboardsE_Metas();
    });
}

const modal = document.getElementById('modal-transacao');
if(document.getElementById('btn-nova-transacao')) {
    document.getElementById('btn-nova-transacao').addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('btn-cancelar').addEventListener('click', () => modal.classList.add('hidden'));
}

document.getElementById('form-transacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]'); 
    btn.disabled = true;
    btn.textContent = "Salvando...";
    try {
        await addDoc(collection(db, "transacoes"), {
            userId: currentUser.uid,
            tipo: document.getElementById('t-tipo').value,
            propriedade: document.getElementById('t-propriedade').value,
            descricao: document.getElementById('t-descricao').value,
            valor: parseFloat(document.getElementById('t-valor').value),
            data: document.getElementById('t-data').value,
            categoria: document.getElementById('t-categoria').value
        });
        modal.classList.add('hidden'); 
        e.target.reset();
    } catch (err) { 
        alert("Erro ao salvar: " + err.message); 
    } finally { 
        btn.disabled = false; 
        btn.textContent = "Salvar Lançamento";
    }
});

document.getElementById('lista-transacoes').addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn') && confirm("Excluir transação?")) {
        await deleteDoc(doc(db, "transacoes", e.target.getAttribute('data-id')));
    }
});

function renderizarTransacoes() {
    const lista = document.getElementById('lista-transacoes');
    const filtro = document.getElementById('filtro-propriedade').value;
    lista.innerHTML = '';
    const txFiltradas = transacoes.filter(tx => filtro === 'Todos' || tx.propriedade === filtro);

    txFiltradas.forEach(tx => {
        const li = document.createElement('li'); li.className = `t-${tx.tipo}`;
        li.innerHTML = `
            <div><strong style="color: var(--primary);">${tx.descricao}</strong> <small style="color: var(--secondary);">(${tx.propriedade})</small><br>
            <small style="color: var(--secondary);">${tx.data.split('-').reverse().join('/')} • ${tx.categoria}</small></div>
            <div style="text-align: right;">
            <span style="font-weight: bold; color: ${tx.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)'}">${tx.tipo === 'saida' ? '- ' : '+ '}R$ ${tx.valor.toFixed(2)}</span>
            <button class="delete-btn" data-id="${tx.id}" style="background:transparent; color:var(--danger); border:none; cursor:pointer; font-size:0.8rem; font-weight:bold;">Excluir</button></div>`;
        lista.appendChild(li);
    });
}

document.getElementById('filtro-propriedade').addEventListener('change', renderizarTransacoes);

function atualizarDashboardsE_Metas() {
    let entradas = 0; let saidas = 0; 
    let somaCasamento = 0; let somaAmortizacao = 0;
    const despesasCategoria = {};

    transacoes.forEach(tx => {
        if (tx.tipo === 'entrada') entradas += tx.valor;
        if (tx.tipo === 'saida') {
            saidas += tx.valor;
            despesasCategoria[tx.categoria] = (despesasCategoria[tx.categoria] || 0) + tx.valor;
        }
        
        if (tx.categoria === 'Casamento' && tx.tipo === 'entrada') somaCasamento += tx.valor;
        if (tx.categoria === 'Amortização' && tx.tipo === 'saida') somaAmortizacao += tx.valor;
    });

    document.getElementById('stat-entradas').textContent = `R$ ${entradas.toFixed(2)}`;
    document.getElementById('stat-saidas').textContent = `R$ ${saidas.toFixed(2)}`;
    const saldoLiquido = entradas - saidas;
    const saldoEl = document.getElementById('saldo-previsto');
    saldoEl.textContent = `R$ ${saldoLiquido.toFixed(2)}`;
    saldoEl.style.color = saldoLiquido >= 0 ? 'var(--success)' : 'var(--danger)';

    const progCasamento = document.getElementById('prog-casamento');
    const txtCasamento = document.getElementById('txt-casamento');
    if (progCasamento && txtCasamento) {
        progCasamento.value = somaCasamento;
        let percCasamento = ((somaCasamento / 40000) * 100).toFixed(1);
        txtCasamento.textContent = `Poupado: R$ ${somaCasamento.toFixed(2)} (${percCasamento}%)`;
    }

    const progFinanciamento = document.getElementById('prog-financiamento');
    const txtFinanciamento = document.getElementById('txt-financiamento');
    const txtPercFinanciamento = document.getElementById('txt-perc-financiamento');
    if (progFinanciamento && txtFinanciamento && txtPercFinanciamento) {
        let saldoRestante = 152000 - somaAmortizacao;
        progFinanciamento.value = somaAmortizacao; 
        txtFinanciamento.textContent = `Saldo Restante: R$ ${saldoRestante.toFixed(2)}`;
        let percFinanciamento = ((somaAmortizacao / 152000) * 100).toFixed(1);
        txtPercFinanciamento.textContent = `${percFinanciamento}% Amortizado`;
    }

    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('chart-despesas');
    if (ctx) {
        chartInstance = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: { labels: Object.keys(despesasCategoria), datasets: [{ data: Object.values(despesasCategoria), backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#64748b'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// ==========================================
// 4. IMPORTADOR (CSV) E EXPORTAÇÃO
// ==========================================
const btnTriggerImport = document.getElementById('btn-trigger-import');
const fileImportCsv = document.getElementById('file-import-csv');

if (btnTriggerImport && fileImportCsv) {
    btnTriggerImport.addEventListener('click', () => fileImportCsv.click());
    fileImportCsv.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: async function(results) {
                let importados = 0;
                for (let row of results.data) {
                    const dataRaw = row['Data'] || row['data'] || row['Date'];
                    const descRaw = row['Descrição'] || row['Descricao'] || row['Histórico'] || row['Description'];
                    const valorRaw = row['Valor'] || row['valor'] || row['Amount'];

                    if (dataRaw && descRaw && valorRaw) {
                        let numValor = parseFloat(valorRaw.replace(/[^\d,-]/g, '').replace(',', '.'));
                        let tipoTx = numValor >= 0 ? 'entrada' : 'saida';
                        let parts = dataRaw.split('/');
                        let dataFormatada = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : new Date().toISOString().split('T')[0];

                        await addDoc(collection(db, "transacoes"), {
                            userId: currentUser.uid, tipo: tipoTx, propriedade: "Nosso",
                            descricao: `[BANCO] ${descRaw.substring(0, 20)}`,
                            valor: Math.abs(numValor), data: dataFormatada, categoria: "Outras"
                        });
                        importados++;
                    }
                }
                alert(`✅ ${importados} transações importadas!`);
                fileImportCsv.value = ''; 
            }
        });
    });
}

const btnExportCsv = document.getElementById('btn-export-csv');
if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
        if (transacoes.length === 0) return alert("Não há dados.");
        const csv = Papa.unparse(transacoes.map(t => ({ Data: t.data, Tipo: t.tipo.toUpperCase(), Quem: t.propriedade, Categoria: t.categoria, Descrição: t.descricao, Valor: t.valor.toFixed(2).replace('.', ',') })), { delimiter: ";" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' })); link.download = "meu_historico.csv";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    });
}

// IA Toggle
const aiToggle = document.getElementById('ai-toggle');
if (aiToggle) {
    aiToggle.addEventListener('click', () => document.getElementById('ai-body').classList.toggle('hidden'));
    document.getElementById('ai-send').addEventListener('click', () => {
        const input = document.getElementById('ai-input');
        if (!input.value) return;
        const msgBox = document.getElementById('ai-messages');
        msgBox.innerHTML += `<div class="ai-msg user">${input.value}</div>`;
        input.value = '';
        setTimeout(() => {
            msgBox.innerHTML += `<div class="ai-msg bot">Estou aprendendo a ler seus dados! Use a aba Ferramentas para importar relatórios completos.</div>`;
            msgBox.scrollTop = msgBox.scrollHeight;
        }, 800);
    });
}