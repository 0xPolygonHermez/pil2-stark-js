
const {pilCodeGen, buildCode} = require("../../codegen.js");

module.exports = function generateVerifierQuery(res, ctx) {

    let addMul = res.starkStruct.verificationHashType == "GL" ? false : true;
    pilCodeGen(ctx, res.friExpId, 0, addMul);
    res.code.queryVerifier = buildCode(ctx);

}