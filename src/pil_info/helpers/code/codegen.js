const { expressionError } = require("./debug");

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

function fixProverCode(res, symbols, code, dom, stark, verifierEvaluations = false, verifierQuery = false) {
    iterateCode(code, dom, fixRef)

    function fixRef(r, ctx) {
        if (r.type === "exp") {
            fixExpression(res, r, ctx, symbols, verifierEvaluations);
        } else if(r.type === "cm" && verifierQuery) {
            fixCommitsQuery(res, r);
        } else if(["cm", "const"].includes(r.type) && verifierEvaluations) {
            fixEval(res, r);
        } else if(["f", "xDivXSubXi"].includes(r.type)) {
            if(!stark) throw new Error("Invalid reference type" + r.type);
        } else if(!["cm", "const", "number", "challenge", "public", "tmp", "Zi", "eval", "x", "q", "tmpExp"].includes(r.type)) {
            throw new Error(`Invalid reference type: ${r.type}`);
        }
    }
}

function fixExpression(res, r, ctx, symbols, verifierEvaluations) {
    const prime = r.prime || 0;
    const symbol = symbols.find(s => s.type === "tmpPol" && s.expId === r.id);
    if(symbol && (symbol.imPol || (!verifierEvaluations && ctx.dom === "n"))) {
        r.type = "cm";
        r.id = symbol.polId;
        if(verifierEvaluations) fixEval(res, r, prime);
    } else {
        if (!ctx.expMap[prime]) ctx.expMap[prime] = {};
        if (typeof ctx.expMap[prime][r.id] === "undefined") {
            ctx.expMap[prime][r.id] = ctx.code.tmpUsed ++;
        }
        r.type= "tmp";
        r.expId = r.id;
        r.id= ctx.expMap[prime][r.id];
    }
}

function fixEval(res, r) {
    const prime = r.prime || 0;
    let evalIndex = res.evMap.findIndex(e => e.type === r.type && e.id === r.id && e.prime === prime);
    if (evalIndex == -1) {
        const rf = {
            type: r.type,
            name: r.type === "cm" ? res.cmPolsMap[r.id].name : res.constPolsMap[r.id].name,
            id: r.id,
            prime: prime
        };
        res.evMap.push(rf);
        evalIndex = res.evMap.length - 1;
    }
    delete r.prime;
    r.id = evalIndex;
    r.type = "eval";
    return r;
}

function fixCommitsQuery(res, r) {
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

module.exports.fixProverCode = fixProverCode;
module.exports.pilCodeGen = pilCodeGen;
module.exports.buildCode  = buildCode;
