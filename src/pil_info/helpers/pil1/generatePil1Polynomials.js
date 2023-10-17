const { log2 } = require("pilcom/src/utils");
const ExpressionOps = require("../../expressionops");
const generateLibsPolynomials = require("./generateLibsPolynomials");

module.exports.generatePil1Polynomials = function generatePil1Polynomials(F, res, _pil, stark) {
    const E = new ExpressionOps();
    const pil = JSON.parse(JSON.stringify(_pil));    // Make a copy as we are going to destroy the original

    res.nPublics = pil.publics.length;
    res.nConstants = pil.nConstants;

    const symbols = [];

    const hints = [];

    res.subproofId = 0;
    res.airId = 0;

    for (const polRef in pil.references) {
        const polInfo = pil.references[polRef];
        if(polInfo.type === "imP") continue;
        const type = polInfo.type === 'constP' ? "fixed" : "witness";
        const stage = type === "witness" ? 1 : 0;
        let name = polRef;
        if(polInfo.isArray) {
            for(let i = 0; i < polInfo.len; ++i) {
                const namePol = name + i;
                const polId = polInfo.id + i;
                symbols.push({type, name: namePol, polId, stage, dim: 1, subproofId: 0, airId: 0 });
                if(type === "witness") E.cm(polId, 0, stage, 1);
            }
        } else {
            symbols.push({type, name, polId: polInfo.id, stage, dim: 1, subproofId: 0, airId: 0 });
            if(type === "witness") E.cm(polInfo.id, 0, stage, 1);
        }
    }

    generateLibsPolynomials(F, res, pil, symbols, hints, stark);

    res.nCommitments = pil.nCommitments;
    res.pilPower = log2(Object.values(pil.references)[0].polDeg);

    const expressions = [...pil.expressions];
    const constraints = [...pil.polIdentities]
    const publicsInfo = pil.publics;

    for(let i = 0; i < constraints.length; i++) {
        if(!constraints[i].boundary) {
            constraints[i].boundary = "everyRow";
        }   
    }

    return { publicsInfo, symbols, hints, expressions, constraints };
}
