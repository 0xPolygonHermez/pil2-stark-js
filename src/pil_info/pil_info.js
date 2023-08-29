
const generateConstraintPolynomial = require("./helpers/cp_prover");
const generateConstraintPolynomialVerifierCode = require("./helpers/cp_ver");

const generateFRIPolynomial = require("./helpers/fri_prover");

const map = require("./map.js");

const { fixCode, setDimensions, addInfoExpressions } = require("./helpers/helpers.js");
const { generatePil1Polynomials } = require("./helpers/pil1/generatePil1Polynomials");
const { generateConstraintPolynomialCode, generateFRICode, generatePublicsCode, generateLibsCode } = require("./helpers/generateCode");

module.exports = function pilInfo(F, pil, stark = true, pil1 = true, starkStruct) {
    const res = {
        cmPolsMap: [],
        challengesMap: [],
        libs: {},
        code: {},
        nLibStages: 0,
        starkStruct: starkStruct,
    };

    let expressions, symbols, constraints, publics;

    if(pil1) {
        ({expressions, symbols, constraints, publics} = generatePil1Polynomials(F, res, pil, stark));
    } else {
        constraints = pil.constraints.map(c => {
            let boundary = Object.keys(c)[0];
            let constraint = {
                boundary,
                expId: c[boundary].expressionIdx,
                debugLine: c[boundary].debugLine,
            }

            if(boundary === "everyFrame") {
                constraint.offsetMin = c[boundary].offsetMin;
                constraint.offsetMax = c[boundary].offsetMax;
            }
            return constraint;
        });

        symbols = pil.symbols.map(s => {
            return {
                name: s.name,
                stage: s.stage,
                type: s.type === 1 ? "fixed" : s.type === 3 ? "witness" : undefined,
                polId: s.id,
            }
        });

        expressions = pil.expressions;
        for(let i = 0; i < expressions.length; ++i) {
            expressions[i] = formatExpression(expressions, expressions[i]);
        }
    }

    for(let i = 0; i < constraints.length; ++i) {
        addInfoExpressions(expressions, expressions[constraints[i].e]);
    }
    
    res.openingPoints = [0, ... new Set(constraints.reduce((acc, c) => { return acc.concat(expressions[c.e].rowsOffsets)}, []))].sort();

    generateConstraintPolynomial(res, expressions, constraints, stark);

    generatePublicsCode(res, expressions, constraints, publics);
    generateLibsCode(res, expressions, constraints);
    generateConstraintPolynomialCode(res, expressions, constraints);

    map(res, symbols, expressions, stark);       

    generateConstraintPolynomialVerifierCode(res, expressions, constraints, stark);

    if(stark) {
        generateFRIPolynomial(res, expressions);
        generateFRICode(res, expressions, constraints);
    } 

    fixCode(res, stark);

    setDimensions(res, stark);

    delete res.imPolsMap;
    delete res.cExp;
    delete res.friExpId;
    
    return res;

}

function formatExpression(expressions, exp) {
    if(exp.op) return exp;

    let op = Object.keys(exp)[0];

    if(op === "expression") {
        exp = {
            op: op,
            id: exp[op].idx,
            rowOffset: exp[op].rowOffset === 1 ? true : false,
        }
    } else if(["add", "mul", "sub"].includes(op)) {
        const lhs = exp[op].lhs;
        const rhs = exp[op].rhs;
        exp = {
            op: op,
            values: [
                formatExpression(expressions, lhs),
                formatExpression(expressions, rhs),
            ]
        }
    } else if (op === "constant") {
        exp = {
            op: "number",
            value: "1",
        }
    } else if (op === "witnessCol") {
        exp = {
            op: "cm",
            id: exp[op].colIdx,
            rowOffset: exp[op].rowOffset === 1 ? true : false, 
        }
    } else if (op === "fixedCol") {
        exp = {
            op: "const",
            id: exp[op].idx,
            rowOffset: exp[op].rowOffset === 1 ? true : false, 
        }
    } else throw new Error("Unknown op: " + op);

    return exp;
}