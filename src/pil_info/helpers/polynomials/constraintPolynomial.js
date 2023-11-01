const ExpressionOps = require("../../expressionops");

module.exports.generateConstraintPolynomial = function generateConstraintPolynomial(res, expressions, constraints, stark) {

    const E = new ExpressionOps();

    const dim = stark ? 3 : 1;
    const stage = res.numChallenges.length + 1;

    const vc = E.challenge("vc", stage, dim, 0);
    vc.expDeg = 0;

    res.constraintFrames = [];
    
    let multipleBoundaries = false;
    if(constraints.filter(c => c.boundary !== "everyRow").length > 0) multipleBoundaries = true;
    let cExp = null;
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
        let e = E.exp(constraints[i].e);
        if(stark && multipleBoundaries) e = E.mul(zi, e);
        cExp = cExp ? E.add(E.mul(vc, cExp), e) : e;
    }

    res.cExpId = expressions.length;
    expressions.push(cExp);
}
