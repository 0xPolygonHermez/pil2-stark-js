const {generateFRIPolynomial} = require("./polynomials/friPolinomial");

const { generateConstraintPolynomialCode, generateConstraintPolynomialVerifierCode, generateFRICode, generateConstraintsDebugCode, generateExpressionsCode, generateStagesCode } = require("./code/generateCode");
const { addInfoExpressionsSymbols } = require("./helpers");

module.exports.generatePilCode = function generatePilCode(res, symbols, constraints, expressions, hints, debug, stark) {
    
    const expressionsInfo = {
        code: {},
    }

    for(let i = 0; i < expressions.length; i++) {
        addInfoExpressionsSymbols(symbols, expressions, expressions[i], stark);
    }

    generateStagesCode(res, expressionsInfo, symbols, expressions, stark);

    expressionsInfo.expressionsCode = generateExpressionsCode(res, symbols, expressions, stark);

    if(!debug) {
        generateConstraintPolynomialCode(res, expressionsInfo, symbols, constraints, expressions, stark);
        generateConstraintPolynomialVerifierCode(res, expressionsInfo, symbols, expressions, stark);

        if(stark) {
            generateFRIPolynomial(res, symbols, expressions);
            addInfoExpressionsSymbols(symbols, expressions, expressions[res.friExpId], stark);
            generateFRICode(res, expressionsInfo, symbols, expressions);
           
        } 
    }

    expressionsInfo.constraints = generateConstraintsDebugCode(res, symbols, constraints, expressions, stark);

    expressionsInfo.hintsInfo = addHintsInfo(res, symbols, hints);

    return expressionsInfo;
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
                const symbol = symbols.find(s => s.expId === hint[field].id);
                if(!symbol) throw new Error("Something went wrong!");
                const op = symbol.type === "witness" || (symbol.type === "tmpPol" && symbol.imPol) ? "cm" : "tmp";
                const id = symbol.polId;
                hintFields.push({name: field, op, id});
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