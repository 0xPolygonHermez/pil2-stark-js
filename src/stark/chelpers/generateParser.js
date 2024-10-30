const { getAllOperations, numberOfArgs, getGlobalOperations, writeType } = require("./utils");

const operationsMap = {
    "commit1": 1,
    "x": 2,
    "Zi": 2,
    "const": 3,
    "tmp1": 4,
    "public": 5,
    "number": 6,
    "airvalue1": 7,
    "commit3": 8,
    "xDivXSubXi": 9,
    "tmp3": 10,
    "airvalue3": 11,
    "airgroupvalue": 12,
    "challenge": 13, 
    "eval": 14,
}

module.exports.generateParser = function generateParser(parserType = "avx", global = false) {

    let operations = !global ? getAllOperations() : getGlobalOperations();

    let c_args = 0;
    
    if(!["avx", "avx512", "pack"].includes(parserType)) throw new Error("Invalid parser type");

    let isAvx = ["avx", "avx512"].includes(parserType);

    let avxTypeElement;
    let avxTypeExtElement;
    let avxSet1Epi64;
    let avxLoad;
    let avxStore;
    let avxCopy;

    if(isAvx) {
        avxTypeElement = parserType === "avx" ? "__m256i" : "__m512i";
        avxTypeExtElement = parserType === "avx" ? "Goldilocks3::Element_avx" : "Goldilocks3::Element_avx512";
        avxSet1Epi64 = parserType === "avx" ? "_mm256_set1_epi64x" : "_mm512_set1_epi64";
        avxLoad = parserType === "avx" ? "load_avx" : "load_avx512";
        avxStore = parserType === "avx" ? "store_avx" : "store_avx512";
        avxCopy = parserType === "avx" ? "copy_avx" : "copy_avx512";

    }

    const parserCPP = [];

    if(parserType === "avx") {
        parserCPP.push("uint64_t nrowsPack = 4;");
    } else if (parserType === "avx512") {
        parserCPP.push("uint64_t nrowsPack = 8;");
    } else {
        parserCPP.push("uint64_t nrowsPack;");
    }

    parserCPP.push(...[
        "uint64_t nCols;",
        "vector<uint64_t> nColsStages;",
        "vector<uint64_t> nColsStagesAcc;",
        "vector<uint64_t> offsetsStages;",
    ]);

    const expressionsClassName = parserType === "avx" ? `ExpressionsAvx` : parserType === "avx512" ? "ExpressionsAvx512" : "ExpressionsPack";

    if(isAvx) {
        parserCPP.push(`${expressionsClassName}(SetupCtx& setupCtx) : ExpressionsCtx(setupCtx) {};\n`);
    } else {
        parserCPP.push(`${expressionsClassName}(SetupCtx& setupCtx, uint64_t nrowsPack_ = 4) : ExpressionsCtx(setupCtx), nrowsPack(nrowsPack_) {};\n`);
    }
   

    parserCPP.push(`void setBufferTInfo(bool domainExtended, int64_t expId) {`);
    if(isAvx) {
        parserCPP.push(`    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();`);
    } else {
        // parserCPP.push(`    uint64_t nOpenings = setupCtx.starkInfo.verify ? 1 : setupCtx.starkInfo.openingPoints.size();`);
        parserCPP.push(`    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();`);
    }
        
    parserCPP.push(...[
        `    offsetsStages.resize((setupCtx.starkInfo.nStages + 2)*nOpenings + 1);`,
        `    nColsStages.resize((setupCtx.starkInfo.nStages + 2)*nOpenings + 1);`,
        `    nColsStagesAcc.resize((setupCtx.starkInfo.nStages + 2)*nOpenings + 1);\n`,
        `    nCols = setupCtx.starkInfo.nConstants;`,
        `    uint64_t ns = setupCtx.starkInfo.nStages + 2;`,
        `    for(uint64_t o = 0; o < nOpenings; ++o) {`,
        `        for(uint64_t stage = 0; stage <= ns; ++stage) {`,
        `            std::string section = stage == 0 ? "const" : "cm" + to_string(stage);`,
        `            offsetsStages[(setupCtx.starkInfo.nStages + 2)*o + stage] = setupCtx.starkInfo.mapOffsets[std::make_pair(section, domainExtended)];`,
        `            nColsStages[(setupCtx.starkInfo.nStages + 2)*o + stage] = setupCtx.starkInfo.mapSectionsN[section];`,
        `            nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o + stage] = stage == 0 && o == 0 ? 0 : nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o + stage - 1] + nColsStages[stage - 1];`,
        `        }`,
        `    }\n`,
        "    nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] = nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings - 1] + nColsStages[(setupCtx.starkInfo.nStages + 2)*nOpenings - 1];",
        "    if(expId == int64_t(setupCtx.starkInfo.cExpId)) {",
        "        nCols = nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + setupCtx.starkInfo.boundaries.size() + 1;",
        "    } else if(expId == int64_t(setupCtx.starkInfo.friExpId)) {",
        "        nCols = nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + nOpenings*FIELD_EXTENSION;",
        "    } else {",
        "        nCols = nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + 1;",
        "    }",
        "}\n",
    ]);
    
    if(isAvx) {
        parserCPP.push(...[
            `inline void loadPolynomials(StepsParams& params, ParserArgs &parserArgs, std::vector<Dest> &dests, ${avxTypeElement} *bufferT_, uint64_t row, uint64_t domainSize) {`,
            "    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();",
            "    bool domainExtended = domainSize == uint64_t(1 << setupCtx.starkInfo.starkStruct.nBitsExt) ? true : false;\n",
            "    uint64_t extendBits = (setupCtx.starkInfo.starkStruct.nBitsExt - setupCtx.starkInfo.starkStruct.nBits);",
            "    int64_t extend = domainExtended ? (1 << extendBits) : 1;",
            "    uint64_t nextStrides[nOpenings];",
            "    for(uint64_t i = 0; i < nOpenings; ++i) {",
            "        uint64_t opening = setupCtx.starkInfo.openingPoints[i] < 0 ? setupCtx.starkInfo.openingPoints[i] + domainSize : setupCtx.starkInfo.openingPoints[i];",
            "        nextStrides[i] = opening * extend;",
            "    }\n",
            "    Goldilocks::Element *constPols = domainExtended ? setupCtx.constPols.pConstPolsAddressExtended : setupCtx.constPols.pConstPolsAddress;\n",
            "    std::vector<bool> constPolsUsed(setupCtx.starkInfo.constPolsMap.size(), false);",
            "    std::vector<bool> cmPolsUsed(setupCtx.starkInfo.cmPolsMap.size(), false);\n",
            "    for(uint64_t i = 0; i < dests.size(); ++i) {",
            "        for(uint64_t j = 0; j < dests[i].params.size(); ++j) {",
            "            if(dests[i].params[j].op == opType::cm) {",
            "                cmPolsUsed[dests[i].params[j].polMap.polsMapId] = true;",
            "            }",
            "            if(dests[i].params[j].op == opType::tmp) {",
            "                uint16_t* cmUsed = &parserArgs.cmPolsIds[dests[i].params[j].parserParams.cmPolsOffset];",
            "                uint16_t* constUsed = &parserArgs.constPolsIds[dests[i].params[j].parserParams.constPolsOffset];\n",
            "                for(uint64_t k = 0; k < dests[i].params[j].parserParams.nConstPolsUsed; ++k) {",
            "                    constPolsUsed[constUsed[k]] = true;",
            "                }\n",
            "                for(uint64_t k = 0; k < dests[i].params[j].parserParams.nCmPolsUsed; ++k) {",
            "                    cmPolsUsed[cmUsed[k]] = true;",
            "                }",
            "            }",
            "        }",
            "    }",
            "    Goldilocks::Element bufferT[nOpenings*nrowsPack];\n",
            "    for(uint64_t k = 0; k < constPolsUsed.size(); ++k) {",
            "        if(!constPolsUsed[k]) continue;",
            "        for(uint64_t o = 0; o < nOpenings; ++o) {",
            "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                uint64_t l = (row + j + nextStrides[o]) % domainSize;",
            "                bufferT[nrowsPack*o + j] = constPols[l * nColsStages[0] + k];",
            "            }",
            `            Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o] + k], &bufferT[nrowsPack*o]);`,
            "        }",
            "    }\n",
            "    for(uint64_t k = 0; k < cmPolsUsed.size(); ++k) {",
            "        if(!cmPolsUsed[k]) continue;",
            "        PolMap polInfo = setupCtx.starkInfo.cmPolsMap[k];",
            "        uint64_t stage = polInfo.stage;",
            "        uint64_t stagePos = polInfo.stagePos;",
            "        for(uint64_t d = 0; d < polInfo.dim; ++d) {",
            "            for(uint64_t o = 0; o < nOpenings; ++o) {",
            "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                    uint64_t l = (row + j + nextStrides[o]) % domainSize;",
            "                    bufferT[nrowsPack*o + j] = params.pols[offsetsStages[stage] + l * nColsStages[stage] + stagePos + d];",
            "                }",
            `                Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o + stage] + (stagePos + d)], &bufferT[nrowsPack*o]);`,
            "            }",
            "        }",
            "    }\n",
            "    if(dests[0].params[0].parserParams.expId == int64_t(setupCtx.starkInfo.cExpId)) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "            bufferT[j] = setupCtx.constPols.x_2ns[row + j];",
            "        }",
            `        Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings]], &bufferT[0]);`,
            "        for(uint64_t d = 0; d < setupCtx.starkInfo.boundaries.size(); ++d) {",
            "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                bufferT[j] = setupCtx.constPols.zi[row + j + d*domainSize];",
            "            }",
            `            Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + 1 + d], &bufferT[0]);`,
            "        }",
            "    } else if(dests[0].params[0].parserParams.expId == int64_t(setupCtx.starkInfo.friExpId)) {",
            "        for(uint64_t d = 0; d < setupCtx.starkInfo.openingPoints.size(); ++d) {",
            "           for(uint64_t k = 0; k < FIELD_EXTENSION; ++k) {",
            "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `                    bufferT[j] = params.xDivXSub[(row + j + d*domainSize)*FIELD_EXTENSION + k];`,
            "                }",
            `                Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + d*FIELD_EXTENSION + k], &bufferT[0]);`,
            "            }",
            "        }",
            "    } else {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "            bufferT[j] = setupCtx.constPols.x_n[row + j];",
            "        }",
            `        Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings]], &bufferT[0]);`,
            "    }",
            "}\n",
        ])
    } else {
        parserCPP.push(...[
            `inline void loadPolynomials(StepsParams& params, ParserArgs &parserArgs, std::vector<Dest> &dests, Goldilocks::Element *bufferT_, uint64_t row, uint64_t domainSize) {`,
            // "    uint64_t nOpenings = setupCtx.starkInfo.verify ? 1 : setupCtx.starkInfo.openingPoints.size();",
            "    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();",
            "    bool domainExtended = domainSize == uint64_t(1 << setupCtx.starkInfo.starkStruct.nBitsExt) ? true : false;\n",
            "    uint64_t extendBits = (setupCtx.starkInfo.starkStruct.nBitsExt - setupCtx.starkInfo.starkStruct.nBits);",
            "    int64_t extend = domainExtended ? (1 << extendBits) : 1;",
            "    uint64_t nextStrides[nOpenings];",
            "    for(uint64_t i = 0; i < nOpenings; ++i) {",
            // "        uint64_t opening = setupCtx.starkInfo.verify ? 0 : setupCtx.starkInfo.openingPoints[i] < 0 ? setupCtx.starkInfo.openingPoints[i] + domainSize : setupCtx.starkInfo.openingPoints[i];",
            "        uint64_t opening = setupCtx.starkInfo.openingPoints[i] < 0 ? setupCtx.starkInfo.openingPoints[i] + domainSize : setupCtx.starkInfo.openingPoints[i];",
            "        nextStrides[i] = opening * extend;",
            "    }\n",
            "    Goldilocks::Element *constPols = domainExtended ? setupCtx.constPols.pConstPolsAddressExtended : setupCtx.constPols.pConstPolsAddress;\n",
            "    std::vector<bool> constPolsUsed(setupCtx.starkInfo.constPolsMap.size(), false);",
            "    std::vector<bool> cmPolsUsed(setupCtx.starkInfo.cmPolsMap.size(), false);\n",
            "    for(uint64_t i = 0; i < dests.size(); ++i) {",
            "        for(uint64_t j = 0; j < dests[i].params.size(); ++j) {",
            "            if(dests[i].params[j].op == opType::cm) {",
            "                cmPolsUsed[dests[i].params[j].polMap.polsMapId] = true;",
            "            }",
            "            if(dests[i].params[j].op == opType::tmp) {",
            "                uint16_t* cmUsed = &parserArgs.cmPolsIds[dests[i].params[j].parserParams.cmPolsOffset];",
            "                uint16_t* constUsed = &parserArgs.constPolsIds[dests[i].params[j].parserParams.constPolsOffset];\n",
            "                for(uint64_t k = 0; k < dests[i].params[j].parserParams.nConstPolsUsed; ++k) {",
            "                    constPolsUsed[constUsed[k]] = true;",
            "                }\n",
            "                for(uint64_t k = 0; k < dests[i].params[j].parserParams.nCmPolsUsed; ++k) {",
            "                    cmPolsUsed[cmUsed[k]] = true;",
            "                }",
            "            }",
            "        }",
            "    }",
            "    for(uint64_t k = 0; k < constPolsUsed.size(); ++k) {",
            "        if(!constPolsUsed[k]) continue;",
            "        for(uint64_t o = 0; o < nOpenings; ++o) {",
            "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                uint64_t l = (row + j + nextStrides[o]) % domainSize;",
            "                bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o] + k)*nrowsPack + j] = constPols[l * nColsStages[0] + k];",
            "            }",
            "        }",
            "    }\n",
            "    for(uint64_t k = 0; k < cmPolsUsed.size(); ++k) {",
            "        if(!cmPolsUsed[k]) continue;",
            "        PolMap polInfo = setupCtx.starkInfo.cmPolsMap[k];",
            "        uint64_t stage = polInfo.stage;",
            "        uint64_t stagePos = polInfo.stagePos;",
            "        for(uint64_t d = 0; d < polInfo.dim; ++d) {",
            "            for(uint64_t o = 0; o < nOpenings; ++o) {",
            "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                    uint64_t l = (row + j + nextStrides[o]) % domainSize;",
            "                    bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o + stage] + (stagePos + d))*nrowsPack + j] = params.pols[offsetsStages[stage] + l * nColsStages[stage] + stagePos + d];",
            "                }",
            "            }",
            "        }",
            "    }\n",
            "    if(dests[0].params[0].parserParams.expId == int64_t(setupCtx.starkInfo.cExpId)) {",
            "        for(uint64_t d = 0; d < setupCtx.starkInfo.boundaries.size(); ++d) {",
            "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
            // "                if(setupCtx.starkInfo.verify) {",
            // "                    for(uint64_t e = 0; e < FIELD_EXTENSION; ++e) {",
            // "                        bufferT_[((nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + d + FIELD_EXTENSION)*nrowsPack + j) + e] = setupCtx.constPols.zi[d*FIELD_EXTENSION + e];",
            // "                    }",
            // "                } else {",
            "                bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + d + 1)*nrowsPack + j] = setupCtx.constPols.zi[row + j + d*domainSize];",
            // "                }",
            "            }",
            "        }",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            // "            if(setupCtx.starkInfo.verify) {",
            // "                for(uint64_t e = 0; e < FIELD_EXTENSION; ++e) {",
            // "                    bufferT_[((nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings])*nrowsPack + j)*FIELD_EXTENSION + e] = setupCtx.constPols.x_n[e];",
            // "                }",
            // "            } else {",
            "            bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings])*nrowsPack + j] = setupCtx.constPols.x_2ns[row + j];",
            // "            }",
            "        }",
            "    } else if(dests[0].params[0].parserParams.expId == int64_t(setupCtx.starkInfo.friExpId)) {",
            "        for(uint64_t d = 0; d < setupCtx.starkInfo.openingPoints.size(); ++d) {",
            "           for(uint64_t k = 0; k < FIELD_EXTENSION; ++k) {",
            "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `                    bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + d*FIELD_EXTENSION + k)*nrowsPack + j] = params.xDivXSub[(row + j + d*domainSize)*FIELD_EXTENSION + k];`,
            "                }",
            "            }",
            "        }",
            "    } else {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "            bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings])*nrowsPack + j] = setupCtx.constPols.x[row + j];",
            "        }",
            "    }",
            "}\n",
        ])
    }
    
    parserCPP.push(...[
        `inline void copyPolynomial(${isAvx ? avxTypeElement : "Goldilocks::Element"}* destVals, bool inverse, uint64_t dim, ${isAvx ? avxTypeElement : "Goldilocks::Element"}* tmp) {`,
        "    if(dim == 1) {",
        "        if(inverse) {",
    ]);

    if(!isAvx) {
        parserCPP.push("            Goldilocks::batchInverse(&destVals[0], &tmp[0], nrowsPack);");
    } else {
        parserCPP.push(...[
            "            Goldilocks::Element buff[nrowsPack];",
            `            Goldilocks::${avxStore}(buff, tmp[0]);`,
            "            Goldilocks::batchInverse(buff, buff, nrowsPack);",
            `            Goldilocks::${avxLoad}(destVals[0], buff);`,
        ]);
    }

    parserCPP.push(...[
        "        } else {",
        `            Goldilocks::${isAvx ? avxCopy : "copy_pack"}(${!isAvx ? "nrowsPack, &destVals[0]" : "destVals[0]"},${!isAvx ? " &tmp[0]" : "tmp[0]"});`,
        "        }",
        "    } else if(dim == FIELD_EXTENSION) {",
        "        if(inverse) {",
        "            Goldilocks::Element buff[FIELD_EXTENSION*nrowsPack];",
        `            Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack," : ""} &buff[0], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[0]" : "tmp[0]"});`,
        `            Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack," : ""} &buff[1], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[nrowsPack]" : "tmp[1]"});`,
        `            Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack," : ""} &buff[2], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[2*nrowsPack]" : "tmp[2]"});`,
        "            Goldilocks3::batchInverse((Goldilocks3::Element *)buff, (Goldilocks3::Element *)buff, nrowsPack);",
        `            Goldilocks::${isAvx ? avxLoad : "copy_pack"}(${!isAvx ? "nrowsPack, &destVals[0]" : "destVals[0]"}, &buff[0], uint64_t(FIELD_EXTENSION));`,
        `            Goldilocks::${isAvx ? avxLoad : "copy_pack"}(${!isAvx ? "nrowsPack, &destVals[nrowsPack]" : "destVals[1]"}, &buff[1], uint64_t(FIELD_EXTENSION));`,
        `            Goldilocks::${isAvx ? avxLoad : "copy_pack"}(${!isAvx ? "nrowsPack, &destVals[2*nrowsPack]" : "destVals[2]"}, &buff[2], uint64_t(FIELD_EXTENSION));`,
        "        } else {",
        `            Goldilocks::${isAvx ? avxCopy : "copy_pack"}(${!isAvx ? "nrowsPack, &destVals[0]" : "destVals[0]"}, ${!isAvx ? "&tmp[0]" : "tmp[0]"});`,
        `            Goldilocks::${isAvx ? avxCopy : "copy_pack"}(${!isAvx ? "nrowsPack, &destVals[nrowsPack]" : "destVals[1]"},${!isAvx ? " &tmp[nrowsPack]" : "tmp[1]"});`,
        `            Goldilocks::${isAvx ? avxCopy : "copy_pack"}(${!isAvx ? "nrowsPack, &destVals[2*nrowsPack]" : "destVals[2]"},${!isAvx ? " &tmp[2*nrowsPack]" : "tmp[2]"});`,
        "        }",
        "    }",
        "}\n",
    ]);

    if(isAvx) {
        parserCPP.push(...[
            `inline void storePolynomial(std::vector<Dest> dests, ${avxTypeElement}** destVals, uint64_t row) {`,
            "    for(uint64_t i = 0; i < dests.size(); ++i) {",
            `        ${avxTypeElement} vals1;`,
            `        ${avxTypeElement} vals3[FIELD_EXTENSION];`,
            "        uint64_t dim = 1;",
            "        if(dests[i].params.size() == 1) {",
            "            if(dests[i].params[0].dim == 1) {",
            `                Goldilocks::${avxCopy}(vals1, destVals[i][0]);`,
            "                dim = 1;",
            "            } else {",
            `                Goldilocks::${avxCopy}(vals3[0], destVals[i][0]);`,
            `                Goldilocks::${avxCopy}(vals3[1], destVals[i][1]);`,
            `                Goldilocks::${avxCopy}(vals3[2], destVals[i][2]);`,
            "                dim = FIELD_EXTENSION;",
            "            }",
            "        } else if(dests[i].params.size() == 2) {",
            "            if(dests[i].params[0].dim == FIELD_EXTENSION && dests[i].params[1].dim == FIELD_EXTENSION) {",
            `                Goldilocks3::op_${parserType}(2, (${avxTypeExtElement} &)vals3, (${avxTypeExtElement} &)destVals[i][0], (${avxTypeExtElement} &)destVals[i][FIELD_EXTENSION]);`,
            "                dim = FIELD_EXTENSION;",
            "            } else if(dests[i].params[0].dim == FIELD_EXTENSION && dests[i].params[1].dim == 1) {",
            `                Goldilocks3::op_31_${parserType}(2, (${avxTypeExtElement} &)vals3, (${avxTypeExtElement} &)destVals[i][0], destVals[i][FIELD_EXTENSION]);`,
            "                dim = FIELD_EXTENSION;",
            "            } else if(dests[i].params[0].dim == 1 && dests[i].params[1].dim == FIELD_EXTENSION) {",
            `                Goldilocks3::op_31_${parserType}(2, (${avxTypeExtElement} &)vals3, (${avxTypeExtElement} &)destVals[i][FIELD_EXTENSION], destVals[i][0]);`,
            "                dim = FIELD_EXTENSION;",
            "            } else {",
            `                Goldilocks::op_${parserType}(2, vals1, destVals[i][0], destVals[i][FIELD_EXTENSION]);`,
            "                dim = 1;",
            "            }",
            "        } else {",
            `            zklog.error("Currently only length 1 and 2 are supported");`,
            "            exitProcess();",
            "        }",
            "        if(dim == 1) {",
            "            uint64_t offset = dests[i].offset != 0 ? dests[i].offset : 1;",
            `            Goldilocks::${avxStore}(&dests[i].dest[row*offset], uint64_t(offset), vals1);`,
            "        } else {",
            "            uint64_t offset = dests[i].offset != 0 ? dests[i].offset : FIELD_EXTENSION;",
            `            Goldilocks::${avxStore}(&dests[i].dest[row*offset], uint64_t(offset), vals3[0]);`,
            `            Goldilocks::${avxStore}(&dests[i].dest[row*offset + 1], uint64_t(offset),vals3[1]);`,
            `            Goldilocks::${avxStore}(&dests[i].dest[row*offset + 2], uint64_t(offset), vals3[2]);`,
            "        }",
            "    }",
            "}\n",
        ]);
    } else {
        parserCPP.push(...[
            `inline void storePolynomial(std::vector<Dest> dests, Goldilocks::Element** destVals, uint64_t row) {`,
            "    for(uint64_t i = 0; i < dests.size(); ++i) {",
            "        Goldilocks::Element vals[FIELD_EXTENSION*nrowsPack];",
            "        uint64_t dim = 1;",
            "        if(dests[i].params.size() == 1) {",
            "            dim = dests[i].params[0].dim;",
            "            if(dim == 1) {",
            `                Goldilocks::copy_pack(nrowsPack, &vals[0], &destVals[i][0]);`,
            "            } else {",
            `                Goldilocks::copy_pack(nrowsPack, &vals[0], &destVals[i][0]);`,
            `                Goldilocks::copy_pack(nrowsPack, &vals[nrowsPack], &destVals[i][nrowsPack]);`,
            `                Goldilocks::copy_pack(nrowsPack, &vals[2*nrowsPack], &destVals[i][2*nrowsPack]);`,
            "            }",
            "        } else if(dests[i].params.size() == 2) {",
            "            if(dests[i].params[0].dim == FIELD_EXTENSION && dests[i].params[1].dim == FIELD_EXTENSION) {",
            `                Goldilocks3::op_pack(nrowsPack, 2, &vals[0], &destVals[i][0], &destVals[i][FIELD_EXTENSION*nrowsPack]);`,
            "                dim = FIELD_EXTENSION;",
            "            } else if(dests[i].params[0].dim == FIELD_EXTENSION && dests[i].params[1].dim == 1) {",
            `                Goldilocks3::op_31_pack(nrowsPack, 2, &vals[0], &destVals[i][0], &destVals[i][FIELD_EXTENSION*nrowsPack]);`,
            "                dim = FIELD_EXTENSION;",
            "            } else if(dests[i].params[0].dim == 1 && dests[i].params[1].dim == FIELD_EXTENSION) {",
            `                Goldilocks3::op_31_pack(nrowsPack, 2, &vals[0], &destVals[i][FIELD_EXTENSION*nrowsPack], &destVals[i][0]);`,
            "                dim = FIELD_EXTENSION;",
            "            } else {",
            `                Goldilocks::op_pack(nrowsPack, 2, &vals[0], &destVals[i][0], &destVals[i][FIELD_EXTENSION*nrowsPack]);`,
            "                dim = 1;",
            "            }",
            "        } else {",
            `            zklog.error("Currently only length 1 and 2 are supported");`,
            "            exitProcess();",
            "        }", 
            "        if(dim == 1) {",
            "            uint64_t offset = dests[i].offset != 0 ? dests[i].offset : 1;",
            `            Goldilocks::copy_pack(nrowsPack, &dests[i].dest[row*offset], uint64_t(offset), &vals[0]);`,
            "        } else {",
            "            uint64_t offset = dests[i].offset != 0 ? dests[i].offset : FIELD_EXTENSION;",
            `            Goldilocks::copy_pack(nrowsPack, &dests[i].dest[row*offset], uint64_t(offset), &vals[0]);`,
            `            Goldilocks::copy_pack(nrowsPack, &dests[i].dest[row*offset + 1], uint64_t(offset), &vals[nrowsPack]);`,
            `            Goldilocks::copy_pack(nrowsPack, &dests[i].dest[row*offset + 2], uint64_t(offset), &vals[2*nrowsPack]);`,
            "        }",
            "    }",
            "}\n",
        ]);
    }
    

    parserCPP.push(...[
        `inline void printTmp1(uint64_t row, ${isAvx ? avxTypeElement : "Goldilocks::Element*"} tmp) {`,
        "    Goldilocks::Element buff[nrowsPack];",
        `    Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}buff, tmp);`,
        "    for(uint64_t i = 0; i < nrowsPack; ++i) {",
        `        cout << "Value at row " << row + i << " is " << Goldilocks::toString(buff[i]) << endl;`,
        "    }",
        "}\n"
    ]);
    
    parserCPP.push(...[
        `inline void printTmp3(uint64_t row, ${isAvx ? avxTypeExtElement : "Goldilocks::Element*"} tmp) {`,
        "    Goldilocks::Element buff[FIELD_EXTENSION*nrowsPack];",
        `    Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack," : ""}&buff[0], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[0]" : "tmp[0]"});`,
        `    Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack," : ""}&buff[1], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[1]" : "tmp[1]"});`,
        `    Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack," : ""}&buff[2], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[2]" : "tmp[2]"});`,
        "    for(uint64_t i = 0; i < 1; ++i) {",
        `        cout << "Value at row " << row + i << " is [" << Goldilocks::toString(buff[FIELD_EXTENSION*i]) << ", " << Goldilocks::toString(buff[FIELD_EXTENSION*i + 1]) << ", " << Goldilocks::toString(buff[FIELD_EXTENSION*i + 2]) << "]" << endl;`,
        "    }",
        "}\n",
    ]);
    
    parserCPP.push(...[
        `inline void printCommit(uint64_t row, ${isAvx ? avxTypeElement : "Goldilocks::Element"}* bufferT, bool extended) {`,
        "    if(extended) {",
        "        Goldilocks::Element buff[FIELD_EXTENSION*nrowsPack];",
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&buff[0], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&bufferT[0]" : "bufferT[0]"});`,
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&buff[1], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&bufferT[setupCtx.starkInfo.openingPoints.size()]" : "bufferT[setupCtx.starkInfo.openingPoints.size()]"});`,
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&buff[2], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&bufferT[2*setupCtx.starkInfo.openingPoints.size()]" : "bufferT[2*setupCtx.starkInfo.openingPoints.size()]"});`,
        "        for(uint64_t i = 0; i < 1; ++i) {",
        `            cout << "Value at row " << row + i << " is [" << Goldilocks::toString(buff[FIELD_EXTENSION*i]) << ", " << Goldilocks::toString(buff[FIELD_EXTENSION*i + 1]) << ", " << Goldilocks::toString(buff[FIELD_EXTENSION*i + 2]) << "]" << endl;`,
        "        }",
        "    } else {",
        "        Goldilocks::Element buff[nrowsPack];",
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&buff[0], ${!isAvx ? "&bufferT[0]" : "bufferT[0]"});`,
        "        for(uint64_t i = 0; i < nrowsPack; ++i) {",
        `            cout << "Value at row " << row + i << " is " << Goldilocks::toString(buff[i]) << endl;`,
        "        }",
        "    }",
        "}\n",
    ]);
    
    parserCPP.push(...[
        `void calculateExpressions(StepsParams& params, ParserArgs &parserArgs, std::vector<Dest> dests, uint64_t domainSize) override {`,
        "    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();",
        "    bool domainExtended = domainSize == uint64_t(1 << setupCtx.starkInfo.starkStruct.nBitsExt) ? true : false;\n",
    ]);

    
    parserCPP.push("    uint64_t expId = dests[0].params[0].op == opType::tmp ? dests[0].params[0].parserParams.destDim : 0;");
    parserCPP.push("    setBufferTInfo(domainExtended, expId);\n")
      
    if(isAvx) {
        parserCPP.push(...[
            `    ${avxTypeExtElement} challenges[setupCtx.starkInfo.challengesMap.size()];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.challengesMap.size(); ++i) {",
            `        challenges[i][0] = ${avxSet1Epi64}(params.challenges[i * FIELD_EXTENSION].fe);`,
            `        challenges[i][1] = ${avxSet1Epi64}(params.challenges[i * FIELD_EXTENSION + 1].fe);`,
            `        challenges[i][2] = ${avxSet1Epi64}(params.challenges[i * FIELD_EXTENSION + 2].fe);\n`,
            "    }\n",
        ]);

        parserCPP.push(...[
            `    ${avxTypeElement} numbers_[parserArgs.nNumbers];`,
            "    for(uint64_t i = 0; i < parserArgs.nNumbers; ++i) {",
            `        numbers_[i] = ${avxSet1Epi64}(parserArgs.numbers[i]);`,
            "    }\n",
        ])
    
        parserCPP.push(...[
            `    ${avxTypeElement} publics[setupCtx.starkInfo.nPublics];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.nPublics; ++i) {",
            `        publics[i] = ${avxSet1Epi64}(params.publicInputs[i].fe);`,
            "    }\n",
        ]);
    
        parserCPP.push(...[
            `    ${avxTypeExtElement} airgroupValues[setupCtx.starkInfo.airgroupValuesMap.size()];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.airgroupValuesMap.size(); ++i) {",
            `        airgroupValues[i][0] = ${avxSet1Epi64}(params.airgroupValues[i * FIELD_EXTENSION].fe);`,
            `        airgroupValues[i][1] = ${avxSet1Epi64}(params.airgroupValues[i * FIELD_EXTENSION + 1].fe);`,
            `        airgroupValues[i][2] = ${avxSet1Epi64}(params.airgroupValues[i * FIELD_EXTENSION + 2].fe);`,
            "    }\n",
        ]);

        parserCPP.push(...[
            `    ${avxTypeExtElement} airValues[setupCtx.starkInfo.airValuesMap.size()];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.airValuesMap.size(); ++i) {",
            `        airValues[i][0] = ${avxSet1Epi64}(params.airValues[i * FIELD_EXTENSION].fe);`,
            `        airValues[i][1] = ${avxSet1Epi64}(params.airValues[i * FIELD_EXTENSION + 1].fe);`,
            `        airValues[i][2] = ${avxSet1Epi64}(params.airValues[i * FIELD_EXTENSION + 2].fe);`,
            "    }\n",
        ]);
    
        parserCPP.push(...[
            `    ${avxTypeExtElement} evals[setupCtx.starkInfo.evMap.size()];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.evMap.size(); ++i) {",
            `        evals[i][0] = ${avxSet1Epi64}(params.evals[i * FIELD_EXTENSION].fe);`,
            `        evals[i][1] = ${avxSet1Epi64}(params.evals[i * FIELD_EXTENSION + 1].fe);`,
            `        evals[i][2] = ${avxSet1Epi64}(params.evals[i * FIELD_EXTENSION + 2].fe);`,
            "    }\n",
        ]);

    } else {
        parserCPP.push(...[
            `    Goldilocks::Element challenges[setupCtx.starkInfo.challengesMap.size()*FIELD_EXTENSION*nrowsPack];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.challengesMap.size(); ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            challenges[(i*FIELD_EXTENSION)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION];`,
            `            challenges[(i*FIELD_EXTENSION + 1)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION + 1];`,
            `            challenges[(i*FIELD_EXTENSION + 2)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION + 2];`,
            "        }",
            "    }\n",
        ]);
        parserCPP.push(...[
            `    Goldilocks::Element numbers_[parserArgs.nNumbers*nrowsPack];`,
            "    for(uint64_t i = 0; i < parserArgs.nNumbers; ++i) {",
            "        for(uint64_t k = 0; k < nrowsPack; ++k) {",
            `            numbers_[i*nrowsPack + k] = Goldilocks::fromU64(parserArgs.numbers[i]);`,
            "        }",
            "    }\n",
        ])

        parserCPP.push(...[
            "    Goldilocks::Element publics[setupCtx.starkInfo.nPublics*nrowsPack];",
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.nPublics; ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            publics[i*nrowsPack + j] = params.publicInputs[i];`,
            "        }",
            "    }\n",
        ])

        parserCPP.push(...[
            `    Goldilocks::Element evals[setupCtx.starkInfo.evMap.size()*FIELD_EXTENSION*nrowsPack];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.evMap.size(); ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            evals[(i*FIELD_EXTENSION)*nrowsPack + j] = params.evals[i * FIELD_EXTENSION];`,
            `            evals[(i*FIELD_EXTENSION + 1)*nrowsPack + j] = params.evals[i * FIELD_EXTENSION + 1];`,
            `            evals[(i*FIELD_EXTENSION + 2)*nrowsPack + j] = params.evals[i * FIELD_EXTENSION + 2];`,
            "        }",
            "    }\n",
        ]);

        parserCPP.push(...[
            `    Goldilocks::Element airgroupValues[setupCtx.starkInfo.airgroupValuesMap.size()*FIELD_EXTENSION*nrowsPack];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.airgroupValuesMap.size(); ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            airgroupValues[(i*FIELD_EXTENSION)*nrowsPack + j] = params.airgroupValues[i * FIELD_EXTENSION];`,
            `            airgroupValues[(i*FIELD_EXTENSION + 1)*nrowsPack + j] = params.airgroupValues[i * FIELD_EXTENSION + 1];`,
            `            airgroupValues[(i*FIELD_EXTENSION + 2)*nrowsPack + j] = params.airgroupValues[i * FIELD_EXTENSION + 2];`,
            "        }",
            "    }\n",
        ]);

        parserCPP.push(...[
            `    Goldilocks::Element airValues[setupCtx.starkInfo.airValuesMap.size()*FIELD_EXTENSION*nrowsPack];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.airValuesMap.size(); ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            airValues[(i*FIELD_EXTENSION)*nrowsPack + j] = params.airValues[i * FIELD_EXTENSION];`,
            `            airValues[(i*FIELD_EXTENSION + 1)*nrowsPack + j] = params.airValues[i * FIELD_EXTENSION + 1];`,
            `            airValues[(i*FIELD_EXTENSION + 2)*nrowsPack + j] = params.airValues[i * FIELD_EXTENSION + 2];`,
            "        }",
            "    }\n",
        ]);
    }

    parserCPP.push(...[
        `#pragma omp parallel for`,
        `    for (uint64_t i = 0; i < domainSize; i+= nrowsPack) {`,
    ]);

    if(isAvx) {
        parserCPP.push(`        ${avxTypeElement} bufferT_[nOpenings*nCols];\n`);
    } else {
        parserCPP.push(`        Goldilocks::Element bufferT_[nOpenings*nCols*nrowsPack];\n`);    
    }
    

    parserCPP.push("        loadPolynomials(params, parserArgs, dests, bufferT_, i, domainSize);\n");
    
    if(isAvx) {
        parserCPP.push(`        ${avxTypeElement}** destVals = new ${avxTypeElement}*[dests.size()];\n`); 
    } else {
        parserCPP.push(`        Goldilocks::Element **destVals = new Goldilocks::Element*[dests.size()];\n`); 
    }

    parserCPP.push(...[
        "        for(uint64_t j = 0; j < dests.size(); ++j) {",
        `            destVals[j] = new ${isAvx ? avxTypeElement : "Goldilocks::Element"}[dests[j].params.size() * FIELD_EXTENSION${!isAvx ? "* nrowsPack" : ""}];`,
        "            for(uint64_t k = 0; k < dests[j].params.size(); ++k) {",
        "                uint64_t i_args = 0;\n",
        "                if(dests[j].params[k].op == opType::cm) {",
        "                    auto openingPointZero = std::find_if(setupCtx.starkInfo.openingPoints.begin(), setupCtx.starkInfo.openingPoints.end(), [](int p) { return p == 0; });",  
        "                    auto openingPointZeroIndex = std::distance(setupCtx.starkInfo.openingPoints.begin(), openingPointZero);\n",  
        "                    uint64_t buffPos = (setupCtx.starkInfo.nStages + 2)*openingPointZeroIndex + dests[j].params[k].polMap.stage;",
        "                    uint64_t stagePos = dests[j].params[k].polMap.stagePos;",
        `                    copyPolynomial(${!isAvx ? "&destVals[j][k*FIELD_EXTENSION*nrowsPack]" : "&destVals[j][k*FIELD_EXTENSION]"}, dests[j].params[k].inverse, dests[j].params[k].polMap.dim, ${!isAvx ? "&bufferT_[(nColsStagesAcc[buffPos] + stagePos)*nrowsPack]" : "&bufferT_[nColsStagesAcc[buffPos] + stagePos]"});`,
        "                    continue;",
        "                } else if(dests[j].params[k].op == opType::number) {",
        "                    uint64_t val = dests[j].params[k].inverse ? Goldilocks::inv(Goldilocks::fromU64(dests[j].params[k].value)).fe : dests[j].params[k].value;",
    ]);

    if(isAvx) {
        parserCPP.push(`                    destVals[j][k*FIELD_EXTENSION] = ${avxSet1Epi64}(val);`);
    } else {
        parserCPP.push(...[
            "                    for(uint64_t r = 0; r < nrowsPack; ++r) {",
            `                        destVals[j][k*FIELD_EXTENSION*nrowsPack + r] = Goldilocks::fromU64(val);`,
            "                    }",
        ]);
    }
    parserCPP.push(...[
        "                    continue;",
        "                }\n",
    ]);

    parserCPP.push(...[
        "                uint8_t* ops = &parserArgs.ops[dests[j].params[k].parserParams.opsOffset];",
        "                uint16_t* args = &parserArgs.args[dests[j].params[k].parserParams.argsOffset];",
    ]);

    if(isAvx) {
        parserCPP.push(...[
            `                ${avxTypeElement} tmp1[dests[j].params[k].parserParams.nTemp1];`,
            `                ${avxTypeExtElement} tmp3[dests[j].params[k].parserParams.nTemp3];\n`,
        ]);
    } else {
        parserCPP.push(...[
            `                Goldilocks::Element tmp1[dests[j].params[k].parserParams.nTemp1*nrowsPack];`,
            `                Goldilocks::Element tmp3[dests[j].params[k].parserParams.nTemp3*nrowsPack*FIELD_EXTENSION];\n`,
        ]);
    }

    parserCPP.push(...[
        "                for (uint64_t kk = 0; kk < dests[j].params[k].parserParams.nOps; ++kk) {",
        `                    switch (ops[kk]) {`,
    ]);
           
    for(let i = 0; i < operations.length; i++) {
        const op = operations[i];
        
        const operationCase = [`                        case ${i}: {`];
        
        let operationDescription;
        if(op.src1_type) {
            operationDescription = `                                // OPERATION WITH DEST: ${op.dest_type} - SRC0: ${op.src0_type} - SRC1: ${op.src1_type}`;
        } else {
            operationDescription = `                                // COPY ${op.src0_type} to ${op.dest_type}`;
        }
        operationCase.push(operationDescription);
                
        operationCase.push(writeOperation(op));
        operationCase.push(`                                i_args += ${c_args};`);

        operationCase.push(...[
            "                                break;",
            "                            }",
        ])
        parserCPP.push(operationCase.join("\n"));
        
    }

    parserCPP.push(...[
        "                        default: {",
        `                            std::cout << " Wrong operation!" << std::endl;`,
        "                            exit(1);",
        "                        }",
        "                    }",
        "                }\n",
    ]);

    parserCPP.push(...[
        `                if (i_args != dests[j].params[k].parserParams.nArgs) std::cout << " " << i_args << " - " << dests[j].params[k].parserParams.nArgs << std::endl;`,
        "                assert(i_args == dests[j].params[k].parserParams.nArgs);\n",
    ]);

    parserCPP.push(...[
        "                if(dests[j].params[k].parserParams.destDim == 1) {", 
        `                    copyPolynomial(${!isAvx ? "&destVals[j][k*FIELD_EXTENSION*nrowsPack]" : "&destVals[j][k*FIELD_EXTENSION]"}, dests[j].params[k].inverse, dests[j].params[k].parserParams.destDim, ${isAvx ? "&tmp1[dests[j].params[k].parserParams.destId]" : "&tmp1[dests[j].params[k].parserParams.destId*nrowsPack]"});`, 
        "                } else {", 
        `                    copyPolynomial(${!isAvx ? "&destVals[j][k*FIELD_EXTENSION*nrowsPack]" : "&destVals[j][k*FIELD_EXTENSION]"}, dests[j].params[k].inverse, dests[j].params[k].parserParams.destDim, ${isAvx ? "tmp3[dests[j].params[k].parserParams.destId]" : "&tmp3[dests[j].params[k].parserParams.destId*FIELD_EXTENSION*nrowsPack]"});`, 
        "                }", 
    ]);
    parserCPP.push("            }");
    parserCPP.push("        }");

    parserCPP.push(`        storePolynomial(dests, destVals, i);\n`);
    parserCPP.push(...[
        `        for(uint64_t j = 0; j < dests.size(); ++j) {`,
        "            delete destVals[j];",
        "        }",
        "        delete[] destVals;",
    ]);


    parserCPP.push("    }");

    parserCPP.push("}");
    const parserCPPCode = parserCPP.map(l => `    ${l}`).join("\n");

    return parserCPPCode;

    function writeOperation(operation) {

        let name = ["tmp1", "commit1"].includes(operation.dest_type) ? "Goldilocks::" : "Goldilocks3::";
        
        if (operation.src1_type) {
            name += "op";
        } else {
            name += "copy";
        }

        if(["tmp3", "commit3"].includes(operation.dest_type)) {
            if(operation.src1_type)  {
                let dimType = "";
                let dims1 = ["public", "commit1", "tmp1", "const", "number", "airvalue1"];
                let dims3 = ["commit3", "tmp3", "airgroupvalue", "airvalue3", "challenge", "eval", "xDivXSubXi"];
                if(global) dims3.push("proofvalue");
                if(dims1.includes(operation.src0_type)) dimType += "1";
                if (dims3.includes(operation.src0_type)) dimType += "3";
                if(dims1.includes(operation.src1_type)) dimType += "1";
                if (dims3.includes(operation.src1_type)) dimType += "3";

                if(dimType !== "33") name += "_" + dimType;
            }
        } 
        
        if(parserType === "avx") {
            name += "_avx(";
        } else if(parserType === "avx512") {
            name += "_avx512(";
        } else if(parserType === "pack") {
            name += "_pack(nrowsPack, ";
        }

        c_args = 0;

        if(operation.src1_type) {
            if(!operation.op) {
                name += `args[i_args + ${c_args}], `;
            }
            c_args++;
        }

        let typeDest = writeType(operation.dest_type, c_args, parserType, global);
        c_args += numberOfArgs(operation.dest_type, global);

        let typeSrc0 = writeType(operation.src0_type, c_args, parserType, global);
        c_args += numberOfArgs(operation.src0_type, global);

        let typeSrc1;
        if(operation.src1_type) {
            typeSrc1 = writeType(operation.src1_type, c_args, parserType, global);
            c_args += numberOfArgs(operation.src1_type, global);
        }
                
        const operationCall = [];

        name += typeDest + ", ";
        name += typeSrc0 + ", ";
        if(operation.src1_type) {
            name += typeSrc1 + ", ";
        }

        name = name.substring(0, name.lastIndexOf(", ")) + ");";

        operationCall.push(`                                ${name}`);
       
        return operationCall.join("\n").replace(/i_args \+ 0/g, "i_args");
    }
}


