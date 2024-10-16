const { createBinFile,
    endWriteSection,
    startWriteSection
     } = require("@iden3/binfileutils");

const CHELPERS_NSECTIONS = 4;
const CHELPERS_EXPRESSIONS_SECTION = 2;
const CHELPERS_CONSTRAINTS_DEBUG_SECTION = 3;
const CHELPERS_HINTS_SECTION = 4;

module.exports.writeStringToFile = async function writeStringToFile(fd, str) {
    let buff = new Uint8Array(str.length + 1);
    for (let i = 0; i < str.length; i++) {
        buff[i] = str.charCodeAt(i);
    }
    buff[str.length] = 0;

    await fd.write(buff);
}

module.exports.writeVerifierExpressionsBinFile = async function writeVerifierExpressionsBinFile(cHelpersFilename, binFileInfo) {
    console.log("> Writing the chelpers verifier file");

    const cHelpersBin = await createBinFile(cHelpersFilename, "chps", 1, 2, 1 << 22, 1 << 24);

    const expressionsInfo = [binFileInfo.qCode, binFileInfo.queryCode];

    await writeExpressionsSection(cHelpersBin, expressionsInfo, binFileInfo.numbersExps, 2, true);

    console.log("> Writing the chelpers file finished");
    console.log("---------------------------------------------");

    await cHelpersBin.close();
}

module.exports.writeExpressionsBinFile = async function writeExpressionsBinFile(cHelpersFilename, binFileInfo) {
    console.log("> Writing the chelpers file");

    const expressionsInfo = binFileInfo.expsInfo;
    const constraintsInfo = binFileInfo.constraintsInfo;
    const hintsInfo = binFileInfo.hintsInfo;

    const cHelpersBin = await createBinFile(cHelpersFilename, "chps", 1, CHELPERS_NSECTIONS, 1 << 22, 1 << 24);    
        
    await writeExpressionsSection(cHelpersBin, expressionsInfo, binFileInfo.numbersExps, CHELPERS_EXPRESSIONS_SECTION);

    await writeConstraintsSection(cHelpersBin, constraintsInfo, binFileInfo.numbersConstraints, CHELPERS_CONSTRAINTS_DEBUG_SECTION);

    await writeHintsSection(cHelpersBin, hintsInfo, CHELPERS_HINTS_SECTION);

    console.log("> Writing the chelpers file finished");
    console.log("---------------------------------------------");

    await cHelpersBin.close();
}

