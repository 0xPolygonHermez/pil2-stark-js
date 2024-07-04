const { getParserArgs } = require("./getParserArgs.js");
const { generateParser, getAllOperations } = require("./generateParser.js");
const { findPatterns } = require("./helpers.js");
const { writeCHelpersFile } = require("./binFile.js");
const path = require("path");
const fs = require("fs");

module.exports.buildCHelpers = async function buildCHelpers(starkInfo, expressionsInfo, cHelpersFile, className = "", binFile, genericBinFile) {

    if(className === "") className = "Stark";
    className = className[0].toUpperCase() + className.slice(1) + "Steps";
    
    const stagesInfo = [];
    const expsInfo = [];
    const constraintsInfo = [];

    const stagesInfoGeneric = [];
    const expsInfoGeneric = [];
    const constraintsInfoGeneric = [];

    const nStages = starkInfo.nStages;

    const cHelpersStepsHpp = [
        `#include "chelpers_steps.hpp"\n\n`,
        `class ${className} : public CHelpersSteps {`,
        "public:",
    ];

    let operations = getAllOperations();
    let operationsWithPatterns = getAllOperations();

    let totalSubsetOperationsUsed = [];

    let debug = false;
    // Get parser args for each stage
    for(let i = 0; i < nStages; ++i) {
        let stage = i + 1;
        if(binFile) {
            const stageInfo = getParserArgsCode(expressionsInfo.stagesCode[i], "n", debug);
            stageInfo.stage = stage;
            stagesInfo.push(stageInfo);
        }

        if(genericBinFile) {
            const stageInfoGeneric = getParserArgsCodeGeneric(expressionsInfo.stagesCode[i], "n", debug);
            stageInfoGeneric.stage = stage;
            stagesInfoGeneric.push(stageInfoGeneric);
        }
    }

    // TODO: ADD IMPOLSCODE
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
        const expCode = expressionsInfo.expressionsCode[i];
        if(binFile) {
            const expInfo = getParserArgsCode(expCode.code, "n");
            expInfo.expId = expCode.expId;
            expInfo.stage = expCode.stage;
            expsInfo.push(expInfo);
        }

        if(genericBinFile) {
            const expInfoGeneric = getParserArgsCodeGeneric(expCode.code, "n");
            expInfoGeneric.expId = expCode.expId;
            expInfoGeneric.stage = expCode.stage;
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
    for(let i = 0; i < stagesInfo.length; ++i) {
        stagesInfo[i].ops = stagesInfo[i].ops.map(op => totalSubsetOperationsUsed.findIndex(o => o === op));        
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
 
    if(binFile) {
        const baseDir = path.dirname(cHelpersFile);
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }
        await fs.promises.writeFile(cHelpersFile, cHelpers, "utf8");
        
        await writeCHelpersFile(binFile, stagesInfo, expsInfo, constraintsInfo, expressionsInfo.hintsInfo);
    }

    if(genericBinFile) {
        await writeCHelpersFile(genericBinFile, stagesInfoGeneric, expsInfoGeneric, constraintsInfoGeneric, expressionsInfo.hintsInfo);
    }

    return;

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
