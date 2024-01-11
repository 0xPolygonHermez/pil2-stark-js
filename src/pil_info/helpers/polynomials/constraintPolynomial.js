const ExpressionOps = require("../../expressionops");
const { getExpDim } = require("../helpers");

module.exports.generateConstraintPolynomial = function generateConstraintPolynomial(res, expressions, constraints, stark) {

    const E = new ExpressionOps();

    const dim = stark ? 3 : 1;
    const stage = res.numChallenges.length + 1;

    const vc = E.challenge("vc", stage, dim, 0);
    vc.stageId = 0;
    vc.expDeg = 0;

    res.constraintFrames = [];
    
    res.cExpId = expressions.length;

    let multipleBoundaries = false;
    if(constraints.filter(c => c.boundary !== "everyRow").length > 0) multipleBoundaries = true;
    for (let i=0; i<constraints.length; i++) {
        const boundary = constraints[i].boundary;
        if(!["everyRow", "firstRow", "lastRow", "everyFrame"].includes(boundary)) throw new Error("Boundary " + boundary + " not supported");
        if(!res.boundaries.includes(boundary)) res.boundaries.push(boundary);
        let zi;
        if(boundary === "everyFrame") {
            let frameId = res.constraintFrames.findIndex(f => f.offsetMin ===  constraints[i].offsetMin && f.offsetMax === constraints[i].offsetMax);
            if(frameId == -1) {
                res.constraintFrames.push({offsetMin: constraints[i].offsetMin, offsetMax: constraints[i].offsetMax})
                frameId = res.constraintFrames.length - 1;
            }
            zi = E.zi(boundary, frameId);
        } else {
            zi = E.zi(boundary);
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
}
