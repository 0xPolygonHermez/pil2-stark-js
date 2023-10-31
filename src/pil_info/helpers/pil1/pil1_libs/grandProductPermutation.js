const ExpressionOps = require("../../../expressionops");
const { getExpDim } = require("../../helpers");

module.exports.initChallengesPermutation = function initChallengesPermutation(stark) {
    const stage = 2;
    const dim = stark ? 3 : 1;

    const alpha = {name: "std_alpha", stage, dim, stageId: 0};
    const beta = {name: "std_beta", stage, dim, stageId: 1};
    const epsilon = {name: "std_epsilon", stage, dim, stageId: 2};

    return [alpha, beta, epsilon];
}

module.exports.grandProductPermutation = function grandProductPermutation(pil, symbols, hints, stark) {
    const E = new ExpressionOps();

    const stage = 2;
    const dim = stark ? 3 : 1;

    let alphaSymbol = symbols.find(s => s.type === "challenge" && s.name === "std_alpha");
    const alpha = E.challenge("std_alpha", stage, dim, alphaSymbol.stageId);

    let betaSymbol = symbols.find(s => s.type === "challenge" && s.name === "std_beta");
    const beta = E.challenge("std_beta", stage, dim, betaSymbol.stageId);

    let epsilonSymbol = symbols.find(s => s.type === "challenge" && s.name === "std_epsilon");
    const epsilon = E.challenge("std_epsilon", stage, dim, epsilonSymbol.stageId);
    

    for (let i=0; i<pil.permutationIdentities.length; i++) {
        const peCtx = {};
        const pi = pil.permutationIdentities[i];

        let tExp = null;
        for (let j=0; j<pi.t.length; j++) {
            const e = E.exp(pi.t[j],0,stage);
            if (tExp) {
                tExp = E.add(E.mul(alpha, tExp), e);
            } else {
                tExp = e;
            }
        }
        if (pi.selT !== null) {
            tExp = E.sub(tExp, beta);
            tExp = E.mul(tExp, E.exp(pi.selT,0,stage));
            tExp = E.add(tExp, beta);
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
                fExp = E.add(E.mul(fExp, alpha), e);
            } else {
                fExp = e;
            }
        }
        if (pi.selF !== null) {
            fExp = E.sub(fExp, beta);
            fExp = E.mul(fExp, E.exp(pi.selF,0,stage));
            fExp = E.add(fExp, beta);
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
            const l1 = E.const(pil.references["Global.L1"].id, 0, 0, 1);
            c1 = E.mul(l1,  E.sub(z, E.number(1)));
        }

        c1.deg=2;
        pil.expressions.push(c1);
        let c1Id = pil.expressions.length - 1;
        pil.polIdentities.push({e: c1Id, boundary: "firstRow", fileName: pi.fileName, line: pi.line });
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
        pil.polIdentities.push({e: c2Id, boundary: "everyRow", fileName: pi.fileName, line: pi.line });
        let c2Dim = getExpDim(pil.expressions, c2Id, stark);
        pil.expressions[c2Id].dim = c2Dim;

        const hint = {
            name: "gprod",
            stage,
            reference: z,
            numerator: `Permutation${i}.num`,
            denominator: `Permutation${i}.den`,
        };

        hints.push(hint);

        symbols.push({ type: "tmpPol", name: `Permutation${i}.f`, expId: peCtx.fExpId, stage, dim: fDim, airId: 0, subproofId: 0 });
        symbols.push({ type: "tmpPol", name: `Permutation${i}.t`, expId: peCtx.tExpId, stage, dim: tDim, airId: 0, subproofId: 0 });
        symbols.push({ type: "tmpPol", name: `Permutation${i}.num`, expId: peCtx.numId, stage, dim: numDim, airId: 0, subproofId: 0 });
        symbols.push({ type: "tmpPol", name: `Permutation${i}.den`, expId: peCtx.denId, stage, dim: denDim, airId: 0, subproofId: 0 });
        symbols.push({ type: "witness", name: `Permutation${i}.z`, polId: peCtx.zId, stage, dim: Math.max(numDim, denDim), airId: 0, subproofId: 0 });
    }
}
