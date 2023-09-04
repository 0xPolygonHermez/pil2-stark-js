const { expressionError } = require("./debug");

function iterateCode(code, dom, nOpeningPoints, f) {
    const ctx = {};

    ctx.dom = dom;
    ctx.expMap = [];
    
    for(let i = 0; i < nOpeningPoints; ++i) {
        ctx.expMap[i] = {};
    }

    ctx.code = code;

    _iterate(code.code, f);
    
    function _iterate(subCode, f) {
        for (let i=0; i<subCode.length; i++) {
            for (let j=0; j<subCode[i].src.length; j++) {
                f(subCode[i].src[j], ctx);
            }
            f(subCode[i].dest, ctx);
        }
    }
}

function pilCodeGen(ctx, expressions, constraints, expId, prime, addMul) {
    if (ctx.calculated[expId] && ctx.calculated[expId][prime]) return;

    calculateDeps(ctx, expressions, constraints, expressions[expId], prime, expId);

    const codeCtx = {
        expId: expId,
        tmpUsed: ctx.tmpUsed,
        code: []
    }

    let e = expressions[expId];
    if (addMul) e = findAddMul(e);
    
    const retRef = evalExp(codeCtx, constraints, e, prime);

    if (retRef.type == "tmp") {
        codeCtx.code[codeCtx.code.length-1].dest = {
            type: "exp",
            prime: prime,
            id: expId
        }
        codeCtx.tmpUsed --;
    } else {
        const dest =  {
            type: "exp",
            prime: prime,
            id: expId
        };
        codeCtx.code.push({
            op: "copy",
            dest: dest,
            src: [ retRef ]
        })
    }

    ctx.code.push({
        expId: expId,
        prime: prime,
        code: codeCtx.code,
    });

    if(!ctx.calculated[expId]) ctx.calculated[expId] = {};
    ctx.calculated[expId][prime] = true;
    
    if (codeCtx.tmpUsed > ctx.tmpUsed) ctx.tmpUsed = codeCtx.tmpUsed;
}

function evalExp(codeCtx, constraints, exp, prime) {
    prime = prime || 0;
    if (["add", "sub", "mul", "muladd", "neg"].includes(exp.op)) {
        const values = exp.values.map(v => evalExp(codeCtx, constraints, v, prime));
        let op = exp.op;
        if(exp.op == "neg") {
            values.unshift({type: "number", value: "0"});
            op = "sub";
        }
        const r = { type: "tmp", id: codeCtx.tmpUsed++ };
        codeCtx.code.push({
            op: op,
            dest: r,
            src: values
        });
        return r;
    } else if (["cm", "const", "exp"].includes(exp.op)) {
        // if (exp.rowOffset && prime) expressionError(codeCtx.pil, constraints, "double Prime", codeCtx.expId);
        let p = exp.rowOffset || prime; 
        return { type: exp.op, id: exp.id, prime: p }
    } else if (["public", "challenge", "eval"].includes(exp.op)) {
        return { type: exp.op, id: exp.id }
    } else if (exp.op == "number") {
        return { type: "number", value: exp.value.toString() }
    } else if (exp.op == "xDivXSubXi") {
        return { type: "xDivXSubXi", opening: exp.opening }
    } else if (exp.op == "Zi") {
        return { type: "Zi", boundary: exp.boundary, frameId: exp.frameId }
    } else if (exp.op === "x") {
        return { type: "x" }
    } else {
        throw new Error(`Invalid op: ${exp.op}`);
    }
}


function calculateDeps(ctx, expressions, constraints, exp, prime, expIdErr, addMul) {
    if (exp.op == "exp") {
        // if (prime && exp.rowOffset) expressionError(ctx.pil, constraints, `Double prime`, expIdErr, exp.id);
        let p = exp.rowOffset || prime;
        pilCodeGen(ctx, expressions, constraints, exp.id, p, addMul);
    } else if (["add", "sub", "mul", "neg", "muladd"].includes(exp.op)) {
        exp.values.map(v => calculateDeps(ctx, expressions, constraints, v, prime, expIdErr, addMul));
    }
}

function buildCode(ctx, expressions) {
    res = {};
    res.tmpUsed = ctx.tmpUsed;
    res.first = [];
    res.last = [];
    res.everyFrame = [];
    res.code = [];

    for (let i=0; i<ctx.code.length; i++) {
        for (let j=0; j< ctx.code[i].code.length; j++) {
            res.code.push(ctx.code[i].code[j]);
        }
    }

    // Expressions that are not saved, cannot be reused later on
    for (let i=0; i<expressions.length; i++) {
        const e = expressions[i];
        if (!e.keep) delete ctx.calculated[i];
    }
    ctx.code = [];
    return res;
}

function findAddMul(exp) {
    const values = exp.values;
    if (!values) return exp;
    if ((exp.op == "add") && (values[0].op == "mul")) {
        return {
            op: "muladd",
            values: [
                findAddMul(values[0].values[0]),
                findAddMul(values[0].values[1]),
                findAddMul(values[1]),
            ]
        }
    } else if ((exp.op == "add") && (values[1].op == "mul")) {
        return {
            op: "muladd",
            values: [
                findAddMul(values[1].values[0]),
                findAddMul(values[1].values[1]),
                findAddMul(values[0]),
            ]
        }
    } else {
        const r = Object.assign({}, exp);
        for (let i=0; i < r.values.length; i++) {
            r.values[i] = findAddMul(values[i]);
        }
        return r;
    }
}

module.exports.fixProverCode = function fixProverCode(res, symbols, code, dom, stark, verifierQuery = false) {
    iterateCode(code, dom, res.openingPoints.length, fixRef)

    function fixRef(r, ctx) {
        switch (r.type) {
            case "cm":
                if (verifierQuery) {
                    const p1 = res.cmPolsMap[r.id];
                    let index = Number(p1.stage.substr(2));
                    if (p1.stage === "cmQ") {
                        r.type = "treeQ";
                        index = res.nLibStages + 2;
                    } else {
                        if(index < 1 || index > res.nLibStages + 1) throw new Error("Invalid cm stage");
                        r.type = "tree" + index;
                    }
                            
                    r.stageId = res.cmPolsMap.filter(p => p.stage === p1.stage && p.stagePos < p1.stagePos).length;
                    r.treePos = p1.stagePos;
                    r.dim = p1.dim;
                }
                break;
            case "exp":
                let symbol = symbols.find(s => s.type === "tmpPol" && s.expId === r.id);
                if(symbol && (symbol.imPol || ctx.dom === "n")) {
                    r.type = "cm";
                    r.id = symbol.polId;
                } else {
                    const p = r.prime || 0;
                    if (typeof ctx.expMap[p][r.id] === "undefined") {
                        ctx.expMap[p][r.id] = ctx.code.tmpUsed ++;
                    }
                    r.type= "tmp";
                    r.expId = r.id;
                    r.id= ctx.expMap[p][r.id];
                }
                break;
            case "const":
            case "number":
            case "challenge":
            case "public":
            case "tmp":
            case "Zi":
            case "eval":
            case "x":
            case "q":
            case "tmpExp":
                break;
            case "xDivXSubXi":
            case "f":
                if(!stark) throw new Error("Invalid reference type" + r.type);
                break;
            default:
                throw new Error("Invalid reference type " + r.type);
        }
    }
}

module.exports.iterateCode = iterateCode;
module.exports.pilCodeGen = pilCodeGen;
module.exports.buildCode  = buildCode;
