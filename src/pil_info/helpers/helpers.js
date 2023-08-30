module.exports.getExpDim = function getExpDim(res, expressions, expId, stark) {

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
            case "cm": return res.cmPolsMap[exp.id].dim;
            case "exp":
                exp.dim = _getExpDim(expressions[exp.id]);
                return exp.dim;
            case "const":
            case "number":
            case "public": 
            case "x": 
                return 1;
            case "challenge":
            case "eval":
                return stark ? 3 : 1;
            case "Zi":    
                return stark && res.nLibStages !== 0 || Object.keys(res.imPolsMap).length > 0 ? 3 : 1;
            case "xDivXSubXi":
                if(stark) return 3;
                throw new Error("Exp op not defined: " + exp.op);
            default: throw new Error("Exp op not defined: " + exp.op);
        }
    }
}

module.exports.setDimensions = function setDimensions(res, stark) {
    for (let i=0; i<res.nPublics; i++) {
        setCodeDimensions(res.publicsCode[i], res, stark);
    }
    
    for(let i = 0; i < Object.keys(res.code).length; ++i) {
        const name = Object.keys(res.code)[i];
        setCodeDimensions(res.code[name], res, stark);
    }
}

function setCodeDimensions(code, pilInfo, stark) {
    const tmpDim = [];

    _setCodeDimensions(code.code);

    function _setCodeDimensions(code) {
        for (let i=0; i<code.length; i++) {
            let newDim;
            switch (code[i].op) {
                case 'add': newDim = Math.max(getDim(code[i].src[0]), getDim(code[i].src[1])); break;
                case 'sub': newDim = Math.max(getDim(code[i].src[0]), getDim(code[i].src[1])); break;
                case 'mul': newDim = Math.max(getDim(code[i].src[0]), getDim(code[i].src[1])); break;
                case 'muladd': newDim = Math.max(getDim(code[i].src[0]), getDim(code[i].src[1]), getDim(code[i].src[2])); break;
                case 'copy': newDim = getDim(code[i].src[0]); break;
                default: throw new Error("Invalid op:"+ code[i].op);
            }
            setDim(code[i].dest, newDim);
        }


        function getDim(r) {
            
            if (r.type.startsWith("tree") && stark) {
                return r.dim;
            }

            switch (r.type) {
                case "tmp": r.dim = tmpDim[r.id]; break;
                case "tmpExp": break;
                case "cm": r.dim = pilInfo.cmPolsMap[r.id].dim; break;
                case "const": 
                case "number": 
                case "public": 
                    r.dim = 1; break;
                case "Zi":
                    r.dim = stark && pilInfo.nLibStages !== 0 || Object.keys(pilInfo.imPolsMap).length > 0 ? 3 : 1;
                    break;
                case "eval": 
                case "challenge": 
                case "xDivXSubXi": 
                case "x": 
                    r.dim= stark ? 3 : 1; break;
                default: throw new Error("Invalid reference type: " + r.type);
            }
            return r.dim;
        }

        function setDim(r, dim) {
            switch (r.type) {
                case "tmp": tmpDim[r.id] = dim; r.dim=dim; return;
                case "exp":
                case "cm":
                case "tmpExp":
                case "q": 
                    r.dim=dim; return;
                case "f": 
                    if(!stark) throw new Error("Invalid reference type set: " + r.type);
                    r.dim=dim; return;
                default: throw new Error("Invalid reference type set: " + r.type);
            }
        }
    }
}

module.exports.addInfoExpressions = function addInfoExpressions(expressions, exp) {
    if(exp.expDeg) return;

    if (exp.op == "exp") {
        if("next" in exp) {
            exp.rowOffset = exp.next ? 1 : 0;
            delete exp.next;
        }
        if (expressions[exp.id].expDeg) {
            exp.expDeg = expressions[exp.id].expDeg;
            exp.stage = expressions[exp.id].stage;
            exp.rowsOffsets = expressions[exp.id].rowsOffsets;
        }
        if (!exp.expDeg) {
            addInfoExpressions(expressions, expressions[exp.id]);
            exp.expDeg = expressions[exp.id].expDeg;
            exp.stage = expressions[exp.id].stage;
            exp.rowsOffsets = expressions[exp.id].rowsOffsets || [0];
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

        if("rowOffset" in exp) {
            exp.rowsOffsets = [exp.rowOffset];
        }
    } else if (["number", "challenge", "public", "eval"].includes(exp.op) || (exp.op === "Zi" && exp.boundary === "everyRow")) {
        exp.expDeg = 0;
        if(exp.op !== "challenge") exp.stage = 0; 
    } else if(exp.op == "neg") {
        addInfoExpressions(expressions, exp.values[0]);
        exp.expDeg = exp.values[0].expDeg;
        exp.stage = exp.values[0].stage;
        exp.rowsOffsets = exp.values[0].rowsOffsets || [0];
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
        exp.stage = Math.max(exp.values[0].stage, exp.values[1].stage);
        const lhsRowOffsets = exp.values[0].rowsOffsets || [0];
        const rhsRowOffsets = exp.values[1].rowsOffsets || [0];
        exp.rowsOffsets = [...new Set([...lhsRowOffsets, ...rhsRowOffsets])];
    } else {
        throw new Error("Exp op not defined: "+ exp.op);
    }

    return;
}


