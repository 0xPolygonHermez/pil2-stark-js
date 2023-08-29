
const {BigBuffer} = require("pilcom");
const buildMerkleHashGL = require("../helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("../helpers/hash/merklehash/merklehash_bn128_p.js");
const pilInfo = require("../pil_info/pil_info.js");

const { interpolate } = require("../helpers/fft/fft_p");

module.exports = async function starkSetup(constPols, pil, pil1 = true, starkStruct, options) {

    const F = options.F;
    const nBits = starkStruct.nBits;
    const nBitsExt = starkStruct.nBitsExt;
    const extN= 1 << nBitsExt;
    const constPolsArrayE = new BigBuffer(extN*pil.nConstants);

    const constBuff  = constPols.writeToBuff();
    await interpolate(constBuff, pil.nConstants, nBits, constPolsArrayE, nBitsExt );

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

    const constTree = await MH.merkelize(constPolsArrayE, pil.nConstants, extN);

    return {
        constTree: constTree,
        constRoot: MH.root(constTree),
        starkInfo: pilInfo(F, pil, true, pil1, starkStruct)
    }
}
