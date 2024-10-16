const { getParserArgs } = require("./getParserArgs.js");
const { getAllOperations } = require("./utils.js");

module.exports.prepareExpressionsBin = async function prepareExpressionsBin(starkInfo, expressionsInfo) {
    
    const expsInfo = [];
    const constraintsInfo = [];
    const numbersExps = [];
    const numbersConstraints = [];

    let operations = getAllOperations();

    const N = 1 << (starkInfo.starkStruct.nBits);

    // Get parser args for each constraint
    for(let j = 0; j < expressionsInfo.constraints.length; ++j) {
        const constraintCode = expressionsInfo.constraints[j];
        let firstRow;
        let lastRow;

        if(constraintCode.boundary === "everyRow") {
            firstRow = 0;
            lastRow = N;
        } else if(constraintCode.boundary === "firstRow" || constraintCode.boundary === "finalProof") {
            firstRow = 0;
            lastRow = 1;
        } else if(constraintCode.boundary === "lastRow") {
            firstRow = N-1;
            lastRow = N;
        } else if(constraintCode.boundary === "everyFrame") {
            firstRow = constraintCode.offsetMin;
            lastRow = N - constraintCode.offsetMax;
        } else throw new Error("Invalid boundary: " + constraintCode.boundary);

        const {expsInfo: constraintInfo} = getParserArgs(starkInfo, operations, constraintCode, numbersConstraints);
        constraintInfo.stage = constraintCode.stage;
        constraintInfo.firstRow = firstRow;
        constraintInfo.lastRow = lastRow;
        constraintInfo.line = constraintCode.line;
        constraintInfo.imPol = constraintCode.imPol;
        constraintsInfo.push(constraintInfo);
    }


    // Get parser args for each expression
    for(let i = 0; i < expressionsInfo.expressionsCode.length; ++i) {
        const expCode = JSON.parse(JSON.stringify(expressionsInfo.expressionsCode[i]));
        if(!expCode) continue;
        if(expCode.expId === starkInfo.cExpId || expCode.expId === starkInfo.friExpId || starkInfo.cmPolsMap.find(c => c.expId === expCode.expId)) {
                expCode.code.code[expCode.code.code.length - 1].dest.type = "tmp";
                expCode.code.code[expCode.code.code.length - 1].dest.id = expCode.code.tmpUsed++;
        }
        const {expsInfo: expInfo} = getParserArgs(starkInfo, operations, expCode.code, numbersExps);
        expInfo.expId = expCode.expId;
        expInfo.stage = expCode.stage;
        expInfo.line = expCode.line;
        expsInfo.push(expInfo);
    }
    
    const res = {
        expsInfo, constraintsInfo, hintsInfo: expressionsInfo.hintsInfo, numbersExps, numbersConstraints,
    };

    return res;
}

module.exports.prepareVerifierExpressionsBin = async function prepareVerifierExpressionsBin(starkInfo, verifierInfo) {
    
    let operations = getAllOperations();

    let numbersExps = [];
    let {expsInfo: qCode} = getParserArgs(starkInfo, operations, verifierInfo.qVerifier, numbersExps, false, true, true);
    qCode.expId = starkInfo.cExpId;
    qCode.line = "";
    let {expsInfo: queryCode} = getParserArgs(starkInfo, operations, verifierInfo.queryVerifier, numbersExps, false, true);
    queryCode.expId = starkInfo.friExpId;
    queryCode.line = "";
   
    return {qCode, queryCode, numbersExps};
}
