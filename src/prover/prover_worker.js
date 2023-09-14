
const workerpool = require('workerpool');
const F3g = require("../helpers/f3g.js");


async function proofgen_execute(ctx, stark, cEveryRowSrc, n, execInfo, st_name, first, last, debug) {

    cEveryRow = new Function("ctx", "i", cEveryRowSrc);

    console.log(`start exec ${st_name}...`);
    if(stark) {
        ctx.F = new F3g();
    }
    ctx.tmp = [];

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

    console.log(`end exec ${st_name}...`);
    return ctxOut;
}

if (!workerpool.isMainThread) {
    workerpool.worker({
        proofgen_execute: proofgen_execute,
    });
}
module.exports.proofgen_execute = proofgen_execute;