
const ExpressionOps = require("../../expressionops");
const { getExpDim } = require("../helpers");


module.exports = function generateFRIPolynomial(res, symbols, expressions) {
    const E = new ExpressionOps();

    const stage = res.nLibStages + 4;

    let vf1Symbol = symbols.find(s => s.type === "challenge" && s.name === "std_vf1");
    let vf1Id = symbols.filter(s => s.type === "challenge" && ((s.stage < stage) || (s.stage == stage && s.stageId < vf1Symbol.stageId))).length;
    const vf1 = E.challenge("vf1", stage, 3, vf1Id);

    let vf2Symbol = symbols.find(s => s.type === "challenge" && s.name === "std_vf2");
    let vf2Id = symbols.filter(s => s.type === "challenge" && ((s.stage < stage) || (s.stage == stage && s.stageId < vf2Symbol.stageId))).length;
    const vf2 = E.challenge("vf2", stage, 3, vf2Id);

    let friExp = null;
    for (let i=0; i<res.nCommitments; i++) {
        const symbol = symbols[i];
        if (friExp) {
            friExp = E.add(E.mul(vf1, friExp), E.cm(i, 0, symbol.stage, symbol.dim));
        } else {
            friExp = E.cm(i, 0, symbol.stage, symbol.dim);
        }
    }
    
    let friExps = {};
    for (let i=0; i<res.evMap.length; i++) {
        const ev = res.evMap[i];
        const e = E[ev.type](ev.id, 0, ev.stage, ev.dim);
        if (friExps[ev.prime]) {
            friExps[ev.prime] = E.add(E.mul(friExps[ev.prime], vf2), E.sub(e,  E.eval(i, 3)));
        } else {
            friExps[ev.prime] = E.sub(e,  E.eval(i, 3));
        }
    }

    for(let i = 0; i < Object.keys(friExps).length; i++) {
        const opening = Number(Object.keys(friExps)[i]);
        const index = res.openingPoints.findIndex(p => p === opening);
        friExps[opening] = E.mul(friExps[opening], E.xDivXSubXi(opening, index));
        if(friExp) {
            friExp = E.add(E.mul(vf1, friExp), friExps[opening]);
        } else {
            friExp = friExps[opening];
        }
    }

    let friExpId = expressions.length;
    expressions.push(friExp);
    let friDim = getExpDim(expressions, friExpId, true);
    expressions[friExpId].dim = friDim;

    return friExpId;
}
