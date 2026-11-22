const $ = id => document.getElementById(id);
const API = '/api';

// ==========================================
// CLASSES DO SISTEMA (Mantidas para os testes)
// ==========================================
class Vaga {
    constructor(num) { this.numero = num; this.ocupada = false; }
    ocupar() { if (this.ocupada) throw new Error("Vaga já ocupada"); this.ocupada = true; }
    liberar() { this.ocupada = false; }
    estaOcupada() { return this.ocupada; }
}
class Veiculo { constructor(placa, tipo) { Object.assign(this, {placa, tipo}); } }
class TabelaDePrecos {
    constructor(carro, moto, tol) { Object.assign(this, {valorHoraCarro: carro, valorHoraMoto: moto, toleranciaMinutos: tol}); }
    calcularValor(min, tipo) {
        if (min <= this.toleranciaMinutos) return 0.0;
        const h = Math.ceil((min - this.toleranciaMinutos) / 60);
        return h * (tipo === 'Moto' ? this.valorHoraMoto : this.valorHoraCarro);
    }
}
class Ticket {
    constructor(v, vaga, tab) {
        Object.assign(this, {veiculo: v, vaga, tabelaDePrecos: tab, dataHoraEntrada: new Date(), dataHoraSaida: null, status: 'Aberto', pagamento: null});
        vaga.ocupar();
    }
    registrarSaida() { this.dataHoraSaida = new Date(); this.status = 'Fechado'; this.vaga.liberar(); }
    calcularPermanencia() { return Math.floor(((this.dataHoraSaida || new Date()) - this.dataHoraEntrada) / 60000); }
    calcularValor() { return this.tabelaDePrecos.calcularValor(this.calcularPermanencia(), this.veiculo.tipo); }
}

// ==========================================
// CONEXÃO COM A API (CRUD REAL)
// ==========================================

let pollingInterval = null;

async function fazerLogin() {
    const login = $('loginUser').value;
    const senha = $('loginPass').value;
    
    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, senha })
        });
        
        if (res.ok) {
            const data = await res.json();
            $('telaLogin').classList.add('hidden');
            $('sistema').classList.remove('hidden');
            $('nomeOperador').innerText = data.nome;
            $('msgLogin').innerText = "";
            
            atualizarEstado();
            // Polling a cada 3 segundos para simular tempo real
            pollingInterval = setInterval(atualizarEstado, 3000);
        } else {
            $('msgLogin').innerText = "Usuário ou senha incorretos.";
        }
    } catch (e) {
        $('msgLogin').innerText = "Erro ao conectar com o servidor.";
    }
}

function fazerLogout() {
    if (pollingInterval) clearInterval(pollingInterval);
    $('sistema').classList.add('hidden');
    $('telaLogin').classList.remove('hidden');
    $('loginUser').value = '';
    $('loginPass').value = '';
}

async function atualizarEstado() {
    try {
        const res = await fetch(`${API}/estado`);
        const data = await res.json();
        
        $('vagasLivres').innerText = data.vagasLivres;
        
        // Tabela de Presentes
        let htmlP = '<table><thead><tr><th>Placa</th><th>Vaga</th><th>Entrada</th></tr></thead><tbody>';
        data.presentes.forEach(t => {
            htmlP += `<tr><td>${t.veiculo.placa}</td><td>${t.vagaNumero}</td><td class="text-gray-400">${new Date(t.dataHoraEntrada).toLocaleTimeString()}</td></tr>`;
        });
        $('tabelaPresentes').innerHTML = data.presentes.length ? htmlP + '</tbody></table>' : '<p class="text-gray-500 text-sm">Nenhum veículo no pátio.</p>';
        
        // Log de Auditoria
        const logBox = $('logAuditoria');
        logBox.innerHTML = data.logs.map(l => `<div>[${new Date(l.hora).toLocaleTimeString()}] ${l.acao}: ${l.placa || ''} ${l.valor ? 'R$ ' + l.valor.toFixed(2) : ''}</div>`).join('');
        logBox.scrollTop = logBox.scrollHeight;
        
        atualizarHistorico(); // Atualiza o histórico também
    } catch (e) {
        console.error("Erro ao buscar estado:", e);
    }
}

async function operarEntrada() {
    const placa = $('inputPlaca').value.trim().toUpperCase();
    const tipo = $('inputTipo').value;
    const msg = $('msgEntrada');
    
    if (!placa) { msg.innerText = "Digite a placa."; msg.className = "text-xs mt-3 text-red-400"; return; }
    
    try {
        const res = await fetch(`${API}/entrada`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placa, tipo })
        });
        const data = await res.json();
        
        if (res.ok) {
            msg.innerText = `Entrada OK! Vaga: ${data.vaga}`;
            msg.className = "text-xs mt-3 text-green-400";
            $('inputPlaca').value = '';
            atualizarEstado();
        } else {
            msg.innerText = data.erro;
            msg.className = "text-xs mt-3 text-red-400";
        }
    } catch (e) {
        msg.innerText = "Erro de conexão.";
        msg.className = "text-xs mt-3 text-red-400";
    }
}

async function operarSaida() {
    const placa = $('inputPlacaSaida').value.trim().toUpperCase();
    const formaPagamento = $('inputPagamento').value;
    const msg = $('msgSaida');
    
    if (!placa) { msg.innerText = "Digite a placa."; msg.className = "text-xs mt-3 text-red-400"; return; }
    
    try {
        const res = await fetch(`${API}/saida`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placa, formaPagamento })
        });
        const data = await res.json();
        
        if (res.ok) {
            msg.innerHTML = `<span class="text-green-400 font-bold text-xs">Saída OK!</span><pre class="bg-black/30 p-3 mt-2 text-xs rounded-lg border border-white/5 whitespace-pre-wrap text-gray-300">${data.comprovante}</pre>`;
            $('inputPlacaSaida').value = '';
            atualizarEstado();
        } else {
            msg.innerText = data.erro;
            msg.className = "text-xs mt-3 text-red-400";
        }
    } catch (e) {
        msg.innerText = "Erro de conexão.";
        msg.className = "text-xs mt-3 text-red-400";
    }
}

