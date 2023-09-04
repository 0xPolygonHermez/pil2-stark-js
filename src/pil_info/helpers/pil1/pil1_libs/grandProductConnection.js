
const ExpressionOps = require("../../../expressionops");
const { getExpDim } = require("../../helpers");

const getKs = require("pilcom").getKs;

module.exports.grandProductConnection = function grandProductConnection(pil, symbols, hints, stark, F) {
    const E = new ExpressionOps();

    const stage = 2;
    const dim = stark ? 3 : 1;

    const gamma = E.challenge("stage1_challenge0", stage, dim);
    const delta = E.challenge("stage1_challenge1", stage, dim);

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
        numExp.keep = true;
        numExp.stage = stage;
        pil.expressions.push(numExp);
        let nDim = getExpDim(pil.expressions, ciCtx.numId, stark);
        pil.expressions[ciCtx.numId].dim = nDim;

        ciCtx.denId = pil.expressions.length;
        denExp.keep = true;
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

        const c2 = E.sub(  E.mul(zp,  E.exp(ciCtx.denId,0,stage)), E.mul(z, E.exp(ciCtx.numId,0,stage)));
        c2.deg=2;
        pil.expressions.push(c2);
        let c2Id = pil.expressions.length - 1;
        pil.polIdentities.push({e: c2Id, boundary: "everyRow"});
        let c2Dim = getExpDim(pil.expressions, c2Id, stark);
        pil.expressions[c2Id].dim = c2Dim;

        const numDim = getExpDim(pil.expressions, ciCtx.numId, stark);
        symbols.push({ type: "tmpPol", name: `Connection${i}.num`, expId: ciCtx.numId, stage, dim: numDim });

        const denDim = getExpDim(pil.expressions, ciCtx.denId, stark);
        symbols.push({ type: "tmpPol", name: `Connection${i}.den`, expId: ciCtx.denId, stage, dim: denDim });

        symbols.push({ type: "witness", name: `Connection${i}.z`, polId: ciCtx.zId, stage, dim: Math.max(numDim, denDim) });

        const hint = {
            stage,
            inputs: [`Connection${i}.num`, `Connection${i}.den`], 
            outputs: [`Connection${i}.z`], 
            lib: "calculateZ"
        };

        hints.push(hint);
    }
}
