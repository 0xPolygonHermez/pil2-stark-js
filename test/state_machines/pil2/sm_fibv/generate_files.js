const path = require("path");
const version = require("../../../../package").version;
const protobuf = require("protobufjs");
const pilInfo = require("../../../../src/pil_info/pil_info.js");
const { buildCHelpers } = require("../../../../src/stark/chelpers/stark_chelpers.js");
const { buildConstTree } = require("../../../../src/stark/stark_buildConstTree");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const { compile } = require("pilcom2");

const fs = require("fs");
const { F1Field, getCurveFromName } = require("ffjavascript");
const F3g = require("../../../../src/helpers/f3g.js");

const { getFixedPolsPil2 } = require("../../../../src/pil_info/helpers/pil2/piloutInfo.js");
const { generateFixedCols } = require("../../../../src/witness/witnessCalculator.js");

const argv = require("yargs")
    .version(version)
    .usage("node generate_files.js -s <starkstruct.json> -p [file.pilout]")
    .alias("s", "starkstruct")
    .alias("p", "pilout")
    .string("curve").argv;

async function run() {
    if (argv.curve && !["gl", "bn128"].includes(argv.curve)) throw new Error("Curve not supported");

    const starkStructFile = typeof(argv.starkstruct) === "string" ?  argv.starkstruct.trim() : "mycircuit.stark_struct.json";
    
    // Check files exist
    checkFileExists(argv.pilout);
    checkFileExists(starkStructFile);

    const curveName = argv.curve || "gl";
    const F = curveName === "gl" ? new F3g() : new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);

    const outPath = path.resolve(__dirname, "./out");
    if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);

    let piloutEncoded = null;

    if (!argv.pilout) {
        const tmpPath = path.resolve(__dirname, "./tmp");
        if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        let pilConfig = { piloutDir: tmpPath };
        await compile(F, path.join(__dirname, "fibonacci.pil"), null, pilConfig);

        piloutEncoded = fs.readFileSync(path.join(tmpPath, "pilout.ptb"));
    } else {
        piloutEncoded = fs.readFileSync(argv.pilout);
    }

    const pilOutProtoPath = path.resolve(__dirname, "../../../../node_modules/pilcom2/src/pilout.proto");
    const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
    let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));

    for (let i = 0; i < pilout.subproofs.length; i++) {
        for (let j = 0; j < pilout.subproofs[i].airs.length; j++) {
            console.log(
                "Generating file for air " + pilout.subproofs[i].airs[j].name
            );

            const pil = pilout.subproofs[i].airs[j];
            const subproof_name = pilout.subproofs[i].name;
            const air_name = pilout.subproofs[i].airs[j].name;
            pil.symbols = pilout.symbols;
            pil.numChallenges = pilout.numChallenges;
            pil.hints = pilout.hints;
            pil.subproofId = i;
            pil.airId = j;

            const outputConstFile = path.join(outPath, air_name + ".const");
            const starkInfoFile = path.join(outPath, air_name + ".starkinfo.json");
            const expressionsInfoFile = path.join(outPath, air_name + ".expressionsinfo.json");
            const verifierInfoFile = path.join(outPath, air_name + ".verifierinfo.json");
            const className = subproof_name + "_" + j;
            const cHelpersFile = path.join(outPath, air_name + ".chelpers.cpp");
            const binFile = path.join(outPath, air_name + ".chelpers.bin");
            const genericBinFile = undefined;
            const verkeyFile = path.join(outPath, air_name + ".verkey.json");
            const constTreeFile = path.join(outPath, air_name + ".consttree");

            // Generate const file
            const constPols = generateFixedCols(pil.symbols, pil.numRows);
            getFixedPolsPil2(pil, constPols, F);

            if (curveName === "gl") {
                await constPols.saveToFile(outputConstFile);
            } else {
                const curve = await getCurveFromName("bn128");
                const Fr = curve.Fr;
                await curve.terminate();

                await constPols.saveToFileFr(outputConstFile, Fr);
            }

            // Generate starkinfo, expressionsinfo and verifierinfo files
            const starkStructJson = JSON.parse(await fs.promises.readFile(starkStructFile, "utf8"));
            const starkStruct = starkStructJson[air_name];

            const options = {};
            if (starkStruct.verificationHashType === "BN128") {
                options.arity = starkStruct.merkleTreeArity ?? 16;
                options.custom = starkStruct.merkleTreeCustom ?? false;
            }

            options.imPolsStages = argv.impolsstages || false;

            const { pilInfo: starkInfo, expressionsInfo, verifierInfo } = pilInfo(F, pil, true, true, starkStruct, options);

            await fs.promises.writeFile(starkInfoFile, JSON.stringify(starkInfo, null, 1), "utf8");
            await fs.promises.writeFile(expressionsInfoFile, JSON.stringify(expressionsInfo, null, 1), "utf8");
            await fs.promises.writeFile(verifierInfoFile, JSON.stringify(verifierInfo, null, 1), "utf8");

            await buildCHelpers(starkInfo, expressionsInfo, cHelpersFile, className, binFile, genericBinFile);

            const {MH, constTree, verKey} = await buildConstTree(starkInfo, constPols);

            await fs.promises.writeFile(verkeyFile, JSONbig.stringify(verKey, null, 1), "utf8");

            await MH.writeToFile(constTree, constTreeFile);

        }
    }

    console.log("Files Generated Correctly");
}

async function checkFileExists(filePath) {
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error("File '" + filePath + "' does not exist");
            throw new Error("File '" + filePath + "' does not exist");
        }
    });
}

run().then(
    () => {
        process.exit(0);
    },
    (err) => {
        console.log(err.message);
        console.log(err.stack);
        process.exit(1);
    }
);
