const { BigBuffer } = require("pilcom");
const buildMerkleHashGL = require("../helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("../helpers/hash/merklehash/merklehash_bn128_p.js");
const {interpolate} = require("../helpers/fft/fft_p");

module.exports.buildConstTree = async function buildConstTree(starkInfo, constPols) {

    const starkStruct = starkInfo.starkStruct;
    const nBits = starkStruct.nBits;
    const nBitsExt = starkStruct.nBitsExt;
    const extN = 1 << nBitsExt;

    const constBuff  = constPols.writeToBuff();

    const constPolsArrayE = new BigBuffer(extN*starkInfo.nConstants);

    await interpolate(constBuff, starkInfo.nConstants, nBits, constPolsArrayE, nBitsExt );

    let MH;
    if (starkStruct.verificationHashType == "GL") {
        MH = await buildMerkleHashGL(starkStruct.splitLinearHash);
    } else if (starkStruct.verificationHashType == "BN128") {
        console.log(`Merkle tree Arity: ${starkInfo.starkStruct.merkleTreeArity}, Merkle tree custom: ${starkInfo.starkStruct.merkleTreeCustom}`);
        MH = await buildMerkleHashBN128(starkInfo.starkStruct.merkleTreeArity, starkInfo.starkStruct.merkleTreeCustom);
    } else {
        throw new Error("Invalid Hash Type: "+ starkStruct.verificationHashType);
    }


    console.log("Start merkelizing..");
    const constTree = await MH.merkelize(constPolsArrayE, starkInfo.nConstants, extN);

    const constRoot = MH.root(constTree);

    const verKey = {
        constRoot: constRoot
    };
    
    return {
        MH, 
        constTree,
        verKey,
    }

}