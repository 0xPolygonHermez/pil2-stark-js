const { expressionError } = require("./helpers/debug");

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
    } else if (["cm", "const", "exp", "q"].includes(exp.op)) {
        // if (exp.next && prime) expressionError(codeCtx.pil, constraints, "double Prime", codeCtx.expId);
        let p = exp.next || prime ? 1 : 0; 
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
        // if (prime && exp.next) expressionError(ctx.pil, constraints, `Double prime`, expIdErr, exp.id);
        let p = exp.next || prime ? 1 : 0;
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

module.exports.pilCodeGen = pilCodeGen;
module.exports.buildCode  = buildCode;