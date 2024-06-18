function pilCodeGen(ctx, symbols, expressions, expId, prime, evMap) {
    if (ctx.calculated[expId] && ctx.calculated[expId][prime]) return;

    calculateDeps(ctx, symbols, expressions, expressions[expId], prime, expId, evMap);

    let e = expressions[expId];
    if (ctx.addMul) e = findAddMul(e);
    
    if(evMap) {
        calculateEvMap(ctx, symbols, expressions, e, prime);
    } else {
        const codeCtx = {
            expId: expId,
            tmpUsed: ctx.tmpUsed,
            calculated: ctx.calculated,
            dom: ctx.dom,
            stark: ctx.stark,
            verifierEvaluations: ctx.verifierEvaluations,
            verifierQuery: ctx.verifierQuery,
            evMap: ctx.evMap,
            airId: ctx.airId,
            subproofId: ctx.subproofId,
            openingPoints: ctx.openingPoints,
            code: []
        }
    
        const retRef = evalExp(codeCtx, symbols, expressions, e, prime);
    
        const r = { type: "exp", prime, id: expId, dim: e.dim };
        
        if (retRef.type === "tmp") {
            fixCommitPol(r, codeCtx, symbols);
            codeCtx.code[codeCtx.code.length-1].dest = r;
            codeCtx.tmpUsed--;
        } else {
            fixCommitPol(r, codeCtx, symbols);
            codeCtx.code.push({ op: "copy", dest: r, src: [ retRef ] })
        }
    
        ctx.code.push(...codeCtx.code);
        
        if(!ctx.calculated[expId]) ctx.calculated[expId] = {};
        ctx.calculated[expId][prime] = true;
    
        if (codeCtx.tmpUsed > ctx.tmpUsed) ctx.tmpUsed = codeCtx.tmpUsed;
    }
}

function calculateEvMap(ctx, symbols, expressions, exp, prime) {
    prime = prime || 0;
    if (["add", "sub", "mul", "muladd"].includes(exp.op)) {
        const values = [];
        for(let i = 0; i < exp.values.length; ++i) {
            values[i] = calculateEvMap(ctx, symbols, expressions, exp.values[i], prime);
        }
    } else if (["cm", "const"].includes(exp.op) || (exp.op === "exp" && ["cm", "const"].includes(expressions[exp.id].op))) {
        const expr = exp.op === "exp" ? expressions[exp.id] : exp;
        let p = expr.rowOffset || prime; 
        const r = { type: expr.op, id: expr.id, prime: p, dim: expr.dim }
        calculateEval(r, ctx.evMap, ctx.openingPoints);
    } else if (exp.op === "exp") {
        let p = exp.rowOffset || prime; 
        const r = { type: exp.op, expId: exp.id, id: exp.id, prime: p, dim: exp.dim };
        const symbol = symbols.find(s => s.type === "witness" && s.expId === r.id && s.airId === ctx.airId && s.subproofId === ctx.subproofId);
        if(symbol && symbol.imPol) {
            r.type = "cm";
            r.id = symbol.polId;
            r.dim = symbol.dim;
            calculateEval(r, ctx.evMap, ctx.openingPoints);
        }
    }
}

function evalExp(ctx, symbols, expressions, exp, prime) {
    prime = prime || 0;
    if (["add", "sub", "mul", "muladd"].includes(exp.op)) {
        const values = [];
        for(let i = 0; i < exp.values.length; ++i) {
            values[i] = evalExp(ctx, symbols, expressions, exp.values[i], prime);
        }
        const r = { type: "tmp", id: ctx.tmpUsed++, dim: Math.max(...values.map(v => v.dim)) };

        ctx.code.push({
            op: exp.op,
            dest: r,
            src: values,
        });
        
        return r;
    } else if (["cm", "const"].includes(exp.op) || (exp.op === "exp" && ["cm", "const"].includes(expressions[exp.id].op))) {
        const expr = exp.op === "exp" ? expressions[exp.id] : exp;
        let p = expr.rowOffset || prime; 
        const r = { type: expr.op, id: expr.id, prime: p, dim: expr.dim }
        if(ctx.verifierEvaluations) {
            fixEval(r, ctx, symbols);
        } else if(ctx.verifierQuery && expr.op === "cm") {
            fixCommitsQuery(r, ctx, symbols);
        }
        return r;
    } else if (exp.op === "exp") {
        let p = exp.rowOffset || prime; 
        const r = { type: exp.op, expId: exp.id, id: exp.id, prime: p, dim: exp.dim };
        fixCommitPol(r, ctx, symbols);
        return r;
    } else if (exp.op === "eval") {
        return { type: exp.op, id: exp.id, dim: exp.dim, subproofId: exp.subproofId, airId: exp.airId}
    } else if (exp.op === "challenge") {
        return { type: exp.op, id: exp.id, stageId: exp.stageId, dim: exp.dim, stage: exp.stage }
    } else if (exp.op === "public") {
        return { type: exp.op, id: exp.id, dim: 1}
    } else if (exp.op == "number") {
        return { type: exp.op, value: exp.value.toString(), dim: 1 }
    } else if (exp.op === "subproofValue") {
        return { type: exp.op, id: exp.id, dim: exp.dim, subproofId: exp.subproofId, airId: exp.airId }    
    } else if (exp.op == "xDivXSubXi") {
        return { type: exp.op, id: exp.id, opening: exp.opening, dim: 3 }
    } else if (exp.op == "Zi") {
        return { type: exp.op, boundaryId: exp.boundaryId, dim: 1 }
    } else if (exp.op === "x") {
        return { type: exp.op, dim: 1 }
    } else {
        throw new Error(`Invalid op: ${exp.op}`);
    }
}


