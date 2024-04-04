const ejs = require("ejs");
const F3g = require("./helpers/f3g.js");
const fs = require("fs");
const path = require("path");
const { log2 } = require("pilcom/src/utils.js");


module.exports = async function pil2circom(constRoot, starkInfo, verifierInfo, options) {

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

    const arity = starkStruct.merkleTreeArity || 16;
    const custom = starkStruct.merkleTreeCustom || false;
    const transcriptArity = custom ? starkStruct.merkleTreeArity : 16;
    
    const obj = {
        F,
        starkInfo,
        verifierInfo,
        starkStruct,
        constRoot,
        options,
        arity,
        nBitsArity: log2(arity),
        transcriptArity,
        custom,
    };

    return ejs.render(template ,  obj);

}
