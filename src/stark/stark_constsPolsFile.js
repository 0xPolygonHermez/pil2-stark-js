const { createBinFile,
    endWriteSection,
    readBinFile,
    startWriteSection,
    startReadUniqueSection,
    readBigInt,
    endReadSection } = require("@iden3/binfileutils");
const { BigBuffer } = require("pilcom");

const {
    CONSTS_PS_NSECTIONS,
    CONSTS_PS_CONST_POLS_EVALS_SECTION,
    CONSTS_PS_CONST_TREE_SECTION,
    CONSTS_PS_X_N_SECTION,
    CONSTS_PS_X_EXT_SECTION,
} = require("./stark_constsPols_constants.js");

exports.writePilStarkConstsFile = async function (consts, constsFilename, options) {
    let logger = options.logger;

    if (logger) logger.info("> Writing the Pil-Stark consts file");
    const fdConsts = await createBinFile(constsFilename, "cnts", 1, CONSTS_PS_NSECTIONS, 1 << 22, 1 << 24);

    if (logger) logger.info(`··· Writing Section ${CONSTS_PS_CONST_POLS_EVALS_SECTION}. Fixed Pols Evaluations`);
    await writeConstPolsEvalsSection(fdConsts, consts);
    
    if (globalThis.gc) globalThis.gc();

    if (logger) logger.info(`··· Writing Section ${CONSTS_PS_CONST_TREE_SECTION}. Const Tree`);
    await writeConstTreeSection(fdConsts, consts);
    if (globalThis.gc) globalThis.gc();

    if (logger) logger.info(`··· Writing Section ${CONSTS_PS_X_N_SECTION}. X_n Evaluations`);
    await writeXnSection(fdConsts, consts);
    if (globalThis.gc) globalThis.gc();

    if (logger) logger.info(`··· Writing Section ${CONSTS_PS_X_EXT_SECTION}. X_ext Evaluations`);
    await writeXExtSection(fdConsts, consts);
    if (globalThis.gc) globalThis.gc();
    
    if (logger) logger.info("> Writing the consts file finished");

    await fdConsts.close();
}

async function writeConstPolsEvalsSection(fdConsts, consts) {
    await startWriteSection(fdConsts, CONSTS_PS_CONST_POLS_EVALS_SECTION);
    console.log(consts.fixedPolsEvals.length);
    await fdConsts.writeULE32(consts.fixedPolsEvals.length);
    writeBigBuffer(fdConsts, consts.fixedPolsEvals);
    await endWriteSection(fdConsts);
}

async function writeConstTreeSection(fdConsts, consts) {
    await startWriteSection(fdConsts, CONSTS_PS_CONST_TREE_SECTION);

    await fdConsts.writeULE32(consts.constTree.width);
    await fdConsts.writeULE32(consts.constTree.height);

    await fdConsts.writeULE32(consts.constTree.elements.length);
    writeBigBuffer(fdConsts, consts.constTree.elements);

    await fdConsts.writeULE32(consts.constTree.nodes.length);
    writeBigBuffer(fdConsts, consts.constTree.nodes);

    await endWriteSection(fdConsts);
}


async function writeXnSection(fdConsts, consts) {
    await startWriteSection(fdConsts, CONSTS_PS_X_N_SECTION);
    
    await fdConsts.writeULE32(consts.x_n.length);
    await fdConsts.write(consts.x_n);

    await endWriteSection(fdConsts);
}


async function writeXExtSection(fdConsts, consts) {
    await startWriteSection(fdConsts, CONSTS_PS_X_EXT_SECTION);
    await fdConsts.writeULE32(consts.x_ext.length);
    await fdConsts.write(consts.x_ext)
    await endWriteSection(fdConsts);
}

async function writeBigBuffer(fd, buff) {
    const MaxBuffSize = 1024*1024*32;  //  256Mb
    for (let i=0; i<buff.length; i+= MaxBuffSize) {
        console.log(`writting buffer.. ${i} / ${buff.length}`);
        const n = Math.min(buff.length -i, MaxBuffSize);
        const sb = buff.slice(i, n+i);
        await fd.write(sb);
    }
}

