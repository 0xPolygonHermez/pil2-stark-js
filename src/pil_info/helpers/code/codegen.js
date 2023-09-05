function pilCodeGen(ctx, symbols, expressions, constraints, expId, prime) {
    if (ctx.calculated[expId] && ctx.calculated[expId][prime]) return;

    calculateDeps(ctx, symbols, expressions, constraints, expressions[expId], prime, expId);

    let e = expressions[expId];
    if (ctx.addMul) e = findAddMul(e);
    
    const retRef = evalExp(ctx, symbols, expressions, constraints, e, prime);

    if (!ctx.expMap[prime]) ctx.expMap[prime] = {};

    if (retRef.type === "tmp") {
        const r = {
            type: "exp",
            prime,
            dim: e.dim,
            id: expId,
        }
        ctx.tmpUsed--;
        fixExpression(r, ctx, symbols, expressions);
        ctx.code[ctx.code.length - 1].dest = r;
    } else {
        const r =  {
            type: "exp",
            prime: prime,
            id: expId,
            dim: e.dim,
        };
        fixExpression(r, ctx, symbols, expressions);
        ctx.code.push({
            op: "copy",
            dest: r,
            src: [ retRef ]
        })
    }

    if(!ctx.calculated[expId]) ctx.calculated[expId] = {};
    ctx.calculated[expId][prime] = true;
}

function evalExp(ctx, symbols, expressions, constraints, exp, prime) {
    prime = prime || 0;
    if (["add", "sub", "mul", "muladd", "neg"].includes(exp.op)) {
        const values = exp.values.map(v => evalExp(ctx, symbols, expressions, constraints, v, prime));
        let op = exp.op;
        if(exp.op == "neg") {
            values.unshift({type: "number", value: "0", dim: 1 });
            op = "sub";
        }
        let dim = Math.max(...values.map(v => v.dim));        
        const r = { type: "tmp", id: ctx.tmpUsed++, dim };
        if(ctx.verifierEvaluations && ctx.stark) r.dim = 3;
        ctx.code.push({
            op: op,
            dest: r,
            src: values,
        });
        return r;
    } else if (["cm", "const"].includes(exp.op)) {
        let p = exp.rowOffset || prime; 
        const r = { type: exp.op, id: exp.id, prime: p, dim: exp.dim }
        if(ctx.verifierEvaluations) {
            fixEval(symbols, r, ctx);
        } else if(ctx.verifierQuery && exp.op === "cm") {
            fixCommitsQuery(symbols, r);
        }
        return r;
    } else if (exp.op === "exp") {
        let p = exp.rowOffset || prime; 
        const r = { type: exp.op, expId: exp.id, id: exp.id, prime: p, dim: exp.dim };
        fixExpression(r, ctx, symbols, expressions);
        return r;
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
        const dim = ctx.stark ? 3 : 1;
        return { type: "x", dim}
    } else {
        throw new Error(`Invalid op: ${exp.op}`);
    }
}


function calculateDeps(ctx, symbols, expressions, constraints, exp, prime, expId) {
    if (exp.op == "exp") {
        let p = exp.rowOffset || prime;
        pilCodeGen(ctx, symbols, expressions, constraints, exp.id, p);
    } else if (["add", "sub", "mul", "neg", "muladd"].includes(exp.op)) {
        exp.values.map(v => calculateDeps(ctx, symbols, expressions, constraints, v, prime, expId));
    }
}

function buildCode(ctx, expressions) {
    // Expressions that are not saved, cannot be reused later on
    for (let i=0; i<expressions.length; i++) {
        const e = expressions[i];
        if (!e.keep) delete ctx.calculated[i];
    }

    let code = { tmpUsed: ctx.tmpUsed, code: ctx.code };

    ctx.code = [];

    return code;
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

function fixExpression(r, ctx, symbols, expressions) {
    const prime = r.prime || 0;
    const symbol = symbols.find(s => s.type === "tmpPol" && s.expId === r.id);
    if(symbol && (symbol.imPol || (!ctx.verifierEvaluations && ctx.dom === "n"))) {
        r.type = "cm";
        r.id = symbol.polId;
        r.dim = symbol.dim;
        if(ctx.verifierEvaluations) fixEval(symbols, r, ctx);
    } else {
        if (!ctx.expMap[prime]) ctx.expMap[prime] = {};
        if (typeof ctx.expMap[prime][r.id] === "undefined") {
            ctx.expMap[prime][r.id] = ctx.tmpUsed++;
        }
        let dim;
        if(ctx.verifierEvaluations) {
            dim = ctx.stark ? 3 : 1;
        } else {
            dim = expressions[r.id].dim;
        }
        r.type= "tmp";
        r.expId = r.id;
        r.dim = dim;
        r.id= ctx.expMap[prime][r.id];
    }
}

function fixEval(symbols, r, ctx) {
    const prime = r.prime || 0;
    let evalIndex = ctx.evMap.findIndex(e => e.type === r.type && e.id === r.id && e.prime === prime);
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
        ctx.evMap.push(rf);
        evalIndex = ctx.evMap.length - 1;
    }
    delete r.prime;
    r.id = evalIndex;
    r.type = "eval";
    r.dim = ctx.stark ? 3 : 1;
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
