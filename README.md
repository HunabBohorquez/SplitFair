# 💸 SplitFair - Liquidador Inteligente de Gastos Grupales

> **Enlaces del proyecto**

**Link:** `https://hunabbohorquez.github.io/SplitFair/`

**Repositorio en GitHub:** `https://github.com/HunabBohorquez/SplitFair`

> 📝 **Nota:** este proyecto tiene los **mismos archivos** que el repositorio de GitLab
> (`index.html`, `styles.css`, `app.js`, `README.md`). Solo cambia la plataforma de alojamiento.

---

SplitFair es una aplicación web *Vanilla* diseñada para resolver uno de los problemas más comunes en viajes y salidas grupales: la división justa y matemática de los gastos cruzados, minimizando la cantidad de transferencias que el grupo debe realizar.

## 🚀 Cómo ejecutar
1. Guarda los 4 archivos (`index.html`, `styles.css`, `app.js`, `README.md`) en una misma carpeta.
2. Abre `index.html` en cualquier navegador web moderno (Chrome, Firefox, Safari, Edge).
3. No requiere servidor local, librerías, Node.js ni conexión a internet para funcionar.

## 🧠 Algoritmo de Simplificación de Deudas (Greedy)
Para evitar que "Todos le paguen a todos" generando caos, el módulo `DebtSimplifier` implementa una estrategia Greedy sobre un grafo de flujo dirigido:
1. **Consolidación en Centavos**: Todos los montos se multiplican por 100 y se operan como enteros para evitar los clásicos errores de coma flotante de JS (ej. `0.1 + 0.2 = 0.30000000000000004`).
2. **Balance Neto**: Por cada usuario se calcula: `Balance = Total Pagado - Total Consumido`.
   - Balance Positivo (> 0): Es Acreedor (le deben dinero).
   - Balance Negativo (< 0): Es Deudor (debe dinero).
3. **Emparejamiento Greedy**: 
   - Se ordenan los Deudores de mayor a menor deuda.
   - Se ordenan los Acreedores de mayor a menor crédito.
   - Iterativamente, el mayor Deudor le paga al mayor Acreedor el monto mínimo entre su deuda y el crédito del otro, eliminando la obligación de al menos uno de los dos en cada ciclo y logrando resolver la matriz en un máximo de `N-1` transacciones.

## 🧪 Pruebas Verificables (Escenario Demo)
Al hacer clic en **"Cargar Escenario Demo"**, se aplican los siguientes gastos:
- **Ana** paga Gasolina ($100) - Dividido equitativamente entre los 5.
- **Beto** paga Cena ($250) - Porcentajes (Ana 10%, Beto 40%, Carlos 20%, Diana 15%, Elena 15%).
- **Carlos** paga Entradas ($80) - Montos exactos (Carlos $40, Diana $40).
- **Diana** paga Bebidas ($120) - Equitativo solo entre Ana, Beto y Diana.
- **Elena** paga Hospedaje ($300) - Porcentajes (20% todos).
- **Ana** paga Snacks ($50) - Montos exactos (Carlos $25, Elena $25).

**Resultados Matemáticos Esperados:**
*Balances Netos (Suma total obligatoria $0.00):*
- Ana: +$5.00
- Beto: +$30.00
- Carlos: -$115.00
- Diana: -$77.50
- Elena: +$157.50

*Transferencias Simplificadas Resultantes:*
1. Carlos paga $115.00 a Elena
2. Diana paga $42.50 a Elena
3. Diana paga $30.00 a Beto
4. Diana paga $5.00 a Ana

*(4 transferencias en lugar de las 11 cruzadas que existirían originalmente).*
