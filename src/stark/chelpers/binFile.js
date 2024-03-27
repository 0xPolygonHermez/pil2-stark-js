const { createBinFile,
    endWriteSection,
    startWriteSection
     } = require("@iden3/binfileutils");

const CHELPERS_NSECTIONS = 4;

const CHELPERS_STAGES_SECTION = 2;
const CHELPERS_EXPRESSIONS_SECTION = 3;
const CHELPERS_CONSTRAINTS_DEBUG_SECTION = 4;
// const CHELPERS_HINTS_SECTION = 5;


exports.writeCHelpersFile = async function (cHelpersFilename, stagesInfo, expressionsInfo, constraintsInfo) {
    console.log("> Writing the chelpers file");

    const cHelpersBin = await createBinFile(cHelpersFilename, "chps", 1, CHELPERS_NSECTIONS, 1 << 22, 1 << 24);    
        
    console.log(`··· Writing Section ${CHELPERS_STAGES_SECTION}. CHelpers stages section`);
    await startWriteSection(cHelpersBin, CHELPERS_STAGES_SECTION);

    const ops = [];
    const args = [];
    const numbers = [];
    const constPolsIds = [];
    const cmPolsIds = [];
    const challengesIds = [];
    const publicsIds = [];
    const subproofValuesIds = [];

    const opsOffset = [];
    const argsOffset = [];
    const numbersOffset = [];
    const constPolsIdsOffset = [];
    const cmPolsIdsOffset = [];
    const challengesIdsOffset = [];
    const publicsIdsOffset = [];
    const subproofValuesIdsOffset = [];

    for(let i = 0; i < stagesInfo.length; i++) {
        if(i == 0) {
            opsOffset.push(0);
            argsOffset.push(0);
            numbersOffset.push(0);
            constPolsIdsOffset.push(0);
            cmPolsIdsOffset.push(0);
            challengesIdsOffset.push(0);
            publicsIdsOffset.push(0);
            subproofValuesIdsOffset.push(0);
        } else {
            opsOffset.push(opsOffset[i-1] + stagesInfo[i-1].ops.length);
            argsOffset.push(argsOffset[i-1] + stagesInfo[i-1].args.length);
            numbersOffset.push(numbersOffset[i-1] + stagesInfo[i-1].numbers.length);
            constPolsIdsOffset.push(constPolsIdsOffset[i-1] + stagesInfo[i-1].constPolsIds.length);
            cmPolsIdsOffset.push(cmPolsIdsOffset[i-1] + stagesInfo[i-1].cmPolsIds.length);
            challengesIdsOffset.push(challengesIdsOffset[i-1] + stagesInfo[i-1].challengeIds.length);
            publicsIdsOffset.push(publicsIdsOffset[i-1] + stagesInfo[i-1].publicsIds.length);
            subproofValuesIdsOffset.push(subproofValuesIdsOffset[i-1] + stagesInfo[i-1].subproofValuesIds.length);
        }
        for(let j = 0; j < stagesInfo[i].ops.length; j++) {
            ops.push(stagesInfo[i].ops[j]);
        }
        for(let j = 0; j < stagesInfo[i].args.length; j++) {
            args.push(stagesInfo[i].args[j]);
        }
        for(let j = 0; j < stagesInfo[i].numbers.length; j++) {
            numbers.push(stagesInfo[i].numbers[j]);
        }
        for(let j = 0; j < stagesInfo[i].constPolsIds.length; j++) {
            constPolsIds.push(stagesInfo[i].constPolsIds[j]);
        }
        for(let j = 0; j < stagesInfo[i].cmPolsIds.length; j++) {
            cmPolsIds.push(stagesInfo[i].cmPolsIds[j]);
        }
        for(let j = 0; j < stagesInfo[i].challengeIds.length; j++) {
            challengesIds.push(stagesInfo[i].challengeIds[j]);
        }
        for(let j = 0; j < stagesInfo[i].publicsIds.length; j++) {
            publicsIds.push(stagesInfo[i].publicsIds[j]);
        }
        for(let j = 0; j < stagesInfo[i].subproofValuesIds.length; j++) {
            subproofValuesIds.push(stagesInfo[i].subproofValuesIds[j]);
        }
    }

    await cHelpersBin.writeULE32(ops.length);
    await cHelpersBin.writeULE32(args.length);
    await cHelpersBin.writeULE32(numbers.length);

    await cHelpersBin.writeULE32(constPolsIds.length);
    await cHelpersBin.writeULE32(cmPolsIds.length);
    await cHelpersBin.writeULE32(challengesIds.length);
    await cHelpersBin.writeULE32(publicsIds.length);
    await cHelpersBin.writeULE32(subproofValuesIds.length);

    const nStages = stagesInfo.length;

    //Write the number of stages
    await cHelpersBin.writeULE32(nStages);

    for(let i = 0; i < nStages; i++) {
        const stageInfo = stagesInfo[i];

        await cHelpersBin.writeULE32(stageInfo.stage);
        await cHelpersBin.writeULE32(stageInfo.nTemp1);
        await cHelpersBin.writeULE32(stageInfo.nTemp3);

        await cHelpersBin.writeULE32(stageInfo.ops.length);
        await cHelpersBin.writeULE32(opsOffset[i]);

        await cHelpersBin.writeULE32(stageInfo.args.length);
        await cHelpersBin.writeULE32(argsOffset[i]);

        await cHelpersBin.writeULE32(stageInfo.numbers.length);
        await cHelpersBin.writeULE32(numbersOffset[i]);
        
        await cHelpersBin.writeULE32(stageInfo.constPolsIds.length);
        await cHelpersBin.writeULE32(constPolsIdsOffset[i]);

        await cHelpersBin.writeULE32(stageInfo.cmPolsIds.length);
        await cHelpersBin.writeULE32(cmPolsIdsOffset[i]);

        await cHelpersBin.writeULE32(stageInfo.challengeIds.length);
        await cHelpersBin.writeULE32(challengesIdsOffset[i]);

        await cHelpersBin.writeULE32(stageInfo.publicsIds.length);
        await cHelpersBin.writeULE32(publicsIdsOffset[i]);

        await cHelpersBin.writeULE32(stageInfo.subproofValuesIds.length);
        await cHelpersBin.writeULE32(subproofValuesIdsOffset[i]);
    }

    const buffOps = new Uint8Array(ops.length);
    const buffOpsV = new DataView(buffOps.buffer);
    for(let j = 0; j < ops.length; j++) {
        buffOpsV.setUint8(j, ops[j]);
    }

    const buffArgs = new Uint8Array(2*args.length);
    const buffArgsV = new DataView(buffArgs.buffer);
    for(let j = 0; j < args.length; j++) {
        buffArgsV.setUint16(2*j, args[j], true);
    }

    const buffNumbers = new Uint8Array(8*numbers.length);
    const buffNumbersV = new DataView(buffNumbers.buffer);
    for(let j = 0; j < numbers.length; j++) {
        buffNumbersV.setBigUint64(8*j, BigInt(numbers[j]), true);
    }

    const buffConstPolsIds = new Uint8Array(2*constPolsIds.length);
    const buffConstPolsIdsV = new DataView(buffConstPolsIds.buffer);
    for(let j = 0; j < constPolsIds.length; j++) {
        buffConstPolsIdsV.setUint16(2*j, constPolsIds[j], true);
    }

    const buffCmPolsIds = new Uint8Array(2*cmPolsIds.length);
    const buffCmPolsIdsV = new DataView(buffCmPolsIds.buffer);
    for(let j = 0; j < cmPolsIds.length; j++) {
        buffCmPolsIdsV.setUint16(2*j, cmPolsIds[j], true);
    }

    const buffChallengesIds = new Uint8Array(2*challengesIds.length);
    const buffChallengesIdsV = new DataView(buffChallengesIds.buffer);
    for(let j = 0; j < challengesIds.length; j++) {
        buffChallengesIdsV.setUint16(2*j, challengesIds[j], true);
    }
    
    const buffPublicsIds = new Uint8Array(2*publicsIds.length);
    const buffPublicsIdsV = new DataView(buffPublicsIds.buffer);
    for(let j = 0; j < publicsIds.length; j++) {
        buffPublicsIdsV.setUint16(2*j, publicsIds[j], true);
    }

    const buffSubproofValuesIds = new Uint8Array(2*subproofValuesIds.length);
    const buffSubproofValuesIdsV = new DataView(buffSubproofValuesIds.buffer);
    for(let j = 0; j < subproofValuesIds.length; j++) {
        buffSubproofValuesIdsV.setUint16(2*j, subproofValuesIds[j], true);
    }

    await cHelpersBin.write(buffOps);
    await cHelpersBin.write(buffArgs);
    await cHelpersBin.write(buffNumbers);

    await cHelpersBin.write(buffConstPolsIds);
    await cHelpersBin.write(buffCmPolsIds);
    await cHelpersBin.write(buffChallengesIds);
    await cHelpersBin.write(buffPublicsIds);
    await cHelpersBin.write(buffSubproofValuesIds);

    await endWriteSection(cHelpersBin);

    console.log(`··· Writing Section ${CHELPERS_EXPRESSIONS_SECTION}. CHelpers expressions section`);
    await startWriteSection(cHelpersBin, CHELPERS_EXPRESSIONS_SECTION);

    const opsExpressions = [];
    const argsExpressions = [];
    const numbersExpressions = [];
    const constPolsIdsExpressions = [];
    const cmPolsIdsExpressions = [];
    const challengesIdsExpressions = [];
    const publicsIdsExpressions = [];
    const subproofValuesIdsExpressions = [];

    const opsExpressionsOffset = [];
    const argsExpressionsOffset = [];
    const numbersExpressionsOffset = [];
    const constPolsIdsExpressionsOffset = [];
    const cmPolsIdsExpressionsOffset = [];
    const challengesIdsExpressionsOffset = [];
    const publicsIdsExpressionsOffset = [];
    const subproofValuesIdsExpressionsOffset = [];

    for(let i = 0; i < expressionsInfo.length; i++) {
        if(i == 0) {
            opsExpressionsOffset.push(0);
            argsExpressionsOffset.push(0);
            numbersExpressionsOffset.push(0);
            constPolsIdsExpressionsOffset.push(0);
            cmPolsIdsExpressionsOffset.push(0);
            challengesIdsExpressionsOffset.push(0);
            publicsIdsExpressionsOffset.push(0);
            subproofValuesIdsExpressionsOffset.push(0);
        } else {
            opsExpressionsOffset.push(opsExpressionsOffset[i-1] + expressionsInfo[i-1].ops.length);
            argsExpressionsOffset.push(argsExpressionsOffset[i-1] + expressionsInfo[i-1].args.length);
            numbersExpressionsOffset.push(numbersExpressionsOffset[i-1] + expressionsInfo[i-1].numbers.length);
            constPolsIdsExpressionsOffset.push(constPolsIdsExpressionsOffset[i-1] + expressionsInfo[i-1].constPolsIds.length);
            cmPolsIdsExpressionsOffset.push(cmPolsIdsExpressionsOffset[i-1] + expressionsInfo[i-1].cmPolsIds.length);
            challengesIdsExpressionsOffset.push(challengesIdsExpressionsOffset[i-1] + expressionsInfo[i-1].challengeIds.length);
            publicsIdsExpressionsOffset.push(publicsIdsExpressionsOffset[i-1] + expressionsInfo[i-1].publicsIds.length);
            subproofValuesIdsExpressionsOffset.push(subproofValuesIdsExpressionsOffset[i-1] + expressionsInfo[i-1].subproofValuesIds.length);
        }
        for(let j = 0; j < expressionsInfo[i].ops.length; j++) {
            opsExpressions.push(expressionsInfo[i].ops[j]);
        }
        for(let j = 0; j < expressionsInfo[i].args.length; j++) {
            argsExpressions.push(expressionsInfo[i].args[j]);
        }
        for(let j = 0; j < expressionsInfo[i].numbers.length; j++) {
            numbersExpressions.push(expressionsInfo[i].numbers[j]);
        }
        for(let j = 0; j < expressionsInfo[i].constPolsIds.length; j++) {
            constPolsIdsExpressions.push(expressionsInfo[i].constPolsIds[j]);
        }
        for(let j = 0; j < expressionsInfo[i].cmPolsIds.length; j++) {
            cmPolsIdsExpressions.push(expressionsInfo[i].cmPolsIds[j]);
        }
        for(let j = 0; j < expressionsInfo[i].challengeIds.length; j++) {
            challengesIdsExpressions.push(expressionsInfo[i].challengeIds[j]);
        }
        for(let j = 0; j < expressionsInfo[i].publicsIds.length; j++) {
            publicsIdsExpressions.push(expressionsInfo[i].publicsIds[j]);
        }
        for(let j = 0; j < expressionsInfo[i].subproofValuesIds.length; j++) {
            subproofValuesIdsExpressions.push(expressionsInfo[i].subproofValuesIds[j]);
        } 
    }
    
    await cHelpersBin.writeULE32(opsExpressions.length);
    await cHelpersBin.writeULE32(argsExpressions.length);
    await cHelpersBin.writeULE32(numbersExpressions.length);

    await cHelpersBin.writeULE32(constPolsIdsExpressions.length);
    await cHelpersBin.writeULE32(cmPolsIdsExpressions.length);
    await cHelpersBin.writeULE32(challengesIdsExpressions.length);
    await cHelpersBin.writeULE32(publicsIdsExpressions.length);
    await cHelpersBin.writeULE32(subproofValuesIdsExpressions.length);

    const nExpressions = expressionsInfo.length;

    //Write the number of expressions
    await cHelpersBin.writeULE32(nExpressions);

    for(let i = 0; i < nExpressions; i++) {
        const expInfo = expressionsInfo[i];

        await cHelpersBin.writeULE32(expInfo.expId);
        await cHelpersBin.writeULE32(expInfo.stage);
        await cHelpersBin.writeULE32(expInfo.nTemp1);
        await cHelpersBin.writeULE32(expInfo.nTemp3);

        await cHelpersBin.writeULE32(expInfo.ops.length);
        await cHelpersBin.writeULE32(opsExpressionsOffset[i]);

        await cHelpersBin.writeULE32(expInfo.args.length);
        await cHelpersBin.writeULE32(argsExpressionsOffset[i]);

        await cHelpersBin.writeULE32(expInfo.numbers.length);
        await cHelpersBin.writeULE32(numbersExpressionsOffset[i]);
        
        await cHelpersBin.writeULE32(expInfo.constPolsIds.length);
        await cHelpersBin.writeULE32(constPolsIdsExpressionsOffset[i]);

        await cHelpersBin.writeULE32(expInfo.cmPolsIds.length);
        await cHelpersBin.writeULE32(cmPolsIdsExpressionsOffset[i]);

        await cHelpersBin.writeULE32(expInfo.challengeIds.length);
        await cHelpersBin.writeULE32(challengesIdsExpressionsOffset[i]);

        await cHelpersBin.writeULE32(expInfo.publicsIds.length);
        await cHelpersBin.writeULE32(publicsIdsExpressionsOffset[i]);

        await cHelpersBin.writeULE32(expInfo.subproofValuesIds.length);
        await cHelpersBin.writeULE32(subproofValuesIdsExpressionsOffset[i]);
    }

    const buffOpsExpressions = new Uint8Array(opsExpressions.length);
    const buffOpsExpressionsV = new DataView(buffOpsExpressions.buffer);
    for(let j = 0; j < opsExpressions.length; j++) {
        buffOpsExpressionsV.setUint8(j, opsExpressions[j]);
    }

    const buffArgsExpressions = new Uint8Array(2*argsExpressions.length);
    const buffArgsExpressionsV = new DataView(buffArgsExpressions.buffer);
    for(let j = 0; j < argsExpressions.length; j++) {
        buffArgsExpressionsV.setUint16(2*j, argsExpressions[j], true);
    }

    const buffNumbersExpressions = new Uint8Array(8*numbersExpressions.length);
    const buffNumbersExpressionsV = new DataView(buffNumbersExpressions.buffer);
    for(let j = 0; j < numbersExpressions.length; j++) {
        buffNumbersExpressionsV.setBigUint64(8*j, BigInt(numbersExpressions[j]), true);
    }

    const buffConstPolsIdsExpressions = new Uint8Array(2*constPolsIdsExpressions.length);
    const buffConstPolsIdsExpressionsV = new DataView(buffConstPolsIdsExpressions.buffer);
    for(let j = 0; j < constPolsIdsExpressions.length; j++) {
        buffConstPolsIdsExpressionsV.setUint16(2*j, constPolsIdsExpressions[j], true);
    }

    const buffCmPolsIdsExpressions = new Uint8Array(2*cmPolsIdsExpressions.length);
    const buffCmPolsIdsExpressionsV = new DataView(buffCmPolsIdsExpressions.buffer);
    for(let j = 0; j < cmPolsIdsExpressions.length; j++) {
        buffCmPolsIdsExpressionsV.setUint16(2*j, cmPolsIdsExpressions[j], true);
    }

    const buffChallengesIdsExpressions = new Uint8Array(2*challengesIdsExpressions.length);
    const buffChallengesIdsExpressionsV = new DataView(buffChallengesIdsExpressions.buffer);
    for(let j = 0; j < challengesIdsExpressions.length; j++) {
        buffChallengesIdsExpressionsV.setUint16(2*j, challengesIdsExpressions[j], true);
    }

    const buffPublicsIdsExpressions = new Uint8Array(2*publicsIdsExpressions.length);
    const buffPublicsIdsExpressionsV = new DataView(buffPublicsIdsExpressions.buffer);
    for(let j = 0; j < publicsIdsExpressions.length; j++) {
        buffPublicsIdsExpressionsV.setUint16(2*j, publicsIdsExpressions[j], true);
    }

    const buffSubproofValuesIdsExpressions = new Uint8Array(2*subproofValuesIdsExpressions.length);
    const buffSubproofValuesIdsExpressionsV = new DataView(buffSubproofValuesIdsExpressions.buffer);
    for(let j = 0; j < subproofValuesIdsExpressions.length; j++) {
        buffSubproofValuesIdsExpressionsV.setUint16(2*j, subproofValuesIdsExpressions[j], true);
    }
    
    await cHelpersBin.write(buffOpsExpressions);
    await cHelpersBin.write(buffArgsExpressions);
    await cHelpersBin.write(buffNumbersExpressions);

    await cHelpersBin.write(buffConstPolsIdsExpressions);
    await cHelpersBin.write(buffCmPolsIdsExpressions);
    await cHelpersBin.write(buffChallengesIdsExpressions);
    await cHelpersBin.write(buffPublicsIdsExpressions);
    await cHelpersBin.write(buffSubproofValuesIdsExpressions);

    await endWriteSection(cHelpersBin);

    console.log(`··· Writing Section ${CHELPERS_CONSTRAINTS_DEBUG_SECTION}. CHelpers constraints debug section`);
    await startWriteSection(cHelpersBin, CHELPERS_CONSTRAINTS_DEBUG_SECTION);

    const opsDebug = [];
    const argsDebug = [];
    const numbersDebug = [];
    const constPolsIdsDebug = [];
    const cmPolsIdsDebug = [];
    const challengesIdsDebug = [];
    const publicsIdsDebug = [];
    const subproofValuesIdsDebug = [];

    const opsOffsetDebug = [];
    const argsOffsetDebug = [];
    const numbersOffsetDebug = [];
    const constPolsIdsOffsetDebug = [];
    const cmPolsIdsOffsetDebug = [];
    const challengesIdsOffsetDebug = [];
    const publicsIdsOffsetDebug = [];
    const subproofValuesIdsOffsetDebug = [];

    const nConstraints = constraintsInfo.length;

    for(let i = 0; i < nConstraints; i++) {
        if(i == 0) {
            opsOffsetDebug.push(0);
            argsOffsetDebug.push(0);
            numbersOffsetDebug.push(0);
            constPolsIdsOffsetDebug.push(0);
            cmPolsIdsOffsetDebug.push(0);
            challengesIdsOffsetDebug.push(0);
            publicsIdsOffsetDebug.push(0);
            subproofValuesIdsOffsetDebug.push(0);
        } else {
            opsOffsetDebug.push(opsOffsetDebug[i-1] + constraintsInfo[i-1].ops.length);
            argsOffsetDebug.push(argsOffsetDebug[i-1] + constraintsInfo[i-1].args.length);
            numbersOffsetDebug.push(numbersOffsetDebug[i-1] + constraintsInfo[i-1].numbers.length);
            constPolsIdsOffsetDebug.push(constPolsIdsOffsetDebug[i-1] + constraintsInfo[i-1].constPolsIds.length);
            cmPolsIdsOffsetDebug.push(cmPolsIdsOffsetDebug[i-1] + constraintsInfo[i-1].cmPolsIds.length);
            challengesIdsOffsetDebug.push(challengesIdsOffsetDebug[i-1] + constraintsInfo[i-1].challengeIds.length);
            publicsIdsOffsetDebug.push(publicsIdsOffsetDebug[i-1] + constraintsInfo[i-1].publicsIds.length);
            subproofValuesIdsOffsetDebug.push(subproofValuesIdsOffsetDebug[i-1] + constraintsInfo[i-1].subproofValuesIds.length);
        }
        for(let j = 0; j < constraintsInfo[i].ops.length; j++) {
            opsDebug.push(constraintsInfo[i].ops[j]);
        }
        for(let j = 0; j < constraintsInfo[i].args.length; j++) {
            argsDebug.push(constraintsInfo[i].args[j]);
        }
        for(let j = 0; j < constraintsInfo[i].numbers.length; j++) {
            numbersDebug.push(constraintsInfo[i].numbers[j]);
        }
        for(let j = 0; j < constraintsInfo[i].constPolsIds.length; j++) {
            constPolsIdsDebug.push(constraintsInfo[i].constPolsIds[j]);
        }
        for(let j = 0; j < constraintsInfo[i].cmPolsIds.length; j++) {
            cmPolsIdsDebug.push(constraintsInfo[i].cmPolsIds[j]);
        }
        for(let j = 0; j < constraintsInfo[i].challengeIds.length; j++) {
            challengesIdsDebug.push(constraintsInfo[i].challengeIds[j]);
        }
        for(let j = 0; j < constraintsInfo[i].publicsIds.length; j++) {
            publicsIdsDebug.push(constraintsInfo[i].publicsIds[j]);
        }
        for(let j = 0; j < constraintsInfo[i].subproofValuesIds.length; j++) {
            subproofValuesIdsDebug.push(constraintsInfo[i].subproofValuesIds[j]);
        }
    }

    await cHelpersBin.writeULE32(opsDebug.length);
    await cHelpersBin.writeULE32(argsDebug.length);
    await cHelpersBin.writeULE32(numbersDebug.length);

    await cHelpersBin.writeULE32(constPolsIdsDebug.length);
    await cHelpersBin.writeULE32(cmPolsIdsDebug.length);
    await cHelpersBin.writeULE32(challengesIdsDebug.length);
    await cHelpersBin.writeULE32(publicsIdsDebug.length);
    await cHelpersBin.writeULE32(subproofValuesIdsDebug.length);

    await cHelpersBin.writeULE32(nConstraints);

    for(let i = 0; i < nConstraints; i++) {
        const constraintInfo = constraintsInfo[i];

        await cHelpersBin.writeULE32(constraintInfo.stage);

        await cHelpersBin.writeULE32(constraintInfo.destDim);
        await cHelpersBin.writeULE32(constraintInfo.destId);

        await cHelpersBin.writeULE32(constraintInfo.nTemp1);
        await cHelpersBin.writeULE32(constraintInfo.nTemp3);

        await cHelpersBin.writeULE32(constraintInfo.ops.length);
        await cHelpersBin.writeULE32(opsOffsetDebug[i]);

        await cHelpersBin.writeULE32(constraintInfo.args.length);
        await cHelpersBin.writeULE32(argsOffsetDebug[i]);

        await cHelpersBin.writeULE32(constraintInfo.numbers.length);
        await cHelpersBin.writeULE32(numbersOffsetDebug[i]);
        
        await cHelpersBin.writeULE32(constraintInfo.constPolsIds.length);
        await cHelpersBin.writeULE32(constPolsIdsOffsetDebug[i]);

        await cHelpersBin.writeULE32(constraintInfo.cmPolsIds.length);
        await cHelpersBin.writeULE32(cmPolsIdsOffsetDebug[i]);

        await cHelpersBin.writeULE32(constraintInfo.challengeIds.length);
        await cHelpersBin.writeULE32(challengesIdsOffsetDebug[i]);

        await cHelpersBin.writeULE32(constraintInfo.publicsIds.length);
        await cHelpersBin.writeULE32(publicsIdsOffsetDebug[i]);

        await cHelpersBin.writeULE32(constraintInfo.subproofValuesIds.length);
        await cHelpersBin.writeULE32(subproofValuesIdsOffsetDebug[i]);
    }

    const buffOpsDebug = new Uint8Array(opsDebug.length);
    const buffOpsDebugV = new DataView(buffOpsDebug.buffer);
    for(let j = 0; j < opsDebug.length; j++) {
        buffOpsDebugV.setUint8(j, opsDebug[j]);
    }

    const buffArgsDebug = new Uint8Array(2*argsDebug.length);
    const buffArgsDebugV = new DataView(buffArgsDebug.buffer);
    for(let j = 0; j < argsDebug.length; j++) {
        buffArgsDebugV.setUint16(2*j, argsDebug[j], true);
    }

    const buffNumbersDebug = new Uint8Array(8*numbersDebug.length);
    const buffNumbersDebugV = new DataView(buffNumbersDebug.buffer);
    for(let j = 0; j < numbersDebug.length; j++) {
        buffNumbersDebugV.setBigUint64(8*j, BigInt(numbersDebug[j]), true);
    }

    const buffConstPolsIdsDebug = new Uint8Array(2*constPolsIdsDebug.length);
    const buffConstPolsIdsDebugV = new DataView(buffConstPolsIdsDebug.buffer);
    for(let j = 0; j < constPolsIdsDebug.length; j++) {
        buffConstPolsIdsDebugV.setUint16(2*j, constPolsIdsDebug[j], true);
    }

    const buffCmPolsIdsDebug = new Uint8Array(2*cmPolsIdsDebug.length);
    const buffCmPolsIdsDebugV = new DataView(buffCmPolsIdsDebug.buffer);
    for(let j = 0; j < cmPolsIdsDebug.length; j++) {
        buffCmPolsIdsDebugV.setUint16(2*j, cmPolsIdsDebug[j], true);
    }

    const buffChallengesIdsDebug = new Uint8Array(2*challengesIdsDebug.length);
    const buffChallengesIdsDebugV = new DataView(buffChallengesIdsDebug.buffer);
    for(let j = 0; j < challengesIdsDebug.length; j++) {
        buffChallengesIdsDebugV.setUint16(2*j, challengesIdsDebug[j], true);
    }

    const buffPublicsIdsDebug = new Uint8Array(2*publicsIdsDebug.length);
    const buffPublicsIdsDebugV = new DataView(buffPublicsIdsDebug.buffer);
    for(let j = 0; j < publicsIdsDebug.length; j++) {
        buffPublicsIdsDebugV.setUint16(2*j, publicsIdsDebug[j], true);
    }

    const buffSubproofValuesIdsDebug = new Uint8Array(2*subproofValuesIdsDebug.length);
    const buffSubproofValuesIdsDebugV = new DataView(buffSubproofValuesIdsDebug.buffer);
    for(let j = 0; j < subproofValuesIdsDebug.length; j++) {
        buffSubproofValuesIdsDebugV.setUint16(2*j, subproofValuesIdsDebug[j], true);
    }
    
    await cHelpersBin.write(buffOpsDebug);
    await cHelpersBin.write(buffArgsDebug);
    await cHelpersBin.write(buffNumbersDebug);

    await cHelpersBin.write(buffConstPolsIdsDebug);
    await cHelpersBin.write(buffCmPolsIdsDebug);
    await cHelpersBin.write(buffChallengesIdsDebug);
    await cHelpersBin.write(buffPublicsIdsDebug);
    await cHelpersBin.write(buffSubproofValuesIdsDebug);

    await endWriteSection(cHelpersBin);

    console.log("> Writing the chelpers file finished");

    await cHelpersBin.close();
}