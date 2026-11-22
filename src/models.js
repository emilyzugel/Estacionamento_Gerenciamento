export class TabelaDePrecos {
    constructor(carro, moto, tol) { Object.assign(this, {valorHoraCarro: carro, valorHoraMoto: moto, toleranciaMinutos: tol}); }
    calcularValor(min, tipo) {
        if (min <= this.toleranciaMinutos) return 0.0;
        const h = Math.ceil((min - this.toleranciaMinutos) / 60);
        return h * (tipo === 'Moto' ? this.valorHoraMoto : this.valorHoraCarro);
    }
}

export class Vaga {
    constructor(num) { this.numero = num; this.ocupada = false; }
    ocupar() { if (this.ocupada) throw new Error("Vaga já ocupada"); this.ocupada = true; }
    liberar() { this.ocupada = false; }
    estaOcupada() { return this.ocupada; }
}

export class Veiculo { constructor(placa, tipo) { Object.assign(this, {placa, tipo}); } }

export class Pagamento {
    constructor(valor, forma) { this.valorPago = valor; this.formaPagamento = forma; this.dataHoraPagamento = new Date(); }
    emitirComprovante(t) { return `--- COMPROVANTE ---\nPlaca: ${t.veiculo.placa}\nVaga: ${t.vaga.numero}\nEntrada: ${t.dataHoraEntrada.toLocaleString()}\nSaída: ${t.dataHoraSaida.toLocaleString()}\nPermanência: ${t.calcularPermanencia()} min\nValor: R$ ${this.valorPago.toFixed(2)}\nForma: ${this.formaPagamento}`; }
}

export class Ticket {
    constructor(v, vaga, tab) {
        Object.assign(this, {veiculo: v, vaga, tabelaDePrecos: tab, dataHoraEntrada: new Date(), dataHoraSaida: null, status: 'Aberto', pagamento: null});
        vaga.ocupar();
    }
    registrarSaida() { this.dataHoraSaida = new Date(); this.status = 'Fechado'; this.vaga.liberar(); }
    calcularPermanencia() { return Math.floor(((this.dataHoraSaida || new Date()) - this.dataHoraEntrada) / 60000); }
    calcularValor() { return this.tabelaDePrecos.calcularValor(this.calcularPermanencia(), this.veiculo.tipo); }
    registrarPagamento(forma) { this.pagamento = new Pagamento(this.calcularValor(), forma); this.status = 'Pago'; return this.pagamento; }
}

export class Operador {
    constructor(matricula, nome, login, senha) { Object.assign(this, {matricula, nome, login, senha}); }
    autenticar(l, s) { return this.login === l && this.senha === s; }
}
