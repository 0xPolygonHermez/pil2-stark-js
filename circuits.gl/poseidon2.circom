pragma circom 2.1.0;
pragma custom_templates;

include "poseidon2_constants.circom";

// (5 7 1 3) (a)
// (4 6 1 1) (b)
// (1 3 5 7) (c)   
// (1 1 4 6) (d)
function matmul_m4(a, b, c, d) {
    
    var t0 = a + b;
    var t1 = c + d;
    var t2 = 2*b + t1;
    var t3 = 2*d + t0;
    var t4 = 4*t1 + t3;
    var t5 = 4*t0 + t2;
    var t6 = t3 + t5;
    var t7 = t2 + t4;

    return [t6, t5, t7, t4];
}

function matmul_external(in) {
    
    var mat1[4] = matmul_m4(in[0], in[1], in[2], in[3]);
    var mat2[4] = matmul_m4(in[4], in[5], in[6], in[7]);
    var mat3[4] = matmul_m4(in[8], in[9], in[10], in[11]);

    var stored[4];
    for(var i = 0; i < 4; i++) {
        stored[i] = mat1[i] + mat2[i] + mat3[i]; 
    }

    var out[12];

    for(var i = 0; i < 4; i++) {
        out[i] = mat1[i] + stored[i];
        out[4 + i] = mat2[i] + stored[i];
        out[8 + i] = mat3[i] + stored[i];
    }       
   
    return out;
}

// Custom gate that calculates Poseidon hash of three inputs using Neptune optimization
template custom Poseidon12() {
    signal input in[12];
    signal output im[9][12];
    signal output out[12];

    var st[12];
    st = in;

    st = matmul_external(st);

    for(var r = 0; r < 4; r++) {
        for(var t=0; t < 12; t++) {
            st[t] = st[t] + CONSTANTS(12*r + t);
            st[t] = st[t] ** 7;
        }
        st = matmul_external(st);
        im[r] <-- st;
    }   

    for(var r = 0; r < 22; r++) {
        st[0] += CONSTANTS(4*12 + r);
        st[0] = st[0] ** 7;

        var sum = 0;
        for(var j = 0; j < 12; j++) {
            sum += st[j];
        }

        for(var j = 0; j < 12; j++) {
            st[j] = st[j] * MATRIX_DIAGONAL(j);
            st[j] += sum;
        }

        if(r == 10) im[4] <-- st;
    }

    im[5] <-- st;

    for(var r = 0; r < 4; r++) {
        for(var t=0; t < 12; t++) {
            st[t] = st[t] + CONSTANTS(4*12 + 22 + 12*r + t);
            st[t] = st[t] ** 7;
        }

        st = matmul_external(st);

        if(r < 3) {
            im[r + 6] <-- st;
        } else {
            out <-- st;
        }
    }
}

// Custom gate that calculates Poseidon hash of two inputs using Neptune optimization
// The two inputs are sent unordered and the key that determines its position is also sent as an input
template custom CustPoseidon12() {
    signal input in[8];
    signal input key;
    signal output im[9][12];
    signal output out[12];

    assert(key*(key - 1) == 0);

    var initialSt[12];
    
    // Order the inputs of the Poseidon hash according to the key bit.
    initialSt[0] = key*(in[0] - in[4]) + in[4];
    initialSt[1] = key*(in[1] - in[5]) + in[5];
    initialSt[2] = key*(in[2] - in[6]) + in[6];
    initialSt[3] = key*(in[3] - in[7]) + in[7];
    initialSt[4] = key*(in[4] - in[0]) + in[0];
    initialSt[5] = key*(in[5] - in[1]) + in[1];
    initialSt[6] = key*(in[6] - in[2]) + in[2];
    initialSt[7] = key*(in[7] - in[3]) + in[3];
    initialSt[8] = 0;
    initialSt[9] = 0;
    initialSt[10] = 0;
    initialSt[11] = 0;

    var st[12] = initialSt;

    st = matmul_external(st);
    for(var r = 0; r < 4; r++) {
        for(var t=0; t < 12; t++) {
            st[t] = st[t] + CONSTANTS(12*r + t);
            st[t] = st[t] ** 7;
        }
        st = matmul_external(st);
        im[r] <-- st;
    }

   

    for(var r = 0; r < 22; r++) {
        st[0] += CONSTANTS(4*12 + r);
        st[0] = st[0] ** 7;

        var sum = 0;
        for(var j = 0; j < 12; j++) {
            sum += st[j];
        }

        for(var j = 0; j < 12; j++) {
            st[j] = st[j] * MATRIX_DIAGONAL(j);
            st[j] += sum;
        }

        if(r == 10) im[4] <-- st;
    }

    im[5] <-- st;

    for(var r = 0; r < 4; r++) {
        for(var t=0; t < 12; t++) {
            st[t] = st[t] + CONSTANTS(4*12 + 22 + 12*r + t);
            st[t] = st[t] ** 7;
        }

        st = matmul_external(st);

        if(r < 3) {
            im[r + 6] <-- st;
        } else {
            out <-- st;
        }
    }
}

// Calculate Poseidon2 Hash of 3 inputs (2 in + capacity) in GL field (each element has at most 63 bits)
// -nOuts: Number of GL field elements that are being returned as output
template Poseidon2(nOuts) {
    signal input in[8];
    signal input capacity[4];
    signal output out[nOuts];

    component p = Poseidon12();

    // Pass the two inputs and the capacity as inputs for performing the poseidon Hash
    for (var j=0; j<8; j++) {
        p.in[j] <== in[j];
    }
    for (var j=0; j<4; j++) {
        p.in[8+j] <== capacity[j];
    }

    // Poseidon12 returns 12 outputs but we are only interested in returning nOuts
    for (var j=0; j<nOuts; j++) {
        out[j] <== p.out[j];
    }

    _ <== p.im;

    for (var j=nOuts; j<12; j++) {
        _ <== p.out[j];
    }
}

// Calculate Poseidon Hash of 2 inputs in GL field (each element has at most 63 bits)
// -nOuts: Number of GL field elements that are being returned as output
template CustPoseidon2(nOuts) {
    signal input in[8];
    signal input key;
    signal output out[nOuts];

    component p = CustPoseidon12();

    // Pass the two inputs and the capacity as inputs for performing the poseidon Hash
    for (var j=0; j<8; j++) {
        p.in[j] <== in[j];
    }

    p.key <== key;
    
    // Poseidon12 returns 12 outputs but we are only interested in returning nOuts
    for (var j=0; j<nOuts; j++) {
        out[j] <== p.out[j];
    }

    _ <== p.im;
    
    for (var j=nOuts; j<12; j++) {
        _ <== p.out[j];
    }
}
