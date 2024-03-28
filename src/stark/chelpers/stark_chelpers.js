const { getParserArgs } = require("./getParserArgs.js");
const { generateParser, getAllOperations } = require("./generateParser.js");
const { findPatterns } = require("./helpers.js");
const { writeCHelpersFile } = require("./binFile.js");
const path = require("path");
const fs = require("fs");

module.exports.buildCHelpers = async function buildCHelpers(starkInfo, cHelpersFile, className = "", binFile, genericBinFile) {

    if(className === "") className = "Stark";
    className = className[0].toUpperCase() + className.slice(1) + "Steps";
    
    const stagesInfo = [];
    const expressionsInfo = [];
    const constraintsInfo = [];

    const stagesInfoGeneric = [];
    const expressionsInfoGeneric = [];
    const constraintsInfoGeneric = [];

    const nStages = starkInfo.numChallenges.length;

    const cHelpersStepsHpp = [
        `#include "chelpers_steps.hpp"\n\n`,
        `class ${className} : public CHelpersSteps {`,
        "public:",
        "    void calculateExpressions(StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams) {",
        `        uint32_t nrowsBatch = 4;`,
        `        bool domainExtended = parserParams.stage > starkInfo.numChallenges.size() ? true : false;`,
    ];

    let operations = getAllOperations();
    let operationsWithPatterns = getAllOperations();

    let totalSubsetOperationsUsed = [];

    let debug = false;
    // Get parser args for each stage
    for(let i = 0; i < nStages; ++i) {
        let stage = i + 1;
        const stageInfo = getParserArgsCode(`step${stage}`, starkInfo.code[`stage${stage}`], "n", debug);
        stageInfo.stage = stage;
        stagesInfo.push(stageInfo);

        if(genericBinFile) {
            const stageInfoGeneric = getParserArgsCodeGeneric(`step${stage}`, starkInfo.code[`stage${stage}`], "n", debug);
            stageInfoGeneric.stage = stage;
            stagesInfoGeneric.push(stageInfoGeneric);
        }
    }

    const stageQInfo = getParserArgsCode(`step${nStages + 1}`, starkInfo.code.qCode, "ext");
    stageQInfo.stage = nStages + 1;
    stagesInfo.push(stageQInfo);

    const stageFriInfo = getParserArgsCode(`step${nStages + 2}`, starkInfo.code.fri, "ext");
    stageFriInfo.stage = nStages + 2;
    stagesInfo.push(stageFriInfo);

    if(genericBinFile) {
        const stageQInfoGeneric = getParserArgsCodeGeneric(`step${nStages + 1}`, starkInfo.code.qCode, "ext");
        stageQInfoGeneric.stage = nStages + 1;
        stagesInfoGeneric.push(stageQInfoGeneric);

        const stageFriInfoGeneric = getParserArgsCodeGeneric(`step${nStages + 2}`, starkInfo.code.fri, "ext");
        stageFriInfoGeneric.stage = nStages + 2;
        stagesInfoGeneric.push(stageFriInfoGeneric);
    }

    // Get parser args for each constraint
    for(let s = 1; s <= nStages + 1; ++s) {
        const stage = `stage${s}`;
        const constraintsStage = starkInfo.constraints[stage];
        for(let j = 0; j < constraintsStage.length; ++j) {
            const constraintCode = constraintsStage[j];
            const constraintInfo = getParserArgsCode(`constraint${s}_${j}`, constraintCode, "n", true);
            constraintInfo.stage = s;
            constraintsInfo.push(constraintInfo);

            if(genericBinFile) {
                const constraintInfoGeneric = getParserArgsCodeGeneric(`constraint${s}_${j}`, constraintCode, "n", true);
                constraintInfoGeneric.stage = s;
                constraintsInfoGeneric.push(constraintInfoGeneric);
            }
        }
    }


    // Get parser args for each expression
    for(let i = 0; i < starkInfo.expressionsCode.length; ++i) {
        const expCode = starkInfo.expressionsCode[i];
        const expInfo = getParserArgsCode(`exp${expCode.expId}`,expCode.code, "n");
        expInfo.expId = expCode.expId;
        expInfo.stage = expCode.stage;
        expressionsInfo.push(expInfo);

        if(genericBinFile) {
            const expInfoGeneric = getParserArgsCodeGeneric(`exp${expCode.expId}`,expCode.code, "n");
            expInfoGeneric.expId = expCode.expId;
            expInfoGeneric.stage = expCode.stage;
            expressionsInfoGeneric.push(expInfoGeneric);
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

    for(let i = 0; i < expressionsInfo.length; ++i) {
        expressionsInfo[i].ops = expressionsInfo[i].ops.map(op => totalSubsetOperationsUsed.findIndex(o => o === op));        
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

    const baseDir = path.dirname(cHelpersFile);
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    
    await fs.promises.writeFile(cHelpersFile, cHelpers, "utf8");
    
    await writeCHelpersFile(binFile, stagesInfo, expressionsInfo, constraintsInfo);

    if(genericBinFile) {
        await writeCHelpersFile(genericBinFile, stagesInfoGeneric, expressionsInfoGeneric, constraintsInfoGeneric);
    }

    console.log(stagesInfo[1]);
    console.log(stagesInfoGeneric[1]);

    return;

    function getParserArgsCode(name, code, dom, debug = false) {
        console.log(`Getting parser args for ${name}`);

        const {expsInfo, opsUsed} = getParserArgs(starkInfo, operationsWithPatterns, code, dom, debug);

        const patternOps = findPatterns(expsInfo.ops, operationsWithPatterns);
        opsUsed.push(...patternOps);

        for(let j = 0; j < opsUsed.length; ++j) {
            if(!totalSubsetOperationsUsed.includes(opsUsed[j])) totalSubsetOperationsUsed.push(opsUsed[j]);
        }

        console.log("--------------------------------");

        return expsInfo;
    }

    function getParserArgsCodeGeneric(name, code, dom, debug = false) {
        const {expsInfo} = getParserArgs(starkInfo, operations, code, dom, debug);
        return expsInfo;
    }
}
