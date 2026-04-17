import { S as Je, L as Ye, v as x, P as Ds, u as c, p as Bs, b as Ls, t as Rs, A as Ns, a as Fs, m as T, r as Os, N as Us, F as b, s as Oe, c as ve, d as Kt, E as It, e as us, f as Ws, g as dt, h as Ct, i as u, j as Z, k as Ke, l as de, n as D, o as V, V as B, Q as Ut, M as mt, q as X, w as tt, x as nt, y as Pt, z as js, C as ke, B as Gs, G as zs, D as hs, R as Zs, H as Hs, I as Zt, J as pe, K as E, O as ce, T as J, U as Vs, W as et, X as Xt, Y as ut, Z as Ys, _ as Mt, $ as _t, a0 as ht, a1 as Ks, a2 as Xs, a3 as at, a4 as $s, a5 as ms, a6 as $t, a7 as ps, a8 as gs, a9 as fs, aa as qs, ab as Js, ac as qt, ad as Qs, ae as as, af as Wt, ag as ns, ah as ea, ai as ta, aj as sa, ak as jt, al as is, am as aa, an as Gt, ao as na, ap as ia, aq as oa, ar as ra, as as la, at as ca, au as da, av as ua, aw as ws, ax as ha, ay as ma, az as pa, aA as ga, aB as fa, aC as wa, aD as ba, aE as va, aF as ya, aG as Sa, aH as Ma, aI as _a, aJ as xa, aK as Ia, aL as Ca, aM as Aa, aN as Ta, aO as Pa, aP as os, aQ as ka, aR as Ea, aS as Da, aT as Ba, aU as La, aV as Ra, aW as Na, aX as Fa } from "./three-BDxFAI0I.js";
import { e as Oa } from "./tseep-zr-hWxBz.js";
import { Ray as Ua, RigidBodyDesc as bs, ColliderDesc as Xe, ActiveEvents as Wa, HeightFieldFlags as ja, World as Ga, EventQueue as za, QueryFilterFlags as rs, __tla as __tla_0 } from "./@dimforge-C0cDeoNs.js";
import { d as Za } from "./lodash-es-BMmXVQ06.js";
import { p as it, o as pt, t as _e, a as G, b as ot, f as je, s as le, c as Ht, g as w, d as O, e as Le, h as Te, i as Me, j as At, k as vs, l as ys, m as Ss, n as Ha, q as Va, r as Ms, u as Vt, v as _s, w as rt, x as ye, y as Qe, z as gt, A as Ya, B as Ka, C as Xa, D as $a, E as qa, F as ls, G as Ja, H as Qa } from "./svelte-80CdSa2_.js";
import "./clsx-B-dksMZM.js";
import "./esm-env-rsSWfq8L.js";
Promise.all([
    (()=>{
        try {
            return __tla_0;
        } catch  {}
    })()
]).then(async ()=>{
    (function() {
        const e = document.createElement("link").relList;
        if (e && e.supports && e.supports("modulepreload")) return;
        for (const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);
        new MutationObserver((a)=>{
            for (const n of a)if (n.type === "childList") for (const i of n.addedNodes)i.tagName === "LINK" && i.rel === "modulepreload" && s(i);
        }).observe(document, {
            childList: !0,
            subtree: !0
        });
        function t(a) {
            const n = {};
            return a.integrity && (n.integrity = a.integrity), a.referrerPolicy && (n.referrerPolicy = a.referrerPolicy), a.crossOrigin === "use-credentials" ? n.credentials = "include" : a.crossOrigin === "anonymous" ? n.credentials = "omit" : n.credentials = "same-origin", n;
        }
        function s(a) {
            if (a.ep) return;
            a.ep = !0;
            const n = t(a);
            fetch(a.href, n);
        }
    })();
    const en = {
        stoneDiffuse: {
            scale: [
                .4921875,
                .4921875
            ],
            offset: [
                .00390625,
                .00390625
            ]
        },
        stoneMossyDiffuse: {
            scale: [
                .4921875,
                .4921875
            ],
            offset: [
                .00390625,
                .50390625
            ]
        },
        stoneMossyNormalAo: {
            scale: [
                .4921875,
                .4921875
            ],
            offset: [
                .50390625,
                .00390625
            ]
        },
        stoneNormalAo: {
            scale: [
                .4921875,
                .4921875
            ],
            offset: [
                .50390625,
                .50390625
            ]
        }
    }, tn = {
        stones: en
    }, sn = "/models/sekai.glb", an = "/textures/environment/px.webp", nn = "/textures/environment/nx.webp", on = "/textures/environment/py.webp", rn = "/textures/environment/ny.webp", ln = "/textures/environment/pz.webp", cn = "/textures/environment/nz.webp", dn = "/textures/new-world/water/water_normal.ktx2", un = "/textures/new-world/cool-stuff/leviathan/diffuse_emissive_1k.ktx2", hn = "/textures/new-world/cool-stuff/leviathan/normal_512.ktx2", mn = "/textures/new-world/cool-stuff/leviathan/orm_512.ktx2", pn = "/textures/new-world/cool-stuff/berserk/diffuse_1k.ktx2", gn = "/textures/new-world/cool-stuff/berserk/normal_1k.ktx2", fn = "/textures/new-world/cool-stuff/berserk/orm_512.ktx2", wn = "/textures/new-world/cool-stuff/dragon-ball/diffuse_1k.ktx2", bn = "/textures/new-world/cool-stuff/dragon-ball/normal_1k.ktx2", vn = "/textures/new-world/campfire/diffuse_2k.ktx2", yn = "/textures/new-world/campfire/normalRoughness_1k.ktx2", Sn = "/textures/new-world/fire/fireSprites_128_etc1s.ktx2", Mn = "/textures/new-world/player/football/diffuse_512.ktx2", _n = "/textures/new-world/player/football/normal_512.ktx2", xn = "/textures/new-world/flowers/edelweiss_128.ktx2", In = "/textures/new-world/pine-tree/diffuse_2k.ktx2", Cn = "/textures/new-world/tree/bark_diffuse_512_uastc.ktx2", An = "/textures/new-world/tree/bark_normal_512_uastc.ktx2", Tn = "/textures/new-world/terrain/groundNormalAO_1k.ktx2", Pn = "/textures/new-world/water/water_normal_vein_uastc.ktx2", kn = "/textures/new-world/noise/noise_atlas.ktx2", En = "/textures/new-world/terrain/grass-map.webp", Dn = "/textures/new-world/terrain/water-map.webp", Bn = "/textures/new-world/terrain/shadow-map.webp", Ln = [
        {
            name: "worldModel",
            url: sn,
            type: "gltf"
        },
        {
            name: "noiseAtlas",
            url: kn,
            type: "ktx2",
            wrap: !0
        },
        {
            name: "envMapTexture",
            urls: [
                an,
                nn,
                on,
                rn,
                ln,
                cn
            ],
            type: "cubeTexture",
            colorSpace: Je
        },
        {
            name: "grassMap",
            url: En,
            type: "texture",
            flipY: !1,
            minFilter: Ye,
            magFilter: Ye,
            generateMipmaps: !1
        },
        {
            name: "waterMap",
            url: Dn,
            type: "texture",
            flipY: !1,
            minFilter: Ye,
            magFilter: Ye,
            generateMipmaps: !1
        },
        {
            name: "shadowMap",
            url: Bn,
            type: "texture",
            flipY: !1,
            minFilter: Ye,
            magFilter: Ye,
            generateMipmaps: !1
        },
        {
            name: "terrainNormAo",
            url: Tn,
            type: "ktx2",
            wrap: !0,
            anisotropy: 4
        },
        {
            name: "normVeinWater",
            url: Pn,
            type: "ktx2",
            wrap: !0
        },
        {
            name: "waterNormal",
            url: dn,
            type: "ktx2"
        },
        {
            name: "campfireDiffuse",
            url: vn,
            flipY: !1,
            type: "ktx2",
            colorSpace: Je
        },
        {
            name: "campfireNormalRoughness",
            url: yn,
            type: "ktx2",
            flipY: !1
        },
        {
            name: "fireSprites",
            url: Sn,
            type: "ktx2"
        },
        {
            name: "leviathanAxeDiffuseEmissive",
            url: un,
            type: "ktx2",
            flipY: !1,
            colorSpace: Je
        },
        {
            name: "leviathanAxeNormal",
            url: hn,
            type: "ktx2",
            flipY: !1
        },
        {
            name: "leviathanAxeORM",
            url: mn,
            type: "ktx2",
            flipY: !1
        },
        {
            name: "dragonSlayerSwordDiffuse",
            url: pn,
            type: "ktx2",
            flipY: !1,
            colorSpace: Je
        },
        {
            name: "dragonSlayerSwordNormal",
            url: gn,
            type: "ktx2",
            flipY: !1
        },
        {
            name: "dragonSlayerSwordARM",
            url: fn,
            type: "ktx2",
            flipY: !1
        },
        {
            name: "concreteDiffuse",
            url: wn,
            type: "ktx2",
            flipY: !1,
            wrap: !0
        },
        {
            name: "concreteNormal",
            url: bn,
            type: "ktx2",
            flipY: !1,
            wrap: !0
        },
        {
            name: "playerDiffuse",
            url: Mn,
            type: "ktx2",
            flipY: !1,
            colorSpace: Je
        },
        {
            name: "playerNormal",
            url: _n,
            type: "ktx2",
            flipY: !1
        },
        {
            name: "treeBarkDiffuse",
            url: Cn,
            type: "ktx2",
            flipY: !1,
            wrap: !0,
            colorSpace: Je
        },
        {
            name: "treeBarkNormal",
            url: An,
            type: "ktx2",
            flipY: !1,
            wrap: !0
        },
        {
            name: "pineTreeDiffuse",
            url: In,
            type: "ktx2",
            flipY: !1
        },
        {
            name: "edelweiss",
            url: xn,
            type: "ktx2",
            colorSpace: Je
        }
    ], Rn = x(.2126, .7152, .0722);
    class Nn extends Ds {
        scenePass;
        uSaturation = c(1);
        saturationTarget = 1;
        saturationLerpSpeed = 14;
        sceneManager;
        eventsManager;
        debugManager;
        debugFolder;
        constructor(e, t, s, a){
            super(e), this.sceneManager = t, this.eventsManager = s, this.debugManager = a, this.debugFolder = this.debugManager.panel.addFolder({
                title: "⭐️ Postprocessing",
                expanded: !1
            }), this.scenePass = Bs(this.sceneManager.scene, this.sceneManager.renderCamera);
            const n = this.makeGraph();
            this.outputNode = n, this.eventsManager.on("engine-camera-change", ()=>{
                this.scenePass.camera = this.sceneManager.renderCamera, this.scenePass.needsUpdate = !0;
            }), this.eventsManager.on("engine-slowmo-change", (i)=>{
                this.saturationTarget = i ? 0 : 1;
            }), this.eventsManager.on("engine-update", ({ delta: i })=>{
                if (this.uSaturation.value === this.saturationTarget) return;
                const o = 1 - Math.exp(-this.saturationLerpSpeed * i);
                this.uSaturation.value += (this.saturationTarget - this.uSaturation.value) * o;
            });
        }
        makeGraph() {
            this.outputColorTransform = !1;
            const e = this.scenePass.getTextureNode(), t = Ls(e, .25, .15, 1);
            t.smoothWidth.value = .04, t._nMips = 2, this.debugFolder.addBinding(t.strength, "value", {
                label: "Bloom strength"
            }), this.debugFolder.addBinding(t.threshold, "value", {
                label: "Bloom threshold"
            });
            const s = e.add(t), a = Rs(Ns, Fs, s).rgb, n = a.dot(Rn), i = T(x(n), a, this.uSaturation);
            return Os(i, Us);
        }
    }
    const xs = {
        on: ()=>xs
    }, Is = {
        hidden: !0,
        addFolder: ()=>Is,
        addBinding: ()=>xs
    };
    class Fn {
        panel = Is;
        isEnabled = !1;
        setVisibility(e) {}
    }
    var xe = ((l)=>(l.Player = "Player", l.Terrain = "Terrain", l.Wood = "Wood", l.Stone = "Stone", l))(xe || {});
    const xt = 512, he = Object.freeze({
        MAP_SIZE: xt,
        HALF_MAP_SIZE: xt / 2,
        KINTOUN_ACTIVATION_THRESHOLD: 2,
        HALF_FLOOR_THICKNESS: .3,
        OUTER_MAP_SIZE: xt * 3,
        OUTER_HALF_MAP_SIZE: xt * 1.5
    });
    class A {
        static packF32 = b(([e = u(0), t = Z(0), s = Z(8), a = u(0), n = u(1), i = u(0)], o)=>{
            const r = Oe(ve(2, s), 1), d = Oe(a, i).div(Kt(n, It)), h = us(Ws(d), 0, r), p = ve(2, t), _ = ve(2, s), g = dt(e.div(p)), f = Ct(g, _).mul(p);
            return e.sub(f).add(h.mul(p));
        });
        static unpackF32 = b(([e = u(0), t = Z(0), s = Z(8), a = u(1), n = u(0)], i)=>{
            const o = ve(2, t), r = ve(2, s), d = dt(e.div(o));
            return Ct(d, r).mul(a).add(n);
        });
        static packUnit = b(([e = u(0), t = Z(0), s = Z(8), a = u(0)], n)=>{
            const i = u(1).div(Oe(ve(2, s), 1));
            return this.packF32(e, t, s, a, i, u(0));
        });
        static unpackUnit = b(([e = u(0), t = Z(0), s = Z(8)], a)=>{
            const n = u(1).div(Oe(ve(2, s), 1));
            return this.unpackF32(e, t, s, n, u(0));
        });
        static packFlag = b(([e = u(0), t = Z(0), s = u(0)], a)=>this.packF32(e, t, Z(1), s, u(1), u(0)));
        static unpackFlag = b(([e = u(0), t = Z(0)], s)=>this.unpackF32(e, t, Z(1), u(1), u(0)));
        static packAngle = b(([e = u(0), t = Z(0), s = Z(9), a = u(0)], n)=>{
            const i = Oe(ve(2, s), 1), o = Ke.div(i), r = a.sub(Ke.mul(dt(a.div(Ke))));
            return this.packF32(e, t, s, r, o, u(0));
        });
        static unpackAngle = b(([e = u(0), t = Z(0), s = Z(9)], a)=>{
            const n = Ke.div(Oe(ve(2, s), 1));
            return this.unpackF32(e, t, s, n, u(0));
        });
        static packSigned = b(([e = u(0), t = u(0), s = u(8), a = u(0), n = u(1)], i)=>{
            const o = Oe(ve(2, s), 1), r = n.mul(2).div(o), d = n.negate();
            return this.packF32(e, t, s, a, r, d);
        });
        static unpackSigned = b(([e = u(0), t = u(0), s = u(8), a = u(1)], n)=>{
            const i = a.mul(2).div(Oe(ve(2, s), 1)), o = a.negate();
            return this.unpackF32(e, t, s, i, o);
        });
        static packUnits = b(([e = u(0), t = Z(0), s = Z(8), a = u(0), n = u(0), i = u(1)], o)=>{
            const r = Oe(ve(2, s), 1), d = i.sub(n).div(r);
            return this.packF32(e, t, s, a, d, n);
        });
        static unpackUnits = b(([e = u(0), t = Z(0), s = Z(8), a = u(0), n = u(1)], i)=>{
            const o = n.sub(a).div(Oe(ve(2, s), 1));
            return this.unpackF32(e, t, s, o, a);
        });
        static computeMapUvByPosition = b(([e = de(0)], t)=>e.add(he.HALF_MAP_SIZE).div(he.MAP_SIZE));
        static computeAtlasUv = b(([e = de(0), t = de(0), s = de(0)], a)=>s.mul(e).add(t));
        static getBakedShadowFactor = b(([e = de(0)], t)=>{
            const s = this.computeMapUvByPosition(e);
            return D(y.resources.shadowMap, s).r;
        });
        static getPlayerShadowFactor = b(([e = x(0), t = x(0), s = u(.5), a = x(0)], n)=>{
            const i = e.y.sub(t.y).div(a.y.add(It)), o = t.x.add(a.x.mul(i)), r = t.z.add(a.z.mul(i)), d = e.x.sub(o), h = e.z.sub(r), p = d.mul(d).add(h.mul(h)), _ = s.mul(s);
            return V(_.mul(.5), _.mul(2), p);
        });
        static blendRNM = b(([e = x(0), t = x(0)], s)=>x(e.z.mul(t.x).add(e.x.mul(t.z)), e.z.mul(t.y).add(e.y.mul(t.z)), e.z.mul(t.z).sub(e.x.mul(t.x).add(e.y.mul(t.y)))).normalize());
        static blendUDN = b(([e = x(0), t = x(0)], s)=>x(e.xy.add(t.xy), e.z.mul(t.z)).normalize());
    }
    const On = {
        dragonball: [
            150,
            .5,
            80
        ]
    }, Un = ()=>({
            JUMP_BUFFER_DURATION_IN_SECONDS: .2,
            MAX_CONSECUTIVE_JUMPS: 2,
            JUMP_CUT_MULTIPLIER: .15,
            FALL_MULTIPLIER: 2.75,
            MAX_UPWARD_VELOCITY: 8,
            LINEAR_DAMPING: 1.4,
            ANGULAR_DAMPING: 1.2,
            WATER_SURFACE_Y: -.5,
            WATER_DAMPING_LINEAR: 5,
            WATER_DAMPING_ANGULAR: 3.5,
            WATER_MOVEMENT_MULTIPLIER: .5,
            BUOYANCY_FORCE: 7.25,
            WATER_VERTICAL_DAMPING: .5,
            WATER_BOB_SUBMERGED_STRENGTH: 2.5,
            GROUND_RAY_START_ABOVE_BOTTOM: .03,
            GROUND_RAY_MAX_DISTANCE: .1,
            GROUND_CONTACT_THRESHOLD: .04,
            BOUNCE_SETTLE_VERTICAL_SPEED: .45,
            JUMP_IMPULSE: new B(0, 100, 0),
            LIN_VEL_STRENGTH: 60,
            ANG_VEL_STRENGTH: 45,
            RADIUS: .5,
            MASS: .5,
            FRICTION: 1,
            RESTITUTION: .6,
            TURN_SPEED: 2,
            PLAYER_INITIAL_POSITION: new B(...On.dragonball),
            CAMERA_OFFSET: new B(0, 16, 20),
            CAMERA_LERP_FACTOR: 7.5,
            UP: new B(0, 1, 0),
            DOWN: new B(0, -1, 0),
            FORWARD: new B(0, 0, -1),
            RESET_Y: -15
        }), S = Un();
    class Wn {
        mesh;
        rigidBody;
        smoothedCameraPosition = new B;
        desiredCameraPosition = new B;
        smoothedCameraTarget = new B;
        desiredTargetPosition = new B;
        yawInRadians = 0;
        prevYawInRadians = -1;
        yawQuaternion = new Ut;
        newLinVel = new B;
        newAngVel = new B;
        torqueAxis = new B;
        forwardVec = new B;
        isOnGround = !1;
        jumpCount = 0;
        wasJumpHeld = !1;
        jumpBufferTimer = 0;
        isInWater = !1;
        waterData = null;
        waterMapWidth = 0;
        waterMapHeight = 0;
        waterTime = 0;
        rayOrigin = new B;
        ray = new Ua(this.rayOrigin, S.DOWN);
        prevPosition = new B;
        prevQuaternion = new Ut;
        targetPosition = new B;
        targetQuaternion = new Ut;
        constructor(){
            this.mesh = this.createCharacterMesh(), se.scene.add(this.mesh), Tt.setTarget(this.mesh), this.rigidBody = me.world.createRigidBody(this.createRigidBodyDesc());
            const e = me.world.createCollider(this.createColliderDesc(), this.rigidBody);
            e.userData = {
                type: xe.Player
            }, this.prevPosition.copy(this.rigidBody.translation()), this.prevQuaternion.copy(this.rigidBody.rotation()), this.targetPosition.copy(this.prevPosition), this.targetQuaternion.copy(this.prevQuaternion), z.on("engine-update", this.update.bind(this)), z.on("engine-update-throttle-64x", this.resetPlayerPosition.bind(this)), this.initWaterDetection(), this.debugPlayer();
        }
        resetPlayerPosition(e) {
            const { player: t } = e;
            t.position.y > S.RESET_Y || (this.rigidBody.setLinvel({
                x: 0,
                y: 0,
                z: 0
            }, !1), this.rigidBody.setAngvel({
                x: 0,
                y: 0,
                z: 0
            }, !1), this.rigidBody.setTranslation(S.PLAYER_INITIAL_POSITION, !0), this.mesh.position.copy(S.PLAYER_INITIAL_POSITION));
        }
        debugPlayer() {
            const e = Ge.panel.addFolder({
                title: "⚽️ Player",
                expanded: !1
            }), t = e.addFolder({
                title: "Physics"
            });
            t.addBinding(S, "LIN_VEL_STRENGTH", {
                label: "Linear velocity",
                min: 5,
                max: 100
            }), t.addBinding(S, "ANG_VEL_STRENGTH", {
                label: "Angular velocity",
                min: 5,
                max: 100
            }), t.addBinding(S, "ANGULAR_DAMPING", {
                label: "Angular damping",
                min: 0,
                max: 5
            }), t.addBinding(S, "FALL_MULTIPLIER", {
                label: "Fall multiplier",
                min: 0,
                max: 10
            });
            const s = e.addFolder({
                title: "Camera"
            });
            s.addBinding(S.CAMERA_OFFSET, "y", {
                label: "Camera height"
            }), s.addBinding(S.CAMERA_OFFSET, "z", {
                label: "Camera distance"
            });
            const a = e.addFolder({
                title: "Water"
            });
            a.addBinding(S, "BUOYANCY_FORCE", {
                label: "Buoyancy",
                min: 1,
                max: 20
            }), a.addBinding(S, "WATER_VERTICAL_DAMPING", {
                label: "Vertical damp",
                min: 0,
                max: 10
            }), a.addBinding(S, "WATER_BOB_SUBMERGED_STRENGTH", {
                label: "Bob strength",
                min: 0,
                max: 10
            });
        }
        initWaterDetection() {
            const e = y.resources.waterMap;
            if (!e?.image) return;
            const t = e.image;
            if (!(!t.width || !t.height)) try {
                const s = document.createElement("canvas"), a = s.getContext("2d");
                s.width = t.width, s.height = t.height, a.drawImage(t, 0, 0);
                const n = a.getImageData(0, 0, s.width, s.height);
                this.waterData = n.data, this.waterMapWidth = s.width, this.waterMapHeight = s.height;
            } catch  {}
        }
        checkIfInWater() {
            if (!this.waterData) return !1;
            const e = this.rigidBody.translation();
            if (e.y - S.RADIUS > S.WATER_SURFACE_Y) return !1;
            const t = (e.x + 256) / 512, s = (e.z + 256) / 512, a = Math.floor(t * this.waterMapWidth), i = (Math.floor(s * this.waterMapHeight) * this.waterMapWidth + a) * 4;
            return this.waterData[i] > 128;
        }
        applyWaterPhysics(e) {
            this.waterTime += e;
            const t = this.rigidBody.translation(), s = this.rigidBody.linvel(), a = S.WATER_SURFACE_Y - (t.y - S.RADIUS);
            if (a <= 0) {
                this.waterTime = 0;
                return;
            }
            const n = Math.min(a, 1), i = Math.min(a * 2, 1), o = n * S.BUOYANCY_FORCE * i, r = s.y * -S.WATER_VERTICAL_DAMPING * i, d = Math.sin(this.waterTime * 4) * S.WATER_BOB_SUBMERGED_STRENGTH * i;
            this.rigidBody.applyImpulse({
                x: 0,
                y: (o + r + d) * e,
                z: 0
            }, !0);
        }
        createCharacterMesh() {
            const e = y.resources.worldModel.scene.getObjectByName("player");
            return e.material = new jn, e.castShadow = !0, e.position.copy(S.PLAYER_INITIAL_POSITION), e;
        }
        createRigidBodyDesc() {
            const { x: e, y: t, z: s } = S.PLAYER_INITIAL_POSITION;
            return bs.dynamic().setTranslation(e, t, s).setLinearDamping(S.LINEAR_DAMPING).setAngularDamping(S.ANGULAR_DAMPING);
        }
        createColliderDesc() {
            return Xe.ball(S.RADIUS).setRestitution(S.RESTITUTION).setFriction(S.FRICTION).setMass(S.MASS).setActiveEvents(Wa.COLLISION_EVENTS);
        }
        update(e) {
            const { delta: t } = e, s = this.isInWater;
            this.isInWater = this.checkIfInWater(), this.isInWater !== s && (this.rigidBody.setLinearDamping(this.isInWater ? S.WATER_DAMPING_LINEAR : S.LINEAR_DAMPING), this.rigidBody.setAngularDamping(this.isInWater ? S.WATER_DAMPING_ANGULAR : S.ANGULAR_DAMPING)), this.isInWater && this.applyWaterPhysics(t), this.prevYawInRadians !== this.yawInRadians && (this.yawQuaternion.setFromAxisAngle(S.UP, this.yawInRadians), this.prevYawInRadians = this.yawInRadians), this.updateVerticalMovement(t), this.updateHorizontalMovement(t), this.syncMeshWithBody(), this.updateCameraPosition(t);
        }
        updateVerticalMovement(e) {
            const t = ct.isJumpPressed();
            if (this.isOnGround = this.checkIfGrounded(), this.isOnGround && (this.jumpCount = 0), t && !this.wasJumpHeld ? this.jumpBufferTimer = S.JUMP_BUFFER_DURATION_IN_SECONDS : this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - e), this.jumpBufferTimer > 0 && this.canJump() && (this.performJump(), this.jumpBufferTimer = 0), !this.isInWater) {
                const a = this.rigidBody.linvel(), n = a.y;
                this.handleJumpCut(t, a), this.isOnGround || this.handleFastFall(e, a, me.world.gravity.y), this.clampUpwardVelocity(a);
                const i = this.isOnGround && !t && Math.abs(a.y) < S.BOUNCE_SETTLE_VERTICAL_SPEED;
                i && (a.y = 0), a.y !== n && this.rigidBody.setLinvel(a, !i);
            }
            this.wasJumpHeld = t;
        }
        checkIfGrounded() {
            this.rayOrigin.copy(this.rigidBody.translation()), this.rayOrigin.y -= S.RADIUS - S.GROUND_RAY_START_ABOVE_BOTTOM;
            const e = me.world.castRay(this.ray, S.GROUND_RAY_MAX_DISTANCE, !0, void 0, void 0, void 0, this.rigidBody);
            return e ? e.timeOfImpact <= S.GROUND_CONTACT_THRESHOLD : !1;
        }
        canJump() {
            return this.isInWater ? !1 : this.isOnGround ? !0 : this.jumpCount < S.MAX_CONSECUTIVE_JUMPS;
        }
        performJump() {
            this.rigidBody.applyImpulse(S.JUMP_IMPULSE, !0), this.jumpCount += 1;
        }
        handleJumpCut(e, t) {
            !(!e && this.wasJumpHeld) || t.y <= 0 || (t.y *= S.JUMP_CUT_MULTIPLIER);
        }
        handleFastFall(e, t, s) {
            if (t.y >= 0) return;
            const a = S.FALL_MULTIPLIER * Math.abs(s) * e;
            t.y -= a;
        }
        clampUpwardVelocity(e) {
            e.y <= S.MAX_UPWARD_VELOCITY || (e.y = S.MAX_UPWARD_VELOCITY);
        }
        updateHorizontalMovement(e) {
            const t = ct.isForward(), s = ct.isBackward(), a = ct.isLeftward(), n = ct.isRightward();
            a && (this.yawInRadians += S.TURN_SPEED * e), n && (this.yawInRadians -= S.TURN_SPEED * e), this.forwardVec.copy(S.FORWARD).applyQuaternion(this.yawQuaternion), this.torqueAxis.crossVectors(S.UP, this.forwardVec).normalize(), this.newLinVel.copy(this.rigidBody.linvel()), this.newAngVel.copy(this.rigidBody.angvel());
            const i = this.isInWater ? S.WATER_MOVEMENT_MULTIPLIER : 1, o = S.LIN_VEL_STRENGTH * e * i, r = S.ANG_VEL_STRENGTH * e * i;
            t && (this.newLinVel.addScaledVector(this.forwardVec, o), this.newAngVel.addScaledVector(this.torqueAxis, r)), s && (this.newLinVel.addScaledVector(this.forwardVec, -o), this.newAngVel.addScaledVector(this.torqueAxis, -r)), (t || s) && (this.rigidBody.setLinvel(this.newLinVel, !0), this.rigidBody.setAngvel(this.newAngVel, !0));
        }
        syncMeshWithBody() {
            me.didStep && (this.prevPosition.copy(this.targetPosition), this.prevQuaternion.copy(this.targetQuaternion), this.targetPosition.copy(this.rigidBody.translation()), this.targetQuaternion.copy(this.rigidBody.rotation()));
            const e = me.alpha;
            this.mesh.position.lerpVectors(this.prevPosition, this.targetPosition, e), this.mesh.quaternion.slerpQuaternions(this.prevQuaternion, this.targetQuaternion, e);
        }
        updateCameraPosition(e) {
            this.desiredCameraPosition.copy(S.CAMERA_OFFSET).applyQuaternion(this.yawQuaternion).add(this.mesh.position);
            const t = S.CAMERA_LERP_FACTOR * e;
            this.smoothedCameraPosition.lerp(this.desiredCameraPosition, t), this.desiredTargetPosition.copy(this.mesh.position), this.desiredTargetPosition.y += 1, this.smoothedCameraTarget.lerp(this.desiredTargetPosition, t), se.playerCamera.position.copy(this.smoothedCameraPosition), se.playerCamera.lookAt(this.smoothedCameraTarget);
        }
        get position() {
            return this.mesh.position;
        }
        get yaw() {
            return this.yawInRadians;
        }
        get radius() {
            return S.RADIUS;
        }
    }
    class jn extends mt {
        constructor(){
            super(), this.createMaterial();
        }
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1, this.castShadowNode = x(.6);
            const e = D(y.resources.playerDiffuse, X()).mul(2), t = A.getBakedShadowFactor(tt.xz), s = T(e.mul(.15), e, t);
            this.colorNode = s;
            const a = D(y.resources.playerNormal, X());
            this.normalNode = nt(a, u(3.5));
        }
    }
    const Ue = {
        uDiffuseScale: c(3.75),
        uNormalScale: c(1.5),
        uAoScale: c(1),
        uMetalnessScale: c(1),
        uRoughnessScale: c(1.5)
    };
    class Gn extends Pt {
        constructor(){
            super(), this.precision = "lowp";
            const e = D(y.resources.dragonSlayerSwordDiffuse, X());
            this.colorNode = e.rgb.mul(Ue.uDiffuseScale);
            const t = D(y.resources.dragonSlayerSwordNormal, X());
            this.normalNode = nt(t.rgb, Ue.uNormalScale);
            const s = D(y.resources.dragonSlayerSwordARM, X());
            this.aoNode = s.r.mul(Ue.uAoScale), this.metalnessNode = s.b.mul(Ue.uMetalnessScale), this.roughnessNode = s.g.mul(Ue.uRoughnessScale);
        }
    }
    class zn {
        constructor(){
            this.debug();
            const e = y.resources.worldModel.scene.getObjectByName("dragon_slayer");
            e.material = new Gn, se.scene.add(e);
            const t = Ie.register({
                name: "Dragon Slayer",
                icon: "sword",
                position: e.position,
                discoveryRadius: 80,
                arrivalRadius: 20
            }), s = Ce.registerTarget("Dragon Slayer", e.position, 20);
            Ie.setWindTargetId(t, s);
        }
        debug() {
            const e = Ge.panel.addFolder({
                title: "🗡️ Berserk",
                expanded: !1
            });
            e.addBinding(Ue.uDiffuseScale, "value", {
                label: "Diffuse scale",
                min: 0
            }), e.addBinding(Ue.uNormalScale, "value", {
                label: "Normal scale",
                min: 0
            }), e.addBinding(Ue.uAoScale, "value", {
                label: "AO scale",
                min: 0
            }), e.addBinding(Ue.uMetalnessScale, "value", {
                label: "Metalness scale",
                min: 0
            }), e.addBinding(Ue.uRoughnessScale, "value", {
                label: "Roughness scale",
                min: 0
            });
        }
    }
    const lt = {
        uDiffuseScale: c(1.15),
        uNormalScale: c(1.5),
        uUvScale: c(4.75)
    };
    class Zn extends Pt {
        constructor(){
            super(), this.precision = "lowp";
            const e = X().mul(lt.uUvScale), t = D(y.resources.concreteDiffuse, e), s = D(y.resources.concreteDiffuse, X()), a = T(x(0), t.rgb, s.a);
            this.colorNode = a.mul(lt.uDiffuseScale);
            const n = D(y.resources.concreteNormal, e);
            this.normalNode = nt(n.rgb, lt.uNormalScale);
        }
    }
    class Hn {
        constructor(){
            this.debug();
            const e = y.resources.worldModel.scene.getObjectByName("goku_statue");
            e.material = new Zn, e.receiveShadow = !0, se.scene.add(e);
            const t = y.resources.worldModel.scene.getObjectByName("goku_statue_collider"), s = .5 * t.scale.x, a = .5 * t.scale.y, n = .5 * t.scale.z, i = Xe.cuboid(s, a, n).setTranslation(...t.position.toArray()).setRotation(t.quaternion).setRestitution(.75);
            me.world.createCollider(i).userData = {
                type: xe.Stone
            };
            const o = Ie.register({
                name: "Goku Statue",
                icon: "dragonball",
                position: e.position,
                discoveryRadius: 80,
                arrivalRadius: 20
            }), r = Ce.registerTarget("Goku statue", e.position, 20);
            Ie.setWindTargetId(o, r);
        }
        debug() {
            const e = Ge.panel.addFolder({
                title: "🐉 Dragon Ball",
                expanded: !1
            });
            e.addBinding(lt.uUvScale, "value", {
                label: "UV scale",
                min: 0
            }), e.addBinding(lt.uDiffuseScale, "value", {
                label: "Diffuse scale",
                min: 0
            }), e.addBinding(lt.uNormalScale, "value", {
                label: "Normal scale",
                min: 0
            });
        }
    }
    const Pe = {
        uDiffuseScale: c(4),
        uNormalScale: c(1.25),
        uAoScale: c(1),
        uMetalnessScale: c(1),
        uRoughnessScale: c(1.5),
        uEmissionScale: c(10)
    };
    class Vn extends Pt {
        constructor(){
            super(), this.precision = "lowp";
            const e = D(y.resources.leviathanAxeDiffuseEmissive, X());
            this.colorNode = e.rgb.mul(Pe.uDiffuseScale);
            const t = js("lightblue").mul(e.a).mul(Pe.uEmissionScale);
            this.emissiveNode = t;
            const s = D(y.resources.leviathanAxeNormal, X());
            this.normalNode = nt(s, Pe.uNormalScale);
            const a = D(y.resources.leviathanAxeORM, X());
            this.aoNode = a.r.mul(Pe.uAoScale), this.metalnessNode = a.b.mul(Pe.uMetalnessScale), this.roughnessNode = a.g.mul(Pe.uRoughnessScale);
        }
    }
    class Yn {
        constructor(){
            this.debug();
            const e = y.resources.worldModel.scene.getObjectByName("leviathan_axe");
            e.material = new Vn, se.scene.add(e);
            const t = Ie.register({
                name: "Leviathan Axe",
                icon: "axe",
                position: e.position,
                discoveryRadius: 80,
                arrivalRadius: 20
            }), s = Ce.registerTarget("Leviathan Axe", e.position, 20);
            Ie.setWindTargetId(t, s);
        }
        debug() {
            const e = Ge.panel.addFolder({
                title: "🪓 God of War",
                expanded: !1
            });
            e.addBinding(Pe.uDiffuseScale, "value", {
                label: "Diffuse scale",
                min: 0
            }), e.addBinding(Pe.uNormalScale, "value", {
                label: "Normal scale",
                min: 0
            }), e.addBinding(Pe.uEmissionScale, "value", {
                label: "Emission scale",
                min: 0
            }), e.addBinding(Pe.uAoScale, "value", {
                label: "AO scale",
                min: 0
            }), e.addBinding(Pe.uMetalnessScale, "value", {
                label: "Metalness scale",
                min: 0
            }), e.addBinding(Pe.uRoughnessScale, "value", {
                label: "Roughness scale",
                min: 0
            });
        }
    }
    class Kn {
        constructor(){
            new Yn, new zn, new Hn;
        }
    }
    const Ee = c(0), Yt = c(0), cs = {
        timeSeconds: 0,
        deltaSeconds: 0,
        reset () {
            this.timeSeconds = 0, this.deltaSeconds = 0, Ee.value = 0, Yt.value = 0;
        },
        update (l) {
            this.deltaSeconds = l, this.timeSeconds += l, Yt.value = l, Ee.value = this.timeSeconds;
        }
    }, re = {
        uGrassTerrainColor: c(new ke().setRGB(.29, .38, .13)),
        uWaterSandColor: c(new ke().setRGB(.7, .55, .29)),
        uTerrainColor: c(new ke().setRGB(.7, .55, .29)),
        uGrassNormalScale: c(1.25),
        uTerrainNormalScale: c(.25),
        uWaterNormalScale: c(.35),
        uCausticsHighlightScale: c(.4),
        uCausticsUv1Scale: c(31.53),
        uCausticsUv2Scale: c(58.71)
    };
    class Xn extends mt {
        constructor(){
            super(), this.createMaterial(), this.debugTerrain();
        }
        debugTerrain() {
            const e = Ge.panel.addFolder({
                title: "⛰️ Terrain",
                expanded: !1
            }), t = e.addFolder({
                title: "Color"
            });
            t.addBinding(re.uTerrainColor, "value", {
                label: "Terrain",
                view: "color",
                color: {
                    type: "float"
                }
            }), t.addBinding(re.uGrassTerrainColor, "value", {
                label: "Grass",
                view: "color",
                color: {
                    type: "float"
                }
            }), t.addBinding(re.uWaterSandColor, "value", {
                label: "Water",
                view: "color",
                color: {
                    type: "float"
                }
            });
            const s = e.addFolder({
                title: "Normal scale"
            });
            s.addBinding(re.uTerrainNormalScale, "value", {
                label: "Terrain"
            }), s.addBinding(re.uGrassNormalScale, "value", {
                label: "Grass"
            }), s.addBinding(re.uWaterNormalScale, "value", {
                label: "Water"
            });
            const a = e.addFolder({
                title: "Caustics"
            });
            a.addBinding(re.uCausticsUv1Scale, "value", {
                label: "UV 1 scale",
                min: 0,
                max: 100,
                step: .001
            }), a.addBinding(re.uCausticsUv2Scale, "value", {
                label: "UV 2 scale",
                min: 0,
                max: 100,
                step: .001
            }), a.addBinding(re.uCausticsHighlightScale, "value", {
                label: "Highlight scale",
                min: 0,
                max: 1,
                step: .001
            });
        }
        createMaterial() {
            this.precision = "lowp";
            const e = A.computeMapUvByPosition(tt.xz), t = D(y.resources.noiseAtlas, e.mul(10)), s = Gs(e), a = D(y.resources.grassMap, s).r, n = V(0, .2, a.mul(t.b)), i = T(re.uTerrainColor, re.uGrassTerrainColor, t.b), o = T(re.uTerrainColor, i, n), r = D(y.resources.waterMap, s).r, d = tt.y.negate(), h = V(0, 8, d), p = x(.35, .45, .55).mul(.65), _ = Ee.mul(.15), g = s.mul(re.uCausticsUv1Scale).add(de(_, 0)).fract(), f = D(y.resources.noiseAtlas, g, 1).a, v = s.mul(re.uCausticsUv2Scale).add(de(0, _.negate())).fract(), M = D(y.resources.noiseAtlas, v, 3).a, C = f.add(M), R = C.mul(C).mul(C), N = V(-1, 7.5, d), k = R.mul(u(1).sub(N)), P = x(.3, .4, .5).mul(re.uCausticsHighlightScale), j = x(0, 0, 0), U = T(j, P, k), ae = V(0, 1.5, d), ge = x(1, .9, .7).mul(.1).mul(ae), I = T(re.uWaterSandColor, p, h).add(ge).add(U), L = T(o, I, r), Y = A.getBakedShadowFactor(tt.xz), $ = T(L.mul(.5), L, Y);
            this.colorNode = $;
            const W = D(y.resources.terrainNormAo, s.mul(41.7)), ne = T(re.uTerrainNormalScale, re.uGrassNormalScale, n), fe = T(ne, re.uWaterNormalScale, r);
            this.normalNode = nt(W.rgb, fe), this.aoNode = W.a;
        }
    }
    class $n {
        constructor(e){
            const t = this.createFloor(e);
            se.scene.add(t);
        }
        createFloor(e) {
            const t = y.resources.worldModel.scene.children.filter((n)=>n.name.startsWith("terrain-") && n.name !== "terrain-outer");
            let s;
            const a = new zs;
            for (const n of t)n.name === "terrain-heightfield" ? s = n : (n.material = e, n.geometry.computeBoundingSphere(), n.geometry.computeBoundingBox(), n.receiveShadow = !0, a.add(n));
            if (!s) throw new Error("No heightfield");
            return this.createFloorPhysics(s), a;
        }
        getFloorDisplacementData(e) {
            const t = e.geometry.attributes._displacement.array[0], s = e.geometry.attributes.position;
            e.geometry.boundingBox || e.geometry.computeBoundingBox();
            const a = e.geometry.boundingBox, n = s.count, i = Math.sqrt(n), o = a.max.x, r = new Float32Array(n);
            for(let d = 0; d < n; d++){
                const h = s.array[d * 3 + 0], p = s.array[d * 3 + 1], _ = s.array[d * 3 + 2], g = Math.round((h / (o * 2) + .5) * (i - 1)), v = Math.round((_ / (o * 2) + .5) * (i - 1)) + g * i;
                r[v] = p;
            }
            return {
                rowsCount: i,
                heights: r,
                displacement: t
            };
        }
        createDisplacementTexture(e, t, s) {
            const a = e, n = new Float32Array(t.length);
            let i = 0, o = 0;
            for(let d = 0; d < a; d++)for(let h = 0; h < a; h++){
                const g = a - 1 - d + h * a, f = h + d * a, v = t[g] - s;
                n[f] = v, v < i && (i = v), v > o && (o = v);
            }
            const r = new hs(n, a, a, Zs, Hs);
            return r.colorSpace = Zt, r.magFilter = Ye, r.minFilter = Ye, r.generateMipmaps = !1, r.needsUpdate = !0, r.userData = {
                min: i,
                max: o
            }, r;
        }
        createFloorPhysics(e) {
            const t = this.getFloorDisplacementData(e), { rowsCount: s, heights: a, displacement: n } = t, i = this.createDisplacementTexture(s, a, n);
            y.resources.heightmap.copy(i);
            const o = Xe.heightfield(s - 1, s - 1, a, {
                x: he.MAP_SIZE,
                y: 1,
                z: he.MAP_SIZE
            }, ja.FIX_INTERNAL_EDGES).setTranslation(0, -n, 0).setFriction(1).setRestitution(.2);
            return me.world.createCollider(o).userData = {
                type: xe.Terrain
            }, n;
        }
    }
    class qn {
        outerFloor;
        kintoun;
        kintounPosition = new B;
        constructor(e){
            this.outerFloor = this.createOuterFloorVisual(), this.outerFloor.material = e, this.kintoun = this.createKintoun(), se.scene.add(this.outerFloor), z.on("engine-update", this.update.bind(this));
        }
        createOuterFloorVisual() {
            const e = y.resources.worldModel.scene.getObjectByName("terrain-outer");
            return e.frustumCulled = !1, e;
        }
        createKintoun() {
            const e = bs.kinematicPositionBased().setTranslation(0, -20, 0), t = me.world.createRigidBody(e), s = 2, a = Xe.cuboid(s, he.HALF_FLOOR_THICKNESS, s).setFriction(1).setRestitution(.2);
            return me.world.createCollider(a, t).userData = {
                type: xe.Terrain
            }, t;
        }
        useKintoun(e) {
            this.kintounPosition.copy(e).setY(-he.HALF_FLOOR_THICKNESS), this.kintoun.setTranslation(this.kintounPosition, !0);
        }
        update(e) {
            const { player: t } = e, s = he.HALF_MAP_SIZE - Math.abs(t.position.x) < he.KINTOUN_ACTIVATION_THRESHOLD, a = he.HALF_MAP_SIZE - Math.abs(t.position.z) < he.KINTOUN_ACTIVATION_THRESHOLD;
            (s || a) && this.useKintoun(t.position);
            const n = he.MAP_SIZE, i = Math.abs(t.position.x), o = Math.sign(t.position.x), r = Math.abs(t.position.z), d = Math.sign(t.position.z), h = i > n ? i - n : 0, p = r > n ? r - n : 0;
            this.outerFloor.position.set(h * o, 0, p * d);
        }
    }
    class Jn {
        constructor(){
            const e = new Xn;
            new $n(e), new qn(e);
        }
    }
    class Ze {
        static computeStochasticKeep = b(([e = x(0), t = x(0), s = u(0), a = u(0), n = u(0)], i)=>{
            const o = e.x.sub(t.x), r = e.z.sub(t.z), d = o.mul(o).add(r.mul(r)), h = s.mul(s), p = a.mul(a), _ = d.sub(h).div(Kt(p.sub(h), It)).clamp(), g = T(1, n, _), f = pe(u(E).mul(.73));
            return ce(f, g);
        });
        static computeVisibility = b(([e = x(0), t = Vs(), s = u(0), a = u(0), n = u(0), i = u(0), o = u(0), r = u(0)], d)=>{
            const h = u(1), p = t.mul(J(e, 1)), _ = h.div(p.w), g = p.xyz.mul(_), f = p.w.abs().max(It), v = s.mul(n).div(f).add(i), M = a.mul(n).div(f), C = M.add(o), R = M.sub(r), N = ce(h.negate().sub(v), g.x), k = ce(g.x, h.add(v)), P = N.mul(k), j = ce(h.negate().sub(C), g.y), U = ce(g.y.add(R), h), ae = j.mul(U), ge = ce(-1, g.z).mul(ce(g.z, 1));
            return P.mul(ae).mul(ge);
        });
        static computeAlpha = b(([e = x(0)], t)=>{
            const s = A.computeMapUvByPosition(e.xz), a = D(y.resources.grassMap, s).g;
            return ce(.25, a);
        });
        static computeYOffset = b(([e = x(0)], t)=>{
            const s = A.computeMapUvByPosition(e.xz), a = de(s.x, u(1).sub(s.y));
            return D(y.resources.heightmap, a).r;
        });
        static wrapPosition = b(([e = de(0), t = de(0), s = u(0)], a)=>{
            const n = s.div(2), i = Ct(e.x.sub(t.x).add(n), s).sub(n), o = Ct(e.y.sub(t.y).add(n), s).sub(n);
            return x(i, 0, o);
        });
    }
    const Qn = ()=>({
            SEGMENTS: 4,
            BLADE_WIDTH: .06,
            BLADE_HEIGHT: 1.75,
            BLADE_BOUNDING_SPHERE_RADIUS: 1.75,
            TILE_SIZE: 130,
            TILE_HALF_SIZE: 130 / 2,
            BLADES_PER_SIDE: 1088,
            COUNT: 1088 * 1088,
            SPACING: 130 / 1088,
            WORKGROUP_SIZE: 64
        }), H = Qn(), m = {
        uCameraMatrix: c(new Xt),
        uFx: c(1),
        uFy: c(1),
        uCullPadNDCX: c(.075),
        uCullPadNDCYNear: c(.75),
        uCullPadNDCYFar: c(.2),
        uPlayerPosition: c(new B(0, 0, 0)),
        uPlayerDeltaXZ: c(new et(0, 0)),
        uPlayerRadius: c(.5),
        uCameraForward: c(new B(0, 0, 0)),
        uSunDir: c(new B(0)),
        uBladeMinScale: c(.75),
        uBladeMaxScale: c(2),
        uTrailGrowthRate: c(.04),
        uTrailMinScale: c(.25),
        uTrailRadius: c(1),
        uTrailRadiusSquared: c(1),
        uKDown: c(.4),
        uWindStrength: c(.4),
        uWindSpeed: c(.25),
        uvWindScale: c(1.75),
        uBaseColor: c(new ke().setRGB(.55, .42, .19)),
        uTipColor: c(new ke().setRGB(.29, .47, .04)),
        uColorMixFactor: c(.125),
        uColorVariationStrength: c(2.75),
        uAoScale: c(.5),
        uAoRimSmoothness: c(5),
        uAoRadius: c(25),
        uAoRadiusSquared: c(625),
        uWindColorStrength: c(.6),
        uBaseWindShade: c(.75),
        uBaseShadeHeight: c(1),
        uR0: c(10),
        uR1: c(60),
        uPMin: c(.1),
        uBaseBending: c(2)
    };
    class ei {
        buffer1 = ht(H.COUNT, "vec4");
        buffer2 = ht(H.COUNT, "float");
        constructor(){
            this.computeUpdate.onInit(({ renderer: e })=>{
                e.computeAsync(this.computeInit);
            });
        }
        get computeBuffer1() {
            return this.buffer1;
        }
        get computeBuffer2() {
            return this.buffer2;
        }
        getYOffset = b(([e = u(0)], t)=>A.unpackUnits(e, 5, 19, 0, Math.ceil(y.resources.heightmap.userData.max)));
        getWind = b(([e = J(0)], t)=>{
            const s = A.unpackUnits(e.z, 0, 12, -2, 2), a = A.unpackUnits(e.z, 12, 12, -2, 2);
            return de(s, a);
        });
        getScale = b(([e = J(0)], t)=>A.unpackUnits(e.w, 0, 8, m.uTrailMinScale, m.uBladeMaxScale));
        getOriginalScale = b(([e = J(0)], t)=>A.unpackUnits(e.w, 8, 8, m.uBladeMinScale, m.uBladeMaxScale));
        getVisibility = b(([e = J(0)], t)=>A.unpackFlag(e.w, 17));
        getWindNoise = b(([e = J(0)], t)=>A.unpackUnit(e.w, 18, 6));
        getPositionNoise = b(([e = u(0)], t)=>A.unpackUnit(e, 0, 4));
        getShadowFactor = b(([e = J(0)], t)=>A.unpackFlag(e.w, 16));
        getIsFar = b(([e = u(0)], t)=>A.unpackFlag(e, 4));
        setYOffset = b(([e = u(0), t = u(0)], s)=>A.packUnits(e, 5, 19, t, 0, Math.ceil(y.resources.heightmap.userData.max)));
        setWind = b(([e = J(0), t = de(0)], s)=>(e.z = A.packUnits(e.z, 0, 12, t.x, -2, 2), e.z = A.packUnits(e.z, 12, 12, t.y, -2, 2), e));
        setScale = b(([e = J(0), t = u(0)], s)=>(e.w = A.packUnits(e.w, 0, 8, t, m.uTrailMinScale, m.uBladeMaxScale), e));
        setOriginalScale = b(([e = J(0), t = u(0)], s)=>(e.w = A.packUnits(e.w, 8, 8, t, m.uBladeMinScale, m.uBladeMaxScale), e));
        setVisibility = b(([e = J(0), t = u(0)], s)=>(e.w = A.packFlag(e.w, 17, t), e));
        setWindNoise = b(([e = J(0), t = u(0)], s)=>(e.w = A.packUnit(e.w, 18, 6, t), e));
        setPositionNoise = b(([e = u(0), t = u(0)], s)=>A.packUnit(e, 0, 4, t));
        setShadowFactor = b(([e = J(0), t = u(0)], s)=>(e.w = A.packFlag(e.w, 16, t), e));
        setIsFar = b(([e = u(0), t = u(0)], s)=>A.packFlag(e, 4, t));
        computeInit = b(()=>{
            const e = this.buffer1.element(E), t = this.buffer2.element(E), s = dt(u(E).div(H.BLADES_PER_SIDE)), a = u(E).mod(H.BLADES_PER_SIDE), n = pe(E.add(4321)), i = pe(E.add(1234)), o = a.mul(H.SPACING).sub(H.TILE_HALF_SIZE).add(n.mul(H.SPACING * .5)), r = s.mul(H.SPACING).sub(H.TILE_HALF_SIZE).add(i.mul(H.SPACING * .5)), d = x(o, 0, r).xz.add(H.TILE_HALF_SIZE).div(H.TILE_SIZE).abs().fract(), h = D(y.resources.noiseAtlas, d), p = h.b.sub(.5), _ = p.mul(17).fract(), g = p.mul(13).fract();
            e.x = o.add(_), e.y = r.add(g), t.assign(this.setPositionNoise(t, h.g));
            const f = h.b, v = f.mul(f), M = Ks(v, 0, 1, m.uBladeMinScale, m.uBladeMaxScale);
            e.assign(this.setScale(e, M)), e.assign(this.setOriginalScale(e, M));
        })().compute(H.COUNT, [
            H.WORKGROUP_SIZE
        ]);
        computeWind = b(([e = de(0), t = x(0), s = u(0)], a)=>{
            const n = Ce.uDirection.negate(), i = T(m.uWindStrength, 1.5, Ce.uIntensity), o = m.uWindSpeed.mul(s.remap(0, 1, .95, 2.05)), r = t.xz.mul(.01).mul(m.uvWindScale), d = n.mul(o).mul(Ee), h = r.add(d), p = D(y.resources.noiseAtlas, h).mul(2).sub(1), _ = r.mul(1.37).add(d.mul(1.11)), g = D(y.resources.noiseAtlas, _).mul(2).sub(1), f = Xs(at(s.mul(12.9898)).mul(78.233)), v = at(Ee.mul(.4).add(s.mul(.1))).mul(.25), M = us(f.add(v), .2, .8), C = T(p, g, M), R = C.r.mul(i), N = C.g.mul(i).mul(.35), k = R.add(N), P = n.mul(k), j = T(.08, .25, $s(C.b)), U = e.add(P.sub(e).mul(j));
            return x(U, k);
        });
        computeTrailScale = b(([e = u(0), t = u(0), s = u(0)], a)=>{
            const n = t.add(e.sub(t).mul(m.uTrailGrowthRate)), i = t.add(m.uTrailMinScale.sub(t).mul(m.uKDown));
            return T(n, i, s);
        });
        computeShadowFactor = b(([e = x(0), t = x(0)], s)=>{
            const a = A.getBakedShadowFactor(e.xz), i = t.y.sub(m.uPlayerRadius).sub(e.y), o = V(0, 2, i), r = A.getPlayerShadowFactor(e, t, m.uPlayerRadius, m.uSunDir), d = T(u(1), r, o);
            return ce(.5, a).mul(d);
        });
        computeUpdate = b(()=>{
            const e = this.buffer1.element(E), t = this.buffer2.element(E), s = Ze.wrapPosition(de(e.x, e.y), m.uPlayerDeltaXZ, H.TILE_SIZE);
            e.x = s.x, e.y = s.z;
            const a = s.add(m.uPlayerPosition), n = Ze.computeStochasticKeep(a, m.uPlayerPosition, m.uR0, m.uR1, m.uPMin), i = Ze.computeVisibility(a, m.uCameraMatrix, m.uFx, m.uFy, H.BLADE_BOUNDING_SPHERE_RADIUS, m.uCullPadNDCX, m.uCullPadNDCYNear, m.uCullPadNDCYFar).mul(n);
            e.assign(this.setVisibility(e, i)), e.assign(this.setShadowFactor(e, 1)), t.assign(this.setIsFar(t, 0)), ms(i, ()=>{
                const o = Ze.computeAlpha(a);
                e.assign(this.setVisibility(e, o));
                const r = Ze.computeYOffset(a);
                t.assign(this.setYOffset(t, r));
                const d = a.xz.sub(m.uPlayerPosition.xz), h = d.dot(d);
                t.assign(this.setIsFar(t, h.lessThan(100).toFloat()));
                const p = ce(.1, u(1).sub(m.uPlayerPosition.y.sub(r))), _ = m.uTrailRadiusSquared.mul(.35), g = m.uTrailRadiusSquared, f = u(1).sub(V(_, g, h)).mul(p), v = this.getScale(e), M = this.getOriginalScale(e), C = this.computeTrailScale(M, v, f);
                e.assign(this.setScale(e, C));
                const R = this.getPositionNoise(t), N = this.getWind(e), k = this.computeWind(N, a, R);
                e.assign(this.setWind(e, k.xy)), e.assign(this.setWindNoise(e, k.z));
                const P = x(a.x, r, a.z), j = this.computeShadowFactor(P, m.uPlayerPosition);
                e.assign(this.setShadowFactor(e, j));
            });
        })().compute(H.COUNT, [
            H.WORKGROUP_SIZE
        ]);
    }
    class ti extends $t {
        ssbo;
        constructor(e){
            super(), this.ssbo = e, this.createGrassMaterial();
        }
        createGrassMaterial() {
            this.precision = "lowp", this.transparent = !1, this.stencilWrite = !1, this.forceSinglePass = !0;
            const e = this.ssbo.computeBuffer1.element(E), t = this.ssbo.computeBuffer2.element(E), s = e.x, a = this.ssbo.getYOffset(t), n = e.y, i = this.ssbo.getWind(e), o = this.ssbo.getScale(e), r = this.ssbo.getVisibility(e), d = this.ssbo.getWindNoise(e), h = this.ssbo.getPositionNoise(t), p = this.ssbo.getShadowFactor(e);
            this.ssbo.getIsFar(t), this.opacityNode = r;
            const _ = h.remap(0, 1, .5, 1.5), g = x(_, o, 1);
            this.scaleNode = T(x(0), g, r);
            const f = pe(E.add(196.4356)).sub(.5).mul(.25), v = X().y, M = v.mul(v).mul(m.uBaseBending), C = h.sub(.5).mul(.25).add(f).mul(M);
            this.rotationNode = x(C, 0, 0);
            const R = m.uCameraForward.mul(ps).mul(u(1).sub(r)), N = x(s, a, n), k = h.mul(Ke), P = at(Ee.mul(5).add(k)).mul(.15), j = X().y.mul(d), U = P.mul(j), ae = Ce.uDirection, ge = de(ae.y.negate(), ae.x), Ae = pe(E).mul(Ke), I = at(Ee.mul(m.uWindSpeed.mul(1.7)).add(Ae.mul(1.3))).mul(.06).mul(M), L = x(ge.x, 0, ge.y).mul(I), Y = u(1).sub(v.mul(v)).mul(Ce.uIntensity).mul(.25), $ = x(i.x, Y, i.y).mul(M), W = N.add(R).add(U).add(L).add($);
            this.positionNode = W;
            const ne = s.mul(s).add(n.mul(n)), fe = u(1).sub(V(0, m.uAoRadiusSquared, ne)), Q = X().x.mul(2).sub(1).abs(), q = V(m.uAoRimSmoothness.negate(), m.uAoRimSmoothness, Q), K = u(1).sub(V(.1, .85, v)), ee = m.uAoScale.mul(.25), Re = u(1).sub(ee.mul(fe.mul(q).mul(K))), De = v.mul(m.uColorMixFactor), Be = V(0, m.uColorVariationStrength, h), Ne = m.uBaseColor.mul(Be), ue = T(Ne, m.uTipColor, De), Fe = u(1).sub(V(0, m.uBaseShadeHeight, v)), Se = T(1, u(1).sub(m.uBaseWindShade), Fe.mul(V(0, 1, j))), F = T(ue.mul(.5), ue, p);
            this.colorNode = F.mul(Se).mul(Re);
        }
    }
    class si {
        isComputeInFlight = !1;
        constructor(){
            m.uSunDir.value.copy(Tt.sunDirection);
            const e = new ei, t = this.createGeometry(H.SEGMENTS), s = new ti(e), a = new ut(t, s, H.COUNT);
            a.frustumCulled = !1, se.scene.add(a), z.on("engine-update-throttle-2x", ({ player: n })=>{
                const i = n.position.x - a.position.x, o = n.position.z - a.position.z;
                m.uPlayerDeltaXZ.value.set(i, o), m.uPlayerPosition.value.copy(n.position), m.uPlayerRadius.value = n.radius;
                const r = se.playerCamera.projectionMatrix;
                m.uFx.value = r.elements[0], m.uFy.value = r.elements[5], m.uCameraMatrix.value.copy(r).multiply(se.playerCamera.matrixWorldInverse), se.playerCamera.getWorldDirection(m.uCameraForward.value), a.position.copy(n.position).setY(0), !this.isComputeInFlight && (this.isComputeInFlight = !0, $e.renderer.computeAsync(e.computeUpdate).catch((d)=>{
                    console.error("[Grass] computeAsync failed:", d);
                }).finally(()=>{
                    this.isComputeInFlight = !1;
                }));
            }), this.debugGrass();
        }
        debugGrass() {
            const e = Ge.panel.addFolder({
                title: "🌱 Grass",
                expanded: !1
            }), t = e.addFolder({
                title: "Color"
            });
            t.addBinding(m.uTipColor, "value", {
                label: "Tip",
                view: "color",
                color: {
                    type: "float"
                }
            }), t.addBinding(m.uBaseColor, "value", {
                label: "Base",
                view: "color",
                color: {
                    type: "float"
                }
            }), t.addBinding(m.uColorMixFactor, "value", {
                label: "Mix factor",
                min: 0,
                max: 1,
                step: .01
            }), t.addBinding(m.uColorVariationStrength, "value", {
                label: "Variation strength",
                min: 0,
                max: 3,
                step: .01
            }), t.addBinding(m.uWindColorStrength, "value", {
                label: "Wind color strength",
                min: 0,
                max: 1,
                step: .01
            }), t.addBinding(m.uBaseWindShade, "value", {
                label: "Wind shade strength",
                min: 0,
                max: 2,
                step: .01
            }), t.addBinding(m.uBaseShadeHeight, "value", {
                label: "Wind shade height",
                min: 0,
                max: 10,
                step: .01
            }), t.addBinding(m.uAoScale, "value", {
                label: "AO scale",
                min: 0,
                max: 5,
                step: .01
            }), t.addBinding(m.uAoRimSmoothness, "value", {
                label: "AO rim smoothness",
                min: 0,
                max: 5,
                step: .01
            }), t.addBinding(m.uAoRadius, "value", {
                label: "AO radius",
                min: 0,
                max: 100,
                step: .01
            }).on("change", ({ value: o })=>{
                m.uAoRadiusSquared.value = o * o;
            });
            const s = e.addFolder({
                title: "Wind"
            });
            s.addBinding(m.uWindStrength, "value", {
                label: "Strength",
                min: 0,
                max: Math.PI,
                step: .01
            }), s.addBinding(m.uWindSpeed, "value", {
                label: "Speed",
                min: 0,
                max: 1,
                step: .01
            }), s.addBinding(m.uvWindScale, "value", {
                label: "UV scale",
                step: .01,
                min: 0,
                max: 10
            });
            const a = e.addFolder({
                title: "Stochastic keep"
            });
            a.addBinding(m.uR0, "value", {
                label: "Inner ring",
                min: 0,
                max: H.TILE_SIZE,
                step: .1
            }), a.addBinding(m.uR1, "value", {
                label: "Outer ring",
                min: 0,
                max: H.TILE_SIZE,
                step: .1
            }), a.addBinding(m.uPMin, "value", {
                label: "P Min",
                min: 0,
                max: 1,
                step: .01
            });
            const n = e.addFolder({
                title: "Trail"
            });
            n.addBinding(m.uTrailGrowthRate, "value", {
                label: "Growth rate",
                min: 0,
                max: .1,
                step: .001
            }), n.addBinding(m.uTrailMinScale, "value", {
                label: "Min scale",
                min: 0,
                max: 1,
                step: .01
            }), n.addBinding(m.uKDown, "value", {
                label: "Crushing speed",
                min: 0,
                max: 5,
                step: .01
            }), n.addBinding(m.uTrailRadius, "value", {
                label: "Trail radius",
                min: 0,
                max: 2,
                step: .01
            }).on("change", ({ value: o })=>{
                m.uTrailRadiusSquared.value = o * o;
            });
            const i = e.addFolder({
                title: "General"
            });
            i.addBinding(m.uBaseBending, "value", {
                label: "Base bend",
                min: -Math.PI * 2,
                max: Math.PI * 2,
                step: .01
            }), i.addBinding(m.uBladeMinScale, "value", {
                label: "Min scale",
                min: 0,
                max: 5,
                step: .01
            }), i.addBinding(m.uBladeMaxScale, "value", {
                label: "Max scale",
                min: 0,
                max: 5,
                step: .01
            }), i.addBinding(m.uCullPadNDCX, "value", {
                label: "Cull pad X",
                min: 0,
                max: .5,
                step: .001
            }), i.addBinding(m.uCullPadNDCYNear, "value", {
                label: "Cull pad Y (near)",
                min: 0,
                max: 1,
                step: .001
            }), i.addBinding(m.uCullPadNDCYFar, "value", {
                label: "Cull pad Y (far)",
                min: 0,
                max: 1,
                step: .001
            });
        }
        createGeometry(e) {
            const t = Math.max(1, Math.floor(e)), s = H.BLADE_HEIGHT, a = H.BLADE_WIDTH * .5, n = t, i = n * 2 + 1, r = Math.max(0, n - 1) * 6 + 3, d = new Float32Array(i * 3), h = new Float32Array(i * 2), p = new Uint8Array(r), _ = new Float32Array(i * 3), g = (U)=>a * (1 - .7 * U);
            let f = 0;
            for(let U = 0; U < n; U++){
                const ae = U / t, ge = ae * s, Ae = g(ae), I = U * 2, L = I + 1;
                if (d[3 * I + 0] = -Ae, d[3 * I + 1] = ge, d[3 * I + 2] = 0, d[3 * L + 0] = Ae, d[3 * L + 1] = ge, d[3 * L + 2] = 0, h[2 * I + 0] = 0, h[2 * I + 1] = ae, h[2 * L + 0] = 1, h[2 * L + 1] = ae, U > 0) {
                    const Y = (U - 1) * 2, $ = Y + 1;
                    p[f++] = Y, p[f++] = $, p[f++] = L, p[f++] = Y, p[f++] = L, p[f++] = I;
                }
            }
            const v = n * 2;
            d[3 * v + 0] = 0, d[3 * v + 1] = s, d[3 * v + 2] = 0, h[2 * v + 0] = .5, h[2 * v + 1] = 1;
            const M = (n - 1) * 2, C = M + 1;
            p[f++] = M, p[f++] = C, p[f++] = v;
            const R = new Ys, N = new Mt(d, 3);
            N.setUsage(_t), R.setAttribute("position", N);
            const k = new Mt(h, 2);
            k.setUsage(_t), R.setAttribute("uv", k);
            const P = new Mt(p, 1);
            P.setUsage(_t), R.setIndex(P);
            const j = new Mt(_, 3);
            return j.setUsage(_t), R.setAttribute("normal", j), R;
        }
    }
    const ai = ()=>({
            MIN_SCALE: .125,
            MAX_SCALE: .2,
            FLOWER_WIDTH: .5,
            FLOWER_HEIGHT: 1,
            FLOWER_BOUNDING_SPHERE_RADIUS: 1,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            FLOWERS_PER_SIDE: 64,
            COUNT: 4096,
            SPACING: 150 / 64,
            WORKGROUP_SIZE: 64
        }), oe = ai(), te = {
        uPlayerDeltaXZ: c(new et(0, 0)),
        uPlayerPosition: c(new B(0, 0, 0)),
        uCameraForward: c(new B(0, 0, 0)),
        uCameraMatrix: c(new Xt),
        uFx: c(1),
        uFy: c(1),
        uCullPadNDCX: c(.075),
        uCullPadNDCYNear: c(.75),
        uCullPadNDCYFar: c(.2),
        uColor1: c(new ke().setRGB(.02, .14, .33)),
        uColor2: c(new ke().setRGB(.99, .64, 0)),
        uColorStrength: c(.275)
    };
    class ni {
        buffer = ht(oe.COUNT, "vec4");
        constructor(){
            this.computeUpdate.onInit(({ renderer: e })=>{
                e.computeAsync(this.computeInit);
            });
        }
        get computeBuffer() {
            return this.buffer;
        }
        getYOffset = b(([e = J(0)], t)=>A.unpackUnits(e.z, 0, 12, 0, Math.ceil(y.resources.heightmap.userData.max)));
        getVisibility = b(([e = J(0)], t)=>A.unpackFlag(e.z, 12));
        getNoise = b(([e = J(0)], t)=>{
            const s = A.unpackUnit(e.w, 0, 6), a = A.unpackUnit(e.w, 6, 6), n = A.unpackUnit(e.w, 12, 6), i = A.unpackUnit(e.w, 18, 6);
            return J(s, a, n, i);
        });
        setYOffset = b(([e = J(0), t = u(0)], s)=>(e.z = A.packUnits(e.z, 0, 12, t, 0, Math.ceil(y.resources.heightmap.userData.max)), e));
        setVisibility = b(([e = J(0), t = u(0)], s)=>(e.z = A.packFlag(e.z, 12, t), e));
        setNoise = b(([e = J(0), t = J(0)], s)=>(e.w = A.packUnit(e.w, 0, 6, t.x), e.w = A.packUnit(e.w, 6, 6, t.y), e.w = A.packUnit(e.w, 12, 6, t.z), e.w = A.packUnit(e.w, 18, 6, t.a), e));
        computeInit = b(()=>{
            const e = this.buffer.element(E), t = dt(u(E).div(oe.FLOWERS_PER_SIDE)), s = u(E).mod(oe.FLOWERS_PER_SIDE), a = pe(E.add(4321)), n = pe(E.add(1234)), i = s.mul(oe.SPACING).sub(oe.TILE_HALF_SIZE).add(a.mul(oe.SPACING * .5)), o = t.mul(oe.SPACING).sub(oe.TILE_HALF_SIZE).add(n.mul(oe.SPACING * .5)), r = x(i, 0, o).xz.add(oe.TILE_HALF_SIZE).div(oe.TILE_SIZE).abs(), d = D(y.resources.noiseAtlas, r);
            e.assign(this.setNoise(e, d));
            const h = d.r, p = h.mul(99.37), _ = h.mul(49.71);
            e.x = i.add(p), e.y = o.add(_);
        })().compute(oe.COUNT, [
            oe.WORKGROUP_SIZE
        ]);
        computeUpdate = b(()=>{
            const e = this.buffer.element(E), t = Ze.wrapPosition(de(e.x, e.y), te.uPlayerDeltaXZ, oe.TILE_SIZE);
            e.x = t.x, e.y = t.z;
            const s = t.add(te.uPlayerPosition), a = Ze.computeVisibility(s, te.uCameraMatrix, te.uFx, te.uFy, oe.FLOWER_BOUNDING_SPHERE_RADIUS, te.uCullPadNDCX, te.uCullPadNDCYNear, te.uCullPadNDCYFar);
            e.assign(this.setVisibility(e, a)), ms(a, ()=>{
                const n = Ze.computeYOffset(s);
                e.assign(this.setYOffset(e, n));
                const i = Ze.computeAlpha(s);
                e.assign(this.setVisibility(e, i));
            });
        })().compute(oe.COUNT, [
            oe.WORKGROUP_SIZE
        ]);
    }
    class ii {
        isComputeInFlight = !1;
        constructor(){
            const e = new ni, t = new oi(e), s = new ut(new gs(1, 1), t, oe.COUNT);
            se.scene.add(s), this.debug(), z.on("engine-update-throttle-16x", ({ player: a })=>{
                const n = a.position.x - s.position.x, i = a.position.z - s.position.z;
                te.uPlayerDeltaXZ.value.set(n, i), te.uPlayerPosition.value.copy(a.position);
                const o = se.playerCamera.projectionMatrix;
                te.uFx.value = o.elements[0], te.uFy.value = o.elements[5], te.uCameraMatrix.value.copy(o).multiply(se.playerCamera.matrixWorldInverse), se.playerCamera.getWorldDirection(te.uCameraForward.value), s.position.copy(a.position).setY(0), !this.isComputeInFlight && (this.isComputeInFlight = !0, $e.renderer.computeAsync(e.computeUpdate).catch((r)=>{
                    console.error("[Flowers] computeAsync failed:", r);
                }).finally(()=>{
                    this.isComputeInFlight = !1;
                }));
            });
        }
        debug() {
            const e = Ge.panel.addFolder({
                title: "🌸 Flowers",
                expanded: !1
            });
            e.addBinding(te.uColor1, "value", {
                label: "Color 1",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(te.uColor2, "value", {
                label: "Color 2",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(te.uColorStrength, "value", {
                label: "Color strength",
                min: 0
            });
        }
    }
    class oi extends $t {
        ssbo;
        constructor(e){
            super(), this.ssbo = e, this.createFlowersMaterial();
        }
        createFlowersMaterial() {
            this.precision = "lowp", this.stencilWrite = !1, this.forceSinglePass = !0, this.transparent = !1;
            const e = this.ssbo.computeBuffer.element(E), t = this.ssbo.getVisibility(e), s = e.x, a = this.ssbo.getYOffset(e), n = e.y, i = pe(E.add(9234)), o = pe(E.add(33.87)), r = Ce.uIntensity, d = Ce.uDirection, h = Ee.add(Yt.mul(u(2).add(r.mul(.25)))), p = at(h.add(i.mul(100))).mul(.25), _ = o.mul(.5), g = fs(h.mul(2).add(o.mul(33.76))).mul(.15), f = x(p, _, g), v = te.uCameraForward.mul(ps).mul(u(1).sub(t)), M = s.add(d.x.mul(r).mul(.5)), C = i.add(o).add(.25).clamp(), R = a.add(C), N = n.add(d.y.mul(r).mul(.5)), k = x(M, R, N);
            this.positionNode = k.add(f).add(v), this.scaleNode = x(i.remap(0, 1, oe.MIN_SCALE, oe.MAX_SCALE));
            const P = D(y.resources.edelweiss, X()), j = T(te.uColor1, te.uColor2, o), U = ce(o, i).mul(2).sub(1), ae = T(j, P.rgb, i.add(o.mul(U)));
            this.colorNode = ae.mul(te.uColorStrength), this.opacityNode = t.mul(P.a), this.alphaTest = .15;
        }
    }
    const We = {
        uCanopyDiffuseScale: c(.6),
        uCanopySwaySpeed: c(.75),
        uBarkDiffuseScale: c(3.5),
        uBarkNormalScale: c(3),
        uBarkUvScale: c(3)
    }, zt = {
        chunkSize: he.MAP_SIZE / 4
    };
    class ri extends mt {
        constructor(){
            super(), this.precision = "lowp", this.forceSinglePass = !0;
            const e = qs("_windweight"), t = D(y.resources.pineTreeDiffuse, X());
            this.colorNode = t.rgb.mul(We.uCanopyDiffuseScale), this.opacityNode = t.a, this.alphaTest = .35;
            const s = X().x.mul(X().y).mul(4), a = e.mul(e), n = Ee.mul(We.uCanopySwaySpeed).add(s), i = Js(n).mul(a).mul(.1);
            this.positionNode = qt.add(x(0, i, 0));
        }
    }
    class li extends mt {
        constructor(){
            super(), this.precision = "lowp", this.forceSinglePass = !0;
            const e = X().mul(We.uBarkUvScale), t = D(y.resources.treeBarkDiffuse, e);
            this.colorNode = t.rgb.mul(We.uBarkDiffuseScale), this.opacityNode = t.a, this.alphaTest = .35;
            const s = D(y.resources.treeBarkNormal, e);
            this.normalNode = nt(s, We.uBarkNormalScale);
        }
    }
    class ci {
        constructor(){
            this.debug();
            const e = y.resources.worldModel.scene.getObjectByName("pine_tree_canopy"), t = y.resources.worldModel.scene.getObjectByName("pine_tree_bark"), s = y.resources.worldModel.scene.children.filter(({ name: g })=>g.startsWith("pine_collider")), a = new li, n = new ri, i = Math.max(1, Math.ceil(he.MAP_SIZE / zt.chunkSize)), o = new Map;
            s.forEach((g)=>{
                const f = Math.min(i - 1, Math.max(0, Math.floor((g.position.x + he.HALF_MAP_SIZE) / zt.chunkSize))), v = Math.min(i - 1, Math.max(0, Math.floor((g.position.z + he.HALF_MAP_SIZE) / zt.chunkSize))), M = `${f}:${v}`;
                let C = o.get(M);
                C || (C = [], o.set(M, C)), C.push(g);
            });
            const r = [
                ...o.values()
            ].flatMap((g)=>this.createChunkMeshes(g, t.geometry, e.geometry, a, n)), h = s[0].geometry.boundingBox, p = h.max.x, _ = h.max.y / 2;
            s.forEach((g)=>{
                const f = p * g.scale.x, v = _ * g.scale.y, M = Xe.capsule(v, f).setTranslation(...g.position.toArray()).setRotation(g.quaternion).setRestitution(.75);
                me.world.createCollider(M).userData = {
                    type: xe.Wood
                };
            }), r.length && se.scene.add(...r);
        }
        createChunkMeshes(e, t, s, a, n) {
            if (!e.length) return [];
            const i = new ut(t, a, e.length), o = new ut(s, n, e.length);
            return e.forEach((r, d)=>{
                i.setMatrixAt(d, r.matrix), o.setMatrixAt(d, r.matrix);
            }), i.instanceMatrix.needsUpdate = !0, o.instanceMatrix.needsUpdate = !0, i.computeBoundingSphere(), o.computeBoundingSphere(), [
                i,
                o
            ];
        }
        debug() {
            const e = Ge.panel.addFolder({
                title: "🌲 Pine Trees",
                expanded: !1
            }), t = e.addFolder({
                title: "Canopy"
            });
            t.addBinding(We.uCanopyDiffuseScale, "value", {
                label: "Diffuse scale",
                min: 0
            }), t.addBinding(We.uCanopySwaySpeed, "value", {
                label: "Sway speed",
                min: 0
            });
            const s = e.addFolder({
                title: "Bark"
            });
            s.addBinding(We.uBarkUvScale, "value", {
                label: "UV scale",
                min: 0
            }), s.addBinding(We.uBarkDiffuseScale, "value", {
                label: "Diffuse scale",
                min: 0
            }), s.addBinding(We.uBarkNormalScale, "value", {
                label: "Normal scale",
                min: 0
            });
        }
    }
    class di {
        constructor(){
            new si, new ii, new ci;
        }
    }
    class ui {
        constructor(){
            const e = y.resources.worldModel.scene.getObjectByName("lake-surface"), t = {
                uTworld: c(new B(1, 0, 0)),
                uBworld: c(new B(0, 0, -1)),
                uNworld: c(new B(0, 1, 0)),
                uIsWebGPU: c(1)
            };
            e.material = new hi(t), e.renderOrder = 100, t.uTworld.value.transformDirection(e.matrixWorld).normalize(), t.uBworld.value.transformDirection(e.matrixWorld).normalize(), t.uNworld.value.transformDirection(e.matrixWorld).normalize(), t.uIsWebGPU.value = Number($e.isWebGPU);
            const a = e.geometry.boundingSphere;
            a.radius = a.radius * .75, se.scene.add(e);
            const n = Ie.register({
                name: "Lake",
                icon: "water",
                position: e.position,
                discoveryRadius: 150,
                arrivalRadius: 90
            }), i = Ce.registerTarget("Lake", e.position, 90);
            Ie.setWindTargetId(n, i), z.on("engine-loading-audio-progress", (o)=>{
                o === 100 && e.add(Jt.lake);
            });
        }
    }
    class hi extends Qs {
        uniforms = {
            uUvScale: c(2.7),
            uNormalScale: c(.05),
            uRefractionStrength: c(.1),
            uFresnelScale: c(.5),
            uSpeed: c(.1),
            uNoiseScrollDir: c(new et(.1, 0)),
            uShininess: c(500),
            uMinDist: c(0),
            uMaxDist: c(0),
            uSunDir: c(Tt.sunDirection),
            uSunColor: c(Tt.sunColor.clone()),
            uTworld: c(new B(1, 0, 0)),
            uBworld: c(new B(0, 0, -1)),
            uNworld: c(new B(0, 1, 0)),
            uHighlightsGlow: c(4),
            uHighlightFresnelInfluence: c(.35),
            uDepthDistance: c(20),
            uAbsorptionRGB: c(new B(.35, .1, .08)),
            uInscatterTint: c(new ke(0, .09, .09)),
            uInscatterStrength: c(.85),
            uAbsorptionScale: c(15),
            uMinOpacity: c(.5),
            uIsWebGPU: c(1),
            uHighlightsSpread: c(.35),
            uDepthOpacityScale: c(.1),
            uHighlightsDepthOpacityScale: c(.05)
        };
        constructor(e = {}){
            super(), this.uniforms = {
                ...this.uniforms,
                ...e
            }, this.createMaterial(), this.debugWater();
        }
        debugWater() {
            const e = Ge.panel.addFolder({
                title: "🌊 Water",
                expanded: !1
            }), t = e.addFolder({
                title: "Waves",
                expanded: !0
            });
            t.addBinding(this.uniforms.uSpeed, "value", {
                label: "Speed"
            }), t.addBinding(this.uniforms.uNormalScale, "value", {
                label: "Normal scale"
            }), t.addBinding(this.uniforms.uUvScale, "value", {
                label: "UV scale"
            });
            const s = e.addFolder({
                title: "Highlights",
                expanded: !0
            });
            s.addBinding(this.uniforms.uShininess, "value", {
                label: "Shininess"
            }), s.addBinding(this.uniforms.uHighlightsGlow, "value", {
                label: "Glow"
            }), s.addBinding(this.uniforms.uHighlightFresnelInfluence, "value", {
                label: "Fresnel influence"
            }), s.addBinding(this.uniforms.uSunColor, "value", {
                label: "Sun color",
                view: "color",
                color: {
                    type: "float"
                }
            }), s.addBinding(this.uniforms.uHighlightsSpread, "value", {
                label: "Highlights spread"
            }), s.addBinding(this.uniforms.uHighlightsDepthOpacityScale, "value", {
                label: "Shoreline opacity",
                step: .001
            });
            const a = e.addFolder({
                title: "Reflections / Refraction",
                expanded: !0
            });
            a.addBinding(this.uniforms.uRefractionStrength, "value", {
                label: "Refraction strength"
            }), a.addBinding(this.uniforms.uFresnelScale, "value", {
                label: "Fresnel scale"
            });
            const n = e.addFolder({
                title: "Beer-Lambert",
                expanded: !0
            });
            n.addBinding(this.uniforms.uInscatterStrength, "value", {
                label: "Inscatter strength"
            }), n.addBinding(this.uniforms.uInscatterTint, "value", {
                label: "Inscatter tint",
                view: "color",
                color: {
                    type: "float"
                }
            }), n.addBinding(this.uniforms.uAbsorptionRGB, "value", {
                label: "Absorption coeff"
            }), n.addBinding(this.uniforms.uAbsorptionScale, "value", {
                label: "Absorption scale"
            });
            const i = e.addFolder({
                title: "General",
                expanded: !0
            });
            i.addBinding(this.uniforms.uMinOpacity, "value", {
                label: "Min opacity"
            }), i.addBinding(this.uniforms.uMinDist, "value", {
                label: "Min opacity distance"
            }), i.addBinding(this.uniforms.uMaxDist, "value", {
                label: "Max opacity distance"
            }), i.addBinding(this.uniforms.uDepthDistance, "value", {
                label: "Depth distance"
            }), i.addBinding(this.uniforms.uDepthOpacityScale, "value", {
                label: "Depth opacity scale"
            });
        }
        createMaterial() {
            this.precision = "lowp", this.fog = !1;
            const e = Ee.mul(this.uniforms.uSpeed), t = this.uniforms.uNoiseScrollDir.mul(e), s = X().add(t).mul(this.uniforms.uUvScale.mul(1.37)).fract(), n = D(y.resources.normVeinWater, s).rgb.mul(2).sub(1).normalize(), i = X().sub(t).mul(this.uniforms.uUvScale.mul(.73)).fract(), r = D(y.resources.normVeinWater, i).rgb.mul(2).sub(1).normalize(), d = A.blendRNM(n, r), h = x(d.xy.mul(this.uniforms.uNormalScale), d.z).normalize(), p = h.x.mul(this.uniforms.uTworld).add(h.y.mul(this.uniforms.uBworld)).add(h.z.mul(this.uniforms.uNworld)).normalize(), _ = as(Wt).r, g = u(1).sub(this.uniforms.uIsWebGPU), f = _.mul(2).sub(1).mul(g), v = _.mul(this.uniforms.uIsWebGPU), M = f.add(v), C = u(ns.element(Z(3)).element(Z(2))), R = u(ns.element(Z(2)).element(Z(2))), N = C.div(M.add(R)), k = ea.z.negate(), P = ce(k, N), U = N.sub(k).div(this.uniforms.uDepthDistance).clamp(), ae = T(this.uniforms.uRefractionStrength, this.uniforms.uRefractionStrength.mul(1.5), U), ge = h.xy.mul(ae), Ae = Wt.add(ge.mul(P)), I = as(Ae).r, L = I.mul(2).sub(1).mul(g), Y = I.mul(this.uniforms.uIsWebGPU), $ = L.add(Y), W = C.div($.add(R)), ne = ce(k, W), Q = W.sub(k).div(this.uniforms.uDepthDistance).clamp(), q = T(Wt, Ae, ne).clamp(), K = ta(q).rgb, ee = sa(jt.sub(tt)), Re = is(ee.negate(), p), De = aa(y.resources.envMapTexture, Re), Be = Gt(p, ee).clamp(), Ne = u(.02), ue = u(1).sub(Be), Fe = ue.mul(ue).mul(ue).mul(ue).mul(ue), Se = Ne.add(u(1).sub(Ne).mul(Fe)), F = Se.mul(this.uniforms.uFresnelScale).clamp(), ie = this.uniforms.uAbsorptionRGB.mul(this.uniforms.uAbsorptionScale), we = T(U, Q, ne), qe = na(ie.negate().mul(we)), ft = this.uniforms.uInscatterTint.mul(this.uniforms.uInscatterStrength), He = T(ft, K, qe), ze = x(d.xy.mul(this.uniforms.uHighlightsSpread), d.z).normalize(), wt = ze.x.mul(this.uniforms.uTworld).add(ze.y.mul(this.uniforms.uBworld)).add(ze.z.mul(this.uniforms.uNworld)).normalize(), bt = is(this.uniforms.uSunDir, wt), vt = Kt(Gt(bt, ee), 0), kt = ve(vt, this.uniforms.uShininess), Et = T(1, Se, this.uniforms.uHighlightFresnelInfluence), Dt = V(0, this.uniforms.uHighlightsDepthOpacityScale, we), Bt = this.uniforms.uSunColor.mul(kt.mul(this.uniforms.uHighlightsGlow).mul(Et)).mul(Dt), Lt = Gt(tt.xz.sub(jt.xz), tt.xz.sub(jt.xz)), Rt = this.uniforms.uMinDist.mul(this.uniforms.uMinDist), Nt = this.uniforms.uMaxDist.mul(this.uniforms.uMaxDist), Ft = V(Rt, Nt, Lt).add(this.uniforms.uMinOpacity).clamp(), es = V(0, this.uniforms.uDepthOpacityScale, we), yt = Ft.mul(es).clamp(), Ot = T(He, De, F), St = T(K, Ot, yt);
            this.colorNode = St.add(Bt);
        }
    }
    const mi = (l)=>ht(l, "vec4"), pi = b(([l], e)=>{});
    class gi extends ut {
        mainBuffer;
        constructor(e){
            let t, s, a = pi;
            switch(super(new gs, void 0, e.count), this.mainBuffer = mi(e.count), this.mainBuffer.setPBO(!0), e.preset){
                case "custom":
                    t = e.material, s = e.onInit, a = e.onUpdate;
                    break;
                case "fire":
                    const r = fi(e, this.mainBuffer);
                    t = r.material, s = r.onInit, a = r.onUpdate;
                    break;
                default:
                    throw new Error("preset not provided for particle system");
            }
            this.material = t;
            const n = a(this.mainBuffer).compute(e.count, [
                e.workGroupSize ?? 1
            ]), i = s?.(this.mainBuffer).compute(e.count, [
                e.workGroupSize ?? 1
            ]);
            i && n?.onInit(({ renderer: r })=>{
                r.computeAsync(i);
            });
            let o = !1;
            z.on("engine-update-throttle-64x", ()=>{
                o = Qt.isMeshVisible(this);
            }), z.on("engine-update-throttle-2x", ()=>{
                o && $e.renderer.computeAsync(n);
            });
        }
    }
    const fi = (l, e)=>{
        const { speed: t = .5, radius: s = 1, height: a = 1, lifetime: n = 1, scale: i = 1, detail: o = void 0, coneFactor: r = 1, bloom: d = 1 } = l, h = a * 2, p = n * .65, _ = ht(l.count, "float"), g = .9, f = b(([ue], Fe)=>{
            const Se = pe(E.add(12345)), F = _.element(E), ie = ce(g, Se);
            F.assign(ie);
        }), v = b(([ue], Fe)=>{
            const Se = ue.element(E), F = _.element(E), ie = pe(E), we = T(t, t * .5, F), qe = T(n, p, F), He = Ee.mul(we).add(ie.mul(qe)).mod(qe).div(qe), ze = u(1).sub(u(1).sub(He).pow(2)), wt = T(a, h, F), bt = ze.mul(wt), vt = pe(E.add(7890)).mul(Ke), kt = pe(E.add(5678)), Et = u(1).sub(u(1).sub(kt).pow(2)), Dt = u(1).sub(ze.mul(r)), Bt = V(0, .35, ze), Lt = at(Ee.mul(.5)).mul(.05).add(1), Rt = T(s * .25, s, Bt).mul(Dt).mul(Lt), Nt = Et.mul(Rt), Ft = ce(.5, vt).mul(2).sub(1), yt = vt.add(He.mul(Ke).mul(.05).mul(Ft)), Ot = T(1, 1.25, F), St = ie.sub(.5).mul(.05).mul(He), Cs = V(0, .75, He).mul(F), ts = Nt.add(Cs.mul(Ot)), As = fs(yt.add(St)).mul(ts), Ts = at(yt.add(St)).mul(ts), ss = bt.div(wt), Ps = V(0, .5, ss), ks = u(1).sub(V(.5, 1, ss)), Es = Ps.mul(ks);
            Se.assign(J(As, bt, Ts, Es));
        }), M = new $t;
        M.precision = "lowp", M.transparent = !0, M.depthWrite = !1, M.blending = ia, M.blendEquation = oa, M.blendSrc = ra, M.blendDst = la;
        const C = e.element(E), R = _.element(E), N = pe(E.add(9234)), k = pe(E.add(33.87));
        M.positionNode = C.xyz;
        const P = u(1).sub(R.mul(.85)), j = k.clamp(.25, 1);
        M.scaleNode = j.mul(C.w).mul(P).mul(i);
        const U = ce(.5, N).mul(.5), ae = ce(.5, k).mul(.5), Ae = X().mul(.5).add(de(U, ae)), I = D(y.resources.fireSprites, Ae, o), L = x(.72, .62, .08).mul(2).toConst(), Y = x(1, .1, 0).mul(4).toConst(), $ = x(0).toConst(), W = T(a, h, R), ne = V(0, 1, qt.y.div(W)).pow(2), fe = V(0, .25, ne), Q = T(L, Y, fe), q = V(.9, 1, ne), K = T(Q, $, q), ee = u(1).sub(V(0, .85, ne)), De = ce(.65, k).mul(ee), Be = u(.5).toConst(), Ne = I.r.mul(De).mul(Be);
        return M.colorNode = T(K, Y, R).mul(Ne).mul(d), M.alphaTest = .1, M.opacityNode = C.w.mul(I.r).mul(Be), {
            material: M,
            onInit: f,
            onUpdate: v
        };
    };
    class wi extends Pt {
        constructor(){
            super();
            const e = D(y.resources.campfireDiffuse, X());
            this.colorNode = e.rgb.mul(2);
            const t = D(y.resources.campfireNormalRoughness, X());
            this.normalNode = nt(t.rgb), this.roughnessNode = t.a;
        }
    }
    class bi {
        constructor(){
            const e = y.resources.worldModel.scene.getObjectByName("campfire");
            e.material = new wi;
            const t = new gi({
                preset: "fire",
                count: 1024,
                height: 1.85,
                coneFactor: 1.25,
                speed: .5,
                radius: .85,
                bloom: 1.5,
                workGroupSize: 256
            });
            t.position.copy(e.position).setY(-.15), se.scene.add(e, t);
            const s = y.resources.worldModel.scene.getObjectByName("fire_collider");
            s.geometry.boundingBox || s.geometry.computeBoundingBox();
            const { min: a, max: n } = s.geometry.boundingBox, i = .5 * (n.x - a.x) * Math.abs(s.scale.x), o = Xe.ball(i).setTranslation(...s.position.toArray()).setRotation(s.quaternion).setRestitution(.75);
            me.world.createCollider(o).userData = {
                type: xe.Stone
            };
            const r = y.resources.worldModel.scene.getObjectByName("log_short_collider");
            r.geometry.boundingBox || r.geometry.computeBoundingBox();
            const { min: d, max: h } = r.geometry.boundingBox, p = .5 * Math.max((h.x - d.x) * Math.abs(r.scale.x), (h.z - d.z) * Math.abs(r.scale.z)), _ = .5 * (h.y - d.y) * Math.abs(r.scale.y), g = Xe.cylinder(_, p).setTranslation(...r.position.toArray()).setRotation(r.quaternion).setRestitution(.75);
            me.world.createCollider(g).userData = {
                type: xe.Wood
            };
            const f = y.resources.worldModel.scene.getObjectByName("log_long_collider");
            f.geometry.boundingBox || f.geometry.computeBoundingBox();
            const { min: v, max: M } = f.geometry.boundingBox, C = .5 * Math.max((M.x - v.x) * Math.abs(f.scale.x), (M.z - v.z) * Math.abs(f.scale.z)), R = .5 * (M.y - v.y) * Math.abs(f.scale.y), N = Xe.cylinder(R, C).setTranslation(...f.position.toArray()).setRotation(f.quaternion).setRestitution(.75);
            me.world.createCollider(N).userData = {
                type: xe.Wood
            };
            const k = Ie.register({
                name: "Campfire",
                icon: "fire",
                position: e.position,
                discoveryRadius: 100,
                arrivalRadius: 15
            }), P = Ce.registerTarget("Campfire", e.position, 15);
            Ie.setWindTargetId(k, P);
        }
    }
    class vi {
        constructor(){
            new Jn, new di, new Kn, new ui, new bi;
        }
    }
    const yi = 120, Si = 1 / 15;
    class Mi {
        player;
        IS_CAP_FPS_ENABLED = !1;
        config = {
            halvenFPS: !1
        };
        constructor(){
            this.player = new Wn, new vi;
        }
        debugGame() {
            Ge.panel.addFolder({
                title: "⚡️ Performance",
                expanded: !1
            }).addBinding(this.config, "halvenFPS", {
                label: "Halven FPS"
            });
        }
        getSizes() {
            const e = window.innerWidth, t = window.innerHeight;
            return {
                width: e,
                height: t,
                dpr: Math.min(window.devicePixelRatio, 1.5),
                aspect: e / t
            };
        }
        async updateRefreshRate() {
            if (!this.IS_CAP_FPS_ENABLED) return;
            const e = await Qt.getRefreshRate();
            this.config.halvenFPS = e > yi;
        }
        onResize() {
            const e = this.getSizes();
            z.emit("engine-render-target-resize", e), this.updateRefreshRate();
        }
        async startLoop() {
            await this.updateRefreshRate(), this.debugGame(), st.reset();
            const e = new ca;
            e.connect(document);
            const t = {
                delta: 0,
                player: this.player
            };
            let s = !1, a = 0;
            const n = (r)=>{
                e.update(r);
                const d = e.getDelta(), h = Math.min(d, Si);
                if (a += h, this.config.halvenFPS ? s = !s : !0) {
                    if (st.isPaused) {
                        a = 0;
                        return;
                    }
                    t.delta = st.update(a), a = 0, me.update(t.delta), z.emit("engine-update", t), $e.renderAsync();
                }
            }, i = Za(this.onResize.bind(this), 300);
            this.onResize(), new ResizeObserver(i).observe(document.body), $e.renderer.setAnimationLoop(n);
        }
    }
    const _i = [
        2,
        4,
        16,
        64
    ];
    class xi {
        emitter = new Oa.EventEmitter;
        constructor(){
            _i.forEach((e)=>this.updateThrottled(e));
        }
        updateThrottled(e) {
            let t = 0, s = 0;
            this.on("engine-update", ({ player: a, delta: n })=>{
                s += n, t++, !(t < e) && (this.emit(`engine-update-throttle-${e}x`, {
                    player: a,
                    delta: s
                }), t = 0, s = 0);
            });
        }
        on(e, t) {
            return this.emitter.on(e, t), ()=>{
                this.emitter.off(e, t);
            };
        }
        emit(e, ...t) {
            return this.emitter.emit(e, ...t);
        }
        off(e, t) {
            this.emitter.off(e, t);
        }
        removeAllListeners(e) {
            this.emitter.removeAllListeners(e);
        }
    }
    const Ii = !1;
    class Ci {
        renderer;
        canvas;
        isWebGPU;
        sceneManager;
        debugManager;
        eventsManager;
        prevFrame = null;
        monitoringManager;
        postprocessingManager;
        isRenderInFlight = !1;
        isMonitoringEnabled;
        IS_POSTPROCESSING_ENABLED = !0;
        constructor(e, t, s, a){
            this.sceneManager = e, this.debugManager = t, this.eventsManager = s, this.monitoringManager = a, this.isMonitoringEnabled = !!a;
            const n = document.createElement("canvas");
            n.classList.add("revo-realms"), document.body.appendChild(n), this.canvas = n;
            const i = new da({
                canvas: n,
                antialias: !0,
                trackTimestamp: this.isMonitoringEnabled,
                powerPreference: "high-performance",
                stencil: !1,
                depth: !0
            });
            i.shadowMap.enabled = !0, i.shadowMap.type = ua, i.setClearColor(0, 1), i.toneMappingExposure = 1.5, this.renderer = i, this.debugManager.setVisibility(Ii), this.eventsManager.on("engine-render-target-resize", (o)=>{
                const r = Math.max(this.IS_POSTPROCESSING_ENABLED ? o.dpr * .85 : o.dpr, 1);
                i.setSize(o.width, o.height), i.setPixelRatio(r);
            });
        }
        async init() {
            await this.renderer.init(), this.sceneManager.init(this.canvas, this.debugManager), this.isWebGPU = !!await navigator.gpu?.requestAdapter(), this.postprocessingManager = new Nn(this.renderer, this.sceneManager, this.eventsManager, this.debugManager), this.isMonitoringEnabled && this.monitoringManager && (this.monitoringManager.attach?.(), this.renderer.info.autoReset = !1, await this.monitoringManager.stats.init(this.renderer));
        }
        async renderSceneAsync() {
            return this.IS_POSTPROCESSING_ENABLED ? this.postprocessingManager.renderAsync() : this.renderer.renderAsync(this.sceneManager.scene, this.sceneManager.renderCamera);
        }
        async compileSceneOnceAsync() {
            return this.renderer.compileAsync(this.sceneManager.scene, this.sceneManager.renderCamera);
        }
        async renderSceneOnceAsync() {
            return this.renderSceneAsync();
        }
        renderWithMonitoring() {
            const e = this.monitoringManager;
            e && (this.prevFrame?.then(()=>{
                e.updateCustomPanels(this), e.stats.update(), this.renderer.info.reset();
            }).catch((t)=>{
                console.error("[renderWithMonitoring] previous frame error:", t);
            }), this.prevFrame = Promise.all([
                this.renderer.resolveTimestampsAsync("compute"),
                this.renderSceneAsync(),
                this.renderer.resolveTimestampsAsync("render")
            ]));
        }
        renderWithoutMonitoring() {
            this.isRenderInFlight || (this.isRenderInFlight = !0, this.renderSceneAsync().catch((e)=>{
                console.error("[RendererManager] renderAsync failed:", e);
            }).finally(()=>{
                this.isRenderInFlight = !1;
            }));
        }
        async renderAsync() {
            this.isMonitoringEnabled ? this.renderWithMonitoring() : this.renderWithoutMonitoring();
        }
    }
    class Ai {
        atlasesCoords = tn;
        textureLoader;
        gltfLoader;
        cubeTextureLoader;
        ktx2Loader;
        eventsManager;
        resources = {
            heightmap: new hs
        };
        constructor(e){
            this.eventsManager = e;
            const t = new ws;
            t.onProgress = (n, i, o)=>{
                const r = Math.ceil(100 / o * i);
                this.eventsManager.emit("engine-loading-resources-progress", Math.min(r, 100));
            }, this.textureLoader = new ha(t);
            const s = new ma;
            s.setDecoderPath("/draco/"), this.gltfLoader = new pa(t), this.gltfLoader.setDRACOLoader(s), this.cubeTextureLoader = new ga(t);
            const a = new fa(t);
            a.setTranscoderPath("/basis/"), this.ktx2Loader = a;
        }
        getResource = async (e)=>{
            switch(e.type){
                case "texture":
                case "ktx2":
                    return (e.type === "ktx2" ? this.ktx2Loader : this.textureLoader).loadAsync(e.url).then((s)=>{
                        s.flipY = e.flipY ?? !0, s.colorSpace = e.colorSpace ?? Zt, e.wrap && (s.wrapS = s.wrapT = wa), s.anisotropy = e.anisotropy ?? ba.DEFAULT_ANISOTROPY, e.minFilter !== void 0 && (s.minFilter = e.minFilter), e.magFilter !== void 0 && (s.magFilter = e.magFilter), e.generateMipmaps !== void 0 && (s.generateMipmaps = e.generateMipmaps), this.resources[e.name] = s;
                    });
                case "gltf":
                    return this.gltfLoader.loadAsync(e.url).then((s)=>{
                        this.resources[e.name] = s;
                    });
                case "cubeTexture":
                    return this.cubeTextureLoader.loadAsync(e.urls).then((s)=>{
                        s.colorSpace = e.colorSpace ?? Zt, this.resources[e.name] = s;
                    });
                default:
                    throw new Error(`Unsupported resource type: ${e.type}`);
            }
        };
        async initAsync(e) {
            await this.ktx2Loader.detectSupportAsync(e.renderer);
            const t = Ln.map((s)=>this.getResource(s));
            await Promise.all(t);
        }
    }
    const Ti = "/audio/ambient/ambient.mp3", Pi = "/audio/ambient/lake.mp3", ki = "/audio/collisions/hitWood.mp3", Ei = "/audio/collisions/hitStone.mp3";
    class Di {
        scene;
        playerCamera;
        renderCamera;
        eventsManager;
        cameraHelper;
        controls;
        orbitControlsCamera;
        constructor(e){
            this.eventsManager = e;
            const t = new va;
            this.scene = t;
            const s = window.innerWidth, a = window.innerHeight, n = s / a, i = new ya(45, n, .01, 150);
            i.position.set(0, 5, 10), this.playerCamera = i, t.add(i), this.renderCamera = i, this.eventsManager.on("engine-render-target-resize", (o)=>{
                this.playerCamera.aspect = o.aspect, this.playerCamera.updateProjectionMatrix();
            });
        }
        debugScene(e) {
            if (!this.controls) return;
            const t = e.panel.addFolder({
                title: "🎥 View",
                index: 0,
                expanded: !1
            });
            t.addBinding(this.controls, "enabled", {
                label: "Enable orbit controls"
            }).on("change", ({ value: s })=>{
                !this.cameraHelper || !this.orbitControlsCamera || (this.renderCamera = s ? this.orbitControlsCamera : this.playerCamera, this.cameraHelper.visible = s, this.eventsManager.emit("engine-camera-change"));
            }), t.addBinding(this.controls, "zoomSpeed", {
                min: .1,
                max: 5,
                step: .1
            }), t.addBinding(this.controls, "panSpeed", {
                min: .1,
                max: 10,
                step: .1
            }), t.addBinding(this.controls, "rotateSpeed", {
                min: .1,
                max: 3,
                step: .1
            }), t.addBinding(this.controls, "screenSpacePanning"), t.addBinding(this.controls, "dampingFactor", {
                min: .01,
                max: .3,
                step: .01
            });
        }
        init(e, t) {}
        update() {
            this.controls?.enabled && this.controls.update();
        }
    }
    class Bi {
        audioLoader;
        audioListener;
        eventsManager;
        isReady = !1;
        isMute = !0;
        files = [];
        ambient;
        lake;
        hitWood;
        hitStone;
        constructor(e, t){
            this.eventsManager = t;
            const s = new ws;
            s.onProgress = (a, n, i)=>{
                const o = Math.ceil(100 / i * n);
                this.eventsManager.emit("engine-loading-audio-progress", Math.min(o, 99));
            }, this.audioLoader = new Sa(s), this.audioListener = new Ma, e.playerCamera.add(this.audioListener);
        }
        async toggleMute() {
            if (!this.isReady) return;
            const e = this.audioListener.context;
            e.state === "suspended" && await e.resume(), this.isMute = !this.isMute, this.files.forEach((t)=>{
                const s = this.isMute ? 0 : t.userData.originalVolume;
                t.setVolume(s), t.loop && !t.isPlaying && t.play();
            });
        }
        newAudio(e, t = 1, s = !1) {
            const a = new _a(this.audioListener);
            return a.setBuffer(e), a.setVolume(0), a.setLoop(s), a.userData.originalVolume = t, this.files.push(a), a;
        }
        newPositionalAudio(e, t = 1, s = !1, a = 1) {
            const n = new xa(this.audioListener);
            return n.setBuffer(e), n.setVolume(0), n.setLoop(s), n.userData.originalVolume = t, n.setRefDistance(a), this.files.push(n), n;
        }
        async initAsync() {
            const e = await Promise.all([
                this.audioLoader.loadAsync(Ti),
                this.audioLoader.loadAsync(Pi),
                this.audioLoader.loadAsync(ki),
                this.audioLoader.loadAsync(Ei)
            ]);
            this.ambient = this.newAudio(e[0], .05, !0), this.lake = this.newPositionalAudio(e[1], 1, !0, 50), this.hitWood = this.newAudio(e[2], 0, !1), this.hitStone = this.newAudio(e[3], 0, !1), this.isReady = !0, this.eventsManager.emit("engine-loading-audio-progress", 100);
        }
    }
    class Li {
        keysPressed = new Set;
        keyDownListeners = new Map;
        keyUpListeners = new Map;
        eventsManager;
        constructor(e){
            this.eventsManager = e, this.keysPressed = new Set, this.keyDownListeners = new Map, this.keyUpListeners = new Map, this.handleKeyDown = this.handleKeyDown.bind(this), this.handleKeyUp = this.handleKeyUp.bind(this), this.handleWheel = this.handleWheel.bind(this), window.addEventListener("keydown", this.handleKeyDown), window.addEventListener("keyup", this.handleKeyUp), window.addEventListener("wheel", this.handleWheel, {
                passive: !0
            });
        }
        handleWheel(e) {
            e.stopPropagation(), !(e.deltaY <= 0 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) && this.eventsManager.emit("swipe-up");
        }
        handleKeyDown(e) {
            const t = e.code;
            this.keysPressed.has(t) || (this.keysPressed.add(t), this.keyDownListeners.get(t)?.());
        }
        handleKeyUp(e) {
            const t = e.code;
            this.keysPressed.delete(t), this.keyUpListeners.get(t)?.();
        }
        isKeyPressed(e) {
            return e === "*" ? this.keysPressed.size > 0 : this.keysPressed.has(e);
        }
        onKeyDown(e, t) {
            this.keyDownListeners.set(e, t);
        }
        onKeyUp(e, t) {
            this.keyUpListeners.set(e, t);
        }
        dispose() {
            window.removeEventListener("keydown", this.handleKeyDown), window.removeEventListener("keyup", this.handleKeyUp), window.removeEventListener("wheel", this.handleWheel);
        }
    }
    class Ri {
        keyboardManager;
        constructor(e){
            this.keyboardManager = new Li(e);
        }
        isForward() {
            return this.keyboardManager.isKeyPressed("KeyW") || this.keyboardManager.isKeyPressed("ArrowUp");
        }
        isBackward() {
            return this.keyboardManager.isKeyPressed("KeyS") || this.keyboardManager.isKeyPressed("ArrowDown");
        }
        isLeftward() {
            return this.keyboardManager.isKeyPressed("KeyA") || this.keyboardManager.isKeyPressed("ArrowLeft");
        }
        isRightward() {
            return this.keyboardManager.isKeyPressed("KeyD") || this.keyboardManager.isKeyPressed("ArrowRight");
        }
        isJumpPressed() {
            return this.keyboardManager.isKeyPressed("Space");
        }
        isKeyPressed(e) {
            return this.keyboardManager.isKeyPressed(e);
        }
        onKeyDown(e, t) {
            this.keyboardManager.onKeyDown(e, t);
        }
        onKeyUp(e, t) {
            this.keyboardManager.onKeyUp(e, t);
        }
    }
    const Ni = !0;
    class Fi {
        landmarks = new Map;
        idCounter = 0;
        eventsManager;
        constructor(e){
            this.eventsManager = e, e.on("engine-update-throttle-16x", this.checkDiscovery.bind(this));
        }
        register(e) {
            const t = `landmark-${++this.idCounter}`, s = {
                ...e,
                id: t,
                hasBeenDiscovered: Ni
            };
            return this.landmarks.set(t, s), t;
        }
        discover(e) {
            const t = this.landmarks.get(e);
            !t || t.hasBeenDiscovered || (t.hasBeenDiscovered = !0, this.eventsManager.emit("landmark-discovered", e));
        }
        isDiscovered(e) {
            return this.landmarks.get(e)?.hasBeenDiscovered ?? !1;
        }
        getAll() {
            return Array.from(this.landmarks.values());
        }
        getDiscovered() {
            return this.getAll().filter((e)=>e.hasBeenDiscovered);
        }
        getById(e) {
            return this.landmarks.get(e);
        }
        setWindTargetId(e, t) {
            const s = this.landmarks.get(e);
            s && (s.windTargetId = t);
        }
        checkDiscovery(e) {
            const t = e.player.position;
            this.landmarks.forEach((s)=>{
                if (s.hasBeenDiscovered) return;
                const a = t.x - s.position.x, n = t.z - s.position.z, i = a * a + n * n, o = s.discoveryRadius * s.discoveryRadius;
                i <= o && this.discover(s.id);
            });
        }
    }
    const be = {
        LIGHT_POSITION_OFFSET: new B(10, 10, 10),
        directionalColor: new ke(.85, .75, .7),
        directionalIntensity: .8,
        hemiSkyColor: new ke(.6, .4, .5),
        hemiGroundColor: new ke(.3, .2, .2),
        hemiIntensity: .3,
        fogColor: new ke().setRGB(.4, .6, .3),
        fogDensity: .004,
        fogEnabled: !0
    };
    class Oi {
        directionalLight;
        hemisphereLight;
        fog;
        sunDirection = be.LIGHT_POSITION_OFFSET.clone().normalize().negate();
        constructor(e, t, s){
            this.directionalLight = this.setupDirectionalLighting(), e.scene.add(this.directionalLight), this.hemisphereLight = this.setupHemisphereLight(), e.scene.add(this.hemisphereLight), this.fog = this.setupFog(), e.scene.fog = this.fog, s.on("engine-camera-change", ()=>{
                e.scene.fog = e.scene.fog ? null : this.fog;
            }), s.on("engine-update-throttle-4x", ({ player: a })=>{
                this.directionalLight.position.copy(a.position).add(be.LIGHT_POSITION_OFFSET);
            }), this.debugLight(t, e);
        }
        get sunColor() {
            return this.directionalLight.color;
        }
        setupHemisphereLight() {
            const e = new Ia;
            return e.color.copy(be.hemiSkyColor), e.groundColor.copy(be.hemiGroundColor), e.intensity = .3, e.position.copy(be.LIGHT_POSITION_OFFSET), e;
        }
        setupDirectionalLighting() {
            const e = new Ca;
            e.intensity = be.directionalIntensity, e.color.copy(be.directionalColor), e.position.copy(be.LIGHT_POSITION_OFFSET), e.target = new Aa, e.castShadow = !0, e.shadow.mapSize.set(64, 64);
            const t = 1;
            return e.shadow.intensity = .85, e.shadow.camera.left = -t, e.shadow.camera.right = t, e.shadow.camera.top = t, e.shadow.camera.bottom = -t, e.shadow.camera.near = .01, e.shadow.camera.far = 30, e.shadow.normalBias = .1, e.shadow.bias = -.001, e;
        }
        setupFog() {
            return new Ta(be.fogColor, be.fogDensity);
        }
        debugLight(e, t) {
            const s = e.panel.addFolder({
                title: "💡 Light"
            });
            s.expanded = !1, s.addBinding(be.LIGHT_POSITION_OFFSET, "x", {
                label: "Sun position X"
            }), s.addBinding(be.LIGHT_POSITION_OFFSET, "z", {
                label: "Sun position Z"
            }), s.addBinding(be.LIGHT_POSITION_OFFSET, "y", {
                label: "Sun height"
            }), s.addBinding(this.directionalLight, "color", {
                label: "Directional Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), s.addBinding(this.directionalLight, "intensity", {
                min: 0,
                max: 5,
                label: "Directional intensity"
            }), s.addBinding(this.fog, "color", {
                label: "Fog Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), s.addBinding(this.fog, "density", {
                label: "Fog Density",
                min: 0,
                max: .025,
                step: 1e-4
            }), s.addBinding(be, "fogEnabled", {
                label: "Fog enabled"
            }).on("change", ({ value: a })=>{
                t.scene.fog = a ? this.fog : null;
            }), s.addBinding(this.hemisphereLight, "color", {
                label: "Hemisphere sky color",
                view: "color",
                color: {
                    type: "float"
                }
            }), s.addBinding(this.hemisphereLight, "groundColor", {
                label: "Hemisphere ground color",
                view: "color",
                color: {
                    type: "float"
                }
            }), s.addBinding(this.hemisphereLight, "intensity", {
                min: 0,
                max: 1,
                label: "Hemisphere intensity"
            });
        }
        setTarget(e) {
            this.directionalLight.target = e;
        }
    }
    const Ve = {
        minImpactSq: 5,
        maxImpactSq: 400,
        minImpactVolume: .01,
        maxImpactVolume: .25
    };
    class Ui {
        world;
        eventQueue;
        baseTimestep = 1 / 60;
        timeScale = 1;
        accumulator = 0;
        maxStepsPerFrame = 8;
        _didStep = !1;
        audioManager;
        sceneManager;
        dummyVectorLinVel = new B;
        fixedDebugMesh;
        dynamicDebugMesh;
        dynamicDebugGeometry;
        debug = {
            enabled: !1
        };
        constructor(e, t, s, a){
            this.audioManager = s, this.sceneManager = t, this.setupDebug(a), e.on("engine-time-scale", (n)=>{
                this.setTimeScale(n);
            });
        }
        async initAsync() {
            return Pa(()=>import("./@dimforge-C0cDeoNs.js").then(async (m)=>{
                    await m.__tla;
                    return m;
                }), []).then(()=>{
                this.world = new Ga({
                    x: 0,
                    y: -9.81,
                    z: 0
                }), this.eventQueue = new za(!0), this.world.timestep = this.baseTimestep, this.applyTimeScale();
            });
        }
        setTimeScale(e) {
            this.timeScale = Math.max(0, e), this.applyTimeScale();
        }
        applyTimeScale() {
            if (!this.world || this.timeScale === 0) return;
            const e = this.baseTimestep * this.timeScale;
            this.world.timestep !== e && (this.world.timestep = e);
        }
        setupDebug(e) {
            e.panel.addFolder({
                title: "⚙️ Physics",
                expanded: !1
            }).addBinding(this.debug, "enabled", {
                label: "Debug render"
            }).on("change", ({ value: s })=>this.setDebugEnabled(s));
        }
        setDebugEnabled(e) {
            this.debug.enabled = e, this.fixedDebugMesh && (this.fixedDebugMesh.visible = e), this.dynamicDebugMesh && (this.dynamicDebugMesh.visible = e);
        }
        getColliderName(e) {
            return e.userData?.type;
        }
        impactToVolume(e) {
            const t = os.mapLinear(e, Ve.minImpactSq, Ve.maxImpactSq, Ve.minImpactVolume, Ve.maxImpactVolume);
            return os.clamp(t, Ve.minImpactVolume, Ve.maxImpactVolume);
        }
        onCollisionWithWood(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < Ve.minImpactSq) return;
            const a = this.impactToVolume(s);
            this.audioManager.hitWood.setVolume(a), this.audioManager.hitWood.play();
        }
        onCollisionWithStone(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < Ve.minImpactSq) return;
            const a = this.impactToVolume(s);
            this.audioManager.hitStone.setVolume(a), this.audioManager.hitStone.play();
        }
        handleCollisionSounds() {
            this.eventQueue.drainCollisionEvents((e, t, s)=>{
                if (this.audioManager.isMute || !s) return;
                const a = this.world.getCollider(e), n = this.world.getCollider(t);
                if (!a || !n) return;
                const i = this.getColliderName(a), o = this.getColliderName(n);
                let r = null, d;
                if (i === xe.Player ? (r = a, d = o) : o === xe.Player && (r = n, d = i), !!r) switch(d){
                    case xe.Wood:
                        this.onCollisionWithWood(r);
                        break;
                    case xe.Stone:
                        this.onCollisionWithStone(r);
                        break;
                }
            });
        }
        createDebugMesh(e) {
            const t = new ka;
            t.setPositions(e);
            const s = new Ea, a = new Da(t, s);
            return a.frustumCulled = !1, {
                debugMesh: a,
                geometry: t
            };
        }
        createFixedDebugMesh() {
            if (this.fixedDebugMesh) return;
            const e = this.world.debugRender(rs.ONLY_FIXED);
            if (!e.vertices.length) return;
            const { debugMesh: t } = this.createDebugMesh(e.vertices);
            this.fixedDebugMesh = t, t.visible = this.debug.enabled, this.sceneManager.scene.add(t);
        }
        updateDynamicDebugMesh() {
            const e = this.world.debugRender(rs.EXCLUDE_FIXED);
            if (!e.vertices.length) return;
            if (!this.dynamicDebugMesh) {
                const { debugMesh: n, geometry: i } = this.createDebugMesh(e.vertices);
                this.dynamicDebugMesh = n, this.dynamicDebugGeometry = i, n.visible = this.debug.enabled, this.sceneManager.scene.add(n);
                return;
            }
            if (!this.dynamicDebugGeometry) return;
            const t = this.dynamicDebugGeometry.attributes.instanceStart, s = this.dynamicDebugGeometry.attributes.instanceEnd, a = t.array;
            if (a.length !== e.vertices.length) {
                this.dynamicDebugGeometry.setPositions(e.vertices);
                return;
            }
            a.set(e.vertices), t.needsUpdate = !0, s.needsUpdate = !0;
        }
        updateDebug() {
            this.debug.enabled && (this.createFixedDebugMesh(), this._didStep && this.updateDynamicDebugMesh());
        }
        get alpha() {
            return this.world ? this.accumulator / this.world.timestep : 1;
        }
        get didStep() {
            return this._didStep;
        }
        update(e) {
            if (!this.world) return;
            this.accumulator += e;
            const t = this.world.timestep;
            let s = 0;
            for(; this.accumulator >= t && s < this.maxStepsPerFrame;)this.world.step(this.eventQueue), this.accumulator -= t, s++;
            this._didStep = s > 0, this.accumulator > t && (this.accumulator = t), this.updateDebug(), this.audioManager.isReady && this.handleCollisionSounds();
        }
    }
    class Wi {
        eventsManager;
        state = {
            isPaused: !1,
            isSlowMotion: !1,
            slowMotionScale: .125
        };
        timeScale = 1;
        lastPauseState = !1;
        lastSlowMoState = !1;
        constructor(e, t, s){
            this.eventsManager = e, this.bindControls(t), this.setupDebug(s), this.emitInitialState();
        }
        get isPaused() {
            return this.state.isPaused;
        }
        reset() {
            cs.reset();
        }
        update(e) {
            const t = e * this.timeScale;
            return cs.update(t), t;
        }
        togglePause() {
            this.setPaused(!this.state.isPaused);
        }
        toggleSlowMotion() {
            this.state.isPaused || this.setSlowMotionEnabled(!this.state.isSlowMotion);
        }
        setPaused(e) {
            this.updateState({
                isPaused: e
            });
        }
        setSlowMotionEnabled(e) {
            this.updateState({
                isSlowMotion: e
            });
        }
        setSlowMotionScale(e) {
            this.updateState({
                slowMotionScale: Math.max(0, e)
            });
        }
        computeTimeScale() {
            const { isPaused: e, isSlowMotion: t, slowMotionScale: s } = this.state;
            return e ? 0 : t ? s : 1;
        }
        updateState(e) {
            Object.assign(this.state, e), this.applyTimeScale();
        }
        applyTimeScale() {
            const e = this.computeTimeScale();
            this.timeScale !== e && (this.timeScale = e, this.eventsManager.emit("engine-time-scale", this.timeScale)), this.lastPauseState !== this.state.isPaused && (this.lastPauseState = this.state.isPaused, this.eventsManager.emit("engine-pause-change", this.state.isPaused)), this.lastSlowMoState !== this.state.isSlowMotion && (this.lastSlowMoState = this.state.isSlowMotion, this.eventsManager.emit("engine-slowmo-change", this.state.isSlowMotion));
        }
        emitInitialState() {
            this.timeScale = this.computeTimeScale(), this.lastPauseState = this.state.isPaused, this.lastSlowMoState = this.state.isSlowMotion, this.eventsManager.emit("engine-time-scale", this.timeScale), this.eventsManager.emit("engine-pause-change", this.state.isPaused), this.eventsManager.emit("engine-slowmo-change", this.state.isSlowMotion);
        }
        bindControls(e) {
            e.onKeyDown("KeyP", ()=>this.togglePause()), e.onKeyDown("KeyT", ()=>this.toggleSlowMotion());
        }
        setupDebug(e) {
            const t = e.panel.addFolder({
                title: "⏱️ Time",
                expanded: !1
            });
            t.addBinding(this.state, "isPaused", {
                label: "Paused"
            }).on("change", ({ value: s })=>this.setPaused(s)), t.addBinding(this.state, "isSlowMotion", {
                label: "Slow motion"
            }).on("change", ({ value: s })=>this.setSlowMotionEnabled(s)), t.addBinding(this.state, "slowMotionScale", {
                label: "Slow scale",
                min: 0,
                max: 1,
                step: .01
            }).on("change", ({ value: s })=>this.setSlowMotionScale(s));
        }
    }
    class ji {
        IS_DEBUGGING_ENABLED = !1;
        _uDirection = c(new et(0, -1));
        _uIntensity = c(.1);
        phase = "idle";
        AMBIENT_INTENSITY = .1;
        MAX_INTENSITY = 1;
        RAMP_RATE = 1.5;
        DECAY_RATE = .85;
        idCounter = 0;
        targets = new Map;
        target;
        targetPositionXZ = new et(0, 0);
        playerPositionXZ = new et(0, 0);
        hasPlayerPosition = !1;
        toTargetDir = new et(0, 0);
        HOLD_INTENSITY_TIME_S = 3;
        accTimer = 0;
        eventsManager;
        sceneManager;
        constructor(e, t){
            this.eventsManager = e, this.sceneManager = t, this.IS_DEBUGGING_ENABLED && this.debug(), this.eventsManager.on("swipe-up", this.handleSwipeUp.bind(this)), this.eventsManager.on("engine-update-throttle-4x", this.handleWindBlowing.bind(this));
        }
        handleSwipeUp() {
            !this.target || this.phase !== "idle" || (this.phase = "direction");
        }
        directionPhase() {
            if (!this.target) {
                this.phase = "idle";
                return;
            }
            this.toTargetDir.subVectors(this.targetPositionXZ, this.playerPositionXZ);
            const e = this.toTargetDir.lengthSq();
            if (e <= this.target.radiusSq) {
                this.target = void 0, this.phase = "idle", this.eventsManager.emit("wind-target-change", null);
                return;
            }
            const t = 1 / Math.sqrt(e);
            this.toTargetDir.multiplyScalar(t), this.uDirection.value.copy(this.toTargetDir), this.phase = "start";
        }
        rampPhase(e) {
            this._uIntensity.value += e * this.RAMP_RATE, this._uIntensity.value = Math.min(this._uIntensity.value, this.MAX_INTENSITY), this._uIntensity.value === this.MAX_INTENSITY && (this.phase = "hold");
        }
        holdPhase(e) {
            this.accTimer += e, !(this.accTimer < this.HOLD_INTENSITY_TIME_S) && (this.phase = "end", this.accTimer = 0);
        }
        decayPhase(e) {
            this._uIntensity.value -= e * this.DECAY_RATE, this._uIntensity.value = Math.max(this._uIntensity.value, this.AMBIENT_INTENSITY), this._uIntensity.value === this.AMBIENT_INTENSITY && (this.phase = "idle");
        }
        startPhase() {
            this.eventsManager.emit("game-wind-start"), this.phase = "ramp";
        }
        endPhase() {
            this.eventsManager.emit("game-wind-end"), this.phase = "decay";
        }
        clearTargetIfReached() {
            if (!this.target) return;
            const e = this.target.position.x - this.playerPositionXZ.x, t = this.target.position.z - this.playerPositionXZ.y;
            e * e + t * t > this.target.radiusSq || (this.target = void 0, this.eventsManager.emit("wind-target-change", null), this.phase === "direction" && (this.phase = "idle"));
        }
        handleWindBlowing({ player: e, delta: t }) {
            if (this.playerPositionXZ.set(e.position.x, e.position.z), this.hasPlayerPosition = !0, this.clearTargetIfReached(), this.phase === "direction") return this.directionPhase();
            if (this.phase === "start") return this.startPhase();
            if (this.phase === "ramp") return this.rampPhase(t);
            if (this.phase === "hold") return this.holdPhase(t);
            if (this.phase === "end") return this.endPhase();
            if (this.phase === "decay") return this.decayPhase(t);
        }
        debug() {
            const e = new mt;
            e.colorNode = x(this._uIntensity);
            const t = Ba(this._uDirection.x, this._uDirection.y.negate());
            e.positionNode = La(qt, x(0, t, 0));
            const s = new Ra(1, 3);
            s.rotateX(-Math.PI / 2);
            const a = new Na(s, e);
            this.sceneManager.scene.add(a), this.eventsManager.on("engine-update", ({ player: n })=>{
                a.position.copy(n.position).setY(5);
            });
        }
        get uDirection() {
            return this._uDirection;
        }
        get uIntensity() {
            return this._uIntensity;
        }
        registerTarget(e, t, s) {
            const a = `windTarget-${++this.idCounter}`;
            return this.targets.set(a, {
                id: a,
                label: e,
                position: t,
                radiusSq: s * s
            }), a;
        }
        activateTargetById(e) {
            const t = this.targets.get(e);
            if (!t) return !1;
            if (this.hasPlayerPosition) {
                const s = t.position.x - this.playerPositionXZ.x, a = t.position.z - this.playerPositionXZ.y;
                if (s * s + a * a <= t.radiusSq) return !1;
            }
            return this.target = t, this.targetPositionXZ.set(t.position.x, t.position.z), this.eventsManager.emit("wind-target-change", e), !0;
        }
        get activeTargetId() {
            return this.target?.id ?? null;
        }
    }
    const Gi = 2500;
    class zi {
        rendererManager;
        sceneManager;
        constructor(e, t){
            this.rendererManager = e, this.sceneManager = t;
        }
        collectFrustumCullStates() {
            const e = [];
            return this.sceneManager.scene.traverse((t)=>{
                e.push({
                    object: t,
                    frustumCulled: t.frustumCulled
                });
            }), e;
        }
        setFrustumCullStates(e, t) {
            e.forEach(({ object: s })=>{
                s.frustumCulled = t;
            });
        }
        restoreFrustumCullStates(e) {
            e.forEach(({ object: t, frustumCulled: s })=>{
                t.frustumCulled = s;
            });
        }
        async runStartupPrewarmAsync() {
            const e = this.collectFrustumCullStates();
            this.setFrustumCullStates(e, !1);
            let t, s = !1, a = !1;
            const n = ()=>{
                a || (this.restoreFrustumCullStates(e), a = !0);
            }, i = (async ()=>{
                try {
                    return await this.rendererManager.compileSceneOnceAsync(), s || await this.rendererManager.renderSceneOnceAsync(), n(), {
                        completed: !s,
                        timedOut: s
                    };
                } catch (r) {
                    return n(), {
                        completed: !1,
                        timedOut: !1,
                        error: r
                    };
                } finally{
                    t !== void 0 && clearTimeout(t);
                }
            })(), o = new Promise((r)=>{
                t = setTimeout(()=>{
                    s = !0, n(), r({
                        completed: !1,
                        timedOut: !0
                    });
                }, Gi);
            });
            return Promise.race([
                i,
                o
            ]);
        }
    }
    const Zi = ()=>new Fn, Hi = ()=>{}, Vi = ()=>{
        const l = new xi, e = new Di(l), t = Zi(), s = Hi(), a = new Ci(e, t, l, s), n = new zi(a, e), i = new Ai(l), o = new Bi(e, l), r = new Ri(l), d = new Ui(l, e, o, t), h = new Wi(l, r, t), p = new Fi(l), _ = new Oi(e, t, l), g = new ji(l, e);
        return {
            eventsManager: l,
            lightingManager: _,
            sceneManager: e,
            rendererManager: a,
            prewarmManager: n,
            assetManager: i,
            audioManager: o,
            debugManager: t,
            inputManager: r,
            physicsManager: d,
            timeManager: h,
            landmarkManager: p,
            windManager: g
        };
    }, { eventsManager: z, lightingManager: Tt, sceneManager: se, rendererManager: $e, prewarmManager: Yi, assetManager: y, audioManager: Jt, debugManager: Ge, inputManager: ct, physicsManager: me, timeManager: st, landmarkManager: Ie, windManager: Ce } = Vi(), Ki = [
        30,
        60,
        120,
        144,
        160,
        165,
        170,
        180,
        240
    ], Xi = (l)=>Ki.reduce((e, t)=>Math.abs(t - l) < Math.abs(e - l) ? t : e);
    class Qt {
        static frustum = new Fa;
        static projScreenMatrix = new Xt;
        static getRefreshRate = async ()=>new Promise((e)=>{
                const t = [];
                let s = performance.now(), a = s;
                function n(i) {
                    if (t.push(i - s), s = i, i - a < 1e3) requestAnimationFrame(n);
                    else {
                        t.sort((h, p)=>h - p);
                        const r = 1e3 / (t[Math.floor(t.length / 2)] || 16.667), d = Xi(r);
                        e(d);
                    }
                }
                requestAnimationFrame(n);
            });
        static isMeshVisible = (e)=>(e.geometry.boundingSphere || e.geometry.computeBoundingSphere(), this.frustum.intersectsObject(e));
        static init() {
            z.on("engine-update-throttle-16x", ()=>{
                this.projScreenMatrix.multiplyMatrices(se.playerCamera.projectionMatrix, se.playerCamera.matrixWorldInverse), this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
            });
        }
    }
    class $i {
        async initAsync() {
            z.emit("engine-loading-core-progress", 0), await $e.init(), z.emit("engine-loading-core-progress", 25), await Promise.all([
                me.initAsync(),
                y.initAsync($e)
            ]), z.emit("engine-loading-core-progress", 75), Jt.initAsync(), Qt.init();
        }
    }
    const qi = "/textures/hud/compass.webp", Ji = "/textures/hud/compassArrow.webp";
    var Qi = je('<div class="compass-container svelte-1rzhaf7"><img class="compass svelte-1rzhaf7" alt="compass"/> <img class="compass-arrow svelte-1rzhaf7" alt="arrow"/></div>');
    function eo(l, e) {
        it(e, !0);
        let t = Le(0), s = Le(0);
        const a = he.MAP_SIZE / 2, n = (d, h)=>{
            const p = h - d;
            return d + ((p + Math.PI) % (2 * Math.PI) - Math.PI);
        };
        pt(()=>{
            let d = 0;
            const h = z.on("engine-update-throttle-16x", ({ player: p })=>{
                const _ = Math.abs(p.position.x) > a, g = Math.abs(p.position.z) > a, f = _ || g;
                if (le(t, f ? .65 : 0, !0), !f) return;
                const v = Math.atan2(-p.position.x, -p.position.z);
                d = n(d, v - p.yaw), le(s, -d);
            });
            return ()=>{
                h();
            };
        });
        var i = Qi(), o = Te(i), r = Me(o, 2);
        _e(()=>{
            Ht(i, `--opacity: ${w(t)};`), O(o, "src", qi), O(r, "src", Ji), Ht(r, `--yaw: ${w(s)}rad;`);
        }), G(l, i), ot();
    }
    var to = je('<div class="keys svelte-m991to" aria-label="Keyboard shortcuts"><span class="key svelte-m991to" title="Landmarks Wheel">L</span> <span class="key svelte-m991to" title="Pause / Resume">P</span></div>');
    function so(l) {
        var e = to();
        G(l, e);
    }
    var ao = je("<div> </div>");
    function no(l, e) {
        it(e, !0);
        let t = Le(0), s = 0, a = 0;
        pt(()=>{
            let o = ()=>{}, r = ()=>{};
            const d = ()=>{
                o(), r(), o = ()=>{}, r = ()=>{};
            };
            return o = z.on("engine-loading-core-progress", (h)=>{
                s = Math.min(Math.ceil(h / 2), 50), le(t, s + a), w(t) === 100 && d();
            }), r = z.on("engine-loading-resources-progress", (h)=>{
                a = Math.min(Math.ceil(h / 2), 50), le(t, s + a), w(t) === 100 && d();
            }), ()=>{
                d();
            };
        });
        var n = ao(), i = Te(n);
        _e(()=>{
            At(n, 1, vs(w(t) === 100 ? "fade-out" : ""), "svelte-1n8ymnb"), ys(i, `${w(t) ?? ""}%`);
        }), G(l, n), ot();
    }
    var io = je("<button><!></button>");
    function ds(l, e) {
        const t = Ms(e, [
            "$$slots",
            "$$events",
            "$$legacy",
            "children"
        ]);
        var s = io();
        Ss(s, ()=>({
                ...t
            }), void 0, void 0, void 0, "svelte-10u0xy3");
        var a = Te(s);
        Ha(a, ()=>e.children ?? Va), G(l, s);
    }
    var oo = je(`<dialog><div class="credits-content svelte-w8mjfd"><h1 class="svelte-w8mjfd">Acknowledgements</h1> <p class="credits-status svelte-w8mjfd">This list is currently being refreshed, so it may be slightly out of date,
			sorry about that. Some credits may still reference resources no longer
			used in the project, and a few active ones may still be missing for now.</p> <div class="gratitude svelte-w8mjfd"><p class="svelte-w8mjfd">I'd like to express my sincere gratitude to all the artists and
				platforms whose work made this project possible. Whether by filling the
				gaps in my own skillset or helping me save precious development time,
				these assets played a key role in shaping this imaginary world.</p> <p class="svelte-w8mjfd">In most cases, I adapted the original works — by trimming, simplifying,
				or repurposing them — but I remain deeply thankful to each creator for
				sharing their work.</p> <p class="svelte-w8mjfd">This project is also open source (view on <a target="_blank" href="https://github.com/alezen9/revo-realms" class="svelte-w8mjfd">GitHub | revo-realms</a>), and all the implementation is freely available to explore, learn
				from, or build upon. Credit is appreciated but not required.</p> <p class="svelte-w8mjfd">This project exists solely to showcase my personal growth and hobbies —
				it's a learning space, not a commercial product.</p> <p class="svelte-w8mjfd">If you are the rightful owner of any of the referenced IPs and wish to
				have an asset removed, feel free to contact me at <span id="email-placeholder"></span>. I will take action without
				hesitation or dispute.</p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🪨 Rock <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/glacial-erratic-the-cloughmore-stone-rostrover-9a74494d93024599ae1655d908f34c03" class="svelte-w8mjfd">Glacial Erratic. The Cloughmore Stone Rostrover</a> by <a target="_blank" href="https://sketchfab.com/mcg3d" class="svelte-w8mjfd">MCG 3D</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🌳 Tree <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/maple-trees-pack-lowpoly-game-ready-lods-b5d2833c258f4054a01ee2b4ef85adf0" class="svelte-w8mjfd">Maple trees pack (lowpoly, game ready, LODs)</a> by <a target="_blank" href="https://sketchfab.com/lolipop_1707" class="svelte-w8mjfd">LOLIPOP</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🐉 Goku's hair <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/chibi-goku-3d-printable-figure-6702f4fb92f44708b442fc66abb18f2d" class="svelte-w8mjfd">Chibi Goku 3D Printable Figure</a> by <a target="_blank" href="https://sketchfab.com/layerables" class="svelte-w8mjfd">layerables</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">⚡️ Minato's kunai <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/minatos-kunai-d5a4a7a897ec41b3a2788a1bd4092697" class="svelte-w8mjfd">Minato's Kunai</a> by <a target="_blank" href="https://sketchfab.com/mrkblckwd" class="svelte-w8mjfd">mrkblckwd</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🪓 Leviathan Axe <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/kratos-axe-2-by-b0neheart-94c0fac21cf643908128aed69365e456" class="svelte-w8mjfd">Kratos Axe 2 by b0neheart</a> by <a target="_blank" href="https://sketchfab.com/androzol" class="svelte-w8mjfd">Androzol</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🪵 Tree trunk for Leviathan Axe <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/low-poly-tree-trunk-variety-pack-767715600a334e76940c7e09f3f4cb7f" class="svelte-w8mjfd">Low Poly Tree Trunk Variety Pack</a> by <a target="_blank" href="https://sketchfab.com/ra3id" class="svelte-w8mjfd">Glowbox 3D</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">👺 JoJo mask <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/jojo-ishikamen-stone-mask-b23b52dfca2545db92e5a57877df0118" class="svelte-w8mjfd">JOJO Ishikamen stone mask</a> by <a target="_blank" href="https://sketchfab.com/DopamineWarlock" class="svelte-w8mjfd">DopamineWarlock</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">ゴ JoJo menacing symbol <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/menacing-symbol-jojo-9b0d8b545cc14f1597199c11d8095015" class="svelte-w8mjfd">Menacing ゴ Symbol - Jojo</a> by <a target="_blank" href="https://sketchfab.com/adamw1806" class="svelte-w8mjfd">09williamsad</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🪵 Campfire base (wood & rocks) <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/campfire-c9d956a68c894a92bc5bedd5fed95831" class="svelte-w8mjfd">Campfire</a> by <a target="_blank" href="https://sketchfab.com/filthycent" class="svelte-w8mjfd">filthycent</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">⚽️ Football ball (player skin) <span class="svelte-w8mjfd">[3d model]</span></h2> <p class="svelte-w8mjfd">This work is based on <a target="_blank" href="https://sketchfab.com/3d-models/football-ball-5660a4969d7e4b6f94038ea2ad3cd722" class="svelte-w8mjfd">Football ball</a> by <a target="_blank" href="https://sketchfab.com/OlegBochkarevRU" class="svelte-w8mjfd">MechanicRU</a> licensed under <a target="_blank" href="http://creativecommons.org/licenses/by/4.0/" class="svelte-w8mjfd">CC-BY-4.0</a></p></div> <hr/> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🦜 Background nature <span class="svelte-w8mjfd">[sound]</span></h2> <p class="svelte-w8mjfd">Sound Effect by <a target="_blank" href="https://pixabay.com/users/oxidvideos-37598254/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=217410" class="svelte-w8mjfd">Alex</a> from <a target="_blank" href="https://pixabay.com/sound-effects//?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=217410" class="svelte-w8mjfd">Pixabay</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🌊 Lake water <span class="svelte-w8mjfd">[sound]</span></h2> <p class="svelte-w8mjfd">Sound Effect by <a target="_blank" href="https://pixabay.com/users/prem_adhikary-34699741/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=176820" class="svelte-w8mjfd">Premankur Adhikary</a> from <a target="_blank" href="https://pixabay.com//?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=176820" class="svelte-w8mjfd">Pixabay</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">💥 Rock impact <span class="svelte-w8mjfd">[sound]</span></h2> <p class="svelte-w8mjfd"><a target="_blank" href="https://freesound.org/people/ultraaxvii/sounds/591152/" class="svelte-w8mjfd">rock hitting icy lake</a> by <a target="_blank" href="https://freesound.org/people/ultraaxvii/" class="svelte-w8mjfd">ultraaxvii</a> | License: <a target="_blank" href="http://creativecommons.org/publicdomain/zero/1.0/" class="svelte-w8mjfd">Creative Commons 0</a></p></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">💥 Wood impact <span class="svelte-w8mjfd">[sound]</span></h2> <p class="svelte-w8mjfd"><a target="_blank" href="https://freesound.org/people/super8ude/sounds/442538/" class="svelte-w8mjfd">TreeChop5.wav</a> by <a target="_blank" href="https://freesound.org/people/super8ude/" class="svelte-w8mjfd">super8ude</a> | License: <a target="_blank" href="http://creativecommons.org/publicdomain/zero/1.0/" class="svelte-w8mjfd">Creative Commons 0</a></p></div> <hr/> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">👤 Bruno Simon <span class="svelte-w8mjfd">[Honorable mention]</span></h2> <p class="svelte-w8mjfd">Bruno reignited my motivation to pursue side projects and introduced me
				to the world of 3D with his amazing course. His approach gave me the
				tools — and the push — to finally explore a field I had admired for so
				long, up until then only as a consumer. This project is largely inspired
				by his portfolio (both old and new), though it's filtered through my own
				curiosity and skillset.</p> <a target="_blank" href="https://www.youtube.com/@BrunoSimon" class="svelte-w8mjfd">YouTube</a></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">👤 Simondev <span class="svelte-w8mjfd">[Honorable mention]</span></h2> <p class="svelte-w8mjfd">I discovered SimonDev while researching how to make grass — and ended up
				watching nearly all his videos (some more than once). His calm, clear
				explanations made even complex concepts feel accessible, and his content
				helped me understand graphics from a new perspective.</p> <a target="_blank" href="https://www.youtube.com/@simondev758" class="svelte-w8mjfd">YouTube</a></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">👤 Acerola <span class="svelte-w8mjfd">[Honorable mention]</span></h2> <p class="svelte-w8mjfd">I stumbled upon Acerola by chance — maybe through a recommendation,
				maybe during a deep dive into rendering topics — and got instantly
				hooked. His mix of technical depth, sarcasm, and humor made his videos
				both fun and enlightening. Like SimonDev, I ended up binge-watching
				almost everything on his channel.</p> <a target="_blank" href="https://www.youtube.com/@Acerola_t" class="svelte-w8mjfd">YouTube</a></div> <div class="asset svelte-w8mjfd"><h2 class="svelte-w8mjfd">🌄 Poly Haven <span class="svelte-w8mjfd">[Honorable mention]</span></h2> <p class="svelte-w8mjfd">Huge thanks to Poly Haven for providing an incredible library of
				high-quality textures, many of which I used throughout this project.
				Their library of free textures is a blessing for curious developers
				trying to make things look better than they probably should.</p> <a target="_blank" href="https://polyhaven.com/" class="svelte-w8mjfd">Poly Heaven</a></div></div></dialog>`);
    function ro(l, e) {
        it(e, !0);
        const t = Ms(e, [
            "$$slots",
            "$$events",
            "$$legacy",
            "isShown"
        ]);
        let s;
        Vt(()=>{
            e.isShown ? s.showModal() : s.close();
        });
        var a = oo();
        Ss(a, ()=>({
                ...t
            }), void 0, void 0, void 0, "svelte-w8mjfd"), _s(a, (n)=>s = n, ()=>s), G(l, a), ot();
    }
    var lo = ye('<svg viewBox="0 0 24 24" height="1em" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m15 22-.693 1.04A1.25 1.25 0 0 0 16.25 22H15Zm-3-2 .693-1.04a1.25 1.25 0 0 0-1.386 0L12 20Zm-3 2H7.75a1.25 1.25 0 0 0 1.943 1.04L9 22ZM8.75 3.537l-.1 1.246.1-1.246Zm1.685-.697-.952-.81.952.81ZM6.532 5.686l-1.246.1 1.246-.1Zm2.154-2.154.1-1.246-.1 1.246ZM5.84 7.435l.81.952-.81-.952Zm.697-1.684 1.246-.1-1.246.1Zm-.747 4.772-.81.952.81-.952Zm0-3.046-.81-.952.81.952Zm.747 4.772-1.246-.1 1.246.1Zm-.697-1.684.81-.952-.81.952Zm2.846 3.903.1 1.246-.1-1.246Zm-2.154-2.154 1.246.1-1.246-.1Zm3.903 2.846.952-.81-.952.81Zm-1.684-.697-.1-1.246.1 1.246Zm4.772.747.952.81-.952-.81Zm-3.046 0-.952.81.952-.81Zm4.772-.747.1-1.246-.1 1.246Zm-1.684.697-.952-.81.952.81Zm3.903-2.846 1.246-.1-1.246.1Zm-2.154 2.154-.1 1.246.1-1.246Zm2.846-3.903.81.952-.81-.952Zm-.697 1.684-1.246.1 1.246-.1Zm.747-4.772.81-.952-.81.952Zm0 3.046-.81-.952.81.952Zm-.747-4.772-1.246-.1 1.246.1Zm.697 1.684-.81.952.81-.952Zm-2.846-3.903-.1-1.246.1 1.246Zm2.154 2.154 1.246.1-1.246-.1ZM13.565 2.84l.952-.81-.952.81Zm1.684.697.1 1.246-.1-1.246Zm-1.726-.747-.952.81.952-.81Zm-3.046 0 .952.81-.952-.81ZM9 14.458l.055-1.248L9 14.458Zm6.693 6.502-3-2-1.386 2.08 3 2 1.386-2.08Zm-4.386-2-3 2 1.386 2.08 3-2-1.386-2.08ZM12.57 3.6l.042.05 1.904-1.62-.042-.05-1.904 1.62Zm2.779 1.183.064-.005-.2-2.492-.065.005.2 2.492Zm.872.803-.005.064 2.492.201.005-.065-2.492-.2Zm1.128 2.8.05.043 1.62-1.904-.05-.042-1.62 1.904Zm.05 1.185-.05.042 1.62 1.904.05-.042-1.62-1.904Zm-1.183 2.779.005.064 2.492-.2-.005-.065-2.492.2Zm-.803.872-.064-.005-.201 2.492.065.005.2-2.492Zm-2.8 1.128-.043.05 1.904 1.62.042-.05-1.904-1.62Zm-1.185.05-.042-.05-1.904 1.62.042.05 1.904-1.62ZM8.65 13.217l-.064.005.2 2.492.065-.005-.2-2.492Zm-.872-.803.005-.064-2.492-.201-.005.065 2.492.2Zm-1.128-2.8L6.6 9.57l-1.62 1.904.05.042 1.62-1.904ZM6.6 8.428l.05-.042-1.62-1.904-.05.042L6.6 8.429ZM7.783 5.65l-.005-.064-2.492.2.005.065 2.492-.2Zm.803-.872.064.005.201-2.492-.065-.005-.2 2.492Zm2.8-1.128.043-.05-1.904-1.62-.042.05 1.904 1.62ZM8.65 4.783a3.25 3.25 0 0 0 2.737-1.133L9.483 2.03a.75.75 0 0 1-.632.261l-.2 2.492Zm-.872.803a.75.75 0 0 1 .808-.808l.2-2.492a3.25 3.25 0 0 0-3.5 3.5l2.492-.2Zm-1.128 2.8A3.25 3.25 0 0 0 7.783 5.65l-2.492.201a.75.75 0 0 1-.261.632l1.62 1.904ZM6.6 9.572a.75.75 0 0 1 0-1.142L4.98 6.525a3.25 3.25 0 0 0 0 4.95L6.6 9.571Zm1.183 2.779A3.25 3.25 0 0 0 6.65 9.613l-1.62 1.904a.75.75 0 0 1 .261.632l2.492.2Zm.803.872a.75.75 0 0 1-.808-.808l-2.492-.2a3.25 3.25 0 0 0 3.5 3.5l-.2-2.492ZM12.57 14.4a.75.75 0 0 1-1.142 0l-1.904 1.62a3.25 3.25 0 0 0 4.95 0l-1.904-1.62Zm3.651-1.986a.75.75 0 0 1-.808.808l-.2 2.492a3.25 3.25 0 0 0 3.5-3.5l-2.492.2Zm1.128-2.8a3.25 3.25 0 0 0-1.133 2.736l2.492-.201a.75.75 0 0 1 .261-.632l-1.62-1.904Zm.05-1.185a.75.75 0 0 1 0 1.142l1.62 1.904a3.25 3.25 0 0 0 0-4.95L17.4 8.429ZM16.217 5.65a3.25 3.25 0 0 0 1.133 2.737l1.62-1.904a.75.75 0 0 1-.261-.632l-2.492-.2Zm-.803-.872a.75.75 0 0 1 .808.808l2.492.2a3.25 3.25 0 0 0-3.5-3.5l.2 2.492Zm-2.8-1.128a3.25 3.25 0 0 0 2.736 1.133l-.201-2.492a.75.75 0 0 1-.632-.261l-1.904 1.62Zm1.861-1.67a3.25 3.25 0 0 0-4.95 0l1.904 1.62a.75.75 0 0 1 1.142 0l1.904-1.62Zm-3.088 12.37a3.25 3.25 0 0 0-2.332-1.14l-.11 2.497a.75.75 0 0 1 .538.263l1.904-1.62Zm-2.332-1.14a3.26 3.26 0 0 0-.405.007l.201 2.492a.732.732 0 0 1 .094-.002l.11-2.497ZM10.25 22v-7.542h-2.5V22h2.5Zm5.1-8.783a3.26 3.26 0 0 0-.405-.007l.11 2.497c.031-.001.062 0 .094.002l.2-2.492Zm-.405-.007a3.25 3.25 0 0 0-2.332 1.14l1.904 1.62a.75.75 0 0 1 .538-.263l-.11-2.497Zm-1.195 1.248V22h2.5v-7.542h-2.5Z" fill="currentColor"></path><path d="m14 8-3 3-1-1" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'), co = ye('<path data-name="audio-on" d="M1129.432 113v1694.148H903.545l-451.772-451.773V564.773L903.545 113h225.887Zm542.545 248.057C1832.017 521.097 1920 733.882 1920 960.107c0 226.226-87.983 438.898-248.023 598.938l-79.851-79.85c138.694-138.582 214.93-323.018 214.93-519.087 0-196.183-76.236-380.506-214.93-519.2ZM338.83 564.773v790.602H169.415C75.672 1355.375 0 1279.703 0 1185.96V734.187c0-93.742 75.672-169.414 169.415-169.414H338.83Zm1093.922 36.085c95.776 97.018 148.407 224.644 148.407 359.16 0 134.628-52.631 262.253-148.407 359.272l-80.303-79.174c74.656-75.897 115.767-175.4 115.767-280.099 0-104.585-41.111-204.088-115.767-279.986Z" fill-rule="evenodd"></path>'), uo = ye('<path data-name="audio-off" d="M1129.433 113v1694.15H903.547l-451.774-451.773V564.773L903.547 113h225.886ZM338.83 564.773v790.604H169.415c-92.806 0-167.9-74.166-169.392-166.609L0 1185.962V734.188c0-92.805 74.166-167.9 166.608-169.392l2.807-.023H338.83ZM1789.951 635 1920 764.926 1724.988 959.94 1920 1154.95 1789.951 1285l-194.89-195.012L1400.05 1285 1270 1154.951l195.012-195.012L1270 764.926 1400.049 635l195.012 195.012L1789.951 635Z" fill-rule="evenodd"></path>'), ho = ye('<svg fill="currentColor" viewBox="0 0 1920 1920" height="1em" xmlns="http://www.w3.org/2000/svg"><!></svg>'), mo = je('<div class="toggles svelte-1hptlvw"><!> <!> <!></div>');
    function po(l, e) {
        it(e, !0);
        let t = Le(!1), s = Le(!1), a = Le(!1);
        const n = (g)=>{
            w(a) !== g && (le(a, g, !0), st.setSlowMotionEnabled(g));
        }, i = (g)=>{
            g.stopPropagation(), n(!w(a));
        }, o = async (g)=>{
            g.stopPropagation(), le(t, !w(t)), await Jt.toggleMute();
        }, r = (g)=>{
            g.stopPropagation();
            const f = g.target.tagName !== "DIALOG";
            n(f);
        };
        pt(()=>{
            const g = z.on("engine-loading-audio-progress", (f)=>{
                le(s, f === 100);
            });
            return ()=>{
                g(), w(a) && st.setSlowMotionEnabled(!1);
            };
        });
        var d = mo(), h = Te(d);
        ds(h, {
            title: "Show credits",
            onclick: i,
            children: (g, f)=>{
                var v = lo();
                G(g, v);
            },
            $$slots: {
                default: !0
            }
        });
        var p = Me(h, 2);
        {
            let g = Qe(()=>w(t) ? "Mute" : "Turn audio ON"), f = Qe(()=>!w(s));
            ds(p, {
                onclick: o,
                get title () {
                    return w(g);
                },
                get disabled () {
                    return w(f);
                },
                children: (v, M)=>{
                    var C = ho(), R = Te(C);
                    {
                        var N = (P)=>{
                            var j = co();
                            G(P, j);
                        }, k = (P)=>{
                            var j = uo();
                            G(P, j);
                        };
                        rt(R, (P)=>{
                            w(t) ? P(N) : P(k, -1);
                        });
                    }
                    G(v, C);
                },
                $$slots: {
                    default: !0
                }
            });
        }
        var _ = Me(p, 2);
        ro(_, {
            get isShown () {
                return w(a);
            },
            onclick: r
        }), G(l, d), ot();
    }
    var go = ye('<svg fill="currentColor" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.7439414,7 L17.5,7 C19.9852814,7 22,9.01471863 22,11.5 C22,13.9852814 19.9852814,16 17.5,16 L11.5,16 C11.2238576,16 11,15.7761424 11,15.5 C11,15.2238576 11.2238576,15 11.5,15 L17.5,15 C19.4329966,15 21,13.4329966 21,11.5 C21,9.56700338 19.4329966,8 17.5,8 L16.9725356,8 C16.9906833,8.16416693 17,8.33099545 17,8.5 C17,8.77614237 16.7761424,9 16.5,9 C16.2238576,9 16,8.77614237 16,8.5 C16,6.56700338 14.4329966,5 12.5,5 L12,5 C9.790861,5 8,6.790861 8,9 L8,9.5 C8,9.77614237 7.77614237,10 7.5,10 C6.43258736,10 5.4933817,10.6751517 5.14273446,11.6649026 C5.0505193,11.9251928 4.76475726,12.0614445 4.50446709,11.9692293 C4.24417691,11.8770142 4.10792519,11.5912521 4.20014035,11.330962 C4.63552757,10.1020207 5.71845994,9.21978032 7,9.03565397 L7,9 C7,6.23857625 9.23857625,4 12,4 L12.5,4 C14.4593282,4 16.1261868,5.25221144 16.7439414,7 L16.7439414,7 Z M11.5,11 C11.2238576,11 11,10.7761424 11,10.5 C11,10.2238576 11.2238576,10 11.5,10 L12,10 C13.1045695,10 14,10.8954305 14,12 C14,13.1045695 13.1045695,14 12,14 L2.5,14 C2.22385763,14 2,13.7761424 2,13.5 C2,13.2238576 2.22385763,13 2.5,13 L12,13 C12.5522847,13 13,12.5522847 13,12 C13,11.4477153 12.5522847,11 12,11 L11.5,11 Z M4.5,17 C4.22385763,17 4,16.7761424 4,16.5 C4,16.2238576 4.22385763,16 4.5,16 L9,16 C10.1045695,16 11,16.8954305 11,18 C11,19.1045695 10.1045695,20 9,20 L7.5,20 C7.22385763,20 7,19.7761424 7,19.5 C7,19.2238576 7.22385763,19 7.5,19 L9,19 C9.55228475,19 10,18.5522847 10,18 C10,17.4477153 9.55228475,17 9,17 L4.5,17 Z"></path></svg>');
    function fo(l, e) {
        it(e, !0);
        let t = Le("");
        pt(()=>{
            z.on("game-wind-start", ()=>{
                le(t, "fade-in");
            }), z.on("game-wind-end", ()=>{
                le(t, "fade-out");
            });
        });
        var s = go();
        _e(()=>At(s, 0, vs(w(t)), "svelte-73zo2k")), G(l, s), ot();
    }
    var wo = ye('<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" preserveAspectRatio="xMidYMid meet"><path d="M12 3v18m6-18c-2 3-6 3-6 3S8 6 6 3a9.46 9.46 0 0 0-2 6 9.46 9.46 0 0 0 2 6c2-3 6-3 6-3s4 0 6 3a9.46 9.46 0 0 0 2-6 9.46 9.46 0 0 0-2-6Z" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width=".96"></path></svg>');
    function bo(l, e) {
        let t = gt(e, "size", 3, "1em");
        var s = wo();
        _e(()=>{
            O(s, "width", t()), O(s, "height", t());
        }), G(l, s);
    }
    var vo = ye('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" xml:space="preserve" fill="currentColor" stroke="currentColor" stroke-width="20.48" preserveAspectRatio="xMidYMid meet"><path d="M511.992 256c0 141.377-114.608 256-255.993 256C114.612 512 0 397.377 0 256 0 114.609 114.612 0 255.999 0c141.385 0 255.993 114.609 255.993 256z" fill="currentColor"></path><path d="M451.823 319.517c-20.442 62.928-70.588 112.753-133.704 132.757-6.95 2.207-10.797 9.63-8.591 16.572 2.2 6.943 9.623 10.79 16.566 8.583 71.297-22.633 127.699-78.677 150.827-149.76 2.257-6.928-1.541-14.373-8.469-16.63-6.929-2.248-14.373 1.549-16.629 8.478zM255.999 0C114.612 0 0 114.609 0 256c0 82.805 39.349 156.38 100.329 203.174L459.173 100.33C412.38 39.349 338.804 0 255.999 0z" fill="currentColor"></path><path d="M199.047 30.816C117.969 51.35 53.872 114.451 31.897 194.949c-1.92 7.029 2.224 14.294 9.257 16.206 7.029 1.921 14.287-2.228 16.207-9.257C76.767 130.644 133.76 74.535 205.516 56.402c7.072-1.792 11.349-8.971 9.558-16.028-1.784-7.072-8.963-11.35-16.027-9.558zm56.952 146.872 22.341 55.829 59.991 3.997-46.192 38.498 14.746 58.285-50.886-32.026-50.884 32.026 14.738-58.285-46.192-38.498 59.999-3.997z" fill="currentColor"></path></svg>');
    function yo(l, e) {
        let t = gt(e, "size", 3, "1em");
        var s = vo();
        _e(()=>{
            O(s, "width", t()), O(s, "height", t());
        }), G(l, s);
    }
    var So = ye('<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" stroke-width=".00016" preserveAspectRatio="xMidYMid meet"><path d="M9.32 15.653a.812.812 0 0 1-.086-.855c.176-.342.245-.733.2-1.118a2.106 2.106 0 0 0-.267-.779 2.027 2.027 0 0 0-.541-.606 3.96 3.96 0 0 1-1.481-2.282c-1.708 2.239-1.053 3.51-.235 4.63a.748.748 0 0 1-.014.901.87.87 0 0 1-.394.283.838.838 0 0 1-.478.023c-1.105-.27-2.145-.784-2.85-1.603a4.686 4.686 0 0 1-.906-1.555 4.811 4.811 0 0 1-.263-1.797s-.133-2.463 2.837-4.876c0 0 3.51-2.978 2.292-5.18a.621.621 0 0 1 .112-.653.558.558 0 0 1 .623-.147l.146.058a7.63 7.63 0 0 1 2.96 3.5c.58 1.413.576 3.06.184 4.527.325-.292.596-.641.801-1.033l.029-.064c.198-.477.821-.325 1.055-.013.086.137 2.292 3.343 1.107 6.048a5.516 5.516 0 0 1-1.84 2.027 6.127 6.127 0 0 1-2.138.893.834.834 0 0 1-.472-.038.867.867 0 0 1-.381-.29zM7.554 7.892a.422.422 0 0 1 .55.146c.04.059.066.126.075.198l.045.349c.02.511.014 1.045.213 1.536.206.504.526.95.932 1.298a3.06 3.06 0 0 1 1.16 1.422c.22.564.25 1.19.084 1.773a4.123 4.123 0 0 0 1.39-.757l.103-.084c.336-.277.613-.623.813-1.017.201-.393.322-.825.354-1.269.065-1.025-.284-2.054-.827-2.972-.248.36-.59.639-.985.804-.247.105-.509.17-.776.19a.792.792 0 0 1-.439-.1.832.832 0 0 1-.321-.328.825.825 0 0 1-.035-.729c.412-.972.54-2.05.365-3.097a5.874 5.874 0 0 0-1.642-3.16c-.156 2.205-2.417 4.258-2.881 4.7a3.537 3.537 0 0 1-.224.194c-2.426 1.965-2.26 3.755-2.26 3.834a3.678 3.678 0 0 0 .459 2.043c.365.645.89 1.177 1.52 1.54C4.5 12.808 4.5 10.89 7.183 8.14l.372-.25z"></path></svg>');
    function Mo(l, e) {
        let t = gt(e, "size", 3, "1em");
        var s = So();
        _e(()=>{
            O(s, "width", t()), O(s, "height", t());
        }), G(l, s);
    }
    var _o = ye('<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=".64" preserveAspectRatio="xMidYMid meet"><g transform="rotate(90 8 8)"><path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5"></path></g></svg>');
    function xo(l, e) {
        let t = gt(e, "size", 3, "1em");
        var s = _o();
        _e(()=>{
            O(s, "width", t()), O(s, "height", t());
        }), G(l, s);
    }
    var Io = ye('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><path d="M12 19c-2.50655 0-4.08194-1.3453-5.13349-2.6112-.4393-.5289-1.28034-.5218-1.66483.0435C4.50078 17.4629 3.68402 18.4127 2 18.7859m20 0c-1.5877-.3518-2.4045-1.2162-3.0801-2.1776-.4234-.6024-1.3544-.5658-1.8144.0125-.4102.5157-.8992.9911-1.4907 1.3792M12 9c2.5065 0 4.0819-1.34529 5.1335-2.61123.4393-.52886 1.2803-.5218 1.6648.04356C19.4992 7.46288 20.316 8.41274 22 8.78594m-20 0c1.58767-.35184 2.40448-1.21625 3.08009-2.1776.42336-.60243 1.35445-.56582 1.81438.01242.4102.5157.89926.99114 1.49072 1.37924M22 13.7859c-1.5877-.3518-2.4045-1.2162-3.0801-2.1776-.4234-.6024-1.3544-.5658-1.8144.0125C16.0541 12.9427 14.4844 14 12 14c-2.50655 0-4.08194-1.3453-5.13349-2.6112-.4393-.5289-1.28034-.5218-1.66483.0435C4.50078 12.4629 3.68402 13.4127 2 13.7859" stroke="currentColor" stroke-width=".96" stroke-linecap="round" stroke-linejoin="round"></path></svg>');
    function Co(l, e) {
        let t = gt(e, "size", 3, "1em");
        var s = Io();
        _e(()=>{
            O(s, "width", t()), O(s, "height", t());
        }), G(l, s);
    }
    var Ao = ye('<foreignObject class="radial-menu__icon svelte-1vx8gxj" aria-hidden="true"><div class="radial-menu__icon-box svelte-1vx8gxj"><!></div></foreignObject>'), To = ye('<text class="radial-menu__icon radial-menu__icon--unknown svelte-1vx8gxj" text-anchor="middle" dominant-baseline="middle">?</text>'), Po = ye('<text class="radial-menu__label svelte-1vx8gxj" text-anchor="middle" dominant-baseline="middle"> </text>'), ko = ye('<g role="button"><path class="radial-menu__arc svelte-1vx8gxj"></path><!><!></g>'), Eo = je('<div class="radial-menu__hint radial-menu__hint--secondary svelte-1vx8gxj">Swipe up or scroll up to call wind</div>'), Do = je('<div><svg class="radial-menu__ring svelte-1vx8gxj"></svg> <div class="radial-menu__hints svelte-1vx8gxj" aria-live="polite"><div class="radial-menu__hint svelte-1vx8gxj">Press L or Esc to close</div> <!></div></div>');
    function Bo(l, e) {
        it(e, !0);
        let t = Le(!1), s = Le(Ka([])), a = Le(null);
        const n = 78, i = 178, o = 4, r = 400, d = r / 2, h = (n + i) / 2, p = -13, _ = -20, g = 26;
        let f = Le(null);
        const v = {
            fire: Mo,
            water: Co,
            sword: xo,
            axe: bo,
            dragonball: yo
        }, M = (I)=>I * Math.PI / 180, C = (I, L)=>({
                x: d + I * Math.cos(L),
                y: d + I * Math.sin(L)
            }), R = (I)=>{
            if (!I.length) return [];
            const L = 360 / I.length, Y = M(L), $ = M(o), W = Math.min($ * i / n, Math.max(Y - .02, 0));
            return I.map((ne, fe)=>{
                const Q = M(fe * L - 90), q = Q + Y, K = Q + $ / 2, ee = q - $ / 2, Re = Q + W / 2, De = q - W / 2, Be = ee - K > Math.PI ? 1 : 0, Ne = De - Re > Math.PI ? 1 : 0, ue = C(i, K), Fe = C(i, ee), Se = C(n, Re), F = C(n, De), ie = C(h, (K + ee) / 2);
                return {
                    landmark: ne,
                    labelX: ie.x,
                    labelY: ie.y,
                    delay: `${fe * .05}s`,
                    path: `M ${ue.x} ${ue.y} A ${i} ${i} 0 ${Be} 1 ${Fe.x} ${Fe.y} L ${F.x} ${F.y} A ${n} ${n} 0 ${Ne} 0 ${Se.x} ${Se.y} Z`
                };
            });
        };
        let N = Qe(()=>R(w(s))), k = Qe(()=>w(a) ? w(s).find((I)=>I.windTargetId === w(a))?.id ?? null : null), P = Qe(()=>w(t) && w(N).length > 0);
        const j = ()=>Array.from(w(f)?.querySelectorAll(".radial-menu__slot[tabindex='0']") ?? []), U = (I)=>{
            !I.hasBeenDiscovered || !I.windTargetId || !Ce.activateTargetById(I.windTargetId) || (z.emit("landmark-selected", I.id), le(t, !1));
        };
        pt(()=>{
            const I = z.on("landmark-discovered", ()=>{
                le(s, Ie.getAll(), !0);
            }), L = z.on("wind-target-change", (W)=>{
                le(a, W, !0);
            }), Y = (W)=>{
                if (W.code === "KeyL" && !W.repeat) {
                    le(s, Ie.getAll(), !0), le(t, !w(t));
                    return;
                }
                if (w(P)) {
                    if (W.code === "Escape") {
                        le(t, !1);
                        return;
                    }
                    if (W.key === "Tab") {
                        W.preventDefault();
                        const ne = j();
                        if (!ne.length) return;
                        const fe = ne.indexOf(document.activeElement), Q = W.shiftKey ? -1 : 1, q = fe === -1 ? 0 : (fe + Q + ne.length) % ne.length;
                        ne[q].focus();
                    }
                }
            }, $ = (W)=>{
                w(P) && w(f) && W.target instanceof Node && !w(f).contains(W.target) && le(t, !1);
            };
            return window.addEventListener("keydown", Y), window.addEventListener("pointerdown", $), le(s, Ie.getAll(), !0), le(a, Ce.activeTargetId, !0), ()=>{
                I(), L(), window.removeEventListener("keydown", Y), window.removeEventListener("pointerdown", $);
            };
        }), Vt(()=>(st.setSlowMotionEnabled(w(P)), ()=>{
                w(P) && st.setSlowMotionEnabled(!1);
            })), Vt(()=>{
            w(P) && requestAnimationFrame(()=>{
                const I = j();
                if (!I.length) return;
                ((w(k) ? I.find((Y)=>Y.dataset.landmarkId === w(k)) : null) ?? I[0]).focus();
            });
        });
        var ae = Xa(), ge = $a(ae);
        {
            var Ae = (I)=>{
                var L = Do();
                let Y;
                var $ = Te(L);
                O($, "viewBox", "0 0 400 400"), O($, "width", r), O($, "height", r), qa($, 21, ()=>w(N), (Q)=>Q.landmark.id, (Q, q)=>{
                    const K = Qe(()=>w(q).landmark);
                    var ee = ko();
                    let Re;
                    var De = Te(ee), Be = Me(De);
                    {
                        var Ne = (F)=>{
                            const ie = Qe(()=>v[w(K).icon]);
                            var we = Ao();
                            O(we, "width", g), O(we, "height", g);
                            var qe = Te(we), ft = Te(qe);
                            Ja(ft, ()=>w(ie), (He, ze)=>{
                                ze(He, {
                                    size: "1em"
                                });
                            }), _e(()=>{
                                O(we, "x", w(q).labelX + p), O(we, "y", w(q).labelY + _);
                            }), G(F, we);
                        }, ue = (F)=>{
                            var ie = To();
                            _e(()=>{
                                O(ie, "x", w(q).labelX), O(ie, "y", w(q).labelY - 6);
                            }), G(F, ie);
                        };
                        rt(Be, (F)=>{
                            w(K).hasBeenDiscovered ? F(Ne) : F(ue, -1);
                        });
                    }
                    var Fe = Me(Be);
                    {
                        var Se = (F)=>{
                            var ie = Po(), we = Te(ie);
                            _e(()=>{
                                O(ie, "x", w(q).labelX), O(ie, "y", w(q).labelY + 16), ys(we, w(K).name);
                            }), G(F, ie);
                        };
                        rt(Fe, (F)=>{
                            w(K).hasBeenDiscovered && F(Se);
                        });
                    }
                    _e(()=>{
                        Re = At(ee, 0, "radial-menu__slot svelte-1vx8gxj", null, Re, {
                            discovered: w(K).hasBeenDiscovered,
                            selected: w(k) === w(K).id
                        }), Ht(ee, `--delay: ${w(q).delay ?? ""}`), O(ee, "tabindex", w(P) && w(K).hasBeenDiscovered ? 0 : -1), O(ee, "data-landmark-id", w(K).id), O(ee, "aria-label", w(K).hasBeenDiscovered ? w(K).name : "Undiscovered landmark"), O(De, "d", w(q).path);
                    }), ls("click", ee, ()=>U(w(K))), ls("keydown", ee, (F)=>F.key === "Enter" && U(w(K))), G(Q, ee);
                });
                var W = Me($, 2), ne = Me(Te(W), 2);
                {
                    var fe = (Q)=>{
                        var q = Eo();
                        G(Q, q);
                    };
                    rt(ne, (Q)=>{
                        w(k) && Q(fe);
                    });
                }
                _s(L, (Q)=>le(f, Q), ()=>w(f)), _e(()=>Y = At(L, 1, "radial-menu svelte-1vx8gxj", null, Y, {
                        open: w(P)
                    })), G(I, L);
            };
            rt(ge, (I)=>{
                w(N).length > 0 && I(Ae);
            });
        }
        G(l, ae), ot();
    }
    Ya([
        "click",
        "keydown"
    ]);
    var Lo = je('<span class="wip-badge svelte-1o7mwgc" aria-label="Work in Progress">Work in Progress</span>');
    function Ro(l) {
        var e = Lo();
        G(l, e);
    }
    var No = je('<div class="ui-root svelte-17mrr5a"><!> <!> <!> <!> <!> <!> <!></div>');
    function Fo(l, e) {
        it(e, !0);
        var t = No(), s = Te(t);
        po(s, {});
        var a = Me(s, 2);
        Ro(a);
        var n = Me(a, 2);
        eo(n, {});
        var i = Me(n, 2);
        so(i);
        var o = Me(i, 2);
        {
            var r = (p)=>{
                no(p, {});
            };
            rt(o, (p)=>{
                p(r);
            });
        }
        var d = Me(o, 2);
        fo(d, {});
        var h = Me(d, 2);
        Bo(h, {}), G(l, t), ot();
    }
    class Oo {
        constructor(){
            this.mountSvelte();
        }
        mountSvelte() {
            Qa(Fo, {
                target: document.body
            });
        }
    }
    const Uo = new $i;
    new Oo;
    const Wo = async ()=>{
        try {
            await Uo.initAsync();
            const l = new Mi;
            z.emit("engine-loading-core-progress", 90);
            const e = await Yi.runStartupPrewarmAsync();
            e.completed && !1 || (e.timedOut ? console.warn("[main] Prewarm timed out. Continuing startup.") : e.error ? console.error("[main] Prewarm failed. Continuing startup.", e.error) : console.warn("[main] Prewarm exited early. Continuing startup.")), z.emit("engine-loading-core-progress", 100), l.startLoop();
        } catch (l) {
            console.error("[main] Startup failed.", l);
        }
    };
    Wo();
});
