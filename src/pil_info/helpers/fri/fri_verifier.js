
const {pilCodeGen, buildCode} = require("../../codegen.js");

module.exports = function generateVerifierQuery(res, expressions, constraints, ctx) {

    let addMul = res.starkStruct.verificationHashType == "GL" ? false : true;
    pilCodeGen(ctx, expressions, constraints, res.friExpId, 0, addMul);
    res.code.queryVerifier = buildCode(ctx, expressions);

}