async function atualizarHistorico() {
    try {
        const res = await fetch(`${API}/estado`);
        const data = await res.json();
        
        const placa = $('buscaHistoricoPlaca').value.trim().toUpperCase();
        const dIni = $('buscaDataInicio').value;
        const dFim = $('buscaDataFim').value;

        const fechados = data.historico.filter(t => {
            if (placa && !t.veiculo.placa.includes(placa)) return false;
            const dataSaida = new Date(t.dataHoraSaida);
            if (dIni && dataSaida < new Date(dIni + 'T00:00:00')) return false;
            if (dFim && dataSaida > new Date(dFim + 'T23:59:59')) return false;
            return true;
        });

        let html = '<table><thead><tr><th>Placa</th><th>Saída</th><th>Valor</th></tr></thead><tbody>';
        fechados.forEach(t => {
            html += `<tr><td>${t.veiculo.placa}</td><td class="text-gray-400">${new Date(t.dataHoraSaida).toLocaleString()}</td><td class="accent">R$ ${t.valorCalculado.toFixed(2)}</td></tr>`;
        });
        $('tabelaHistorico').innerHTML = fechados.length ? html + '</tbody></table>' : '<p class="text-gray-500 text-sm">Nenhum registro encontrado.</p>';
    } catch (e) {
        console.error("Erro ao buscar histórico:", e);
    }
}

async function atualizarPrecos() {
    const valorHoraCarro = parseFloat($('precoCarro').value);
    const toleranciaMinutos = parseInt($('precoTolerancia').value);
    const msg = $('msgPreco');
    
    try {
        const res = await fetch(`${API}/precos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valorHoraCarro, toleranciaMinutos })
        });
        
        if (res.ok) {
            msg.innerText = "Tabela atualizada!";
            msg.className = "text-xs mt-3 text-green-400";
            atualizarEstado();
        }
    } catch (e) {
        msg.innerText = "Erro de conexão.";
        msg.className = "text-xs mt-3 text-red-400";
    }
}

// ==========================================
// TESTES DE UNIDADE (Rodam no Frontend)
// ==========================================
function expect(a) {
    return {
        toBe: e => { if (a !== e) throw new Error(`Esperava ${e}, recebeu ${a}`); },
        toBeCloseTo: (e, p) => { if (Math.abs(a - e) >= Math.pow(10, -p) / 2) throw new Error(`Esperava ~${e}, recebeu ${a}`); },
        toThrow: m => {
            let threw = false;
            try { a(); } catch (err) { threw = true; if (m && err.message !== m) throw new Error(`Esperava erro "${m}", recebeu "${err.message}"`); }
            if (!threw) throw new Error("Esperava exceção, não houve.");
        }
    };
}

const testes = [
    { n: "Cálculo de permanência em minutos", f: () => { const t = new Ticket(new Veiculo('A', 'C'), new Vaga(1), new TabelaDePrecos(10, 5, 15)); t.dataHoraEntrada = new Date('2024-05-01T08:00:00'); t.dataHoraSaida = new Date('2024-05-01T10:30:00'); expect(t.calcularPermanencia()).toBe(150); } },
    { n: "Cálculo de valor dentro da tolerância", f: () => { const t = new Ticket(new Veiculo('A', 'C'), new Vaga(1), new TabelaDePrecos(10, 5, 15)); t.dataHoraEntrada = new Date('2024-05-01T08:00:00'); t.dataHoraSaida = new Date('2024-05-01T08:10:00'); expect(t.calcularValor()).toBeCloseTo(0, 2); } },
    { n: "Cálculo de valor por hora cheia", f: () => { const t = new Ticket(new Veiculo('A', 'C'), new Vaga(1), new TabelaDePrecos(10, 5, 15)); t.dataHoraEntrada = new Date('2024-05-01T08:00:00'); t.dataHoraSaida = new Date('2024-05-01T10:00:00'); expect(t.calcularValor()).toBeCloseTo(20, 2); } },
    { n: "Ocupação de vaga já ocupada", f: () => { const v = new Vaga(1); v.ocupar(); expect(() => v.ocupar()).toThrow("Vaga já ocupada"); } },
    { n: "Liberação de vaga", f: () => { const v = new Vaga(1); v.ocupar(); v.liberar(); expect(v.estaOcupada()).toBe(false); } }
];

function rodarTestes() {
    const lista = $('resultadosTestes');
    lista.innerHTML = '';
    let p = 0;
    testes.forEach(t => {
        const li = document.createElement('li');
        try { t.f(); li.innerHTML = `<span class="text-green-400 font-bold">✔</span> <span class="text-gray-300">${t.n}</span>`; p++; }
        catch (e) { li.innerHTML = `<span class="text-red-400 font-bold">✘</span> <span class="text-gray-300">${t.n}</span><br><small class="text-gray-500">${e.message}</small>`; }
        lista.appendChild(li);
    });
    const res = document.createElement('p');
    res.className = "mt-4 text-xs font-semibold accent";
    res.innerHTML = `Resultado: ${p}/${testes.length} testes passaram.`;
    lista.appendChild(res);
}
