
const ExpressionOps = require("../../../expressionops");
const { getExpDim } = require("../../helpers");

const getKs = require("pilcom").getKs;

module.exports.grandProductConnection = function grandProductConnection(res, pil, symbols, hints, stark, F) {
    const E = new ExpressionOps();

    const gamma = E.challenge("stage1_challenge0", 2);
    const delta = E.challenge("stage1_challenge1", 2);

    for (let i=0; i<pil.connectionIdentities.length; i++) {
        const ci = pil.connectionIdentities[i];
        const ciCtx = {};

        ciCtx.zId = pil.nCommitments++;

        let numExp = E.add(
            E.add(
                E.exp(ci.pols[0],0,2),
                E.mul(delta, E.x())
            ), gamma);

        let denExp = E.add(
            E.add(
                E.exp(ci.pols[0],0,2),
                E.mul(delta, E.exp(ci.connections[0],0,2))
            ), gamma);

        ciCtx.numId = pil.expressions.length;
        numExp.keep = true;
        numExp.stage = 2;
        pil.expressions.push(numExp);

        ciCtx.denId = pil.expressions.length;
        denExp.keep = true;
        denExp.stage = 2
        pil.expressions.push(denExp);

        let ks = getKs(F, ci.pols.length-1);
        for (let i=1; i<ci.pols.length; i++) {
            const numExp =
                E.mul(
                    E.exp(ciCtx.numId,0,2),
                    E.add(
                        E.add(
                            E.exp(ci.pols[i],0,2),
                            E.mul(E.mul(delta, E.number(ks[i-1])), E.x())
                        ),
                        gamma
                    )
                );
            numExp.keep = true;

            const denExp =
                E.mul(
                    E.exp(ciCtx.denId,0,2),
                    E.add(
                        E.add(
                            E.exp(ci.pols[i]),
                            E.mul(delta, E.exp(ci.connections[i],0,2))
                        ),
                        gamma
                    )
                );
            denExp.keep = true;

            ciCtx.numId = pil.expressions.length;
            numExp.stage = 2;
            pil.expressions.push(numExp);

            ciCtx.denId = pil.expressions.length;
            denExp.stage = 2;
            pil.expressions.push(denExp);
        }

        const z = E.cm(ciCtx.zId, 0, 2);
        const zp = E.cm(ciCtx.zId, 1, 2);

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


        const c2 = E.sub(  E.mul(zp,  E.exp(ciCtx.denId,0,2)), E.mul(z, E.exp(ciCtx.numId,0,2)));
        c2.deg=2;
        pil.expressions.push(c2);
        pil.polIdentities.push({e: pil.expressions.length - 1, boundary: "everyRow"});

        
        const stage1 = {
            pols: {
                num: {id: ciCtx.numId, tmp: true},
                den: {id: ciCtx.denId, tmp: true},
                z: {id: ciCtx.zId},
            },
            hints: [
                {
                    inputs: ["num", "den"], 
                    outputs: ["z"], 
                    lib: "calculateZ"
                }
            ]
        }

        const numDim = getExpDim(pil.expressions, ciCtx.numId, stark);
        symbols.push({ type: "tmpPol", name: `Connection${i}.num`, expId: ciCtx.numId, stage: 2, dim: numDim });

        const denDim = getExpDim(pil.expressions, ciCtx.denId, stark);
        symbols.push({ type: "tmpPol", name: `Connection${i}.den`, expId: ciCtx.denId, stage: 2, dim: denDim });

        symbols.push({ type: "witness", name: `Connection${i}.z`, polId: ciCtx.zId, stage: 2, dim: Math.max(numDim, denDim) });

        const hint = {
            stage: 2,
            inputs: [`Connection${i}.num`, `Connection${i}.den`], 
            outputs: [`Connection${i}.z`], 
            lib: "calculateZ"
        };

        hints.push(hint);
    }
}
