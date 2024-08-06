
const {BigBuffer} = require("pilcom");
const buildMerkleHashGL = require("../helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("../helpers/hash/merklehash/merklehash_bn128_p.js");
const pilInfo = require("../pil_info/pil_info.js");

const { interpolate } = require("../helpers/fft/fft_p");
const { buildCHelpers } = require("./chelpers/stark_chelpers.js");

module.exports = async function starkSetup(constPols, pil, starkStruct, options) {

    const F = options.F;
    
    const pil2 = options.pil2 || false;
    
    const {pilInfo: starkInfo, expressionsInfo, verifierInfo} = await pilInfo(F, pil, true, pil2, starkStruct, options);

    const res = {
        fixedPols: constPols,
        starkInfo,
        expressionsInfo,
        verifierInfo,
    }
    
    if(!options.skipConstTree) {
        const nConstants = starkInfo.constPolsMap.length;
        const nBits = starkStruct.nBits;
        const nBitsExt = starkStruct.nBitsExt;
        const extN= 1 << nBitsExt;
        const constPolsArrayE = new BigBuffer(extN*nConstants);
    
        const constBuff  = constPols.writeToBuff();
        await interpolate(constBuff, nConstants, nBits, constPolsArrayE, nBitsExt );
    
        let MH;
        if (starkStruct.verificationHashType == "GL") {
            MH = await buildMerkleHashGL();
        } else if (starkStruct.verificationHashType == "BN128") {
            let arity = options.arity || 16;
            let custom = options.custom || false;    
            MH = await buildMerkleHashBN128(arity, custom);
        } else {
            throw new Error("Invalid Hash Type: "+ starkStruct.verificationHashType);
        }
    
        res.constTree = await MH.merkelize(constPolsArrayE, nConstants, extN); 
        res.constRoot = MH.root(res.constTree);
    }

    const cHelpersInfo = await buildCHelpers(starkInfo, expressionsInfo, false, true);

    res.cHelpers = cHelpersInfo.cHelpers;
    res.binFileInfo = cHelpersInfo.binFileInfo;
    res.genericBinFileInfo = cHelpersInfo.genericBinFileInfo;

    return res;
}