async function writeExpressionsSection(cHelpersBin, expressionsInfo, numbersExps, section, verify = false) {
    console.log(`··· Writing Section ${section}. CHelpers expressions section`);

    await startWriteSection(cHelpersBin, section);

    const opsExpressions = [];
    const argsExpressions = [];
    const constPolsIdsExpressions = [];
    const cmPolsIdsExpressions = [];
    const challengesIdsExpressions = [];
    const publicsIdsExpressions = [];
    const subproofValuesIdsExpressions = [];

    const opsExpressionsOffset = [];
    const argsExpressionsOffset = [];
    const constPolsIdsExpressionsOffset = [];
    const cmPolsIdsExpressionsOffset = [];
    const challengesIdsExpressionsOffset = [];
    const publicsIdsExpressionsOffset = [];
    const subproofValuesIdsExpressionsOffset = [];

    for(let i = 0; i < expressionsInfo.length; i++) {
        if(i == 0) {
            opsExpressionsOffset.push(0);
            argsExpressionsOffset.push(0);
            constPolsIdsExpressionsOffset.push(0);
            cmPolsIdsExpressionsOffset.push(0);
            challengesIdsExpressionsOffset.push(0);
            publicsIdsExpressionsOffset.push(0);
            subproofValuesIdsExpressionsOffset.push(0);
        } else {
            opsExpressionsOffset.push(opsExpressionsOffset[i-1] + expressionsInfo[i-1].ops.length);
            argsExpressionsOffset.push(argsExpressionsOffset[i-1] + expressionsInfo[i-1].args.length);
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
    await cHelpersBin.writeULE32(numbersExps.length);

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
        await cHelpersBin.writeULE32(expInfo.destDim);
        await cHelpersBin.writeULE32(expInfo.destId);
        await cHelpersBin.writeULE32(expInfo.stage);
        await cHelpersBin.writeULE32(expInfo.nTemp1);
        await cHelpersBin.writeULE32(expInfo.nTemp3);

        await cHelpersBin.writeULE32(expInfo.ops.length);
        await cHelpersBin.writeULE32(opsExpressionsOffset[i]);

        await cHelpersBin.writeULE32(expInfo.args.length);
        await cHelpersBin.writeULE32(argsExpressionsOffset[i]);
        
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

        module.exports.writeStringToFile(cHelpersBin, expInfo.line);
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

    const buffNumbersExpressions = new Uint8Array(8*numbersExps.length);
    const buffNumbersExpressionsV = new DataView(buffNumbersExpressions.buffer);
    for(let j = 0; j < numbersExps.length; j++) {
        buffNumbersExpressionsV.setBigUint64(8*j, BigInt(numbersExps[j]), true);
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
}

async function writeConstraintsSection(cHelpersBin, constraintsInfo, numbersConstraints, section) {
    console.log(`··· Writing Section ${section}. CHelpers constraints debug section`);

    await startWriteSection(cHelpersBin, section);

    const opsDebug = [];
    const argsDebug = [];
    const constPolsIdsDebug = [];
    const cmPolsIdsDebug = [];
    const challengesIdsDebug = [];
    const publicsIdsDebug = [];
    const subproofValuesIdsDebug = [];

    const opsOffsetDebug = [];
    const argsOffsetDebug = [];
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
            constPolsIdsOffsetDebug.push(0);
            cmPolsIdsOffsetDebug.push(0);
            challengesIdsOffsetDebug.push(0);
            publicsIdsOffsetDebug.push(0);
            subproofValuesIdsOffsetDebug.push(0);
        } else {
            opsOffsetDebug.push(opsOffsetDebug[i-1] + constraintsInfo[i-1].ops.length);
            argsOffsetDebug.push(argsOffsetDebug[i-1] + constraintsInfo[i-1].args.length);
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
    await cHelpersBin.writeULE32(numbersConstraints.length);

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

        await cHelpersBin.writeULE32(constraintInfo.firstRow);
        await cHelpersBin.writeULE32(constraintInfo.lastRow);
        await cHelpersBin.writeULE32(constraintInfo.nTemp1);
        await cHelpersBin.writeULE32(constraintInfo.nTemp3);

        await cHelpersBin.writeULE32(constraintInfo.ops.length);
        await cHelpersBin.writeULE32(opsOffsetDebug[i]);

        await cHelpersBin.writeULE32(constraintInfo.args.length);
        await cHelpersBin.writeULE32(argsOffsetDebug[i]);
        
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

        await cHelpersBin.writeULE32(constraintInfo.imPol);
        module.exports.writeStringToFile(cHelpersBin, constraintInfo.line);
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

    const buffNumbersDebug = new Uint8Array(8*numbersConstraints.length);
    const buffNumbersDebugV = new DataView(buffNumbersDebug.buffer);
    for(let j = 0; j < numbersConstraints.length; j++) {
        buffNumbersDebugV.setBigUint64(8*j, BigInt(numbersConstraints[j]), true);
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
}

async function writeHintsSection(cHelpersBin, hintsInfo, section) {
    console.log(`··· Writing Section ${section}. Hints section`);

    await startWriteSection(cHelpersBin, section);

    const nHints = hintsInfo.length;
    await cHelpersBin.writeULE32(nHints);

    for(let j = 0; j < nHints; j++) {
        const hint = hintsInfo[j];
        await module.exports.writeStringToFile(cHelpersBin, hint.name);
        const nFields = hint.fields.length;
        await cHelpersBin.writeULE32(nFields);
        for(let k = 0; k < nFields; k++) {
            const field = hint.fields[k];
            await module.exports.writeStringToFile(cHelpersBin, field.name);
            const nValues = field.values.length;
            await cHelpersBin.writeULE32(nValues);
            for(let v = 0; v < field.values.length; ++v) {
                const value = field.values[v];
                await module.exports.writeStringToFile(cHelpersBin, value.op);
                if(value.op === "number") {
                    const buffNumber = new Uint8Array(8);
                    const buffNumberV = new DataView(buffNumber.buffer);
                    buffNumberV.setBigUint64(0, BigInt(value.value), true);
                    await cHelpersBin.write(buffNumber);
                } else if(value.op === "string") {
                    module.exports.writeStringToFile(cHelpersBin, value.string);
                } else {
                    await cHelpersBin.writeULE32(value.id);
                }
                if(value.op === "tmp") await cHelpersBin.writeULE32(value.dim);
                
                await cHelpersBin.writeULE32(value.pos.length);
                for(let p = 0; p < value.pos.length; ++p) {
                    await cHelpersBin.writeULE32(value.pos[p]);
                }
            }
            
        }
    }

    await endWriteSection(cHelpersBin);
}