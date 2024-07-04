
const ExpressionOps = require("../helpers/expressionops");
const { getExpDim } = require("../helpers/helpers");


module.exports.generateFRIPolynomial = function generateFRIPolynomial(res, symbols, expressions) {
    const E = new ExpressionOps();

    const stage = res.nStages + 3;

    const vf1_id = symbols.filter(s => s.type === "challenge" && s.stage < stage).length;
    const vf2_id = vf1_id + 1;
    
    const vf1_symbol = {type: "challenge", name: "std_vf1", stage, dim: 3, stageId: 0, id: vf1_id};
    const vf2_symbol = {type: "challenge", name: "std_vf2", stage, dim: 3, stageId: 1, id: vf2_id};

    symbols.push(vf1_symbol);
    symbols.push(vf2_symbol);

    res.challengesMap[vf1_symbol.id] = {name: vf1_symbol.name, stage: vf1_symbol.stage, dim: vf1_symbol.dim, stageId: vf1_symbol.stageId};
    res.challengesMap[vf2_symbol.id] = {name: vf2_symbol.name, stage: vf2_symbol.stage, dim: vf2_symbol.dim, stageId: vf2_symbol.stageId};

    const vf1 = E.challenge("std_vf1", stage, 3, 0, vf1_id);
    const vf2 = E.challenge("std_vf2", stage, 3, 1, vf2_id);

    let friExp = null;

    let friExps = {};
    for (let i=0; i<res.evMap.length; i++) {
        const ev = res.evMap[i];
        const symbol = ev.type === "const" 
            ? symbols.find(s => s.polId === ev.id && s.type === "fixed" && s.airId === res.airId && s.subproofId === res.subproofId)
            : symbols.find(s => s.polId === ev.id && s.type !== "fixed" && s.airId === res.airId && s.subproofId === res.subproofId);
        const e = E[ev.type](ev.id, 0, symbol.stage, symbol.dim);
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
    res.friExpId = friExpId;
    expressions.push(friExp);
    expressions[friExpId].dim = getExpDim(expressions, friExpId, true);
}
