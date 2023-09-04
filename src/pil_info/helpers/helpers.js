module.exports.getExpDim = function getExpDim(expressions, expId, stark) {

    return _getExpDim(expressions[expId]);

    function _getExpDim(exp) {
        if(typeof(exp.dim) !== "undefined") return exp.dim; 
        switch (exp.op) {
            case "add":
            case "sub":
            case "mul":
                return Math.max(...[_getExpDim(exp.values[0]), _getExpDim(exp.values[1])]);
            case "neg":
                return _getExpDim(exp.values[0]);
            case "muladd":
                return Math.max(...[_getExpDim(exp.values[0]), _getExpDim(exp.values[1]), _getExpDim(exp.values[2])]);
            case "cm": return exp.dim || 1;
            case "exp":
                exp.dim = _getExpDim(expressions[exp.id]);
                return exp.dim;
            case "const":
            case "number":
            case "public": 
            case "x": 
            case "Zi":
                return 1;
            case "challenge":
            case "eval":
                return stark ? 3 : 1;
            case "xDivXSubXi":
                if(stark) return 3;
                throw new Error("Exp op not defined: " + exp.op);
            default: throw new Error("Exp op not defined: " + exp.op);
        }
    }
}

module.exports.addInfoExpressions = function addInfoExpressions(expressions, exp, stark) {
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
            addInfoExpressions(expressions, expressions[exp.id]);
            exp.expDeg = expressions[exp.id].expDeg;
            exp.rowsOffsets = expressions[exp.id].rowsOffsets || [0];
            exp.dim = expressions[exp.id].dim;
            if(!exp.stage) exp.stage = expressions[exp.id].stage;
        }
    } else if (["x", "cm", "const"].includes(exp.op) || (exp.op === "Zi" && exp.boundary !== "everyRow")) {
        exp.expDeg = 1;
        if(exp.op !== "cm") {
            exp.stage = 0; 
        } else if(!exp.stage) {
            exp.stage = 1;
        }
        if("next" in exp) {
            exp.rowOffset = exp.next ? 1 : 0;
            delete exp.next;
        }

        if(!exp.dim) { exp.dim = 1; } 

        if("rowOffset" in exp) {
            exp.rowsOffsets = [exp.rowOffset];
        }
    } else if (["number", "challenge", "public", "eval"].includes(exp.op) || (exp.op === "Zi" && exp.boundary === "everyRow")) {
        exp.expDeg = 0;
        if(exp.op !== "challenge") exp.stage = 0; 
        if(!exp.dim) {
            if(["number", "public", "Zi"].includes(exp.op)) {
                exp.dim = 1;
            } else {
                exp.dim = stark ? 3 : 1;
            }
        }
    } else if(exp.op == "neg") {
        addInfoExpressions(expressions, exp.values[0]);
        exp.expDeg = exp.values[0].expDeg;
        exp.stage = exp.values[0].stage;
        exp.rowsOffsets = exp.values[0].rowsOffsets || [0];
        exp.dim = exp.values[0].dim;
    } else if(["add", "sub", "mul"].includes(exp.op)) {
        addInfoExpressions(expressions, exp.values[0]);
        addInfoExpressions(expressions, exp.values[1]);
        const lhsDeg = exp.values[0].expDeg;
        const rhsDeg = exp.values[1].expDeg;
        if(exp.op === "mul") {
            exp.expDeg = lhsDeg + rhsDeg;
        } else {
            exp.expDeg = Math.max(lhsDeg, rhsDeg);
        }
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


