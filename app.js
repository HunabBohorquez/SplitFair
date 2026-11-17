// app.js

/**
 * MÓDULO 1: GroupStore - Manejo del Estado y Persistencia
 */
class GroupStore {
    constructor() {
        this.participants = [];
        this.expenses = [];
        this.load();
    }

    save() {
        localStorage.setItem('splitfair_participants', JSON.stringify(this.participants));
        localStorage.setItem('splitfair_expenses', JSON.stringify(this.expenses));
    }

    load() {
        this.participants = JSON.parse(localStorage.getItem('splitfair_participants')) || [];
        this.expenses = JSON.parse(localStorage.getItem('splitfair_expenses')) || [];
    }

    addParticipant(name) {
        const trimmed = name.trim();
        if (!trimmed || this.participants.includes(trimmed)) return false;
        this.participants.push(trimmed);
        this.save();
        return true;
    }

    removeParticipant(name) {
        const hasExpenses = this.expenses.some(e => e.payer === name || name in e.splits);
        if (hasExpenses) throw new Error("No puedes eliminar un participante con gastos asociados.");
        this.participants = this.participants.filter(p => p !== name);
        this.save();
    }

    addExpense(expenseData) {
        this.expenses.push({ id: Date.now().toString(), ...expenseData });
        this.save();
    }

    removeExpense(id) {
        this.expenses = this.expenses.filter(e => e.id !== id);
        this.save();
    }

    clearAll() {
        this.participants = [];
        this.expenses = [];
        this.save();
    }
}

/**
 * MÓDULO 2: ExpenseValidator - Lógica de Validación y Distribución
 */
class ExpenseValidator {
    static validate(amount, payer, splitType, splitData) {
        if (amount <= 0) throw new Error("El monto debe ser mayor a 0.");
        
        let splits = {};
        const totalCents = Math.round(amount * 100);
        
        if (splitType === 'equal') {
            const selected = Object.keys(splitData).filter(p => splitData[p] === true);
            if (selected.length === 0) throw new Error("Selecciona al menos un participante.");
            
            const baseShare = Math.floor(totalCents / selected.length);
            let remainder = totalCents % selected.length;
            
            selected.forEach(p => {
                let share = baseShare;
                if (remainder > 0) { share += 1; remainder -= 1; }
                splits[p] = share;
            });
        } 
        else if (splitType === 'percentage') {
            let sumPct = 0;
            let sumCents = 0;
            const participants = Object.keys(splitData);
            
            participants.forEach(p => {
                const pct = parseFloat(splitData[p]) || 0;
                sumPct += pct;
                const shareCents = Math.round((pct / 100) * totalCents);
                splits[p] = shareCents;
                sumCents += shareCents;
            });
            
            if (Math.abs(sumPct - 100) > 0.01) throw new Error("Los porcentajes deben sumar exactamente 100%.");
            
            // Ajustar el residuo por redondeo al primer participante con participación
            const diff = totalCents - sumCents;
            if (diff !== 0 && participants.length > 0) splits[participants[0]] += diff;
        }
        else if (splitType === 'exact') {
            let sumExact = 0;
            Object.keys(splitData).forEach(p => {
                const exactVal = Math.round((parseFloat(splitData[p]) || 0) * 100);
                splits[p] = exactVal;
                sumExact += exactVal;
            });
            if (sumExact !== totalCents) throw new Error("La suma de montos exactos debe coincidir con el total del gasto.");
        }
        
        return splits; // Retorna siempre en centavos
    }
}

/**
 * MÓDULO 3: DebtSimplifier - Motor Algorítmico (Greedy)
 */
class DebtSimplifier {
    static calculateBalances(store) {
        const balances = {}; // En centavos
        const paid = {};
        const consumed = {};

        store.participants.forEach(p => {
            balances[p] = 0; paid[p] = 0; consumed[p] = 0;
        });

        store.expenses.forEach(exp => {
            const totalCents = Math.round(exp.amount * 100);
            if (paid[exp.payer] !== undefined) paid[exp.payer] += totalCents;
            if (balances[exp.payer] !== undefined) balances[exp.payer] += totalCents;
            
            Object.keys(exp.splits).forEach(p => {
                if (consumed[p] !== undefined) consumed[p] += exp.splits[p];
                if (balances[p] !== undefined) balances[p] -= exp.splits[p];
            });
        });

        // Verificación de integridad matemática ($0 de suma cero)
        const netSum = Object.values(balances).reduce((acc, v) => acc + v, 0);
        if (Math.abs(netSum) > 1) console.warn("Inconsistencia en balances:", netSum);

        return { balances, paid, consumed };
    }

