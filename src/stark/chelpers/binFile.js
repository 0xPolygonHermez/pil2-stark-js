const { createBinFile,
    endWriteSection,
    startWriteSection
     } = require("@iden3/binfileutils");

const CHELPERS_NSECTIONS = 5;

const CHELPERS_HEADER_SECTION = 2;
const CHELPERS_STAGES_SECTION = 3;
const CHELPERS_EXPRESSIONS_SECTION = 4;
const CHELPERS_BUFFERS_SECTION = 5;
const CHELPERS_SYMBOLS_SECTION = 6;

exports.writeCHelpersFile = async function (cHelpersFilename, stagesInfo, expressionsInfo) {
    console.log("> Writing the chelpers file");

    const cHelpersBin = await createBinFile(cHelpersFilename, "chps", 1, CHELPERS_NSECTIONS, 1 << 22, 1 << 24);    
    
    const ops = [];
    const args = [];
    const numbers = [];
    const constPolsIds = [];
    const cmPolsIds = [];

    const opsOffset = [];
    const argsOffset = [];
    const numbersOffset = [];
    const constPolsIdsOffset = [];
    const cmPolsIdsOffset = [];

    for(let i = 0; i < stagesInfo.length; i++) {
        if(i == 0) {
            opsOffset.push(0);
            argsOffset.push(0);
            numbersOffset.push(0);
            constPolsIdsOffset.push(0);
            cmPolsIdsOffset.push(0);
        } else {
            opsOffset.push(opsOffset[i-1] + stagesInfo[i-1].ops.length);
            argsOffset.push(argsOffset[i-1] + stagesInfo[i-1].args.length);
            numbersOffset.push(numbersOffset[i-1] + stagesInfo[i-1].numbers.length);
            constPolsIdsOffset.push(constPolsIdsOffset[i-1] + stagesInfo[i-1].constPolsIds.length);
            cmPolsIdsOffset.push(cmPolsIdsOffset[i-1] + stagesInfo[i-1].cmPolsIds.length);
        }
        ops.push(...stagesInfo[i].ops);
        args.push(...stagesInfo[i].args);
        numbers.push(...stagesInfo[i].numbers);
        constPolsIds.push(...stagesInfo[i].constPolsIds);
        cmPolsIds.push(...stagesInfo[i].cmPolsIds);
    }

    for(let i = 0; i < expressionsInfo.length; i++) {
        if(i == 0) {
            opsOffset.push(stagesInfo[stagesInfo.length-1].ops.length);
            argsOffset.push(stagesInfo[stagesInfo.length-1].args.length);
            numbersOffset.push(stagesInfo[stagesInfo.length-1].numbers.length);
            constPolsIdsOffset.push(stagesInfo[stagesInfo.length-1].constPolsIds.length);
            cmPolsIdsOffset.push(stagesInfo[stagesInfo.length-1].cmPolsIds.length);
        } else {
            opsOffset.push(opsOffset[i-1] + expressionsInfo[i-1].ops.length);
            argsOffset.push(argsOffset[i-1] + expressionsInfo[i-1].args.length);
            numbersOffset.push(numbersOffset[i-1] + expressionsInfo[i-1].numbers.length);
            constPolsIdsOffset.push(constPolsIdsOffset[i-1] + expressionsInfo[i-1].constPolsIds.length);
            cmPolsIdsOffset.push(cmPolsIdsOffset[i-1] + expressionsInfo[i-1].cmPolsIds.length);
        }
        ops.push(...expressionsInfo[i].ops);
        args.push(...expressionsInfo[i].args);
        numbers.push(...expressionsInfo[i].numbers);
        constPolsIds.push(...expressionsInfo[i].constPolsIds);
        cmPolsIds.push(...expressionsInfo[i].cmPolsIds);
    }

    console.log(`··· Writing Section ${CHELPERS_HEADER_SECTION}. CHelpers header section`);
    await startWriteSection(cHelpersBin, CHELPERS_HEADER_SECTION);
    
    await cHelpersBin.writeULE32(ops.length);
    await cHelpersBin.writeULE32(args.length);
    await cHelpersBin.writeULE32(numbers.length);

    await endWriteSection(cHelpersBin);
    
    console.log(`··· Writing Section ${CHELPERS_STAGES_SECTION}. CHelpers stages section`);
    await startWriteSection(cHelpersBin, CHELPERS_STAGES_SECTION);

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
    }

    await endWriteSection(cHelpersBin);

    console.log(`··· Writing Section ${CHELPERS_EXPRESSIONS_SECTION}. CHelpers expressions section`);
    await startWriteSection(cHelpersBin, CHELPERS_EXPRESSIONS_SECTION);

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
        await cHelpersBin.writeULE32(opsOffset[nStages + i]);

        await cHelpersBin.writeULE32(expInfo.args.length);
        await cHelpersBin.writeULE32(argsOffset[nStages + i]);

        await cHelpersBin.writeULE32(expInfo.numbers.length);
        await cHelpersBin.writeULE32(numbersOffset[nStages + i]);
        
        await cHelpersBin.writeULE32(expInfo.constPolsIds.length);
        await cHelpersBin.writeULE32(constPolsIdsOffset[nStages + i]);

        await cHelpersBin.writeULE32(expInfo.cmPolsIds.length);
        await cHelpersBin.writeULE32(cmPolsIdsOffset[nStages + i]);
    }

    await endWriteSection(cHelpersBin);

    console.log(`··· Writing Section ${CHELPERS_BUFFERS_SECTION}. CHelpers buffers section`);
    await startWriteSection(cHelpersBin, CHELPERS_BUFFERS_SECTION);

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

    await cHelpersBin.write(buffOps);
    await cHelpersBin.write(buffArgs);
    await cHelpersBin.write(buffNumbers);

    await endWriteSection(cHelpersBin);

    console.log(`··· Writing Section ${CHELPERS_SYMBOLS_SECTION}. CHelpers symbols section`);

    await startWriteSection(cHelpersBin, CHELPERS_SYMBOLS_SECTION);
    
    await cHelpersBin.writeULE32(constPolsIds.length);
    await cHelpersBin.writeULE32(cmPolsIds.length);

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
    
    await cHelpersBin.write(buffConstPolsIds);
    await cHelpersBin.write(buffCmPolsIds);
    
    await endWriteSection(cHelpersBin);


    console.log("> Writing the chelpers file finished");

    await cHelpersBin.close();
}