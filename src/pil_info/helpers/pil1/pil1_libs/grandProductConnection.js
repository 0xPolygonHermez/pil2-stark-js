
const ExpressionOps = require("../../../expressionops");
const { getExpDim } = require("../../helpers");

const getKs = require("pilcom").getKs;

module.exports.initChallengesConnection = function initChallengesConnection(stark, firstPossibleStage) {
    const stage = firstPossibleStage ? 2 : 3;
    const dim = stark ? 3 : 1;

    const gamma = {name: "std_gamma", stage, dim, stageId: 0};
    const delta = {name: "std_delta", stage, dim, stageId: 1};

    return [gamma, delta];
}

module.exports.grandProductConnection = function grandProductConnection(pil, symbols, hints, stark, subproofId, airId, firstPossibleStage, F) {
    const E = new ExpressionOps();

    const stage = firstPossibleStage ? 2 : 3;
    const dim = stark ? 3 : 1;

    let gammaSymbol = symbols.find(s => s.type === "challenge" && s.stage === stage && s.stageId === 0);
    const gamma = E.challenge(gammaSymbol.name, gammaSymbol.stage, gammaSymbol.dim, gammaSymbol.stageId, gammaSymbol.id);

    let deltaSymbol = symbols.find(s => s.type === "challenge" && s.stage === stage && s.stageId === 1);
    const delta = E.challenge(deltaSymbol.name, deltaSymbol.stage, deltaSymbol.dim, deltaSymbol.stageId, deltaSymbol.id);

    for (let i=0; i<pil.connectionIdentities.length; i++) {
        const ci = pil.connectionIdentities[i];
        const ciCtx = {};

        ciCtx.zId = pil.nCommitments++;

        let numExp = E.add(
            E.add(
                E.exp(ci.pols[0],0,stage),
                E.mul(delta, E.x())
            ), gamma);

        let denExp = E.add(
            E.add(
                E.exp(ci.pols[0],0,stage),
                E.mul(delta, E.exp(ci.connections[0],0,stage))
            ), gamma);

        ciCtx.numId = pil.expressions.length;
        numExp.stage = stage;
        pil.expressions.push(numExp);
        let nDim = getExpDim(pil.expressions, ciCtx.numId, stark);
        pil.expressions[ciCtx.numId].dim = nDim;

        ciCtx.denId = pil.expressions.length;
        denExp.stage = stage;
        pil.expressions.push(denExp);
        let dDim = getExpDim(pil.expressions, ciCtx.denId, stark);
        pil.expressions[ciCtx.denId].dim = dDim;

        let ks = getKs(F, ci.pols.length-1);
        for (let i=1; i<ci.pols.length; i++) {
            const numExp =
                E.mul(
                    E.exp(ciCtx.numId,0,stage),
                    E.add(
                        E.add(
                            E.exp(ci.pols[i],0,stage),
                            E.mul(E.mul(delta, E.number(ks[i-1])), E.x())
                        ),
                        gamma
                    )
                );
            numExp.keep = true;

            const denExp =
                E.mul(
                    E.exp(ciCtx.denId,0,stage),
                    E.add(
                        E.add(
                            E.exp(ci.pols[i]),
                            E.mul(delta, E.exp(ci.connections[i],0,stage))
                        ),
                        gamma
                    )
                );
            denExp.keep = true;

            ciCtx.numId = pil.expressions.length;
            numExp.stage = stage;
            pil.expressions.push(numExp);
            let numDim = getExpDim(pil.expressions, ciCtx.numId, stark);
            pil.expressions[ciCtx.numId].dim = numDim;

            ciCtx.denId = pil.expressions.length;
            denExp.stage = stage;
            pil.expressions.push(denExp);
            let denDim = getExpDim(pil.expressions, ciCtx.denId, stark);
            pil.expressions[ciCtx.denId].dim = denDim;
        }

        const z = E.cm(ciCtx.zId, 0, stage, dim);
        const zp = E.cm(ciCtx.zId, 1, stage, dim);
        z.stageId = pil.nCm2++;

        if ( typeof pil.references["Global.L1"] === "undefined") throw new Error("Global.L1 must be defined");
        const l1 = E.const(pil.references["Global.L1"].id, 0, 0, 1);
        let c1 = E.mul(l1,  E.sub(z, E.number(1)));
        

        c1.deg=2;
        c1.stage = 2;
        pil.expressions.push(c1);
        let c1Id = pil.expressions.length - 1;
        pil.polIdentities.push({e: c1Id, boundary: "everyRow", fileName: ci.fileName, line: ci.line });
        let c1Dim = getExpDim(pil.expressions, c1Id, stark);
        pil.expressions[c1Id].dim = c1Dim;

        const c2 = E.sub(  E.mul(zp,  E.exp(ciCtx.denId,0,stage)), E.mul(z, E.exp(ciCtx.numId,0,stage)));
        c2.deg=2;
        c2.stage = 2;
        pil.expressions.push(c2);
        let c2Id = pil.expressions.length - 1;
        pil.polIdentities.push({e: c2Id, boundary: "everyRow", fileName: ci.fileName, line: ci.line });
        let c2Dim = getExpDim(pil.expressions, c2Id, stark);
        pil.expressions[c2Id].dim = c2Dim;

        const numDim = getExpDim(pil.expressions, ciCtx.numId, stark);
        const denDim = getExpDim(pil.expressions, ciCtx.denId, stark);

        symbols.push({ type: "witness", name: `Connection${i}.z`, polId: ciCtx.zId, stage, dim: Math.max(numDim, denDim), airId, subproofId});

        const hint = {
            name: "gprod",
            reference: z,
            numerator: E.exp(ciCtx.numId, 0, stage),
            denominator: E.exp(ciCtx.denId, 0, stage),
        };

        hints.push(hint);
    }
}
