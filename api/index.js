import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { TabelaDePrecos, Vaga, Veiculo, Ticket, Operador, Pagamento } from '../src/models.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
let db;

async function conectar() {
    if (!db) {
        await client.connect();
        db = client.db('Estacionamento_DB');
    }
    return db;
}

// Estado em memória para as vagas (necessário para o projeto rodar sem salvar as vagas no banco)
const vagas = Array.from({ length: 5 }, (_, i) => new Vaga(i + 1));
const operadores = [new Operador('001', 'Admin', 'admin', '123')];

app.post('/api/login', (req, res) => {
    const { login, senha } = req.body;
    const op = operadores.find(o => o.autenticar(login, senha));
    if (op) res.json({ sucesso: true, nome: op.nome });
    else res.status(401).json({ erro: 'Credenciais inválidas' });
});

app.post('/api/entrada', async (req, res) => {
    try {
        const { placa, tipo } = req.body;
        const vagaLivre = vagas.find(v => !v.estaOcupada());
        if (!vagaLivre) return res.status(400).json({ erro: 'Estacionamento lotado' });
        
        const database = await conectar();
        let tabelaDoc = await database.collection('tabela_precos').findOne({ vigente: true });
        const tabela = tabelaDoc ? new TabelaDePrecos(tabelaDoc.valorHoraCarro, tabelaDoc.valorHoraMoto, tabelaDoc.toleranciaMinutos) : new TabelaDePrecos(10, 5, 15);
        
        const ticket = new Ticket(new Veiculo(placa, tipo), vagaLivre, tabela);
        
        await database.collection('tickets').insertOne({ 
            veiculo: ticket.veiculo, 
            vagaNumero: ticket.vaga.numero, 
            dataHoraEntrada: ticket.dataHoraEntrada, 
            dataHoraSaida: null, 
            status: 'Aberto', 
            valorCalculado: 0, 
            pagamento: null 
        });
        await database.collection('logs').insertOne({ acao: 'ENTRADA', placa, hora: new Date() });
        
        res.json({ sucesso: true, vaga: vagaLivre.numero });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/saida', async (req, res) => {
    try {
        const { placa, formaPagamento } = req.body;
        const database = await conectar();
        
        const ticketDoc = await database.collection('tickets').findOne({ 'veiculo.placa': placa, status: 'Aberto' });
        if (!ticketDoc) return res.status(400).json({ erro: 'Ticket não encontrado ou já fechado' });
        
        const vaga = vagas.find(v => v.numero === ticketDoc.vagaNumero);
        const tabela = new TabelaDePrecos(10, 5, 15); // Pode buscar do banco se preferir
        
        // A CORREÇÃO ESTÁ AQUI: Criamos o objeto sem chamar o construtor (que ocuparia a vaga novamente)
        const ticket = Object.create(Ticket.prototype);
        Object.assign(ticket, {
            veiculo: new Veiculo(ticketDoc.veiculo.placa, ticketDoc.veiculo.tipo),
            vaga: vaga,
            tabelaDePrecos: tabela,
            dataHoraEntrada: new Date(ticketDoc.dataHoraEntrada),
            dataHoraSaida: null,
            status: 'Aberto',
            pagamento: null
        });

        ticket.registrarSaida(); // Calcula o tempo e libera a vaga
        const pagamento = ticket.registrarPagamento(formaPagamento);

        await database.collection('tickets').updateOne(
            { _id: ticketDoc._id }, 
            { $set: { dataHoraSaida: ticket.dataHoraSaida, status: 'Pago', valorCalculado: pagamento.valorPago, pagamento: pagamento } }
        );

        await database.collection('logs').insertOne({ acao: 'SAIDA', placa, valor: pagamento.valorPago, hora: new Date() });
        
        res.json({ sucesso: true, comprovante: pagamento.emitirComprovante(ticket) });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ erro: e.message }); 
    }
});

app.get('/api/estado', async (req, res) => {
    try {
        const database = await conectar();
        const presentes = await database.collection('tickets').find({ status: 'Aberto' }).toArray();
        const historico = await database.collection('tickets').find({ status: 'Pago' }).sort({ dataHoraSaida: -1 }).limit(50).toArray();
        const logs = await database.collection('logs').find().sort({ hora: -1 }).limit(50).toArray();
        
        res.json({ vagasLivres: vagas.filter(v => !v.estaOcupada()).length, presentes, historico, logs });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ erro: e.message }); 
    }
});

app.put('/api/precos', async (req, res) => {
    try {
        const { valorHoraCarro, toleranciaMinutos } = req.body;
        const database = await conectar();
        await database.collection('tabela_precos').updateOne({ vigente: true }, { $set: { valorHoraCarro, toleranciaMinutos } }, { upsert: true });
        res.json({ sucesso: true });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ erro: e.message }); 
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
}

export default app;
