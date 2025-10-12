import { L as es, S as be, D as Ut, T as ts, a as ss, G as os, C as ns, N as gt, R as as, P as rs, p as is, b as ls, r as cs, W as us, c as ds, A as ms, d as hs, e as ps, f as fs, g as gs, h as ws, i as ys, V as T, _ as Ss, M as wt, j as bs, k as Et, l as xs, m as Z, H as Is, n as As, O as Ms, F as _s, o as w, t as A, v as L, q as Es, s as Xe, I as we, u as Ot, w as Ue, x as k, y as x, z as P, B, E as re, J as r, K as xe, Q as V, U as Ie, X as Gt, Y as G, Z as kt, $ as Ps, a0 as Ls, a1 as vs, a2 as Ds, a3 as F, a4 as M, a5 as Oe, a6 as Ts, a7 as X, a8 as Pt, a9 as Bs, aa as m, ab as bt, ac as Fe, ad as $e, ae as Te, af as zt, ag as Lt, ah as ht, ai as vt, aj as Cs, ak as Ns, al as Rs, am as pt, an as de, ao as Dt, ap as Fs, aq as ft, ar as Us, as as Ye, at as Ht, au as yt, av as Wt, aw as Os, ax as Gs, ay as Tt, az as ks, aA as je, aB as Ke, aC as ge, aD as St, aE as zs, aF as Bt, aG as De, aH as Vt, aI as Ct, aJ as Hs, aK as Ws, aL as ne, aM as Vs, aN as Zs, aO as js } from "./three-ChyUjLpW.js";
import { P as Ks } from "./tweakpane-SMt8byX-.js";
import { S as Nt } from "./stats-gl-C2M3amu4.js";
import { e as qs } from "./tseep-zr-hWxBz.js";
import { World as Ys, EventQueue as Js, RigidBodyDesc as ie, ColliderDesc as le, HeightFieldFlags as Xs, Ray as $s, ActiveEvents as Qs, __tla as __tla_0 } from "./@dimforge-CqaeYUkE.js";
import { n as eo } from "./nipplejs-BxsX8Mt3.js";
import { d as to } from "./lodash-es-BMmXVQ06.js";
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
        for (const o of document.querySelectorAll('link[rel="modulepreload"]'))s(o);
        new MutationObserver((o)=>{
            for (const n of o)if (n.type === "childList") for (const a of n.addedNodes)a.tagName === "LINK" && a.rel === "modulepreload" && s(a);
        }).observe(document, {
            childList: !0,
            subtree: !0
        });
        function t(o) {
            const n = {};
            return o.integrity && (n.integrity = o.integrity), o.referrerPolicy && (n.referrerPolicy = o.referrerPolicy), o.crossOrigin === "use-credentials" ? n.credentials = "include" : o.crossOrigin === "anonymous" ? n.credentials = "omit" : n.credentials = "same-origin", n;
        }
        function s(o) {
            if (o.ep) return;
            o.ep = !0;
            const n = t(o);
            fetch(o.href, n);
        }
    })();
    const so = {
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
    }, oo = {
        stones: so
    };
    class no {
        manager;
        constructor(){
            this.manager = this.createLoadingManager();
        }
        onErrorLog(e) {
            console.log("There was an error loading " + e);
        }
        createLoadingManager() {
            const e = new es;
            return e.onError = this.onErrorLog, e;
        }
    }
    const Zt = new no, ao = "/models/realm.glb", ro = "/textures/environment/px.webp", io = "/textures/environment/nx.webp", lo = "/textures/environment/py.webp", co = "/textures/environment/ny.webp", uo = "/textures/environment/pz.webp", mo = "/textures/environment/nz.webp", ho = "/textures/noise/noise.webp", po = "/textures/realm/terrainType.webp", fo = "/textures/realm/sandNormal.webp", go = "/textures/realm/grassNormal.webp", wo = "/textures/realm/grassDiffuse.webp", yo = "/textures/realm/waterNormal.webp", So = "/textures/realm/terrainShadowAo.webp", bo = "/textures/realm/waterLiliesDiffuse.webp", xo = "/textures/realm/waterLiliesAlpha.webp", Io = "/textures/realm/flowerAtlas.webp", Ao = "/textures/realm/stoneAtlas.webp", Mo = "/textures/realm/barkDiffuse.webp", _o = "/textures/realm/barkNormal.webp", Eo = "/textures/realm/canopyDiffuse.webp", Po = "/textures/realm/canopyNormal.webp", Lo = "/textures/realm/axeDiffuse.webp", vo = "/textures/realm/axeEmissive.webp", Do = "/textures/realm/trunkDiffuse.webp", To = "/textures/realm/trunkNormal.webp", Bo = "/textures/realm/onePieceAtlas.webp", Co = "/textures/realm/kunaiDiffuse.webp", No = "/textures/realm/kunaiMR.webp", Ro = "/textures/realm/campfireDiffuse.webp", Fo = "/textures/realm/fireSprites.webp", Uo = "/textures/realm/footballDiffuse.webp", Oo = "/textures/realm/leafDiffuse.webp", Go = "/textures/noise/noise2.webp", ko = [
        {
            name: "realmModel",
            url: ao,
            type: "gltf"
        },
        {
            name: "noiseTexture",
            url: ho,
            type: "texture"
        },
        {
            name: "envMapTexture",
            urls: [
                ro,
                io,
                lo,
                co,
                uo,
                mo
            ],
            type: "cubeTexture",
            colorSpace: be
        },
        {
            name: "waterLiliesTexture",
            url: bo,
            type: "texture",
            flipY: !1
        },
        {
            name: "waterLiliesAlphaTexture",
            url: xo,
            type: "texture",
            flipY: !1
        },
        {
            name: "flowerAtlas",
            url: Io,
            type: "texture",
            flipY: !1
        },
        {
            name: "stoneAtlas",
            url: Ao,
            type: "texture",
            flipY: !1
        },
        {
            name: "canopyDiffuse",
            url: Eo,
            type: "texture",
            flipY: !1
        },
        {
            name: "canopyNormal",
            url: Po,
            type: "texture",
            flipY: !1
        },
        {
            name: "barkDiffuse",
            url: Mo,
            type: "texture",
            flipY: !1,
            colorSpace: be
        },
        {
            name: "barkNormal",
            url: _o,
            type: "texture",
            flipY: !1
        },
        {
            name: "axeDiffuse",
            url: Lo,
            type: "texture",
            flipY: !1
        },
        {
            name: "axeEmissive",
            url: vo,
            type: "texture",
            flipY: !1
        },
        {
            name: "trunkDiffuse",
            url: Do,
            type: "texture",
            flipY: !1,
            colorSpace: be
        },
        {
            name: "trunkNormal",
            url: To,
            type: "texture",
            flipY: !1
        },
        {
            name: "onePieceAtlas",
            url: Bo,
            type: "texture",
            flipY: !1
        },
        {
            name: "kunaiDiffuse",
            url: Co,
            type: "texture",
            flipY: !1,
            colorSpace: be
        },
        {
            name: "kunaiMR",
            url: No,
            type: "texture",
            flipY: !1
        },
        {
            name: "campfireDiffuse",
            url: Ro,
            type: "texture",
            flipY: !1,
            colorSpace: be
        },
        {
            name: "fireSprites",
            url: Fo,
            type: "texture"
        },
        {
            name: "footballDiffuse",
            url: Uo,
            type: "texture",
            colorSpace: be
        },
        {
            name: "leafDiffuse",
            url: Oo,
            type: "texture",
            colorSpace: be
        },
        {
            name: "sandNormal",
            url: fo,
            type: "texture",
            wrap: !0
        },
        {
            name: "grassNormal",
            url: go,
            type: "texture",
            wrap: !0
        },
        {
            name: "grassDiffuse",
            url: wo,
            type: "texture",
            wrap: !0
        },
        {
            name: "terrainTypeTexture",
            url: po,
            type: "texture",
            flipY: !1
        },
        {
            name: "terrainShadowAoTexture",
            url: So,
            type: "texture",
            flipY: !1
        },
        {
            name: "waterNormal",
            url: yo,
            type: "texture"
        },
        {
            name: "noise2",
            url: Go,
            type: "texture",
            wrap: !0
        }
    ];
    class zo {
        atlasesCoords = oo;
        textureLoader;
        gltfLoader;
        cubeTextureLoader;
        resources = {
            terrainHeightMap: new Ut
        };
        constructor(e){
            this.textureLoader = new ts(e);
            const t = new ss;
            t.setDecoderPath("/draco/"), this.gltfLoader = new os(e), this.gltfLoader.setDRACOLoader(t), this.cubeTextureLoader = new ns(e);
        }
        getResource = async (e)=>{
            switch(e.type){
                case "texture":
                    return this.textureLoader.loadAsync(e.url).then((t)=>{
                        t.flipY = e.flipY ?? !0, t.colorSpace = e.colorSpace ?? gt, e.wrap && (t.wrapS = t.wrapT = as), this.resources[e.name] = t;
                    });
                case "gltf":
                    return this.gltfLoader.loadAsync(e.url).then((t)=>{
                        this.resources[e.name] = t;
                    });
                case "cubeTexture":
                    return this.cubeTextureLoader.loadAsync(e.urls).then((t)=>{
                        t.colorSpace = e.colorSpace ?? gt, this.resources[e.name] = t;
                    });
                default:
                    throw new Error(`Unsupported resource type: ${e.type}`);
            }
        };
        async initAsync() {
            const e = ko.map((t)=>this.getResource(t));
            await Promise.all(e);
        }
    }
    const d = new zo(Zt.manager);
    class Ho {
        panel;
        constructor(){
            this.panel = new Ks({
                title: "Revo Realms"
            }), this.panel.hidden = !0, this.panel.element.parentElement?.classList.add("debug-panel");
        }
        setVisibility(e) {
            this.panel.hidden = !e;
        }
    }
    const ee = new Ho;
    class Wo {
        stats;
        lastSecond = performance.now();
        drawCallsPanel;
        trianglesPanel;
        constructor(e){
            const t = new Nt({
                trackGPU: !0,
                logsPerSecond: 4,
                graphsPerSecond: 30,
                samplesLog: 40,
                samplesGraph: 10,
                horizontal: !1,
                precision: 2
            });
            t.dom.classList.add("monitoring-panel"), e && document.body.appendChild(t.dom), this.stats = t, this.drawCallsPanel = this.createNumberPanel("# DRAW CALLS", "#fff", "#333"), this.trianglesPanel = this.createNumberPanel("# TRIANGLES", "#ffdab9", "#163843");
        }
        createNumberPanel(e, t, s) {
            const o = this.stats.addPanel(new Nt.Panel(e, t, s));
            return o.update = (n)=>{
                const a = o.canvas.getContext("2d");
                if (!a) return;
                const { width: i, height: l } = o.canvas;
                a.clearRect(0, 0, i, l), a.fillStyle = s, a.fillRect(0, 0, i, l), a.fillStyle = t;
                const u = a.font;
                a.textAlign = "left", a.textBaseline = "top", a.fillText(o.name, 4, 4), a.font = "bold 20px Arial", a.textAlign = "center", a.textBaseline = "middle";
                const h = Vo.format(n);
                a.fillText(`${h}`, i / 2, l / 1.65), a.font = u;
            }, o;
        }
        updateCustomPanels() {
            const e = performance.now();
            if (e - this.lastSecond < 1e3) return;
            const { render: t } = me.renderer.info;
            this.drawCallsPanel.update(t.drawCalls, 0), this.trianglesPanel.update(t.triangles, 0), this.lastSecond = e;
        }
    }
    const Vo = new Intl.NumberFormat("en-US", {
        notation: "compact"
    }), Zo = [
        2,
        4,
        16,
        64
    ], U = new qs.EventEmitter, jo = (c)=>{
        let e = 0;
        U.on("update", (t)=>{
            e++, !(e < c) && (e = 0, U.emit(`update-throttle-${c}x`, t));
        });
    };
    Zo.forEach((c)=>jo(c));
    class Ko extends rs {
        scenePass;
        debugFolder = ee.panel.addFolder({
            title: "⭐️ Postprocessing",
            expanded: !1
        });
        constructor(e){
            super(e), this.scenePass = is(E.scene, E.renderCamera);
            const t = this.makeGraph();
            this.outputNode = t, U.on("camera-changed", ()=>{
                this.scenePass.camera = E.renderCamera, this.scenePass.needsUpdate = !0;
            });
        }
        makeGraph() {
            this.outputColorTransform = !1;
            const e = this.scenePass.getTextureNode(), t = ls(e, .25, .15, 1);
            t.smoothWidth.value = .04, t._nMips = 2, this.debugFolder.addBinding(t.strength, "value", {
                label: "Bloom strength"
            }), this.debugFolder.addBinding(t.threshold, "value", {
                label: "Bloom threshold"
            });
            const s = e.add(t);
            return cs(s);
        }
    }
    class qo {
        renderer;
        canvas;
        isWebGPU;
        prevFrame = null;
        monitoringManager;
        postprocessingManager;
        IS_POSTPROCESSING_ENABLED = !0;
        IS_MONITORING_ENABLED = !1;
        IS_DEBUGGING_ENABLED = !1;
        constructor(){
            const e = document.createElement("canvas");
            e.classList.add("revo-realms"), document.body.appendChild(e), this.canvas = e;
            const t = new us({
                canvas: e,
                antialias: !0,
                trackTimestamp: this.IS_MONITORING_ENABLED,
                powerPreference: "high-performance",
                stencil: !1,
                depth: !0
            });
            t.shadowMap.enabled = !0, t.shadowMap.type = ds, t.toneMapping = ms, t.setClearColor(0, 1), t.toneMappingExposure = 1.5, this.renderer = t, this.monitoringManager = new Wo(this.IS_MONITORING_ENABLED), ee.setVisibility(this.IS_DEBUGGING_ENABLED), U.on("resize", (s)=>{
                const o = Math.max(this.IS_POSTPROCESSING_ENABLED ? s.dpr * .85 : s.dpr, 1);
                t.setSize(s.width, s.height), t.setPixelRatio(o);
            });
        }
        async init() {
            E.init(), this.isWebGPU = !!await navigator.gpu?.requestAdapter(), this.postprocessingManager = new Ko(this.renderer), this.IS_MONITORING_ENABLED && await this.monitoringManager.stats.init(this.renderer);
        }
        async renderSceneAsync() {
            return this.IS_POSTPROCESSING_ENABLED ? this.postprocessingManager.renderAsync() : this.renderer.renderAsync(E.scene, E.renderCamera);
        }
        renderWithMonitoring() {
            const e = Promise.all([
                this.renderer.resolveTimestampsAsync("compute"),
                this.renderSceneAsync(),
                this.renderer.resolveTimestampsAsync("render")
            ]);
            this.prevFrame?.then(()=>{
                this.monitoringManager.updateCustomPanels(), this.monitoringManager.stats.update();
            }).catch((t)=>{
                console.error("[renderWithMonitoring] previous frame error:", t);
            }), this.prevFrame = e;
        }
        async renderAsync() {
            this.IS_MONITORING_ENABLED ? this.renderWithMonitoring() : this.renderSceneAsync();
        }
    }
    const me = new qo;
    class Yo {
        scene;
        playerCamera;
        renderCamera;
        cameraHelper;
        controls;
        orbitControlsCamera;
        constructor(){
            const e = new hs;
            this.scene = e;
            const t = window.innerWidth, s = window.innerHeight, o = t / s, n = new ps(45, o, .01, 150);
            n.position.set(0, 5, 10), this.playerCamera = n, e.add(n), this.renderCamera = n, U.on("resize", (a)=>{
                this.playerCamera.aspect = a.aspect, this.playerCamera.updateProjectionMatrix();
            });
        }
        debugScene() {
            if (!this.controls) return;
            ee.panel.addFolder({
                title: "🎥 View",
                index: 0
            }).addBinding(this.controls, "enabled", {
                label: "Enable orbit controls"
            }).on("change", ({ value: t })=>{
                !this.cameraHelper || !this.orbitControlsCamera || (this.renderCamera = t ? this.orbitControlsCamera : this.playerCamera, this.cameraHelper.visible = t, U.emit("camera-changed"));
            });
        }
        init() {}
        update() {
            this.controls?.enabled && this.controls.update();
        }
    }
    const E = new Yo, Jo = "/audio/ambient/ambient.mp3", Xo = "/audio/ambient/lake.mp3", $o = "/audio/collisions/hitWood.mp3", Qo = "/audio/collisions/hitStone.mp3";
    class en {
        audioLoader;
        audioListener;
        isReady = !1;
        isMute = !0;
        files = [];
        ambient;
        lake;
        hitWood;
        hitStone;
        constructor(e){
            this.audioLoader = new fs(e), this.audioListener = new gs, E.playerCamera.add(this.audioListener);
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
            const o = new ws(this.audioListener);
            return o.setBuffer(e), o.setVolume(0), o.setLoop(s), o.userData.originalVolume = t, this.files.push(o), o;
        }
        newPositionalAudio(e, t = 1, s = !1, o = 1) {
            const n = new ys(this.audioListener);
            return n.setBuffer(e), n.setVolume(0), n.setLoop(s), n.userData.originalVolume = t, n.setMaxDistance(o), this.files.push(n), n;
        }
        async initAsync() {
            const e = await Promise.all([
                this.audioLoader.loadAsync(Jo),
                this.audioLoader.loadAsync(Xo),
                this.audioLoader.loadAsync($o),
                this.audioLoader.loadAsync(Qo)
            ]);
            this.ambient = this.newAudio(e[0], .05, !0), this.lake = this.newPositionalAudio(e[1], 1, !0, 10), this.hitWood = this.newAudio(e[2], 0, !1), this.hitStone = this.newAudio(e[3], 0, !1), this.isReady = !0, U.emit("audio-ready");
        }
    }
    const ae = new en(Zt.manager);
    var j = ((c)=>(c.Player = "Player", c.Terrain = "Terrain", c.Wood = "Wood", c.Stone = "Stone", c))(j || {});
    const tn = ()=>({
            minImpactSq: 5,
            maxImpactSq: 400,
            minImpactVolume: .01,
            maxImpactVolume: .25
        }), fe = tn();
    class sn {
        world;
        eventQueue;
        IS_DEBUGGING_ENABLED = !1;
        dummyVectorLinVel = new T;
        debugMesh;
        constructor(){
            this.IS_DEBUGGING_ENABLED && (this.debugMesh = this.createDebugMesh(), E.scene.add(this.debugMesh));
        }
        async initAsync() {
            return Ss(()=>import("./@dimforge-CqaeYUkE.js").then(async (m)=>{
                    await m.__tla;
                    return m;
                }), []).then(()=>{
                this.world = new Ys({
                    x: 0,
                    y: -9.81,
                    z: 0
                }), this.eventQueue = new Js(!0);
            });
        }
        getColliderName(e) {
            return e?.parent?.()?.userData?.type;
        }
        impactToVolume(e) {
            const t = wt.mapLinear(e, fe.minImpactSq, fe.maxImpactSq, fe.minImpactVolume, fe.maxImpactVolume);
            return wt.clamp(t, fe.minImpactVolume, fe.maxImpactVolume);
        }
        onCollisionWithWood(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < fe.minImpactSq) return;
            const o = this.impactToVolume(s);
            ae.hitWood.setVolume(o), ae.hitWood.play();
        }
        onCollisionWithStone(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < fe.minImpactSq) return;
            const o = this.impactToVolume(s);
            ae.hitStone.setVolume(o), ae.hitStone.play();
        }
        handleCollisionSounds() {
            this.eventQueue.drainCollisionEvents((e, t, s)=>{
                if (ae.isMute) return;
                const o = this.world.getCollider(e), n = this.world.getCollider(t);
                if (!(this.getColliderName(o) === j.Player) || !s) return;
                switch(this.getColliderName(n)){
                    case j.Wood:
                        this.onCollisionWithWood(o);
                        break;
                    case j.Stone:
                        this.onCollisionWithStone(o);
                        break;
                }
            });
        }
        createDebugMesh() {
            return new bs(new Et, new xs);
        }
        updateDebugMesh() {
            if (!this.debugMesh) return;
            const e = this.world.debugRender();
            this.debugMesh.geometry.dispose(), this.debugMesh.geometry = new Et, this.debugMesh.geometry.setPositions(e.vertices), this.debugMesh.computeLineDistances();
        }
        update() {
            this.updateDebugMesh(), this.world.step(this.eventQueue), ae.isReady && this.handleCollisionSounds();
        }
    }
    const C = new sn;
    class on {
        constructor(){
            ("ontouchstart" in window || navigator.maxTouchPoints > 0) && document.body.classList.add("is-touch-device");
        }
        async initAsync() {
            await Promise.all([
                C.initAsync(),
                d.initAsync()
            ]), await me.init(), ae.initAsync();
        }
    }
    class nn {
        keysPressed;
        keyDownListeners;
        keyUpListeners;
        constructor(){
            this.keysPressed = new Set, this.keyDownListeners = new Map, this.keyUpListeners = new Map, this.handleKeyDown = this.handleKeyDown.bind(this), this.handleKeyUp = this.handleKeyUp.bind(this), window.addEventListener("keydown", this.handleKeyDown), window.addEventListener("keyup", this.handleKeyUp);
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
            window.removeEventListener("keydown", this.handleKeyDown), window.removeEventListener("keyup", this.handleKeyUp);
        }
    }
    const ue = new nn;
    class an {
        isActive = !1;
        direction = {
            x: 0,
            y: 0
        };
        constructor(){
            const e = document.createElement("div");
            e.classList.add("joystick-zone"), document.body.appendChild(e);
            const t = eo.create({
                zone: e,
                mode: "static",
                position: {
                    left: "50%",
                    top: "50%"
                },
                restOpacity: .1,
                size: 100,
                threshold: .2
            });
            t.on("start", ()=>{
                this.isActive = !0;
            }), t.on("move", (s, o)=>{
                o?.vector && (this.direction = {
                    x: o.vector.x,
                    y: o.vector.y
                });
            }), t.on("end", ()=>{
                this.isActive = !1, this.direction = {
                    x: 0,
                    y: 0
                };
            });
        }
        threshold = .2;
        isForward() {
            return this.isActive && this.direction.y > -this.threshold;
        }
        isBackward() {
            return this.isActive && this.direction.y < this.threshold;
        }
        isLeftward() {
            return this.isActive && this.direction.x < -this.threshold;
        }
        isRightward() {
            return this.isActive && this.direction.x > this.threshold;
        }
    }
    const qe = new an;
    class rn {
        isForward() {
            return ue.isKeyPressed("KeyW") || ue.isKeyPressed("ArrowUp") || qe.isForward();
        }
        isBackward() {
            return ue.isKeyPressed("KeyS") || ue.isKeyPressed("ArrowDown") || qe.isBackward();
        }
        isLeftward() {
            return ue.isKeyPressed("KeyA") || ue.isKeyPressed("ArrowLeft") || qe.isLeftward();
        }
        isRightward() {
            return ue.isKeyPressed("KeyD") || ue.isKeyPressed("ArrowRight") || qe.isRightward();
        }
        isJumpPressed() {
            return ue.isKeyPressed("Space");
        }
    }
    const Re = new rn, K = {
        LIGHT_POSITION_OFFSET: new T(10, 10, 10),
        directionalColor: new Z(.85, .75, .7),
        directionalIntensity: .8,
        hemiSkyColor: new Z(.6, .4, .5),
        hemiGroundColor: new Z(.3, .2, .2),
        fogColor: new Z(.29, .08, 0),
        fogDensity: .0046
    };
    class ln {
        directionalLight;
        hemisphereLight;
        fog;
        sunDirection = K.LIGHT_POSITION_OFFSET.clone().normalize().negate();
        constructor(){
            this.directionalLight = this.setupDirectionalLighting(), E.scene.add(this.directionalLight), this.hemisphereLight = this.setupHemisphereLight(), E.scene.add(this.hemisphereLight), this.fog = this.setupFog(), U.on("update", ({ player: e })=>{
                this.directionalLight.position.copy(e.position).add(K.LIGHT_POSITION_OFFSET);
            }), this.debugLight();
        }
        get sunColor() {
            return this.directionalLight.color;
        }
        setupHemisphereLight() {
            const e = new Is;
            return e.color.copy(K.hemiSkyColor), e.groundColor.copy(K.hemiGroundColor), e.intensity = .3, e.position.copy(K.LIGHT_POSITION_OFFSET), e;
        }
        setupDirectionalLighting() {
            const e = new As;
            e.intensity = K.directionalIntensity, e.color.copy(K.directionalColor), e.position.copy(K.LIGHT_POSITION_OFFSET), e.target = new Ms, e.castShadow = !0, e.shadow.mapSize.set(64, 64);
            const t = 1;
            return e.shadow.intensity = .85, e.shadow.camera.left = -t, e.shadow.camera.right = t, e.shadow.camera.top = t, e.shadow.camera.bottom = -t, e.shadow.camera.near = .01, e.shadow.camera.far = 30, e.shadow.normalBias = .1, e.shadow.bias = -.001, e;
        }
        setupFog() {
            return new _s(K.fogColor, K.fogDensity);
        }
        getTerrainShadowFactor = w(([e = L(0)])=>A(d.resources.terrainShadowAoTexture, e).r);
        debugLight() {
            const e = ee.panel.addFolder({
                title: "💡 Light"
            });
            e.expanded = !1, e.addBinding(K.LIGHT_POSITION_OFFSET, "x", {
                label: "Sun position X"
            }), e.addBinding(K.LIGHT_POSITION_OFFSET, "z", {
                label: "Sun position Z"
            }), e.addBinding(K.LIGHT_POSITION_OFFSET, "y", {
                label: "Sun height"
            }), e.addBinding(this.directionalLight, "color", {
                label: "Directional Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(this.directionalLight, "intensity", {
                min: 0,
                max: 5,
                label: "Directional intensity"
            }), e.addBinding(this.fog, "color", {
                label: "Fog Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(this.fog, "density", {
                label: "Fog Density",
                min: 0,
                max: .025,
                step: 1e-4
            }), e.addBinding(this.hemisphereLight, "color", {
                label: "Hemisphere sky color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(this.hemisphereLight, "groundColor", {
                label: "Hemisphere ground color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(this.hemisphereLight, "intensity", {
                min: 0,
                max: 1,
                label: "Hemisphere intensity"
            });
        }
        setTarget(e) {
            this.directionalLight.target = e;
        }
    }
    const Je = new ln, jt = new Es, Rt = new Xe;
    U.on("update-throttle-16x", ()=>{
        Rt.multiplyMatrices(E.renderCamera.projectionMatrix, E.renderCamera.matrixWorldInverse), jt.setFromProjectionMatrix(Rt);
    });
    const cn = (c)=>(c.geometry.boundingSphere || c.geometry.computeBoundingSphere(), jt.intersectsObject(c)), un = w(([c])=>{});
    class dn extends we {
        mainBuffer;
        constructor(e){
            let t, s, o = un;
            switch(super(new Ot, void 0, e.count), this.mainBuffer = Ue(e.count, "vec4"), this.mainBuffer.setPBO(!0), e.preset){
                case "custom":
                    t = e.material, s = e.onInit, o = e.onUpdate;
                    break;
                case "fire":
                    const i = mn(e, this.mainBuffer);
                    t = i.material, s = i.onInit, o = i.onUpdate;
                    break;
                default:
                    throw new Error("preset not provided for particle system");
            }
            this.material = t;
            const n = o(this.mainBuffer).compute(e.count, [
                e.workGroupSize ?? 1
            ]), a = s?.(this.mainBuffer).compute(e.count, [
                e.workGroupSize ?? 1
            ]);
            a && n?.onInit(({ renderer: i })=>{
                i.computeAsync(a);
            }), U.on("update", ()=>{
                cn(this) && me.renderer.computeAsync(n);
            });
        }
    }
    const mn = (c, e)=>{
        const { speed: t = .5, radius: s = 1, height: o = 1, lifetime: n = 1, scale: a = 1, detail: i = 4, coneFactor: l = 1 } = c, u = o * 1.5, h = n * .75, f = Ue(c.count, "float"), S = .95, y = w(([ze])=>{
            const Me = k(x.add(12345)), pe = f.element(x), _e = P(S, Me);
            pe.assign(_e);
        }), _ = w(([ze])=>{
            const Me = ze.element(x), pe = f.element(x), _e = k(x), Se = B(n, h, pe), Ee = re.mul(t).add(_e.mul(Se)).mod(Se).div(Se), Ne = r(1).sub(r(1).sub(Ee).pow(2)), Pe = B(o, u, pe), He = Ne.mul(Pe), We = k(x.add(7890)).mul(xe), ot = k(x.add(5678)), nt = r(1).sub(r(1).sub(ot).pow(2)), at = r(1).sub(Ne.mul(l)), rt = V(0, .35, Ne), it = Ie(re.mul(.5)).mul(.05).add(1), lt = B(s * .25, s, rt).mul(at).mul(it), ct = nt.mul(lt), ut = P(.5, We).mul(2).sub(1), Ve = We.add(Ee.mul(xe).mul(.05).mul(ut)), dt = B(1, .85, pe), Ze = _e.sub(.5).mul(.05).mul(Ee), mt = V(0, .75, Ee).mul(pe), Mt = ct.add(mt.mul(dt)), Yt = Gt(Ve.add(Ze)).mul(Mt), Jt = Ie(Ve.add(Ze)).mul(Mt), _t = He.div(Pe), Xt = V(0, .5, _t), $t = r(1).sub(V(.5, 1, _t)), Qt = Xt.mul($t);
            Me.assign(G(Yt, He, Jt, Qt));
        }), b = new kt;
        b.precision = "lowp", b.transparent = !0, b.depthWrite = !1, b.blending = Ps, b.blendEquation = Ls, b.blendSrc = vs, b.blendDst = Ds;
        const O = e.element(x), W = f.element(x), R = k(x.add(9234)), z = k(x.add(33.87));
        b.positionNode = O.xyz;
        const $ = r(1).sub(W.mul(.85)), q = z.clamp(.25, 1);
        b.scaleNode = q.mul(O.w).mul($).mul(a);
        const te = P(.5, R).mul(.5), H = P(.5, z).mul(.5), ce = F().mul(.5).add(L(te, H)), oe = A(d.resources.fireSprites, ce, i), Q = M(.72, .62, .08).mul(2).toConst(), Y = M(1, .1, 0).mul(4).toConst(), he = M(0).toConst(), Ae = B(o, u, W), Ge = V(0, 1, Oe.y.div(Ae)).pow(2), Qe = V(0, .25, Ge), et = B(Q, Y, Qe), ke = V(.9, 1, Ge), Be = B(et, he, ke), tt = r(1).sub(V(0, .85, Ge)), st = P(.65, z).mul(tt), Ce = r(.5).toConst(), ye = oe.a.mul(st).mul(Ce);
        return b.colorNode = B(Be, Y, W).mul(ye).mul(1.5), b.alphaTest = .1, b.opacityNode = O.w.mul(oe.a).mul(Ce), {
            material: b,
            onInit: y,
            onUpdate: _
        };
    };
    class hn {
        constructor(){
            const e = d.resources.realmModel.scene.getObjectByName("campfire");
            e.material = new Ts({
                map: d.resources.campfireDiffuse
            });
            const t = new dn({
                preset: "fire",
                count: 512,
                speed: .65,
                radius: .75,
                workGroupSize: 256
            });
            t.position.copy(e.position).setY(.25), E.scene.add(e, t);
            const s = ie.fixed().setTranslation(...e.position.toArray()).setRotation(e.quaternion).setUserData({
                type: j.Stone
            }), o = C.world.createRigidBody(s);
            e.geometry.computeBoundingSphere();
            const { radius: n } = e.geometry.boundingSphere, a = le.ball(n).setRestitution(.75);
            C.world.createCollider(a, o);
        }
    }
    class pn extends X {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = A(d.resources.trunkDiffuse, F());
            this.colorNode = e.mul(1.75), this.normalMap = d.resources.trunkNormal;
        }
    }
    class fn extends X {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.map = d.resources.axeDiffuse, this.emissiveMap = d.resources.axeEmissive, this.emissiveIntensity = 35, this.emissive = new Z("lightblue");
        }
    }
    class gn {
        constructor(){
            const e = d.resources.realmModel.scene.getObjectByName("kratos_axe");
            e.material = new fn;
            const t = d.resources.realmModel.scene.getObjectByName("tree_trunk");
            t.material = new pn, E.scene.add(e, t);
            const s = d.resources.realmModel.scene.getObjectByName("axe_collider"), o = ie.fixed().setTranslation(...s.position.toArray()).setRotation(s.quaternion).setUserData({
                type: j.Wood
            }), n = C.world.createRigidBody(o), a = s.geometry.boundingBox.max, i = le.cuboid(a.x, a.y, a.z).setRestitution(.75);
            C.world.createCollider(i, n);
            const l = d.resources.realmModel.scene.getObjectByName("trunk_collider"), { x: u, y: h } = l.geometry.boundingBox.max, f = ie.fixed().setTranslation(...l.position.toArray()).setRotation(l.quaternion).setUserData({
                type: j.Wood
            }), S = C.world.createRigidBody(f), y = u, _ = h / 2, b = le.capsule(_, y).setRestitution(.75);
            C.world.createCollider(b, S);
        }
    }
    class wn {
        constructor(){
            const e = d.resources.realmModel.scene.getObjectByName("jojo_mask");
            e.material = new yn;
            const t = d.resources.realmModel.scene.children.filter((n)=>n.name.startsWith("jojo_symbol")), s = new Sn, o = new we(t[0].geometry, s, t.length);
            for(let n = 0; n < t.length; n++){
                const a = t[n];
                o.setMatrixAt(n, a.matrix);
            }
            E.scene.add(e, o);
        }
    }
    class yn extends X {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const { stoneDiffuse: e } = d.atlasesCoords.stones, t = D.computeAtlasUv(L(...e.scale), L(...e.offset), F()), s = A(d.resources.stoneAtlas, t);
            this.colorNode = s;
        }
    }
    class Sn extends X {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const e = Pt("#eb5694"), t = Pt("#9642D3");
            this.colorNode = B(t, e, F().y.mul(.5)).mul(.45);
            const s = re.mul(20), o = Ie(s.add(x)), n = P(0, o).mul(.25);
            this.positionNode = Oe.add(n);
        }
    }
    class bn extends Bs {
        uScale = m(1);
        constructor(){
            super();
            const e = A(d.resources.kunaiDiffuse, F());
            this.colorNode = e.mul(5);
            const t = A(d.resources.kunaiMR, F());
            this.metalnessNode = t.b.mul(.75), this.roughnessNode = t.g;
        }
    }
    class xn {
        constructor(){
            const e = d.resources.realmModel.scene.children.filter(({ name: l })=>l.startsWith("kunai")), t = d.resources.realmModel.scene.getObjectByName("base_kunai"), s = new bn, o = new we(t.geometry, s, e.length), { x: n, y: a, z: i } = t.geometry.boundingBox.max;
            e.forEach((l, u)=>{
                o.setMatrixAt(u, l.matrix);
                const h = ie.fixed().setTranslation(...l.position.toArray()).setRotation(l.quaternion).setUserData({
                    type: j.Wood
                }), f = C.world.createRigidBody(h), S = le.cuboid(n, a, i).setRestitution(.75);
                C.world.createCollider(S, f);
            }), E.scene.add(o);
        }
    }
    class In extends X {
        constructor(){
            super(), this.map = d.resources.onePieceAtlas, this.side = bt;
        }
    }
    class An {
        constructor(){
            const e = d.resources.realmModel.scene.getObjectByName("one_piece_posters");
            e.material = new In, E.scene.add(e);
        }
    }
    class Mn {
        constructor(){
            new gn, new An, new wn, new xn, new hn;
        }
    }
    const Kt = {
        uBaseColor: m(new Z),
        uRandom: m(0)
    };
    class _n extends X {
        _uniforms;
        constructor(e){
            super(), this._uniforms = {
                ...Kt,
                ...e
            }, this.createMaterial();
        }
        setRandomSeed(e) {
            this._uniforms.uRandom.value = e;
        }
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = Fe(F().mul(2).add(this._uniforms.uRandom)), { stoneDiffuse: t, stoneNormalAo: s } = d.atlasesCoords.stones, o = D.computeAtlasUv(L(...t.scale), L(...t.offset), e), n = A(d.resources.stoneAtlas, o);
            this.colorNode = n.mul(1.5);
            const a = D.computeAtlasUv(L(...s.scale), L(...s.offset), e), i = A(d.resources.stoneAtlas, a);
            this.normalNode = new $e(i.rgb, r(.5)), this.aoNode = i.a;
        }
    }
    class En {
        uniforms = Kt;
        constructor(){
            const e = new _n(this.uniforms), t = d.resources.realmModel.scene.children.filter(({ name: o })=>o.endsWith("_monument"));
            t.forEach((o, n)=>{
                const a = wt.seededRandom(n);
                o.material = e, o.receiveShadow = !0, o.onBeforeRender = (i, l, u, h, f)=>{
                    f.setRandomSeed(a);
                };
            }), E.scene.add(...t), d.resources.realmModel.scene.children.filter(({ name: o })=>o.startsWith("monument_collider")).forEach((o)=>{
                const n = ie.fixed().setTranslation(...o.position.toArray()).setRotation(o.quaternion).setUserData({
                    type: j.Stone
                }), a = C.world.createRigidBody(n), i = .5 * o.scale.x, l = .5 * o.scale.y, u = .5 * o.scale.z, h = le.cuboid(i, l, u).setRestitution(.75);
                C.world.createCollider(h, a);
            }), this.debugMonuments();
        }
        debugMonuments() {
            const e = ee.panel.addFolder({
                title: "🗽 Monuments"
            });
            e.expanded = !1, e.addBinding(this.uniforms.uBaseColor, "value", {
                label: "Base color",
                view: "color",
                color: {
                    type: "float"
                }
            });
        }
    }
    const p = {
        uUvScale: m(2.7),
        uNormalScale: m(.05),
        uRefractionStrength: m(.1),
        uFresnelScale: m(.5),
        uSpeed: m(.1),
        uNoiseScrollDir: m(new Te(.1, 0)),
        uShininess: m(500),
        uMinDist: m(0),
        uMaxDist: m(0),
        uSunDir: m(Je.sunDirection),
        uSunColor: m(Je.sunColor.clone()),
        uTworld: m(new T(1, 0, 0)),
        uBworld: m(new T(0, 0, -1)),
        uNworld: m(new T(0, 1, 0)),
        uHighlightsGlow: m(4),
        uHighlightFresnelInfluence: m(.35),
        uDepthDistance: m(20),
        uAbsorptionRGB: m(new T(.35, .1, .08)),
        uInscatterTint: m(new Z(0, .09, .09)),
        uInscatterStrength: m(.85),
        uAbsorptionScale: m(15),
        uMinOpacity: m(.5),
        uIsWebGPU: m(1),
        uHighlightsSpread: m(.35),
        uDepthOpacityScale: m(.1),
        uHighlightsDepthOpacityScale: m(.05)
    };
    class Pn {
        constructor(){
            const e = d.resources.realmModel.scene.getObjectByName("water");
            e.material = new Ln, e.renderOrder = 100, p.uTworld.value.transformDirection(e.matrixWorld).normalize(), p.uBworld.value.transformDirection(e.matrixWorld).normalize(), p.uNworld.value.transformDirection(e.matrixWorld).normalize(), p.uIsWebGPU.value = Number(me.isWebGPU);
            const s = e.geometry.boundingSphere;
            s.radius = s.radius * .75, E.scene.add(e), U.on("audio-ready", ()=>{
                e.add(ae.lake);
            });
        }
    }
    class Ln extends zt {
        constructor(){
            super(), this.createMaterial(), this.debugWater();
        }
        debugWater() {
            const e = ee.panel.addFolder({
                title: "🌊 Water",
                expanded: !1
            }), t = e.addFolder({
                title: "Waves",
                expanded: !0
            });
            t.addBinding(p.uSpeed, "value", {
                label: "Speed"
            }), t.addBinding(p.uNormalScale, "value", {
                label: "Normal scale"
            }), t.addBinding(p.uUvScale, "value", {
                label: "UV scale"
            });
            const s = e.addFolder({
                title: "Highlights",
                expanded: !0
            });
            s.addBinding(p.uShininess, "value", {
                label: "Shininess"
            }), s.addBinding(p.uHighlightsGlow, "value", {
                label: "Glow"
            }), s.addBinding(p.uHighlightFresnelInfluence, "value", {
                label: "Fresnel influence"
            }), s.addBinding(p.uSunColor, "value", {
                label: "Sun color",
                view: "color",
                color: {
                    type: "float"
                }
            }), s.addBinding(p.uHighlightsSpread, "value", {
                label: "Highlights spread"
            }), s.addBinding(p.uHighlightsDepthOpacityScale, "value", {
                label: "Shoreline opacity",
                step: .001
            });
            const o = e.addFolder({
                title: "Reflections / Refraction",
                expanded: !0
            });
            o.addBinding(p.uRefractionStrength, "value", {
                label: "Refraction strength"
            }), o.addBinding(p.uFresnelScale, "value", {
                label: "Fresnel scale"
            });
            const n = e.addFolder({
                title: "Beer-Lambert",
                expanded: !0
            });
            n.addBinding(p.uInscatterStrength, "value", {
                label: "Inscatter strength"
            }), n.addBinding(p.uInscatterTint, "value", {
                label: "Inscatter tint",
                view: "color",
                color: {
                    type: "float"
                }
            }), n.addBinding(p.uAbsorptionRGB, "value", {
                label: "Absorption coeff"
            }), n.addBinding(p.uAbsorptionScale, "value", {
                label: "Absorption scale"
            });
            const a = e.addFolder({
                title: "General",
                expanded: !0
            });
            a.addBinding(p.uMinOpacity, "value", {
                label: "Min opacity"
            }), a.addBinding(p.uMinDist, "value", {
                label: "Min opacity distance"
            }), a.addBinding(p.uMaxDist, "value", {
                label: "Max opacity distance"
            }), a.addBinding(p.uDepthDistance, "value", {
                label: "Depth distance"
            }), a.addBinding(p.uDepthOpacityScale, "value", {
                label: "Depth opacity scale"
            });
        }
        sampleNormal = w(([e = L(0)])=>A(d.resources.waterNormal, e).mul(2).sub(1).rgb.normalize());
        createMaterial() {
            this.precision = "lowp";
            const e = re.mul(p.uSpeed), t = p.uNoiseScrollDir.mul(e), s = F().add(t).mul(p.uUvScale.mul(1.37)).fract(), o = this.sampleNormal(s), n = F().sub(t).mul(p.uUvScale.mul(.73)).fract(), a = this.sampleNormal(n), i = D.blendRNM(o, a), l = M(i.xy.mul(p.uNormalScale), i.z).normalize(), u = l.x.mul(p.uTworld).add(l.y.mul(p.uBworld)).add(l.z.mul(p.uNworld)).normalize(), h = Lt(ht).r, f = r(1).sub(p.uIsWebGPU), S = h.mul(2).sub(1).mul(f), y = h.mul(p.uIsWebGPU), _ = S.add(y), b = vt.element(3).element(2), O = vt.element(2).element(2), W = b.div(_.add(O)), R = Cs.z.negate(), z = P(R, W), q = W.sub(R).div(p.uDepthDistance).clamp(), te = B(p.uRefractionStrength, p.uRefractionStrength.mul(1.5), q), H = l.xy.mul(te), se = ht.add(H.mul(z)), ce = Lt(se).r, oe = ce.mul(2).sub(1).mul(f), Q = ce.mul(p.uIsWebGPU), Y = oe.add(Q), he = b.div(Y.add(O)), Ae = P(R, he), Qe = he.sub(R).div(p.uDepthDistance).clamp(), et = B(ht, se, Ae).clamp(), ke = Ns(et).rgb, Be = Rs(pt.sub(de)), tt = Dt(Be.negate(), u), xt = Fs(d.resources.envMapTexture, tt), st = ft(u, Be).clamp(), Ce = r(.02), ye = r(1).sub(st), ze = ye.mul(ye).mul(ye).mul(ye).mul(ye), Me = Ce.add(r(1).sub(Ce).mul(ze)), pe = Me.mul(p.uFresnelScale).clamp(), _e = p.uAbsorptionRGB.mul(p.uAbsorptionScale), Se = B(q, Qe, Ae), It = Us(_e.negate().mul(Se)), Ee = p.uInscatterTint.mul(p.uInscatterStrength), Ne = B(Ee, ke, It), Pe = M(i.xy.mul(p.uHighlightsSpread), i.z).normalize(), He = Pe.x.mul(p.uTworld).add(Pe.y.mul(p.uBworld)).add(Pe.z.mul(p.uNworld)).normalize(), We = Dt(p.uSunDir, He), ot = Ye(ft(We, Be), 0), nt = Ht(ot, p.uShininess), at = B(1, Me, p.uHighlightFresnelInfluence), rt = V(0, p.uHighlightsDepthOpacityScale, Se), it = p.uSunColor.mul(nt.mul(p.uHighlightsGlow).mul(at)).mul(rt), lt = ft(de.xz.sub(pt.xz), de.xz.sub(pt.xz)), ct = p.uMinDist.mul(p.uMinDist), ut = p.uMaxDist.mul(p.uMaxDist), At = V(ct, ut, lt).add(p.uMinOpacity).clamp(), Ve = V(0, p.uDepthOpacityScale, Se), dt = At.mul(Ve).clamp(), Ze = B(Ne, xt, pe), mt = B(ke, Ze, dt);
            this.colorNode = mt.add(it);
        }
    }
    const Ft = 20;
    class vn extends X {
        _noiseBuffer;
        constructor(){
            super(), this._noiseBuffer = Ue(Ft, "float"), this._noiseBuffer.setPBO(!0), me.renderer.computeAsync(this.computeInit), this.precision = "lowp", this.flatShading = !1;
            const e = k(x), t = this._noiseBuffer.element(x), s = P(.5, t), o = r(1).sub(s), n = Fe(F().mul(3.6).add(e)), a = Fe(F().mul(1.5).add(e)), i = n.mul(s).add(a.mul(o)), { stoneDiffuse: l, stoneNormalAo: u, stoneMossyDiffuse: h, stoneMossyNormalAo: f } = d.atlasesCoords.stones, S = L(...l.scale).mul(s), y = L(...h.scale).mul(o), _ = S.add(y), b = L(...l.offset).mul(s), O = L(...h.offset).mul(o), W = b.add(O), R = D.computeAtlasUv(_, W, i);
            this.colorNode = A(d.resources.stoneAtlas, R);
            const z = L(...u.scale).mul(s), $ = L(...f.scale).mul(o), q = z.add($), te = L(...u.offset).mul(s), H = L(...f.offset).mul(o), se = te.add(H), ce = D.computeAtlasUv(q, se, i), oe = A(d.resources.stoneAtlas, ce);
            this.normalNode = new $e(oe.rgb, r(3)), this.normalScale = new Te(1, -1), this.aoNode = oe.a;
        }
        computeInit = w(()=>{
            const e = this._noiseBuffer.element(x), t = L(k(x), k(x).mul(21.63)).fract(), s = A(d.resources.noiseTexture, t);
            e.assign(s.r);
        })().compute(Ft);
    }
    class Dn {
        constructor(){
            const e = d.resources.realmModel.scene.getObjectByName("stone"), t = d.resources.realmModel.scene.children.filter(({ name: n })=>n.startsWith("stone_collider")), s = new vn, o = new we(e.geometry, s, t.length);
            o.receiveShadow = !0, t.forEach((n, a)=>{
                o.setMatrixAt(a, n.matrix);
                const i = ie.fixed().setTranslation(...n.position.toArray()).setRotation(n.quaternion).setUserData({
                    type: j.Stone
                }), l = C.world.createRigidBody(i);
                n.geometry.computeBoundingBox();
                const u = n.geometry.boundingBox.max.x * n.scale.x, h = le.ball(u).setRestitution(.75);
                C.world.createCollider(h, l);
            }), E.scene.add(o);
        }
    }
    const Le = {
        uGrassTerrainColor: m(new Z().setRGB(.84, .62, .15)),
        uWaterSandColor: m(new Z().setRGB(.54, .39, .2)),
        uPathSandColor: m(new Z().setRGB(.65, .49, .27))
    };
    class Tn extends X {
        constructor(){
            super(), this.createMaterial(), this.debugTerrain();
        }
        debugTerrain() {
            const e = ee.panel.addFolder({
                title: "⛰️ Terrain",
                expanded: !1
            });
            e.addBinding(Le.uPathSandColor, "value", {
                label: "Path color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(Le.uWaterSandColor, "value", {
                label: "Water bed color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(Le.uGrassTerrainColor, "value", {
                label: "Grass terrain color",
                view: "color",
                color: {
                    type: "float"
                }
            });
        }
        computeCausticsDiffuse = w(([e = L(0), t = r(0)])=>{
            const s = re.mul(.15), o = e.mul(17).add(L(s, 0)).fract(), n = A(d.resources.noiseTexture, o, 1).g, a = e.mul(33).add(L(0, s.negate())).fract(), i = A(d.resources.noiseTexture, a, 3).g, l = n.add(i), u = l.mul(l).mul(l), h = V(-1, 7.5, t), f = u.mul(r(1).sub(h)), S = M(.3, .4, .5), y = M(0, 0, 0);
            return B(y, S, f);
        });
        computeWaterDiffuse = w(([e = r(0), t = L(0, 0)])=>{
            const s = V(0, 8, e), o = M(.35, .45, .55).mul(.65), n = this.computeCausticsDiffuse(t, e), a = V(0, 1.5, e), i = M(1, .9, .7).mul(.1).mul(a);
            return B(Le.uWaterSandColor, o, s).add(i).add(n);
        });
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = D.computeMapUvByPosition(de.xz), t = yt(e), s = A(d.resources.terrainShadowAoTexture, F().clamp());
            this.aoNode = s.g;
            const o = A(d.resources.terrainTypeTexture, t, 3.5), n = o.g, a = o.b, l = r(1).sub(n).sub(a), u = t.mul(30), h = A(d.resources.sandNormal, u), f = t.mul(30), y = A(d.resources.grassNormal, f).dot(h).mul(.65), _ = A(d.resources.grassDiffuse, f), b = A(d.resources.noise2, t), O = Wt(b.r, 0, 1, .15, 1), R = B(Le.uGrassTerrainColor, _.rgb, _.a).mul(O).mul(2).mul(n), z = Le.uPathSandColor.mul(1.2).mul(l), $ = yt(de.y.negate()), te = this.computeWaterDiffuse($, t).mul(a), H = R.add(z.mul(y)).add(te.mul(y).mul(.5));
            this.colorNode = H.mul(s.r);
        }
    }
    class Bn {
        constructor(e){
            const t = this.createFloor();
            t.material = e, E.scene.add(t);
        }
        createFloor() {
            const e = d.resources.realmModel.scene.getObjectByName("floor");
            return e.receiveShadow = !0, this.createFloorPhysics(), e;
        }
        getFloorDisplacementData() {
            const e = d.resources.realmModel.scene.getObjectByName("heightfield"), t = e.geometry.attributes._displacement.array[0], s = e.geometry.attributes.position;
            e.geometry.boundingBox || e.geometry.computeBoundingBox();
            const o = e.geometry.boundingBox, n = s.count, a = Math.sqrt(n), i = o.max.x, l = new Float32Array(n);
            for(let u = 0; u < n; u++){
                const h = s.array[u * 3 + 0], f = s.array[u * 3 + 1], S = s.array[u * 3 + 2], y = Math.round((h / (i * 2) + .5) * (a - 1)), b = Math.round((S / (i * 2) + .5) * (a - 1)) + y * a;
                l[b] = f;
            }
            return {
                rowsCount: a,
                heights: l,
                displacement: t
            };
        }
        createDisplacementTexture(e, t, s) {
            const o = e, n = new Float32Array(t.length);
            for(let i = 0; i < o; i++)for(let l = 0; l < o; l++){
                const f = o - 1 - i + l * o, S = l + i * o;
                n[S] = t[f] - s;
            }
            const a = new Ut(n, o, o, Os, Gs);
            return a.colorSpace = gt, a.magFilter = Tt, a.minFilter = Tt, a.generateMipmaps = !1, a.needsUpdate = !0, a;
        }
        createFloorPhysics() {
            const e = this.getFloorDisplacementData(), { rowsCount: t, heights: s, displacement: o } = e, n = this.createDisplacementTexture(t, s, o);
            d.resources.terrainHeightMap.copy(n);
            const a = ie.fixed().setTranslation(0, -o, 0).setUserData({
                type: j.Terrain
            }), i = C.world.createRigidBody(a), l = le.heightfield(t - 1, t - 1, s, {
                x: J.MAP_SIZE,
                y: 1,
                z: J.MAP_SIZE
            }, Xs.FIX_INTERNAL_EDGES).setFriction(1).setRestitution(.2);
            C.world.createCollider(l, i);
        }
    }
    class Cn {
        outerFloor;
        kintoun;
        kintounPosition = new T;
        constructor(e){
            this.outerFloor = this.createOuterFloorVisual(), this.outerFloor.material = e, this.kintoun = this.createKintoun(), E.scene.add(this.outerFloor), U.on("update", this.update.bind(this));
        }
        createOuterFloorVisual() {
            const e = d.resources.realmModel.scene.getObjectByName("outer_world");
            return e.receiveShadow = !0, e;
        }
        createKintoun() {
            const e = ie.kinematicPositionBased().setTranslation(0, -20, 0).setUserData({
                type: j.Terrain
            }), t = C.world.createRigidBody(e), s = 2, o = le.cuboid(s, J.HALF_FLOOR_THICKNESS, s).setFriction(1).setRestitution(.2);
            return C.world.createCollider(o, t), t;
        }
        useKintoun(e) {
            this.kintounPosition.copy(e).setY(-J.HALF_FLOOR_THICKNESS), this.kintoun.setTranslation(this.kintounPosition, !0);
        }
        update(e) {
            const { player: t } = e, s = J.HALF_MAP_SIZE - Math.abs(t.position.x) < J.KINTOUN_ACTIVATION_THRESHOLD, o = J.HALF_MAP_SIZE - Math.abs(t.position.z) < J.KINTOUN_ACTIVATION_THRESHOLD;
            (s || o) && this.useKintoun(t.position);
            const n = J.MAP_SIZE, a = Math.abs(t.position.x), i = Math.sign(t.position.x), l = Math.abs(t.position.z), u = Math.sign(t.position.z), h = a > n ? a - n : 0, f = l > n ? l - n : 0;
            this.outerFloor.position.set(h * i, 0, f * u);
        }
    }
    class Nn {
        constructor(){
            const e = new Tn;
            new Bn(e), new Cn(e);
        }
    }
    const Rn = ()=>({
            BLADE_WIDTH: .1,
            BLADE_HEIGHT: 1.65,
            BLADE_BOUNDING_SPHERE_RADIUS: 1.65,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            BLADES_PER_SIDE: 640,
            COUNT: 640 * 640,
            SPACING: 150 / 640,
            WORKGROUP_SIZE: 256
        }), I = Rn(), g = {
        uPlayerPosition: m(new T(0, 0, 0)),
        uCameraMatrix: m(new Xe),
        uBladeMinScale: m(.5),
        uBladeMaxScale: m(1.25),
        uTrailGrowthRate: m(.004),
        uTrailMinScale: m(.25),
        uTrailRaius: m(.65),
        uTrailRaiusSquared: m(.65 * .65),
        uGlowRadius: m(2),
        uGlowRadiusSquared: m(4),
        uGlowFadeIn: m(.05),
        uGlowFadeOut: m(.01),
        uGlowColor: m(new Z().setRGB(.39, .14, .02)),
        uBladeMaxBendAngle: m(Math.PI * .15),
        uWindStrength: m(.5),
        uBaseColor: m(new Z().setRGB(.07, .07, 0)),
        uTipColor: m(new Z().setRGB(.23, .11, .05)),
        uDelta: m(new Te(0, 0)),
        uGlowMul: m(3),
        uR0: m(45),
        uR1: m(75),
        uPMin: m(.1),
        uWindSpeed: m(1.75),
        uVariationScale: m(2),
        uvWindScale: m(.15),
        uUvVariationScale: m(1)
    };
    class Fn {
        buffer;
        constructor(){
            this.buffer = Ue(I.COUNT, "vec4"), this.computeUpdate.onInit(({ renderer: e })=>{
                e.computeAsync(this.computeInit);
            });
        }
        get computeBuffer() {
            return this.buffer;
        }
        getYaw = w(([e = G(0)])=>D.unpackUnits(e.z, 0, 12, -Math.PI, Math.PI));
        getBend = w(([e = G(0)])=>D.unpackUnits(e.z, 12, 12, -Math.PI, Math.PI));
        getScale = w(([e = G(0)])=>D.unpackUnits(e.w, 0, 8, g.uBladeMinScale, g.uBladeMaxScale));
        getOriginalScale = w(([e = G(0)])=>D.unpackUnits(e.w, 8, 8, g.uBladeMinScale, g.uBladeMaxScale));
        getShadow = w(([e = G(0)])=>D.unpackFlag(e.w, 16));
        getVisibility = w(([e = G(0)])=>D.unpackFlag(e.w, 17));
        getGlow = w(([e = G(0)])=>D.unpackUnit(e.w, 18, 6));
        setYaw = w(([e = G(0), t = r(0)])=>(e.z = D.packUnits(e.z, 0, 12, t, -Math.PI, Math.PI), e));
        setBend = w(([e = G(0), t = r(0)])=>(e.z = D.packUnits(e.z, 12, 12, t, -Math.PI, Math.PI), e));
        setScale = w(([e = G(0), t = r(0)])=>(e.w = D.packUnits(e.w, 0, 8, t, g.uBladeMinScale, g.uBladeMaxScale), e));
        setOriginalScale = w(([e = G(0), t = r(0)])=>(e.w = D.packUnits(e.w, 8, 8, t, g.uBladeMinScale, g.uBladeMaxScale), e));
        setShadow = w(([e = G(0), t = r(0)])=>(e.w = D.packFlag(e.w, 16, t), e));
        setVisibility = w(([e = G(0), t = r(0)])=>(e.w = D.packFlag(e.w, 17, t), e));
        setGlow = w(([e = G(0), t = r(0)])=>(e.w = D.packUnit(e.w, 18, 6, t), e));
        computeInit = w(()=>{
            const e = this.buffer.element(x), t = ge(r(x).div(I.BLADES_PER_SIDE)), s = r(x).mod(I.BLADES_PER_SIDE), o = k(x.add(4321)), n = k(x.add(1234)), a = s.mul(I.SPACING).sub(I.TILE_HALF_SIZE).add(o.mul(I.SPACING * .5)), i = t.mul(I.SPACING).sub(I.TILE_HALF_SIZE).add(n.mul(I.SPACING * .5)), l = M(a, 0, i).xz.add(I.TILE_HALF_SIZE).div(I.TILE_SIZE).abs().fract(), u = A(d.resources.noiseTexture, l), h = u.r.sub(.5).mul(17).fract(), f = u.b.sub(.5).mul(13).fract();
            e.x = a.add(h), e.y = i.add(f);
            const S = u.b.sub(.5).mul(r(Math.PI * 2));
            e.assign(this.setYaw(e, S));
            const y = g.uBladeMaxScale.sub(g.uBladeMinScale), _ = u.r.mul(y).add(g.uBladeMinScale);
            e.assign(this.setScale(e, _)), e.assign(this.setOriginalScale(e, _));
        })().compute(I.COUNT, [
            I.WORKGROUP_SIZE
        ]);
        computeStochasticKeep = w(([e = M(0)])=>{
            const t = e.x.sub(g.uPlayerPosition.x), s = e.z.sub(g.uPlayerPosition.z), o = t.mul(t).add(s.mul(s)), n = g.uR0, a = g.uR1, i = g.uPMin, l = n.mul(n), u = a.mul(a), h = St(o.sub(l).div(Ye(u.sub(l), 1e-5)), 0, 1), f = B(1, i, h), S = k(r(x).mul(.73));
            return P(S, f);
        });
        computeVisibility = w(([e = M(0)])=>{
            const t = g.uCameraMatrix.mul(G(e, 1)), s = t.xyz.div(t.w), o = I.BLADE_BOUNDING_SPHERE_RADIUS, n = r(1);
            return P(n.negate().sub(o), s.x).mul(P(s.x, n.add(o))).mul(P(n.negate().sub(o), s.y)).mul(P(s.y, n.add(o))).mul(P(0, s.z)).mul(P(s.z, n));
        });
        computeBending = w(([e = r(0), t = M(0)])=>{
            const s = t.xz.add(re.mul(g.uWindSpeed)).mul(g.uvWindScale).fract(), n = A(d.resources.noiseTexture, s).r.mul(g.uWindStrength);
            return e.add(n.sub(e).mul(.1));
        });
        computeAlpha = w(([e = M(0)])=>{
            const t = D.computeMapUvByPosition(e.xz), s = A(d.resources.terrainTypeTexture, t).g;
            return P(.25, s);
        });
        computeTrailScale = w(([e = r(0), t = r(0), s = r(0)])=>{
            const o = t.add(g.uTrailGrowthRate), n = r(1).sub(s), a = g.uTrailMinScale.mul(s).add(o.mul(n));
            return zs(a, e);
        });
        computeTrailGlow = w(([e = r(0), t = r(0), s = r(0), o = r(0)])=>{
            const n = V(g.uGlowRadiusSquared, r(0), t), a = 100, i = ge(Bt(g.uDelta.x).mul(a)), l = ge(Bt(g.uDelta.y).mul(a)), u = P(1, i.add(l)), h = n.mul(r(1).sub(s)).mul(o), f = Ye(u, e).mul(h), S = f.mul(g.uGlowFadeIn), y = r(1).sub(f).mul(g.uGlowFadeOut), _ = r(1).sub(u).mul(g.uGlowFadeOut).mul(e);
            return St(e.add(S).sub(y).sub(_), 0, 1);
        });
        computeShadow = w(([e = M(0)])=>{
            const t = D.computeMapUvByPosition(e.xz), s = A(d.resources.terrainShadowAoTexture, t);
            return P(.65, s.r);
        });
        computeUpdate = w(()=>{
            const e = this.buffer.element(x), t = De(e.x.sub(g.uDelta.x).add(I.TILE_HALF_SIZE), I.TILE_SIZE).sub(I.TILE_HALF_SIZE), s = De(e.y.sub(g.uDelta.y).add(I.TILE_HALF_SIZE), I.TILE_SIZE).sub(I.TILE_HALF_SIZE), o = M(t, 0, s);
            e.x = t, e.y = s;
            const n = o.add(g.uPlayerPosition), a = this.computeStochasticKeep(n), i = this.computeVisibility(n).mul(a);
            e.assign(this.setVisibility(e, i)), Vt(i, ()=>{
                const l = L(g.uDelta.x, g.uDelta.y), u = o.xz.sub(l), h = u.dot(u), f = P(.1, r(1).sub(g.uPlayerPosition.y)), S = P(h, g.uTrailRaiusSquared).mul(f), y = this.getScale(e), _ = this.getOriginalScale(e), b = this.computeTrailScale(_, y, S);
                e.assign(this.setScale(e, b));
                const O = this.computeAlpha(n);
                e.assign(this.setVisibility(e, O));
                const W = this.getBend(e), R = this.computeBending(W, n);
                e.assign(this.setBend(e, R));
                const z = this.getGlow(e), $ = this.computeTrailGlow(z, h, S, f);
                e.assign(this.setGlow(e, $));
                const q = this.computeShadow(n);
                e.assign(this.setShadow(e, q));
            });
        })().compute(I.COUNT, [
            I.WORKGROUP_SIZE
        ]);
    }
    class Un extends zt {
        ssbo;
        constructor(e){
            super(), this.ssbo = e, this.createGrassMaterial();
        }
        computePosition = w(([e = r(0), t = r(0), s = r(0), o = r(0), n = r(0), a = r(0)])=>{
            const i = M(e, 0, t), l = o.mul(F().y), h = Ct(Oe, M(l, 0, 0)).mul(M(1, n, 1)), f = Ct(h, M(0, s, 0)), S = k(x).mul(xe), y = Ie(re.mul(5).add(o).add(S)).mul(.1), _ = F().y.mul(a), b = y.mul(_);
            return f.add(i).add(M(b));
        });
        computeDiffuseColor = w(([e = r(0), t = r(1)])=>{
            const s = ge(r(x).div(I.BLADES_PER_SIDE)), n = r(x).mod(I.BLADES_PER_SIDE).mul(I.SPACING).sub(I.TILE_HALF_SIZE), a = s.mul(I.SPACING).sub(I.TILE_HALF_SIZE), i = L(n, a).add(I.TILE_HALF_SIZE).div(I.TILE_SIZE).mul(g.uUvVariationScale), l = A(d.resources.noise2, i), u = Wt(l.r, 0, 1, .15, 1), f = B(g.uBaseColor, g.uTipColor, F().y).mul(u).mul(g.uVariationScale), S = B(f, g.uGlowColor.mul(g.uGlowMul), e);
            return B(S.mul(.5), S, t);
        });
        createGrassMaterial() {
            this.precision = "lowp", this.side = bt;
            const e = this.ssbo.computeBuffer.element(x), t = e.x, s = e.y, o = this.ssbo.getYaw(e), n = this.ssbo.getBend(e), a = this.ssbo.getScale(e), i = this.ssbo.getVisibility(e), l = this.ssbo.getGlow(e), u = this.ssbo.getShadow(e);
            Hs(i.equal(0)), this.positionNode = this.computePosition(t, s, o, n, a, l), this.opacityNode = i, this.alphaTest = .25, this.colorNode = this.computeDiffuseColor(l, u);
        }
    }
    class On {
        constructor(){
            const e = new Fn, t = this.createGeometry(3), s = new Un(e), o = new we(t, s, I.COUNT);
            o.frustumCulled = !1, E.scene.add(o), U.on("update-throttle-2x", ({ player: n })=>{
                const a = n.position.x - o.position.x, i = n.position.z - o.position.z;
                g.uDelta.value.set(a, i), g.uPlayerPosition.value.copy(n.position), g.uCameraMatrix.value.copy(E.playerCamera.projectionMatrix).multiply(E.playerCamera.matrixWorldInverse), o.position.copy(n.position).setY(0), me.renderer.computeAsync(e.computeUpdate);
            }), this.debugGrass();
        }
        debugGrass() {
            const e = ee.panel.addFolder({
                title: "🌱 Grass",
                expanded: !1
            });
            e.addBinding(g.uTipColor, "value", {
                label: "Tip Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(g.uBaseColor, "value", {
                label: "Base Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(g.uGlowColor, "value", {
                label: "Glow Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(g.uWindStrength, "value", {
                label: "Wind strength",
                min: 0,
                max: Math.PI / 2,
                step: .1
            }), e.addBinding(g.uWindSpeed, "value", {
                label: "Wind speed",
                min: 0,
                max: 5,
                step: .01
            }), e.addBinding(g.uGlowMul, "value", {
                label: "Glow bloom",
                min: 1,
                max: 20,
                step: .01
            }), e.addBinding(g.uR0, "value", {
                label: "Inner ring",
                min: 0,
                max: I.TILE_SIZE,
                step: .1
            }), e.addBinding(g.uR1, "value", {
                label: "Outer ring",
                min: 0,
                max: I.TILE_SIZE,
                step: .1
            }), e.addBinding(g.uPMin, "value", {
                label: "P Min",
                min: 0,
                max: 1,
                step: .01
            }), e.addBinding(g.uvWindScale, "value", {
                label: "UV wind scale",
                step: .01
            }), e.addBinding(g.uVariationScale, "value", {
                label: "Variation scale",
                step: .01
            }), e.addBinding(g.uUvVariationScale, "value", {
                label: "UV variation scale",
                step: .01
            });
        }
        createGeometry(e) {
            const t = Math.max(1, Math.floor(e)), s = I.BLADE_HEIGHT, o = I.BLADE_WIDTH * .5, n = t, a = n * 2 + 1, l = Math.max(0, n - 1) * 6 + 3, u = new Float32Array(a * 3), h = new Float32Array(a * 2), f = new Uint8Array(l), S = new Float32Array(l * 3), y = (H)=>o * (1 - .7 * H);
            let _ = 0;
            for(let H = 0; H < n; H++){
                const se = H / t, ce = se * s, oe = y(se), Q = H * 2, Y = Q + 1;
                if (u[3 * Q + 0] = -oe, u[3 * Q + 1] = ce, u[3 * Q + 2] = 0, u[3 * Y + 0] = oe, u[3 * Y + 1] = ce, u[3 * Y + 2] = 0, h[2 * Q + 0] = 0, h[2 * Q + 1] = se, h[2 * Y + 0] = 1, h[2 * Y + 1] = se, H > 0) {
                    const he = (H - 1) * 2, Ae = he + 1;
                    f[_++] = he, f[_++] = Ae, f[_++] = Y, f[_++] = he, f[_++] = Y, f[_++] = Q;
                }
            }
            const b = n * 2;
            u[3 * b + 0] = 0, u[3 * b + 1] = s, u[3 * b + 2] = 0, h[2 * b + 0] = .5, h[2 * b + 1] = 1;
            const O = (n - 1) * 2, W = O + 1;
            f[_++] = O, f[_++] = W, f[_++] = b;
            const R = new ks, z = new je(u, 3);
            z.setUsage(Ke), R.setAttribute("position", z);
            const $ = new je(h, 2);
            $.setUsage(Ke), R.setAttribute("uv", $);
            const q = new je(f, 1);
            q.setUsage(Ke), R.setIndex(q);
            const te = new je(S, 3);
            return te.setUsage(Ke), R.setAttribute("normal", te), R;
        }
    }
    const Gn = ()=>({
            FLOWER_WIDTH: .5,
            FLOWER_HEIGHT: 1,
            BLADE_BOUNDING_SPHERE_RADIUS: 1,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            FLOWERS_PER_SIDE: 25,
            COUNT: 625,
            SPACING: 150 / 25
        }), N = Gn();
    class kn {
        flowerField;
        material;
        uniforms = {
            ...qt,
            uDelta: m(new Te(0, 0)),
            uPlayerPosition: m(new T(0, 0, 0)),
            uCameraMatrix: m(new Xe)
        };
        constructor(){
            this.material = new zn(this.uniforms), this.flowerField = new we(new Ot(1, 1), this.material, N.COUNT), E.scene.add(this.flowerField), U.on("update", this.updateAsync.bind(this));
        }
        async updateAsync(e) {
            const { player: t } = e, s = t.position.x - this.flowerField.position.x, o = t.position.z - this.flowerField.position.z;
            this.uniforms.uDelta.value.set(s, o), this.uniforms.uPlayerPosition.value.copy(t.position), this.uniforms.uCameraMatrix.value.copy(E.playerCamera.projectionMatrix).multiply(E.playerCamera.matrixWorldInverse), this.flowerField.position.copy(t.position).setY(0), this.material.updateAsync();
        }
    }
    const qt = {
        uPlayerPosition: m(new T(0, 0, 0)),
        uCameraMatrix: m(new Xe),
        uDelta: m(new Te(0, 0))
    };
    class zn extends kt {
        _uniforms;
        _buffer1;
        constructor(e){
            super(), this._uniforms = {
                ...qt,
                ...e
            }, this._buffer1 = Ue(N.COUNT, "vec4"), this._buffer1.setPBO(!0), this.computeUpdate.onInit(({ renderer: t })=>{
                t.computeAsync(this.computeInit);
            }), this.createMaterial();
        }
        computeInit = w(()=>{
            const e = this._buffer1.element(x), t = ge(r(x).div(N.FLOWERS_PER_SIDE)), s = r(x).mod(N.FLOWERS_PER_SIDE), o = k(x.add(4321)), n = k(x.add(1234)), a = s.mul(N.SPACING).sub(N.TILE_HALF_SIZE).add(o.mul(N.SPACING * .5)), i = t.mul(N.SPACING).sub(N.TILE_HALF_SIZE).add(n.mul(N.SPACING * .5)), l = M(a, 0, i).xz.add(N.TILE_HALF_SIZE).div(N.TILE_SIZE).abs(), h = A(d.resources.noiseTexture, l).r, f = h.sub(.5).mul(100), S = h.clamp(.5, .75), y = h.sub(.5).mul(50);
            e.x = a.add(f), e.y = S, e.z = i.add(y);
        })().compute(N.COUNT);
        computeVisibility = w(([e = M(0)])=>{
            const t = this._uniforms.uCameraMatrix.mul(G(e, 1)), s = t.xyz.div(t.w), o = N.BLADE_BOUNDING_SPHERE_RADIUS, n = r(1);
            return P(n.negate().sub(o), s.x).mul(P(s.x, n.add(o))).mul(P(n.negate().sub(o), s.y)).mul(P(s.y, n.add(o))).mul(P(0, s.z)).mul(P(s.z, n));
        });
        computeAlpha = w(([e = M(0)])=>{
            const t = D.computeMapUvByPosition(e.xz);
            return A(d.resources.terrainTypeTexture, t).g;
        });
        computeUpdate = w(()=>{
            const e = this._buffer1.element(x), t = De(e.x.sub(this._uniforms.uDelta.x).add(N.TILE_HALF_SIZE), N.TILE_SIZE).sub(N.TILE_HALF_SIZE), s = De(e.z.sub(this._uniforms.uDelta.y).add(N.TILE_HALF_SIZE), N.TILE_SIZE).sub(N.TILE_HALF_SIZE);
            e.x = t, e.z = s;
            const n = M(e.x, 0, e.z).add(this._uniforms.uPlayerPosition), a = this.computeVisibility(n);
            e.w = a, Vt(a, ()=>{
                e.w = this.computeAlpha(n);
            });
        })().compute(N.COUNT);
        createMaterial() {
            this.precision = "lowp";
            const e = this._buffer1.element(x), t = k(x.add(9234)), s = k(x.add(33.87)), o = re.mul(2), n = Ie(o.add(t.mul(100))).mul(.05);
            this.positionNode = e.xyz.add(M(n, 0, n)), this.scaleNode = t.mul(.2).add(.3);
            const a = P(.5, t).mul(.5), i = P(.5, s).mul(.5), u = F().mul(.5).add(L(a, i)), h = A(d.resources.flowerAtlas, u);
            this.colorNode = h, this.opacityNode = e.w, this.alphaTest = .15;
        }
        async updateAsync() {
            me.renderer.computeAsync(this.computeUpdate);
        }
    }
    class Hn {
        constructor(){
            const e = d.resources.realmModel.scene.getObjectByName("water_lilies");
            e.material = this.createMaterial(), E.scene.add(e);
        }
        createMaterial() {
            const e = new X;
            e.precision = "lowp", e.transparent = !0, e.map = d.resources.waterLiliesTexture, e.alphaTest = .5, e.alphaMap = d.resources.waterLiliesAlphaTexture;
            const t = re.mul(5e-4), s = de.x.mul(.1), o = A(d.resources.noiseTexture, Fe(de.xz.add(t).mul(s))).b.mul(.5), n = Ie(o);
            return e.positionNode = Oe.add(n), e;
        }
    }
    class Wn extends X {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = Fe(F().mul(7)), t = A(d.resources.barkDiffuse, e);
            this.colorNode = t.mul(2.5);
            const s = A(d.resources.barkNormal, e);
            this.normalNode = new $e(s);
        }
    }
    const ve = {
        uPrimaryColor: m(new Z().setRGB(.51, .49, .38)),
        uSecondaryColor: m(new Z().setRGB(1, .15, 0)),
        uMixFactor: m(2.6)
    };
    class Vn extends X {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.transparent = !0, this.side = bt;
            const e = D.computeMapUvByPosition(de.xz), t = A(d.resources.noiseTexture, e), s = A(d.resources.canopyDiffuse, F()), o = B(ve.uPrimaryColor, ve.uSecondaryColor, ve.uMixFactor);
            this.colorNode = G(B(s.rgb, o, t.b.mul(.4)).rgb, 1);
            const n = A(d.resources.canopyNormal, F());
            this.normalNode = new $e(n, r(1.25)), this.normalScale = new Te(1, -1), this.opacityNode = P(.5, s.a), this.alphaTest = .1;
            const a = re.mul(t.r).add(Ws).mul(7.5), i = Ie(a).mul(.015), l = Gt(a.mul(.75)).mul(.01);
            this.positionNode = Oe.add(M(0, l, i));
        }
    }
    class Zn {
        constructor(){
            const e = d.resources.realmModel.scene.getObjectByName("tree"), t = d.resources.realmModel.scene.children.filter(({ name: y })=>y.startsWith("tree_collider")), s = new Wn, o = new Vn, [n, a] = e.children, i = new we(n.geometry, s, t.length);
            i.receiveShadow = !0;
            const l = new we(a.geometry, o, t.length), h = d.resources.realmModel.scene.getObjectByName("base_tree_collider").geometry.boundingBox, f = h.max.x, S = h.max.y / 2;
            t.forEach((y, _)=>{
                i.setMatrixAt(_, y.matrix), l.setMatrixAt(_, y.matrix);
                const b = ie.fixed().setTranslation(...y.position.toArray()).setRotation(y.quaternion).setUserData({
                    type: j.Wood
                }), O = C.world.createRigidBody(b), W = f * y.scale.x, R = S * y.scale.y, z = le.capsule(R, W).setRestitution(.75);
                C.world.createCollider(z, O);
            }), E.scene.add(i, l), this.debugTrees();
        }
        debugTrees() {
            const e = ee.panel.addFolder({
                title: "🌳 Trees"
            });
            e.expanded = !1, e.addBinding(ve.uPrimaryColor, "value", {
                label: "Primary Leaf Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(ve.uSecondaryColor, "value", {
                label: "Seconary Leaf Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(ve.uMixFactor, "value", {
                label: "Mix factor"
            });
        }
    }
    class jn {
        constructor(){
            new On, new Hn, new kn, new Zn;
        }
    }
    const Kn = "/textures/hud/compass.webp", qn = "/textures/hud/compassArrow.webp";
    class Yn {
        constructor(){
            const e = document.createElement("div");
            e.classList.add("compass-container");
            const t = document.createElement("img");
            t.setAttribute("alt", "compass"), t.setAttribute("src", Kn), t.classList.add("compass"), e.appendChild(t);
            const s = document.createElement("img");
            s.setAttribute("alt", "arrow"), s.setAttribute("src", qn), s.classList.add("compass-arrow"), e.appendChild(s), document.body.appendChild(e);
            const o = J.MAP_SIZE / 2;
            let n = 0;
            U.on("update-throttle-16x", ({ player: a })=>{
                const i = Math.abs(a.position.x) > o, l = Math.abs(a.position.z) > o, h = i || l ? .65 : 0;
                if (e.style.setProperty("--opacity", `${h}`), !h) return;
                const f = Math.atan2(-a.position.x, -a.position.z);
                n = this.unwrapAngle(n, f - a.yaw), s.style.setProperty("--yaw", `${-n}rad`);
            });
        }
        unwrapAngle(e, t) {
            const s = t - e;
            return e + ((s + Math.PI) % (2 * Math.PI) - Math.PI);
        }
    }
    const Jn = ()=>Object.freeze({
            MAP_SIZE: 256,
            HALF_MAP_SIZE: 256 / 2,
            KINTOUN_ACTIVATION_THRESHOLD: 2,
            HALF_FLOOR_THICKNESS: .3,
            OUTER_MAP_SIZE: 256 * 3,
            OUTER_HALF_MAP_SIZE: 256 * 1.5
        }), J = Jn();
    class Xn {
        constructor(){
            new Yn, new Nn, new En, new Pn, new jn, new Dn, new Mn;
        }
    }
    class $n {
        pow2 = w(([e = r(0)])=>Ht(r(2), e));
        packF32 = w(([e = r(0), t = r(0), s = r(8), o = r(0), n = r(1), a = r(0)])=>{
            const i = ne(this.pow2(s), 1), l = ne(o, a).div(Ye(n, 1e-20)), u = St(Vs(l), 0, i), h = this.pow2(t), f = this.pow2(s), S = ge(e.div(h)), y = De(S, f).mul(h);
            return e.sub(y).add(u.mul(h));
        });
        unpackF32 = w(([e = r(0), t = r(0), s = r(8), o = r(1), n = r(0)])=>{
            const a = this.pow2(t), i = this.pow2(s), l = ge(e.div(a));
            return De(l, i).mul(o).add(n);
        });
        packUnit = w(([e = r(0), t = r(0), s = r(8), o = r(0)])=>{
            const n = r(1).div(ne(this.pow2(s), 1));
            return this.packF32(e, t, s, o, n, r(0));
        });
        unpackUnit = w(([e = r(0), t = r(0), s = r(8)])=>{
            const o = r(1).div(ne(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, r(0));
        });
        packFlag = w(([e = r(0), t = r(0), s = r(0)])=>this.packF32(e, t, r(1), s, r(1), r(0)));
        unpackFlag = w(([e = r(0), t = r(0)])=>this.unpackF32(e, t, r(1), r(1), r(0)));
        packAngle = w(([e = r(0), t = r(0), s = r(9), o = r(0)])=>{
            const n = ne(this.pow2(s), 1), a = xe.div(n), i = o.sub(xe.mul(ge(o.div(xe))));
            return this.packF32(e, t, s, i, a, r(0));
        });
        unpackAngle = w(([e = r(0), t = r(0), s = r(9)])=>{
            const o = xe.div(ne(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, r(0));
        });
        packSigned = w(([e = r(0), t = r(0), s = r(8), o = r(0), n = r(1)])=>{
            const a = ne(this.pow2(s), 1), i = n.mul(2).div(a), l = n.negate();
            return this.packF32(e, t, s, o, i, l);
        });
        unpackSigned = w(([e = r(0), t = r(0), s = r(8), o = r(1)])=>{
            const n = o.mul(2).div(ne(this.pow2(s), 1)), a = o.negate();
            return this.unpackF32(e, t, s, n, a);
        });
        packUnits = w(([e = r(0), t = r(0), s = r(8), o = r(0), n = r(0), a = r(1)])=>{
            const i = ne(this.pow2(s), 1), l = a.sub(n).div(i);
            return this.packF32(e, t, s, o, l, n);
        });
        unpackUnits = w(([e = r(0), t = r(0), s = r(8), o = r(0), n = r(1)])=>{
            const a = n.sub(o).div(ne(this.pow2(s), 1));
            return this.unpackF32(e, t, s, a, o);
        });
        computeMapUvByPosition = w(([e = L(0)])=>e.add(J.HALF_MAP_SIZE).div(J.MAP_SIZE));
        computeAtlasUv = w(([e = L(0), t = L(0), s = L(0)])=>s.mul(e).add(t));
        blendRNM = w(([e = M(0), t = M(0)])=>M(e.z.mul(t.x).add(e.x.mul(t.z)), e.z.mul(t.y).add(e.y.mul(t.z)), e.z.mul(t.z).sub(e.x.mul(t.x).add(e.y.mul(t.y)))).normalize());
        blendUDN = w(([e = M(0), t = M(0)])=>M(e.xy.add(t.xy), e.z.mul(t.z)).normalize());
    }
    const D = new $n, Qn = ()=>({
            JUMP_BUFFER_DURATION_IN_SECONDS: .2,
            MAX_CONSECUTIVE_JUMPS: 2,
            JUMP_CUT_MULTIPLIER: .25,
            FALL_MULTIPLIER: 2.75,
            MAX_UPWARD_VELOCITY: 6,
            LINEAR_DAMPING: .35,
            ANGULAR_DAMPING: .6,
            JUMP_IMPULSE: new T(0, 75, 0),
            LIN_VEL_STRENGTH: 35,
            ANG_VEL_STRENGTH: 25,
            RADIUS: .5,
            MASS: .5,
            PLAYER_INITIAL_POSITION: new T(0, 5, 0),
            CAMERA_OFFSET: new T(0, 11, 17),
            CAMERA_LERP_FACTOR: 7.5,
            UP: new T(0, 1, 0),
            DOWN: new T(0, -1, 0),
            FORWARD: new T(0, 0, -1)
        }), v = Qn();
    class ea {
        mesh;
        rigidBody;
        smoothedCameraPosition = new T;
        desiredCameraPosition = new T;
        smoothedCameraTarget = new T;
        desiredTargetPosition = new T;
        yawInRadians = 0;
        prevYawInRadians = -1;
        yawQuaternion = new Zs;
        newLinVel = new T;
        newAngVel = new T;
        torqueAxis = new T;
        forwardVec = new T;
        isOnGround = !1;
        jumpCount = 0;
        wasJumpHeld = !1;
        jumpBufferTimer = 0;
        rayOrigin = new T;
        ray = new $s(this.rayOrigin, v.DOWN);
        constructor(){
            this.mesh = this.createCharacterMesh(), E.scene.add(this.mesh), Je.setTarget(this.mesh), this.rigidBody = C.world.createRigidBody(this.createRigidBodyDesc()), C.world.createCollider(this.createColliderDesc(), this.rigidBody), U.on("update", this.update.bind(this)), U.on("update-throttle-64x", this.resetPlayerPosition.bind(this)), this.debugPlayer();
        }
        resetPlayerPosition(e) {
            const { player: t } = e;
            t.position.y > -10 || (this.rigidBody.setLinvel({
                x: 0,
                y: 0,
                z: 0
            }, !1), this.rigidBody.setAngvel({
                x: 0,
                y: 0,
                z: 0
            }, !1), this.rigidBody.setTranslation(v.PLAYER_INITIAL_POSITION, !0), this.mesh.position.copy(v.PLAYER_INITIAL_POSITION));
        }
        debugPlayer() {
            const e = ee.panel.addFolder({
                title: "🪩 Player",
                expanded: !1
            });
            e.addBinding(v.CAMERA_OFFSET, "y", {
                label: "Main camera height"
            }), e.addBinding(v.CAMERA_OFFSET, "z", {
                label: "Main camera distance"
            });
        }
        createCharacterMesh() {
            const e = d.resources.realmModel.scene.getObjectByName("player");
            return e.material = new ta, e.castShadow = !0, e.position.copy(v.PLAYER_INITIAL_POSITION), e;
        }
        createRigidBodyDesc() {
            const { x: e, y: t, z: s } = v.PLAYER_INITIAL_POSITION;
            return ie.dynamic().setTranslation(e, t, s).setLinearDamping(v.LINEAR_DAMPING).setAngularDamping(v.ANGULAR_DAMPING).setUserData({
                type: j.Player
            });
        }
        createColliderDesc() {
            return le.ball(v.RADIUS).setRestitution(.6).setFriction(1).setMass(v.MASS).setActiveEvents(Qs.COLLISION_EVENTS);
        }
        update(e) {
            const { clock: t } = e, s = t.getDelta();
            this.prevYawInRadians !== this.yawInRadians && (this.yawQuaternion.setFromAxisAngle(v.UP, this.yawInRadians), this.prevYawInRadians = this.yawInRadians), this.updateVerticalMovement(s), this.updateHorizontalMovement(s), this.updateCameraPosition(s);
        }
        updateVerticalMovement(e) {
            const t = Re.isJumpPressed();
            this.isOnGround = this.checkIfGrounded(), this.isOnGround && (this.jumpCount = 0), t && !this.wasJumpHeld ? this.jumpBufferTimer = v.JUMP_BUFFER_DURATION_IN_SECONDS : this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - e), this.jumpBufferTimer > 0 && this.canJump() && (this.performJump(), this.jumpBufferTimer = 0);
            const o = this.rigidBody.linvel();
            this.handleJumpCut(t, o), this.handleFastFall(e, o, C.world.gravity.y), this.clampUpwardVelocity(o), this.rigidBody.setLinvel(o, !0), this.wasJumpHeld = t;
        }
        checkIfGrounded() {
            this.rayOrigin.copy(this.rigidBody.translation()), this.rayOrigin.y -= v.RADIUS + .01;
            const e = .2, t = C.world.castRay(this.ray, e, !0);
            return t ? t.timeOfImpact * e < .01 : !1;
        }
        canJump() {
            return this.isOnGround ? !0 : this.jumpCount < v.MAX_CONSECUTIVE_JUMPS;
        }
        performJump() {
            this.rigidBody.applyImpulse(v.JUMP_IMPULSE, !0), this.jumpCount += 1;
        }
        handleJumpCut(e, t) {
            !(!e && this.wasJumpHeld) || t.y <= 0 || (t.y *= v.JUMP_CUT_MULTIPLIER);
        }
        handleFastFall(e, t, s) {
            if (t.y >= 0) return;
            const o = v.FALL_MULTIPLIER * Math.abs(s) * e;
            t.y -= o;
        }
        clampUpwardVelocity(e) {
            e.y <= v.MAX_UPWARD_VELOCITY || (e.y = v.MAX_UPWARD_VELOCITY);
        }
        updateHorizontalMovement(e) {
            const t = Re.isForward(), s = Re.isBackward(), o = Re.isLeftward(), n = Re.isRightward(), a = 2;
            o && (this.yawInRadians += a * e), n && (this.yawInRadians -= a * e), this.forwardVec.copy(v.FORWARD).applyQuaternion(this.yawQuaternion), this.torqueAxis.crossVectors(v.UP, this.forwardVec).normalize(), this.newLinVel.copy(this.rigidBody.linvel()), this.newAngVel.copy(this.rigidBody.angvel());
            const i = v.LIN_VEL_STRENGTH * e, l = v.ANG_VEL_STRENGTH * e;
            t && (this.newLinVel.addScaledVector(this.forwardVec, i), this.newAngVel.addScaledVector(this.torqueAxis, l)), s && (this.newLinVel.addScaledVector(this.forwardVec, -i), this.newAngVel.addScaledVector(this.torqueAxis, -l)), this.rigidBody.setLinvel(this.newLinVel, !0), this.rigidBody.setAngvel(this.newAngVel, !0), this.syncMeshWithBody();
        }
        syncMeshWithBody() {
            this.mesh.position.copy(this.rigidBody.translation()), this.mesh.quaternion.copy(this.rigidBody.rotation());
        }
        updateCameraPosition(e) {
            this.desiredCameraPosition.copy(v.CAMERA_OFFSET).applyQuaternion(this.yawQuaternion).add(this.mesh.position);
            const t = v.CAMERA_LERP_FACTOR * e;
            this.smoothedCameraPosition.lerp(this.desiredCameraPosition, t), this.desiredTargetPosition.copy(this.mesh.position), this.desiredTargetPosition.y += 1, this.smoothedCameraTarget.lerp(this.desiredTargetPosition, t), E.playerCamera.position.copy(this.smoothedCameraPosition), E.playerCamera.lookAt(this.smoothedCameraTarget);
        }
        get position() {
            return this.mesh.position;
        }
        get yaw() {
            return this.yawInRadians;
        }
    }
    class ta extends X {
        constructor(){
            super(), this.createMaterial();
        }
        createMaterial() {
            this.flatShading = !1, this.castShadowNode = M(.6);
            const e = D.computeMapUvByPosition(de.xz), t = yt(e), s = Je.getTerrainShadowFactor(t), o = A(d.resources.footballDiffuse, F()).mul(1.5);
            this.colorNode = o.mul(s);
        }
    }
    const sa = [
        30,
        60,
        120,
        144,
        160,
        165,
        170,
        180,
        240
    ], oa = (c)=>sa.reduce((e, t)=>Math.abs(t - c) < Math.abs(e - c) ? t : e), na = async ()=>new Promise((c)=>{
            const e = [];
            let t = performance.now(), s = t;
            function o(n) {
                if (e.push(n - t), t = n, n - s < 1e3) requestAnimationFrame(o);
                else {
                    e.sort((u, h)=>u - h);
                    const i = 1e3 / (e[Math.floor(e.length / 2)] || 16.667), l = oa(i);
                    c(l);
                }
            }
            requestAnimationFrame(o);
        });
    class aa {
        player;
        IS_CAP_FPS_ENABLED = !1;
        config = {
            halvenFPS: !1
        };
        constructor(){
            this.player = new ea, new Xn;
        }
        debugGame() {
            ee.panel.addFolder({
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
            const e = await na();
            this.config.halvenFPS = e > 120;
        }
        onResize() {
            const e = this.getSizes();
            U.emit("resize", e), this.updateRefreshRate();
        }
        async startLoop() {
            await this.updateRefreshRate(), this.debugGame();
            const t = {
                clock: new js(!0),
                player: this.player
            };
            let s = !1;
            const o = ()=>{
                C.update(), this.config.halvenFPS ? s = !s : s = !1, (s || !this.config.halvenFPS) && (U.emit("update", t), me.renderAsync());
            }, n = to(this.onResize.bind(this), 300);
            this.onResize(), new ResizeObserver(n).observe(document.body), me.renderer.setAnimationLoop(o);
        }
    }
    class ra {
        constructor(){}
        init() {
            this.initAudioButton(), this.initCreditsButton();
        }
        initAudioButton() {
            const e = document.getElementById("audio");
            e.disabled = !0;
            const t = e?.querySelector("path");
            if (!e || !t) return;
            const s = "M1129.432 113v1694.148H903.545l-451.772-451.773V564.773L903.545 113h225.887Zm542.545 248.057C1832.017 521.097 1920 733.882 1920 960.107c0 226.226-87.983 438.898-248.023 598.938l-79.851-79.85c138.694-138.582 214.93-323.018 214.93-519.087 0-196.183-76.236-380.506-214.93-519.2ZM338.83 564.773v790.602H169.415C75.672 1355.375 0 1279.703 0 1185.96V734.187c0-93.742 75.672-169.414 169.415-169.414H338.83Zm1093.922 36.085c95.776 97.018 148.407 224.644 148.407 359.16 0 134.628-52.631 262.253-148.407 359.272l-80.303-79.174c74.656-75.897 115.767-175.4 115.767-280.099 0-104.585-41.111-204.088-115.767-279.986Z", o = "M1129.433 113v1694.15H903.547l-451.774-451.773V564.773L903.547 113h225.886ZM338.83 564.773v790.604H169.415c-92.806 0-167.9-74.166-169.392-166.609L0 1185.962V734.188c0-92.805 74.166-167.9 166.608-169.392l2.807-.023H338.83ZM1789.951 635 1920 764.926 1724.988 959.94 1920 1154.95 1789.951 1285l-194.89-195.012L1400.05 1285 1270 1154.951l195.012-195.012L1270 764.926 1400.049 635l195.012 195.012L1789.951 635Z";
            e.addEventListener("click", async (n)=>{
                n.stopPropagation(), await ae.toggleMute();
                const a = ae.isMute ? o : s;
                t.setAttribute("d", a);
            }), U.on("audio-ready", ()=>{
                e.disabled = !1;
            });
        }
        initCreditsButton() {
            const e = document.getElementById("credits"), t = document.getElementById("credits-dialog");
            if (!e || !t) return;
            t.addEventListener("click", (l)=>{
                switch(l.stopPropagation(), l.target?.id){
                    case "credits-dialog":
                    case "close-dialog-btn":
                        t.close();
                        break;
                }
            }), e.addEventListener("click", (l)=>{
                l.stopPropagation(), t.showModal();
            });
            const n = "aleksandar.d.gjoreski@gmail.com", a = document.createElement("a");
            a.setAttribute("href", `mailto:${n}`), a.innerText = n, document.getElementById("email-placeholder")?.appendChild(a);
        }
    }
    const ia = new ra, la = new on;
    la.initAsync().then(()=>{
        ia.init(), new aa().startLoop();
    });
});
