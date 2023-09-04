const ExpressionOps = require("../../../expressionops");
const { getExpDim } = require("../../helpers");

module.exports.grandProductPermutation = function grandProductPermutation(pil, symbols, hints, stark) {
    const E = new ExpressionOps();

    const stage = 2;
    const dim = stark ? 3 : 1;

    const gamma = E.challenge("stage1_challenge0", stage, dim);
    const delta = E.challenge("stage1_challenge1", stage, dim);
    const epsilon = E.challenge("stage1_challenge2", stage, dim);

    for (let i=0; i<pil.permutationIdentities.length; i++) {
        const peCtx = {};
        const pi = pil.permutationIdentities[i];

        let tExp = null;
        for (let j=0; j<pi.t.length; j++) {
            const e = E.exp(pi.t[j],0,stage);
            if (tExp) {
                tExp = E.add(E.mul(gamma, tExp), e);
            } else {
                tExp = e;
            }
        }
        if (pi.selT !== null) {
            tExp = E.sub(tExp, delta);
            tExp = E.mul(tExp, E.exp(pi.selT,0,stage));
            tExp = E.add(tExp, delta);
            tExp.keep = true;
        }

        peCtx.tExpId = pil.expressions.length;
        tExp.stage = stage;
        pil.expressions.push(tExp);
        const tDim = getExpDim(pil.expressions, peCtx.tExpId, stark);
        pil.expressions[peCtx.tExpId].deg = tDim;


        fExp = null;
        for (let j=0; j<pi.f.length; j++) {
            const e = E.exp(pi.f[j],0,stage);
            if (fExp) {
                fExp = E.add(E.mul(fExp, gamma), e);
            } else {
                fExp = e;
            }
        }
        if (pi.selF !== null) {
            fExp = E.sub(fExp, delta);
            fExp = E.mul(fExp, E.exp(pi.selF,0,stage));
            fExp = E.add(fExp, delta);
            fExp.keep = true;
        }

        peCtx.fExpId = pil.expressions.length;
        fExp.stage = stage;
        pil.expressions.push(fExp);
        const fDim = getExpDim(pil.expressions, peCtx.fExpId, stark);
        pil.expressions[peCtx.fExpId].deg = fDim;

        peCtx.zId = pil.nCommitments++;

        const f = E.exp(peCtx.fExpId,0,stage, dim);
        const t = E.exp(peCtx.tExpId,0,stage, dim);
        const z = E.cm(peCtx.zId, 0,stage, dim);
        const zp = E.cm(peCtx.zId, 1,stage, dim);

        let c1;
        if(stark) {
            c1 = E.sub(z, E.number(1));
        } else {
            if ( typeof pil.references["Global.L1"] === "undefined") throw new Error("Global.L1 must be defined");
            const l1 = E.const(pil.references["Global.L1"].id, 0, 1);
            c1 = E.mul(l1,  E.sub(z, E.number(1)));
        }

        c1.deg=2;
        pil.expressions.push(c1);
        let c1Id = pil.expressions.length - 1;
        pil.polIdentities.push({e: c1Id, boundary: "firstRow"});
        let c1Dim = getExpDim(pil.expressions, c1Id, stark);
        pil.expressions[c1Id].dim = c1Dim;

        const numExp = E.add(f, epsilon);
        peCtx.numId = pil.expressions.length;
        numExp.keep = true;
        numExp.stage = stage;
        pil.expressions.push(numExp);
        const numDim = getExpDim(pil.expressions, peCtx.numId, stark);
        pil.expressions[peCtx.numId].deg = numDim;

        const denExp = E.add(t, epsilon);
        peCtx.denId = pil.expressions.length;
        denExp.keep = true;
        denExp.stage = stage;
        pil.expressions.push(denExp);
        const denDim = getExpDim(pil.expressions, peCtx.denId, stark);
        pil.expressions[peCtx.denId].deg = denDim;

        const c2 = E.sub(  E.mul(zp,  E.exp(peCtx.denId,0,stage)), E.mul(z, E.exp(peCtx.numId,0,stage)));
        c2.deg=2;
        pil.expressions.push(c2);
        let c2Id = pil.expressions.length - 1;
        pil.polIdentities.push({e: c2Id, boundary: "everyRow"});
        let c2Dim = getExpDim(pil.expressions, c2Id, stark);
        pil.expressions[c2Id].dim = c2Dim;

        const hint = {
            stage,
            inputs: [`Permutation${i}.num`, `Permutation${i}.den`], 
            outputs: [`Permutation${i}.z`], 
            lib: "calculateZ"
        };

        hints.push(hint);

        symbols.push({ type: "tmpPol", name: `Permutation${i}.f`, expId: peCtx.fExpId, stage, dim: fDim });
        symbols.push({ type: "tmpPol", name: `Permutation${i}.t`, expId: peCtx.tExpId, stage, dim: tDim });
        symbols.push({ type: "tmpPol", name: `Permutation${i}.num`, expId: peCtx.numId, stage, dim: numDim });
        symbols.push({ type: "tmpPol", name: `Permutation${i}.den`, expId: peCtx.denId, stage, dim: denDim });
        symbols.push({ type: "witness", name: `Permutation${i}.z`, polId: peCtx.zId, stage, dim: Math.max(numDim, denDim) });
    }
}
