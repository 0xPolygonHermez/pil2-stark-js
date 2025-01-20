// Optimization is taken from https://github.com/filecoin-project/neptune

/*
New Matrix:

Circulant matrix whose first row is [17, 20, 34, 18, 39, 13, 13, 28, 2, 16, 41, 15]
Except that 8 is added to the (0, 0) entry
[64, 4 + 2*I, -4, 4 - 2*I]
[128, -8 - 2*I, -32, -8 + 2*I]
[64, 32 - 2*I, 8, 32 + 2*I]


https://eprint.iacr.org/2020/500.pdf

*/

const F3g = require("../../f3g.js");
const poseidon2Constants = require('./poseidon2_constants.js');

let poseidon2;
let isBuilt = false;

function unsringifyConstants(Fr, o) {
    if ((typeof (o) === 'string') && (/^[0-9]+$/.test(o))) {
        return Fr.e(o);
    } if ((typeof (o) === 'string') && (/^0x[0-9a-fA-F]+$/.test(o))) {
        return Fr.e(o);
    } if (Array.isArray(o)) {
        return o.map(unsringifyConstants.bind(null, Fr));
    } if (typeof o === 'object') {
        if (o === null) return null;
        const res = {};
        const keys = Object.keys(o);
        keys.forEach((k) => {
            res[k] = unsringifyConstants(Fr, o[k]);
        });

        return res;
    }

    return o;
}

/**
 * Build poseidon2 hash function with golden prime
 * @returns {Object} poseidon2 function
 */
function buildPoseidon2() {
    const F = new F3g();

    const opt = unsringifyConstants(F, poseidon2Constants);

    const pow7 = (a) => F.mul(a, F.square(F.mul(a, F.square(a, a))));
    
    const matmul_m4 = (a,b,c,d) => {
        let t0 = F.add(a, b);
        let t1 = F.add(c, d);
        let t2 = F.add(F.add(b, b), t1);
        let t3 = F.add(F.add(d, d), t0);
        let t4 = F.add(F.add(F.add(t1, t1), F.add(t1,t1)), t3);
        let t5 = F.add(F.add(F.add(t0, t0), F.add(t0,t0)), t2);
        let t6 = F.add(t3, t5);
        let t7 = F.add(t2, t4);

        return [t6, t5, t7, t4];
    }

    const matmul_external = (state) => {
        let mat1 = matmul_m4(state[0], state[1], state[2], state[3]);
        let mat2 = matmul_m4(state[4], state[5], state[6], state[7]);
        let mat3 = matmul_m4(state[8], state[9], state[10], state[11]);

        let stored = [
            F.add(mat1[0], F.add(mat2[0],mat3[0])),
            F.add(mat1[1], F.add(mat2[1],mat3[1])),
            F.add(mat1[2], F.add(mat2[2],mat3[2])),
            F.add(mat1[3], F.add(mat2[3],mat3[3])),
        ];

        state[0] =  F.add(mat1[0],stored[0]);
        state[1] =  F.add(mat1[1],stored[1]);
        state[2] =  F.add(mat1[2],stored[2]);
        state[3] =  F.add(mat1[3],stored[3]);
        state[4] =  F.add(mat2[0],stored[0]);
        state[5] =  F.add(mat2[1],stored[1]);
        state[6] =  F.add(mat2[2],stored[2]);
        state[7] =  F.add(mat2[3],stored[3]);
        state[8] =  F.add(mat3[0],stored[0]);
        state[9] =  F.add(mat3[1],stored[1]);
        state[10] = F.add(mat3[2],stored[2]);
        state[11] = F.add(mat3[3],stored[3]);

        return state;
    }

    poseidon2 = function (inputs, capacity, nOuts) {
        nOuts = nOuts || 4;
        if (inputs.length !== 8) throw new Error('Invalid Input size (must be 8)');

        let state;

        if (capacity) {
            if (capacity.length !== 4) throw new Error('Invalid Capacity size (must be 4)');
            state = [...inputs.map((a) => F.e(a)), ...capacity.map((a) => F.e(a))];
        } else {
            state = [...inputs.map((a) => F.e(a)), F.zero, F.zero, F.zero, F.zero];
        }

        const t = 12;
        const nRoundsF = 8;
        const nRoundsP = 22;
        const {
            C, D,
        } = opt;

        state = matmul_external(state);

        for (let r = 0; r < nRoundsF / 2; r++) {
            state = state.map((a, i) => F.add(a, C[r * t + i]));
            state = state.map((a) => pow7(a));
            state = matmul_external(state);
        }

        for (let r = 0; r < nRoundsP; r++) {
            state[0] = F.add(state[0], C[(nRoundsF / 2) * t + r]);
            state[0] = pow7(state[0]);
            
            let sum = F.zero;
            for(let i = 0; i < t; ++i) {
                sum = F.add(sum, state[i]);
            }

            for(let i = 0; i < t; ++i) {
                
                state[i] = F.add(F.mul(state[i], D[i]), sum);
            }
        }
        for (let r = 0; r < nRoundsF / 2; r++) {
            state = state.map((a, i) => F.add(a, C[(nRoundsF / 2) * t + nRoundsP + r * t + i]));
            state = state.map((a) => pow7(a));
            state = matmul_external(state);
        }

        return state.slice(0, nOuts);
    };

    poseidon2.F = F;

    return poseidon2;
}

/**
 * singleton to build poseidon2 once
 * @returns {Object} - poseidon2 hash function
 */
function getPoseidon2() {
    if (isBuilt === false) {
        poseidon2 = buildPoseidon2();
        isBuilt = true;
    }

    return poseidon2;
}

module.exports = getPoseidon2;
