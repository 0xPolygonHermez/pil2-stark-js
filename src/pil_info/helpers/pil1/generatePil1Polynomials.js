const { log2 } = require("pilcom/src/utils");
const ExpressionOps = require("../../expressionops");
const generateLibsPolynomials = require("./generateLibsPolynomials");
const generatePublicsPolynomials = require("./generatePublicsPolynomials");

module.exports.generatePil1Polynomials = function generatePil1Polynomials(F, res, _pil, stark) {
    const E = new ExpressionOps();
    const pil = JSON.parse(JSON.stringify(_pil));    // Make a copy as we are going to destroy the original

    res.nPublics = pil.publics.length;
    res.nConstants = pil.nConstants;

    const publics = generatePublicsPolynomials(res, pil);

    const symbols = [];

    const hints = [];

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
                symbols.push({type, name: namePol, polId, stage, dim: 1 });
                if(type === "witness") E.cm(polId, 0, stage, 1);
            }
        } else {
            symbols.push({type, name, polId: polInfo.id, stage, dim: 1 });
            if(type === "witness") E.cm(polInfo.id, 0, stage, 1);
        }
    }

    generateLibsPolynomials(F, res, pil, symbols, hints, stark);

    res.nCommitments = pil.nCommitments;
    res.pilPower = log2(Object.values(pil.references)[0].polDeg);

    const expressions = [...pil.expressions];
    const constraints = [...pil.polIdentities]

    for(let i = 0; i < constraints.length; i++) {
        if(!constraints[i].boundary) {
            constraints[i].boundary = "everyRow";
        }   
    }

    if(stark) {
        if (res.starkStruct.nBits != res.pilPower) {
            throw new Error(`starkStruct and pilfile have degree mismatch (starkStruct:${res.starkStruct.nBits} pilfile:${res.pilPower})`);
        }

        if (res.starkStruct.nBitsExt != res.starkStruct.steps[0].nBits) {
            throw new Error(`starkStruct.nBitsExt and first step of starkStruct have a mismatch (nBitsExt:${res.starkStruct.nBitsExt} pil:${res.starkStruct.steps[0].nBits})`);
        }
    }

    return { publics, symbols, hints, expressions, constraints };
}