module.exports.getOperation = function getOperation(r, verify = false) {
    const _op = {};
    _op.op = r.op;
    if(r.dest.type === "cm") {
        _op.dest_type = `commit${r.dest.dim}`;
    } else if(r.dest.type === "tmp") {
        _op.dest_type = `tmp${r.dest.dim}`;
    } else {
        _op.dest_type = r.dest.type;
    }
    
    let src = [...r.src];

    for(let i = 0; i < src.length; i++) {
        if(verify && src[i].type.includes("tree")) {
            src[i].type = "cm";
        }
    }

    src.sort((a, b) => {
        let opA =  a.type === "cm" ? operationsMap[`commit${a.dim}`] : a.type === "tmp" ? operationsMap[`tmp${a.dim}`] : a.type === "airvalue" ? operationsMap[`airvalue${a.dim}`] : operationsMap[a.type];
        let opB = b.type === "cm" ? operationsMap[`commit${b.dim}`] : b.type === "tmp" ? operationsMap[`tmp${b.dim}`] : b.type === "airvalue" ? operationsMap[`airvalue${b.dim}`] : operationsMap[b.type];
        let swap = a.dim !== b.dim ? b.dim - a.dim : opA - opB;
        if(r.op === "sub" && swap < 0) _op.op = "sub_swap";
        return swap;
    });
    

    for(let i = 0; i < src.length; i++) {
        if(src[i].type === "cm") {
            _op[`src${i}_type`] = `commit${src[i].dim}`;
        } else if(src[i].type === "const" || ((src[i].type === "Zi" || src[i].type === "x") && !verify)) {
            _op[`src${i}_type`] = "commit1";
        } else if(src[i].type === "xDivXSubXi" || ((src[i].type === "Zi" || src[i].type === "x") && verify)) {
            _op[`src${i}_type`] = "commit3";
        } else if(src[i].type === "tmp") {
            _op[`src${i}_type`] =  `tmp${src[i].dim}`;
        } else if(src[i].type === "airvalue") {
            _op[`src${i}_type`] = `airvalue${src[i].dim}`;
        } else {
            _op[`src${i}_type`] = src[i].type;
        }
    }

    _op.src = src;

    
    return _op;
}