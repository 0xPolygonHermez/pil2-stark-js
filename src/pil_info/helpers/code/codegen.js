function pilCodeGen(ctx, symbols, expressions, constraints, expId, prime, stark, addMul, verifierEvaluations, verifierQuery) {
    if (ctx.calculated[expId] && ctx.calculated[expId][prime]) return;

    calculateDeps(ctx, symbols, expressions, constraints, expressions[expId], prime, expId, stark, addMul, verifierEvaluations, verifierQuery);

    const codeCtx = {
        expId: expId,
        tmpUsed: ctx.tmpUsed,
        evMap: ctx.evMap,
        code: []
    }

    let e = expressions[expId];
    if (addMul) e = findAddMul(e);
    
    const retRef = evalExp(codeCtx, symbols, constraints, e, prime, stark, verifierEvaluations, verifierQuery);

    if (retRef.type == "tmp") {
        codeCtx.code[codeCtx.code.length-1].dest = {
            type: "exp",
            prime: prime,
            id: expId,
            dim: e.dim,
        }
        codeCtx.tmpUsed --;
    } else {
        const dest =  {
            type: "exp",
            prime: prime,
            id: expId,
            dim: e.dim,
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

function evalExp(codeCtx, symbols, constraints, exp, prime, stark, verifierEvaluations, verifierQuery) {
    prime = prime || 0;
    if (["add", "sub", "mul", "muladd", "neg"].includes(exp.op)) {
        const values = exp.values.map(v => evalExp(codeCtx, symbols, constraints, v, prime, stark, verifierEvaluations, verifierQuery));
        let op = exp.op;
        if(exp.op == "neg") {
            values.unshift({type: "number", value: "0", dim: 1 });
            op = "sub";
        }
        let dim = Math.max(...values.map(v => v.dim));        
        const r = { type: "tmp", id: codeCtx.tmpUsed++, dim };
        if(verifierEvaluations && stark) r.dim = 3;
        codeCtx.code.push({
            op: op,
            dest: r,
            src: values,
        });
        return r;
    } else if (["cm", "const"].includes(exp.op)) {
        let p = exp.rowOffset || prime; 
        const r = { type: exp.op, id: exp.id, prime: p, dim: exp.dim }
        if(verifierEvaluations) {
            fixEval(symbols, r, codeCtx.evMap, stark);
        } else if(verifierQuery && exp.op === "cm") {
            fixCommitsQuery(symbols, r);
        }
        return r;
    } else if (exp.op === "exp") {
        let p = exp.rowOffset || prime; 
        return { type: exp.op, id: exp.id, prime: p, dim: exp.dim }
    } else if (["challenge", "eval"].includes(exp.op)) {
        return { type: exp.op, id: exp.id, dim: exp.dim}
    } else if (exp.op === "public") {
        return { type: exp.op, id: exp.id, dim: 1}
    } else if (exp.op == "number") {
        return { type: "number", value: exp.value.toString(), dim: 1 }
    } else if (exp.op == "xDivXSubXi") {
        return { type: "xDivXSubXi", id: exp.id, opening: exp.opening, dim: 3 }
    } else if (exp.op == "Zi") {
        return { type: "Zi", boundary: exp.boundary, frameId: exp.frameId, dim: 1 }
    } else if (exp.op === "x") {
        const dim = stark ? 3 : 1;
        return { type: "x", dim}
    } else {
        throw new Error(`Invalid op: ${exp.op}`);
    }
}


function calculateDeps(ctx, symbols, expressions, constraints, exp, prime, expIdErr, stark, addMul, verifierEvaluations, verifierQuery) {
    if (exp.op == "exp") {
        let p = exp.rowOffset || prime;
        pilCodeGen(ctx, symbols, expressions, constraints, exp.id, p, stark, addMul, verifierEvaluations, verifierQuery);
    } else if (["add", "sub", "mul", "neg", "muladd"].includes(exp.op)) {
        exp.values.map(v => calculateDeps(ctx, symbols, expressions, constraints, v, prime, expIdErr, stark, addMul, verifierEvaluations, verifierQuery));
    }
}

function buildCode(ctx, symbols, expressions, stark, verifierEvaluations = false, verifierQuery = false) {
    let resCode = {};
    resCode.tmpUsed = ctx.tmpUsed;
    resCode.first = [];
    resCode.last = [];
    resCode.everyFrame = [];
    resCode.code = [];

    for (let i=0; i<ctx.code.length; i++) {
        for (let j=0; j< ctx.code[i].code.length; j++) {
            resCode.code.push(ctx.code[i].code[j]);
        }
    }

    // Expressions that are not saved, cannot be reused later on
    for (let i=0; i<expressions.length; i++) {
        const e = expressions[i];
        if (!e.keep) delete ctx.calculated[i];
    }
    ctx.code = [];

    fixProverCode(symbols, expressions, ctx, resCode, stark, verifierEvaluations, verifierQuery);

    return resCode;
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

function iterateCode(code, dom, f) {
    const ctx = {};

    ctx.dom = dom;
    ctx.expMap = [];
    
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

function fixProverCode(symbols, expressions, ctx, code, stark, verifierEvaluations = false, verifierQuery = false) {
    const evaluationsMap = ctx.evMap;

    iterateCode(code, ctx.dom, fixRef)

    function fixRef(r, ctx) {
        if (r.type === "exp") {
            fixExpression(r, ctx, symbols, expressions, evaluationsMap, stark, verifierEvaluations);
        }
    }
}

function fixExpression(r, ctx, symbols, expressions, evMap, stark, verifierEvaluations) {
    const prime = r.prime || 0;
    const symbol = symbols.find(s => s.type === "tmpPol" && s.expId === r.id);
    if(symbol && (symbol.imPol || (!verifierEvaluations && ctx.dom === "n"))) {
        r.type = "cm";
        r.id = symbol.polId;
        r.dim = symbol.dim;
        if(verifierEvaluations) fixEval(symbols, r, evMap, stark);
    } else {
        if (!ctx.expMap[prime]) ctx.expMap[prime] = {};
        if (typeof ctx.expMap[prime][r.id] === "undefined") {
            ctx.expMap[prime][r.id] = ctx.code.tmpUsed ++;
        }
        let dim;
        if(verifierEvaluations) {
            dim = stark ? 3 : 1;
        } else {
            dim = expressions[r.id].dim;
        }
        r.type= "tmp";
        r.expId = r.id;
        r.dim = dim;
        r.id= ctx.expMap[prime][r.id];
    }
}

function fixEval(symbols, r, evMap, stark) {
    const prime = r.prime || 0;
    let evalIndex = evMap.findIndex(e => e.type === r.type && e.id === r.id && e.prime === prime);
    if (evalIndex == -1) {
        const name = r.type === "const" 
            ? symbols.find(s => s.polId === r.id && s.type === "fixed").name
            : symbols.find(s => s.polId === r.id && s.type !== "fixed").name;
        const rf = {
            type: r.type,
            name: name,
            id: r.id,
            prime: prime
        };
        evMap.push(rf);
        evalIndex = evMap.length - 1;
    }
    delete r.prime;
    r.id = evalIndex;
    r.type = "eval";
    r.dim = stark ? 3 : 1;
    return r;
}

function fixCommitsQuery(symbols, r) {
    const symbol = symbols.find(s => s.polId === r.id && ["tmpPol", "witness"].includes(s.type));
    r.type = "tree" + symbol.stage;
    r.stageId = symbol.stageId;
    r.treePos = symbol.stagePos;
    r.dim = symbol.dim;
}

module.exports.pilCodeGen = pilCodeGen;
module.exports.buildCode  = buildCode;
