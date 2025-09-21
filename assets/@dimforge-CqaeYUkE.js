let Pt, Et, At, Ce, kr, Tr, Ie, Br, ht, ue, z, Jr, mt, De, jt, xe, ke, Gr, Wr, Ur, Uh, at, yr, Er, xr, Lr, ce, Me, X, Ir, fr, Mr, _e, q, N, Or, rt, oe, et, Fr, Hr, Nr, de, Vr, ut, bt, ze, Rr, Ar, ne, pe, Vh, Nt, pt, gt, Cr, Pr, se, J, mr, V, vr, v, Le, It, je, He, Pe, br, ae, Ee, we, k, ot, st, F, he, jr, zr, Sr, Xr, Dr, Te, le, Ae, Se, Re, gr, w, Fe, Gt, qh, Jh, Xh;
let __tla = (async ()=>{
    const qr = "/assets/rapier_wasm3d_bg-B0KiaTzL.wasm", Kr = async (s = {}, t)=>{
        let e;
        if (t.startsWith("data:")) {
            const r = t.replace(/^data:.*?base64,/, "");
            let a;
            if (typeof Buffer == "function" && typeof Buffer.from == "function") a = Buffer.from(r, "base64");
            else if (typeof atob == "function") {
                const o = atob(r);
                a = new Uint8Array(o.length);
                for(let _ = 0; _ < o.length; _++)a[_] = o.charCodeAt(_);
            } else throw new Error("Cannot decode base64-encoded data URL");
            e = await WebAssembly.instantiate(a, s);
        } else {
            const r = await fetch(t), a = r.headers.get("Content-Type") || "";
            if ("instantiateStreaming" in WebAssembly && a.startsWith("application/wasm")) e = await WebAssembly.instantiateStreaming(r, s);
            else {
                const o = await r.arrayBuffer();
                e = await WebAssembly.instantiate(o, s);
            }
        }
        return e.instance.exports;
    };
    let i;
    function Yr(s) {
        i = s;
    }
    const x = new Array(128).fill(void 0);
    x.push(void 0, null, !0, !1);
    function R(s) {
        return x[s];
    }
    let lt = x.length;
    function I(s) {
        lt === x.length && x.push(x.length + 1);
        const t = lt;
        return lt = x[t], x[t] = s, t;
    }
    function zt(s, t) {
        try {
            return s.apply(this, t);
        } catch (e) {
            i.__wbindgen_export_0(I(e));
        }
    }
    const Zr = typeof TextDecoder > "u" ? (0, module.require)("util").TextDecoder : TextDecoder;
    let wr = new Zr("utf-8", {
        ignoreBOM: !0,
        fatal: !0
    });
    wr.decode();
    let yt = null;
    function $r() {
        return (yt === null || yt.byteLength === 0) && (yt = new Uint8Array(i.memory.buffer)), yt;
    }
    function ge(s, t) {
        return s = s >>> 0, wr.decode($r().subarray(s, s + t));
    }
    function y(s) {
        return s == null;
    }
    let nt = null;
    function T() {
        return (nt === null || nt.buffer.detached === !0 || nt.buffer.detached === void 0 && nt.buffer !== i.memory.buffer) && (nt = new DataView(i.memory.buffer)), nt;
    }
    function Qr(s) {
        s < 132 || (x[s] = lt, lt = s);
    }
    function wt(s) {
        const t = R(s);
        return Qr(s), t;
    }
    function ti() {
        let s, t;
        try {
            const a = i.__wbindgen_add_to_stack_pointer(-16);
            i.version(a);
            var e = T().getInt32(a + 0, !0), r = T().getInt32(a + 4, !0);
            return s = e, t = r, ge(e, r);
        } finally{
            i.__wbindgen_add_to_stack_pointer(16), i.__wbindgen_export_1(s, t, 1);
        }
    }
    function ei(s) {
        i.reserve_memory(s);
    }
    function c(s, t) {
        if (!(s instanceof t)) throw new Error(`expected instance of ${t.name}`);
    }
    let j = 128;
    function A(s) {
        if (j == 1) throw new Error("out of js stack");
        return x[--j] = s, j;
    }
    let vt = null;
    function ri() {
        return (vt === null || vt.byteLength === 0) && (vt = new Int32Array(i.memory.buffer)), vt;
    }
    function ii(s, t) {
        return s = s >>> 0, ri().subarray(s / 4, s / 4 + t);
    }
    let St = null;
    function dr() {
        return (St === null || St.byteLength === 0) && (St = new Float32Array(i.memory.buffer)), St;
    }
    function Ge(s, t) {
        return s = s >>> 0, dr().subarray(s / 4, s / 4 + t);
    }
    let Rt = null;
    function hr() {
        return (Rt === null || Rt.byteLength === 0) && (Rt = new Uint32Array(i.memory.buffer)), Rt;
    }
    function ni(s, t) {
        return s = s >>> 0, hr().subarray(s / 4, s / 4 + t);
    }
    let W = 0;
    function ct(s, t) {
        const e = t(s.length * 4, 4) >>> 0;
        return hr().set(s, e / 4), W = s.length, e;
    }
    function tt(s, t) {
        const e = t(s.length * 4, 4) >>> 0;
        return dr().set(s, e / 4), W = s.length, e;
    }
    const Ft = Object.freeze({
        LinX: 0,
        0: "LinX",
        LinY: 1,
        1: "LinY",
        LinZ: 2,
        2: "LinZ",
        AngX: 3,
        3: "AngX",
        AngY: 4,
        4: "AngY",
        AngZ: 5,
        5: "AngZ"
    }), U = Object.freeze({
        Revolute: 0,
        0: "Revolute",
        Fixed: 1,
        1: "Fixed",
        Prismatic: 2,
        2: "Prismatic",
        Rope: 3,
        3: "Rope",
        Spring: 4,
        4: "Spring",
        Spherical: 5,
        5: "Spherical",
        Generic: 6,
        6: "Generic"
    }), D = Object.freeze({
        Ball: 0,
        0: "Ball",
        Cuboid: 1,
        1: "Cuboid",
        Capsule: 2,
        2: "Capsule",
        Segment: 3,
        3: "Segment",
        Polyline: 4,
        4: "Polyline",
        Triangle: 5,
        5: "Triangle",
        TriMesh: 6,
        6: "TriMesh",
        HeightField: 7,
        7: "HeightField",
        Compound: 8,
        8: "Compound",
        ConvexPolyhedron: 9,
        9: "ConvexPolyhedron",
        Cylinder: 10,
        10: "Cylinder",
        Cone: 11,
        11: "Cone",
        RoundCuboid: 12,
        12: "RoundCuboid",
        RoundTriangle: 13,
        13: "RoundTriangle",
        RoundCylinder: 14,
        14: "RoundCylinder",
        RoundCone: 15,
        15: "RoundCone",
        RoundConvexPolyhedron: 16,
        16: "RoundConvexPolyhedron",
        HalfSpace: 17,
        17: "HalfSpace",
        Voxels: 18,
        18: "Voxels"
    }), Jt = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawbroadphase_free(s >>> 0, 1));
    class K {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(K.prototype);
            return e.__wbg_ptr = t, Jt.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Jt.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawbroadphase_free(t, 0);
        }
        constructor(){
            const t = i.rawbroadphase_new();
            return this.__wbg_ptr = t >>> 0, Jt.register(this, this.__wbg_ptr, this), this;
        }
        castRay(t, e, r, a, o, _, d, h, p, u, g, b) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l), c(o, l);
                const m = i.rawbroadphase_castRay(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _, d, h, y(p) ? 4294967297 : p >>> 0, !y(u), y(u) ? 0 : u, !y(g), y(g) ? 0 : g, A(b));
                return m === 0 ? void 0 : ve.__wrap(m);
            } finally{
                x[j++] = void 0;
            }
        }
        castRayAndGetNormal(t, e, r, a, o, _, d, h, p, u, g, b) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l), c(o, l);
                const m = i.rawbroadphase_castRayAndGetNormal(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _, d, h, y(p) ? 4294967297 : p >>> 0, !y(u), y(u) ? 0 : u, !y(g), y(g) ? 0 : g, A(b));
                return m === 0 ? void 0 : kt.__wrap(m);
            } finally{
                x[j++] = void 0;
            }
        }
        intersectionsWithRay(t, e, r, a, o, _, d, h, p, u, g, b, m) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l), c(o, l), i.rawbroadphase_intersectionsWithRay(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _, d, A(h), p, y(u) ? 4294967297 : u >>> 0, !y(g), y(g) ? 0 : g, !y(b), y(b) ? 0 : b, A(m));
            } finally{
                x[j++] = void 0, x[j++] = void 0;
            }
        }
        intersectionWithShape(t, e, r, a, o, _, d, h, p, u, g) {
            try {
                const C = i.__wbindgen_add_to_stack_pointer(-16);
                c(t, M), c(e, E), c(r, P), c(a, l), c(o, S), c(_, f), i.rawbroadphase_intersectionWithShape(C, this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _.__wbg_ptr, d, y(h) ? 4294967297 : h >>> 0, !y(p), y(p) ? 0 : p, !y(u), y(u) ? 0 : u, A(g));
                var b = T().getInt32(C + 0, !0), m = T().getFloat64(C + 8, !0);
                return b === 0 ? void 0 : m;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), x[j++] = void 0;
            }
        }
        projectPoint(t, e, r, a, o, _, d, h, p, u) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l);
                const g = i.rawbroadphase_projectPoint(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o, _, y(d) ? 4294967297 : d >>> 0, !y(h), y(h) ? 0 : h, !y(p), y(p) ? 0 : p, A(u));
                return g === 0 ? void 0 : Ct.__wrap(g);
            } finally{
                x[j++] = void 0;
            }
        }
        projectPointAndGetFeature(t, e, r, a, o, _, d, h, p) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l);
                const u = i.rawbroadphase_projectPointAndGetFeature(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o, y(_) ? 4294967297 : _ >>> 0, !y(d), y(d) ? 0 : d, !y(h), y(h) ? 0 : h, A(p));
                return u === 0 ? void 0 : Ct.__wrap(u);
            } finally{
                x[j++] = void 0;
            }
        }
        intersectionsWithPoint(t, e, r, a, o, _, d, h, p, u) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l), i.rawbroadphase_intersectionsWithPoint(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, A(o), _, y(d) ? 4294967297 : d >>> 0, !y(h), y(h) ? 0 : h, !y(p), y(p) ? 0 : p, A(u));
            } finally{
                x[j++] = void 0, x[j++] = void 0;
            }
        }
        castShape(t, e, r, a, o, _, d, h, p, u, g, b, m, C, H) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l), c(o, S), c(_, l), c(d, f);
                const G = i.rawbroadphase_castShape(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _.__wbg_ptr, d.__wbg_ptr, h, p, u, g, y(b) ? 4294967297 : b >>> 0, !y(m), y(m) ? 0 : m, !y(C), y(C) ? 0 : C, A(H));
                return G === 0 ? void 0 : Tt.__wrap(G);
            } finally{
                x[j++] = void 0;
            }
        }
        intersectionsWithShape(t, e, r, a, o, _, d, h, p, u, g, b) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l), c(o, S), c(_, f), i.rawbroadphase_intersectionsWithShape(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _.__wbg_ptr, A(d), h, y(p) ? 4294967297 : p >>> 0, !y(u), y(u) ? 0 : u, !y(g), y(g) ? 0 : g, A(b));
            } finally{
                x[j++] = void 0, x[j++] = void 0;
            }
        }
        collidersWithAabbIntersectingAabb(t, e, r, a, o, _) {
            try {
                c(t, M), c(e, E), c(r, P), c(a, l), c(o, l), i.rawbroadphase_collidersWithAabbIntersectingAabb(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, A(_));
            } finally{
                x[j++] = void 0;
            }
        }
    }
    const We = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawccdsolver_free(s >>> 0, 1));
    class ie {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, We.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawccdsolver_free(t, 0);
        }
        constructor(){
            const t = i.rawccdsolver_new();
            return this.__wbg_ptr = t >>> 0, We.register(this, this.__wbg_ptr, this), this;
        }
    }
    const Be = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawcharactercollision_free(s >>> 0, 1));
    class pr {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Be.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawcharactercollision_free(t, 0);
        }
        constructor(){
            const t = i.rawcharactercollision_new();
            return this.__wbg_ptr = t >>> 0, Be.register(this, this.__wbg_ptr, this), this;
        }
        handle() {
            return i.rawcharactercollision_handle(this.__wbg_ptr);
        }
        translationDeltaApplied() {
            const t = i.rawcharactercollision_translationDeltaApplied(this.__wbg_ptr);
            return l.__wrap(t);
        }
        translationDeltaRemaining() {
            const t = i.rawcharactercollision_translationDeltaRemaining(this.__wbg_ptr);
            return l.__wrap(t);
        }
        toi() {
            return i.rawcharactercollision_toi(this.__wbg_ptr);
        }
        worldWitness1() {
            const t = i.rawcharactercollision_worldWitness1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        worldWitness2() {
            const t = i.rawcharactercollision_worldWitness2(this.__wbg_ptr);
            return l.__wrap(t);
        }
        worldNormal1() {
            const t = i.rawcharactercollision_worldNormal1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        worldNormal2() {
            const t = i.rawcharactercollision_worldNormal2(this.__wbg_ptr);
            return l.__wrap(t);
        }
    }
    const qt = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawcolliderset_free(s >>> 0, 1));
    class P {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(P.prototype);
            return e.__wbg_ptr = t, qt.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, qt.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawcolliderset_free(t, 0);
        }
        coTranslation(t) {
            const e = i.rawcolliderset_coTranslation(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        coRotation(t) {
            const e = i.rawcolliderset_coRotation(this.__wbg_ptr, t);
            return S.__wrap(e);
        }
        coTranslationWrtParent(t) {
            const e = i.rawcolliderset_coTranslationWrtParent(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        coRotationWrtParent(t) {
            const e = i.rawcolliderset_coRotationWrtParent(this.__wbg_ptr, t);
            return e === 0 ? void 0 : S.__wrap(e);
        }
        coSetTranslation(t, e, r, a) {
            i.rawcolliderset_coSetTranslation(this.__wbg_ptr, t, e, r, a);
        }
        coSetTranslationWrtParent(t, e, r, a) {
            i.rawcolliderset_coSetTranslationWrtParent(this.__wbg_ptr, t, e, r, a);
        }
        coSetRotation(t, e, r, a, o) {
            i.rawcolliderset_coSetRotation(this.__wbg_ptr, t, e, r, a, o);
        }
        coSetRotationWrtParent(t, e, r, a, o) {
            i.rawcolliderset_coSetRotationWrtParent(this.__wbg_ptr, t, e, r, a, o);
        }
        coIsSensor(t) {
            return i.rawcolliderset_coIsSensor(this.__wbg_ptr, t) !== 0;
        }
        coShapeType(t) {
            return i.rawcolliderset_coShapeType(this.__wbg_ptr, t);
        }
        coHalfspaceNormal(t) {
            const e = i.rawcolliderset_coHalfspaceNormal(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        coHalfExtents(t) {
            const e = i.rawcolliderset_coHalfExtents(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        coSetHalfExtents(t, e) {
            c(e, l), i.rawcolliderset_coSetHalfExtents(this.__wbg_ptr, t, e.__wbg_ptr);
        }
        coRadius(t) {
            const e = i.rawcolliderset_coRadius(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        coSetRadius(t, e) {
            i.rawcolliderset_coSetRadius(this.__wbg_ptr, t, e);
        }
        coHalfHeight(t) {
            const e = i.rawcolliderset_coHalfHeight(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        coSetHalfHeight(t, e) {
            i.rawcolliderset_coSetHalfHeight(this.__wbg_ptr, t, e);
        }
        coRoundRadius(t) {
            const e = i.rawcolliderset_coRoundRadius(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        coSetRoundRadius(t, e) {
            i.rawcolliderset_coSetRoundRadius(this.__wbg_ptr, t, e);
        }
        coVoxelData(t) {
            try {
                const a = i.__wbindgen_add_to_stack_pointer(-16);
                i.rawcolliderset_coVoxelData(a, this.__wbg_ptr, t);
                var e = T().getInt32(a + 0, !0), r = T().getInt32(a + 4, !0);
                let o;
                return e !== 0 && (o = ii(e, r).slice(), i.__wbindgen_export_1(e, r * 4, 4)), o;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        coVoxelSize(t) {
            const e = i.rawcolliderset_coVoxelSize(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        coSetVoxel(t, e, r, a, o) {
            i.rawcolliderset_coSetVoxel(this.__wbg_ptr, t, e, r, a, o);
        }
        coPropagateVoxelChange(t, e, r, a, o, _, d, h) {
            i.rawcolliderset_coPropagateVoxelChange(this.__wbg_ptr, t, e, r, a, o, _, d, h);
        }
        coCombineVoxelStates(t, e, r, a, o) {
            i.rawcolliderset_coCombineVoxelStates(this.__wbg_ptr, t, e, r, a, o);
        }
        coVertices(t) {
            try {
                const a = i.__wbindgen_add_to_stack_pointer(-16);
                i.rawcolliderset_coVertices(a, this.__wbg_ptr, t);
                var e = T().getInt32(a + 0, !0), r = T().getInt32(a + 4, !0);
                let o;
                return e !== 0 && (o = Ge(e, r).slice(), i.__wbindgen_export_1(e, r * 4, 4)), o;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        coIndices(t) {
            try {
                const a = i.__wbindgen_add_to_stack_pointer(-16);
                i.rawcolliderset_coIndices(a, this.__wbg_ptr, t);
                var e = T().getInt32(a + 0, !0), r = T().getInt32(a + 4, !0);
                let o;
                return e !== 0 && (o = ni(e, r).slice(), i.__wbindgen_export_1(e, r * 4, 4)), o;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        coTriMeshFlags(t) {
            const e = i.rawcolliderset_coTriMeshFlags(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        coHeightFieldFlags(t) {
            const e = i.rawcolliderset_coHeightFieldFlags(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        coHeightfieldHeights(t) {
            try {
                const a = i.__wbindgen_add_to_stack_pointer(-16);
                i.rawcolliderset_coHeightfieldHeights(a, this.__wbg_ptr, t);
                var e = T().getInt32(a + 0, !0), r = T().getInt32(a + 4, !0);
                let o;
                return e !== 0 && (o = Ge(e, r).slice(), i.__wbindgen_export_1(e, r * 4, 4)), o;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        coHeightfieldScale(t) {
            const e = i.rawcolliderset_coHeightfieldScale(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        coHeightfieldNRows(t) {
            const e = i.rawcolliderset_coHeightfieldNRows(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        coHeightfieldNCols(t) {
            const e = i.rawcolliderset_coHeightfieldNCols(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        coParent(t) {
            try {
                const a = i.__wbindgen_add_to_stack_pointer(-16);
                i.rawcolliderset_coParent(a, this.__wbg_ptr, t);
                var e = T().getInt32(a + 0, !0), r = T().getFloat64(a + 8, !0);
                return e === 0 ? void 0 : r;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        coSetEnabled(t, e) {
            i.rawcolliderset_coSetEnabled(this.__wbg_ptr, t, e);
        }
        coIsEnabled(t) {
            return i.rawcolliderset_coIsEnabled(this.__wbg_ptr, t) !== 0;
        }
        coSetContactSkin(t, e) {
            i.rawcolliderset_coSetContactSkin(this.__wbg_ptr, t, e);
        }
        coContactSkin(t) {
            return i.rawcolliderset_coContactSkin(this.__wbg_ptr, t);
        }
        coFriction(t) {
            return i.rawcolliderset_coFriction(this.__wbg_ptr, t);
        }
        coRestitution(t) {
            return i.rawcolliderset_coRestitution(this.__wbg_ptr, t);
        }
        coDensity(t) {
            return i.rawcolliderset_coDensity(this.__wbg_ptr, t);
        }
        coMass(t) {
            return i.rawcolliderset_coMass(this.__wbg_ptr, t);
        }
        coVolume(t) {
            return i.rawcolliderset_coVolume(this.__wbg_ptr, t);
        }
        coCollisionGroups(t) {
            return i.rawcolliderset_coCollisionGroups(this.__wbg_ptr, t) >>> 0;
        }
        coSolverGroups(t) {
            return i.rawcolliderset_coSolverGroups(this.__wbg_ptr, t) >>> 0;
        }
        coActiveHooks(t) {
            return i.rawcolliderset_coActiveHooks(this.__wbg_ptr, t) >>> 0;
        }
        coActiveCollisionTypes(t) {
            return i.rawcolliderset_coActiveCollisionTypes(this.__wbg_ptr, t);
        }
        coActiveEvents(t) {
            return i.rawcolliderset_coActiveEvents(this.__wbg_ptr, t) >>> 0;
        }
        coContactForceEventThreshold(t) {
            return i.rawcolliderset_coContactForceEventThreshold(this.__wbg_ptr, t);
        }
        coContainsPoint(t, e) {
            return c(e, l), i.rawcolliderset_coContainsPoint(this.__wbg_ptr, t, e.__wbg_ptr) !== 0;
        }
        coCastShape(t, e, r, a, o, _, d, h, p) {
            c(e, l), c(r, f), c(a, l), c(o, S), c(_, l);
            const u = i.rawcolliderset_coCastShape(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _.__wbg_ptr, d, h, p);
            return u === 0 ? void 0 : Dt.__wrap(u);
        }
        coCastCollider(t, e, r, a, o, _, d) {
            c(e, l), c(a, l);
            const h = i.rawcolliderset_coCastCollider(this.__wbg_ptr, t, e.__wbg_ptr, r, a.__wbg_ptr, o, _, d);
            return h === 0 ? void 0 : Tt.__wrap(h);
        }
        coIntersectsShape(t, e, r, a) {
            return c(e, f), c(r, l), c(a, S), i.rawcolliderset_coIntersectsShape(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr) !== 0;
        }
        coContactShape(t, e, r, a, o) {
            c(e, f), c(r, l), c(a, S);
            const _ = i.rawcolliderset_coContactShape(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o);
            return _ === 0 ? void 0 : dt.__wrap(_);
        }
        coContactCollider(t, e, r) {
            const a = i.rawcolliderset_coContactCollider(this.__wbg_ptr, t, e, r);
            return a === 0 ? void 0 : dt.__wrap(a);
        }
        coProjectPoint(t, e, r) {
            c(e, l);
            const a = i.rawcolliderset_coProjectPoint(this.__wbg_ptr, t, e.__wbg_ptr, r);
            return Mt.__wrap(a);
        }
        coIntersectsRay(t, e, r, a) {
            return c(e, l), c(r, l), i.rawcolliderset_coIntersectsRay(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a) !== 0;
        }
        coCastRay(t, e, r, a, o) {
            return c(e, l), c(r, l), i.rawcolliderset_coCastRay(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a, o);
        }
        coCastRayAndGetNormal(t, e, r, a, o) {
            c(e, l), c(r, l);
            const _ = i.rawcolliderset_coCastRayAndGetNormal(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a, o);
            return _ === 0 ? void 0 : Ht.__wrap(_);
        }
        coSetSensor(t, e) {
            i.rawcolliderset_coSetSensor(this.__wbg_ptr, t, e);
        }
        coSetRestitution(t, e) {
            i.rawcolliderset_coSetRestitution(this.__wbg_ptr, t, e);
        }
        coSetFriction(t, e) {
            i.rawcolliderset_coSetFriction(this.__wbg_ptr, t, e);
        }
        coFrictionCombineRule(t) {
            return i.rawcolliderset_coFrictionCombineRule(this.__wbg_ptr, t) >>> 0;
        }
        coSetFrictionCombineRule(t, e) {
            i.rawcolliderset_coSetFrictionCombineRule(this.__wbg_ptr, t, e);
        }
        coRestitutionCombineRule(t) {
            return i.rawcolliderset_coRestitutionCombineRule(this.__wbg_ptr, t) >>> 0;
        }
        coSetRestitutionCombineRule(t, e) {
            i.rawcolliderset_coSetRestitutionCombineRule(this.__wbg_ptr, t, e);
        }
        coSetCollisionGroups(t, e) {
            i.rawcolliderset_coSetCollisionGroups(this.__wbg_ptr, t, e);
        }
        coSetSolverGroups(t, e) {
            i.rawcolliderset_coSetSolverGroups(this.__wbg_ptr, t, e);
        }
        coSetActiveHooks(t, e) {
            i.rawcolliderset_coSetActiveHooks(this.__wbg_ptr, t, e);
        }
        coSetActiveEvents(t, e) {
            i.rawcolliderset_coSetActiveEvents(this.__wbg_ptr, t, e);
        }
        coSetActiveCollisionTypes(t, e) {
            i.rawcolliderset_coSetActiveCollisionTypes(this.__wbg_ptr, t, e);
        }
        coSetShape(t, e) {
            c(e, f), i.rawcolliderset_coSetShape(this.__wbg_ptr, t, e.__wbg_ptr);
        }
        coSetContactForceEventThreshold(t, e) {
            i.rawcolliderset_coSetContactForceEventThreshold(this.__wbg_ptr, t, e);
        }
        coSetDensity(t, e) {
            i.rawcolliderset_coSetDensity(this.__wbg_ptr, t, e);
        }
        coSetMass(t, e) {
            i.rawcolliderset_coSetMass(this.__wbg_ptr, t, e);
        }
        coSetMassProperties(t, e, r, a, o) {
            c(r, l), c(a, l), c(o, S), i.rawcolliderset_coSetMassProperties(this.__wbg_ptr, t, e, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr);
        }
        constructor(){
            const t = i.rawcolliderset_new();
            return this.__wbg_ptr = t >>> 0, qt.register(this, this.__wbg_ptr, this), this;
        }
        len() {
            return i.rawcolliderset_len(this.__wbg_ptr) >>> 0;
        }
        contains(t) {
            return i.rawcolliderset_contains(this.__wbg_ptr, t) !== 0;
        }
        createCollider(t, e, r, a, o, _, d, h, p, u, g, b, m, C, H, G, B, O, Q, _t, Wt, Bt, Ot, Vt, ft) {
            try {
                const Xt = i.__wbindgen_add_to_stack_pointer(-16);
                c(e, f), c(r, l), c(a, S), c(d, l), c(h, l), c(p, S), c(ft, E), i.rawcolliderset_createCollider(Xt, this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o, _, d.__wbg_ptr, h.__wbg_ptr, p.__wbg_ptr, u, g, b, m, C, H, G, B, O, Q, _t, Wt, Bt, Ot, Vt, ft.__wbg_ptr);
                var Ut = T().getInt32(Xt + 0, !0), Ne = T().getFloat64(Xt + 8, !0);
                return Ut === 0 ? void 0 : Ne;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        remove(t, e, r, a) {
            c(e, Z), c(r, E), i.rawcolliderset_remove(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a);
        }
        isHandleValid(t) {
            return i.rawcolliderset_contains(this.__wbg_ptr, t) !== 0;
        }
        forEachColliderHandle(t) {
            try {
                i.rawcolliderset_forEachColliderHandle(this.__wbg_ptr, A(t));
            } finally{
                x[j++] = void 0;
            }
        }
    }
    const Oe = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawcollidershapecasthit_free(s >>> 0, 1));
    class Tt {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(Tt.prototype);
            return e.__wbg_ptr = t, Oe.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Oe.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawcollidershapecasthit_free(t, 0);
        }
        colliderHandle() {
            return i.rawcharactercollision_handle(this.__wbg_ptr);
        }
        time_of_impact() {
            return i.rawcollidershapecasthit_time_of_impact(this.__wbg_ptr);
        }
        witness1() {
            const t = i.rawcollidershapecasthit_witness1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        witness2() {
            const t = i.rawcollidershapecasthit_witness2(this.__wbg_ptr);
            return l.__wrap(t);
        }
        normal1() {
            const t = i.rawcharactercollision_translationDeltaApplied(this.__wbg_ptr);
            return l.__wrap(t);
        }
        normal2() {
            const t = i.rawcharactercollision_translationDeltaRemaining(this.__wbg_ptr);
            return l.__wrap(t);
        }
    }
    const Ve = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawcontactforceevent_free(s >>> 0, 1));
    class be {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(be.prototype);
            return e.__wbg_ptr = t, Ve.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Ve.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawcontactforceevent_free(t, 0);
        }
        collider1() {
            return i.rawcharactercollision_handle(this.__wbg_ptr);
        }
        collider2() {
            return i.rawcontactforceevent_collider2(this.__wbg_ptr);
        }
        total_force() {
            const t = i.rawcontactforceevent_total_force(this.__wbg_ptr);
            return l.__wrap(t);
        }
        total_force_magnitude() {
            return i.rawcontactforceevent_total_force_magnitude(this.__wbg_ptr);
        }
        max_force_direction() {
            const t = i.rawcontactforceevent_max_force_direction(this.__wbg_ptr);
            return l.__wrap(t);
        }
        max_force_magnitude() {
            return i.rawcontactforceevent_max_force_magnitude(this.__wbg_ptr);
        }
    }
    const Ue = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawcontactmanifold_free(s >>> 0, 1));
    class me {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(me.prototype);
            return e.__wbg_ptr = t, Ue.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Ue.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawcontactmanifold_free(t, 0);
        }
        normal() {
            const t = i.rawcontactmanifold_normal(this.__wbg_ptr);
            return l.__wrap(t);
        }
        local_n1() {
            const t = i.rawcontactmanifold_local_n1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        local_n2() {
            const t = i.rawcontactmanifold_local_n2(this.__wbg_ptr);
            return l.__wrap(t);
        }
        subshape1() {
            return i.rawcontactmanifold_subshape1(this.__wbg_ptr) >>> 0;
        }
        subshape2() {
            return i.rawcontactmanifold_subshape2(this.__wbg_ptr) >>> 0;
        }
        num_contacts() {
            return i.rawcontactmanifold_num_contacts(this.__wbg_ptr) >>> 0;
        }
        contact_local_p1(t) {
            const e = i.rawcontactmanifold_contact_local_p1(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        contact_local_p2(t) {
            const e = i.rawcontactmanifold_contact_local_p2(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        contact_dist(t) {
            return i.rawcontactmanifold_contact_dist(this.__wbg_ptr, t);
        }
        contact_fid1(t) {
            return i.rawcontactmanifold_contact_fid1(this.__wbg_ptr, t) >>> 0;
        }
        contact_fid2(t) {
            return i.rawcontactmanifold_contact_fid2(this.__wbg_ptr, t) >>> 0;
        }
        contact_impulse(t) {
            return i.rawcontactmanifold_contact_impulse(this.__wbg_ptr, t);
        }
        contact_tangent_impulse_x(t) {
            return i.rawcontactmanifold_contact_tangent_impulse_x(this.__wbg_ptr, t);
        }
        contact_tangent_impulse_y(t) {
            return i.rawcontactmanifold_contact_tangent_impulse_y(this.__wbg_ptr, t);
        }
        num_solver_contacts() {
            return i.rawcontactmanifold_num_solver_contacts(this.__wbg_ptr) >>> 0;
        }
        solver_contact_point(t) {
            const e = i.rawcontactmanifold_solver_contact_point(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        solver_contact_dist(t) {
            return i.rawcontactmanifold_solver_contact_dist(this.__wbg_ptr, t);
        }
        solver_contact_friction(t) {
            return i.rawcontactmanifold_solver_contact_friction(this.__wbg_ptr, t);
        }
        solver_contact_restitution(t) {
            return i.rawcontactmanifold_solver_contact_restitution(this.__wbg_ptr, t);
        }
        solver_contact_tangent_velocity(t) {
            const e = i.rawcontactmanifold_solver_contact_tangent_velocity(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
    }
    const Xe = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawcontactpair_free(s >>> 0, 1));
    class fe {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(fe.prototype);
            return e.__wbg_ptr = t, Xe.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Xe.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawcontactpair_free(t, 0);
        }
        collider1() {
            return i.rawcontactpair_collider1(this.__wbg_ptr);
        }
        collider2() {
            return i.rawcontactpair_collider2(this.__wbg_ptr);
        }
        numContactManifolds() {
            return i.rawcontactpair_numContactManifolds(this.__wbg_ptr) >>> 0;
        }
        contactManifold(t) {
            const e = i.rawcontactpair_contactManifold(this.__wbg_ptr, t);
            return e === 0 ? void 0 : me.__wrap(e);
        }
    }
    const Je = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawdebugrenderpipeline_free(s >>> 0, 1));
    class ai {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Je.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawdebugrenderpipeline_free(t, 0);
        }
        constructor(){
            const t = i.rawdebugrenderpipeline_new();
            return this.__wbg_ptr = t >>> 0, Je.register(this, this.__wbg_ptr, this), this;
        }
        vertices() {
            const t = i.rawdebugrenderpipeline_vertices(this.__wbg_ptr);
            return wt(t);
        }
        colors() {
            const t = i.rawdebugrenderpipeline_colors(this.__wbg_ptr);
            return wt(t);
        }
        render(t, e, r, a, o, _, d) {
            try {
                c(t, E), c(e, P), c(r, Y), c(a, $), c(o, M), i.rawdebugrenderpipeline_render(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _, A(d));
            } finally{
                x[j++] = void 0;
            }
        }
    }
    const qe = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawdeserializedworld_free(s >>> 0, 1));
    class ye {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(ye.prototype);
            return e.__wbg_ptr = t, qe.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, qe.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawdeserializedworld_free(t, 0);
        }
        takeGravity() {
            const t = i.rawdeserializedworld_takeGravity(this.__wbg_ptr);
            return t === 0 ? void 0 : l.__wrap(t);
        }
        takeIntegrationParameters() {
            const t = i.rawdeserializedworld_takeIntegrationParameters(this.__wbg_ptr);
            return t === 0 ? void 0 : it.__wrap(t);
        }
        takeIslandManager() {
            const t = i.rawdeserializedworld_takeIslandManager(this.__wbg_ptr);
            return t === 0 ? void 0 : Z.__wrap(t);
        }
        takeBroadPhase() {
            const t = i.rawdeserializedworld_takeBroadPhase(this.__wbg_ptr);
            return t === 0 ? void 0 : K.__wrap(t);
        }
        takeNarrowPhase() {
            const t = i.rawdeserializedworld_takeNarrowPhase(this.__wbg_ptr);
            return t === 0 ? void 0 : M.__wrap(t);
        }
        takeBodies() {
            const t = i.rawdeserializedworld_takeBodies(this.__wbg_ptr);
            return t === 0 ? void 0 : E.__wrap(t);
        }
        takeColliders() {
            const t = i.rawdeserializedworld_takeColliders(this.__wbg_ptr);
            return t === 0 ? void 0 : P.__wrap(t);
        }
        takeImpulseJoints() {
            const t = i.rawdeserializedworld_takeImpulseJoints(this.__wbg_ptr);
            return t === 0 ? void 0 : Y.__wrap(t);
        }
        takeMultibodyJoints() {
            const t = i.rawdeserializedworld_takeMultibodyJoints(this.__wbg_ptr);
            return t === 0 ? void 0 : $.__wrap(t);
        }
    }
    const Ke = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawdynamicraycastvehiclecontroller_free(s >>> 0, 1));
    class si {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Ke.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawdynamicraycastvehiclecontroller_free(t, 0);
        }
        constructor(t){
            const e = i.rawdynamicraycastvehiclecontroller_new(t);
            return this.__wbg_ptr = e >>> 0, Ke.register(this, this.__wbg_ptr, this), this;
        }
        current_vehicle_speed() {
            return i.rawdynamicraycastvehiclecontroller_current_vehicle_speed(this.__wbg_ptr);
        }
        chassis() {
            return i.rawdynamicraycastvehiclecontroller_chassis(this.__wbg_ptr);
        }
        index_up_axis() {
            return i.rawdynamicraycastvehiclecontroller_index_up_axis(this.__wbg_ptr) >>> 0;
        }
        set_index_up_axis(t) {
            i.rawdynamicraycastvehiclecontroller_set_index_up_axis(this.__wbg_ptr, t);
        }
        index_forward_axis() {
            return i.rawdynamicraycastvehiclecontroller_index_forward_axis(this.__wbg_ptr) >>> 0;
        }
        set_index_forward_axis(t) {
            i.rawdynamicraycastvehiclecontroller_set_index_forward_axis(this.__wbg_ptr, t);
        }
        add_wheel(t, e, r, a, o) {
            c(t, l), c(e, l), c(r, l), i.rawdynamicraycastvehiclecontroller_add_wheel(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a, o);
        }
        num_wheels() {
            return i.rawdynamicraycastvehiclecontroller_num_wheels(this.__wbg_ptr) >>> 0;
        }
        update_vehicle(t, e, r, a, o, _, d, h) {
            try {
                c(e, K), c(r, M), c(a, E), c(o, P), i.rawdynamicraycastvehiclecontroller_update_vehicle(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _, y(d) ? 4294967297 : d >>> 0, A(h));
            } finally{
                x[j++] = void 0;
            }
        }
        wheel_chassis_connection_point_cs(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_chassis_connection_point_cs(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        set_wheel_chassis_connection_point_cs(t, e) {
            c(e, l), i.rawdynamicraycastvehiclecontroller_set_wheel_chassis_connection_point_cs(this.__wbg_ptr, t, e.__wbg_ptr);
        }
        wheel_suspension_rest_length(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_suspension_rest_length(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_suspension_rest_length(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_suspension_rest_length(this.__wbg_ptr, t, e);
        }
        wheel_max_suspension_travel(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_max_suspension_travel(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_max_suspension_travel(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_max_suspension_travel(this.__wbg_ptr, t, e);
        }
        wheel_radius(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_radius(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_radius(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_radius(this.__wbg_ptr, t, e);
        }
        wheel_suspension_stiffness(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_suspension_stiffness(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_suspension_stiffness(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_suspension_stiffness(this.__wbg_ptr, t, e);
        }
        wheel_suspension_compression(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_suspension_compression(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_suspension_compression(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_suspension_compression(this.__wbg_ptr, t, e);
        }
        wheel_suspension_relaxation(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_suspension_relaxation(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_suspension_relaxation(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_suspension_relaxation(this.__wbg_ptr, t, e);
        }
        wheel_max_suspension_force(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_max_suspension_force(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_max_suspension_force(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_max_suspension_force(this.__wbg_ptr, t, e);
        }
        wheel_brake(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_brake(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_brake(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_brake(this.__wbg_ptr, t, e);
        }
        wheel_steering(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_steering(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_steering(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_steering(this.__wbg_ptr, t, e);
        }
        wheel_engine_force(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_engine_force(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_engine_force(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_engine_force(this.__wbg_ptr, t, e);
        }
        wheel_direction_cs(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_direction_cs(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        set_wheel_direction_cs(t, e) {
            c(e, l), i.rawdynamicraycastvehiclecontroller_set_wheel_direction_cs(this.__wbg_ptr, t, e.__wbg_ptr);
        }
        wheel_axle_cs(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_axle_cs(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        set_wheel_axle_cs(t, e) {
            c(e, l), i.rawdynamicraycastvehiclecontroller_set_wheel_axle_cs(this.__wbg_ptr, t, e.__wbg_ptr);
        }
        wheel_friction_slip(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_friction_slip(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_friction_slip(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_friction_slip(this.__wbg_ptr, t, e);
        }
        wheel_side_friction_stiffness(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_side_friction_stiffness(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        set_wheel_side_friction_stiffness(t, e) {
            i.rawdynamicraycastvehiclecontroller_set_wheel_side_friction_stiffness(this.__wbg_ptr, t, e);
        }
        wheel_rotation(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_rotation(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        wheel_forward_impulse(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_forward_impulse(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        wheel_side_impulse(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_side_impulse(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        wheel_suspension_force(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_suspension_force(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        wheel_contact_normal_ws(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_contact_normal_ws(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        wheel_contact_point_ws(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_contact_point_ws(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        wheel_suspension_length(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_suspension_length(this.__wbg_ptr, t);
            return e === 4294967297 ? void 0 : e;
        }
        wheel_hard_point_ws(t) {
            const e = i.rawdynamicraycastvehiclecontroller_wheel_hard_point_ws(this.__wbg_ptr, t);
            return e === 0 ? void 0 : l.__wrap(e);
        }
        wheel_is_in_contact(t) {
            return i.rawdynamicraycastvehiclecontroller_wheel_is_in_contact(this.__wbg_ptr, t) !== 0;
        }
        wheel_ground_object(t) {
            try {
                const a = i.__wbindgen_add_to_stack_pointer(-16);
                i.rawdynamicraycastvehiclecontroller_wheel_ground_object(a, this.__wbg_ptr, t);
                var e = T().getInt32(a + 0, !0), r = T().getFloat64(a + 8, !0);
                return e === 0 ? void 0 : r;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    }
    const Ye = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_raweventqueue_free(s >>> 0, 1));
    class ur {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Ye.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_raweventqueue_free(t, 0);
        }
        constructor(t){
            const e = i.raweventqueue_new(t);
            return this.__wbg_ptr = e >>> 0, Ye.register(this, this.__wbg_ptr, this), this;
        }
        drainCollisionEvents(t) {
            try {
                i.raweventqueue_drainCollisionEvents(this.__wbg_ptr, A(t));
            } finally{
                x[j++] = void 0;
            }
        }
        drainContactForceEvents(t) {
            try {
                i.raweventqueue_drainContactForceEvents(this.__wbg_ptr, A(t));
            } finally{
                x[j++] = void 0;
            }
        }
        clear() {
            i.raweventqueue_clear(this.__wbg_ptr);
        }
    }
    const Ze = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawgenericjoint_free(s >>> 0, 1));
    class L {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(L.prototype);
            return e.__wbg_ptr = t, Ze.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Ze.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawgenericjoint_free(t, 0);
        }
        static generic(t, e, r, a) {
            c(t, l), c(e, l), c(r, l);
            const o = i.rawgenericjoint_generic(t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a);
            return o === 0 ? void 0 : L.__wrap(o);
        }
        static spring(t, e, r, a, o) {
            c(a, l), c(o, l);
            const _ = i.rawgenericjoint_spring(t, e, r, a.__wbg_ptr, o.__wbg_ptr);
            return L.__wrap(_);
        }
        static rope(t, e, r) {
            c(e, l), c(r, l);
            const a = i.rawgenericjoint_rope(t, e.__wbg_ptr, r.__wbg_ptr);
            return L.__wrap(a);
        }
        static spherical(t, e) {
            c(t, l), c(e, l);
            const r = i.rawgenericjoint_spherical(t.__wbg_ptr, e.__wbg_ptr);
            return L.__wrap(r);
        }
        static prismatic(t, e, r, a, o, _) {
            c(t, l), c(e, l), c(r, l);
            const d = i.rawgenericjoint_prismatic(t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a, o, _);
            return d === 0 ? void 0 : L.__wrap(d);
        }
        static fixed(t, e, r, a) {
            c(t, l), c(e, S), c(r, l), c(a, S);
            const o = i.rawgenericjoint_fixed(t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr);
            return L.__wrap(o);
        }
        static revolute(t, e, r) {
            c(t, l), c(e, l), c(r, l);
            const a = i.rawgenericjoint_revolute(t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr);
            return a === 0 ? void 0 : L.__wrap(a);
        }
    }
    const Kt = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawimpulsejointset_free(s >>> 0, 1));
    class Y {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(Y.prototype);
            return e.__wbg_ptr = t, Kt.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Kt.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawimpulsejointset_free(t, 0);
        }
        jointType(t) {
            return i.rawimpulsejointset_jointType(this.__wbg_ptr, t);
        }
        jointBodyHandle1(t) {
            return i.rawimpulsejointset_jointBodyHandle1(this.__wbg_ptr, t);
        }
        jointBodyHandle2(t) {
            return i.rawimpulsejointset_jointBodyHandle2(this.__wbg_ptr, t);
        }
        jointFrameX1(t) {
            const e = i.rawimpulsejointset_jointFrameX1(this.__wbg_ptr, t);
            return S.__wrap(e);
        }
        jointFrameX2(t) {
            const e = i.rawimpulsejointset_jointFrameX2(this.__wbg_ptr, t);
            return S.__wrap(e);
        }
        jointAnchor1(t) {
            const e = i.rawimpulsejointset_jointAnchor1(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        jointAnchor2(t) {
            const e = i.rawimpulsejointset_jointAnchor2(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        jointSetAnchor1(t, e) {
            c(e, l), i.rawimpulsejointset_jointSetAnchor1(this.__wbg_ptr, t, e.__wbg_ptr);
        }
        jointSetAnchor2(t, e) {
            c(e, l), i.rawimpulsejointset_jointSetAnchor2(this.__wbg_ptr, t, e.__wbg_ptr);
        }
        jointContactsEnabled(t) {
            return i.rawimpulsejointset_jointContactsEnabled(this.__wbg_ptr, t) !== 0;
        }
        jointSetContactsEnabled(t, e) {
            i.rawimpulsejointset_jointSetContactsEnabled(this.__wbg_ptr, t, e);
        }
        jointLimitsEnabled(t, e) {
            return i.rawimpulsejointset_jointLimitsEnabled(this.__wbg_ptr, t, e) !== 0;
        }
        jointLimitsMin(t, e) {
            return i.rawimpulsejointset_jointLimitsMin(this.__wbg_ptr, t, e);
        }
        jointLimitsMax(t, e) {
            return i.rawimpulsejointset_jointLimitsMax(this.__wbg_ptr, t, e);
        }
        jointSetLimits(t, e, r, a) {
            i.rawimpulsejointset_jointSetLimits(this.__wbg_ptr, t, e, r, a);
        }
        jointConfigureMotorModel(t, e, r) {
            i.rawimpulsejointset_jointConfigureMotorModel(this.__wbg_ptr, t, e, r);
        }
        jointConfigureMotorVelocity(t, e, r, a) {
            i.rawimpulsejointset_jointConfigureMotorVelocity(this.__wbg_ptr, t, e, r, a);
        }
        jointConfigureMotorPosition(t, e, r, a, o) {
            i.rawimpulsejointset_jointConfigureMotorPosition(this.__wbg_ptr, t, e, r, a, o);
        }
        jointConfigureMotor(t, e, r, a, o, _) {
            i.rawimpulsejointset_jointConfigureMotor(this.__wbg_ptr, t, e, r, a, o, _);
        }
        constructor(){
            const t = i.rawimpulsejointset_new();
            return this.__wbg_ptr = t >>> 0, Kt.register(this, this.__wbg_ptr, this), this;
        }
        createJoint(t, e, r, a) {
            return c(t, L), i.rawimpulsejointset_createJoint(this.__wbg_ptr, t.__wbg_ptr, e, r, a);
        }
        remove(t, e) {
            i.rawimpulsejointset_remove(this.__wbg_ptr, t, e);
        }
        len() {
            return i.rawimpulsejointset_len(this.__wbg_ptr) >>> 0;
        }
        contains(t) {
            return i.rawimpulsejointset_contains(this.__wbg_ptr, t) !== 0;
        }
        forEachJointHandle(t) {
            try {
                i.rawimpulsejointset_forEachJointHandle(this.__wbg_ptr, A(t));
            } finally{
                x[j++] = void 0;
            }
        }
        forEachJointAttachedToRigidBody(t, e) {
            try {
                i.rawimpulsejointset_forEachJointAttachedToRigidBody(this.__wbg_ptr, t, A(e));
            } finally{
                x[j++] = void 0;
            }
        }
    }
    const Yt = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawintegrationparameters_free(s >>> 0, 1));
    class it {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(it.prototype);
            return e.__wbg_ptr = t, Yt.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Yt.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawintegrationparameters_free(t, 0);
        }
        constructor(){
            const t = i.rawintegrationparameters_new();
            return this.__wbg_ptr = t >>> 0, Yt.register(this, this.__wbg_ptr, this), this;
        }
        get dt() {
            return i.rawintegrationparameters_dt(this.__wbg_ptr);
        }
        get contact_erp() {
            return i.rawintegrationparameters_contact_erp(this.__wbg_ptr);
        }
        get normalizedAllowedLinearError() {
            return i.rawintegrationparameters_normalizedAllowedLinearError(this.__wbg_ptr);
        }
        get normalizedPredictionDistance() {
            return i.rawintegrationparameters_normalizedPredictionDistance(this.__wbg_ptr);
        }
        get numSolverIterations() {
            return i.rawintegrationparameters_numSolverIterations(this.__wbg_ptr) >>> 0;
        }
        get numInternalPgsIterations() {
            return i.rawdynamicraycastvehiclecontroller_index_up_axis(this.__wbg_ptr) >>> 0;
        }
        get minIslandSize() {
            return i.rawintegrationparameters_minIslandSize(this.__wbg_ptr) >>> 0;
        }
        get maxCcdSubsteps() {
            return i.rawintegrationparameters_maxCcdSubsteps(this.__wbg_ptr) >>> 0;
        }
        get lengthUnit() {
            return i.rawcontactforceevent_total_force_magnitude(this.__wbg_ptr);
        }
        set dt(t) {
            i.rawintegrationparameters_set_dt(this.__wbg_ptr, t);
        }
        set contact_natural_frequency(t) {
            i.rawintegrationparameters_set_contact_natural_frequency(this.__wbg_ptr, t);
        }
        set normalizedAllowedLinearError(t) {
            i.rawintegrationparameters_set_normalizedAllowedLinearError(this.__wbg_ptr, t);
        }
        set normalizedPredictionDistance(t) {
            i.rawintegrationparameters_set_normalizedPredictionDistance(this.__wbg_ptr, t);
        }
        set numSolverIterations(t) {
            i.rawintegrationparameters_set_numSolverIterations(this.__wbg_ptr, t);
        }
        set numInternalPgsIterations(t) {
            i.rawdynamicraycastvehiclecontroller_set_index_up_axis(this.__wbg_ptr, t);
        }
        set minIslandSize(t) {
            i.rawintegrationparameters_set_minIslandSize(this.__wbg_ptr, t);
        }
        set maxCcdSubsteps(t) {
            i.rawintegrationparameters_set_maxCcdSubsteps(this.__wbg_ptr, t);
        }
        set lengthUnit(t) {
            i.rawintegrationparameters_set_lengthUnit(this.__wbg_ptr, t);
        }
    }
    const Zt = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawislandmanager_free(s >>> 0, 1));
    class Z {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(Z.prototype);
            return e.__wbg_ptr = t, Zt.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Zt.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawislandmanager_free(t, 0);
        }
        constructor(){
            const t = i.rawislandmanager_new();
            return this.__wbg_ptr = t >>> 0, Zt.register(this, this.__wbg_ptr, this), this;
        }
        forEachActiveRigidBodyHandle(t) {
            try {
                i.rawislandmanager_forEachActiveRigidBodyHandle(this.__wbg_ptr, A(t));
            } finally{
                x[j++] = void 0;
            }
        }
    }
    const $e = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawkinematiccharactercontroller_free(s >>> 0, 1));
    class oi {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, $e.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawkinematiccharactercontroller_free(t, 0);
        }
        constructor(t){
            const e = i.rawkinematiccharactercontroller_new(t);
            return this.__wbg_ptr = e >>> 0, $e.register(this, this.__wbg_ptr, this), this;
        }
        up() {
            const t = i.rawcharactercollision_translationDeltaApplied(this.__wbg_ptr);
            return l.__wrap(t);
        }
        setUp(t) {
            c(t, l), i.rawkinematiccharactercontroller_setUp(this.__wbg_ptr, t.__wbg_ptr);
        }
        normalNudgeFactor() {
            return i.rawkinematiccharactercontroller_normalNudgeFactor(this.__wbg_ptr);
        }
        setNormalNudgeFactor(t) {
            i.rawkinematiccharactercontroller_setNormalNudgeFactor(this.__wbg_ptr, t);
        }
        offset() {
            return i.rawkinematiccharactercontroller_offset(this.__wbg_ptr);
        }
        setOffset(t) {
            i.rawkinematiccharactercontroller_setOffset(this.__wbg_ptr, t);
        }
        slideEnabled() {
            return i.rawkinematiccharactercontroller_slideEnabled(this.__wbg_ptr) !== 0;
        }
        setSlideEnabled(t) {
            i.rawkinematiccharactercontroller_setSlideEnabled(this.__wbg_ptr, t);
        }
        autostepMaxHeight() {
            const t = i.rawkinematiccharactercontroller_autostepMaxHeight(this.__wbg_ptr);
            return t === 4294967297 ? void 0 : t;
        }
        autostepMinWidth() {
            const t = i.rawkinematiccharactercontroller_autostepMinWidth(this.__wbg_ptr);
            return t === 4294967297 ? void 0 : t;
        }
        autostepIncludesDynamicBodies() {
            const t = i.rawkinematiccharactercontroller_autostepIncludesDynamicBodies(this.__wbg_ptr);
            return t === 16777215 ? void 0 : t !== 0;
        }
        autostepEnabled() {
            return i.rawkinematiccharactercontroller_autostepEnabled(this.__wbg_ptr) !== 0;
        }
        enableAutostep(t, e, r) {
            i.rawkinematiccharactercontroller_enableAutostep(this.__wbg_ptr, t, e, r);
        }
        disableAutostep() {
            i.rawkinematiccharactercontroller_disableAutostep(this.__wbg_ptr);
        }
        maxSlopeClimbAngle() {
            return i.rawkinematiccharactercontroller_maxSlopeClimbAngle(this.__wbg_ptr);
        }
        setMaxSlopeClimbAngle(t) {
            i.rawkinematiccharactercontroller_setMaxSlopeClimbAngle(this.__wbg_ptr, t);
        }
        minSlopeSlideAngle() {
            return i.rawkinematiccharactercontroller_minSlopeSlideAngle(this.__wbg_ptr);
        }
        setMinSlopeSlideAngle(t) {
            i.rawkinematiccharactercontroller_setMinSlopeSlideAngle(this.__wbg_ptr, t);
        }
        snapToGroundDistance() {
            const t = i.rawkinematiccharactercontroller_snapToGroundDistance(this.__wbg_ptr);
            return t === 4294967297 ? void 0 : t;
        }
        enableSnapToGround(t) {
            i.rawkinematiccharactercontroller_enableSnapToGround(this.__wbg_ptr, t);
        }
        disableSnapToGround() {
            i.rawkinematiccharactercontroller_disableSnapToGround(this.__wbg_ptr);
        }
        snapToGroundEnabled() {
            return i.rawkinematiccharactercontroller_snapToGroundEnabled(this.__wbg_ptr) !== 0;
        }
        computeColliderMovement(t, e, r, a, o, _, d, h, p, u, g, b) {
            try {
                c(e, K), c(r, M), c(a, E), c(o, P), c(d, l), i.rawkinematiccharactercontroller_computeColliderMovement(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _, d.__wbg_ptr, h, y(p) ? 4294967297 : Math.fround(p), u, y(g) ? 4294967297 : g >>> 0, A(b));
            } finally{
                x[j++] = void 0;
            }
        }
        computedMovement() {
            const t = i.rawkinematiccharactercontroller_computedMovement(this.__wbg_ptr);
            return l.__wrap(t);
        }
        computedGrounded() {
            return i.rawkinematiccharactercontroller_computedGrounded(this.__wbg_ptr) !== 0;
        }
        numComputedCollisions() {
            return i.rawkinematiccharactercontroller_numComputedCollisions(this.__wbg_ptr) >>> 0;
        }
        computedCollision(t, e) {
            return c(e, pr), i.rawkinematiccharactercontroller_computedCollision(this.__wbg_ptr, t, e.__wbg_ptr) !== 0;
        }
    }
    const $t = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawmultibodyjointset_free(s >>> 0, 1));
    class $ {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create($.prototype);
            return e.__wbg_ptr = t, $t.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, $t.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawmultibodyjointset_free(t, 0);
        }
        jointType(t) {
            return i.rawmultibodyjointset_jointType(this.__wbg_ptr, t);
        }
        jointFrameX1(t) {
            const e = i.rawmultibodyjointset_jointFrameX1(this.__wbg_ptr, t);
            return S.__wrap(e);
        }
        jointFrameX2(t) {
            const e = i.rawmultibodyjointset_jointFrameX2(this.__wbg_ptr, t);
            return S.__wrap(e);
        }
        jointAnchor1(t) {
            const e = i.rawmultibodyjointset_jointAnchor1(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        jointAnchor2(t) {
            const e = i.rawmultibodyjointset_jointAnchor2(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        jointContactsEnabled(t) {
            return i.rawmultibodyjointset_jointContactsEnabled(this.__wbg_ptr, t) !== 0;
        }
        jointSetContactsEnabled(t, e) {
            i.rawmultibodyjointset_jointSetContactsEnabled(this.__wbg_ptr, t, e);
        }
        jointLimitsEnabled(t, e) {
            return i.rawmultibodyjointset_jointLimitsEnabled(this.__wbg_ptr, t, e) !== 0;
        }
        jointLimitsMin(t, e) {
            return i.rawmultibodyjointset_jointLimitsMin(this.__wbg_ptr, t, e);
        }
        jointLimitsMax(t, e) {
            return i.rawmultibodyjointset_jointLimitsMax(this.__wbg_ptr, t, e);
        }
        constructor(){
            const t = i.rawmultibodyjointset_new();
            return this.__wbg_ptr = t >>> 0, $t.register(this, this.__wbg_ptr, this), this;
        }
        createJoint(t, e, r, a) {
            return c(t, L), i.rawmultibodyjointset_createJoint(this.__wbg_ptr, t.__wbg_ptr, e, r, a);
        }
        remove(t, e) {
            i.rawmultibodyjointset_remove(this.__wbg_ptr, t, e);
        }
        contains(t) {
            return i.rawmultibodyjointset_contains(this.__wbg_ptr, t) !== 0;
        }
        forEachJointHandle(t) {
            try {
                i.rawmultibodyjointset_forEachJointHandle(this.__wbg_ptr, A(t));
            } finally{
                x[j++] = void 0;
            }
        }
        forEachJointAttachedToRigidBody(t, e) {
            try {
                i.rawmultibodyjointset_forEachJointAttachedToRigidBody(this.__wbg_ptr, t, A(e));
            } finally{
                x[j++] = void 0;
            }
        }
    }
    const Qt = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawnarrowphase_free(s >>> 0, 1));
    class M {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(M.prototype);
            return e.__wbg_ptr = t, Qt.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Qt.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawnarrowphase_free(t, 0);
        }
        constructor(){
            const t = i.rawnarrowphase_new();
            return this.__wbg_ptr = t >>> 0, Qt.register(this, this.__wbg_ptr, this), this;
        }
        contact_pairs_with(t, e) {
            i.rawnarrowphase_contact_pairs_with(this.__wbg_ptr, t, I(e));
        }
        contact_pair(t, e) {
            const r = i.rawnarrowphase_contact_pair(this.__wbg_ptr, t, e);
            return r === 0 ? void 0 : fe.__wrap(r);
        }
        intersection_pairs_with(t, e) {
            i.rawnarrowphase_intersection_pairs_with(this.__wbg_ptr, t, I(e));
        }
        intersection_pair(t, e) {
            return i.rawnarrowphase_intersection_pair(this.__wbg_ptr, t, e) !== 0;
        }
    }
    const Qe = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawphysicspipeline_free(s >>> 0, 1));
    class _i {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Qe.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawphysicspipeline_free(t, 0);
        }
        constructor(){
            const t = i.rawphysicspipeline_new();
            return this.__wbg_ptr = t >>> 0, Qe.register(this, this.__wbg_ptr, this), this;
        }
        set_profiler_enabled(t) {
            i.rawphysicspipeline_set_profiler_enabled(this.__wbg_ptr, t);
        }
        is_profiler_enabled() {
            return i.rawphysicspipeline_is_profiler_enabled(this.__wbg_ptr) !== 0;
        }
        timing_step() {
            return i.rawphysicspipeline_timing_step(this.__wbg_ptr);
        }
        timing_collision_detection() {
            return i.rawphysicspipeline_timing_collision_detection(this.__wbg_ptr);
        }
        timing_broad_phase() {
            return i.rawphysicspipeline_timing_broad_phase(this.__wbg_ptr);
        }
        timing_narrow_phase() {
            return i.rawphysicspipeline_timing_narrow_phase(this.__wbg_ptr);
        }
        timing_solver() {
            return i.rawphysicspipeline_timing_solver(this.__wbg_ptr);
        }
        timing_velocity_assembly() {
            return i.rawphysicspipeline_timing_velocity_assembly(this.__wbg_ptr);
        }
        timing_velocity_resolution() {
            return i.rawphysicspipeline_timing_velocity_resolution(this.__wbg_ptr);
        }
        timing_velocity_update() {
            return i.rawphysicspipeline_timing_velocity_update(this.__wbg_ptr);
        }
        timing_velocity_writeback() {
            return i.rawphysicspipeline_timing_velocity_writeback(this.__wbg_ptr);
        }
        timing_ccd() {
            return i.rawphysicspipeline_timing_ccd(this.__wbg_ptr);
        }
        timing_ccd_toi_computation() {
            return i.rawphysicspipeline_timing_ccd_toi_computation(this.__wbg_ptr);
        }
        timing_ccd_broad_phase() {
            return i.rawphysicspipeline_timing_ccd_broad_phase(this.__wbg_ptr);
        }
        timing_ccd_narrow_phase() {
            return i.rawphysicspipeline_timing_ccd_narrow_phase(this.__wbg_ptr);
        }
        timing_ccd_solver() {
            return i.rawphysicspipeline_timing_ccd_solver(this.__wbg_ptr);
        }
        timing_island_construction() {
            return i.rawphysicspipeline_timing_island_construction(this.__wbg_ptr);
        }
        timing_user_changes() {
            return i.rawphysicspipeline_timing_user_changes(this.__wbg_ptr);
        }
        step(t, e, r, a, o, _, d, h, p, u) {
            c(t, l), c(e, it), c(r, Z), c(a, K), c(o, M), c(_, E), c(d, P), c(h, Y), c(p, $), c(u, ie), i.rawphysicspipeline_step(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _.__wbg_ptr, d.__wbg_ptr, h.__wbg_ptr, p.__wbg_ptr, u.__wbg_ptr);
        }
        stepWithEvents(t, e, r, a, o, _, d, h, p, u, g, b, m, C) {
            c(t, l), c(e, it), c(r, Z), c(a, K), c(o, M), c(_, E), c(d, P), c(h, Y), c(p, $), c(u, ie), c(g, ur), i.rawphysicspipeline_stepWithEvents(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _.__wbg_ptr, d.__wbg_ptr, h.__wbg_ptr, p.__wbg_ptr, u.__wbg_ptr, g.__wbg_ptr, I(b), I(m), I(C));
        }
    }
    const tr = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawpidcontroller_free(s >>> 0, 1));
    class ci {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, tr.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawpidcontroller_free(t, 0);
        }
        constructor(t, e, r, a){
            const o = i.rawpidcontroller_new(t, e, r, a);
            return this.__wbg_ptr = o >>> 0, tr.register(this, this.__wbg_ptr, this), this;
        }
        set_kp(t, e) {
            i.rawpidcontroller_set_kp(this.__wbg_ptr, t, e);
        }
        set_ki(t, e) {
            i.rawpidcontroller_set_ki(this.__wbg_ptr, t, e);
        }
        set_kd(t, e) {
            i.rawpidcontroller_set_kd(this.__wbg_ptr, t, e);
        }
        set_axes_mask(t) {
            i.rawpidcontroller_set_axes_mask(this.__wbg_ptr, t);
        }
        reset_integrals() {
            i.rawpidcontroller_reset_integrals(this.__wbg_ptr);
        }
        apply_linear_correction(t, e, r, a, o) {
            c(e, E), c(a, l), c(o, l), i.rawpidcontroller_apply_linear_correction(this.__wbg_ptr, t, e.__wbg_ptr, r, a.__wbg_ptr, o.__wbg_ptr);
        }
        apply_angular_correction(t, e, r, a, o) {
            c(e, E), c(a, S), c(o, l), i.rawpidcontroller_apply_angular_correction(this.__wbg_ptr, t, e.__wbg_ptr, r, a.__wbg_ptr, o.__wbg_ptr);
        }
        linear_correction(t, e, r, a, o) {
            c(e, E), c(a, l), c(o, l);
            const _ = i.rawpidcontroller_linear_correction(this.__wbg_ptr, t, e.__wbg_ptr, r, a.__wbg_ptr, o.__wbg_ptr);
            return l.__wrap(_);
        }
        angular_correction(t, e, r, a, o) {
            c(e, E), c(a, S), c(o, l);
            const _ = i.rawpidcontroller_angular_correction(this.__wbg_ptr, t, e.__wbg_ptr, r, a.__wbg_ptr, o.__wbg_ptr);
            return l.__wrap(_);
        }
    }
    const er = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawpointcolliderprojection_free(s >>> 0, 1));
    class Ct {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(Ct.prototype);
            return e.__wbg_ptr = t, er.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, er.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawpointcolliderprojection_free(t, 0);
        }
        colliderHandle() {
            return i.rawpointcolliderprojection_colliderHandle(this.__wbg_ptr);
        }
        point() {
            const t = i.rawpointcolliderprojection_point(this.__wbg_ptr);
            return l.__wrap(t);
        }
        isInside() {
            return i.rawpointcolliderprojection_isInside(this.__wbg_ptr) !== 0;
        }
        featureType() {
            return i.rawpointcolliderprojection_featureType(this.__wbg_ptr);
        }
        featureId() {
            const t = i.rawpointcolliderprojection_featureId(this.__wbg_ptr);
            return t === 4294967297 ? void 0 : t;
        }
    }
    const rr = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawpointprojection_free(s >>> 0, 1));
    class Mt {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(Mt.prototype);
            return e.__wbg_ptr = t, rr.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, rr.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawpointprojection_free(t, 0);
        }
        point() {
            const t = i.rawpointprojection_point(this.__wbg_ptr);
            return l.__wrap(t);
        }
        isInside() {
            return i.rawpointprojection_isInside(this.__wbg_ptr) !== 0;
        }
    }
    const ir = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawraycolliderhit_free(s >>> 0, 1));
    class ve {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(ve.prototype);
            return e.__wbg_ptr = t, ir.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, ir.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawraycolliderhit_free(t, 0);
        }
        colliderHandle() {
            return i.rawcharactercollision_handle(this.__wbg_ptr);
        }
        timeOfImpact() {
            return i.rawcollidershapecasthit_time_of_impact(this.__wbg_ptr);
        }
    }
    const nr = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawraycolliderintersection_free(s >>> 0, 1));
    class kt {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(kt.prototype);
            return e.__wbg_ptr = t, nr.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, nr.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawraycolliderintersection_free(t, 0);
        }
        colliderHandle() {
            return i.rawpointcolliderprojection_colliderHandle(this.__wbg_ptr);
        }
        normal() {
            const t = i.rawcollidershapecasthit_witness1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        time_of_impact() {
            return i.rawcollidershapecasthit_time_of_impact(this.__wbg_ptr);
        }
        featureType() {
            return i.rawpointcolliderprojection_featureType(this.__wbg_ptr);
        }
        featureId() {
            const t = i.rawpointcolliderprojection_featureId(this.__wbg_ptr);
            return t === 4294967297 ? void 0 : t;
        }
    }
    const ar = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawrayintersection_free(s >>> 0, 1));
    class Ht {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(Ht.prototype);
            return e.__wbg_ptr = t, ar.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, ar.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawrayintersection_free(t, 0);
        }
        normal() {
            const t = i.rawcollidershapecasthit_witness1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        time_of_impact() {
            return i.rawcollidershapecasthit_time_of_impact(this.__wbg_ptr);
        }
        featureType() {
            return i.rawpointcolliderprojection_featureType(this.__wbg_ptr);
        }
        featureId() {
            const t = i.rawpointcolliderprojection_featureId(this.__wbg_ptr);
            return t === 4294967297 ? void 0 : t;
        }
    }
    const te = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawrigidbodyset_free(s >>> 0, 1));
    class E {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(E.prototype);
            return e.__wbg_ptr = t, te.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, te.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawrigidbodyset_free(t, 0);
        }
        rbTranslation(t) {
            const e = i.rawrigidbodyset_rbTranslation(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbRotation(t) {
            const e = i.rawrigidbodyset_rbRotation(this.__wbg_ptr, t);
            return S.__wrap(e);
        }
        rbSleep(t) {
            i.rawrigidbodyset_rbSleep(this.__wbg_ptr, t);
        }
        rbIsSleeping(t) {
            return i.rawrigidbodyset_rbIsSleeping(this.__wbg_ptr, t) !== 0;
        }
        rbIsMoving(t) {
            return i.rawrigidbodyset_rbIsMoving(this.__wbg_ptr, t) !== 0;
        }
        rbNextTranslation(t) {
            const e = i.rawrigidbodyset_rbNextTranslation(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbNextRotation(t) {
            const e = i.rawrigidbodyset_rbNextRotation(this.__wbg_ptr, t);
            return S.__wrap(e);
        }
        rbSetTranslation(t, e, r, a, o) {
            i.rawrigidbodyset_rbSetTranslation(this.__wbg_ptr, t, e, r, a, o);
        }
        rbSetRotation(t, e, r, a, o, _) {
            i.rawrigidbodyset_rbSetRotation(this.__wbg_ptr, t, e, r, a, o, _);
        }
        rbSetLinvel(t, e, r) {
            c(e, l), i.rawrigidbodyset_rbSetLinvel(this.__wbg_ptr, t, e.__wbg_ptr, r);
        }
        rbSetAngvel(t, e, r) {
            c(e, l), i.rawrigidbodyset_rbSetAngvel(this.__wbg_ptr, t, e.__wbg_ptr, r);
        }
        rbSetNextKinematicTranslation(t, e, r, a) {
            i.rawrigidbodyset_rbSetNextKinematicTranslation(this.__wbg_ptr, t, e, r, a);
        }
        rbSetNextKinematicRotation(t, e, r, a, o) {
            i.rawrigidbodyset_rbSetNextKinematicRotation(this.__wbg_ptr, t, e, r, a, o);
        }
        rbRecomputeMassPropertiesFromColliders(t, e) {
            c(e, P), i.rawrigidbodyset_rbRecomputeMassPropertiesFromColliders(this.__wbg_ptr, t, e.__wbg_ptr);
        }
        rbSetAdditionalMass(t, e, r) {
            i.rawrigidbodyset_rbSetAdditionalMass(this.__wbg_ptr, t, e, r);
        }
        rbSetAdditionalMassProperties(t, e, r, a, o, _) {
            c(r, l), c(a, l), c(o, S), i.rawrigidbodyset_rbSetAdditionalMassProperties(this.__wbg_ptr, t, e, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _);
        }
        rbLinvel(t) {
            const e = i.rawrigidbodyset_rbLinvel(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbAngvel(t) {
            const e = i.rawrigidbodyset_rbAngvel(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbVelocityAtPoint(t, e) {
            c(e, l);
            const r = i.rawrigidbodyset_rbVelocityAtPoint(this.__wbg_ptr, t, e.__wbg_ptr);
            return l.__wrap(r);
        }
        rbLockTranslations(t, e, r) {
            i.rawrigidbodyset_rbLockTranslations(this.__wbg_ptr, t, e, r);
        }
        rbSetEnabledTranslations(t, e, r, a, o) {
            i.rawrigidbodyset_rbSetEnabledTranslations(this.__wbg_ptr, t, e, r, a, o);
        }
        rbLockRotations(t, e, r) {
            i.rawrigidbodyset_rbLockRotations(this.__wbg_ptr, t, e, r);
        }
        rbSetEnabledRotations(t, e, r, a, o) {
            i.rawrigidbodyset_rbSetEnabledRotations(this.__wbg_ptr, t, e, r, a, o);
        }
        rbDominanceGroup(t) {
            return i.rawrigidbodyset_rbDominanceGroup(this.__wbg_ptr, t);
        }
        rbSetDominanceGroup(t, e) {
            i.rawrigidbodyset_rbSetDominanceGroup(this.__wbg_ptr, t, e);
        }
        rbEnableCcd(t, e) {
            i.rawrigidbodyset_rbEnableCcd(this.__wbg_ptr, t, e);
        }
        rbSetSoftCcdPrediction(t, e) {
            i.rawrigidbodyset_rbSetSoftCcdPrediction(this.__wbg_ptr, t, e);
        }
        rbMass(t) {
            return i.rawrigidbodyset_rbMass(this.__wbg_ptr, t);
        }
        rbInvMass(t) {
            return i.rawrigidbodyset_rbInvMass(this.__wbg_ptr, t);
        }
        rbEffectiveInvMass(t) {
            const e = i.rawrigidbodyset_rbEffectiveInvMass(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbLocalCom(t) {
            const e = i.rawrigidbodyset_rbLocalCom(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbWorldCom(t) {
            const e = i.rawrigidbodyset_rbWorldCom(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbInvPrincipalInertia(t) {
            const e = i.rawrigidbodyset_rbInvPrincipalInertia(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbPrincipalInertiaLocalFrame(t) {
            const e = i.rawrigidbodyset_rbPrincipalInertiaLocalFrame(this.__wbg_ptr, t);
            return S.__wrap(e);
        }
        rbPrincipalInertia(t) {
            const e = i.rawrigidbodyset_rbPrincipalInertia(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbEffectiveWorldInvInertia(t) {
            const e = i.rawrigidbodyset_rbEffectiveWorldInvInertia(this.__wbg_ptr, t);
            return xt.__wrap(e);
        }
        rbEffectiveAngularInertia(t) {
            const e = i.rawrigidbodyset_rbEffectiveAngularInertia(this.__wbg_ptr, t);
            return xt.__wrap(e);
        }
        rbWakeUp(t) {
            i.rawrigidbodyset_rbWakeUp(this.__wbg_ptr, t);
        }
        rbIsCcdEnabled(t) {
            return i.rawrigidbodyset_rbIsCcdEnabled(this.__wbg_ptr, t) !== 0;
        }
        rbSoftCcdPrediction(t) {
            return i.rawrigidbodyset_rbSoftCcdPrediction(this.__wbg_ptr, t);
        }
        rbNumColliders(t) {
            return i.rawrigidbodyset_rbNumColliders(this.__wbg_ptr, t) >>> 0;
        }
        rbCollider(t, e) {
            return i.rawrigidbodyset_rbCollider(this.__wbg_ptr, t, e);
        }
        rbBodyType(t) {
            return i.rawrigidbodyset_rbBodyType(this.__wbg_ptr, t);
        }
        rbSetBodyType(t, e, r) {
            i.rawrigidbodyset_rbSetBodyType(this.__wbg_ptr, t, e, r);
        }
        rbIsFixed(t) {
            return i.rawrigidbodyset_rbIsFixed(this.__wbg_ptr, t) !== 0;
        }
        rbIsKinematic(t) {
            return i.rawrigidbodyset_rbIsKinematic(this.__wbg_ptr, t) !== 0;
        }
        rbIsDynamic(t) {
            return i.rawrigidbodyset_rbIsDynamic(this.__wbg_ptr, t) !== 0;
        }
        rbLinearDamping(t) {
            return i.rawrigidbodyset_rbLinearDamping(this.__wbg_ptr, t);
        }
        rbAngularDamping(t) {
            return i.rawrigidbodyset_rbAngularDamping(this.__wbg_ptr, t);
        }
        rbSetLinearDamping(t, e) {
            i.rawrigidbodyset_rbSetLinearDamping(this.__wbg_ptr, t, e);
        }
        rbSetAngularDamping(t, e) {
            i.rawrigidbodyset_rbSetAngularDamping(this.__wbg_ptr, t, e);
        }
        rbSetEnabled(t, e) {
            i.rawrigidbodyset_rbSetEnabled(this.__wbg_ptr, t, e);
        }
        rbIsEnabled(t) {
            return i.rawrigidbodyset_rbIsEnabled(this.__wbg_ptr, t) !== 0;
        }
        rbGravityScale(t) {
            return i.rawrigidbodyset_rbGravityScale(this.__wbg_ptr, t);
        }
        rbSetGravityScale(t, e, r) {
            i.rawrigidbodyset_rbSetGravityScale(this.__wbg_ptr, t, e, r);
        }
        rbResetForces(t, e) {
            i.rawrigidbodyset_rbResetForces(this.__wbg_ptr, t, e);
        }
        rbResetTorques(t, e) {
            i.rawrigidbodyset_rbResetTorques(this.__wbg_ptr, t, e);
        }
        rbAddForce(t, e, r) {
            c(e, l), i.rawrigidbodyset_rbAddForce(this.__wbg_ptr, t, e.__wbg_ptr, r);
        }
        rbApplyImpulse(t, e, r) {
            c(e, l), i.rawrigidbodyset_rbApplyImpulse(this.__wbg_ptr, t, e.__wbg_ptr, r);
        }
        rbAddTorque(t, e, r) {
            c(e, l), i.rawrigidbodyset_rbAddTorque(this.__wbg_ptr, t, e.__wbg_ptr, r);
        }
        rbApplyTorqueImpulse(t, e, r) {
            c(e, l), i.rawrigidbodyset_rbApplyTorqueImpulse(this.__wbg_ptr, t, e.__wbg_ptr, r);
        }
        rbAddForceAtPoint(t, e, r, a) {
            c(e, l), c(r, l), i.rawrigidbodyset_rbAddForceAtPoint(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a);
        }
        rbApplyImpulseAtPoint(t, e, r, a) {
            c(e, l), c(r, l), i.rawrigidbodyset_rbApplyImpulseAtPoint(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a);
        }
        rbAdditionalSolverIterations(t) {
            return i.rawrigidbodyset_rbAdditionalSolverIterations(this.__wbg_ptr, t) >>> 0;
        }
        rbSetAdditionalSolverIterations(t, e) {
            i.rawrigidbodyset_rbSetAdditionalSolverIterations(this.__wbg_ptr, t, e);
        }
        rbUserData(t) {
            return i.rawrigidbodyset_rbUserData(this.__wbg_ptr, t) >>> 0;
        }
        rbSetUserData(t, e) {
            i.rawrigidbodyset_rbSetUserData(this.__wbg_ptr, t, e);
        }
        rbUserForce(t) {
            const e = i.rawrigidbodyset_rbUserForce(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        rbUserTorque(t) {
            const e = i.rawrigidbodyset_rbUserTorque(this.__wbg_ptr, t);
            return l.__wrap(e);
        }
        constructor(){
            const t = i.rawrigidbodyset_new();
            return this.__wbg_ptr = t >>> 0, te.register(this, this.__wbg_ptr, this), this;
        }
        createRigidBody(t, e, r, a, o, _, d, h, p, u, g, b, m, C, H, G, B, O, Q, _t, Wt, Bt, Ot, Vt, ft, Ut) {
            return c(e, l), c(r, S), c(d, l), c(h, l), c(p, l), c(u, l), c(g, S), i.rawrigidbodyset_createRigidBody(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a, o, _, d.__wbg_ptr, h.__wbg_ptr, p.__wbg_ptr, u.__wbg_ptr, g.__wbg_ptr, b, m, C, H, G, B, O, Q, _t, Wt, Bt, Ot, Vt, ft, Ut);
        }
        remove(t, e, r, a, o) {
            c(e, Z), c(r, P), c(a, Y), c(o, $), i.rawrigidbodyset_remove(this.__wbg_ptr, t, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr);
        }
        len() {
            return i.rawrigidbodyset_len(this.__wbg_ptr) >>> 0;
        }
        contains(t) {
            return i.rawrigidbodyset_contains(this.__wbg_ptr, t) !== 0;
        }
        forEachRigidBodyHandle(t) {
            try {
                i.rawrigidbodyset_forEachRigidBodyHandle(this.__wbg_ptr, A(t));
            } finally{
                x[j++] = void 0;
            }
        }
        propagateModifiedBodyPositionsToColliders(t) {
            c(t, P), i.rawrigidbodyset_propagateModifiedBodyPositionsToColliders(this.__wbg_ptr, t.__wbg_ptr);
        }
    }
    const ee = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawrotation_free(s >>> 0, 1));
    class S {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(S.prototype);
            return e.__wbg_ptr = t, ee.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, ee.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawrotation_free(t, 0);
        }
        constructor(t, e, r, a){
            const o = i.rawrotation_new(t, e, r, a);
            return this.__wbg_ptr = o >>> 0, ee.register(this, this.__wbg_ptr, this), this;
        }
        static identity() {
            const t = i.rawrotation_identity();
            return S.__wrap(t);
        }
        get x() {
            return i.rawintegrationparameters_dt(this.__wbg_ptr);
        }
        get y() {
            return i.rawkinematiccharactercontroller_offset(this.__wbg_ptr);
        }
        get z() {
            return i.rawcollidershapecasthit_time_of_impact(this.__wbg_ptr);
        }
        get w() {
            return i.rawrotation_w(this.__wbg_ptr);
        }
    }
    const sr = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawsdpmatrix3_free(s >>> 0, 1));
    class xt {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(xt.prototype);
            return e.__wbg_ptr = t, sr.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, sr.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawsdpmatrix3_free(t, 0);
        }
        elements() {
            const t = i.rawsdpmatrix3_elements(this.__wbg_ptr);
            return wt(t);
        }
    }
    const or = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawserializationpipeline_free(s >>> 0, 1));
    class li {
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, or.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawserializationpipeline_free(t, 0);
        }
        constructor(){
            const t = i.rawccdsolver_new();
            return this.__wbg_ptr = t >>> 0, or.register(this, this.__wbg_ptr, this), this;
        }
        serializeAll(t, e, r, a, o, _, d, h, p) {
            c(t, l), c(e, it), c(r, Z), c(a, K), c(o, M), c(_, E), c(d, P), c(h, Y), c(p, $);
            const u = i.rawserializationpipeline_serializeAll(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _.__wbg_ptr, d.__wbg_ptr, h.__wbg_ptr, p.__wbg_ptr);
            return wt(u);
        }
        deserializeAll(t) {
            const e = i.rawserializationpipeline_deserializeAll(this.__wbg_ptr, I(t));
            return e === 0 ? void 0 : ye.__wrap(e);
        }
    }
    const _r = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawshape_free(s >>> 0, 1));
    class f {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(f.prototype);
            return e.__wbg_ptr = t, _r.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, _r.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawshape_free(t, 0);
        }
        static cuboid(t, e, r) {
            const a = i.rawshape_cuboid(t, e, r);
            return f.__wrap(a);
        }
        static roundCuboid(t, e, r, a) {
            const o = i.rawshape_roundCuboid(t, e, r, a);
            return f.__wrap(o);
        }
        static ball(t) {
            const e = i.rawshape_ball(t);
            return f.__wrap(e);
        }
        static halfspace(t) {
            c(t, l);
            const e = i.rawshape_halfspace(t.__wbg_ptr);
            return f.__wrap(e);
        }
        static capsule(t, e) {
            const r = i.rawshape_capsule(t, e);
            return f.__wrap(r);
        }
        static cylinder(t, e) {
            const r = i.rawshape_cylinder(t, e);
            return f.__wrap(r);
        }
        static roundCylinder(t, e, r) {
            const a = i.rawshape_roundCylinder(t, e, r);
            return f.__wrap(a);
        }
        static cone(t, e) {
            const r = i.rawshape_cone(t, e);
            return f.__wrap(r);
        }
        static roundCone(t, e, r) {
            const a = i.rawshape_roundCone(t, e, r);
            return f.__wrap(a);
        }
        static voxels(t, e) {
            c(t, l);
            const r = ct(e, i.__wbindgen_export_2), a = W, o = i.rawshape_voxels(t.__wbg_ptr, r, a);
            return f.__wrap(o);
        }
        static voxelsFromPoints(t, e) {
            c(t, l);
            const r = tt(e, i.__wbindgen_export_2), a = W, o = i.rawshape_voxelsFromPoints(t.__wbg_ptr, r, a);
            return f.__wrap(o);
        }
        static polyline(t, e) {
            const r = tt(t, i.__wbindgen_export_2), a = W, o = ct(e, i.__wbindgen_export_2), _ = W, d = i.rawshape_polyline(r, a, o, _);
            return f.__wrap(d);
        }
        static trimesh(t, e, r) {
            const a = tt(t, i.__wbindgen_export_2), o = W, _ = ct(e, i.__wbindgen_export_2), d = W, h = i.rawshape_trimesh(a, o, _, d, r);
            return h === 0 ? void 0 : f.__wrap(h);
        }
        static heightfield(t, e, r, a, o) {
            const _ = tt(r, i.__wbindgen_export_2), d = W;
            c(a, l);
            const h = i.rawshape_heightfield(t, e, _, d, a.__wbg_ptr, o);
            return f.__wrap(h);
        }
        static segment(t, e) {
            c(t, l), c(e, l);
            const r = i.rawshape_segment(t.__wbg_ptr, e.__wbg_ptr);
            return f.__wrap(r);
        }
        static triangle(t, e, r) {
            c(t, l), c(e, l), c(r, l);
            const a = i.rawshape_triangle(t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr);
            return f.__wrap(a);
        }
        static roundTriangle(t, e, r, a) {
            c(t, l), c(e, l), c(r, l);
            const o = i.rawshape_roundTriangle(t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a);
            return f.__wrap(o);
        }
        static convexHull(t) {
            const e = tt(t, i.__wbindgen_export_2), r = W, a = i.rawshape_convexHull(e, r);
            return a === 0 ? void 0 : f.__wrap(a);
        }
        static roundConvexHull(t, e) {
            const r = tt(t, i.__wbindgen_export_2), a = W, o = i.rawshape_roundConvexHull(r, a, e);
            return o === 0 ? void 0 : f.__wrap(o);
        }
        static convexMesh(t, e) {
            const r = tt(t, i.__wbindgen_export_2), a = W, o = ct(e, i.__wbindgen_export_2), _ = W, d = i.rawshape_convexMesh(r, a, o, _);
            return d === 0 ? void 0 : f.__wrap(d);
        }
        static roundConvexMesh(t, e, r) {
            const a = tt(t, i.__wbindgen_export_2), o = W, _ = ct(e, i.__wbindgen_export_2), d = W, h = i.rawshape_roundConvexMesh(a, o, _, d, r);
            return h === 0 ? void 0 : f.__wrap(h);
        }
        castShape(t, e, r, a, o, _, d, h, p, u) {
            c(t, l), c(e, S), c(r, l), c(a, f), c(o, l), c(_, S), c(d, l);
            const g = i.rawshape_castShape(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _.__wbg_ptr, d.__wbg_ptr, h, p, u);
            return g === 0 ? void 0 : Dt.__wrap(g);
        }
        intersectsShape(t, e, r, a, o) {
            return c(t, l), c(e, S), c(r, f), c(a, l), c(o, S), i.rawshape_intersectsShape(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr) !== 0;
        }
        contactShape(t, e, r, a, o, _) {
            c(t, l), c(e, S), c(r, f), c(a, l), c(o, S);
            const d = i.rawshape_contactShape(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o.__wbg_ptr, _);
            return d === 0 ? void 0 : dt.__wrap(d);
        }
        containsPoint(t, e, r) {
            return c(t, l), c(e, S), c(r, l), i.rawshape_containsPoint(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr) !== 0;
        }
        projectPoint(t, e, r, a) {
            c(t, l), c(e, S), c(r, l);
            const o = i.rawshape_projectPoint(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a);
            return Mt.__wrap(o);
        }
        intersectsRay(t, e, r, a, o) {
            return c(t, l), c(e, S), c(r, l), c(a, l), i.rawshape_intersectsRay(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o) !== 0;
        }
        castRay(t, e, r, a, o, _) {
            return c(t, l), c(e, S), c(r, l), c(a, l), i.rawshape_castRay(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o, _);
        }
        castRayAndGetNormal(t, e, r, a, o, _) {
            c(t, l), c(e, S), c(r, l), c(a, l);
            const d = i.rawshape_castRayAndGetNormal(this.__wbg_ptr, t.__wbg_ptr, e.__wbg_ptr, r.__wbg_ptr, a.__wbg_ptr, o, _);
            return d === 0 ? void 0 : Ht.__wrap(d);
        }
    }
    const cr = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawshapecasthit_free(s >>> 0, 1));
    class Dt {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(Dt.prototype);
            return e.__wbg_ptr = t, cr.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, cr.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawshapecasthit_free(t, 0);
        }
        time_of_impact() {
            return i.rawintegrationparameters_dt(this.__wbg_ptr);
        }
        witness1() {
            const t = i.rawshapecasthit_witness1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        witness2() {
            const t = i.rawcontactforceevent_total_force(this.__wbg_ptr);
            return l.__wrap(t);
        }
        normal1() {
            const t = i.rawshapecasthit_normal1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        normal2() {
            const t = i.rawshapecasthit_normal2(this.__wbg_ptr);
            return l.__wrap(t);
        }
    }
    const lr = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawshapecontact_free(s >>> 0, 1));
    class dt {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(dt.prototype);
            return e.__wbg_ptr = t, lr.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, lr.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawshapecontact_free(t, 0);
        }
        distance() {
            return i.rawkinematiccharactercontroller_maxSlopeClimbAngle(this.__wbg_ptr);
        }
        point1() {
            const t = i.rawpointprojection_point(this.__wbg_ptr);
            return l.__wrap(t);
        }
        point2() {
            const t = i.rawcollidershapecasthit_witness1(this.__wbg_ptr);
            return l.__wrap(t);
        }
        normal1() {
            const t = i.rawcollidershapecasthit_witness2(this.__wbg_ptr);
            return l.__wrap(t);
        }
        normal2() {
            const t = i.rawcharactercollision_translationDeltaApplied(this.__wbg_ptr);
            return l.__wrap(t);
        }
    }
    const re = typeof FinalizationRegistry > "u" ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((s)=>i.__wbg_rawvector_free(s >>> 0, 1));
    class l {
        static __wrap(t) {
            t = t >>> 0;
            const e = Object.create(l.prototype);
            return e.__wbg_ptr = t, re.register(e, e.__wbg_ptr, e), e;
        }
        __destroy_into_raw() {
            const t = this.__wbg_ptr;
            return this.__wbg_ptr = 0, re.unregister(this), t;
        }
        free() {
            const t = this.__destroy_into_raw();
            i.__wbg_rawvector_free(t, 0);
        }
        static zero() {
            const t = i.rawvector_zero();
            return l.__wrap(t);
        }
        constructor(t, e, r){
            const a = i.rawvector_new(t, e, r);
            return this.__wbg_ptr = a >>> 0, re.register(this, this.__wbg_ptr, this), this;
        }
        get x() {
            return i.rawintegrationparameters_dt(this.__wbg_ptr);
        }
        set x(t) {
            i.rawintegrationparameters_set_dt(this.__wbg_ptr, t);
        }
        get y() {
            return i.rawkinematiccharactercontroller_offset(this.__wbg_ptr);
        }
        set y(t) {
            i.rawvector_set_y(this.__wbg_ptr, t);
        }
        get z() {
            return i.rawcollidershapecasthit_time_of_impact(this.__wbg_ptr);
        }
        set z(t) {
            i.rawvector_set_z(this.__wbg_ptr, t);
        }
        xyz() {
            const t = i.rawvector_xyz(this.__wbg_ptr);
            return l.__wrap(t);
        }
        yxz() {
            const t = i.rawvector_yxz(this.__wbg_ptr);
            return l.__wrap(t);
        }
        zxy() {
            const t = i.rawvector_zxy(this.__wbg_ptr);
            return l.__wrap(t);
        }
        xzy() {
            const t = i.rawvector_xzy(this.__wbg_ptr);
            return l.__wrap(t);
        }
        yzx() {
            const t = i.rawvector_yzx(this.__wbg_ptr);
            return l.__wrap(t);
        }
        zyx() {
            const t = i.rawvector_zyx(this.__wbg_ptr);
            return l.__wrap(t);
        }
    }
    function wi(s, t, e, r) {
        const a = R(s).bind(R(t), R(e), R(r));
        return I(a);
    }
    function di(s) {
        const t = R(s).buffer;
        return I(t);
    }
    function hi() {
        return zt(function(s, t) {
            const e = R(s).call(R(t));
            return I(e);
        }, arguments);
    }
    function pi() {
        return zt(function(s, t, e) {
            const r = R(s).call(R(t), R(e));
            return I(r);
        }, arguments);
    }
    function ui() {
        return zt(function(s, t, e, r) {
            const a = R(s).call(R(t), R(e), R(r));
            return I(a);
        }, arguments);
    }
    function gi() {
        return zt(function(s, t, e, r, a) {
            const o = R(s).call(R(t), R(e), R(r), R(a));
            return I(o);
        }, arguments);
    }
    function bi(s) {
        return R(s).length;
    }
    function mi(s) {
        return R(s).length;
    }
    function fi(s) {
        const t = new Uint8Array(R(s));
        return I(t);
    }
    function yi(s, t) {
        const e = new Function(ge(s, t));
        return I(e);
    }
    function vi(s, t, e) {
        const r = new Uint8Array(R(s), t >>> 0, e >>> 0);
        return I(r);
    }
    function Si(s, t, e) {
        const r = new Float32Array(R(s), t >>> 0, e >>> 0);
        return I(r);
    }
    function Ri(s) {
        const t = new Float32Array(s >>> 0);
        return I(t);
    }
    function Ci(s) {
        return R(s).now();
    }
    function xi(s) {
        const t = R(s).performance;
        return I(t);
    }
    function ji(s) {
        const t = be.__wrap(s);
        return I(t);
    }
    function Ii(s) {
        const t = kt.__wrap(s);
        return I(t);
    }
    function Ei(s, t, e) {
        R(s).set(R(t), e >>> 0);
    }
    function Ai(s, t, e) {
        R(s).set(R(t), e >>> 0);
    }
    function Pi() {
        const s = typeof global > "u" ? null : global;
        return y(s) ? 0 : I(s);
    }
    function zi() {
        const s = typeof globalThis > "u" ? null : globalThis;
        return y(s) ? 0 : I(s);
    }
    function Fi() {
        const s = typeof self > "u" ? null : self;
        return y(s) ? 0 : I(s);
    }
    function Ti() {
        const s = typeof window > "u" ? null : window;
        return y(s) ? 0 : I(s);
    }
    function Mi(s) {
        const t = R(s);
        return typeof t == "boolean" ? t ? 1 : 0 : 2;
    }
    function ki(s) {
        return typeof R(s) == "function";
    }
    function Hi(s) {
        return R(s) === void 0;
    }
    function Di() {
        const s = i.memory;
        return I(s);
    }
    function Li(s, t) {
        const e = R(t), r = typeof e == "number" ? e : void 0;
        T().setFloat64(s + 8, y(r) ? 0 : r, !0), T().setInt32(s + 0, !y(r), !0);
    }
    function Ni(s) {
        return I(s);
    }
    function Gi(s) {
        const t = R(s);
        return I(t);
    }
    function Wi(s) {
        wt(s);
    }
    function Bi(s, t) {
        throw new Error(ge(s, t));
    }
    URL = globalThis.URL;
    const n = await Kr({
        "./rapier_wasm3d_bg.js": {
            __wbindgen_number_new: Ni,
            __wbindgen_boolean_get: Mi,
            __wbindgen_object_drop_ref: Wi,
            __wbindgen_number_get: Li,
            __wbindgen_is_function: ki,
            __wbg_rawraycolliderintersection_new: Ii,
            __wbg_rawcontactforceevent_new: ji,
            __wbg_performance_7a3ffd0b17f663ad: xi,
            __wbindgen_is_undefined: Hi,
            __wbg_now_2c95c9de01293173: Ci,
            __wbindgen_object_clone_ref: Gi,
            __wbg_newnoargs_105ed471475aaf50: yi,
            __wbg_call_672a4d21634d4a24: hi,
            __wbg_call_7cccdd69e0791ae2: pi,
            __wbg_call_833bed5770ea2041: ui,
            __wbg_call_b8adc8b1d0a0d8eb: gi,
            __wbg_bind_c8359b1cba058168: wi,
            __wbg_buffer_609cc3eee51ed158: di,
            __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0: zi,
            __wbg_static_accessor_SELF_37c5d418e4bf5819: Fi,
            __wbg_static_accessor_WINDOW_5de37043a91a9c40: Ti,
            __wbg_static_accessor_GLOBAL_88a902d13a557d07: Pi,
            __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a: vi,
            __wbg_new_a12002a7f91c75be: fi,
            __wbg_set_65595bdd868b3009: Ai,
            __wbg_length_a446193dc22c12f8: mi,
            __wbg_newwithbyteoffsetandlength_e6b7e69acd4c7354: Si,
            __wbg_set_10bad9bee0e9c58b: Ei,
            __wbg_length_3b4f022188ae8db6: bi,
            __wbg_newwithlength_5a5efe313cfd59f1: Ri,
            __wbindgen_throw: Bi,
            __wbindgen_memory: Di
        }
    }, qr), Oi = n.memory, Vi = n.version, Ui = n.__wbg_rawkinematiccharactercontroller_free, Xi = n.rawkinematiccharactercontroller_new, Ji = n.rawkinematiccharactercontroller_setUp, qi = n.rawkinematiccharactercontroller_normalNudgeFactor, Ki = n.rawkinematiccharactercontroller_setNormalNudgeFactor, Yi = n.rawkinematiccharactercontroller_offset, Zi = n.rawkinematiccharactercontroller_setOffset, $i = n.rawkinematiccharactercontroller_slideEnabled, Qi = n.rawkinematiccharactercontroller_setSlideEnabled, tn = n.rawkinematiccharactercontroller_autostepMaxHeight, en = n.rawkinematiccharactercontroller_autostepMinWidth, rn = n.rawkinematiccharactercontroller_autostepIncludesDynamicBodies, nn = n.rawkinematiccharactercontroller_autostepEnabled, an = n.rawkinematiccharactercontroller_enableAutostep, sn = n.rawkinematiccharactercontroller_disableAutostep, on = n.rawkinematiccharactercontroller_maxSlopeClimbAngle, _n = n.rawkinematiccharactercontroller_setMaxSlopeClimbAngle, cn = n.rawkinematiccharactercontroller_minSlopeSlideAngle, ln = n.rawkinematiccharactercontroller_setMinSlopeSlideAngle, wn = n.rawkinematiccharactercontroller_snapToGroundDistance, dn = n.rawkinematiccharactercontroller_enableSnapToGround, hn = n.rawkinematiccharactercontroller_disableSnapToGround, pn = n.rawkinematiccharactercontroller_snapToGroundEnabled, un = n.rawkinematiccharactercontroller_computeColliderMovement, gn = n.rawkinematiccharactercontroller_computedMovement, bn = n.rawkinematiccharactercontroller_computedGrounded, mn = n.rawkinematiccharactercontroller_numComputedCollisions, fn = n.rawkinematiccharactercontroller_computedCollision, yn = n.__wbg_rawcharactercollision_free, vn = n.rawcharactercollision_new, Sn = n.rawcharactercollision_handle, Rn = n.rawcharactercollision_translationDeltaApplied, Cn = n.rawcharactercollision_translationDeltaRemaining, xn = n.rawcharactercollision_toi, jn = n.rawcharactercollision_worldWitness1, In = n.rawcharactercollision_worldWitness2, En = n.rawcharactercollision_worldNormal1, An = n.rawcharactercollision_worldNormal2, Pn = n.__wbg_rawpidcontroller_free, zn = n.rawpidcontroller_new, Fn = n.rawpidcontroller_set_kp, Tn = n.rawpidcontroller_set_ki, Mn = n.rawpidcontroller_set_kd, kn = n.rawpidcontroller_set_axes_mask, Hn = n.rawpidcontroller_reset_integrals, Dn = n.rawpidcontroller_apply_linear_correction, Ln = n.rawpidcontroller_apply_angular_correction, Nn = n.rawpidcontroller_linear_correction, Gn = n.rawpidcontroller_angular_correction, Wn = n.__wbg_rawdynamicraycastvehiclecontroller_free, Bn = n.rawdynamicraycastvehiclecontroller_new, On = n.rawdynamicraycastvehiclecontroller_current_vehicle_speed, Vn = n.rawdynamicraycastvehiclecontroller_chassis, Un = n.rawdynamicraycastvehiclecontroller_index_up_axis, Xn = n.rawdynamicraycastvehiclecontroller_set_index_up_axis, Jn = n.rawdynamicraycastvehiclecontroller_index_forward_axis, qn = n.rawdynamicraycastvehiclecontroller_set_index_forward_axis, Kn = n.rawdynamicraycastvehiclecontroller_add_wheel, Yn = n.rawdynamicraycastvehiclecontroller_num_wheels, Zn = n.rawdynamicraycastvehiclecontroller_update_vehicle, $n = n.rawdynamicraycastvehiclecontroller_wheel_chassis_connection_point_cs, Qn = n.rawdynamicraycastvehiclecontroller_set_wheel_chassis_connection_point_cs, ta = n.rawdynamicraycastvehiclecontroller_wheel_suspension_rest_length, ea = n.rawdynamicraycastvehiclecontroller_set_wheel_suspension_rest_length, ra = n.rawdynamicraycastvehiclecontroller_wheel_max_suspension_travel, ia = n.rawdynamicraycastvehiclecontroller_set_wheel_max_suspension_travel, na = n.rawdynamicraycastvehiclecontroller_wheel_radius, aa = n.rawdynamicraycastvehiclecontroller_set_wheel_radius, sa = n.rawdynamicraycastvehiclecontroller_wheel_suspension_stiffness, oa = n.rawdynamicraycastvehiclecontroller_set_wheel_suspension_stiffness, _a = n.rawdynamicraycastvehiclecontroller_wheel_suspension_compression, ca = n.rawdynamicraycastvehiclecontroller_set_wheel_suspension_compression, la = n.rawdynamicraycastvehiclecontroller_wheel_suspension_relaxation, wa = n.rawdynamicraycastvehiclecontroller_set_wheel_suspension_relaxation, da = n.rawdynamicraycastvehiclecontroller_wheel_max_suspension_force, ha = n.rawdynamicraycastvehiclecontroller_set_wheel_max_suspension_force, pa = n.rawdynamicraycastvehiclecontroller_wheel_brake, ua = n.rawdynamicraycastvehiclecontroller_set_wheel_brake, ga = n.rawdynamicraycastvehiclecontroller_wheel_steering, ba = n.rawdynamicraycastvehiclecontroller_set_wheel_steering, ma = n.rawdynamicraycastvehiclecontroller_wheel_engine_force, fa = n.rawdynamicraycastvehiclecontroller_set_wheel_engine_force, ya = n.rawdynamicraycastvehiclecontroller_wheel_direction_cs, va = n.rawdynamicraycastvehiclecontroller_set_wheel_direction_cs, Sa = n.rawdynamicraycastvehiclecontroller_wheel_axle_cs, Ra = n.rawdynamicraycastvehiclecontroller_set_wheel_axle_cs, Ca = n.rawdynamicraycastvehiclecontroller_wheel_friction_slip, xa = n.rawdynamicraycastvehiclecontroller_set_wheel_friction_slip, ja = n.rawdynamicraycastvehiclecontroller_wheel_side_friction_stiffness, Ia = n.rawdynamicraycastvehiclecontroller_set_wheel_side_friction_stiffness, Ea = n.rawdynamicraycastvehiclecontroller_wheel_rotation, Aa = n.rawdynamicraycastvehiclecontroller_wheel_forward_impulse, Pa = n.rawdynamicraycastvehiclecontroller_wheel_side_impulse, za = n.rawdynamicraycastvehiclecontroller_wheel_suspension_force, Fa = n.rawdynamicraycastvehiclecontroller_wheel_contact_normal_ws, Ta = n.rawdynamicraycastvehiclecontroller_wheel_contact_point_ws, Ma = n.rawdynamicraycastvehiclecontroller_wheel_suspension_length, ka = n.rawdynamicraycastvehiclecontroller_wheel_hard_point_ws, Ha = n.rawdynamicraycastvehiclecontroller_wheel_is_in_contact, Da = n.rawdynamicraycastvehiclecontroller_wheel_ground_object, La = n.__wbg_rawccdsolver_free, Na = n.rawimpulsejointset_jointType, Ga = n.rawimpulsejointset_jointBodyHandle1, Wa = n.rawimpulsejointset_jointBodyHandle2, Ba = n.rawimpulsejointset_jointFrameX1, Oa = n.rawimpulsejointset_jointFrameX2, Va = n.rawimpulsejointset_jointAnchor1, Ua = n.rawimpulsejointset_jointAnchor2, Xa = n.rawimpulsejointset_jointSetAnchor1, Ja = n.rawimpulsejointset_jointSetAnchor2, qa = n.rawimpulsejointset_jointContactsEnabled, Ka = n.rawimpulsejointset_jointSetContactsEnabled, Ya = n.rawimpulsejointset_jointLimitsEnabled, Za = n.rawimpulsejointset_jointLimitsMin, $a = n.rawimpulsejointset_jointLimitsMax, Qa = n.rawimpulsejointset_jointSetLimits, ts = n.rawimpulsejointset_jointConfigureMotorModel, es = n.rawimpulsejointset_jointConfigureMotorVelocity, rs = n.rawimpulsejointset_jointConfigureMotorPosition, is = n.rawimpulsejointset_jointConfigureMotor, ns = n.__wbg_rawimpulsejointset_free, as = n.rawimpulsejointset_new, ss = n.rawimpulsejointset_createJoint, os = n.rawimpulsejointset_remove, _s = n.rawimpulsejointset_len, cs = n.rawimpulsejointset_contains, ls = n.rawimpulsejointset_forEachJointHandle, ws = n.rawimpulsejointset_forEachJointAttachedToRigidBody, ds = n.__wbg_rawintegrationparameters_free, hs = n.rawintegrationparameters_new, ps = n.rawintegrationparameters_dt, us = n.rawintegrationparameters_contact_erp, gs = n.rawintegrationparameters_normalizedAllowedLinearError, bs = n.rawintegrationparameters_normalizedPredictionDistance, ms = n.rawintegrationparameters_numSolverIterations, fs = n.rawintegrationparameters_minIslandSize, ys = n.rawintegrationparameters_maxCcdSubsteps, vs = n.rawintegrationparameters_set_dt, Ss = n.rawintegrationparameters_set_contact_natural_frequency, Rs = n.rawintegrationparameters_set_normalizedAllowedLinearError, Cs = n.rawintegrationparameters_set_normalizedPredictionDistance, xs = n.rawintegrationparameters_set_numSolverIterations, js = n.rawintegrationparameters_set_minIslandSize, Is = n.rawintegrationparameters_set_maxCcdSubsteps, Es = n.rawintegrationparameters_set_lengthUnit, As = n.__wbg_rawislandmanager_free, Ps = n.rawislandmanager_new, zs = n.rawislandmanager_forEachActiveRigidBodyHandle, Fs = n.__wbg_rawgenericjoint_free, Ts = n.rawgenericjoint_generic, Ms = n.rawgenericjoint_spring, ks = n.rawgenericjoint_rope, Hs = n.rawgenericjoint_spherical, Ds = n.rawgenericjoint_prismatic, Ls = n.rawgenericjoint_fixed, Ns = n.rawgenericjoint_revolute, Gs = n.rawmultibodyjointset_jointType, Ws = n.rawmultibodyjointset_jointFrameX1, Bs = n.rawmultibodyjointset_jointFrameX2, Os = n.rawmultibodyjointset_jointAnchor1, Vs = n.rawmultibodyjointset_jointAnchor2, Us = n.rawmultibodyjointset_jointContactsEnabled, Xs = n.rawmultibodyjointset_jointSetContactsEnabled, Js = n.rawmultibodyjointset_jointLimitsEnabled, qs = n.rawmultibodyjointset_jointLimitsMin, Ks = n.rawmultibodyjointset_jointLimitsMax, Ys = n.__wbg_rawmultibodyjointset_free, Zs = n.rawmultibodyjointset_new, $s = n.rawmultibodyjointset_createJoint, Qs = n.rawmultibodyjointset_remove, to = n.rawmultibodyjointset_contains, eo = n.rawmultibodyjointset_forEachJointHandle, ro = n.rawmultibodyjointset_forEachJointAttachedToRigidBody, io = n.rawrigidbodyset_rbTranslation, no = n.rawrigidbodyset_rbRotation, ao = n.rawrigidbodyset_rbSleep, so = n.rawrigidbodyset_rbIsSleeping, oo = n.rawrigidbodyset_rbIsMoving, _o = n.rawrigidbodyset_rbNextTranslation, co = n.rawrigidbodyset_rbNextRotation, lo = n.rawrigidbodyset_rbSetTranslation, wo = n.rawrigidbodyset_rbSetRotation, ho = n.rawrigidbodyset_rbSetLinvel, po = n.rawrigidbodyset_rbSetAngvel, uo = n.rawrigidbodyset_rbSetNextKinematicTranslation, go = n.rawrigidbodyset_rbSetNextKinematicRotation, bo = n.rawrigidbodyset_rbRecomputeMassPropertiesFromColliders, mo = n.rawrigidbodyset_rbSetAdditionalMass, fo = n.rawrigidbodyset_rbSetAdditionalMassProperties, yo = n.rawrigidbodyset_rbLinvel, vo = n.rawrigidbodyset_rbAngvel, So = n.rawrigidbodyset_rbVelocityAtPoint, Ro = n.rawrigidbodyset_rbLockTranslations, Co = n.rawrigidbodyset_rbSetEnabledTranslations, xo = n.rawrigidbodyset_rbLockRotations, jo = n.rawrigidbodyset_rbSetEnabledRotations, Io = n.rawrigidbodyset_rbDominanceGroup, Eo = n.rawrigidbodyset_rbSetDominanceGroup, Ao = n.rawrigidbodyset_rbEnableCcd, Po = n.rawrigidbodyset_rbSetSoftCcdPrediction, zo = n.rawrigidbodyset_rbMass, Fo = n.rawrigidbodyset_rbInvMass, To = n.rawrigidbodyset_rbEffectiveInvMass, Mo = n.rawrigidbodyset_rbLocalCom, ko = n.rawrigidbodyset_rbWorldCom, Ho = n.rawrigidbodyset_rbInvPrincipalInertia, Do = n.rawrigidbodyset_rbPrincipalInertiaLocalFrame, Lo = n.rawrigidbodyset_rbPrincipalInertia, No = n.rawrigidbodyset_rbEffectiveWorldInvInertia, Go = n.rawrigidbodyset_rbEffectiveAngularInertia, Wo = n.rawrigidbodyset_rbWakeUp, Bo = n.rawrigidbodyset_rbIsCcdEnabled, Oo = n.rawrigidbodyset_rbSoftCcdPrediction, Vo = n.rawrigidbodyset_rbNumColliders, Uo = n.rawrigidbodyset_rbCollider, Xo = n.rawrigidbodyset_rbBodyType, Jo = n.rawrigidbodyset_rbSetBodyType, qo = n.rawrigidbodyset_rbIsFixed, Ko = n.rawrigidbodyset_rbIsKinematic, Yo = n.rawrigidbodyset_rbIsDynamic, Zo = n.rawrigidbodyset_rbLinearDamping, $o = n.rawrigidbodyset_rbAngularDamping, Qo = n.rawrigidbodyset_rbSetLinearDamping, t_ = n.rawrigidbodyset_rbSetAngularDamping, e_ = n.rawrigidbodyset_rbSetEnabled, r_ = n.rawrigidbodyset_rbIsEnabled, i_ = n.rawrigidbodyset_rbGravityScale, n_ = n.rawrigidbodyset_rbSetGravityScale, a_ = n.rawrigidbodyset_rbResetForces, s_ = n.rawrigidbodyset_rbResetTorques, o_ = n.rawrigidbodyset_rbAddForce, __ = n.rawrigidbodyset_rbApplyImpulse, c_ = n.rawrigidbodyset_rbAddTorque, l_ = n.rawrigidbodyset_rbApplyTorqueImpulse, w_ = n.rawrigidbodyset_rbAddForceAtPoint, d_ = n.rawrigidbodyset_rbApplyImpulseAtPoint, h_ = n.rawrigidbodyset_rbAdditionalSolverIterations, p_ = n.rawrigidbodyset_rbSetAdditionalSolverIterations, u_ = n.rawrigidbodyset_rbUserData, g_ = n.rawrigidbodyset_rbSetUserData, b_ = n.rawrigidbodyset_rbUserForce, m_ = n.rawrigidbodyset_rbUserTorque, f_ = n.__wbg_rawrigidbodyset_free, y_ = n.rawrigidbodyset_new, v_ = n.rawrigidbodyset_createRigidBody, S_ = n.rawrigidbodyset_remove, R_ = n.rawrigidbodyset_len, C_ = n.rawrigidbodyset_contains, x_ = n.rawrigidbodyset_forEachRigidBodyHandle, j_ = n.rawrigidbodyset_propagateModifiedBodyPositionsToColliders, I_ = n.__wbg_rawbroadphase_free, E_ = n.rawbroadphase_new, A_ = n.rawbroadphase_castRay, P_ = n.rawbroadphase_castRayAndGetNormal, z_ = n.rawbroadphase_intersectionsWithRay, F_ = n.rawbroadphase_intersectionWithShape, T_ = n.rawbroadphase_projectPoint, M_ = n.rawbroadphase_projectPointAndGetFeature, k_ = n.rawbroadphase_intersectionsWithPoint, H_ = n.rawbroadphase_castShape, D_ = n.rawbroadphase_intersectionsWithShape, L_ = n.rawbroadphase_collidersWithAabbIntersectingAabb, N_ = n.rawcolliderset_coTranslation, G_ = n.rawcolliderset_coRotation, W_ = n.rawcolliderset_coTranslationWrtParent, B_ = n.rawcolliderset_coRotationWrtParent, O_ = n.rawcolliderset_coSetTranslation, V_ = n.rawcolliderset_coSetTranslationWrtParent, U_ = n.rawcolliderset_coSetRotation, X_ = n.rawcolliderset_coSetRotationWrtParent, J_ = n.rawcolliderset_coIsSensor, q_ = n.rawcolliderset_coShapeType, K_ = n.rawcolliderset_coHalfspaceNormal, Y_ = n.rawcolliderset_coHalfExtents, Z_ = n.rawcolliderset_coSetHalfExtents, $_ = n.rawcolliderset_coRadius, Q_ = n.rawcolliderset_coSetRadius, tc = n.rawcolliderset_coHalfHeight, ec = n.rawcolliderset_coSetHalfHeight, rc = n.rawcolliderset_coRoundRadius, ic = n.rawcolliderset_coSetRoundRadius, nc = n.rawcolliderset_coVoxelData, ac = n.rawcolliderset_coVoxelSize, sc = n.rawcolliderset_coSetVoxel, oc = n.rawcolliderset_coPropagateVoxelChange, _c = n.rawcolliderset_coCombineVoxelStates, cc = n.rawcolliderset_coVertices, lc = n.rawcolliderset_coIndices, wc = n.rawcolliderset_coTriMeshFlags, dc = n.rawcolliderset_coHeightFieldFlags, hc = n.rawcolliderset_coHeightfieldHeights, pc = n.rawcolliderset_coHeightfieldScale, uc = n.rawcolliderset_coHeightfieldNRows, gc = n.rawcolliderset_coHeightfieldNCols, bc = n.rawcolliderset_coParent, mc = n.rawcolliderset_coSetEnabled, fc = n.rawcolliderset_coIsEnabled, yc = n.rawcolliderset_coSetContactSkin, vc = n.rawcolliderset_coContactSkin, Sc = n.rawcolliderset_coFriction, Rc = n.rawcolliderset_coRestitution, Cc = n.rawcolliderset_coDensity, xc = n.rawcolliderset_coMass, jc = n.rawcolliderset_coVolume, Ic = n.rawcolliderset_coCollisionGroups, Ec = n.rawcolliderset_coSolverGroups, Ac = n.rawcolliderset_coActiveHooks, Pc = n.rawcolliderset_coActiveCollisionTypes, zc = n.rawcolliderset_coActiveEvents, Fc = n.rawcolliderset_coContactForceEventThreshold, Tc = n.rawcolliderset_coContainsPoint, Mc = n.rawcolliderset_coCastShape, kc = n.rawcolliderset_coCastCollider, Hc = n.rawcolliderset_coIntersectsShape, Dc = n.rawcolliderset_coContactShape, Lc = n.rawcolliderset_coContactCollider, Nc = n.rawcolliderset_coProjectPoint, Gc = n.rawcolliderset_coIntersectsRay, Wc = n.rawcolliderset_coCastRay, Bc = n.rawcolliderset_coCastRayAndGetNormal, Oc = n.rawcolliderset_coSetSensor, Vc = n.rawcolliderset_coSetRestitution, Uc = n.rawcolliderset_coSetFriction, Xc = n.rawcolliderset_coFrictionCombineRule, Jc = n.rawcolliderset_coSetFrictionCombineRule, qc = n.rawcolliderset_coRestitutionCombineRule, Kc = n.rawcolliderset_coSetRestitutionCombineRule, Yc = n.rawcolliderset_coSetCollisionGroups, Zc = n.rawcolliderset_coSetSolverGroups, $c = n.rawcolliderset_coSetActiveHooks, Qc = n.rawcolliderset_coSetActiveEvents, tl = n.rawcolliderset_coSetActiveCollisionTypes, el = n.rawcolliderset_coSetShape, rl = n.rawcolliderset_coSetContactForceEventThreshold, il = n.rawcolliderset_coSetDensity, nl = n.rawcolliderset_coSetMass, al = n.rawcolliderset_coSetMassProperties, sl = n.__wbg_rawcolliderset_free, ol = n.rawcolliderset_new, _l = n.rawcolliderset_len, cl = n.rawcolliderset_contains, ll = n.rawcolliderset_createCollider, wl = n.rawcolliderset_remove, dl = n.rawcolliderset_forEachColliderHandle, hl = n.__wbg_rawshapecontact_free, pl = n.__wbg_rawnarrowphase_free, ul = n.rawnarrowphase_new, gl = n.rawnarrowphase_contact_pairs_with, bl = n.rawnarrowphase_contact_pair, ml = n.rawnarrowphase_intersection_pairs_with, fl = n.rawnarrowphase_intersection_pair, yl = n.__wbg_rawcontactmanifold_free, vl = n.rawcontactpair_collider1, Sl = n.rawcontactpair_collider2, Rl = n.rawcontactpair_numContactManifolds, Cl = n.rawcontactpair_contactManifold, xl = n.rawcontactmanifold_normal, jl = n.rawcontactmanifold_local_n1, Il = n.rawcontactmanifold_local_n2, El = n.rawcontactmanifold_subshape1, Al = n.rawcontactmanifold_subshape2, Pl = n.rawcontactmanifold_num_contacts, zl = n.rawcontactmanifold_contact_local_p1, Fl = n.rawcontactmanifold_contact_local_p2, Tl = n.rawcontactmanifold_contact_dist, Ml = n.rawcontactmanifold_contact_fid1, kl = n.rawcontactmanifold_contact_fid2, Hl = n.rawcontactmanifold_contact_impulse, Dl = n.rawcontactmanifold_contact_tangent_impulse_x, Ll = n.rawcontactmanifold_contact_tangent_impulse_y, Nl = n.rawcontactmanifold_num_solver_contacts, Gl = n.rawcontactmanifold_solver_contact_point, Wl = n.rawcontactmanifold_solver_contact_dist, Bl = n.rawcontactmanifold_solver_contact_friction, Ol = n.rawcontactmanifold_solver_contact_restitution, Vl = n.rawcontactmanifold_solver_contact_tangent_velocity, Ul = n.__wbg_rawpointprojection_free, Xl = n.rawpointprojection_point, Jl = n.rawpointprojection_isInside, ql = n.__wbg_rawpointcolliderprojection_free, Kl = n.rawpointcolliderprojection_colliderHandle, Yl = n.rawpointcolliderprojection_point, Zl = n.rawpointcolliderprojection_isInside, $l = n.rawpointcolliderprojection_featureType, Ql = n.rawpointcolliderprojection_featureId, tw = n.__wbg_rawrayintersection_free, ew = n.__wbg_rawraycolliderhit_free, rw = n.__wbg_rawshape_free, iw = n.rawshape_cuboid, nw = n.rawshape_roundCuboid, aw = n.rawshape_ball, sw = n.rawshape_halfspace, ow = n.rawshape_capsule, _w = n.rawshape_cylinder, cw = n.rawshape_roundCylinder, lw = n.rawshape_cone, ww = n.rawshape_roundCone, dw = n.rawshape_voxels, hw = n.rawshape_voxelsFromPoints, pw = n.rawshape_polyline, uw = n.rawshape_trimesh, gw = n.rawshape_heightfield, bw = n.rawshape_segment, mw = n.rawshape_triangle, fw = n.rawshape_roundTriangle, yw = n.rawshape_convexHull, vw = n.rawshape_roundConvexHull, Sw = n.rawshape_convexMesh, Rw = n.rawshape_roundConvexMesh, Cw = n.rawshape_castShape, xw = n.rawshape_intersectsShape, jw = n.rawshape_contactShape, Iw = n.rawshape_containsPoint, Ew = n.rawshape_projectPoint, Aw = n.rawshape_intersectsRay, Pw = n.rawshape_castRay, zw = n.rawshape_castRayAndGetNormal, Fw = n.__wbg_rawshapecasthit_free, Tw = n.rawshapecasthit_witness1, Mw = n.rawshapecasthit_normal1, kw = n.rawshapecasthit_normal2, Hw = n.__wbg_rawcollidershapecasthit_free, Dw = n.rawcollidershapecasthit_time_of_impact, Lw = n.rawcollidershapecasthit_witness1, Nw = n.rawcollidershapecasthit_witness2, Gw = n.rawrotation_new, Ww = n.rawrotation_identity, Bw = n.rawrotation_w, Ow = n.rawvector_zero, Vw = n.rawvector_new, Uw = n.rawvector_set_y, Xw = n.rawvector_set_z, Jw = n.rawvector_xyz, qw = n.rawvector_yxz, Kw = n.rawvector_zxy, Yw = n.rawvector_xzy, Zw = n.rawvector_yzx, $w = n.rawvector_zyx, Qw = n.rawsdpmatrix3_elements, td = n.__wbg_rawdebugrenderpipeline_free, ed = n.rawdebugrenderpipeline_new, rd = n.rawdebugrenderpipeline_vertices, id = n.rawdebugrenderpipeline_colors, nd = n.rawdebugrenderpipeline_render, ad = n.__wbg_raweventqueue_free, sd = n.__wbg_rawcontactforceevent_free, od = n.rawcontactforceevent_collider2, _d = n.rawcontactforceevent_total_force, cd = n.rawcontactforceevent_total_force_magnitude, ld = n.rawcontactforceevent_max_force_direction, wd = n.rawcontactforceevent_max_force_magnitude, dd = n.raweventqueue_new, hd = n.raweventqueue_drainCollisionEvents, pd = n.raweventqueue_drainContactForceEvents, ud = n.raweventqueue_clear, gd = n.__wbg_rawphysicspipeline_free, bd = n.rawphysicspipeline_new, md = n.rawphysicspipeline_set_profiler_enabled, fd = n.rawphysicspipeline_is_profiler_enabled, yd = n.rawphysicspipeline_timing_step, vd = n.rawphysicspipeline_timing_collision_detection, Sd = n.rawphysicspipeline_timing_broad_phase, Rd = n.rawphysicspipeline_timing_narrow_phase, Cd = n.rawphysicspipeline_timing_solver, xd = n.rawphysicspipeline_timing_velocity_assembly, jd = n.rawphysicspipeline_timing_velocity_resolution, Id = n.rawphysicspipeline_timing_velocity_update, Ed = n.rawphysicspipeline_timing_velocity_writeback, Ad = n.rawphysicspipeline_timing_ccd, Pd = n.rawphysicspipeline_timing_ccd_toi_computation, zd = n.rawphysicspipeline_timing_ccd_broad_phase, Fd = n.rawphysicspipeline_timing_ccd_narrow_phase, Td = n.rawphysicspipeline_timing_ccd_solver, Md = n.rawphysicspipeline_timing_island_construction, kd = n.rawphysicspipeline_timing_user_changes, Hd = n.rawphysicspipeline_step, Dd = n.rawphysicspipeline_stepWithEvents, Ld = n.__wbg_rawdeserializedworld_free, Nd = n.rawdeserializedworld_takeGravity, Gd = n.rawdeserializedworld_takeIntegrationParameters, Wd = n.rawdeserializedworld_takeIslandManager, Bd = n.rawdeserializedworld_takeBroadPhase, Od = n.rawdeserializedworld_takeNarrowPhase, Vd = n.rawdeserializedworld_takeBodies, Ud = n.rawdeserializedworld_takeColliders, Xd = n.rawdeserializedworld_takeImpulseJoints, Jd = n.rawdeserializedworld_takeMultibodyJoints, qd = n.rawserializationpipeline_serializeAll, Kd = n.rawserializationpipeline_deserializeAll, Yd = n.rawcolliderset_isHandleValid, Zd = n.rawrayintersection_featureId, $d = n.rawraycolliderintersection_featureId, Qd = n.rawintegrationparameters_set_numInternalPgsIterations, th = n.rawvector_set_x, eh = n.reserve_memory, rh = n.rawkinematiccharactercontroller_up, ih = n.rawshapecontact_normal2, nh = n.rawshapecontact_point1, ah = n.rawshapecontact_point2, sh = n.rawrayintersection_normal, oh = n.rawraycolliderintersection_normal, _h = n.rawshapecontact_normal1, ch = n.rawcollidershapecasthit_normal1, lh = n.rawcollidershapecasthit_normal2, wh = n.rawshapecasthit_witness2, dh = n.rawintegrationparameters_numInternalPgsIterations, hh = n.rawshapecontact_distance, ph = n.rawrayintersection_featureType, uh = n.rawraycolliderintersection_colliderHandle, gh = n.rawrayintersection_time_of_impact, bh = n.rawraycolliderintersection_featureType, mh = n.rawraycolliderhit_colliderHandle, fh = n.rawraycolliderintersection_time_of_impact, yh = n.rawshapecasthit_time_of_impact, vh = n.rawcollidershapecasthit_colliderHandle, Sh = n.rawraycolliderhit_timeOfImpact, Rh = n.rawrotation_x, Ch = n.rawrotation_y, xh = n.rawrotation_z, jh = n.rawvector_x, Ih = n.rawvector_y, Eh = n.rawvector_z, Ah = n.rawcontactforceevent_collider1, Ph = n.rawintegrationparameters_lengthUnit, zh = n.__wbg_rawcontactpair_free, Fh = n.__wbg_rawraycolliderintersection_free, Th = n.__wbg_rawrotation_free, Mh = n.__wbg_rawvector_free, kh = n.__wbg_rawsdpmatrix3_free, Hh = n.__wbg_rawserializationpipeline_free, Dh = n.rawccdsolver_new, Lh = n.rawserializationpipeline_new, Nh = n.__wbindgen_export_0, Gh = n.__wbindgen_add_to_stack_pointer, Wh = n.__wbindgen_export_1, Bh = n.__wbindgen_export_2, Oh = Object.freeze(Object.defineProperty({
        __proto__: null,
        __wbg_rawbroadphase_free: I_,
        __wbg_rawccdsolver_free: La,
        __wbg_rawcharactercollision_free: yn,
        __wbg_rawcolliderset_free: sl,
        __wbg_rawcollidershapecasthit_free: Hw,
        __wbg_rawcontactforceevent_free: sd,
        __wbg_rawcontactmanifold_free: yl,
        __wbg_rawcontactpair_free: zh,
        __wbg_rawdebugrenderpipeline_free: td,
        __wbg_rawdeserializedworld_free: Ld,
        __wbg_rawdynamicraycastvehiclecontroller_free: Wn,
        __wbg_raweventqueue_free: ad,
        __wbg_rawgenericjoint_free: Fs,
        __wbg_rawimpulsejointset_free: ns,
        __wbg_rawintegrationparameters_free: ds,
        __wbg_rawislandmanager_free: As,
        __wbg_rawkinematiccharactercontroller_free: Ui,
        __wbg_rawmultibodyjointset_free: Ys,
        __wbg_rawnarrowphase_free: pl,
        __wbg_rawphysicspipeline_free: gd,
        __wbg_rawpidcontroller_free: Pn,
        __wbg_rawpointcolliderprojection_free: ql,
        __wbg_rawpointprojection_free: Ul,
        __wbg_rawraycolliderhit_free: ew,
        __wbg_rawraycolliderintersection_free: Fh,
        __wbg_rawrayintersection_free: tw,
        __wbg_rawrigidbodyset_free: f_,
        __wbg_rawrotation_free: Th,
        __wbg_rawsdpmatrix3_free: kh,
        __wbg_rawserializationpipeline_free: Hh,
        __wbg_rawshape_free: rw,
        __wbg_rawshapecasthit_free: Fw,
        __wbg_rawshapecontact_free: hl,
        __wbg_rawvector_free: Mh,
        __wbindgen_add_to_stack_pointer: Gh,
        __wbindgen_export_0: Nh,
        __wbindgen_export_1: Wh,
        __wbindgen_export_2: Bh,
        memory: Oi,
        rawbroadphase_castRay: A_,
        rawbroadphase_castRayAndGetNormal: P_,
        rawbroadphase_castShape: H_,
        rawbroadphase_collidersWithAabbIntersectingAabb: L_,
        rawbroadphase_intersectionWithShape: F_,
        rawbroadphase_intersectionsWithPoint: k_,
        rawbroadphase_intersectionsWithRay: z_,
        rawbroadphase_intersectionsWithShape: D_,
        rawbroadphase_new: E_,
        rawbroadphase_projectPoint: T_,
        rawbroadphase_projectPointAndGetFeature: M_,
        rawccdsolver_new: Dh,
        rawcharactercollision_handle: Sn,
        rawcharactercollision_new: vn,
        rawcharactercollision_toi: xn,
        rawcharactercollision_translationDeltaApplied: Rn,
        rawcharactercollision_translationDeltaRemaining: Cn,
        rawcharactercollision_worldNormal1: En,
        rawcharactercollision_worldNormal2: An,
        rawcharactercollision_worldWitness1: jn,
        rawcharactercollision_worldWitness2: In,
        rawcolliderset_coActiveCollisionTypes: Pc,
        rawcolliderset_coActiveEvents: zc,
        rawcolliderset_coActiveHooks: Ac,
        rawcolliderset_coCastCollider: kc,
        rawcolliderset_coCastRay: Wc,
        rawcolliderset_coCastRayAndGetNormal: Bc,
        rawcolliderset_coCastShape: Mc,
        rawcolliderset_coCollisionGroups: Ic,
        rawcolliderset_coCombineVoxelStates: _c,
        rawcolliderset_coContactCollider: Lc,
        rawcolliderset_coContactForceEventThreshold: Fc,
        rawcolliderset_coContactShape: Dc,
        rawcolliderset_coContactSkin: vc,
        rawcolliderset_coContainsPoint: Tc,
        rawcolliderset_coDensity: Cc,
        rawcolliderset_coFriction: Sc,
        rawcolliderset_coFrictionCombineRule: Xc,
        rawcolliderset_coHalfExtents: Y_,
        rawcolliderset_coHalfHeight: tc,
        rawcolliderset_coHalfspaceNormal: K_,
        rawcolliderset_coHeightFieldFlags: dc,
        rawcolliderset_coHeightfieldHeights: hc,
        rawcolliderset_coHeightfieldNCols: gc,
        rawcolliderset_coHeightfieldNRows: uc,
        rawcolliderset_coHeightfieldScale: pc,
        rawcolliderset_coIndices: lc,
        rawcolliderset_coIntersectsRay: Gc,
        rawcolliderset_coIntersectsShape: Hc,
        rawcolliderset_coIsEnabled: fc,
        rawcolliderset_coIsSensor: J_,
        rawcolliderset_coMass: xc,
        rawcolliderset_coParent: bc,
        rawcolliderset_coProjectPoint: Nc,
        rawcolliderset_coPropagateVoxelChange: oc,
        rawcolliderset_coRadius: $_,
        rawcolliderset_coRestitution: Rc,
        rawcolliderset_coRestitutionCombineRule: qc,
        rawcolliderset_coRotation: G_,
        rawcolliderset_coRotationWrtParent: B_,
        rawcolliderset_coRoundRadius: rc,
        rawcolliderset_coSetActiveCollisionTypes: tl,
        rawcolliderset_coSetActiveEvents: Qc,
        rawcolliderset_coSetActiveHooks: $c,
        rawcolliderset_coSetCollisionGroups: Yc,
        rawcolliderset_coSetContactForceEventThreshold: rl,
        rawcolliderset_coSetContactSkin: yc,
        rawcolliderset_coSetDensity: il,
        rawcolliderset_coSetEnabled: mc,
        rawcolliderset_coSetFriction: Uc,
        rawcolliderset_coSetFrictionCombineRule: Jc,
        rawcolliderset_coSetHalfExtents: Z_,
        rawcolliderset_coSetHalfHeight: ec,
        rawcolliderset_coSetMass: nl,
        rawcolliderset_coSetMassProperties: al,
        rawcolliderset_coSetRadius: Q_,
        rawcolliderset_coSetRestitution: Vc,
        rawcolliderset_coSetRestitutionCombineRule: Kc,
        rawcolliderset_coSetRotation: U_,
        rawcolliderset_coSetRotationWrtParent: X_,
        rawcolliderset_coSetRoundRadius: ic,
        rawcolliderset_coSetSensor: Oc,
        rawcolliderset_coSetShape: el,
        rawcolliderset_coSetSolverGroups: Zc,
        rawcolliderset_coSetTranslation: O_,
        rawcolliderset_coSetTranslationWrtParent: V_,
        rawcolliderset_coSetVoxel: sc,
        rawcolliderset_coShapeType: q_,
        rawcolliderset_coSolverGroups: Ec,
        rawcolliderset_coTranslation: N_,
        rawcolliderset_coTranslationWrtParent: W_,
        rawcolliderset_coTriMeshFlags: wc,
        rawcolliderset_coVertices: cc,
        rawcolliderset_coVolume: jc,
        rawcolliderset_coVoxelData: nc,
        rawcolliderset_coVoxelSize: ac,
        rawcolliderset_contains: cl,
        rawcolliderset_createCollider: ll,
        rawcolliderset_forEachColliderHandle: dl,
        rawcolliderset_isHandleValid: Yd,
        rawcolliderset_len: _l,
        rawcolliderset_new: ol,
        rawcolliderset_remove: wl,
        rawcollidershapecasthit_colliderHandle: vh,
        rawcollidershapecasthit_normal1: ch,
        rawcollidershapecasthit_normal2: lh,
        rawcollidershapecasthit_time_of_impact: Dw,
        rawcollidershapecasthit_witness1: Lw,
        rawcollidershapecasthit_witness2: Nw,
        rawcontactforceevent_collider1: Ah,
        rawcontactforceevent_collider2: od,
        rawcontactforceevent_max_force_direction: ld,
        rawcontactforceevent_max_force_magnitude: wd,
        rawcontactforceevent_total_force: _d,
        rawcontactforceevent_total_force_magnitude: cd,
        rawcontactmanifold_contact_dist: Tl,
        rawcontactmanifold_contact_fid1: Ml,
        rawcontactmanifold_contact_fid2: kl,
        rawcontactmanifold_contact_impulse: Hl,
        rawcontactmanifold_contact_local_p1: zl,
        rawcontactmanifold_contact_local_p2: Fl,
        rawcontactmanifold_contact_tangent_impulse_x: Dl,
        rawcontactmanifold_contact_tangent_impulse_y: Ll,
        rawcontactmanifold_local_n1: jl,
        rawcontactmanifold_local_n2: Il,
        rawcontactmanifold_normal: xl,
        rawcontactmanifold_num_contacts: Pl,
        rawcontactmanifold_num_solver_contacts: Nl,
        rawcontactmanifold_solver_contact_dist: Wl,
        rawcontactmanifold_solver_contact_friction: Bl,
        rawcontactmanifold_solver_contact_point: Gl,
        rawcontactmanifold_solver_contact_restitution: Ol,
        rawcontactmanifold_solver_contact_tangent_velocity: Vl,
        rawcontactmanifold_subshape1: El,
        rawcontactmanifold_subshape2: Al,
        rawcontactpair_collider1: vl,
        rawcontactpair_collider2: Sl,
        rawcontactpair_contactManifold: Cl,
        rawcontactpair_numContactManifolds: Rl,
        rawdebugrenderpipeline_colors: id,
        rawdebugrenderpipeline_new: ed,
        rawdebugrenderpipeline_render: nd,
        rawdebugrenderpipeline_vertices: rd,
        rawdeserializedworld_takeBodies: Vd,
        rawdeserializedworld_takeBroadPhase: Bd,
        rawdeserializedworld_takeColliders: Ud,
        rawdeserializedworld_takeGravity: Nd,
        rawdeserializedworld_takeImpulseJoints: Xd,
        rawdeserializedworld_takeIntegrationParameters: Gd,
        rawdeserializedworld_takeIslandManager: Wd,
        rawdeserializedworld_takeMultibodyJoints: Jd,
        rawdeserializedworld_takeNarrowPhase: Od,
        rawdynamicraycastvehiclecontroller_add_wheel: Kn,
        rawdynamicraycastvehiclecontroller_chassis: Vn,
        rawdynamicraycastvehiclecontroller_current_vehicle_speed: On,
        rawdynamicraycastvehiclecontroller_index_forward_axis: Jn,
        rawdynamicraycastvehiclecontroller_index_up_axis: Un,
        rawdynamicraycastvehiclecontroller_new: Bn,
        rawdynamicraycastvehiclecontroller_num_wheels: Yn,
        rawdynamicraycastvehiclecontroller_set_index_forward_axis: qn,
        rawdynamicraycastvehiclecontroller_set_index_up_axis: Xn,
        rawdynamicraycastvehiclecontroller_set_wheel_axle_cs: Ra,
        rawdynamicraycastvehiclecontroller_set_wheel_brake: ua,
        rawdynamicraycastvehiclecontroller_set_wheel_chassis_connection_point_cs: Qn,
        rawdynamicraycastvehiclecontroller_set_wheel_direction_cs: va,
        rawdynamicraycastvehiclecontroller_set_wheel_engine_force: fa,
        rawdynamicraycastvehiclecontroller_set_wheel_friction_slip: xa,
        rawdynamicraycastvehiclecontroller_set_wheel_max_suspension_force: ha,
        rawdynamicraycastvehiclecontroller_set_wheel_max_suspension_travel: ia,
        rawdynamicraycastvehiclecontroller_set_wheel_radius: aa,
        rawdynamicraycastvehiclecontroller_set_wheel_side_friction_stiffness: Ia,
        rawdynamicraycastvehiclecontroller_set_wheel_steering: ba,
        rawdynamicraycastvehiclecontroller_set_wheel_suspension_compression: ca,
        rawdynamicraycastvehiclecontroller_set_wheel_suspension_relaxation: wa,
        rawdynamicraycastvehiclecontroller_set_wheel_suspension_rest_length: ea,
        rawdynamicraycastvehiclecontroller_set_wheel_suspension_stiffness: oa,
        rawdynamicraycastvehiclecontroller_update_vehicle: Zn,
        rawdynamicraycastvehiclecontroller_wheel_axle_cs: Sa,
        rawdynamicraycastvehiclecontroller_wheel_brake: pa,
        rawdynamicraycastvehiclecontroller_wheel_chassis_connection_point_cs: $n,
        rawdynamicraycastvehiclecontroller_wheel_contact_normal_ws: Fa,
        rawdynamicraycastvehiclecontroller_wheel_contact_point_ws: Ta,
        rawdynamicraycastvehiclecontroller_wheel_direction_cs: ya,
        rawdynamicraycastvehiclecontroller_wheel_engine_force: ma,
        rawdynamicraycastvehiclecontroller_wheel_forward_impulse: Aa,
        rawdynamicraycastvehiclecontroller_wheel_friction_slip: Ca,
        rawdynamicraycastvehiclecontroller_wheel_ground_object: Da,
        rawdynamicraycastvehiclecontroller_wheel_hard_point_ws: ka,
        rawdynamicraycastvehiclecontroller_wheel_is_in_contact: Ha,
        rawdynamicraycastvehiclecontroller_wheel_max_suspension_force: da,
        rawdynamicraycastvehiclecontroller_wheel_max_suspension_travel: ra,
        rawdynamicraycastvehiclecontroller_wheel_radius: na,
        rawdynamicraycastvehiclecontroller_wheel_rotation: Ea,
        rawdynamicraycastvehiclecontroller_wheel_side_friction_stiffness: ja,
        rawdynamicraycastvehiclecontroller_wheel_side_impulse: Pa,
        rawdynamicraycastvehiclecontroller_wheel_steering: ga,
        rawdynamicraycastvehiclecontroller_wheel_suspension_compression: _a,
        rawdynamicraycastvehiclecontroller_wheel_suspension_force: za,
        rawdynamicraycastvehiclecontroller_wheel_suspension_length: Ma,
        rawdynamicraycastvehiclecontroller_wheel_suspension_relaxation: la,
        rawdynamicraycastvehiclecontroller_wheel_suspension_rest_length: ta,
        rawdynamicraycastvehiclecontroller_wheel_suspension_stiffness: sa,
        raweventqueue_clear: ud,
        raweventqueue_drainCollisionEvents: hd,
        raweventqueue_drainContactForceEvents: pd,
        raweventqueue_new: dd,
        rawgenericjoint_fixed: Ls,
        rawgenericjoint_generic: Ts,
        rawgenericjoint_prismatic: Ds,
        rawgenericjoint_revolute: Ns,
        rawgenericjoint_rope: ks,
        rawgenericjoint_spherical: Hs,
        rawgenericjoint_spring: Ms,
        rawimpulsejointset_contains: cs,
        rawimpulsejointset_createJoint: ss,
        rawimpulsejointset_forEachJointAttachedToRigidBody: ws,
        rawimpulsejointset_forEachJointHandle: ls,
        rawimpulsejointset_jointAnchor1: Va,
        rawimpulsejointset_jointAnchor2: Ua,
        rawimpulsejointset_jointBodyHandle1: Ga,
        rawimpulsejointset_jointBodyHandle2: Wa,
        rawimpulsejointset_jointConfigureMotor: is,
        rawimpulsejointset_jointConfigureMotorModel: ts,
        rawimpulsejointset_jointConfigureMotorPosition: rs,
        rawimpulsejointset_jointConfigureMotorVelocity: es,
        rawimpulsejointset_jointContactsEnabled: qa,
        rawimpulsejointset_jointFrameX1: Ba,
        rawimpulsejointset_jointFrameX2: Oa,
        rawimpulsejointset_jointLimitsEnabled: Ya,
        rawimpulsejointset_jointLimitsMax: $a,
        rawimpulsejointset_jointLimitsMin: Za,
        rawimpulsejointset_jointSetAnchor1: Xa,
        rawimpulsejointset_jointSetAnchor2: Ja,
        rawimpulsejointset_jointSetContactsEnabled: Ka,
        rawimpulsejointset_jointSetLimits: Qa,
        rawimpulsejointset_jointType: Na,
        rawimpulsejointset_len: _s,
        rawimpulsejointset_new: as,
        rawimpulsejointset_remove: os,
        rawintegrationparameters_contact_erp: us,
        rawintegrationparameters_dt: ps,
        rawintegrationparameters_lengthUnit: Ph,
        rawintegrationparameters_maxCcdSubsteps: ys,
        rawintegrationparameters_minIslandSize: fs,
        rawintegrationparameters_new: hs,
        rawintegrationparameters_normalizedAllowedLinearError: gs,
        rawintegrationparameters_normalizedPredictionDistance: bs,
        rawintegrationparameters_numInternalPgsIterations: dh,
        rawintegrationparameters_numSolverIterations: ms,
        rawintegrationparameters_set_contact_natural_frequency: Ss,
        rawintegrationparameters_set_dt: vs,
        rawintegrationparameters_set_lengthUnit: Es,
        rawintegrationparameters_set_maxCcdSubsteps: Is,
        rawintegrationparameters_set_minIslandSize: js,
        rawintegrationparameters_set_normalizedAllowedLinearError: Rs,
        rawintegrationparameters_set_normalizedPredictionDistance: Cs,
        rawintegrationparameters_set_numInternalPgsIterations: Qd,
        rawintegrationparameters_set_numSolverIterations: xs,
        rawislandmanager_forEachActiveRigidBodyHandle: zs,
        rawislandmanager_new: Ps,
        rawkinematiccharactercontroller_autostepEnabled: nn,
        rawkinematiccharactercontroller_autostepIncludesDynamicBodies: rn,
        rawkinematiccharactercontroller_autostepMaxHeight: tn,
        rawkinematiccharactercontroller_autostepMinWidth: en,
        rawkinematiccharactercontroller_computeColliderMovement: un,
        rawkinematiccharactercontroller_computedCollision: fn,
        rawkinematiccharactercontroller_computedGrounded: bn,
        rawkinematiccharactercontroller_computedMovement: gn,
        rawkinematiccharactercontroller_disableAutostep: sn,
        rawkinematiccharactercontroller_disableSnapToGround: hn,
        rawkinematiccharactercontroller_enableAutostep: an,
        rawkinematiccharactercontroller_enableSnapToGround: dn,
        rawkinematiccharactercontroller_maxSlopeClimbAngle: on,
        rawkinematiccharactercontroller_minSlopeSlideAngle: cn,
        rawkinematiccharactercontroller_new: Xi,
        rawkinematiccharactercontroller_normalNudgeFactor: qi,
        rawkinematiccharactercontroller_numComputedCollisions: mn,
        rawkinematiccharactercontroller_offset: Yi,
        rawkinematiccharactercontroller_setMaxSlopeClimbAngle: _n,
        rawkinematiccharactercontroller_setMinSlopeSlideAngle: ln,
        rawkinematiccharactercontroller_setNormalNudgeFactor: Ki,
        rawkinematiccharactercontroller_setOffset: Zi,
        rawkinematiccharactercontroller_setSlideEnabled: Qi,
        rawkinematiccharactercontroller_setUp: Ji,
        rawkinematiccharactercontroller_slideEnabled: $i,
        rawkinematiccharactercontroller_snapToGroundDistance: wn,
        rawkinematiccharactercontroller_snapToGroundEnabled: pn,
        rawkinematiccharactercontroller_up: rh,
        rawmultibodyjointset_contains: to,
        rawmultibodyjointset_createJoint: $s,
        rawmultibodyjointset_forEachJointAttachedToRigidBody: ro,
        rawmultibodyjointset_forEachJointHandle: eo,
        rawmultibodyjointset_jointAnchor1: Os,
        rawmultibodyjointset_jointAnchor2: Vs,
        rawmultibodyjointset_jointContactsEnabled: Us,
        rawmultibodyjointset_jointFrameX1: Ws,
        rawmultibodyjointset_jointFrameX2: Bs,
        rawmultibodyjointset_jointLimitsEnabled: Js,
        rawmultibodyjointset_jointLimitsMax: Ks,
        rawmultibodyjointset_jointLimitsMin: qs,
        rawmultibodyjointset_jointSetContactsEnabled: Xs,
        rawmultibodyjointset_jointType: Gs,
        rawmultibodyjointset_new: Zs,
        rawmultibodyjointset_remove: Qs,
        rawnarrowphase_contact_pair: bl,
        rawnarrowphase_contact_pairs_with: gl,
        rawnarrowphase_intersection_pair: fl,
        rawnarrowphase_intersection_pairs_with: ml,
        rawnarrowphase_new: ul,
        rawphysicspipeline_is_profiler_enabled: fd,
        rawphysicspipeline_new: bd,
        rawphysicspipeline_set_profiler_enabled: md,
        rawphysicspipeline_step: Hd,
        rawphysicspipeline_stepWithEvents: Dd,
        rawphysicspipeline_timing_broad_phase: Sd,
        rawphysicspipeline_timing_ccd: Ad,
        rawphysicspipeline_timing_ccd_broad_phase: zd,
        rawphysicspipeline_timing_ccd_narrow_phase: Fd,
        rawphysicspipeline_timing_ccd_solver: Td,
        rawphysicspipeline_timing_ccd_toi_computation: Pd,
        rawphysicspipeline_timing_collision_detection: vd,
        rawphysicspipeline_timing_island_construction: Md,
        rawphysicspipeline_timing_narrow_phase: Rd,
        rawphysicspipeline_timing_solver: Cd,
        rawphysicspipeline_timing_step: yd,
        rawphysicspipeline_timing_user_changes: kd,
        rawphysicspipeline_timing_velocity_assembly: xd,
        rawphysicspipeline_timing_velocity_resolution: jd,
        rawphysicspipeline_timing_velocity_update: Id,
        rawphysicspipeline_timing_velocity_writeback: Ed,
        rawpidcontroller_angular_correction: Gn,
        rawpidcontroller_apply_angular_correction: Ln,
        rawpidcontroller_apply_linear_correction: Dn,
        rawpidcontroller_linear_correction: Nn,
        rawpidcontroller_new: zn,
        rawpidcontroller_reset_integrals: Hn,
        rawpidcontroller_set_axes_mask: kn,
        rawpidcontroller_set_kd: Mn,
        rawpidcontroller_set_ki: Tn,
        rawpidcontroller_set_kp: Fn,
        rawpointcolliderprojection_colliderHandle: Kl,
        rawpointcolliderprojection_featureId: Ql,
        rawpointcolliderprojection_featureType: $l,
        rawpointcolliderprojection_isInside: Zl,
        rawpointcolliderprojection_point: Yl,
        rawpointprojection_isInside: Jl,
        rawpointprojection_point: Xl,
        rawraycolliderhit_colliderHandle: mh,
        rawraycolliderhit_timeOfImpact: Sh,
        rawraycolliderintersection_colliderHandle: uh,
        rawraycolliderintersection_featureId: $d,
        rawraycolliderintersection_featureType: bh,
        rawraycolliderintersection_normal: oh,
        rawraycolliderintersection_time_of_impact: fh,
        rawrayintersection_featureId: Zd,
        rawrayintersection_featureType: ph,
        rawrayintersection_normal: sh,
        rawrayintersection_time_of_impact: gh,
        rawrigidbodyset_contains: C_,
        rawrigidbodyset_createRigidBody: v_,
        rawrigidbodyset_forEachRigidBodyHandle: x_,
        rawrigidbodyset_len: R_,
        rawrigidbodyset_new: y_,
        rawrigidbodyset_propagateModifiedBodyPositionsToColliders: j_,
        rawrigidbodyset_rbAddForce: o_,
        rawrigidbodyset_rbAddForceAtPoint: w_,
        rawrigidbodyset_rbAddTorque: c_,
        rawrigidbodyset_rbAdditionalSolverIterations: h_,
        rawrigidbodyset_rbAngularDamping: $o,
        rawrigidbodyset_rbAngvel: vo,
        rawrigidbodyset_rbApplyImpulse: __,
        rawrigidbodyset_rbApplyImpulseAtPoint: d_,
        rawrigidbodyset_rbApplyTorqueImpulse: l_,
        rawrigidbodyset_rbBodyType: Xo,
        rawrigidbodyset_rbCollider: Uo,
        rawrigidbodyset_rbDominanceGroup: Io,
        rawrigidbodyset_rbEffectiveAngularInertia: Go,
        rawrigidbodyset_rbEffectiveInvMass: To,
        rawrigidbodyset_rbEffectiveWorldInvInertia: No,
        rawrigidbodyset_rbEnableCcd: Ao,
        rawrigidbodyset_rbGravityScale: i_,
        rawrigidbodyset_rbInvMass: Fo,
        rawrigidbodyset_rbInvPrincipalInertia: Ho,
        rawrigidbodyset_rbIsCcdEnabled: Bo,
        rawrigidbodyset_rbIsDynamic: Yo,
        rawrigidbodyset_rbIsEnabled: r_,
        rawrigidbodyset_rbIsFixed: qo,
        rawrigidbodyset_rbIsKinematic: Ko,
        rawrigidbodyset_rbIsMoving: oo,
        rawrigidbodyset_rbIsSleeping: so,
        rawrigidbodyset_rbLinearDamping: Zo,
        rawrigidbodyset_rbLinvel: yo,
        rawrigidbodyset_rbLocalCom: Mo,
        rawrigidbodyset_rbLockRotations: xo,
        rawrigidbodyset_rbLockTranslations: Ro,
        rawrigidbodyset_rbMass: zo,
        rawrigidbodyset_rbNextRotation: co,
        rawrigidbodyset_rbNextTranslation: _o,
        rawrigidbodyset_rbNumColliders: Vo,
        rawrigidbodyset_rbPrincipalInertia: Lo,
        rawrigidbodyset_rbPrincipalInertiaLocalFrame: Do,
        rawrigidbodyset_rbRecomputeMassPropertiesFromColliders: bo,
        rawrigidbodyset_rbResetForces: a_,
        rawrigidbodyset_rbResetTorques: s_,
        rawrigidbodyset_rbRotation: no,
        rawrigidbodyset_rbSetAdditionalMass: mo,
        rawrigidbodyset_rbSetAdditionalMassProperties: fo,
        rawrigidbodyset_rbSetAdditionalSolverIterations: p_,
        rawrigidbodyset_rbSetAngularDamping: t_,
        rawrigidbodyset_rbSetAngvel: po,
        rawrigidbodyset_rbSetBodyType: Jo,
        rawrigidbodyset_rbSetDominanceGroup: Eo,
        rawrigidbodyset_rbSetEnabled: e_,
        rawrigidbodyset_rbSetEnabledRotations: jo,
        rawrigidbodyset_rbSetEnabledTranslations: Co,
        rawrigidbodyset_rbSetGravityScale: n_,
        rawrigidbodyset_rbSetLinearDamping: Qo,
        rawrigidbodyset_rbSetLinvel: ho,
        rawrigidbodyset_rbSetNextKinematicRotation: go,
        rawrigidbodyset_rbSetNextKinematicTranslation: uo,
        rawrigidbodyset_rbSetRotation: wo,
        rawrigidbodyset_rbSetSoftCcdPrediction: Po,
        rawrigidbodyset_rbSetTranslation: lo,
        rawrigidbodyset_rbSetUserData: g_,
        rawrigidbodyset_rbSleep: ao,
        rawrigidbodyset_rbSoftCcdPrediction: Oo,
        rawrigidbodyset_rbTranslation: io,
        rawrigidbodyset_rbUserData: u_,
        rawrigidbodyset_rbUserForce: b_,
        rawrigidbodyset_rbUserTorque: m_,
        rawrigidbodyset_rbVelocityAtPoint: So,
        rawrigidbodyset_rbWakeUp: Wo,
        rawrigidbodyset_rbWorldCom: ko,
        rawrigidbodyset_remove: S_,
        rawrotation_identity: Ww,
        rawrotation_new: Gw,
        rawrotation_w: Bw,
        rawrotation_x: Rh,
        rawrotation_y: Ch,
        rawrotation_z: xh,
        rawsdpmatrix3_elements: Qw,
        rawserializationpipeline_deserializeAll: Kd,
        rawserializationpipeline_new: Lh,
        rawserializationpipeline_serializeAll: qd,
        rawshape_ball: aw,
        rawshape_capsule: ow,
        rawshape_castRay: Pw,
        rawshape_castRayAndGetNormal: zw,
        rawshape_castShape: Cw,
        rawshape_cone: lw,
        rawshape_contactShape: jw,
        rawshape_containsPoint: Iw,
        rawshape_convexHull: yw,
        rawshape_convexMesh: Sw,
        rawshape_cuboid: iw,
        rawshape_cylinder: _w,
        rawshape_halfspace: sw,
        rawshape_heightfield: gw,
        rawshape_intersectsRay: Aw,
        rawshape_intersectsShape: xw,
        rawshape_polyline: pw,
        rawshape_projectPoint: Ew,
        rawshape_roundCone: ww,
        rawshape_roundConvexHull: vw,
        rawshape_roundConvexMesh: Rw,
        rawshape_roundCuboid: nw,
        rawshape_roundCylinder: cw,
        rawshape_roundTriangle: fw,
        rawshape_segment: bw,
        rawshape_triangle: mw,
        rawshape_trimesh: uw,
        rawshape_voxels: dw,
        rawshape_voxelsFromPoints: hw,
        rawshapecasthit_normal1: Mw,
        rawshapecasthit_normal2: kw,
        rawshapecasthit_time_of_impact: yh,
        rawshapecasthit_witness1: Tw,
        rawshapecasthit_witness2: wh,
        rawshapecontact_distance: hh,
        rawshapecontact_normal1: _h,
        rawshapecontact_normal2: ih,
        rawshapecontact_point1: nh,
        rawshapecontact_point2: ah,
        rawvector_new: Vw,
        rawvector_set_x: th,
        rawvector_set_y: Uw,
        rawvector_set_z: Xw,
        rawvector_x: jh,
        rawvector_xyz: Jw,
        rawvector_xzy: Yw,
        rawvector_y: Ih,
        rawvector_yxz: qw,
        rawvector_yzx: Zw,
        rawvector_z: Eh,
        rawvector_zero: Ow,
        rawvector_zxy: Kw,
        rawvector_zyx: $w,
        reserve_memory: eh,
        version: Vi
    }, Symbol.toStringTag, {
        value: "Module"
    }));
    Yr(Oh);
    gr = class {
        constructor(t, e, r){
            this.x = t, this.y = e, this.z = r;
        }
    };
    w = class {
        static new(t, e, r) {
            return new gr(t, e, r);
        }
        static intoRaw(t) {
            return new l(t.x, t.y, t.z);
        }
        static zeros() {
            return w.new(0, 0, 0);
        }
        static fromRaw(t) {
            if (!t) return null;
            let e = w.new(t.x, t.y, t.z);
            return t.free(), e;
        }
        static copy(t, e) {
            t.x = e.x, t.y = e.y, t.z = e.z;
        }
    };
    ne = class {
        constructor(t, e, r, a){
            this.x = t, this.y = e, this.z = r, this.w = a;
        }
    };
    v = class {
        static identity() {
            return new ne(0, 0, 0, 1);
        }
        static fromRaw(t) {
            if (!t) return null;
            let e = new ne(t.x, t.y, t.z, t.w);
            return t.free(), e;
        }
        static intoRaw(t) {
            return new S(t.x, t.y, t.z, t.w);
        }
        static copy(t, e) {
            t.x = e.x, t.y = e.y, t.z = e.z, t.w = e.w;
        }
    };
    br = class {
        get m11() {
            return this.elements[0];
        }
        get m12() {
            return this.elements[1];
        }
        get m21() {
            return this.m12;
        }
        get m13() {
            return this.elements[2];
        }
        get m31() {
            return this.m13;
        }
        get m22() {
            return this.elements[3];
        }
        get m23() {
            return this.elements[4];
        }
        get m32() {
            return this.m23;
        }
        get m33() {
            return this.elements[5];
        }
        constructor(t){
            this.elements = t;
        }
    };
    ae = class {
        static fromRaw(t) {
            const e = new br(t.elements());
            return t.free(), e;
        }
    };
    (function(s) {
        s[s.Dynamic = 0] = "Dynamic", s[s.Fixed = 1] = "Fixed", s[s.KinematicPositionBased = 2] = "KinematicPositionBased", s[s.KinematicVelocityBased = 3] = "KinematicVelocityBased";
    })(V || (V = {}));
    se = class {
        constructor(t, e, r){
            this.rawSet = t, this.colliderSet = e, this.handle = r;
        }
        finalizeDeserialization(t) {
            this.colliderSet = t;
        }
        isValid() {
            return this.rawSet.contains(this.handle);
        }
        lockTranslations(t, e) {
            return this.rawSet.rbLockTranslations(this.handle, t, e);
        }
        lockRotations(t, e) {
            return this.rawSet.rbLockRotations(this.handle, t, e);
        }
        setEnabledTranslations(t, e, r, a) {
            return this.rawSet.rbSetEnabledTranslations(this.handle, t, e, r, a);
        }
        restrictTranslations(t, e, r, a) {
            this.setEnabledTranslations(t, e, r, a);
        }
        setEnabledRotations(t, e, r, a) {
            return this.rawSet.rbSetEnabledRotations(this.handle, t, e, r, a);
        }
        restrictRotations(t, e, r, a) {
            this.setEnabledRotations(t, e, r, a);
        }
        dominanceGroup() {
            return this.rawSet.rbDominanceGroup(this.handle);
        }
        setDominanceGroup(t) {
            this.rawSet.rbSetDominanceGroup(this.handle, t);
        }
        additionalSolverIterations() {
            return this.rawSet.rbAdditionalSolverIterations(this.handle);
        }
        setAdditionalSolverIterations(t) {
            this.rawSet.rbSetAdditionalSolverIterations(this.handle, t);
        }
        enableCcd(t) {
            this.rawSet.rbEnableCcd(this.handle, t);
        }
        setSoftCcdPrediction(t) {
            this.rawSet.rbSetSoftCcdPrediction(this.handle, t);
        }
        softCcdPrediction() {
            return this.rawSet.rbSoftCcdPrediction(this.handle);
        }
        translation() {
            let t = this.rawSet.rbTranslation(this.handle);
            return w.fromRaw(t);
        }
        rotation() {
            let t = this.rawSet.rbRotation(this.handle);
            return v.fromRaw(t);
        }
        nextTranslation() {
            let t = this.rawSet.rbNextTranslation(this.handle);
            return w.fromRaw(t);
        }
        nextRotation() {
            let t = this.rawSet.rbNextRotation(this.handle);
            return v.fromRaw(t);
        }
        setTranslation(t, e) {
            this.rawSet.rbSetTranslation(this.handle, t.x, t.y, t.z, e);
        }
        setLinvel(t, e) {
            let r = w.intoRaw(t);
            this.rawSet.rbSetLinvel(this.handle, r, e), r.free();
        }
        gravityScale() {
            return this.rawSet.rbGravityScale(this.handle);
        }
        setGravityScale(t, e) {
            this.rawSet.rbSetGravityScale(this.handle, t, e);
        }
        setRotation(t, e) {
            this.rawSet.rbSetRotation(this.handle, t.x, t.y, t.z, t.w, e);
        }
        setAngvel(t, e) {
            let r = w.intoRaw(t);
            this.rawSet.rbSetAngvel(this.handle, r, e), r.free();
        }
        setNextKinematicTranslation(t) {
            this.rawSet.rbSetNextKinematicTranslation(this.handle, t.x, t.y, t.z);
        }
        setNextKinematicRotation(t) {
            this.rawSet.rbSetNextKinematicRotation(this.handle, t.x, t.y, t.z, t.w);
        }
        linvel() {
            return w.fromRaw(this.rawSet.rbLinvel(this.handle));
        }
        velocityAtPoint(t) {
            const e = w.intoRaw(t);
            let r = w.fromRaw(this.rawSet.rbVelocityAtPoint(this.handle, e));
            return e.free(), r;
        }
        angvel() {
            return w.fromRaw(this.rawSet.rbAngvel(this.handle));
        }
        mass() {
            return this.rawSet.rbMass(this.handle);
        }
        effectiveInvMass() {
            return w.fromRaw(this.rawSet.rbEffectiveInvMass(this.handle));
        }
        invMass() {
            return this.rawSet.rbInvMass(this.handle);
        }
        localCom() {
            return w.fromRaw(this.rawSet.rbLocalCom(this.handle));
        }
        worldCom() {
            return w.fromRaw(this.rawSet.rbWorldCom(this.handle));
        }
        invPrincipalInertia() {
            return w.fromRaw(this.rawSet.rbInvPrincipalInertia(this.handle));
        }
        principalInertia() {
            return w.fromRaw(this.rawSet.rbPrincipalInertia(this.handle));
        }
        principalInertiaLocalFrame() {
            return v.fromRaw(this.rawSet.rbPrincipalInertiaLocalFrame(this.handle));
        }
        effectiveWorldInvInertia() {
            return ae.fromRaw(this.rawSet.rbEffectiveWorldInvInertia(this.handle));
        }
        effectiveAngularInertia() {
            return ae.fromRaw(this.rawSet.rbEffectiveAngularInertia(this.handle));
        }
        sleep() {
            this.rawSet.rbSleep(this.handle);
        }
        wakeUp() {
            this.rawSet.rbWakeUp(this.handle);
        }
        isCcdEnabled() {
            return this.rawSet.rbIsCcdEnabled(this.handle);
        }
        numColliders() {
            return this.rawSet.rbNumColliders(this.handle);
        }
        collider(t) {
            return this.colliderSet.get(this.rawSet.rbCollider(this.handle, t));
        }
        setEnabled(t) {
            this.rawSet.rbSetEnabled(this.handle, t);
        }
        isEnabled() {
            return this.rawSet.rbIsEnabled(this.handle);
        }
        bodyType() {
            return this.rawSet.rbBodyType(this.handle);
        }
        setBodyType(t, e) {
            return this.rawSet.rbSetBodyType(this.handle, t, e);
        }
        isSleeping() {
            return this.rawSet.rbIsSleeping(this.handle);
        }
        isMoving() {
            return this.rawSet.rbIsMoving(this.handle);
        }
        isFixed() {
            return this.rawSet.rbIsFixed(this.handle);
        }
        isKinematic() {
            return this.rawSet.rbIsKinematic(this.handle);
        }
        isDynamic() {
            return this.rawSet.rbIsDynamic(this.handle);
        }
        linearDamping() {
            return this.rawSet.rbLinearDamping(this.handle);
        }
        angularDamping() {
            return this.rawSet.rbAngularDamping(this.handle);
        }
        setLinearDamping(t) {
            this.rawSet.rbSetLinearDamping(this.handle, t);
        }
        recomputeMassPropertiesFromColliders() {
            this.rawSet.rbRecomputeMassPropertiesFromColliders(this.handle, this.colliderSet.raw);
        }
        setAdditionalMass(t, e) {
            this.rawSet.rbSetAdditionalMass(this.handle, t, e);
        }
        setAdditionalMassProperties(t, e, r, a, o) {
            let _ = w.intoRaw(e), d = w.intoRaw(r), h = v.intoRaw(a);
            this.rawSet.rbSetAdditionalMassProperties(this.handle, t, _, d, h, o), _.free(), d.free(), h.free();
        }
        setAngularDamping(t) {
            this.rawSet.rbSetAngularDamping(this.handle, t);
        }
        resetForces(t) {
            this.rawSet.rbResetForces(this.handle, t);
        }
        resetTorques(t) {
            this.rawSet.rbResetTorques(this.handle, t);
        }
        addForce(t, e) {
            const r = w.intoRaw(t);
            this.rawSet.rbAddForce(this.handle, r, e), r.free();
        }
        applyImpulse(t, e) {
            const r = w.intoRaw(t);
            this.rawSet.rbApplyImpulse(this.handle, r, e), r.free();
        }
        addTorque(t, e) {
            const r = w.intoRaw(t);
            this.rawSet.rbAddTorque(this.handle, r, e), r.free();
        }
        applyTorqueImpulse(t, e) {
            const r = w.intoRaw(t);
            this.rawSet.rbApplyTorqueImpulse(this.handle, r, e), r.free();
        }
        addForceAtPoint(t, e, r) {
            const a = w.intoRaw(t), o = w.intoRaw(e);
            this.rawSet.rbAddForceAtPoint(this.handle, a, o, r), a.free(), o.free();
        }
        applyImpulseAtPoint(t, e, r) {
            const a = w.intoRaw(t), o = w.intoRaw(e);
            this.rawSet.rbApplyImpulseAtPoint(this.handle, a, o, r), a.free(), o.free();
        }
        userForce() {
            return w.fromRaw(this.rawSet.rbUserForce(this.handle));
        }
        userTorque() {
            return w.fromRaw(this.rawSet.rbUserTorque(this.handle));
        }
    };
    J = class {
        constructor(t){
            this.enabled = !0, this.status = t, this.translation = w.zeros(), this.rotation = v.identity(), this.gravityScale = 1, this.linvel = w.zeros(), this.mass = 0, this.massOnly = !1, this.centerOfMass = w.zeros(), this.translationsEnabledX = !0, this.translationsEnabledY = !0, this.angvel = w.zeros(), this.principalAngularInertia = w.zeros(), this.angularInertiaLocalFrame = v.identity(), this.translationsEnabledZ = !0, this.rotationsEnabledX = !0, this.rotationsEnabledY = !0, this.rotationsEnabledZ = !0, this.linearDamping = 0, this.angularDamping = 0, this.canSleep = !0, this.sleeping = !1, this.ccdEnabled = !1, this.softCcdPrediction = 0, this.dominanceGroup = 0, this.additionalSolverIterations = 0;
        }
        static dynamic() {
            return new J(V.Dynamic);
        }
        static kinematicPositionBased() {
            return new J(V.KinematicPositionBased);
        }
        static kinematicVelocityBased() {
            return new J(V.KinematicVelocityBased);
        }
        static fixed() {
            return new J(V.Fixed);
        }
        static newDynamic() {
            return new J(V.Dynamic);
        }
        static newKinematicPositionBased() {
            return new J(V.KinematicPositionBased);
        }
        static newKinematicVelocityBased() {
            return new J(V.KinematicVelocityBased);
        }
        static newStatic() {
            return new J(V.Fixed);
        }
        setDominanceGroup(t) {
            return this.dominanceGroup = t, this;
        }
        setAdditionalSolverIterations(t) {
            return this.additionalSolverIterations = t, this;
        }
        setEnabled(t) {
            return this.enabled = t, this;
        }
        setTranslation(t, e, r) {
            if (typeof t != "number" || typeof e != "number" || typeof r != "number") throw TypeError("The translation components must be numbers.");
            return this.translation = {
                x: t,
                y: e,
                z: r
            }, this;
        }
        setRotation(t) {
            return v.copy(this.rotation, t), this;
        }
        setGravityScale(t) {
            return this.gravityScale = t, this;
        }
        setAdditionalMass(t) {
            return this.mass = t, this.massOnly = !0, this;
        }
        setLinvel(t, e, r) {
            if (typeof t != "number" || typeof e != "number" || typeof r != "number") throw TypeError("The linvel components must be numbers.");
            return this.linvel = {
                x: t,
                y: e,
                z: r
            }, this;
        }
        setAngvel(t) {
            return w.copy(this.angvel, t), this;
        }
        setAdditionalMassProperties(t, e, r, a) {
            return this.mass = t, w.copy(this.centerOfMass, e), w.copy(this.principalAngularInertia, r), v.copy(this.angularInertiaLocalFrame, a), this.massOnly = !1, this;
        }
        enabledTranslations(t, e, r) {
            return this.translationsEnabledX = t, this.translationsEnabledY = e, this.translationsEnabledZ = r, this;
        }
        restrictTranslations(t, e, r) {
            return this.enabledTranslations(t, e, r);
        }
        lockTranslations() {
            return this.enabledTranslations(!1, !1, !1);
        }
        enabledRotations(t, e, r) {
            return this.rotationsEnabledX = t, this.rotationsEnabledY = e, this.rotationsEnabledZ = r, this;
        }
        restrictRotations(t, e, r) {
            return this.enabledRotations(t, e, r);
        }
        lockRotations() {
            return this.restrictRotations(!1, !1, !1);
        }
        setLinearDamping(t) {
            return this.linearDamping = t, this;
        }
        setAngularDamping(t) {
            return this.angularDamping = t, this;
        }
        setCanSleep(t) {
            return this.canSleep = t, this;
        }
        setSleeping(t) {
            return this.sleeping = t, this;
        }
        setCcdEnabled(t) {
            return this.ccdEnabled = t, this;
        }
        setSoftCcdPrediction(t) {
            return this.softCcdPrediction = t, this;
        }
        setUserData(t) {
            return this.userData = t, this;
        }
    };
    class Lt {
        constructor(){
            this.fconv = new Float64Array(1), this.uconv = new Uint32Array(this.fconv.buffer), this.data = new Array, this.size = 0;
        }
        set(t, e) {
            let r = this.index(t);
            for(; this.data.length <= r;)this.data.push(null);
            this.data[r] == null && (this.size += 1), this.data[r] = e;
        }
        len() {
            return this.size;
        }
        delete(t) {
            let e = this.index(t);
            e < this.data.length && (this.data[e] != null && (this.size -= 1), this.data[e] = null);
        }
        clear() {
            this.data = new Array;
        }
        get(t) {
            let e = this.index(t);
            return e < this.data.length ? this.data[e] : null;
        }
        forEach(t) {
            for (const e of this.data)e != null && t(e);
        }
        getAll() {
            return this.data.filter((t)=>t != null);
        }
        index(t) {
            return this.fconv[0] = t, this.uconv[0];
        }
    }
    mr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0, this.map && this.map.clear(), this.map = void 0;
        }
        constructor(t){
            this.raw = t || new E, this.map = new Lt, t && t.forEachRigidBodyHandle((e)=>{
                this.map.set(e, new se(t, null, e));
            });
        }
        finalizeDeserialization(t) {
            this.map.forEach((e)=>e.finalizeDeserialization(t));
        }
        createRigidBody(t, e) {
            let r = w.intoRaw(e.translation), a = v.intoRaw(e.rotation), o = w.intoRaw(e.linvel), _ = w.intoRaw(e.centerOfMass), d = w.intoRaw(e.angvel), h = w.intoRaw(e.principalAngularInertia), p = v.intoRaw(e.angularInertiaLocalFrame), u = this.raw.createRigidBody(e.enabled, r, a, e.gravityScale, e.mass, e.massOnly, _, o, d, h, p, e.translationsEnabledX, e.translationsEnabledY, e.translationsEnabledZ, e.rotationsEnabledX, e.rotationsEnabledY, e.rotationsEnabledZ, e.linearDamping, e.angularDamping, e.status, e.canSleep, e.sleeping, e.softCcdPrediction, e.ccdEnabled, e.dominanceGroup, e.additionalSolverIterations);
            r.free(), a.free(), o.free(), _.free(), d.free(), h.free(), p.free();
            const g = new se(this.raw, t, u);
            return g.userData = e.userData, this.map.set(u, g), g;
        }
        remove(t, e, r, a, o) {
            for(let _ = 0; _ < this.raw.rbNumColliders(t); _ += 1)r.unmap(this.raw.rbCollider(t, _));
            a.forEachJointHandleAttachedToRigidBody(t, (_)=>a.unmap(_)), o.forEachJointHandleAttachedToRigidBody(t, (_)=>o.unmap(_)), this.raw.remove(t, e.raw, r.raw, a.raw, o.raw), this.map.delete(t);
        }
        len() {
            return this.map.len();
        }
        contains(t) {
            return this.get(t) != null;
        }
        get(t) {
            return this.map.get(t);
        }
        forEach(t) {
            this.map.forEach(t);
        }
        forEachActiveRigidBody(t, e) {
            t.forEachActiveRigidBodyHandle((r)=>{
                e(this.get(r));
            });
        }
        getAll() {
            return this.map.getAll();
        }
    };
    fr = class {
        constructor(t){
            this.raw = t || new it;
        }
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        get dt() {
            return this.raw.dt;
        }
        get contact_erp() {
            return this.raw.contact_erp;
        }
        get lengthUnit() {
            return this.raw.lengthUnit;
        }
        get normalizedAllowedLinearError() {
            return this.raw.normalizedAllowedLinearError;
        }
        get normalizedPredictionDistance() {
            return this.raw.normalizedPredictionDistance;
        }
        get numSolverIterations() {
            return this.raw.numSolverIterations;
        }
        get numInternalPgsIterations() {
            return this.raw.numInternalPgsIterations;
        }
        get minIslandSize() {
            return this.raw.minIslandSize;
        }
        get maxCcdSubsteps() {
            return this.raw.maxCcdSubsteps;
        }
        set dt(t) {
            this.raw.dt = t;
        }
        set contact_natural_frequency(t) {
            this.raw.contact_natural_frequency = t;
        }
        set lengthUnit(t) {
            this.raw.lengthUnit = t;
        }
        set normalizedAllowedLinearError(t) {
            this.raw.normalizedAllowedLinearError = t;
        }
        set normalizedPredictionDistance(t) {
            this.raw.normalizedPredictionDistance = t;
        }
        set numSolverIterations(t) {
            this.raw.numSolverIterations = t;
        }
        set numInternalPgsIterations(t) {
            this.raw.numInternalPgsIterations = t;
        }
        set minIslandSize(t) {
            this.raw.minIslandSize = t;
        }
        set maxCcdSubsteps(t) {
            this.raw.maxCcdSubsteps = t;
        }
    };
    (function(s) {
        s[s.Revolute = 0] = "Revolute", s[s.Fixed = 1] = "Fixed", s[s.Prismatic = 2] = "Prismatic", s[s.Rope = 3] = "Rope", s[s.Spring = 4] = "Spring", s[s.Spherical = 5] = "Spherical", s[s.Generic = 6] = "Generic";
    })(N || (N = {}));
    (function(s) {
        s[s.AccelerationBased = 0] = "AccelerationBased", s[s.ForceBased = 1] = "ForceBased";
    })(oe || (oe = {}));
    (function(s) {
        s[s.LinX = 1] = "LinX", s[s.LinY = 2] = "LinY", s[s.LinZ = 4] = "LinZ", s[s.AngX = 8] = "AngX", s[s.AngY = 16] = "AngY", s[s.AngZ = 32] = "AngZ";
    })(_e || (_e = {}));
    X = class {
        constructor(t, e, r){
            this.rawSet = t, this.bodySet = e, this.handle = r;
        }
        static newTyped(t, e, r) {
            switch(t.jointType(r)){
                case U.Revolute:
                    return new Cr(t, e, r);
                case U.Prismatic:
                    return new Rr(t, e, r);
                case U.Fixed:
                    return new yr(t, e, r);
                case U.Spring:
                    return new Sr(t, e, r);
                case U.Rope:
                    return new vr(t, e, r);
                case U.Spherical:
                    return new jr(t, e, r);
                case U.Generic:
                    return new xr(t, e, r);
                default:
                    return new X(t, e, r);
            }
        }
        finalizeDeserialization(t) {
            this.bodySet = t;
        }
        isValid() {
            return this.rawSet.contains(this.handle);
        }
        body1() {
            return this.bodySet.get(this.rawSet.jointBodyHandle1(this.handle));
        }
        body2() {
            return this.bodySet.get(this.rawSet.jointBodyHandle2(this.handle));
        }
        type() {
            return this.rawSet.jointType(this.handle);
        }
        frameX1() {
            return v.fromRaw(this.rawSet.jointFrameX1(this.handle));
        }
        frameX2() {
            return v.fromRaw(this.rawSet.jointFrameX2(this.handle));
        }
        anchor1() {
            return w.fromRaw(this.rawSet.jointAnchor1(this.handle));
        }
        anchor2() {
            return w.fromRaw(this.rawSet.jointAnchor2(this.handle));
        }
        setAnchor1(t) {
            const e = w.intoRaw(t);
            this.rawSet.jointSetAnchor1(this.handle, e), e.free();
        }
        setAnchor2(t) {
            const e = w.intoRaw(t);
            this.rawSet.jointSetAnchor2(this.handle, e), e.free();
        }
        setContactsEnabled(t) {
            this.rawSet.jointSetContactsEnabled(this.handle, t);
        }
        contactsEnabled() {
            return this.rawSet.jointContactsEnabled(this.handle);
        }
    };
    Se = class extends X {
        limitsEnabled() {
            return this.rawSet.jointLimitsEnabled(this.handle, this.rawAxis());
        }
        limitsMin() {
            return this.rawSet.jointLimitsMin(this.handle, this.rawAxis());
        }
        limitsMax() {
            return this.rawSet.jointLimitsMax(this.handle, this.rawAxis());
        }
        setLimits(t, e) {
            this.rawSet.jointSetLimits(this.handle, this.rawAxis(), t, e);
        }
        configureMotorModel(t) {
            this.rawSet.jointConfigureMotorModel(this.handle, this.rawAxis(), t);
        }
        configureMotorVelocity(t, e) {
            this.rawSet.jointConfigureMotorVelocity(this.handle, this.rawAxis(), t, e);
        }
        configureMotorPosition(t, e, r) {
            this.rawSet.jointConfigureMotorPosition(this.handle, this.rawAxis(), t, e, r);
        }
        configureMotor(t, e, r, a) {
            this.rawSet.jointConfigureMotor(this.handle, this.rawAxis(), t, e, r, a);
        }
    };
    yr = class extends X {
    };
    vr = class extends X {
    };
    Sr = class extends X {
    };
    Rr = class extends Se {
        rawAxis() {
            return Ft.LinX;
        }
    };
    Cr = class extends Se {
        rawAxis() {
            return Ft.AngX;
        }
    };
    xr = class extends X {
    };
    jr = class extends X {
    };
    q = class {
        constructor(){}
        static fixed(t, e, r, a) {
            let o = new q;
            return o.anchor1 = t, o.anchor2 = r, o.frame1 = e, o.frame2 = a, o.jointType = N.Fixed, o;
        }
        static spring(t, e, r, a, o) {
            let _ = new q;
            return _.anchor1 = a, _.anchor2 = o, _.length = t, _.stiffness = e, _.damping = r, _.jointType = N.Spring, _;
        }
        static rope(t, e, r) {
            let a = new q;
            return a.anchor1 = e, a.anchor2 = r, a.length = t, a.jointType = N.Rope, a;
        }
        static generic(t, e, r, a) {
            let o = new q;
            return o.anchor1 = t, o.anchor2 = e, o.axis = r, o.axesMask = a, o.jointType = N.Generic, o;
        }
        static spherical(t, e) {
            let r = new q;
            return r.anchor1 = t, r.anchor2 = e, r.jointType = N.Spherical, r;
        }
        static prismatic(t, e, r) {
            let a = new q;
            return a.anchor1 = t, a.anchor2 = e, a.axis = r, a.jointType = N.Prismatic, a;
        }
        static revolute(t, e, r) {
            let a = new q;
            return a.anchor1 = t, a.anchor2 = e, a.axis = r, a.jointType = N.Revolute, a;
        }
        intoRaw() {
            let t = w.intoRaw(this.anchor1), e = w.intoRaw(this.anchor2), r, a, o = !1, _ = 0, d = 0;
            switch(this.jointType){
                case N.Fixed:
                    let h = v.intoRaw(this.frame1), p = v.intoRaw(this.frame2);
                    a = L.fixed(t, h, e, p), h.free(), p.free();
                    break;
                case N.Spring:
                    a = L.spring(this.length, this.stiffness, this.damping, t, e);
                    break;
                case N.Rope:
                    a = L.rope(this.length, t, e);
                    break;
                case N.Prismatic:
                    r = w.intoRaw(this.axis), this.limitsEnabled && (o = !0, _ = this.limits[0], d = this.limits[1]), a = L.prismatic(t, e, r, o, _, d), r.free();
                    break;
                case N.Generic:
                    r = w.intoRaw(this.axis);
                    let u = this.axesMask;
                    a = L.generic(t, e, r, u);
                    break;
                case N.Spherical:
                    a = L.spherical(t, e);
                    break;
                case N.Revolute:
                    r = w.intoRaw(this.axis), a = L.revolute(t, e, r), r.free();
                    break;
            }
            return t.free(), e.free(), a;
        }
    };
    Ir = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0, this.map && this.map.clear(), this.map = void 0;
        }
        constructor(t){
            this.raw = t || new Y, this.map = new Lt, t && t.forEachJointHandle((e)=>{
                this.map.set(e, X.newTyped(t, null, e));
            });
        }
        finalizeDeserialization(t) {
            this.map.forEach((e)=>e.finalizeDeserialization(t));
        }
        createJoint(t, e, r, a, o) {
            const _ = e.intoRaw(), d = this.raw.createJoint(_, r, a, o);
            _.free();
            let h = X.newTyped(this.raw, t, d);
            return this.map.set(d, h), h;
        }
        remove(t, e) {
            this.raw.remove(t, e), this.unmap(t);
        }
        forEachJointHandleAttachedToRigidBody(t, e) {
            this.raw.forEachJointAttachedToRigidBody(t, e);
        }
        unmap(t) {
            this.map.delete(t);
        }
        len() {
            return this.map.len();
        }
        contains(t) {
            return this.get(t) != null;
        }
        get(t) {
            return this.map.get(t);
        }
        forEach(t) {
            this.map.forEach(t);
        }
        getAll() {
            return this.map.getAll();
        }
    };
    et = class {
        constructor(t, e){
            this.rawSet = t, this.handle = e;
        }
        static newTyped(t, e) {
            switch(t.jointType(e)){
                case U.Revolute:
                    return new Pr(t, e);
                case U.Prismatic:
                    return new Ar(t, e);
                case U.Fixed:
                    return new Er(t, e);
                case U.Spherical:
                    return new zr(t, e);
                default:
                    return new et(t, e);
            }
        }
        isValid() {
            return this.rawSet.contains(this.handle);
        }
        setContactsEnabled(t) {
            this.rawSet.jointSetContactsEnabled(this.handle, t);
        }
        contactsEnabled() {
            return this.rawSet.jointContactsEnabled(this.handle);
        }
    };
    Re = class extends et {
    };
    Er = class extends et {
    };
    Ar = class extends Re {
        rawAxis() {
            return Ft.LinX;
        }
    };
    Pr = class extends Re {
        rawAxis() {
            return Ft.AngX;
        }
    };
    zr = class extends et {
    };
    Fr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0, this.map && this.map.clear(), this.map = void 0;
        }
        constructor(t){
            this.raw = t || new $, this.map = new Lt, t && t.forEachJointHandle((e)=>{
                this.map.set(e, et.newTyped(this.raw, e));
            });
        }
        createJoint(t, e, r, a) {
            const o = t.intoRaw(), _ = this.raw.createJoint(o, e, r, a);
            o.free();
            let d = et.newTyped(this.raw, _);
            return this.map.set(_, d), d;
        }
        remove(t, e) {
            this.raw.remove(t, e), this.map.delete(t);
        }
        unmap(t) {
            this.map.delete(t);
        }
        len() {
            return this.map.len();
        }
        contains(t) {
            return this.get(t) != null;
        }
        get(t) {
            return this.map.get(t);
        }
        forEach(t) {
            this.map.forEach(t);
        }
        forEachJointHandleAttachedToRigidBody(t, e) {
            this.raw.forEachJointAttachedToRigidBody(t, e);
        }
        getAll() {
            return this.map.getAll();
        }
    };
    (function(s) {
        s[s.Average = 0] = "Average", s[s.Min = 1] = "Min", s[s.Multiply = 2] = "Multiply", s[s.Max = 3] = "Max";
    })(ht || (ht = {}));
    Tr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        constructor(t){
            this.raw = t || new ie;
        }
    };
    Mr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        constructor(t){
            this.raw = t || new Z;
        }
        forEachActiveRigidBodyHandle(t) {
            this.raw.forEachActiveRigidBodyHandle(t);
        }
    };
    (function(s) {
        s[s.Vertex = 0] = "Vertex", s[s.Edge = 1] = "Edge", s[s.Face = 2] = "Face", s[s.Unknown = 3] = "Unknown";
    })(at || (at = {}));
    Vh = class {
        constructor(t, e){
            this.origin = t, this.dir = e;
        }
        pointAt(t) {
            return {
                x: this.origin.x + this.dir.x * t,
                y: this.origin.y + this.dir.y * t,
                z: this.origin.z + this.dir.z * t
            };
        }
    };
    gt = class {
        constructor(t, e, r, a){
            this.featureType = at.Unknown, this.featureId = void 0, this.timeOfImpact = t, this.normal = e, a !== void 0 && (this.featureId = a), r !== void 0 && (this.featureType = r);
        }
        static fromRaw(t) {
            if (!t) return null;
            const e = new gt(t.time_of_impact(), w.fromRaw(t.normal()), t.featureType(), t.featureId());
            return t.free(), e;
        }
    };
    pt = class {
        constructor(t, e, r, a, o){
            this.featureType = at.Unknown, this.featureId = void 0, this.collider = t, this.timeOfImpact = e, this.normal = r, o !== void 0 && (this.featureId = o), a !== void 0 && (this.featureType = a);
        }
        static fromRaw(t, e) {
            if (!e) return null;
            const r = new pt(t.get(e.colliderHandle()), e.time_of_impact(), w.fromRaw(e.normal()), e.featureType(), e.featureId());
            return e.free(), r;
        }
    };
    Nt = class {
        constructor(t, e){
            this.collider = t, this.timeOfImpact = e;
        }
        static fromRaw(t, e) {
            if (!e) return null;
            const r = new Nt(t.get(e.colliderHandle()), e.timeOfImpact());
            return e.free(), r;
        }
    };
    bt = class {
        constructor(t, e){
            this.point = t, this.isInside = e;
        }
        static fromRaw(t) {
            if (!t) return null;
            const e = new bt(w.fromRaw(t.point()), t.isInside());
            return t.free(), e;
        }
    };
    ut = class {
        constructor(t, e, r, a, o){
            this.featureType = at.Unknown, this.featureId = void 0, this.collider = t, this.point = e, this.isInside = r, o !== void 0 && (this.featureId = o), a !== void 0 && (this.featureType = a);
        }
        static fromRaw(t, e) {
            if (!e) return null;
            const r = new ut(t.get(e.colliderHandle()), w.fromRaw(e.point()), e.isInside(), e.featureType(), e.featureId());
            return e.free(), r;
        }
    };
    ot = class {
        constructor(t, e, r, a, o){
            this.time_of_impact = t, this.witness1 = e, this.witness2 = r, this.normal1 = a, this.normal2 = o;
        }
        static fromRaw(t, e) {
            if (!e) return null;
            const r = new ot(e.time_of_impact(), w.fromRaw(e.witness1()), w.fromRaw(e.witness2()), w.fromRaw(e.normal1()), w.fromRaw(e.normal2()));
            return e.free(), r;
        }
    };
    mt = class extends ot {
        constructor(t, e, r, a, o, _){
            super(e, r, a, o, _), this.collider = t;
        }
        static fromRaw(t, e) {
            if (!e) return null;
            const r = new mt(t.get(e.colliderHandle()), e.time_of_impact(), w.fromRaw(e.witness1()), w.fromRaw(e.witness2()), w.fromRaw(e.normal1()), w.fromRaw(e.normal2()));
            return e.free(), r;
        }
    };
    kr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        constructor(t){
            this.raw = t || new K;
        }
        castRay(t, e, r, a, o, _, d, h, p, u, g) {
            let b = w.intoRaw(a.origin), m = w.intoRaw(a.dir), C = Nt.fromRaw(r, this.raw.castRay(t.raw, e.raw, r.raw, b, m, o, _, d, h, p, u, g));
            return b.free(), m.free(), C;
        }
        castRayAndGetNormal(t, e, r, a, o, _, d, h, p, u, g) {
            let b = w.intoRaw(a.origin), m = w.intoRaw(a.dir), C = pt.fromRaw(r, this.raw.castRayAndGetNormal(t.raw, e.raw, r.raw, b, m, o, _, d, h, p, u, g));
            return b.free(), m.free(), C;
        }
        intersectionsWithRay(t, e, r, a, o, _, d, h, p, u, g, b) {
            let m = w.intoRaw(a.origin), C = w.intoRaw(a.dir), H = (G)=>d(pt.fromRaw(r, G));
            this.raw.intersectionsWithRay(t.raw, e.raw, r.raw, m, C, o, _, H, h, p, u, g, b), m.free(), C.free();
        }
        intersectionWithShape(t, e, r, a, o, _, d, h, p, u, g) {
            let b = w.intoRaw(a), m = v.intoRaw(o), C = _.intoRaw(), H = this.raw.intersectionWithShape(t.raw, e.raw, r.raw, b, m, C, d, h, p, u, g);
            return b.free(), m.free(), C.free(), H;
        }
        projectPoint(t, e, r, a, o, _, d, h, p, u) {
            let g = w.intoRaw(a), b = ut.fromRaw(r, this.raw.projectPoint(t.raw, e.raw, r.raw, g, o, _, d, h, p, u));
            return g.free(), b;
        }
        projectPointAndGetFeature(t, e, r, a, o, _, d, h, p) {
            let u = w.intoRaw(a), g = ut.fromRaw(r, this.raw.projectPointAndGetFeature(t.raw, e.raw, r.raw, u, o, _, d, h, p));
            return u.free(), g;
        }
        intersectionsWithPoint(t, e, r, a, o, _, d, h, p, u) {
            let g = w.intoRaw(a);
            this.raw.intersectionsWithPoint(t.raw, e.raw, r.raw, g, o, _, d, h, p, u), g.free();
        }
        castShape(t, e, r, a, o, _, d, h, p, u, g, b, m, C, H) {
            let G = w.intoRaw(a), B = v.intoRaw(o), O = w.intoRaw(_), Q = d.intoRaw(), _t = mt.fromRaw(r, this.raw.castShape(t.raw, e.raw, r.raw, G, B, O, Q, h, p, u, g, b, m, C, H));
            return G.free(), B.free(), O.free(), Q.free(), _t;
        }
        intersectionsWithShape(t, e, r, a, o, _, d, h, p, u, g, b) {
            let m = w.intoRaw(a), C = v.intoRaw(o), H = _.intoRaw();
            this.raw.intersectionsWithShape(t.raw, e.raw, r.raw, m, C, H, d, h, p, u, g, b), m.free(), C.free(), H.free();
        }
        collidersWithAabbIntersectingAabb(t, e, r, a, o, _) {
            let d = w.intoRaw(a), h = w.intoRaw(o);
            this.raw.collidersWithAabbIntersectingAabb(t.raw, e.raw, r.raw, d, h, _), d.free(), h.free();
        }
    };
    Hr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        constructor(t){
            this.raw = t || new M, this.tempManifold = new Dr(null);
        }
        contactPairsWith(t, e) {
            this.raw.contact_pairs_with(t, e);
        }
        intersectionPairsWith(t, e) {
            this.raw.intersection_pairs_with(t, e);
        }
        contactPair(t, e, r) {
            const a = this.raw.contact_pair(t, e);
            if (a) {
                const o = a.collider1() != t;
                let _;
                for(_ = 0; _ < a.numContactManifolds(); ++_)this.tempManifold.raw = a.contactManifold(_), this.tempManifold.raw && r(this.tempManifold, o), this.tempManifold.free();
                a.free();
            }
        }
        intersectionPair(t, e) {
            return this.raw.intersection_pair(t, e);
        }
    };
    Dr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        constructor(t){
            this.raw = t;
        }
        normal() {
            return w.fromRaw(this.raw.normal());
        }
        localNormal1() {
            return w.fromRaw(this.raw.local_n1());
        }
        localNormal2() {
            return w.fromRaw(this.raw.local_n2());
        }
        subshape1() {
            return this.raw.subshape1();
        }
        subshape2() {
            return this.raw.subshape2();
        }
        numContacts() {
            return this.raw.num_contacts();
        }
        localContactPoint1(t) {
            return w.fromRaw(this.raw.contact_local_p1(t));
        }
        localContactPoint2(t) {
            return w.fromRaw(this.raw.contact_local_p2(t));
        }
        contactDist(t) {
            return this.raw.contact_dist(t);
        }
        contactFid1(t) {
            return this.raw.contact_fid1(t);
        }
        contactFid2(t) {
            return this.raw.contact_fid2(t);
        }
        contactImpulse(t) {
            return this.raw.contact_impulse(t);
        }
        contactTangentImpulseX(t) {
            return this.raw.contact_tangent_impulse_x(t);
        }
        contactTangentImpulseY(t) {
            return this.raw.contact_tangent_impulse_y(t);
        }
        numSolverContacts() {
            return this.raw.num_solver_contacts();
        }
        solverContactPoint(t) {
            return w.fromRaw(this.raw.solver_contact_point(t));
        }
        solverContactDist(t) {
            return this.raw.solver_contact_dist(t);
        }
        solverContactFriction(t) {
            return this.raw.solver_contact_friction(t);
        }
        solverContactRestitution(t) {
            return this.raw.solver_contact_restitution(t);
        }
        solverContactTangentVelocity(t) {
            return w.fromRaw(this.raw.solver_contact_tangent_velocity(t));
        }
    };
    st = class {
        constructor(t, e, r, a, o){
            this.distance = t, this.point1 = e, this.point2 = r, this.normal1 = a, this.normal2 = o;
        }
        static fromRaw(t) {
            if (!t) return null;
            const e = new st(t.distance(), w.fromRaw(t.point1()), w.fromRaw(t.point2()), w.fromRaw(t.normal1()), w.fromRaw(t.normal2()));
            return t.free(), e;
        }
    };
    k = class {
        static fromRaw(t, e) {
            const r = t.coShapeType(e);
            let a, o, _, d, h, p, u;
            switch(r){
                case D.Ball:
                    return new Ce(t.coRadius(e));
                case D.Cuboid:
                    return a = t.coHalfExtents(e), new xe(a.x, a.y, a.z);
                case D.RoundCuboid:
                    return a = t.coHalfExtents(e), o = t.coRoundRadius(e), new je(a.x, a.y, a.z, o);
                case D.Capsule:
                    return h = t.coHalfHeight(e), p = t.coRadius(e), new Ie(h, p);
                case D.Segment:
                    return _ = t.coVertices(e), new Ee(w.new(_[0], _[1], _[2]), w.new(_[3], _[4], _[5]));
                case D.Polyline:
                    return _ = t.coVertices(e), d = t.coIndices(e), new ze(_, d);
                case D.Triangle:
                    return _ = t.coVertices(e), new Ae(w.new(_[0], _[1], _[2]), w.new(_[3], _[4], _[5]), w.new(_[6], _[7], _[8]));
                case D.RoundTriangle:
                    return _ = t.coVertices(e), o = t.coRoundRadius(e), new Pe(w.new(_[0], _[1], _[2]), w.new(_[3], _[4], _[5]), w.new(_[6], _[7], _[8]), o);
                case D.HalfSpace:
                    return u = w.fromRaw(t.coHalfspaceNormal(e)), new Lr(u);
                case D.Voxels:
                    const g = t.coVoxelData(e), b = t.coVoxelSize(e);
                    return new Fe(g, b);
                case D.TriMesh:
                    _ = t.coVertices(e), d = t.coIndices(e);
                    const m = t.coTriMeshFlags(e);
                    return new Te(_, d, m);
                case D.HeightField:
                    const C = t.coHeightfieldScale(e), H = t.coHeightfieldHeights(e), G = t.coHeightfieldNRows(e), B = t.coHeightfieldNCols(e), O = t.coHeightFieldFlags(e);
                    return new Me(G, B, H, C, O);
                case D.ConvexPolyhedron:
                    return _ = t.coVertices(e), d = t.coIndices(e), new jt(_, d);
                case D.RoundConvexPolyhedron:
                    return _ = t.coVertices(e), d = t.coIndices(e), o = t.coRoundRadius(e), new It(_, d, o);
                case D.Cylinder:
                    return h = t.coHalfHeight(e), p = t.coRadius(e), new ke(h, p);
                case D.RoundCylinder:
                    return h = t.coHalfHeight(e), p = t.coRadius(e), o = t.coRoundRadius(e), new He(h, p, o);
                case D.Cone:
                    return h = t.coHalfHeight(e), p = t.coRadius(e), new De(h, p);
                case D.RoundCone:
                    return h = t.coHalfHeight(e), p = t.coRadius(e), o = t.coRoundRadius(e), new Le(h, p, o);
                default:
                    throw new Error("unknown shape type: " + r);
            }
        }
        castShape(t, e, r, a, o, _, d, h, p, u) {
            let g = w.intoRaw(t), b = v.intoRaw(e), m = w.intoRaw(r), C = w.intoRaw(o), H = v.intoRaw(_), G = w.intoRaw(d), B = this.intoRaw(), O = a.intoRaw(), Q = ot.fromRaw(null, B.castShape(g, b, m, O, C, H, G, h, p, u));
            return g.free(), b.free(), m.free(), C.free(), H.free(), G.free(), B.free(), O.free(), Q;
        }
        intersectsShape(t, e, r, a, o) {
            let _ = w.intoRaw(t), d = v.intoRaw(e), h = w.intoRaw(a), p = v.intoRaw(o), u = this.intoRaw(), g = r.intoRaw(), b = u.intersectsShape(_, d, g, h, p);
            return _.free(), d.free(), h.free(), p.free(), u.free(), g.free(), b;
        }
        contactShape(t, e, r, a, o, _) {
            let d = w.intoRaw(t), h = v.intoRaw(e), p = w.intoRaw(a), u = v.intoRaw(o), g = this.intoRaw(), b = r.intoRaw(), m = st.fromRaw(g.contactShape(d, h, b, p, u, _));
            return d.free(), h.free(), p.free(), u.free(), g.free(), b.free(), m;
        }
        containsPoint(t, e, r) {
            let a = w.intoRaw(t), o = v.intoRaw(e), _ = w.intoRaw(r), d = this.intoRaw(), h = d.containsPoint(a, o, _);
            return a.free(), o.free(), _.free(), d.free(), h;
        }
        projectPoint(t, e, r, a) {
            let o = w.intoRaw(t), _ = v.intoRaw(e), d = w.intoRaw(r), h = this.intoRaw(), p = bt.fromRaw(h.projectPoint(o, _, d, a));
            return o.free(), _.free(), d.free(), h.free(), p;
        }
        intersectsRay(t, e, r, a) {
            let o = w.intoRaw(e), _ = v.intoRaw(r), d = w.intoRaw(t.origin), h = w.intoRaw(t.dir), p = this.intoRaw(), u = p.intersectsRay(o, _, d, h, a);
            return o.free(), _.free(), d.free(), h.free(), p.free(), u;
        }
        castRay(t, e, r, a, o) {
            let _ = w.intoRaw(e), d = v.intoRaw(r), h = w.intoRaw(t.origin), p = w.intoRaw(t.dir), u = this.intoRaw(), g = u.castRay(_, d, h, p, a, o);
            return _.free(), d.free(), h.free(), p.free(), u.free(), g;
        }
        castRayAndGetNormal(t, e, r, a, o) {
            let _ = w.intoRaw(e), d = v.intoRaw(r), h = w.intoRaw(t.origin), p = w.intoRaw(t.dir), u = this.intoRaw(), g = gt.fromRaw(u.castRayAndGetNormal(_, d, h, p, a, o));
            return _.free(), d.free(), h.free(), p.free(), u.free(), g;
        }
    };
    (function(s) {
        s[s.Ball = 0] = "Ball", s[s.Cuboid = 1] = "Cuboid", s[s.Capsule = 2] = "Capsule", s[s.Segment = 3] = "Segment", s[s.Polyline = 4] = "Polyline", s[s.Triangle = 5] = "Triangle", s[s.TriMesh = 6] = "TriMesh", s[s.HeightField = 7] = "HeightField", s[s.ConvexPolyhedron = 9] = "ConvexPolyhedron", s[s.Cylinder = 10] = "Cylinder", s[s.Cone = 11] = "Cone", s[s.RoundCuboid = 12] = "RoundCuboid", s[s.RoundTriangle = 13] = "RoundTriangle", s[s.RoundCylinder = 14] = "RoundCylinder", s[s.RoundCone = 15] = "RoundCone", s[s.RoundConvexPolyhedron = 16] = "RoundConvexPolyhedron", s[s.HalfSpace = 17] = "HalfSpace", s[s.Voxels = 18] = "Voxels";
    })(F || (F = {}));
    (function(s) {
        s[s.FIX_INTERNAL_EDGES = 1] = "FIX_INTERNAL_EDGES";
    })(ce || (ce = {}));
    (function(s) {
        s[s.DELETE_BAD_TOPOLOGY_TRIANGLES = 4] = "DELETE_BAD_TOPOLOGY_TRIANGLES", s[s.ORIENTED = 8] = "ORIENTED", s[s.MERGE_DUPLICATE_VERTICES = 16] = "MERGE_DUPLICATE_VERTICES", s[s.DELETE_DEGENERATE_TRIANGLES = 32] = "DELETE_DEGENERATE_TRIANGLES", s[s.DELETE_DUPLICATE_TRIANGLES = 64] = "DELETE_DUPLICATE_TRIANGLES", s[s.FIX_INTERNAL_EDGES = 144] = "FIX_INTERNAL_EDGES";
    })(le || (le = {}));
    Ce = class extends k {
        constructor(t){
            super(), this.type = F.Ball, this.radius = t;
        }
        intoRaw() {
            return f.ball(this.radius);
        }
    };
    Lr = class extends k {
        constructor(t){
            super(), this.type = F.HalfSpace, this.normal = t;
        }
        intoRaw() {
            let t = w.intoRaw(this.normal), e = f.halfspace(t);
            return t.free(), e;
        }
    };
    xe = class extends k {
        constructor(t, e, r){
            super(), this.type = F.Cuboid, this.halfExtents = w.new(t, e, r);
        }
        intoRaw() {
            return f.cuboid(this.halfExtents.x, this.halfExtents.y, this.halfExtents.z);
        }
    };
    je = class extends k {
        constructor(t, e, r, a){
            super(), this.type = F.RoundCuboid, this.halfExtents = w.new(t, e, r), this.borderRadius = a;
        }
        intoRaw() {
            return f.roundCuboid(this.halfExtents.x, this.halfExtents.y, this.halfExtents.z, this.borderRadius);
        }
    };
    Ie = class extends k {
        constructor(t, e){
            super(), this.type = F.Capsule, this.halfHeight = t, this.radius = e;
        }
        intoRaw() {
            return f.capsule(this.halfHeight, this.radius);
        }
    };
    Ee = class extends k {
        constructor(t, e){
            super(), this.type = F.Segment, this.a = t, this.b = e;
        }
        intoRaw() {
            let t = w.intoRaw(this.a), e = w.intoRaw(this.b), r = f.segment(t, e);
            return t.free(), e.free(), r;
        }
    };
    Ae = class extends k {
        constructor(t, e, r){
            super(), this.type = F.Triangle, this.a = t, this.b = e, this.c = r;
        }
        intoRaw() {
            let t = w.intoRaw(this.a), e = w.intoRaw(this.b), r = w.intoRaw(this.c), a = f.triangle(t, e, r);
            return t.free(), e.free(), r.free(), a;
        }
    };
    Pe = class extends k {
        constructor(t, e, r, a){
            super(), this.type = F.RoundTriangle, this.a = t, this.b = e, this.c = r, this.borderRadius = a;
        }
        intoRaw() {
            let t = w.intoRaw(this.a), e = w.intoRaw(this.b), r = w.intoRaw(this.c), a = f.roundTriangle(t, e, r, this.borderRadius);
            return t.free(), e.free(), r.free(), a;
        }
    };
    ze = class extends k {
        constructor(t, e){
            super(), this.type = F.Polyline, this.vertices = t, this.indices = e ?? new Uint32Array(0);
        }
        intoRaw() {
            return f.polyline(this.vertices, this.indices);
        }
    };
    Fe = class extends k {
        constructor(t, e){
            super(), this.type = F.Voxels, this.data = t, this.voxelSize = e;
        }
        intoRaw() {
            let t = w.intoRaw(this.voxelSize), e;
            return this.data instanceof Int32Array ? e = f.voxels(t, this.data) : e = f.voxelsFromPoints(t, this.data), t.free(), e;
        }
    };
    Te = class extends k {
        constructor(t, e, r){
            super(), this.type = F.TriMesh, this.vertices = t, this.indices = e, this.flags = r;
        }
        intoRaw() {
            return f.trimesh(this.vertices, this.indices, this.flags);
        }
    };
    jt = class extends k {
        constructor(t, e){
            super(), this.type = F.ConvexPolyhedron, this.vertices = t, this.indices = e;
        }
        intoRaw() {
            return this.indices ? f.convexMesh(this.vertices, this.indices) : f.convexHull(this.vertices);
        }
    };
    It = class extends k {
        constructor(t, e, r){
            super(), this.type = F.RoundConvexPolyhedron, this.vertices = t, this.indices = e, this.borderRadius = r;
        }
        intoRaw() {
            return this.indices ? f.roundConvexMesh(this.vertices, this.indices, this.borderRadius) : f.roundConvexHull(this.vertices, this.borderRadius);
        }
    };
    Me = class extends k {
        constructor(t, e, r, a, o){
            super(), this.type = F.HeightField, this.nrows = t, this.ncols = e, this.heights = r, this.scale = a, this.flags = o;
        }
        intoRaw() {
            let t = w.intoRaw(this.scale), e = f.heightfield(this.nrows, this.ncols, this.heights, t, this.flags);
            return t.free(), e;
        }
    };
    ke = class extends k {
        constructor(t, e){
            super(), this.type = F.Cylinder, this.halfHeight = t, this.radius = e;
        }
        intoRaw() {
            return f.cylinder(this.halfHeight, this.radius);
        }
    };
    He = class extends k {
        constructor(t, e, r){
            super(), this.type = F.RoundCylinder, this.borderRadius = r, this.halfHeight = t, this.radius = e;
        }
        intoRaw() {
            return f.roundCylinder(this.halfHeight, this.radius, this.borderRadius);
        }
    };
    De = class extends k {
        constructor(t, e){
            super(), this.type = F.Cone, this.halfHeight = t, this.radius = e;
        }
        intoRaw() {
            return f.cone(this.halfHeight, this.radius);
        }
    };
    Le = class extends k {
        constructor(t, e, r){
            super(), this.type = F.RoundCone, this.halfHeight = t, this.radius = e, this.borderRadius = r;
        }
        intoRaw() {
            return f.roundCone(this.halfHeight, this.radius, this.borderRadius);
        }
    };
    Nr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        constructor(t){
            this.raw = t || new _i;
        }
        step(t, e, r, a, o, _, d, h, p, u, g, b) {
            let m = w.intoRaw(t);
            g ? this.raw.stepWithEvents(m, e.raw, r.raw, a.raw, o.raw, _.raw, d.raw, h.raw, p.raw, u.raw, g.raw, b, b ? b.filterContactPair : null, b ? b.filterIntersectionPair : null) : this.raw.step(m, e.raw, r.raw, a.raw, o.raw, _.raw, d.raw, h.raw, p.raw, u.raw), m.free();
        }
    };
    we = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        constructor(t){
            this.raw = t || new li;
        }
        serializeAll(t, e, r, a, o, _, d, h, p) {
            let u = w.intoRaw(t);
            const g = this.raw.serializeAll(u, e.raw, r.raw, a.raw, o.raw, _.raw, d.raw, h.raw, p.raw);
            return u.free(), g;
        }
        deserializeAll(t) {
            return Gt.fromRaw(this.raw.deserializeAll(t));
        }
    };
    Gr = class {
        constructor(t, e){
            this.vertices = t, this.colors = e;
        }
    };
    Wr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0, this.vertices = void 0, this.colors = void 0;
        }
        constructor(t){
            this.raw = t || new ai;
        }
        render(t, e, r, a, o, _, d) {
            this.raw.render(t.raw, e.raw, r.raw, a.raw, o.raw, _, e.castClosure(d)), this.vertices = this.raw.vertices(), this.colors = this.raw.colors();
        }
    };
    Br = class {
    };
    Or = class {
        constructor(t, e, r, a, o, _){
            this.params = e, this.bodies = o, this.colliders = _, this.broadPhase = r, this.narrowPhase = a, this.raw = new oi(t), this.rawCharacterCollision = new pr, this._applyImpulsesToDynamicBodies = !1, this._characterMass = null;
        }
        free() {
            this.raw && (this.raw.free(), this.rawCharacterCollision.free()), this.raw = void 0, this.rawCharacterCollision = void 0;
        }
        up() {
            return this.raw.up();
        }
        setUp(t) {
            let e = w.intoRaw(t);
            return this.raw.setUp(e);
        }
        applyImpulsesToDynamicBodies() {
            return this._applyImpulsesToDynamicBodies;
        }
        setApplyImpulsesToDynamicBodies(t) {
            this._applyImpulsesToDynamicBodies = t;
        }
        characterMass() {
            return this._characterMass;
        }
        setCharacterMass(t) {
            this._characterMass = t;
        }
        offset() {
            return this.raw.offset();
        }
        setOffset(t) {
            this.raw.setOffset(t);
        }
        normalNudgeFactor() {
            return this.raw.normalNudgeFactor();
        }
        setNormalNudgeFactor(t) {
            this.raw.setNormalNudgeFactor(t);
        }
        slideEnabled() {
            return this.raw.slideEnabled();
        }
        setSlideEnabled(t) {
            this.raw.setSlideEnabled(t);
        }
        autostepMaxHeight() {
            return this.raw.autostepMaxHeight();
        }
        autostepMinWidth() {
            return this.raw.autostepMinWidth();
        }
        autostepIncludesDynamicBodies() {
            return this.raw.autostepIncludesDynamicBodies();
        }
        autostepEnabled() {
            return this.raw.autostepEnabled();
        }
        enableAutostep(t, e, r) {
            this.raw.enableAutostep(t, e, r);
        }
        disableAutostep() {
            return this.raw.disableAutostep();
        }
        maxSlopeClimbAngle() {
            return this.raw.maxSlopeClimbAngle();
        }
        setMaxSlopeClimbAngle(t) {
            this.raw.setMaxSlopeClimbAngle(t);
        }
        minSlopeSlideAngle() {
            return this.raw.minSlopeSlideAngle();
        }
        setMinSlopeSlideAngle(t) {
            this.raw.setMinSlopeSlideAngle(t);
        }
        snapToGroundDistance() {
            return this.raw.snapToGroundDistance();
        }
        enableSnapToGround(t) {
            this.raw.enableSnapToGround(t);
        }
        disableSnapToGround() {
            this.raw.disableSnapToGround();
        }
        snapToGroundEnabled() {
            return this.raw.snapToGroundEnabled();
        }
        computeColliderMovement(t, e, r, a, o) {
            let _ = w.intoRaw(e);
            this.raw.computeColliderMovement(this.params.dt, this.broadPhase.raw, this.narrowPhase.raw, this.bodies.raw, this.colliders.raw, t.handle, _, this._applyImpulsesToDynamicBodies, this._characterMass, r, a, this.colliders.castClosure(o)), _.free();
        }
        computedMovement() {
            return w.fromRaw(this.raw.computedMovement());
        }
        computedGrounded() {
            return this.raw.computedGrounded();
        }
        numComputedCollisions() {
            return this.raw.numComputedCollisions();
        }
        computedCollision(t, e) {
            if (this.raw.computedCollision(t, this.rawCharacterCollision)) {
                let r = this.rawCharacterCollision;
                return e = e ?? new Br, e.translationDeltaApplied = w.fromRaw(r.translationDeltaApplied()), e.translationDeltaRemaining = w.fromRaw(r.translationDeltaRemaining()), e.toi = r.toi(), e.witness1 = w.fromRaw(r.worldWitness1()), e.witness2 = w.fromRaw(r.worldWitness2()), e.normal1 = w.fromRaw(r.worldNormal1()), e.normal2 = w.fromRaw(r.worldNormal2()), e.collider = this.colliders.get(r.handle()), e;
            } else return null;
        }
    };
    (function(s) {
        s[s.None = 0] = "None", s[s.LinX = 1] = "LinX", s[s.LinY = 2] = "LinY", s[s.LinZ = 4] = "LinZ", s[s.AngX = 8] = "AngX", s[s.AngY = 16] = "AngY", s[s.AngZ = 32] = "AngZ", s[s.AllLin = 7] = "AllLin", s[s.AllAng = 56] = "AllAng", s[s.All = 63] = "All";
    })(de || (de = {}));
    Vr = class {
        constructor(t, e, r, a, o, _){
            this.params = t, this.bodies = e, this.raw = new ci(r, a, o, _);
        }
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        setKp(t, e) {
            this.raw.set_kp(t, e);
        }
        setKi(t, e) {
            this.raw.set_kp(t, e);
        }
        setKd(t, e) {
            this.raw.set_kp(t, e);
        }
        setAxes(t) {
            this.raw.set_axes_mask(t);
        }
        resetIntegrals() {
            this.raw.reset_integrals();
        }
        applyLinearCorrection(t, e, r) {
            let a = w.intoRaw(e), o = w.intoRaw(r);
            this.raw.apply_linear_correction(this.params.dt, this.bodies.raw, t.handle, a, o), a.free(), o.free();
        }
        applyAngularCorrection(t, e, r) {
            let a = v.intoRaw(e), o = w.intoRaw(r);
            this.raw.apply_angular_correction(this.params.dt, this.bodies.raw, t.handle, a, o), a.free(), o.free();
        }
        linearCorrection(t, e, r) {
            let a = w.intoRaw(e), o = w.intoRaw(r), _ = this.raw.linear_correction(this.params.dt, this.bodies.raw, t.handle, a, o);
            return a.free(), o.free(), w.fromRaw(_);
        }
        angularCorrection(t, e, r) {
            let a = v.intoRaw(e), o = w.intoRaw(r), _ = this.raw.angular_correction(this.params.dt, this.bodies.raw, t.handle, a, o);
            return a.free(), o.free(), w.fromRaw(_);
        }
    };
    Ur = class {
        constructor(t, e, r, a, o){
            this.raw = new si(t.handle), this.broadPhase = e, this.narrowPhase = r, this.bodies = a, this.colliders = o, this._chassis = t;
        }
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        updateVehicle(t, e, r, a) {
            this.raw.update_vehicle(t, this.broadPhase.raw, this.narrowPhase.raw, this.bodies.raw, this.colliders.raw, e, r, this.colliders.castClosure(a));
        }
        currentVehicleSpeed() {
            return this.raw.current_vehicle_speed();
        }
        chassis() {
            return this._chassis;
        }
        get indexUpAxis() {
            return this.raw.index_up_axis();
        }
        set indexUpAxis(t) {
            this.raw.set_index_up_axis(t);
        }
        get indexForwardAxis() {
            return this.raw.index_forward_axis();
        }
        set setIndexForwardAxis(t) {
            this.raw.set_index_forward_axis(t);
        }
        addWheel(t, e, r, a, o) {
            let _ = w.intoRaw(t), d = w.intoRaw(e), h = w.intoRaw(r);
            this.raw.add_wheel(_, d, h, a, o), _.free(), d.free(), h.free();
        }
        numWheels() {
            return this.raw.num_wheels();
        }
        wheelChassisConnectionPointCs(t) {
            return w.fromRaw(this.raw.wheel_chassis_connection_point_cs(t));
        }
        setWheelChassisConnectionPointCs(t, e) {
            let r = w.intoRaw(e);
            this.raw.set_wheel_chassis_connection_point_cs(t, r), r.free();
        }
        wheelSuspensionRestLength(t) {
            return this.raw.wheel_suspension_rest_length(t);
        }
        setWheelSuspensionRestLength(t, e) {
            this.raw.set_wheel_suspension_rest_length(t, e);
        }
        wheelMaxSuspensionTravel(t) {
            return this.raw.wheel_max_suspension_travel(t);
        }
        setWheelMaxSuspensionTravel(t, e) {
            this.raw.set_wheel_max_suspension_travel(t, e);
        }
        wheelRadius(t) {
            return this.raw.wheel_radius(t);
        }
        setWheelRadius(t, e) {
            this.raw.set_wheel_radius(t, e);
        }
        wheelSuspensionStiffness(t) {
            return this.raw.wheel_suspension_stiffness(t);
        }
        setWheelSuspensionStiffness(t, e) {
            this.raw.set_wheel_suspension_stiffness(t, e);
        }
        wheelSuspensionCompression(t) {
            return this.raw.wheel_suspension_compression(t);
        }
        setWheelSuspensionCompression(t, e) {
            this.raw.set_wheel_suspension_compression(t, e);
        }
        wheelSuspensionRelaxation(t) {
            return this.raw.wheel_suspension_relaxation(t);
        }
        setWheelSuspensionRelaxation(t, e) {
            this.raw.set_wheel_suspension_relaxation(t, e);
        }
        wheelMaxSuspensionForce(t) {
            return this.raw.wheel_max_suspension_force(t);
        }
        setWheelMaxSuspensionForce(t, e) {
            this.raw.set_wheel_max_suspension_force(t, e);
        }
        wheelBrake(t) {
            return this.raw.wheel_brake(t);
        }
        setWheelBrake(t, e) {
            this.raw.set_wheel_brake(t, e);
        }
        wheelSteering(t) {
            return this.raw.wheel_steering(t);
        }
        setWheelSteering(t, e) {
            this.raw.set_wheel_steering(t, e);
        }
        wheelEngineForce(t) {
            return this.raw.wheel_engine_force(t);
        }
        setWheelEngineForce(t, e) {
            this.raw.set_wheel_engine_force(t, e);
        }
        wheelDirectionCs(t) {
            return w.fromRaw(this.raw.wheel_direction_cs(t));
        }
        setWheelDirectionCs(t, e) {
            let r = w.intoRaw(e);
            this.raw.set_wheel_direction_cs(t, r), r.free();
        }
        wheelAxleCs(t) {
            return w.fromRaw(this.raw.wheel_axle_cs(t));
        }
        setWheelAxleCs(t, e) {
            let r = w.intoRaw(e);
            this.raw.set_wheel_axle_cs(t, r), r.free();
        }
        wheelFrictionSlip(t) {
            return this.raw.wheel_friction_slip(t);
        }
        setWheelFrictionSlip(t, e) {
            this.raw.set_wheel_friction_slip(t, e);
        }
        wheelSideFrictionStiffness(t) {
            return this.raw.wheel_side_friction_stiffness(t);
        }
        setWheelSideFrictionStiffness(t, e) {
            this.raw.set_wheel_side_friction_stiffness(t, e);
        }
        wheelRotation(t) {
            return this.raw.wheel_rotation(t);
        }
        wheelForwardImpulse(t) {
            return this.raw.wheel_forward_impulse(t);
        }
        wheelSideImpulse(t) {
            return this.raw.wheel_side_impulse(t);
        }
        wheelSuspensionForce(t) {
            return this.raw.wheel_suspension_force(t);
        }
        wheelContactNormal(t) {
            return w.fromRaw(this.raw.wheel_contact_normal_ws(t));
        }
        wheelContactPoint(t) {
            return w.fromRaw(this.raw.wheel_contact_point_ws(t));
        }
        wheelSuspensionLength(t) {
            return this.raw.wheel_suspension_length(t);
        }
        wheelHardPoint(t) {
            return w.fromRaw(this.raw.wheel_hard_point_ws(t));
        }
        wheelIsInContact(t) {
            return this.raw.wheel_is_in_contact(t);
        }
        wheelGroundObject(t) {
            return this.colliders.get(this.raw.wheel_ground_object(t));
        }
    };
    Gt = class {
        free() {
            this.integrationParameters.free(), this.islands.free(), this.broadPhase.free(), this.narrowPhase.free(), this.bodies.free(), this.colliders.free(), this.impulseJoints.free(), this.multibodyJoints.free(), this.ccdSolver.free(), this.physicsPipeline.free(), this.serializationPipeline.free(), this.debugRenderPipeline.free(), this.characterControllers.forEach((t)=>t.free()), this.pidControllers.forEach((t)=>t.free()), this.vehicleControllers.forEach((t)=>t.free()), this.integrationParameters = void 0, this.islands = void 0, this.broadPhase = void 0, this.narrowPhase = void 0, this.bodies = void 0, this.colliders = void 0, this.ccdSolver = void 0, this.impulseJoints = void 0, this.multibodyJoints = void 0, this.physicsPipeline = void 0, this.serializationPipeline = void 0, this.debugRenderPipeline = void 0, this.characterControllers = void 0, this.pidControllers = void 0, this.vehicleControllers = void 0;
        }
        constructor(t, e, r, a, o, _, d, h, p, u, g, b, m){
            this.gravity = t, this.integrationParameters = new fr(e), this.islands = new Mr(r), this.broadPhase = new kr(a), this.narrowPhase = new Hr(o), this.bodies = new mr(_), this.colliders = new Jr(d), this.impulseJoints = new Ir(h), this.multibodyJoints = new Fr(p), this.ccdSolver = new Tr(u), this.physicsPipeline = new Nr(g), this.serializationPipeline = new we(b), this.debugRenderPipeline = new Wr(m), this.characterControllers = new Set, this.pidControllers = new Set, this.vehicleControllers = new Set, this.impulseJoints.finalizeDeserialization(this.bodies), this.bodies.finalizeDeserialization(this.colliders), this.colliders.finalizeDeserialization(this.bodies);
        }
        static fromRaw(t) {
            return t ? new Gt(w.fromRaw(t.takeGravity()), t.takeIntegrationParameters(), t.takeIslandManager(), t.takeBroadPhase(), t.takeNarrowPhase(), t.takeBodies(), t.takeColliders(), t.takeImpulseJoints(), t.takeMultibodyJoints()) : null;
        }
        takeSnapshot() {
            return this.serializationPipeline.serializeAll(this.gravity, this.integrationParameters, this.islands, this.broadPhase, this.narrowPhase, this.bodies, this.colliders, this.impulseJoints, this.multibodyJoints);
        }
        static restoreSnapshot(t) {
            return new we().deserializeAll(t);
        }
        debugRender(t, e) {
            return this.debugRenderPipeline.render(this.bodies, this.colliders, this.impulseJoints, this.multibodyJoints, this.narrowPhase, t, e), new Gr(this.debugRenderPipeline.vertices, this.debugRenderPipeline.colors);
        }
        step(t, e) {
            this.physicsPipeline.step(this.gravity, this.integrationParameters, this.islands, this.broadPhase, this.narrowPhase, this.bodies, this.colliders, this.impulseJoints, this.multibodyJoints, this.ccdSolver, t, e);
        }
        propagateModifiedBodyPositionsToColliders() {
            this.bodies.raw.propagateModifiedBodyPositionsToColliders(this.colliders.raw);
        }
        get timestep() {
            return this.integrationParameters.dt;
        }
        set timestep(t) {
            this.integrationParameters.dt = t;
        }
        get lengthUnit() {
            return this.integrationParameters.lengthUnit;
        }
        set lengthUnit(t) {
            this.integrationParameters.lengthUnit = t;
        }
        get numSolverIterations() {
            return this.integrationParameters.numSolverIterations;
        }
        set numSolverIterations(t) {
            this.integrationParameters.numSolverIterations = t;
        }
        get numInternalPgsIterations() {
            return this.integrationParameters.numInternalPgsIterations;
        }
        set numInternalPgsIterations(t) {
            this.integrationParameters.numInternalPgsIterations = t;
        }
        get maxCcdSubsteps() {
            return this.integrationParameters.maxCcdSubsteps;
        }
        set maxCcdSubsteps(t) {
            this.integrationParameters.maxCcdSubsteps = t;
        }
        createRigidBody(t) {
            return this.bodies.createRigidBody(this.colliders, t);
        }
        createCharacterController(t) {
            let e = new Or(t, this.integrationParameters, this.broadPhase, this.narrowPhase, this.bodies, this.colliders);
            return this.characterControllers.add(e), e;
        }
        removeCharacterController(t) {
            this.characterControllers.delete(t), t.free();
        }
        createPidController(t, e, r, a) {
            let o = new Vr(this.integrationParameters, this.bodies, t, e, r, a);
            return this.pidControllers.add(o), o;
        }
        removePidController(t) {
            this.pidControllers.delete(t), t.free();
        }
        createVehicleController(t) {
            let e = new Ur(t, this.broadPhase, this.narrowPhase, this.bodies, this.colliders);
            return this.vehicleControllers.add(e), e;
        }
        removeVehicleController(t) {
            this.vehicleControllers.delete(t), t.free();
        }
        createCollider(t, e) {
            let r = e ? e.handle : void 0;
            return this.colliders.createCollider(this.bodies, t, r);
        }
        createImpulseJoint(t, e, r, a) {
            return this.impulseJoints.createJoint(this.bodies, t, e.handle, r.handle, a);
        }
        createMultibodyJoint(t, e, r, a) {
            return this.multibodyJoints.createJoint(t, e.handle, r.handle, a);
        }
        getRigidBody(t) {
            return this.bodies.get(t);
        }
        getCollider(t) {
            return this.colliders.get(t);
        }
        getImpulseJoint(t) {
            return this.impulseJoints.get(t);
        }
        getMultibodyJoint(t) {
            return this.multibodyJoints.get(t);
        }
        removeRigidBody(t) {
            this.bodies && this.bodies.remove(t.handle, this.islands, this.colliders, this.impulseJoints, this.multibodyJoints);
        }
        removeCollider(t, e) {
            this.colliders && this.colliders.remove(t.handle, this.islands, this.bodies, e);
        }
        removeImpulseJoint(t, e) {
            this.impulseJoints && this.impulseJoints.remove(t.handle, e);
        }
        removeMultibodyJoint(t, e) {
            this.impulseJoints && this.multibodyJoints.remove(t.handle, e);
        }
        forEachCollider(t) {
            this.colliders.forEach(t);
        }
        forEachRigidBody(t) {
            this.bodies.forEach(t);
        }
        forEachActiveRigidBody(t) {
            this.bodies.forEachActiveRigidBody(this.islands, t);
        }
        castRay(t, e, r, a, o, _, d, h) {
            return this.broadPhase.castRay(this.narrowPhase, this.bodies, this.colliders, t, e, r, a, o, _ ? _.handle : null, d ? d.handle : null, this.colliders.castClosure(h));
        }
        castRayAndGetNormal(t, e, r, a, o, _, d, h) {
            return this.broadPhase.castRayAndGetNormal(this.narrowPhase, this.bodies, this.colliders, t, e, r, a, o, _ ? _.handle : null, d ? d.handle : null, this.colliders.castClosure(h));
        }
        intersectionsWithRay(t, e, r, a, o, _, d, h, p) {
            this.broadPhase.intersectionsWithRay(this.narrowPhase, this.bodies, this.colliders, t, e, r, a, o, _, d ? d.handle : null, h ? h.handle : null, this.colliders.castClosure(p));
        }
        intersectionWithShape(t, e, r, a, o, _, d, h) {
            let p = this.broadPhase.intersectionWithShape(this.narrowPhase, this.bodies, this.colliders, t, e, r, a, o, _ ? _.handle : null, d ? d.handle : null, this.colliders.castClosure(h));
            return p != null ? this.colliders.get(p) : null;
        }
        projectPoint(t, e, r, a, o, _, d) {
            return this.broadPhase.projectPoint(this.narrowPhase, this.bodies, this.colliders, t, e, r, a, o ? o.handle : null, _ ? _.handle : null, this.colliders.castClosure(d));
        }
        projectPointAndGetFeature(t, e, r, a, o, _) {
            return this.broadPhase.projectPointAndGetFeature(this.narrowPhase, this.bodies, this.colliders, t, e, r, a ? a.handle : null, o ? o.handle : null, this.colliders.castClosure(_));
        }
        intersectionsWithPoint(t, e, r, a, o, _, d) {
            this.broadPhase.intersectionsWithPoint(this.narrowPhase, this.bodies, this.colliders, t, this.colliders.castClosure(e), r, a, o ? o.handle : null, _ ? _.handle : null, this.colliders.castClosure(d));
        }
        castShape(t, e, r, a, o, _, d, h, p, u, g, b) {
            return this.broadPhase.castShape(this.narrowPhase, this.bodies, this.colliders, t, e, r, a, o, _, d, h, p, u ? u.handle : null, g ? g.handle : null, this.colliders.castClosure(b));
        }
        intersectionsWithShape(t, e, r, a, o, _, d, h, p) {
            this.broadPhase.intersectionsWithShape(this.narrowPhase, this.bodies, this.colliders, t, e, r, this.colliders.castClosure(a), o, _, d ? d.handle : null, h ? h.handle : null, this.colliders.castClosure(p));
        }
        collidersWithAabbIntersectingAabb(t, e, r) {
            this.broadPhase.collidersWithAabbIntersectingAabb(this.narrowPhase, this.bodies, this.colliders, t, e, this.colliders.castClosure(r));
        }
        contactPairsWith(t, e) {
            this.narrowPhase.contactPairsWith(t.handle, this.colliders.castClosure(e));
        }
        intersectionPairsWith(t, e) {
            this.narrowPhase.intersectionPairsWith(t.handle, this.colliders.castClosure(e));
        }
        contactPair(t, e, r) {
            this.narrowPhase.contactPair(t.handle, e.handle, r);
        }
        intersectionPair(t, e) {
            return this.narrowPhase.intersectionPair(t.handle, e.handle);
        }
        set profilerEnabled(t) {
            this.physicsPipeline.raw.set_profiler_enabled(t);
        }
        get profilerEnabled() {
            return this.physicsPipeline.raw.is_profiler_enabled();
        }
        timingStep() {
            return this.physicsPipeline.raw.timing_step();
        }
        timingCollisionDetection() {
            return this.physicsPipeline.raw.timing_collision_detection();
        }
        timingBroadPhase() {
            return this.physicsPipeline.raw.timing_broad_phase();
        }
        timingNarrowPhase() {
            return this.physicsPipeline.raw.timing_narrow_phase();
        }
        timingSolver() {
            return this.physicsPipeline.raw.timing_solver();
        }
        timingVelocityAssembly() {
            return this.physicsPipeline.raw.timing_velocity_assembly();
        }
        timingVelocityResolution() {
            return this.physicsPipeline.raw.timing_velocity_resolution();
        }
        timingVelocityUpdate() {
            return this.physicsPipeline.raw.timing_velocity_update();
        }
        timingVelocityWriteback() {
            return this.physicsPipeline.raw.timing_velocity_writeback();
        }
        timingCcd() {
            return this.physicsPipeline.raw.timing_ccd();
        }
        timingCcdToiComputation() {
            return this.physicsPipeline.raw.timing_ccd_toi_computation();
        }
        timingCcdBroadPhase() {
            return this.physicsPipeline.raw.timing_ccd_broad_phase();
        }
        timingCcdNarrowPhase() {
            return this.physicsPipeline.raw.timing_ccd_narrow_phase();
        }
        timingCcdSolver() {
            return this.physicsPipeline.raw.timing_ccd_solver();
        }
        timingIslandConstruction() {
            return this.physicsPipeline.raw.timing_island_construction();
        }
        timingUserChanges() {
            return this.physicsPipeline.raw.timing_user_changes();
        }
    };
    (function(s) {
        s[s.NONE = 0] = "NONE", s[s.COLLISION_EVENTS = 1] = "COLLISION_EVENTS", s[s.CONTACT_FORCE_EVENTS = 2] = "CONTACT_FORCE_EVENTS";
    })(Et || (Et = {}));
    Xr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        collider1() {
            return this.raw.collider1();
        }
        collider2() {
            return this.raw.collider2();
        }
        totalForce() {
            return w.fromRaw(this.raw.total_force());
        }
        totalForceMagnitude() {
            return this.raw.total_force_magnitude();
        }
        maxForceDirection() {
            return w.fromRaw(this.raw.max_force_direction());
        }
        maxForceMagnitude() {
            return this.raw.max_force_magnitude();
        }
    };
    Uh = class {
        constructor(t, e){
            this.raw = e || new ur(t);
        }
        free() {
            this.raw && this.raw.free(), this.raw = void 0;
        }
        drainCollisionEvents(t) {
            this.raw.drainCollisionEvents(t);
        }
        drainContactForceEvents(t) {
            let e = new Xr;
            this.raw.drainContactForceEvents((r)=>{
                e.raw = r, t(e), e.free();
            });
        }
        clear() {
            this.raw.clear();
        }
    };
    (function(s) {
        s[s.NONE = 0] = "NONE", s[s.FILTER_CONTACT_PAIRS = 1] = "FILTER_CONTACT_PAIRS", s[s.FILTER_INTERSECTION_PAIRS = 2] = "FILTER_INTERSECTION_PAIRS";
    })(At || (At = {}));
    (function(s) {
        s[s.EMPTY = 0] = "EMPTY", s[s.COMPUTE_IMPULSE = 1] = "COMPUTE_IMPULSE";
    })(he || (he = {}));
    (function(s) {
        s[s.EXCLUDE_FIXED = 1] = "EXCLUDE_FIXED", s[s.EXCLUDE_KINEMATIC = 2] = "EXCLUDE_KINEMATIC", s[s.EXCLUDE_DYNAMIC = 4] = "EXCLUDE_DYNAMIC", s[s.EXCLUDE_SENSORS = 8] = "EXCLUDE_SENSORS", s[s.EXCLUDE_SOLIDS = 16] = "EXCLUDE_SOLIDS", s[s.ONLY_DYNAMIC = 3] = "ONLY_DYNAMIC", s[s.ONLY_KINEMATIC = 5] = "ONLY_KINEMATIC", s[s.ONLY_FIXED = 6] = "ONLY_FIXED";
    })(pe || (pe = {}));
    (function(s) {
        s[s.DYNAMIC_DYNAMIC = 1] = "DYNAMIC_DYNAMIC", s[s.DYNAMIC_KINEMATIC = 12] = "DYNAMIC_KINEMATIC", s[s.DYNAMIC_FIXED = 2] = "DYNAMIC_FIXED", s[s.KINEMATIC_KINEMATIC = 52224] = "KINEMATIC_KINEMATIC", s[s.KINEMATIC_FIXED = 8704] = "KINEMATIC_FIXED", s[s.FIXED_FIXED = 32] = "FIXED_FIXED", s[s.DEFAULT = 15] = "DEFAULT", s[s.ALL = 60943] = "ALL";
    })(Pt || (Pt = {}));
    ue = class {
        constructor(t, e, r, a){
            this.colliderSet = t, this.handle = e, this._parent = r, this._shape = a;
        }
        finalizeDeserialization(t) {
            this.handle != null && (this._parent = t.get(this.colliderSet.raw.coParent(this.handle)));
        }
        ensureShapeIsCached() {
            this._shape || (this._shape = k.fromRaw(this.colliderSet.raw, this.handle));
        }
        get shape() {
            return this.ensureShapeIsCached(), this._shape;
        }
        clearShapeCache() {
            this._shape = null;
        }
        isValid() {
            return this.colliderSet.raw.contains(this.handle);
        }
        translation() {
            return w.fromRaw(this.colliderSet.raw.coTranslation(this.handle));
        }
        translationWrtParent() {
            return w.fromRaw(this.colliderSet.raw.coTranslationWrtParent(this.handle));
        }
        rotation() {
            return v.fromRaw(this.colliderSet.raw.coRotation(this.handle));
        }
        rotationWrtParent() {
            return v.fromRaw(this.colliderSet.raw.coRotationWrtParent(this.handle));
        }
        isSensor() {
            return this.colliderSet.raw.coIsSensor(this.handle);
        }
        setSensor(t) {
            this.colliderSet.raw.coSetSensor(this.handle, t);
        }
        setShape(t) {
            let e = t.intoRaw();
            this.colliderSet.raw.coSetShape(this.handle, e), e.free(), this._shape = t;
        }
        setEnabled(t) {
            this.colliderSet.raw.coSetEnabled(this.handle, t);
        }
        isEnabled() {
            return this.colliderSet.raw.coIsEnabled(this.handle);
        }
        setRestitution(t) {
            this.colliderSet.raw.coSetRestitution(this.handle, t);
        }
        setFriction(t) {
            this.colliderSet.raw.coSetFriction(this.handle, t);
        }
        frictionCombineRule() {
            return this.colliderSet.raw.coFrictionCombineRule(this.handle);
        }
        setFrictionCombineRule(t) {
            this.colliderSet.raw.coSetFrictionCombineRule(this.handle, t);
        }
        restitutionCombineRule() {
            return this.colliderSet.raw.coRestitutionCombineRule(this.handle);
        }
        setRestitutionCombineRule(t) {
            this.colliderSet.raw.coSetRestitutionCombineRule(this.handle, t);
        }
        setCollisionGroups(t) {
            this.colliderSet.raw.coSetCollisionGroups(this.handle, t);
        }
        setSolverGroups(t) {
            this.colliderSet.raw.coSetSolverGroups(this.handle, t);
        }
        contactSkin() {
            return this.colliderSet.raw.coContactSkin(this.handle);
        }
        setContactSkin(t) {
            return this.colliderSet.raw.coSetContactSkin(this.handle, t);
        }
        activeHooks() {
            return this.colliderSet.raw.coActiveHooks(this.handle);
        }
        setActiveHooks(t) {
            this.colliderSet.raw.coSetActiveHooks(this.handle, t);
        }
        activeEvents() {
            return this.colliderSet.raw.coActiveEvents(this.handle);
        }
        setActiveEvents(t) {
            this.colliderSet.raw.coSetActiveEvents(this.handle, t);
        }
        activeCollisionTypes() {
            return this.colliderSet.raw.coActiveCollisionTypes(this.handle);
        }
        setContactForceEventThreshold(t) {
            return this.colliderSet.raw.coSetContactForceEventThreshold(this.handle, t);
        }
        contactForceEventThreshold() {
            return this.colliderSet.raw.coContactForceEventThreshold(this.handle);
        }
        setActiveCollisionTypes(t) {
            this.colliderSet.raw.coSetActiveCollisionTypes(this.handle, t);
        }
        setDensity(t) {
            this.colliderSet.raw.coSetDensity(this.handle, t);
        }
        setMass(t) {
            this.colliderSet.raw.coSetMass(this.handle, t);
        }
        setMassProperties(t, e, r, a) {
            let o = w.intoRaw(e), _ = w.intoRaw(r), d = v.intoRaw(a);
            this.colliderSet.raw.coSetMassProperties(this.handle, t, o, _, d), o.free(), _.free(), d.free();
        }
        setTranslation(t) {
            this.colliderSet.raw.coSetTranslation(this.handle, t.x, t.y, t.z);
        }
        setTranslationWrtParent(t) {
            this.colliderSet.raw.coSetTranslationWrtParent(this.handle, t.x, t.y, t.z);
        }
        setRotation(t) {
            this.colliderSet.raw.coSetRotation(this.handle, t.x, t.y, t.z, t.w);
        }
        setRotationWrtParent(t) {
            this.colliderSet.raw.coSetRotationWrtParent(this.handle, t.x, t.y, t.z, t.w);
        }
        shapeType() {
            return this.colliderSet.raw.coShapeType(this.handle);
        }
        halfExtents() {
            return w.fromRaw(this.colliderSet.raw.coHalfExtents(this.handle));
        }
        setHalfExtents(t) {
            const e = w.intoRaw(t);
            this.colliderSet.raw.coSetHalfExtents(this.handle, e);
        }
        radius() {
            return this.colliderSet.raw.coRadius(this.handle);
        }
        setRadius(t) {
            this.colliderSet.raw.coSetRadius(this.handle, t);
        }
        roundRadius() {
            return this.colliderSet.raw.coRoundRadius(this.handle);
        }
        setRoundRadius(t) {
            this.colliderSet.raw.coSetRoundRadius(this.handle, t);
        }
        halfHeight() {
            return this.colliderSet.raw.coHalfHeight(this.handle);
        }
        setHalfHeight(t) {
            this.colliderSet.raw.coSetHalfHeight(this.handle, t);
        }
        setVoxel(t, e, r, a) {
            this.colliderSet.raw.coSetVoxel(this.handle, t, e, r, a), this._shape = null;
        }
        propagateVoxelChange(t, e, r, a, o, _, d) {
            this.colliderSet.raw.coPropagateVoxelChange(this.handle, t.handle, e, r, a, o, _, d), this._shape = null;
        }
        combineVoxelStates(t, e, r, a) {
            this.colliderSet.raw.coCombineVoxelStates(this.handle, t.handle, e, r, a), this._shape = null;
        }
        vertices() {
            return this.colliderSet.raw.coVertices(this.handle);
        }
        indices() {
            return this.colliderSet.raw.coIndices(this.handle);
        }
        heightfieldHeights() {
            return this.colliderSet.raw.coHeightfieldHeights(this.handle);
        }
        heightfieldScale() {
            let t = this.colliderSet.raw.coHeightfieldScale(this.handle);
            return w.fromRaw(t);
        }
        heightfieldNRows() {
            return this.colliderSet.raw.coHeightfieldNRows(this.handle);
        }
        heightfieldNCols() {
            return this.colliderSet.raw.coHeightfieldNCols(this.handle);
        }
        parent() {
            return this._parent;
        }
        friction() {
            return this.colliderSet.raw.coFriction(this.handle);
        }
        restitution() {
            return this.colliderSet.raw.coRestitution(this.handle);
        }
        density() {
            return this.colliderSet.raw.coDensity(this.handle);
        }
        mass() {
            return this.colliderSet.raw.coMass(this.handle);
        }
        volume() {
            return this.colliderSet.raw.coVolume(this.handle);
        }
        collisionGroups() {
            return this.colliderSet.raw.coCollisionGroups(this.handle);
        }
        solverGroups() {
            return this.colliderSet.raw.coSolverGroups(this.handle);
        }
        containsPoint(t) {
            let e = w.intoRaw(t), r = this.colliderSet.raw.coContainsPoint(this.handle, e);
            return e.free(), r;
        }
        projectPoint(t, e) {
            let r = w.intoRaw(t), a = bt.fromRaw(this.colliderSet.raw.coProjectPoint(this.handle, r, e));
            return r.free(), a;
        }
        intersectsRay(t, e) {
            let r = w.intoRaw(t.origin), a = w.intoRaw(t.dir), o = this.colliderSet.raw.coIntersectsRay(this.handle, r, a, e);
            return r.free(), a.free(), o;
        }
        castShape(t, e, r, a, o, _, d, h) {
            let p = w.intoRaw(t), u = w.intoRaw(r), g = v.intoRaw(a), b = w.intoRaw(o), m = e.intoRaw(), C = ot.fromRaw(this.colliderSet, this.colliderSet.raw.coCastShape(this.handle, p, m, u, g, b, _, d, h));
            return p.free(), u.free(), g.free(), b.free(), m.free(), C;
        }
        castCollider(t, e, r, a, o, _) {
            let d = w.intoRaw(t), h = w.intoRaw(r), p = mt.fromRaw(this.colliderSet, this.colliderSet.raw.coCastCollider(this.handle, d, e.handle, h, a, o, _));
            return d.free(), h.free(), p;
        }
        intersectsShape(t, e, r) {
            let a = w.intoRaw(e), o = v.intoRaw(r), _ = t.intoRaw(), d = this.colliderSet.raw.coIntersectsShape(this.handle, _, a, o);
            return a.free(), o.free(), _.free(), d;
        }
        contactShape(t, e, r, a) {
            let o = w.intoRaw(e), _ = v.intoRaw(r), d = t.intoRaw(), h = st.fromRaw(this.colliderSet.raw.coContactShape(this.handle, d, o, _, a));
            return o.free(), _.free(), d.free(), h;
        }
        contactCollider(t, e) {
            return st.fromRaw(this.colliderSet.raw.coContactCollider(this.handle, t.handle, e));
        }
        castRay(t, e, r) {
            let a = w.intoRaw(t.origin), o = w.intoRaw(t.dir), _ = this.colliderSet.raw.coCastRay(this.handle, a, o, e, r);
            return a.free(), o.free(), _;
        }
        castRayAndGetNormal(t, e, r) {
            let a = w.intoRaw(t.origin), o = w.intoRaw(t.dir), _ = gt.fromRaw(this.colliderSet.raw.coCastRayAndGetNormal(this.handle, a, o, e, r));
            return a.free(), o.free(), _;
        }
    };
    (function(s) {
        s[s.Density = 0] = "Density", s[s.Mass = 1] = "Mass", s[s.MassProps = 2] = "MassProps";
    })(rt || (rt = {}));
    z = class {
        constructor(t){
            this.enabled = !0, this.shape = t, this.massPropsMode = rt.Density, this.density = 1, this.friction = .5, this.restitution = 0, this.rotation = v.identity(), this.translation = w.zeros(), this.isSensor = !1, this.collisionGroups = 4294967295, this.solverGroups = 4294967295, this.frictionCombineRule = ht.Average, this.restitutionCombineRule = ht.Average, this.activeCollisionTypes = Pt.DEFAULT, this.activeEvents = Et.NONE, this.activeHooks = At.NONE, this.mass = 0, this.centerOfMass = w.zeros(), this.contactForceEventThreshold = 0, this.contactSkin = 0, this.principalAngularInertia = w.zeros(), this.angularInertiaLocalFrame = v.identity();
        }
        static ball(t) {
            const e = new Ce(t);
            return new z(e);
        }
        static capsule(t, e) {
            const r = new Ie(t, e);
            return new z(r);
        }
        static segment(t, e) {
            const r = new Ee(t, e);
            return new z(r);
        }
        static triangle(t, e, r) {
            const a = new Ae(t, e, r);
            return new z(a);
        }
        static roundTriangle(t, e, r, a) {
            const o = new Pe(t, e, r, a);
            return new z(o);
        }
        static polyline(t, e) {
            const r = new ze(t, e);
            return new z(r);
        }
        static voxels(t, e) {
            const r = new Fe(t, e);
            return new z(r);
        }
        static trimesh(t, e, r) {
            const a = new Te(t, e, r);
            return new z(a);
        }
        static cuboid(t, e, r) {
            const a = new xe(t, e, r);
            return new z(a);
        }
        static roundCuboid(t, e, r, a) {
            const o = new je(t, e, r, a);
            return new z(o);
        }
        static heightfield(t, e, r, a, o) {
            const _ = new Me(t, e, r, a, o);
            return new z(_);
        }
        static cylinder(t, e) {
            const r = new ke(t, e);
            return new z(r);
        }
        static roundCylinder(t, e, r) {
            const a = new He(t, e, r);
            return new z(a);
        }
        static cone(t, e) {
            const r = new De(t, e);
            return new z(r);
        }
        static roundCone(t, e, r) {
            const a = new Le(t, e, r);
            return new z(a);
        }
        static convexHull(t) {
            const e = new jt(t, null);
            return new z(e);
        }
        static convexMesh(t, e) {
            const r = new jt(t, e);
            return new z(r);
        }
        static roundConvexHull(t, e) {
            const r = new It(t, null, e);
            return new z(r);
        }
        static roundConvexMesh(t, e, r) {
            const a = new It(t, e, r);
            return new z(a);
        }
        setTranslation(t, e, r) {
            if (typeof t != "number" || typeof e != "number" || typeof r != "number") throw TypeError("The translation components must be numbers.");
            return this.translation = {
                x: t,
                y: e,
                z: r
            }, this;
        }
        setRotation(t) {
            return v.copy(this.rotation, t), this;
        }
        setSensor(t) {
            return this.isSensor = t, this;
        }
        setEnabled(t) {
            return this.enabled = t, this;
        }
        setContactSkin(t) {
            return this.contactSkin = t, this;
        }
        setDensity(t) {
            return this.massPropsMode = rt.Density, this.density = t, this;
        }
        setMass(t) {
            return this.massPropsMode = rt.Mass, this.mass = t, this;
        }
        setMassProperties(t, e, r, a) {
            return this.massPropsMode = rt.MassProps, this.mass = t, w.copy(this.centerOfMass, e), w.copy(this.principalAngularInertia, r), v.copy(this.angularInertiaLocalFrame, a), this;
        }
        setRestitution(t) {
            return this.restitution = t, this;
        }
        setFriction(t) {
            return this.friction = t, this;
        }
        setFrictionCombineRule(t) {
            return this.frictionCombineRule = t, this;
        }
        setRestitutionCombineRule(t) {
            return this.restitutionCombineRule = t, this;
        }
        setCollisionGroups(t) {
            return this.collisionGroups = t, this;
        }
        setSolverGroups(t) {
            return this.solverGroups = t, this;
        }
        setActiveHooks(t) {
            return this.activeHooks = t, this;
        }
        setActiveEvents(t) {
            return this.activeEvents = t, this;
        }
        setActiveCollisionTypes(t) {
            return this.activeCollisionTypes = t, this;
        }
        setContactForceEventThreshold(t) {
            return this.contactForceEventThreshold = t, this;
        }
    };
    Jr = class {
        free() {
            this.raw && this.raw.free(), this.raw = void 0, this.map && this.map.clear(), this.map = void 0;
        }
        constructor(t){
            this.raw = t || new P, this.map = new Lt, t && t.forEachColliderHandle((e)=>{
                this.map.set(e, new ue(this, e, null));
            });
        }
        castClosure(t) {
            return (e)=>{
                if (t) return t(this.get(e));
            };
        }
        finalizeDeserialization(t) {
            this.map.forEach((e)=>e.finalizeDeserialization(t));
        }
        createCollider(t, e, r) {
            let a = r != null && r != null;
            if (a && isNaN(r)) throw Error("Cannot create a collider with a parent rigid-body handle that is not a number.");
            let o = e.shape.intoRaw(), _ = w.intoRaw(e.translation), d = v.intoRaw(e.rotation), h = w.intoRaw(e.centerOfMass), p = w.intoRaw(e.principalAngularInertia), u = v.intoRaw(e.angularInertiaLocalFrame), g = this.raw.createCollider(e.enabled, o, _, d, e.massPropsMode, e.mass, h, p, u, e.density, e.friction, e.restitution, e.frictionCombineRule, e.restitutionCombineRule, e.isSensor, e.collisionGroups, e.solverGroups, e.activeCollisionTypes, e.activeHooks, e.activeEvents, e.contactForceEventThreshold, e.contactSkin, a, a ? r : 0, t.raw);
            o.free(), _.free(), d.free(), h.free(), p.free(), u.free();
            let b = a ? t.get(r) : null, m = new ue(this, g, b, e.shape);
            return this.map.set(g, m), m;
        }
        remove(t, e, r, a) {
            this.raw.remove(t, e.raw, r.raw, a), this.unmap(t);
        }
        unmap(t) {
            this.map.delete(t);
        }
        get(t) {
            return this.map.get(t);
        }
        len() {
            return this.map.len();
        }
        contains(t) {
            return this.get(t) != null;
        }
        forEach(t) {
            this.map.forEach(t);
        }
        getAll() {
            return this.map.getAll();
        }
    };
    Xh = function() {
        return ti();
    };
    Jh = function(s) {
        ei(s);
    };
    qh = Object.freeze(Object.defineProperty({
        __proto__: null,
        get ActiveCollisionTypes () {
            return Pt;
        },
        get ActiveEvents () {
            return Et;
        },
        get ActiveHooks () {
            return At;
        },
        Ball: Ce,
        BroadPhase: kr,
        CCDSolver: Tr,
        Capsule: Ie,
        CharacterCollision: Br,
        get CoefficientCombineRule () {
            return ht;
        },
        Collider: ue,
        ColliderDesc: z,
        ColliderSet: Jr,
        ColliderShapeCastHit: mt,
        Cone: De,
        ConvexPolyhedron: jt,
        Cuboid: xe,
        Cylinder: ke,
        DebugRenderBuffers: Gr,
        DebugRenderPipeline: Wr,
        DynamicRayCastVehicleController: Ur,
        EventQueue: Uh,
        get FeatureType () {
            return at;
        },
        FixedImpulseJoint: yr,
        FixedMultibodyJoint: Er,
        GenericImpulseJoint: xr,
        HalfSpace: Lr,
        get HeightFieldFlags () {
            return ce;
        },
        Heightfield: Me,
        ImpulseJoint: X,
        ImpulseJointSet: Ir,
        IntegrationParameters: fr,
        IslandManager: Mr,
        get JointAxesMask () {
            return _e;
        },
        JointData: q,
        get JointType () {
            return N;
        },
        KinematicCharacterController: Or,
        get MassPropsMode () {
            return rt;
        },
        get MotorModel () {
            return oe;
        },
        MultibodyJoint: et,
        MultibodyJointSet: Fr,
        NarrowPhase: Hr,
        PhysicsPipeline: Nr,
        get PidAxesMask () {
            return de;
        },
        PidController: Vr,
        PointColliderProjection: ut,
        PointProjection: bt,
        Polyline: ze,
        PrismaticImpulseJoint: Rr,
        PrismaticMultibodyJoint: Ar,
        Quaternion: ne,
        get QueryFilterFlags () {
            return pe;
        },
        Ray: Vh,
        RayColliderHit: Nt,
        RayColliderIntersection: pt,
        RayIntersection: gt,
        RevoluteImpulseJoint: Cr,
        RevoluteMultibodyJoint: Pr,
        RigidBody: se,
        RigidBodyDesc: J,
        RigidBodySet: mr,
        get RigidBodyType () {
            return V;
        },
        RopeImpulseJoint: vr,
        RotationOps: v,
        RoundCone: Le,
        RoundConvexPolyhedron: It,
        RoundCuboid: je,
        RoundCylinder: He,
        RoundTriangle: Pe,
        SdpMatrix3: br,
        SdpMatrix3Ops: ae,
        Segment: Ee,
        SerializationPipeline: we,
        Shape: k,
        ShapeCastHit: ot,
        ShapeContact: st,
        get ShapeType () {
            return F;
        },
        get SolverFlags () {
            return he;
        },
        SphericalImpulseJoint: jr,
        SphericalMultibodyJoint: zr,
        SpringImpulseJoint: Sr,
        TempContactForceEvent: Xr,
        TempContactManifold: Dr,
        TriMesh: Te,
        get TriMeshFlags () {
            return le;
        },
        Triangle: Ae,
        UnitImpulseJoint: Se,
        UnitMultibodyJoint: Re,
        Vector3: gr,
        VectorOps: w,
        Voxels: Fe,
        World: Gt,
        reserveMemory: Jh,
        version: Xh
    }, Symbol.toStringTag, {
        value: "Module"
    }));
})();
export { Pt as ActiveCollisionTypes, Et as ActiveEvents, At as ActiveHooks, Ce as Ball, kr as BroadPhase, Tr as CCDSolver, Ie as Capsule, Br as CharacterCollision, ht as CoefficientCombineRule, ue as Collider, z as ColliderDesc, Jr as ColliderSet, mt as ColliderShapeCastHit, De as Cone, jt as ConvexPolyhedron, xe as Cuboid, ke as Cylinder, Gr as DebugRenderBuffers, Wr as DebugRenderPipeline, Ur as DynamicRayCastVehicleController, Uh as EventQueue, at as FeatureType, yr as FixedImpulseJoint, Er as FixedMultibodyJoint, xr as GenericImpulseJoint, Lr as HalfSpace, ce as HeightFieldFlags, Me as Heightfield, X as ImpulseJoint, Ir as ImpulseJointSet, fr as IntegrationParameters, Mr as IslandManager, _e as JointAxesMask, q as JointData, N as JointType, Or as KinematicCharacterController, rt as MassPropsMode, oe as MotorModel, et as MultibodyJoint, Fr as MultibodyJointSet, Hr as NarrowPhase, Nr as PhysicsPipeline, de as PidAxesMask, Vr as PidController, ut as PointColliderProjection, bt as PointProjection, ze as Polyline, Rr as PrismaticImpulseJoint, Ar as PrismaticMultibodyJoint, ne as Quaternion, pe as QueryFilterFlags, Vh as Ray, Nt as RayColliderHit, pt as RayColliderIntersection, gt as RayIntersection, Cr as RevoluteImpulseJoint, Pr as RevoluteMultibodyJoint, se as RigidBody, J as RigidBodyDesc, mr as RigidBodySet, V as RigidBodyType, vr as RopeImpulseJoint, v as RotationOps, Le as RoundCone, It as RoundConvexPolyhedron, je as RoundCuboid, He as RoundCylinder, Pe as RoundTriangle, br as SdpMatrix3, ae as SdpMatrix3Ops, Ee as Segment, we as SerializationPipeline, k as Shape, ot as ShapeCastHit, st as ShapeContact, F as ShapeType, he as SolverFlags, jr as SphericalImpulseJoint, zr as SphericalMultibodyJoint, Sr as SpringImpulseJoint, Xr as TempContactForceEvent, Dr as TempContactManifold, Te as TriMesh, le as TriMeshFlags, Ae as Triangle, Se as UnitImpulseJoint, Re as UnitMultibodyJoint, gr as Vector3, w as VectorOps, Fe as Voxels, Gt as World, qh as default, Jh as reserveMemory, Xh as version, __tla };
