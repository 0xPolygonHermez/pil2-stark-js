const { getParserArgs } = require("./getParserArgs.js");
const { getAllOperations } = require("./utils.js");

module.exports.prepareExpressionsBin = async function prepareExpressionsBin(starkInfo, expressionsInfo) {
    
    const imPolsInfo = [];
    const expsInfo = [];
    const constraintsInfo = [];

    let operations = getAllOperations();

    let debug = false;
    
    for(let i = 0; i < starkInfo.nStages; ++i) {
        imPolsInfo.push(getParserArgsCode(expressionsInfo.imPolsCode[i], "n", debug));
    }
     

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

        const constraintInfo = getParserArgsCode(constraintCode, "n", true);
        constraintInfo.stage = constraintCode.stage;
        constraintInfo.firstRow = firstRow;
        constraintInfo.lastRow = lastRow;
        constraintInfo.line = constraintCode.line;
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
        const expInfo = getParserArgsCode(expCode.code, "n", true);
        expInfo.expId = expCode.expId;
        expInfo.stage = expCode.stage;
        if(expCode.expId === starkInfo.cExpId || expCode.expId === starkInfo.friExpId) {
            expInfo.destDim = 0;
            expInfo.destId = 0;
        }
        expInfo.line = expCode.line;
        expsInfo.push(expInfo);
    }
    
    const res = {
        expsInfo, imPolsInfo, constraintsInfo, hintsInfo: expressionsInfo.hintsInfo
    };
   
    return res;

    function getParserArgsCode(code, dom, debug = false) {
        const {expsInfo} = getParserArgs(starkInfo, operations, code, dom, debug);
        return expsInfo;
    }
}
