const {generateFRIPolynomial} = require("./polynomials/friPolinomial");

const { generateConstraintPolynomialVerifierCode, generateConstraintsDebugCode, generateExpressionsCode, generateFRIVerifierCode } = require("./code/generateCode");
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

    expressionsInfo.hintsInfo = module.exports.addHintsInfo(res, expressions, hints);

    expressionsInfo.expressionsCode = generateExpressionsCode(res, symbols, expressions, stark);

    expressionsInfo.constraints = generateConstraintsDebugCode(res, symbols, constraints, expressions, stark);

    return {expressionsInfo, verifierInfo};
}


module.exports.addHintsInfo = function addHintsInfo(res, expressions, hints) {
    const hintsInfo = [];
    for(let i = 0; i < hints.length; ++i) {
        const hint = hints[i];

        const hintFields = [];
    
        for(let j = 0; j < hint.fields.length; ++j) {
            const field = hint.fields[j];
            const hintField = { 
                name: field.name,
                values: processHintFieldValue(field.values, res, expressions).flat(Infinity),
            };

            if(!field.lengths) hintField.values[0].pos = [];
            hintFields.push(hintField);
        }

        hintsInfo[i] = {
            name: hint.name,
            fields: hintFields,
        }
    }

    delete res.hints;

    return hintsInfo;
}

function processHintFieldValue(values, res, expressions, pos = []) {
    const processedFields = [];

    for (let j = 0; j < values.length; ++j) {
        const field = values[j];

        const currentPos = [...pos, j];

        if (Array.isArray(field)) {
            processedFields.push(processHintFieldValue(field, res, expressions, currentPos));
        } else {
            let processedField;
            if (field.op === "exp") {
                expressions[field.id].line = printExpressions(res, expressions[field.id], expressions);
                processedField = { op: "tmp", id: field.id, dim: expressions[field.id].dim, pos: currentPos };
            } else if (["cm", "custom", "challenge", "public", "airgroupvalue", "airvalue", "const", "number", "string"].includes(field.op)) {
                processedField = { ...field, pos: currentPos };
            } else {
                throw new Error("Invalid hint op: " + field.op);
            }
            processedFields.push(processedField);
        }
    }
    return processedFields;
}