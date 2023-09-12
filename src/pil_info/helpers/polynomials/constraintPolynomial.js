const ExpressionOps = require("../../expressionops");
const { getExpDim } = require("../helpers");
const { calculateIntermediatePolynomials } = require("./imPolynomials");
const _ = require("lodash");

module.exports = function generateConstraintPolynomial(res, symbols, expressions, constraints, stark) {

    const E = new ExpressionOps();

    const dim = stark ? 3 : 1;
    const stage = res.numChallenges.length + 1;

    const vc = E.challenge("vc", stage, dim, 0);
    vc.expDeg = 0;

    res.boundaries = ["everyRow"];

    res.constraintFrames = [];
    
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
        if(stark) e = E.mul(zi, e);
        cExp = cExp ? E.add(E.mul(vc, cExp), e) : e;
    }

    let cExpId = expressions.length;
    expressions.push(cExp);

    let maxDeg;
    if(stark) {
        maxDeg = (1 << (res.starkStruct.nBitsExt- res.starkStruct.nBits)) + 1;
    } else {
        maxDeg = Math.pow(2,3) + 1;
    }

    const _expressions = _.cloneDeep(expressions);

    const {newExpressions, qDeg, imExps} = calculateIntermediatePolynomials(_expressions, cExpId, maxDeg);

    expressions.splice(0, expressions.length, ...newExpressions);
    
    console.log("Number of intermediate expressions: " + imExps.length);
    console.log("Q degree: " + qDeg);

    res.qDeg = qDeg;

    for (let i=0; i<imExps.length; i++) {
        const expId = imExps[i];
        const stage = expressions[expId].stage;
        const symbol = symbols.find(s => s.type === "tmpPol" && s.expId === expId);
        const dim = getExpDim(expressions, expId, stark);
        if(!symbol) {
            symbols.push({ type: "tmpPol", name: `ImPol.${expId}`, expId, polId: res.nCommitments++, stage, dim, imPol: true });
        } else {
            symbol.imPol = true;
            symbol.expId = expId;
            symbol.polId = res.nCommitments++;
        };
        let e = {
            op: "sub",
            values: [
                Object.assign({}, expressions[imExps[i]]),
                E.cm(res.nCommitments-1, 0, stage, dim),
            ]
        };
        if(stark) e = E.mul(E.zi("everyRow"), e);
        expressions[cExpId] = E.add(E.mul(vc, expressions[cExpId]), e);
    }

    let cExpDim = getExpDim(expressions, cExpId, stark);
    expressions[cExpId].dim = cExpDim;

    res.qDim = cExpDim;

    if(stark) {
        res.qs = [];
        for (let i=0; i<res.qDeg; i++) {
            res.qs[i] = res.nCommitments++;
            symbols.push({ type: "witness", name: `Q${i}`, polId: res.qs[i], stage: "Q", dim: res.qDim });
            E.cm(res.qs[i], 0, stage, res.qDim);
        }
    }

    return cExpId;
}