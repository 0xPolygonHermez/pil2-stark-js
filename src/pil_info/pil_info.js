
const generateConstraintPolynomial = require("./helpers/cp_prover");
const generateConstraintPolynomialVerifierCode = require("./helpers/cp_ver");

const generateFRIPolynomial = require("./helpers/fri_prover");

const map = require("./map.js");

const { fixCode, setDimensions } = require("./helpers/helpers.js");
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
    }


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
