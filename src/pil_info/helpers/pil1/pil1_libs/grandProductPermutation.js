const ExpressionOps = require("../../../expressionops");
const { getExpDim } = require("../../helpers");

module.exports.grandProductPermutation = function grandProductPermutation(res, pil, symbols, hints, stark) {
    const E = new ExpressionOps();

    const gamma = E.challenge("stage1_challenge0", 2);
    const delta = E.challenge("stage1_challenge1", 2);
    const epsilon = E.challenge("stage1_challenge2", 2);

    for (let i=0; i<pil.permutationIdentities.length; i++) {
        const peCtx = {};
        const pi = pil.permutationIdentities[i];

        let tExp = null;
        for (let j=0; j<pi.t.length; j++) {
            const e = E.exp(pi.t[j],0,2);
            if (tExp) {
                tExp = E.add(E.mul(gamma, tExp), e);
            } else {
                tExp = e;
            }
        }
        if (pi.selT !== null) {
            tExp = E.sub(tExp, delta);
            tExp = E.mul(tExp, E.exp(pi.selT,0,2));
            tExp = E.add(tExp, delta);
            tExp.keep = true;
        }

        peCtx.tExpId = pil.expressions.length;
        tExp.stage = 2;
        pil.expressions.push(tExp);


        fExp = null;
        for (let j=0; j<pi.f.length; j++) {
            const e = E.exp(pi.f[j],0,2);
            if (fExp) {
                fExp = E.add(E.mul(fExp, gamma), e);
            } else {
                fExp = e;
            }
        }
        if (pi.selF !== null) {
            fExp = E.sub(fExp, delta);
            fExp = E.mul(fExp, E.exp(pi.selF,0,2));
            fExp = E.add(fExp, delta);
            fExp.keep = true;
        }

        peCtx.fExpId = pil.expressions.length;
        fExp.stage = 2;
        pil.expressions.push(fExp);

        peCtx.zId = pil.nCommitments++;

        const f = E.exp(peCtx.fExpId,0,2);
        const t = E.exp(peCtx.tExpId,0,2);
        const z = E.cm(peCtx.zId, 0, 2);
        const zp = E.cm(peCtx.zId, 1, 2);

        let c1;
        if(stark) {
            c1 = E.sub(z, E.number(1));
        } else {
            if ( typeof pil.references["Global.L1"] === "undefined") throw new Error("Global.L1 must be defined");
            const l1 = E.const(pil.references["Global.L1"].id);
            c1 = E.mul(l1,  E.sub(z, E.number(1)));
        }

        c1.deg=2;
        pil.expressions.push(c1);
        pil.polIdentities.push({e: pil.expressions.length - 1, boundary: "firstRow"});

        const numExp = E.add(f, epsilon);
        peCtx.numId = pil.expressions.length;
        numExp.keep = true;
        numExp.stage = 2;
        pil.expressions.push(numExp);

        const denExp = E.add(t, epsilon);
        peCtx.denId = pil.expressions.length;
        denExp.keep = true;
        denExp.stage = 2;
        pil.expressions.push(denExp);

        const c2 = E.sub(  E.mul(zp,  E.exp(peCtx.denId,0,2)), E.mul(z, E.exp(peCtx.numId,0,2)));
        c2.deg=2;
        pil.expressions.push(c2);
        pil.polIdentities.push({e: pil.expressions.length - 1, boundary: "everyRow"});

        const hint = {
            stage: 2,
            inputs: [`Permutation${i}.num`, `Permutation${i}.den`], 
            outputs: [`Permutation${i}.z`], 
            lib: "calculateZ"
        };

        hints.push(hint);

        const fDim = getExpDim(pil.expressions, peCtx.fExpId, stark);
        symbols.push({ type: "tmpPol", name: `Permutation${i}.f`, expId: peCtx.fExpId, stage: 2, dim: fDim });

        const tDim = getExpDim(pil.expressions, peCtx.tExpId, stark);
        symbols.push({ type: "tmpPol", name: `Permutation${i}.t`, expId: peCtx.tExpId, stage: 2, dim: tDim });

        const numDim = getExpDim(pil.expressions, peCtx.numId, stark);
        symbols.push({ type: "tmpPol", name: `Permutation${i}.num`, expId: peCtx.numId, stage: 2, dim: numDim });

        const denDim = getExpDim(pil.expressions, peCtx.denId, stark);
        symbols.push({ type: "tmpPol", name: `Permutation${i}.den`, expId: peCtx.denId, stage: 2, dim: denDim });

        symbols.push({ type: "witness", name: `Permutation${i}.z`, polId: peCtx.zId, stage: 2, dim: Math.max(numDim, denDim) });
    }
}
