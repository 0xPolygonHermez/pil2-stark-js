const {generateFRIPolynomial} = require("./polynomials/friPolinomial");

const { generateConstraintPolynomialVerifierCode, generateConstraintsDebugCode, generateExpressionsCode, generateFRIVerifierCode, generateImPolynomialsCode } = require("./code/generateCode");
const { addInfoExpressionsSymbols } = require("./helpers");
const { printExpressions } = require("./pil2/utils");

module.exports.generatePilCode = function generatePilCode(res, symbols, constraints, expressions, hints, debug, stark) {
    
    const expressionsInfo = {};

    const verifierInfo = {};

    for(let i = 0; i < expressions.length; i++) {
        addInfoExpressionsSymbols(symbols, expressions, expressions[i], stark);
    }

    if(!debug) {
        generateConstraintPolynomialVerifierCode(res, verifierInfo, symbols, expressions, stark);

        if(stark) {
            generateFRIPolynomial(res, symbols, expressions);
            addInfoExpressionsSymbols(symbols, expressions, expressions[res.friExpId], stark);
            generateFRIVerifierCode(res, verifierInfo, symbols, expressions);
        } 
    }

    expressionsInfo.hintsInfo = addHintsInfo(res, expressions, hints);

    expressionsInfo.imPolsCode = generateImPolynomialsCode(res, symbols, expressions, stark);

    expressionsInfo.expressionsCode = generateExpressionsCode(res, symbols, expressions, stark);

    expressionsInfo.constraints = generateConstraintsDebugCode(res, symbols, constraints, expressions, stark);

    return {expressionsInfo, verifierInfo};
}


function addHintsInfo(res, expressions, hints) {
    const hintsInfo = [];
    for(let i = 0; i < hints.length; ++i) {
        const hint = hints[i];

        const hintFields = [];
    
        for(let j = 0; j < hint.fields.length; ++j) {
            const field = hint.fields[j];
            if(field.op === "exp") {
                expressions[field.id].line = printExpressions(res, expressions[field.id], expressions);
                hintFields.push({name: field.name, op: "tmp", id: field.id, dim: expressions[field.id].dim });
            } else if(["cm", "challenge", "public", "subproofValue", "const", "number", "string"].includes(field.op)) {
                hintFields.push(field);
            } else throw new Error("Invalid hint op: " + field.op);
        }


        hintsInfo[i] = {
            name: hint.name,
            fields: hintFields,
        }
    }

    delete res.hints;

    return hintsInfo;
}
