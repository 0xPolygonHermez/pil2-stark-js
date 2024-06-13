const F3g = require("../../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom2");
const protobuf = require('protobufjs');

const Logger = require('logplease');

const fs = require("fs");

const { generateWtnsCols, generateFixedCols } = require("../../../src/witness/witnessCalculator.js");

const smFibonacci = require("../../state_machines/pil2/sm_fibonacci/sm_fibonacci.js");

const { generateStarkProof } = require("../helpers");
const { getFixedPolsPil2 } = require("../../../src/pil_info/helpers/pil2/piloutInfo");

describe("test fibonacci pil2 sm", async function () {
    this.timeout(10000000);

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const starkStruct = {
            nBits: 6,
            nBitsExt: 8,
            nQueries: 32,
            verificationHashType : "GL",
            steps: [
                {nBits: 8},
                {nBits: 5},
                {nBits: 3}
            ]
        };

        const F = new F3g("0xFFFFFFFF00000001");

        const tmpPath = path.resolve(__dirname, '../../../tmp');
        if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        let pilConfig = { piloutDir: tmpPath};
        await compile(F, path.join(__dirname, "../../state_machines/", "pil2", "sm_fibonacci", "fibonacci.pil"), null, pilConfig);
        
        const piloutEncoded = fs.readFileSync(path.join(tmpPath, "pilout.ptb"));
        const pilOutProtoPath = path.resolve(__dirname, '../../../node_modules/pilcom2/src/pilout.proto');
        const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        const pil = pilout.subproofs[0].airs[0];
        pil.symbols = pilout.symbols;
        pil.numChallenges = pilout.numChallenges;
        pil.hints = pilout.hints;
        pil.airId = 0;
        pil.subproofId = 0;

        const cnstPols = generateFixedCols(pil.symbols, pil.numRows);
        getFixedPolsPil2(pil, cnstPols, F);

        const cmPols = generateWtnsCols(1, pil.symbols, pil.numRows);
        await smFibonacci.execute(pil.numRows, cmPols.Fibonacci, [1, 2], F);

        const publics = [cmPols.Fibonacci.b[0], cmPols.Fibonacci.a[0], cmPols.Fibonacci.a[pil.numRows - 1], 5n]; 
        await generateStarkProof(cnstPols, cmPols, pil, starkStruct, publics, {logger, F, pil2: true, debug: true});
    });
});
