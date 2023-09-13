
const ExpressionOps = require("../../expressionops");


module.exports = function generateFRIPolynomial(res, symbols) {
    const E = new ExpressionOps();

    const stage = res.numChallenges.length + 3;

    const vf1 = E.challenge("vf1", stage, 3, 0);

    const vf2 = E.challenge("vf2", stage, 3, 1);

    let friExp = null;
    for (let i=0; i<res.nCommitments; i++) {
        const symbol = symbols.find(s => ["witness", "tmpPol"].includes(s.type) && s.polId === i);
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

    return friExp;
}
