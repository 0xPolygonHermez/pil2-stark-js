
const generateConstraintPolynomial = require("./helpers/quotientPolynomial/cp_prover");
const generateConstraintPolynomialVerifier = require("./helpers/quotientPolynomial/cp_ver");

const generateFRIPolynomial = require("./helpers/fri/fri_prover");
const generateVerifierQuery = require("./helpers/fri/fri_verifier");

const map = require("./map.js");

const { fixCode, setDimensions } = require("./helpers/helpers.js");
const { generatePil1Code } = require("./helpers/pil1/generatePil1Code");

module.exports = function pilInfo(F, pil, stark = true, pil1 = true, starkStruct) {
    const res = {
        cmPolsMap: [],
        challengesMap: [],
        libs: {},
        code: {},
        nLibStages: 0,
        starkStruct: starkStruct,
    };

    let expressions, symbols, constraints;

    if(pil1) {
        const pil1Info = generatePil1Code(F, res, pil, stark);
        expressions = pil1Info.expressions;
        symbols = pil1Info.symbols;
        constraints = pil1Info.constraints;
    }

    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    const ctx_ext = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    generateConstraintPolynomial(res, expressions, constraints, ctx, ctx_ext, stark);
    
    map(res, symbols, expressions, stark);

    generateConstraintPolynomialVerifier(res, expressions, constraints, ctx, stark);

    if(stark) {
        generateFRIPolynomial(res, expressions, constraints, ctx_ext);
        generateVerifierQuery(res, expressions, constraints, ctx_ext);
    } 

    fixCode(res, stark);

    setDimensions(res, stark);

    delete res.imPolsMap;
    delete res.cExp;
    delete res.friExpId;
    
    return res;

}
