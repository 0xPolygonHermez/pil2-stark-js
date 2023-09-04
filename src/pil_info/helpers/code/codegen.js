const { getExpDim } = require("../helpers");
const { expressionError } = require("./debug");

function pilCodeGen(ctx, expressions, constraints, expId, prime, stark, addMul, verifierEvaluations) {
    if (ctx.calculated[expId] && ctx.calculated[expId][prime]) return;

    calculateDeps(ctx, expressions, constraints, expressions[expId], prime, expId, stark, addMul, verifierEvaluations);

    const codeCtx = {
        expId: expId,
        tmpUsed: ctx.tmpUsed,
        code: []
    }

    let e = expressions[expId];
    if (addMul) e = findAddMul(e);
    
    const retRef = evalExp(codeCtx, constraints, e, prime, stark, verifierEvaluations);

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

function evalExp(codeCtx, constraints, exp, prime, stark, verifierEvaluations) {
    prime = prime || 0;
    if (["add", "sub", "mul", "muladd", "neg"].includes(exp.op)) {
        const values = exp.values.map(v => evalExp(codeCtx, constraints, v, prime, stark, verifierEvaluations));
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
        // if (exp.rowOffset && prime) expressionError(codeCtx.pil, constraints, "double Prime", codeCtx.expId);
        let p = exp.rowOffset || prime; 
        return { type: exp.op, id: exp.id, prime: p, dim: exp.dim }
    } else if (exp.op === "exp") {
        // if (exp.rowOffset && prime) expressionError(codeCtx.pil, constraints, "double Prime", codeCtx.expId);
        let p = exp.rowOffset || prime; 
        return { type: exp.op, id: exp.id, prime: p, dim: exp.dim }
    } else if (["challenge", "eval"].includes(exp.op)) {
        if(exp.op == "challenge") { console.log(exp); }
        return { type: exp.op, id: exp.id, dim: exp.dim}
    } else if (exp.op === "public") {
        return { type: exp.op, id: exp.id, dim: 1}
    } else if (exp.op == "number") {
        return { type: "number", value: exp.value.toString(), dim: 1 }
    } else if (exp.op == "xDivXSubXi") {
        return { type: "xDivXSubXi", opening: exp.opening, dim: 3 }
    } else if (exp.op == "Zi") {
        return { type: "Zi", boundary: exp.boundary, frameId: exp.frameId, dim: 1 }
    } else if (exp.op === "x") {
        const dim = stark ? 3 : 1;
        return { type: "x", dim}
    } else {
        throw new Error(`Invalid op: ${exp.op}`);
    }
}


function calculateDeps(ctx, expressions, constraints, exp, prime, expIdErr, stark, addMul, verifierEvaluations) {
    if (exp.op == "exp") {
        // if (prime && exp.rowOffset) expressionError(ctx.pil, constraints, `Double prime`, expIdErr, exp.id);
        let p = exp.rowOffset || prime;
        pilCodeGen(ctx, expressions, constraints, exp.id, p, stark, addMul, verifierEvaluations);
    } else if (["add", "sub", "mul", "neg", "muladd"].includes(exp.op)) {
        exp.values.map(v => calculateDeps(ctx, expressions, constraints, v, prime, expIdErr, stark, addMul, verifierEvaluations));
    }
}

function buildCode(ctx, res, symbols, expressions, dom, stark, verifierEvaluations = false, verifierQuery = false) {
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

    fixProverCode(res, symbols, expressions, resCode, dom, stark, verifierEvaluations, verifierQuery);

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

function fixProverCode(res, symbols, expressions, code, dom, stark, verifierEvaluations = false, verifierQuery = false) {
    iterateCode(code, dom, fixRef)

    function fixRef(r, ctx) {
        if (r.type === "exp") {
            fixExpression(res, r, ctx, symbols, expressions, stark, verifierEvaluations);
        } else if(r.type === "cm" && verifierQuery) {
            fixCommitsQuery(res, r);
        } else if(["cm", "const"].includes(r.type) && verifierEvaluations) {
            fixEval(res, r, stark);
        } else if(["f", "xDivXSubXi"].includes(r.type)) {
            if(!stark) throw new Error("Invalid reference type" + r.type);
        } else if(!["cm", "const", "number", "challenge", "public", "tmp", "Zi", "eval", "x", "q", "tmpExp"].includes(r.type)) {
            throw new Error(`Invalid reference type: ${r.type}`);
        }
    }
}

function fixExpression(res, r, ctx, symbols, expressions, stark, verifierEvaluations) {
    const prime = r.prime || 0;
    const symbol = symbols.find(s => s.type === "tmpPol" && s.expId === r.id);
    if(symbol && (symbol.imPol || (!verifierEvaluations && ctx.dom === "n"))) {
        r.type = "cm";
        r.id = symbol.polId;
        r.dim = symbol.dim;
        if(verifierEvaluations) fixEval(res, r, stark);
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

function fixEval(res, r, stark) {
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
    r.dim = stark ? 3 : 1;
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
            
    const prevPolsStage = res.cmPolsMap.filter((p, index) => p.stage === p1.stage && index < r.id);
    r.stageId = prevPolsStage.length;
    r.treePos = prevPolsStage.reduce((acc, p) => acc + p.dim, 0);
    r.dim = p1.dim;
}

module.exports.pilCodeGen = pilCodeGen;
module.exports.buildCode  = buildCode;
