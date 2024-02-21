const { getParserArgs } = require("./getParserArgs.js");
const { generateParser, getAllOperations } = require("./generateParser.js");
const { findPatterns } = require("./helpers.js");

module.exports = async function buildCHelpers(starkInfo, className = "", multiple = false) {

    let result = {};
    
    const cHelpersInfo = [];

    const cHelpersStepsHppParserAVX = [];
    const cHelpersStepsCppParserAVX = [`    } else {`, `        switch (parserParams.stage) {`];

    const nStages = 3;

    const cHelpersStepsHpp = [
        `#include "chelpers_steps.hpp"\n\n`,
        `class ${className} : public CHelpersSteps {`,
        "    public:",
        "        void calculateExpressions(StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams, bool useGeneric);",
        "    private:",
        "        void parser_avx(StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams, uint32_t nrowsBatch, bool domainExtended);"
    ];
    
    const cHelpersStepsCpp = [
        `#include "${className}.hpp"\n`,
        `void ${className}::calculateExpressions(StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams, bool useGeneric) {`,
        `    uint32_t nrowsBatch = 4;`,
    ];
    if(multiple) cHelpersStepsCpp.push(`    if(useGeneric) {`);
    cHelpersStepsCpp.push(...[
        `        bool domainExtended = parserParams.stage > 3 ? true : false;`,
        `        ${className}::parser_avx(starkInfo, params, parserArgs, parserParams, nrowsBatch, domainExtended);`,
    ]);
   
    let operations = getAllOperations();
    let operationsUsed = {};

    let totalSubsetOperationsUsed = [];

    for(let i = 0; i < nStages; ++i) {
        let stage = i + 1;
        getParserArgsStage(stage, `step${stage}`, starkInfo.code[`stage${stage}`].code, "n");
    }

    getParserArgsStage(nStages, `step${nStages}_imPols`, starkInfo.code.imPols.code, "n", true);

    getParserArgsStage(nStages + 1, `step${nStages + 1}`, starkInfo.code[`stage${nStages + 1}`].code, "ext");
    getParserArgsStage(nStages + 2, `step${nStages + 2}`, starkInfo.code.fri.code, "ext");

    totalSubsetOperationsUsed = totalSubsetOperationsUsed.sort((a, b) => a - b);
    console.log("Generating generic parser with all " + totalSubsetOperationsUsed.length + " operations used");
    console.log("Total subset of operations used: " + totalSubsetOperationsUsed.join(", "));
    console.log("--------------------------------");
    
    result[`${className}_generic_parser_cpp`] = generateParser(className, "", operations, totalSubsetOperationsUsed, true);

    for(let i = 0; i < cHelpersInfo.length; ++i) {
        const stage = cHelpersInfo[i].stage;
        const imPols = cHelpersInfo[i].imPols;

        let stageName = `step${stage}`;
        if(imPols) stageName += "_imPols";
        console.log("Generating code for " + stageName);

        const opsUsed = operationsUsed[stageName];
        const vectorizeEvals = stage === nStages + 2 ? true : false;
        if(multiple) result[`${className}_${stageName}_parser_cpp`] = generateParser(className, stageName, operations, opsUsed, vectorizeEvals);
        cHelpersStepsHppParserAVX.push(`        void ${stageName}_parser_avx(StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams, uint32_t nrowsBatch, bool domainExtended);`);
        const domainExtended = stage > nStages ? true : false;
        if(stage == nStages) {
            cHelpersStepsCppParserAVX.push(...[
                `            case ${nStages}:`,
                "                if(parserParams.imPols) {",
                `                    ${className}::step${nStages}_imPols_parser_avx(starkInfo, params, parserParams, nrowsBatch, ${domainExtended});`,
                "                } else {",
                `                    ${className}::step${nStages}_parser_avx(starkInfo, params, parserParams, nrowsBatch, ${domainExtended});`,
                "                }",
                `                break;`
            ])
        }  else if(stage !== nStages) {
            cHelpersStepsCppParserAVX.push(...[
                `            case ${stage}:`,
                `                ${className}::step${stage}_parser_avx(starkInfo, params, parserParams, nrowsBatch, ${domainExtended});`,
                `                break;`
            ])
        }
    }

    cHelpersStepsCppParserAVX.push("        }");
    if(multiple) {
        cHelpersStepsCpp.push(...cHelpersStepsCppParserAVX);
    }
    if(multiple) cHelpersStepsCpp.push("    }");
    cHelpersStepsCpp.push("}");

    if(multiple) cHelpersStepsHpp.push(...cHelpersStepsHppParserAVX);
    cHelpersStepsHpp.push("};");


    result[`${className}_cpp`] = cHelpersStepsCpp.join("\n");
    result[`${className}_hpp`] = cHelpersStepsHpp.join("\n"); 
    
    const operationsPatterns = operations.filter(op => op.isGroupOps);
    console.log("Number of patterns used: " + operationsPatterns.length);
    for(let i = 0; i < operationsPatterns.length; ++i) {
        console.log("case " + operationsPatterns[i].opIndex + " ->    " + operationsPatterns[i].ops.join(", "));
    }
    
    // Set case to consecutive numbers
    for(let i = 0; i < cHelpersInfo.length; ++i) {
        let stageName = `step${cHelpersInfo[i].stage}`;
        if(cHelpersInfo[i].imPols) stageName += "_imPols";
        cHelpersInfo[i].ops = cHelpersInfo[i].ops.map(op => totalSubsetOperationsUsed.findIndex(o => o === op));

        if(multiple) {
            result[`${className}_${stageName}_parser_cpp`] = result[`${className}_${stageName}_parser_cpp`].replace(/case (\d+):/g, (match, caseNumber) => {
                caseNumber = parseInt(caseNumber, 10);
                const newIndex = totalSubsetOperationsUsed.findIndex(o => o === caseNumber);
                if(newIndex === -1) throw new Error("Invalid operation!");
                return `case ${newIndex}:`;
            });
        }
        
    }
    result[`${className}_generic_parser_cpp`] = result[`${className}_generic_parser_cpp`].replace(/case (\d+):/g, (match, caseNumber) => {
        caseNumber = parseInt(caseNumber, 10);
        const newIndex = totalSubsetOperationsUsed.findIndex(o => o === caseNumber);
        if(newIndex === -1) throw new Error("Invalid operation!");
        return `case ${newIndex}:`;
    });

    return {code: result, cHelpersInfo };

    function getParserArgsStage(stage, stageName, stageCode, dom, imPols = false) {
        console.log(`Getting parser args for ${stageName}`);

        const {stageInfo, operationsUsed: opsUsed} = getParserArgs(starkInfo, operations, stageCode, dom, stage, imPols);

        console.log("Number of operations before join: " + stageInfo.ops.length);

        const patternOps = findPatterns(stageInfo.ops, operations);
        opsUsed.push(...patternOps);

        console.log("Number of operations after join: " + stageInfo.ops.length);

        cHelpersInfo.push(stageInfo);
        for(let j = 0; j < opsUsed.length; ++j) {
            if(!totalSubsetOperationsUsed.includes(opsUsed[j])) totalSubsetOperationsUsed.push(opsUsed[j]);
        }

        operationsUsed[stageName] = opsUsed;   
        console.log("--------------------------------");
    }
}