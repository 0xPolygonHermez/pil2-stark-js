const { assert } = require("chai");
const {polMulAxi, evalPol} = require("../helpers/polutils");
const { log2 } = require("pilcom/src/utils.js");
const F3g = require("../helpers/f3g.js");
const {BigBuffer} = require("pilcom");

class FRI {

    constructor(starkStruct, MH) {
        this.F = new F3g();
        this.inNBits = starkStruct.nBitsExt;
        this.maxDegNBits = starkStruct.nBits;
        this.nQueries = starkStruct.nQueries;
        this.MH = MH;
        if (starkStruct) {
            this.steps = starkStruct.steps;
        } else {
            throw new Error("stark struct not defined");
        }
    }

    async fold(step, pol, challenge) {
        let polBits = log2(pol.length);
            
        if(step === 0) {
            assert(polBits == this.inNBits, "Invalid polynomial size");
        } else {
            assert(1<<polBits == pol.length, "Invalid polynomial size");    // Check the input polynomial is a power of 2
        }

        let shiftInv = this.F.shiftInv;
        if(step > 0) {
            for (let j=0; j<this.steps[0].nBits - this.steps[step - 1].nBits; j++) {
                shiftInv = this.F.mul(shiftInv, shiftInv);
            }
        }

        const reductionBits = polBits - this.steps[step].nBits;

        const pol2N = 1 << (polBits - reductionBits);
        const nX = pol.length / pol2N;

        const pol2_e = new Array(pol2N);

        let sinv = shiftInv;
        const wi = this.F.inv(this.F.w[polBits]);
        for (let g = 0; g<pol.length/nX; g++) {
            if (step==0) {
                pol2_e[g] = pol[g];
            } else {
                const ppar = new Array(nX);
                for (let i=0; i<nX; i++) {
                    ppar[i] = pol[(i*pol2N)+g];
                }
                const ppar_c = this.F.ifft(ppar);
                polMulAxi(this.F, ppar_c, this.F.one, sinv);    // Multiplies coefs by 1, shiftInv, shiftInv^2, shiftInv^3, ......

                pol2_e[g] = evalPol(this.F, ppar_c, challenge);
                sinv = this.F.mul(sinv, wi);
            }
        }

        let tree, proof;
        if(step !== this.steps.length - 1) {
            const nGroups = 1<< this.steps[step+1].nBits;
            let groupSize = (1 << this.steps[step].nBits) / nGroups;

            const pol2_etb = getTransposedBuffer(pol2_e, this.steps[step+1].nBits);

            tree = await this.MH.merkelize(pol2_etb, 3* groupSize, nGroups);  
            proof = { root: this.MH.root(tree) };          
        } else {
            proof = [];
            for (let i=0; i<pol2_e.length; i++) proof.push(pol2_e[i]);
        }

        pol = pol2_e;

        return {pol, tree, proof};

    }

    proofQueries(proof, trees, friQueries) {
        for (let step = 0; step<this.steps.length; step++) {
            proof[step].polQueries = [];

            if(step === 0) {
                for (let i=0; i<friQueries.length; i++) {
                    const polQuery = [];
                    for(let j = 0; j < trees[step].length; ++j) {
                        polQuery.push(this.MH.getGroupProof(trees[step][j], friQueries[i]));
                    }
                    proof[step].polQueries.push(polQuery);
                }
            } else {
                for (let i=0; i<friQueries.length; i++) {
                    friQueries[i] = friQueries[i] % (1 << this.steps[step].nBits);
                }

                for (let i=0; i<friQueries.length; i++) {
                    proof[step].polQueries.push(this.MH.getGroupProof(trees[step], friQueries[i]));
                }
            }
        }
    }

    verify(friChallenges, friQueries, proof, checkQuery) {
        const self = this;
        const F = this.F;

        assert(proof.length == this.steps.length+1, "Invalid proof size");

        let polBits = this.inNBits;
        let shift = F.shift;
        for (let si=0; si<this.steps.length; si++) {

            const proofItem=proof[si];

            const reductionBits = polBits - this.steps[si].nBits;

            for (let i=0; i<this.nQueries; i++) {
                const pgroup_e = checkQuery(proofItem.polQueries[i], friQueries[i]);
                if (!pgroup_e) return false;

                const pgroup_c = F.ifft(pgroup_e);
                const sinv = F.inv(F.mul( shift, F.exp(  F.w[polBits], friQueries[i])));
                const ev = evalPol(F, pgroup_c, F.mul(friChallenges[si], sinv));
                if (si < this.steps.length - 1) {
                    const nextNGroups = 1 << this.steps[si+1].nBits
                    const groupIdx  =Math.floor(friQueries[i] / nextNGroups);
                    const query = proof[si+1].polQueries[i][0];
                    if (!F.eq([query[groupIdx*3], query[groupIdx*3+1], query[groupIdx*3+2]], ev)) return false;
                } else {
                    if (!F.eq(proof[si+1][friQueries[i]], ev)) return false;
                }
            }

            checkQuery = (query, idx) => {
                const res = self.MH.verifyGroupProof(proof[si+1].root, query[1], idx, query[0]);
                if (!res) return false;
                return split3(query[0]);
            }

            polBits = this.steps[si].nBits;
            for (let j=0; j<reductionBits; j++) shift = F.mul(shift, shift);

            if (si < this.steps.length -1) {
                for (let i=0; i<friQueries.length; i++) {
                    friQueries[i] = friQueries[i] % (1 << this.steps[si+1].nBits);
                }
            }

        }

        const lastPol_e = proof[proof.length-1];

        let maxDeg;
        if (( polBits - (this.inNBits - this.maxDegNBits)) <0) {
            maxDeg = 0;
        } else {
            maxDeg = 1 <<  ( polBits - (this.inNBits - this.maxDegNBits));
        }

        const lastPol_c = F.ifft(lastPol_e);
        // We don't need to divide by shift as we just need to check for zeros

        for (let i=maxDeg+1; i< lastPol_c.length; i++) {
            if (!F.isZero(lastPol_c[i])) return false;
        }

        return true;

    }
}

module.exports = FRI;

function split3(arr) {
    const res = [];
    for (let i=0; i<arr.length; i+=3) {
        res.push([arr[i], arr[i+1], arr[i+2]]);
    }
    return res;
}

function getTransposedBuffer(pol, trasposeBits) {
    const res = new BigBuffer(pol.length*3);
    const n = pol.length;
    const w = 1 << trasposeBits;
    const h = n/w;
    for (let i=0; i<w; i++) {
        for (let j=0; j<h; j++) {
            const fi = j*w + i;
            const di = i*h*3 +j*3;
            res.setElement(di, pol[fi][0]);
            res.setElement(di+1, pol[fi][1]);
            res.setElement(di+2, pol[fi][2]);
        }
    }
    return res;
}
