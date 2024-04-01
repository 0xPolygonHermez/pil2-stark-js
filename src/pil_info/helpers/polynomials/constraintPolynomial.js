const ExpressionOps = require("../../expressionops");
const { getExpDim } = require("../helpers");

module.exports.generateConstraintPolynomial = function generateConstraintPolynomial(res, expressions, symbols, constraints, stark) {

    const E = new ExpressionOps();

    const dim = stark ? 3 : 1;
    const stage = res.nStages + 1;

    const vc_id = symbols.filter(s => s.type === "challenge" && s.stage < stage).length;
    symbols.push({type: "challenge", name: "std_vc", stage: stage, dim: 3, stageId: 0, id: vc_id})

    const vc = E.challenge("std_vc", stage, dim, 0, vc_id);

    vc.expDeg = 0;
    
    res.cExpId = expressions.length;

    let multipleBoundaries = false;
    if(constraints.filter(c => c.boundary !== "everyRow").length > 0) multipleBoundaries = true;
    for (let i=0; i<constraints.length; i++) {
        const boundary = constraints[i].boundary;
        if(!["everyRow", "firstRow", "lastRow", "everyFrame"].includes(boundary)) throw new Error("Boundary " + boundary + " not supported");
        let zi;
        if(boundary === "everyFrame") {
            let boundaryId = res.boundaries.findIndex(b => b.name === "everyFrame" && b.offsetMin === constraints[i].offsetMin && b.offsetMax === constraints[i].offsetMax);
            if(boundaryId == -1) {
                res.boundaries.push({name: "everyFrame", offsetMin: constraints[i].offsetMin, offsetMax: constraints[i].offsetMax})
                boundaryId = res.boundaries.length - 1;
            }
            zi = E.zi(boundaryId);
        } else {
            let boundaryId = res.boundaries.findIndex(b => b.name === boundary);
            if(boundaryId == -1) {
                res.boundaries.push({ name: boundary });
                boundaryId = res.boundaries.length - 1;
            }
            
            zi = E.zi(boundaryId);
        }
        let e = E.exp(constraints[i].e, 0, stage);
        if(stark && multipleBoundaries) e = E.mul(zi, e);
        if(expressions.length === res.cExpId) {
            expressions.push(e);
        } else {
            expressions[res.cExpId] = E.add(E.mul(vc, expressions[res.cExpId]), e)
        }
    }
    
    res.qDim = getExpDim(expressions, res.cExpId, stark);

    const xi_id = symbols.filter(s => s.type === "challenge" && s.stage < stage + 1).length;
    symbols.push({type: "challenge", name: "std_xi", stage: stage + 1, dim: 3, stageId: 0, id: xi_id})
}
