const GLOBAL_CONSTRAINTS_NSECTIONS = 2;
const GLOBAL_CONSTRAINTS_SECTION = 2;

const { createBinFile, startWriteSection, endWriteSection } = require("@iden3/binfileutils");
const { getParserArgs } = require("../getParserArgs.js");
const { getGlobalOperations } = require("../utils.js");
const { writeStringToFile } = require("../binFile.js");

module.exports.writeGlobalConstraintsBinFile = async function writeGlobalConstraintsBinFile(globalConstraintsInfo, globalConstraintsFilename) {    
    const constraintsInfo = [];

    let operations = getGlobalOperations();
  
    // Get parser args for each constraint
    for(let j = 0; j < globalConstraintsInfo.length; ++j) {
        const constraintInfo = getParserArgs({}, operations, globalConstraintsInfo[j], "n").expsInfo;
        constraintInfo.line = globalConstraintsInfo[j].line;
        constraintsInfo.push(constraintInfo);
    }

    const globalConstraintsBin = await createBinFile(globalConstraintsFilename, "chps", 1, GLOBAL_CONSTRAINTS_NSECTIONS, 1 << 22, 1 << 24);    

    await writeConstraintsSection(globalConstraintsBin, constraintsInfo, GLOBAL_CONSTRAINTS_SECTION);

    console.log("> Writing the global constraints file finished");
    console.log("---------------------------------------------");

    await globalConstraintsBin.close();
}

async function writeConstraintsSection(globalConstraintsBin, constraintsInfo, section) {
    console.log(`··· Writing Section ${section}. CHelpers constraints debug section`);

    await startWriteSection(globalConstraintsBin, section);

    const opsDebug = [];
    const argsDebug = [];
    const numbersDebug = [];

    const opsOffsetDebug = [];
    const argsOffsetDebug = [];
    const numbersOffsetDebug = [];

    const nConstraints = constraintsInfo.length;

    for(let i = 0; i < nConstraints; i++) {
        if(i == 0) {
            opsOffsetDebug.push(0);
            argsOffsetDebug.push(0);
            numbersOffsetDebug.push(0);
        } else {
            opsOffsetDebug.push(opsOffsetDebug[i-1] + constraintsInfo[i-1].ops.length);
            argsOffsetDebug.push(argsOffsetDebug[i-1] + constraintsInfo[i-1].args.length);
            numbersOffsetDebug.push(numbersOffsetDebug[i-1] + constraintsInfo[i-1].numbers.length);
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
    }

    await globalConstraintsBin.writeULE32(opsDebug.length);
    await globalConstraintsBin.writeULE32(argsDebug.length);
    await globalConstraintsBin.writeULE32(numbersDebug.length);

    await globalConstraintsBin.writeULE32(nConstraints);

    for(let i = 0; i < nConstraints; i++) {
        const constraintInfo = constraintsInfo[i];

        await globalConstraintsBin.writeULE32(constraintInfo.destDim);
        await globalConstraintsBin.writeULE32(constraintInfo.destId);

        await globalConstraintsBin.writeULE32(constraintInfo.nTemp1);
        await globalConstraintsBin.writeULE32(constraintInfo.nTemp3);

        await globalConstraintsBin.writeULE32(constraintInfo.ops.length);
        await globalConstraintsBin.writeULE32(opsOffsetDebug[i]);

        await globalConstraintsBin.writeULE32(constraintInfo.args.length);
        await globalConstraintsBin.writeULE32(argsOffsetDebug[i]);

        await globalConstraintsBin.writeULE32(constraintInfo.numbers.length);
        await globalConstraintsBin.writeULE32(numbersOffsetDebug[i]);

        writeStringToFile(globalConstraintsBin, constraintInfo.line);
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
    
    await globalConstraintsBin.write(buffOpsDebug);
    await globalConstraintsBin.write(buffArgsDebug);
    await globalConstraintsBin.write(buffNumbersDebug);

    await endWriteSection(globalConstraintsBin);
}