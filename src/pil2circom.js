const ejs = require("ejs");
const F3g = require("./helpers/f3g.js");
const fs = require("fs");
const path = require("path");
const { log2 } = require("pilcom/src/utils.js");


module.exports = async function pil2circom(constRoot, starkInfo, expressionsInfo, options) {

    options = options || {};
    starkStruct = starkInfo.starkStruct;

    const F = new F3g();

    let template;
    if (starkStruct.verificationHashType == "GL") {
        template = await fs.promises.readFile(path.join(__dirname, "..", "circuits.gl", "stark_verifier.circom.ejs"), "utf8");
    } else if (starkStruct.verificationHashType == "BN128") {
        template = await fs.promises.readFile(path.join(__dirname, "..", "circuits.bn128", "stark_verifier.circom.ejs"), "utf8");
    } else {
        throw new Error("Invalid Hash Type: "+ starkStruct.verificationHashType);
    }


    const obj = {
        F,
        starkInfo,
        expressionsInfo,
        starkStruct,
        constRoot,
        options,
        arity: starkInfo.starkStruct.merkleTreeArity,
        nBitsArity: starkInfo.starkStruct.merkleTreeArity ? log2(starkInfo.starkStruct.merkleTreeArity) : undefined,
        custom: starkInfo.starkStruct.merkleTreeCustom,
    };

    return ejs.render(template ,  obj);

}
