module.exports.getExpDim = function getExpDim(expressions, expId, stark) {

    return _getExpDim(expressions[expId]);

    function _getExpDim(exp) {
        if(typeof(exp.dim) !== "undefined") {
            return exp.dim; 
        } else if(["add", "sub", "mul", "muladd"].includes(exp.op)) {
            return Math.max(...exp.values.map(v => _getExpDim(v)));
        } else if (exp.op === "exp") {
            exp.dim = _getExpDim(expressions[exp.id]);
            return exp.dim;
        } else if (exp.op === "cm") {
            return exp.dim || 1;
        } else if (["const", "number", "public", "x", "Zi"].includes(exp.op)) {
            return 1;
        } else if (["challenge", "eval", "xDivXSubXi"].includes(exp.op)) {
            return stark ? 3 : 1;
        } else throw new Error("Exp op not defined: " + exp.op);
    }
}

module.exports.addInfoExpressions = function addInfoExpressions(symbols, expressions, exp, stark) {
    if("expDeg" in exp) return;

    if("next" in exp) {
        exp.rowOffset = exp.next ? 1 : 0;
        delete exp.next;
    }

    if (exp.op == "exp") {
        addInfoExpressions(symbols, expressions, expressions[exp.id], stark);
            
        exp.expDeg = expressions[exp.id].expDeg;
        exp.rowsOffsets = expressions[exp.id].rowsOffsets;
        exp.symbols = expressions[exp.id].symbols;
        if(!exp.dim) exp.dim = expressions[exp.id].dim;
        if(!exp.stage) exp.stage = expressions[exp.id].stage;

        if(["cm", "const"].includes(expressions[exp.id].op)) {
            exp = expressions[exp.id];
        }
    } else if (["x", "cm", "const"].includes(exp.op) || (exp.op === "Zi" && exp.boundary !== "everyRow")) {
        exp.expDeg = 1;
        if(!exp.stage) exp.stage = exp.op === "cm" ? 1 : 0;
        if(!exp.dim) exp.dim = 1; 

        if("rowOffset" in exp) {
            exp.rowsOffsets = [exp.rowOffset];
        }

        if(!exp.symbols) {
            if(exp.op === "const") exp.symbols = [];
            if(exp.op === "cm") exp.symbols = [{op: "cm", stage: exp.stage, stageId: exp.stageId}];
        }
    } else if (["challenge", "eval", "subproofValue"].includes(exp.op)) {
        exp.expDeg = 0;
        exp.dim = stark ? 3 : 1;
    } else if (["number", "public"].includes(exp.op) || (exp.op === "Zi" && exp.boundary === "everyRow")) {
        exp.expDeg = 0;
        exp.stage = 0; 
        if(!exp.dim) exp.dim = 1;
    } else if(["add", "sub", "mul"].includes(exp.op)) {
        if(exp.op === "neg") {
            exp.op = "mul";
            exp.values = [{op: "number", value: "-1", expDeg: 0, stage: 0, dim: 1}, exp.values[0]];
        }
        const lhsValue = exp.values[0];
        const rhsValue = exp.values[1];
        if(["add"].includes(exp.op) && lhsValue.op === "number" && BigInt(lhsValue.value) === 0n) {
            exp.op = "mul";
            lhsValue.value = "1";
        }
        if(["add", "sub"].includes(exp.op) && rhsValue.op === "number" && BigInt(rhsValue.value) === 0n) {
            exp.op = "mul";
            rhsValue.value = "1";
        }
        addInfoExpressions(symbols, expressions, lhsValue, stark);
        addInfoExpressions(symbols, expressions, rhsValue, stark);

        const lhsDeg = lhsValue.expDeg;
        const rhsDeg = rhsValue.expDeg;
        exp.expDeg = exp.op === "mul" ? lhsDeg + rhsDeg : Math.max(lhsDeg, rhsDeg);

        exp.dim = Math.max(lhsValue.dim,rhsValue.dim);
        exp.stage = Math.max(lhsValue.stage,rhsValue.stage);

        const lhsRowOffsets = lhsValue.rowsOffsets || [0];
        const rhsRowOffsets = rhsValue.rowsOffsets || [0];
        exp.rowsOffsets = [...new Set([...lhsRowOffsets, ...rhsRowOffsets])];

        let lhsSymbols = [];
        if(["cm", "challenge"].includes(lhsValue.op)) {
            lhsSymbols.push({op: lhsValue.op, stage: lhsValue.stage, stageId: lhsValue.stageId});
        } else if(["public", "subproofValue"].includes(lhsValue.op)) {
            lhsSymbols.push({op: lhsValue.op, stage: lhsValue.stage, id: rhsValue.id});
        } else if(lhsValue.symbols) {
            lhsSymbols.push(...lhsValue.symbols);
        }

        let rhsSymbols = [];
        if(["cm", "challenge"].includes(rhsValue.op)) {
            rhsSymbols.push({op: rhsValue.op, stage: rhsValue.stage, stageId: rhsValue.stageId});
        } else if(["public", "subproofValue"].includes(rhsValue.op)) {
            rhsSymbols.push({op: rhsValue.op, stage: rhsValue.stage, id: rhsValue.id});
        } else if(rhsValue.symbols) {
            rhsSymbols.push(...rhsValue.symbols);
        }

        const uniqueSymbolsSet = new Set();

        [...lhsSymbols, ...rhsSymbols].forEach((symbol) => { uniqueSymbolsSet.add(JSON.stringify(symbol)); });
          
        exp.symbols = Array.from(uniqueSymbolsSet).map((symbol) => JSON.parse(symbol))
            .sort((a, b) => a.stage !== b.stage ? a.stage - b.stage : a.op !== b.op ? b.op.localeCompare(a.op) : a.stageId - b.stageId);
    } else {
        throw new Error("Exp op not defined: "+ exp.op);
    }

    return;
}