function calculateDeps(ctx, symbols, expressions, exp, prime, expId, evMap) {
    if (exp.op == "exp") {
        let p = exp.rowOffset || prime;
        pilCodeGen(ctx, symbols, expressions, exp.id, p, evMap);
    } else if (["add", "sub", "mul", "muladd"].includes(exp.op)) {
        exp.values.map(v => calculateDeps(ctx, symbols, expressions, v, prime, expId, evMap));
    }
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

function fixExpression(r, ctx) {
    const prime = r.prime || 0;
    if (!ctx.expMap[prime]) ctx.expMap[prime] = {};
    if (typeof ctx.expMap[prime][r.id] === "undefined") {
        ctx.expMap[prime][r.id] = ctx.tmpUsed++;
    }

    r.type= "tmp";
    r.id= ctx.expMap[prime][r.id];
}

function fixDimensionsVerifier(ctx) {
    const tmpDim = [];

    for (let i=0; i<ctx.code.length; i++) {
        if (!["add", "sub", "mul", "muladd", "copy"].includes(ctx.code[i].op)) throw new Error("Invalid op:"+ ctx.code[i].op);
        if (ctx.code[i].dest.type !== "tmp") throw new Error("Invalid dest type:"+ ctx.code[i].dest.type);
        let newDim = Math.max(...ctx.code[i].src.map(s => getDim(s)));
        tmpDim[ctx.code[i].dest.id] = newDim;
        ctx.code[i].dest.dim = newDim;
    }

    function getDim(r) {
        let d;
        if(r.type === "tmp") {
            d = tmpDim[r.id];
        } else if(r.type.includes("tree")) {
            d = r.dim;
        } else if(["const", "number", "public"].includes(r.type)) {
            d = 1;
        } else if(["eval", "challenge", "xDivXSubXi", "x", "Zi", "subproofValue"].includes(r.type)) {
            d = ctx.stark ? 3 : 1;
        } else throw new Error("Invalid type: " + r.type);
        r.dim = d;
        return d;
    }

}

function fixCommitPol(r, ctx, symbols) {
    const symbol = symbols.find(s => ["witness", "tmpPol"].includes(s.type) && s.expId === r.id && s.airId === ctx.airId && s.subproofId === ctx.subproofId);
    if(symbol && (symbol.imPol || (!ctx.verifierEvaluations && ctx.dom === "n"))) {
        r.type = "cm";
        r.id = symbol.polId;
        r.dim = symbol.dim;
        if(ctx.verifierEvaluations) fixEval(r, ctx);
    }
}

function calculateEval(r, evMap, openingPoints) {
    const prime = r.prime || 0;
    let openingPos = openingPoints.findIndex(p => p === prime);
    let evalIndex = evMap.findIndex(e => e.type === r.type && e.id === r.id && e.openingPos === openingPos);
    if (evalIndex == -1) {  
        const rf = {
            type: r.type,
            id: r.id,
            prime,
            openingPos,
        };
        evMap.push(rf);
        evalIndex = evMap.length - 1;
    }
    return evalIndex;
}

function fixEval(r, ctx) {
    const prime = r.prime || 0;
    let openingPos = ctx.openingPoints.findIndex(p => p === prime);
    let evalIndex = ctx.evMap.findIndex(e => e.type === r.type && e.id === r.id && e.openingPos === openingPos);
    delete r.prime;
    r.id = evalIndex;
    r.type = "eval";
    r.dim = ctx.stark ? 3 : 1;
    return r;
}

function fixCommitsQuery(r, ctx, symbols) {
    const symbol = symbols.find(s => s.polId === r.id && ["tmpPol", "witness"].includes(s.type) && s.airId === ctx.airId && s.subproofId === ctx.subproofId);
    r.type = "tree" + symbol.stage;
    r.stageId = symbol.stageId;
    r.treePos = symbol.stagePos;
    r.dim = symbol.dim;
}

function buildCode(ctx) {
    ctx.expMap = [];
    for(let i = 0; i < ctx.code.length; i++) {
        for(let j = 0; j < ctx.code[i].src.length; j++) {
            if(ctx.code[i].src[j].type === "exp") fixExpression(ctx.code[i].src[j], ctx);
        }
        if(ctx.code[i].dest.type === "exp") fixExpression(ctx.code[i].dest, ctx);
    }

    if(ctx.verifierEvaluations || ctx.verifierQuery) fixDimensionsVerifier(ctx);

    let code = { tmpUsed: ctx.tmpUsed, code: ctx.code, symbolsCalculated: ctx.symbolsCalculated };
    if(ctx.symbolsUsed) {
        code.symbolsUsed = ctx.symbolsUsed.sort((s1, s2) => {
            const order = { const: 0, cm: 1, tmp: 2 };
            if (order[s1.op] !== order[s2.op]) return order[s1.op] - order[s2.op];
            return s1.stage !== s2.stage ? s1.stage - s2.stage : s1.id - s2.id;
        });
    }

    ctx.code = [];
    ctx.calculated = [];
    ctx.symbolsCalculated = [];
    ctx.symbolsUsed = [];
    ctx.tmpUsed = 0;

    return code;
}

module.exports.pilCodeGen = pilCodeGen;
module.exports.buildCode  = buildCode;
