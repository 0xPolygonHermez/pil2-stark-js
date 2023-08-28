
const {pilCodeGen, buildCode} = require("../../codegen.js");
const ExpressionOps = require("../../expressionops");


module.exports = function generateFRIPolynomial(res, expressions, constraints, ctxExt) {
    const E = new ExpressionOps();

    const vf1 = E.challenge("vf1");
    const vf2 = E.challenge("vf2");
    
    res.challengesMap.push({stage: "fri", stageId: 0, globalId: vf1.id });
    res.challengesMap.push({stage: "fri", stageId: 1, globalId: vf2.id });


    let friExp = null;
    for (let i=0; i<res.nCommitments; i++) {
        if (friExp) {
            friExp = E.add(E.mul(vf1, friExp), E.cm(i));
        } else {
            friExp = E.cm(i);
        }
    }

    let friExps = {};
    for (let i=0; i<res.evMap.length; i++) {
        const ev = res.evMap[i];
        const e = E[ev.type](ev.id);
        if (friExps[ev.prime]) {
            friExps[ev.prime] = E.add(E.mul(friExps[ev.prime], vf2), E.sub(e,  E.eval(i)));
        } else {
            friExps[ev.prime] = E.sub(e,  E.eval(i));
        }
    }

    res.fri2Id = {};
    res.nFriOpenings = 0;

    for(let i = 0; i < Object.keys(friExps).length; i++) {
        const opening = Number(Object.keys(friExps)[i]);
        if(!res.fri2Id[opening]) {
            res.fri2Id[opening] = res.nFriOpenings++;
        }   
        friExps[opening] = E.mul(friExps[opening], E.xDivXSubXi(opening));
        if(friExp) {
            friExp = E.add(E.mul(vf1, friExp), friExps[opening]);
        } else {
            friExp = friExps[opening];
        }
    }

    res.friExpId = expressions.length;
    expressions.push(friExp);

    pilCodeGen(ctxExt, expressions, constraints, res.friExpId, 0);

    const code = ctxExt.code[ctxExt.code.length-1].code;

    code[code.length-1].dest = { type: "f", id: 0 };

    res.code["fri"] = buildCode(ctxExt, expressions);

}
