const { getParserArgs } = require("./getParserArgs.js");
const { generateParser, getAllOperations } = require("./generateParser.js");
const { findPatterns } = require("./helpers.js");
const { writeCHelpersFile } = require("./binFile.js");
const path = require("path");
const fs = require("fs");
const { mkdir } = require("fs-extra");

module.exports.buildCHelpers = async function buildCHelpers(starkInfo, cHelpersFile, binFile, className = "") {

    if(className === "") className = "Stark";
    className = className[0].toUpperCase() + className.slice(1) + "Steps";

    let result = {};
    
    const stagesInfo = [];
    const expressionsInfo = [];
    const constraintsInfo = [];

    const nStages = starkInfo.numChallenges.length;

    const cHelpersStepsHpp = [
        `#include "chelpers_steps.hpp"\n\n`,
        `class ${className} : public CHelpersSteps {`,
        "public:",
        "    void calculateExpressions(StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams) {",
        `        uint32_t nrowsBatch = 4;`,
        `        bool domainExtended = parserParams.stage > 3 ? true : false;`,
    ];

    let operations = getAllOperations();

    let totalSubsetOperationsUsed = [];

    let debug = false;
    // Get parser args for each stage
    for(let i = 0; i < nStages; ++i) {
        let stage = i + 1;
        const stageInfo = getParserArgsCode(`step${stage}`, starkInfo.code[`stage${stage}`], "n", debug);
        stageInfo.stage = stage;
        stagesInfo.push(stageInfo);
    }

    const stageQInfo = getParserArgsCode(`step${nStages + 1}`, starkInfo.code.qCode, "ext");
    stageQInfo.stage = nStages + 1;
    stagesInfo.push(stageQInfo);

    const stageFriInfo = getParserArgsCode(`step${nStages + 2}`, starkInfo.code.fri, "ext");
    stageFriInfo.stage = nStages + 2;
    stagesInfo.push(stageFriInfo);


    // Get parser args for each constraint
    for(let s = 1; s <= nStages; ++s) {
        const stage = `stage${s}`;
        const constraintsStage = starkInfo.constraints[stage];
        for(let j = 0; j < constraintsStage.length; ++j) {
            const constraintCode = constraintsStage[j];
            const constraintInfo = getParserArgsCode(`constraint${s}_${j}`, constraintCode, "n", true);
            constraintInfo.stage = s;
            constraintsInfo.push(constraintInfo);
        }
    }


    // Get parser args for each expression
    for(let i = 0; i < starkInfo.expressionsCode.length; ++i) {
        const expCode = starkInfo.expressionsCode[i];
        const expInfo = getParserArgsCode(`exp${expCode.expId}`,expCode.code, "n");
        expInfo.expId = expCode.expId;
        expInfo.stage = expCode.stage;
        expressionsInfo.push(expInfo);
    }

    totalSubsetOperationsUsed = totalSubsetOperationsUsed.sort((a, b) => a - b);
    console.log("Generating generic parser with all " + totalSubsetOperationsUsed.length + " operations used");
    console.log("Total subset of operations used: " + totalSubsetOperationsUsed.join(", "));
    console.log("--------------------------------");
    
    const genericParser = generateParser(operations, totalSubsetOperationsUsed);

    cHelpersStepsHpp.push(genericParser);
    cHelpersStepsHpp.push("};");


    result[`${className}_hpp`] = cHelpersStepsHpp.join("\n"); 
    
    const operationsPatterns = operations.filter(op => op.isGroupOps);
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

    result[`${className}_hpp`] = result[`${className}_hpp`].replace(/case (\d+):/g, (match, caseNumber) => {
        caseNumber = parseInt(caseNumber, 10);
        const newIndex = totalSubsetOperationsUsed.findIndex(o => o === caseNumber);
        if(newIndex === -1) throw new Error("Invalid operation!");
        return `case ${newIndex}:`;
    });

    const baseDir = path.dirname(cHelpersFile);
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    await mkdir(cHelpersFile, { recursive: true });

    for (r in result) {
        let fileName = cHelpersFile + "/" + r;
        fileName = fileName.substring(0, fileName.lastIndexOf('_')) + '.' + fileName.substring(fileName.lastIndexOf('_') + 1);
        console.log(fileName);
        await fs.promises.writeFile(fileName, result[r], "utf8");
    }

    await writeCHelpersFile(binFile, stagesInfo, expressionsInfo, constraintsInfo);

    return;

    function getParserArgsCode(name, code, dom, debug = false) {
        console.log(`Getting parser args for ${name}`);

        const {expsInfo, opsUsed} = getParserArgs(starkInfo, operations, code, dom, debug);

        const patternOps = findPatterns(expsInfo.ops, operations);
        opsUsed.push(...patternOps);

        for(let j = 0; j < opsUsed.length; ++j) {
            if(!totalSubsetOperationsUsed.includes(opsUsed[j])) totalSubsetOperationsUsed.push(opsUsed[j]);
        }

        console.log("--------------------------------");

        return expsInfo;
    }
}