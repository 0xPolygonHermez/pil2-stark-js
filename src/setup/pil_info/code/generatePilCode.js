const {generateFRIPolynomial} = require("../polynomials/friPolinomial");

const { generateConstraintPolynomialVerifierCode, generateConstraintsDebugCode, generateExpressionsCode, generateFRIVerifierCode, generateImPolynomialsCode } = require("./generateCode");
const { addInfoExpressionsSymbols } = require("../helpers/helpers");

module.exports.generatePilCode = function generatePilCode(res, symbols, constraints, expressions, hints, debug, stark = true) {
    
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

    expressionsInfo.imPolsCode = generateImPolynomialsCode(res, symbols, expressions, stark);

    expressionsInfo.expressionsCode = generateExpressionsCode(res, symbols, expressions, stark);

    expressionsInfo.constraints = generateConstraintsDebugCode(res, symbols, constraints, expressions, stark);

    expressionsInfo.hintsInfo = addHintsInfo(res, symbols, hints);

    return {expressionsInfo, verifierInfo};
}


function addHintsInfo(res, symbols, hints) {
    const hintsInfo = [];
    for(let i = 0; i < hints.length; ++i) {
        const hint = hints[i];

        const hintFields = [];

        const fields = Object.keys(hint);
    
        for(let j = 0; j < fields.length; ++j) {
            const field = fields[j];
            if(field === "name") continue;
            if(hint[field].op === "exp") {
                const symbol = symbols.find(s => s.type === "witness" && s.expId === hint[field].id);
                const fieldInfo = symbol 
                    ? {name: field, op: "cm", id: symbol.id}
                    : {name: field, op: "tmp", expId: hint[field].id};
                hintFields.push(fieldInfo);
            } else if(["cm", "challenge", "public"].includes(hint[field].op)) {
                hintFields.push({name: field, op: hint[field].op, id: hint[field].id});
            } else if(["public", "subproofValue", "const"].includes(hint[field].op)) {
                hintFields.push({name: field, op: hint[field].op, id: hint[field].id});
            } else if(hint[field].op === "number") {
                hintFields.push({name: field, op: "number", value: hint[field].value});
            } else throw new Error("Invalid hint op: " + hint[field].op);
        }


        hintsInfo[i] = {
            name: hint.name,
            fields: hintFields,
        }
    }

    delete res.hints;

    return hintsInfo;
}