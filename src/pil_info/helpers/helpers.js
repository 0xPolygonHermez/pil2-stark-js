module.exports.getExpDim = function getExpDim(expressions, expId, stark) {

    return _getExpDim(expressions[expId]);

    function _getExpDim(exp) {
        if(typeof(exp.dim) !== "undefined") {
            return exp.dim; 
        } else if(["add", "sub", "mul", "neg", "muladd"].includes(exp.op)) {
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

    if (exp.op == "exp") {
        if("next" in exp) {
            exp.rowOffset = exp.next ? 1 : 0;
            delete exp.next;
        }
        if (expressions[exp.id].expDeg) {
            exp.expDeg = expressions[exp.id].expDeg;
            exp.rowsOffsets = expressions[exp.id].rowsOffsets;
            exp.dim = expressions[exp.id].dim;
            if(!exp.stage) exp.stage = expressions[exp.id].stage;
        }
        if (!exp.expDeg) {
            addInfoExpressions(symbols, expressions, expressions[exp.id], stark);
            exp.expDeg = expressions[exp.id].expDeg;
            exp.rowsOffsets = expressions[exp.id].rowsOffsets || [0];
            exp.dim = expressions[exp.id].dim;
            if(!exp.stage) exp.stage = expressions[exp.id].stage;
        }
    } else if (["x", "cm", "const"].includes(exp.op) || (exp.op === "Zi" && exp.boundary !== "everyRow")) {
        exp.expDeg = 1;
        if(!exp.stage) exp.stage = exp.op === "cm" ? 1 : 0;
        if(!exp.dim) exp.dim = 1; 

        if("next" in exp) {
            exp.rowOffset = exp.next ? 1 : 0;
            delete exp.next;
        }

        if("rowOffset" in exp) {
            exp.rowsOffsets = [exp.rowOffset];
        }
    } else if (["challenge", "eval"].includes(exp.op)) {
        exp.dim = stark ? 3 : 1;
    } else if (["number", "public"].includes(exp.op) || (exp.op === "Zi" && exp.boundary === "everyRow")) {
        exp.expDeg = 0;
        exp.stage = 0; 
        if(!exp.dim) exp.dim = 1;
    } else if(exp.op == "neg") {
        addInfoExpressions(symbols, expressions, exp.values[0], stark);
        exp.expDeg = exp.values[0].expDeg;
        exp.stage = exp.values[0].stage;
        exp.rowsOffsets = exp.values[0].rowsOffsets || [0];
        exp.dim = exp.values[0].dim;
    } else if(["add", "sub", "mul"].includes(exp.op)) {
        addInfoExpressions(symbols, expressions, exp.values[0], stark);
        addInfoExpressions(symbols, expressions, exp.values[1], stark);
        const lhsDeg = exp.values[0].expDeg;
        const rhsDeg = exp.values[1].expDeg;
        exp.expDeg = exp.op === "mul" ? lhsDeg + rhsDeg : Math.max(lhsDeg, rhsDeg);
        exp.dim = Math.max(exp.values[0].dim, exp.values[1].dim);
        exp.stage = Math.max(exp.values[0].stage, exp.values[1].stage);
        const lhsRowOffsets = exp.values[0].rowsOffsets || [0];
        const rhsRowOffsets = exp.values[1].rowsOffsets || [0];
        exp.rowsOffsets = [...new Set([...lhsRowOffsets, ...rhsRowOffsets])];
    } else {
        throw new Error("Exp op not defined: "+ exp.op);
    }

    return;
}