    static calculateSettlements(balancesInCents) {
        const debtors = [];
        const creditors = [];

        Object.keys(balancesInCents).forEach(p => {
            const b = balancesInCents[p];
            if (b < 0) debtors.push({ name: p, amount: -b });
            else if (b > 0) creditors.push({ name: p, amount: b });
        });

        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        const settlements = [];
        let i = 0, j = 0;

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            
            const amount = Math.min(debtor.amount, creditor.amount);
            
            settlements.push({
                from: debtor.name,
                to: creditor.name,
                amount: amount / 100 // Convertir a dólares para mostrar
            });

            debtor.amount -= amount;
            creditor.amount -= amount;

            if (debtor.amount === 0) i++;
            if (creditor.amount === 0) j++;
        }

        return settlements;
    }
}

/**
 * MÓDULO 4: UIManager - Interfaz y Eventos
 */
class UIManager {
    constructor(store) {
        this.store = store;
        this.formatCurrency = (num) => `$${num.toFixed(2)}`;
        this.cacheDOM();
        this.bindEvents();
        this.renderAll();
    }

    cacheDOM() {
        this.formPart = document.getElementById('form-participant');
        this.inputPart = document.getElementById('input-participant');
        this.listPart = document.getElementById('list-participants');
        this.selectPayer = document.getElementById('exp-payer');
        
        this.formExp = document.getElementById('form-expense');
        this.splitContainer = document.getElementById('split-container');
        this.splitType = document.getElementById('exp-split-type');
        
        this.tbodyBalances = document.getElementById('tbody-balances');
        this.settlementsContainer = document.getElementById('settlements-container');
        this.listExpenses = document.getElementById('list-expenses');
    }

