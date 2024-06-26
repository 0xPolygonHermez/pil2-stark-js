
const workerpool = require('workerpool');
const F3g = require("../helpers/f3g.js");


async function starkgen_execute(ctx, cEveryRowSrc, n, execInfo, stageCode, first, last, debug) {

    cEveryRow = new Function("ctx", "i", cEveryRowSrc);

    console.log(`start exec stage ${stageCode}...`);
    ctx.F = new F3g();
    ctx.tmp = [];
    ctx.errors = [];

    for (let s=0; s<execInfo.outputSections.length; s++) {
        const si = execInfo.outputSections[s];
        if (typeof ctx[si.name] == "undefined") {
            ctx[si.name] = new BigUint64Array(si.width*(n+ctx.next));
        }
    }

    if(debug) {
        for (let i=first; i<Math.min(n, last); i++) {
            const v = cEveryRow(ctx, i);
            if (!ctx.F.isZero(v)) {
                ctx.errors.push(`${ctx.filename}:${ctx.line}: identity does not match w=${i} val=${ctx.F.toString(v)} `);
                return;
            }        
        }
    } else {
        for (let i=0; i<n; i++) {
            cEveryRow(ctx, i);
        }
    }

    const ctxOut = {}
    for (let s=0; s<execInfo.outputSections.length; s++) {
        const si = execInfo.outputSections[s];
        ctxOut[si.name] = ctx[si.name];
    }

    console.log(`end exec stage ${stageCode}...`);
    return ctxOut;
}

if (!workerpool.isMainThread) {
    workerpool.worker({
        starkgen_execute: starkgen_execute,
    });
}
module.exports.starkgen_execute = starkgen_execute;