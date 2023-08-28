
const generateConstraintPolynomial = require("./helpers/quotientPolynomial/cp_prover");
const generateConstraintPolynomialVerifier = require("./helpers/quotientPolynomial/cp_ver");

const generateFRIPolynomial = require("./helpers/fri/fri_prover");
const generateVerifierQuery = require("./helpers/fri/fri_verifier");

const map = require("./map.js");

const { fixCode, setDimensions } = require("./helpers/helpers.js");
const { generatePil1Code } = require("./helpers/pil1/generatePil1Code");

module.exports = function pilInfo(F, _pil, stark = true, starkStruct) {
    const pil = JSON.parse(JSON.stringify(_pil));    // Make a copy as we are going to destroy the original

    const res = {
        cmPolsMap: [],
        challengesMap: [],
        libs: {},
        code: {},
        nConstants: pil.nConstants,
        nPublics: pil.publics.length,
        nLibStages: 0,
        starkStruct: starkStruct,
    };

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
    
    const {expressions, symbols, constraints } = generatePil1Code(F, res, pil, ctx, stark);
    
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