exports.readPilStarkConstsFile = async function (constsFilename, options) {
    let logger;
    if (options && options.logger) logger = options.logger;


    if (logger) logger.info("> Reading the Pil-Stark consts file");

    const { fd: fdConsts, sections } = await readBinFile(constsFilename, "cnts", 1, 1 << 25, 1 << 23);
    
    const consts = {};

    if (logger) logger.info(`··· Reading Section ${CONSTS_PS_CONST_POLS_EVALS_SECTION}. Fixed Pols Evaluations`);
    await readConstPolsEvalsSection(fdConsts, sections, consts);
    if (globalThis.gc) globalThis.gc();

    if (logger) logger.info(`··· Reading Section ${CONSTS_PS_CONST_TREE_SECTION}. Const Tree`);
    await readConstTreeSection(fdConsts, sections, consts);
    if (globalThis.gc) globalThis.gc();

    if (logger) logger.info(`··· Reading Section ${CONSTS_PS_X_N_SECTION}. X_n Evaluations`);
    await readXnSection(fdConsts, sections, consts);
    if (globalThis.gc) globalThis.gc();

    if (logger) logger.info(`··· Reading Section ${CONSTS_PS_X_EXT_SECTION}. X_ext Evaluations`);
    await readXExtSection(fdConsts, sections, consts);
    if (globalThis.gc) globalThis.gc();
    
    if (logger) logger.info("> Reading the consts file finished");

    await fdConsts.close();

    return consts;
}

async function readConstPolsEvalsSection(fdConsts, sections, consts) {
    await startReadUniqueSection(fdConsts, sections, CONSTS_PS_CONST_POLS_EVALS_SECTION);
    const lenFixedPols = await fdConsts.readULE32();
    consts.fixedPolsEvals = new BigBuffer(lenFixedPols);
    readBigBuffer(fdConsts, consts.fixedPolsEvals);
    await endReadSection(fdConsts);
}

async function readConstTreeSection(fdConsts, sections, consts, F) {
    await startReadUniqueSection(fdConsts, sections, CONSTS_PS_CONST_TREE_SECTION);
    consts.constTree = {};

    consts.constTree.width = await fdConsts.readULE32();
    consts.constTree.height = await fdConsts.readULE32();

    const lenElements = await fdConsts.readULE32();
    consts.constTree.elements = new BigBuffer(lenElements);
    readBigBuffer(fdConsts, consts.constTree.elements);

    const lenNodes = await fdConsts.readULE32();
    consts.constTree.nodes = new BigBuffer(lenNodes);
    readBigBuffer(fdConsts, consts.constTree.nodes);

    await endReadSection(fdConsts);

}


async function readXnSection(fdConsts, sections, consts, F) {
    await startReadUniqueSection(fdConsts, sections, CONSTS_PS_X_N_SECTION);
    const lenXn = await fdConsts.readULE32();
    consts.x_n = new BigBuffer(lenXn);
    readBigBuffer(fdConsts, consts.x_n);

    await endReadSection(fdConsts);
}


async function readXExtSection(fdConsts, sections, consts, F) {
    await startReadUniqueSection(fdConsts, sections, CONSTS_PS_X_EXT_SECTION);
    const lenXExt = await fdConsts.readULE32();
    consts.x_ext = new BigBuffer(lenXExt);
    readBigBuffer(fdConsts, consts.x_ext);

    await endReadSection(fdConsts);
}

async function readBigBuffer(fd, buff) {
    const MaxBuffSize = 1024*1024*32;  //  256Mb
    let o =0;
    for (let i=0; i<buff.length; i+= MaxBuffSize) {
        console.log(`Loading tree.. ${i}/${buff.length}`);
        const n = Math.min(buff.length -i, MaxBuffSize);
        const buff8 = new Uint8Array(n*8);
        await fd.read({buffer: buff8, offset: 0, length:n*8, position:i*8});
        const buff64 = new BigUint64Array(buff8.buffer);
        buff.set(buff64, o);
        o += n;
    }
}