    bindEvents() {
        this.formPart.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.store.addParticipant(this.inputPart.value)) {
                this.inputPart.value = '';
                this.renderAll();
            }
        });

        this.splitType.addEventListener('change', () => this.renderSplitFields());
        
        this.formExp.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleExpenseSubmit();
        });

        document.getElementById('btn-load-demo').addEventListener('click', () => this.loadDemo());
        document.getElementById('btn-clear-data').addEventListener('click', () => {
            if(confirm("¿Eliminar todos los datos?")) { this.store.clearAll(); this.renderAll(); }
        });
        document.getElementById('btn-copy-summary').addEventListener('click', () => this.copySummary());
    }

    renderSplitFields() {
        const type = this.splitType.value;
        this.splitContainer.innerHTML = '';
        if (this.store.participants.length === 0) {
            this.splitContainer.innerHTML = '<p class="text-muted">Agrega participantes primero.</p>';
            return;
        }

        this.store.participants.forEach(p => {
            const row = document.createElement('div');
            row.className = 'split-row';
            
            const label = document.createElement('label');
            label.textContent = p;
            row.appendChild(label);

            if (type === 'equal') {
                const cb = document.createElement('input');
                cb.type = 'checkbox'; cb.checked = true; cb.dataset.name = p;
                row.appendChild(cb);
            } else {
                const num = document.createElement('input');
                num.type = 'number'; num.step = '0.01'; num.min = '0';
                num.dataset.name = p; num.placeholder = type === 'percentage' ? '0 %' : '$ 0.00';
                row.appendChild(num);
            }
            this.splitContainer.appendChild(row);
        });
    }

    handleExpenseSubmit() {
        if (this.store.participants.length === 0) return alert("Faltan participantes.");
        
        const desc = document.getElementById('exp-desc').value;
        const amount = parseFloat(document.getElementById('exp-amount').value);
        const payer = this.selectPayer.value;
        const type = this.splitType.value;
        
        const splitData = {};
        Array.from(this.splitContainer.querySelectorAll('input')).forEach(input => {
            splitData[input.dataset.name] = type === 'equal' ? input.checked : parseFloat(input.value) || 0;
        });

        try {
            const splits = ExpenseValidator.validate(amount, payer, type, splitData);
            this.store.addExpense({ description: desc, amount, payer, splitType: type, splits });
            this.formExp.reset();
            this.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    renderAll() {
        this.renderParticipants();
        this.renderExpenses();
        this.renderAnalysis();
        this.renderSplitFields(); // Actualizar selector de partición si cambian participantes
    }

    renderParticipants() {
        this.listPart.innerHTML = '';
        this.selectPayer.innerHTML = '';
        this.store.participants.forEach(p => {
            // Lista
            const li = document.createElement('li');
            li.textContent = p;
            const btnDel = document.createElement('button');
            btnDel.className = 'btn btn-danger btn-small'; btnDel.textContent = 'X';
            btnDel.onclick = () => {
                try { this.store.removeParticipant(p); this.renderAll(); } 
                catch(e) { alert(e.message); }
            };
            li.appendChild(btnDel);
            this.listPart.appendChild(li);

            // Select
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            this.selectPayer.appendChild(opt);
        });
    }

    renderExpenses() {
        this.listExpenses.innerHTML = '';
        this.store.expenses.forEach(e => {
            const li = document.createElement('li');
            li.innerHTML = `<div><strong>${e.description}</strong> (${this.formatCurrency(e.amount)})<br>
                            <small class="text-muted">Pagó: ${e.payer}</small></div>`;
            const btnDel = document.createElement('button');
            btnDel.className = 'btn btn-danger btn-small'; btnDel.textContent = 'Borrar';
            btnDel.onclick = () => { this.store.removeExpense(e.id); this.renderAll(); };
            li.appendChild(btnDel);
            this.listExpenses.appendChild(li);
        });
    }

    renderAnalysis() {
        const { balances, paid, consumed } = DebtSimplifier.calculateBalances(this.store);
        const settlements = DebtSimplifier.calculateSettlements(balances);

        // Render Tabla Balances
        this.tbodyBalances.innerHTML = '';
        this.store.participants.forEach(p => {
            const tr = document.createElement('tr');
            const balDol = balances[p] / 100;
            let statusClass = 'text-muted';
            if (balDol > 0) statusClass = 'text-success';
            if (balDol < 0) statusClass = 'text-danger';

            tr.innerHTML = `
                <td>${p}</td>
                <td>${this.formatCurrency(paid[p] / 100)}</td>
                <td>${this.formatCurrency(consumed[p] / 100)}</td>
                <td class="${statusClass}">${balDol > 0 ? '+' : ''}${this.formatCurrency(balDol)}</td>
            `;
            this.tbodyBalances.appendChild(tr);
        });

        // Render Transferencias
        this.settlementsContainer.innerHTML = '';
        if (settlements.length === 0) {
            this.settlementsContainer.innerHTML = '<p class="text-muted">Todo está saldado. ¡Cero deudas! 🎉</p>';
        } else {
            settlements.forEach(s => {
                const div = document.createElement('div');
                div.className = 'settlement-card';
                div.innerHTML = `<span><strong>${s.from}</strong> paga a <strong>${s.to}</strong></span>
                                 <span class="settlement-amount">${this.formatCurrency(s.amount)}</span>`;
                this.settlementsContainer.appendChild(div);
            });
        }
        
        // Guardar raw para el portapapeles
        this.currentSettlements = settlements; 
    }

    copySummary() {
        if (!this.currentSettlements || this.currentSettlements.length === 0) return alert("No hay deudas que copiar.");
        let text = "💸 *Resumen SplitFair*\n\n";
        this.currentSettlements.forEach(s => {
            text += `🔹 ${s.from} debe pagar ${this.formatCurrency(s.amount)} a ${s.to}\n`;
        });
        navigator.clipboard.writeText(text).then(() => alert("¡Resumen copiado al portapapeles!"));
    }

    loadDemo() {
        this.store.clearAll();
        const demoParts = ["Ana", "Beto", "Carlos", "Diana", "Elena"];
        demoParts.forEach(p => this.store.addParticipant(p));
        
        const demoExp = [
            { desc: "Gasolina", amt: 100, payer: "Ana", type: "equal", 
              splits: {Ana: true, Beto: true, Carlos: true, Diana: true, Elena: true} },
            { desc: "Cena", amt: 250, payer: "Beto", type: "percentage", 
              splits: {Ana: 10, Beto: 40, Carlos: 20, Diana: 15, Elena: 15} },
            { desc: "Entradas", amt: 80, payer: "Carlos", type: "exact", 
              splits: {Ana: 0, Beto: 0, Carlos: 40, Diana: 40, Elena: 0} },
            { desc: "Bebidas", amt: 120, payer: "Diana", type: "equal", 
              splits: {Ana: true, Beto: true, Carlos: false, Diana: true, Elena: false} },
            { desc: "Hospedaje", amt: 300, payer: "Elena", type: "percentage", 
              splits: {Ana: 20, Beto: 20, Carlos: 20, Diana: 20, Elena: 20} },
            { desc: "Snacks", amt: 50, payer: "Ana", type: "exact", 
              splits: {Ana: 0, Beto: 0, Carlos: 25, Diana: 0, Elena: 25} }
        ];

        demoExp.forEach(e => {
            const splits = ExpenseValidator.validate(e.amt, e.payer, e.type, e.splits);
            this.store.addExpense({ description: e.desc, amount: e.amt, payer: e.payer, splitType: e.type, splits });
        });
        
        this.renderAll();
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    const store = new GroupStore();
    new UIManager(store);
});
