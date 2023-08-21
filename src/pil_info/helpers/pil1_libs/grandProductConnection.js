
const ExpressionOps = require("../../expressionops");

const getKs = require("pilcom").getKs;

module.exports.grandProductConnection = function grandProductConnection(res, pil, F) {
    const E = new ExpressionOps();

    const gamma = E.challenge("stage1_challenge0");
    const delta = E.challenge("stage1_challenge1");

    for (let i=0; i<pil.connectionIdentities.length; i++) {
        const name = `Connection${i}`;
        res.libs[name] = [];

        const ci = pil.connectionIdentities[i];
        const ciCtx = {};

        ciCtx.zId = pil.nCommitments++;

        let numExp = E.add(
            E.add(
                E.exp(ci.pols[0]),
                E.mul(delta, E.x())
            ), gamma);

        let denExp = E.add(
            E.add(
                E.exp(ci.pols[0]),
                E.mul(delta, E.exp(ci.connections[0]))
            ), gamma);

        ciCtx.numId = pil.expressions.length;
        numExp.keep = true;
        pil.expressions.push(numExp);

        ciCtx.denId = pil.expressions.length;
        denExp.keep = true;
        pil.expressions.push(denExp);

        let ks = getKs(F, ci.pols.length-1);
        for (let i=1; i<ci.pols.length; i++) {
            const numExp =
                E.mul(
                    E.exp(ciCtx.numId),
                    E.add(
                        E.add(
                            E.exp(ci.pols[i]),
                            E.mul(E.mul(delta, E.number(ks[i-1])), E.x())
                        ),
                        gamma
                    )
                );
            numExp.keep = true;

            const denExp =
                E.mul(
                    E.exp(ciCtx.denId),
                    E.add(
                        E.add(
                            E.exp(ci.pols[i]),
                            E.mul(delta, E.exp(ci.connections[i]))
                        ),
                        gamma
                    )
                );
            denExp.keep = true;

            ciCtx.numId = pil.expressions.length;
            pil.expressions.push(numExp);

            ciCtx.denId = pil.expressions.length;
            pil.expressions.push(denExp);
        }

        const z = E.cm(ciCtx.zId);
        const zp = E.cm(ciCtx.zId, true);

        if ( typeof pil.references["Global.L1"] === "undefined") throw new Error("Global.L1 must be defined");

        const l1 = E.const(pil.references["Global.L1"].id);

        const c1 = E.mul(l1,  E.sub(z, E.number(1)));
        c1.deg=2;
        pil.expressions.push(c1);
        pil.polIdentities.push({e: pil.expressions.length - 1});


        const c2 = E.sub(  E.mul(zp,  E.exp( ciCtx.denId )), E.mul(z, E.exp( ciCtx.numId )));
        c2.deg=2;
        pil.expressions.push(c2);
        pil.polIdentities.push({e: pil.expressions.length - 1});

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
        res.libs[name].push(stage1);
    }
}