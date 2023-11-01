
const {BigBuffer} = require("pilcom");
const buildMerkleHashGL = require("../helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("../helpers/hash/merklehash/merklehash_bn128_p.js");
const pilInfo = require("../pil_info/pil_info.js");

const { interpolate } = require("../helpers/fft/fft_p");

module.exports = async function starkSetup(constPols, pil, starkStruct, options) {

    const F = options.F;
    const pil1 = options.pil1 || false;
    const nConstants = pil1 ? pil.nConstants : pil.symbols.filter(s => s.type == 1).length;
    const nBits = starkStruct.nBits;
    const nBitsExt = starkStruct.nBitsExt;
    const extN= 1 << nBitsExt;
    const constPolsArrayE = new BigBuffer(extN*nConstants);

    const constBuff  = constPols.writeToBuff();
    await interpolate(constBuff, nConstants, nBits, constPolsArrayE, nBitsExt );

    let arity = options.arity || 16;
    let custom = options.custom || false;    
    let MH;
    if (starkStruct.verificationHashType == "GL") {
        MH = await buildMerkleHashGL();
    } else if (starkStruct.verificationHashType == "BN128") {
        MH = await buildMerkleHashBN128(arity, custom);
    } else {
        throw new Error("Invalid Hash Type: "+ starkStruct.verificationHashType);
    }

    const constTree = await MH.merkelize(constPolsArrayE, nConstants, extN);

    return {
        fixedPols: constPols,
        constTree,
        constRoot: MH.root(constTree),
        starkInfo: pilInfo(F, pil, true, pil1, false, starkStruct),
    }
}
