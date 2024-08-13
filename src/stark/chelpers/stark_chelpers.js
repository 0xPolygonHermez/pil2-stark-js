const { getParserArgs } = require("./getParserArgs.js");
const { generateParser, getAllOperations } = require("./generateParser.js");
const { findPatterns } = require("./helpers.js");

module.exports.buildCHelpers = async function buildCHelpers(starkInfo, expressionsInfo, binFile, genericBinFile, className = "") {

    if(className === "") className = "Stark";
    className = className[0].toUpperCase() + className.slice(1) + "Steps";
    
    let imPolsInfo = [];
    const expsInfo = [];
    const constraintsInfo = [];

    let imPolsInfoGeneric = [];
    const expsInfoGeneric = [];
    const constraintsInfoGeneric = [];

    const cHelpersStepsHpp = [
        `#include "chelpers_steps.hpp"\n\n`,
        `class ${className} : public CHelpersSteps {`,
        "public:",
    ];

    let operations = getAllOperations();
    let operationsWithPatterns = getAllOperations();

    let totalSubsetOperationsUsed = [];

    let debug = false;
    
    for(let i = 0; i < starkInfo.nStages; ++i) {
        const imPolsCode = expressionsInfo.imPolsCode[i];
        if(binFile) {
            imPolsInfo.push(getParserArgsCode(imPolsCode, "n", debug));
        }
    
        if(genericBinFile) {
            imPolsInfoGeneric.push(getParserArgsCode(imPolsCode, "n", debug));
        }
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

        if(binFile) {
            const constraintInfo = getParserArgsCode(constraintCode, "n", true);
            constraintInfo.stage = constraintCode.stage;
            constraintInfo.firstRow = firstRow;
            constraintInfo.lastRow = lastRow;
            constraintsInfo.push(constraintInfo);
        }

        if(genericBinFile) {
            const constraintInfoGeneric = getParserArgsCodeGeneric(constraintCode, "n", true);
            constraintInfoGeneric.stage = constraintCode.stage;
            constraintInfoGeneric.firstRow = firstRow;
            constraintInfoGeneric.lastRow = lastRow;
            constraintsInfoGeneric.push(constraintInfoGeneric);
        }
    }


    // Get parser args for each expression
    for(let i = 0; i < expressionsInfo.expressionsCode.length; ++i) {
        const expCode = JSON.parse(JSON.stringify(expressionsInfo.expressionsCode[i]));
        if(!expCode) continue;
        if(expCode.expId === starkInfo.cExpId || expCode.expId === starkInfo.friExpId || starkInfo.cmPolsMap.find(c => c.expId === expCode.expId)) {
                expCode.code.code[expCode.code.code.length - 1].dest.type = "tmp";
                expCode.code.code[expCode.code.code.length - 1].dest.id = expCode.code.tmpUsed++;
        }
        if(binFile) {
            const expInfo = getParserArgsCode(expCode.code, "n", true);
            expInfo.expId = expCode.expId;
            expInfo.stage = expCode.stage;
            if(expCode.expId === starkInfo.cExpId || expCode.expId === starkInfo.friExpId) {
                expInfo.destDim = 0;
                expInfo.destId = 0;
            }
            expsInfo.push(expInfo);
        }

        if(genericBinFile) {
            const expInfoGeneric = getParserArgsCodeGeneric(expCode.code, "n", true);
            expInfoGeneric.expId = expCode.expId;
            expInfoGeneric.stage = expCode.stage;
            if(expInfoGeneric.expId === starkInfo.cExpId || expInfoGeneric.expId === starkInfo.friExpId) {
                expInfoGeneric.destDim = 0;
                expInfoGeneric.destId = 0;
            }
            expsInfoGeneric.push(expInfoGeneric);
        }
    }

    totalSubsetOperationsUsed = totalSubsetOperationsUsed.sort((a, b) => a - b);
    console.log("Generating generic parser with all " + totalSubsetOperationsUsed.length + " operations used");
    console.log("Total subset of operations used: " + totalSubsetOperationsUsed.join(", "));
    console.log("--------------------------------");
    
    const parser = generateParser(operationsWithPatterns, totalSubsetOperationsUsed);

    cHelpersStepsHpp.push(parser);
    cHelpersStepsHpp.push("};");


    let cHelpers = cHelpersStepsHpp.join("\n"); 
    
    const operationsPatterns = operationsWithPatterns.filter(op => op.isGroupOps);
    console.log("Number of patterns used: " + operationsPatterns.length);
    for(let i = 0; i < operationsPatterns.length; ++i) {
    console.log("case " + operationsPatterns[i].opIndex + " ->    " + operationsPatterns[i].ops.join(", "));
    }
    
    // Set case to consecutive numbers
    if(imPolsInfo.ops) {
        imPolsInfo.ops = imPolsInfo.ops.map(op => totalSubsetOperationsUsed.find(o => o === op));
    }

    for(let i = 0; i < expsInfo.length; ++i) {
        expsInfo[i].ops = expsInfo[i].ops.map(op => totalSubsetOperationsUsed.findIndex(o => o === op));        
    }

    for(let i = 0; i < constraintsInfo.length; ++i) {
        constraintsInfo[i].ops = constraintsInfo[i].ops.map(op => totalSubsetOperationsUsed.findIndex(o => o === op));        
    }

    cHelpers = cHelpers.replace(/case (\d+):/g, (match, caseNumber) => {
    caseNumber = parseInt(caseNumber, 10);
    const newIndex = totalSubsetOperationsUsed.findIndex(o => o === caseNumber);
    if(newIndex === -1) throw new Error("Invalid operation!");
    return `case ${newIndex}:`;
    });
 
    const res = {};

    if(binFile) {
        res.binFileInfo = {
            expsInfo, imPolsInfo, constraintsInfo, hintsInfo: expressionsInfo.hintsInfo
        }
        res.cHelpers = cHelpers;
    }

    if(genericBinFile) {
        res.genericBinFileInfo = {
            imPolsInfo: imPolsInfoGeneric,
            expsInfo: expsInfoGeneric,
            constraintsInfo: constraintsInfoGeneric,
            hintsInfo: expressionsInfo.hintsInfo,
        }
    }

    return res;

    function getParserArgsCode(code, dom, debug = false) {
        const {expsInfo, opsUsed} = getParserArgs(starkInfo, operationsWithPatterns, code, dom, debug);

        const patternOps = findPatterns(expsInfo.ops, operationsWithPatterns);
        opsUsed.push(...patternOps);

        for(let j = 0; j < opsUsed.length; ++j) {
        if(!totalSubsetOperationsUsed.includes(opsUsed[j])) totalSubsetOperationsUsed.push(opsUsed[j]);
        }

        return expsInfo;
    }

    function getParserArgsCodeGeneric(code, dom, debug = false) {
        const {expsInfo} = getParserArgs(starkInfo, operations, code, dom, debug);
        return expsInfo;
    }
}
