import { L as Yt, T as Jt, D as Xt, G as $t, C as Qt, S as Se, P as es, p as ts, b as ss, r as os, W as ns, a as as, A as is, c as rs, d as ls, e as cs, f as ds, g as us, h as hs, V as T, _ as ms, M as wt, i as ps, j as Lt, k as fs, l as V, H as gs, m as ws, O as ys, F as bs, n as g, t as I, v as P, o as Ss, q as Xe, I as we, s as Rt, u as Fe, w as G, x as A, y as _, z as C, B as ae, E as i, J as Ae, K as W, N as Me, Q as Ft, R as k, U as Ut, X as As, Y as xs, Z as Ms, $ as Is, a0 as R, a1 as M, a2 as Ue, a3 as Ls, a4 as J, a5 as _t, a6 as _s, a7 as m, a8 as St, a9 as de, aa as $e, ab as Te, ac as Ot, ad as Pt, ae as pt, af as Dt, ag as Ps, ah as Ds, ai as Es, aj as ft, ak as ue, al as Et, am as vs, an as gt, ao as Ts, ap as Ye, aq as At, ar as yt, as as Bs, at as je, au as qe, av as xe, aw as bt, ax as Cs, ay as vt, az as ve, aA as kt, aB as Tt, aC as Ns, aD as Rs, aE as oe, aF as Fs, aG as Us, aH as Os } from "./three-ClBMrWka.js";
import { P as ks } from "./tweakpane-SMt8byX-.js";
import { S as Bt } from "./stats-gl-C2M3amu4.js";
import { e as Gs } from "./tseep-zr-hWxBz.js";
import { World as Hs, EventQueue as zs, RigidBodyDesc as ie, ColliderDesc as re, HeightFieldFlags as Ws, Ray as Vs, ActiveEvents as Zs, __tla as __tla_0 } from "./@dimforge-CqaeYUkE.js";
import { n as js } from "./nipplejs-BxsX8Mt3.js";
import { d as qs } from "./lodash-es-BMmXVQ06.js";
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
    const Ks = "/models/realm.glb", Ys = "/textures/environment/px.webp", Js = "/textures/environment/nx.webp", Xs = "/textures/environment/py.webp", $s = "/textures/environment/ny.webp", Qs = "/textures/environment/pz.webp", eo = "/textures/environment/nz.webp", to = "/textures/noise/noise.webp", so = "/textures/realm/terrainType.webp", oo = "/textures/realm/sandNormal.webp", no = "/textures/realm/grassNormal.webp", ao = "/textures/realm/grassDiffuse.webp", io = "/textures/realm/waterNormal.webp", ro = "/textures/realm/terrainShadowAo.webp", lo = "/textures/realm/waterLiliesDiffuse.webp", co = "/textures/realm/waterLiliesAlpha.webp", uo = "/textures/realm/flowerAtlas.webp", ho = "/textures/realm/stoneAtlas.webp", mo = "/textures/realm/barkDiffuse.webp", po = "/textures/realm/barkNormal.webp", fo = "/textures/realm/canopyDiffuse.webp", go = "/textures/realm/canopyNormal.webp", wo = "/textures/realm/axeDiffuse.webp", yo = "/textures/realm/axeEmissive.webp", bo = "/textures/realm/trunkDiffuse.webp", So = "/textures/realm/trunkNormal.webp", Ao = "/textures/realm/onePieceAtlas.webp", xo = "/textures/realm/kunaiDiffuse.webp", Mo = "/textures/realm/kunaiMR.webp", Io = "/textures/realm/campfireDiffuse.webp", Lo = "/textures/realm/fireSprites.webp", _o = "/textures/realm/footballDiffuse.webp", Po = "/textures/realm/leafDiffuse.webp", Do = {
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
    }, Eo = {
        stones: Do
    };
    class vo {
        manager;
        constructor(){
            this.manager = this.createLoadingManager();
        }
        onErrorLog(e) {
            console.log("There was an error loading " + e);
        }
        createLoadingManager() {
            const e = new Yt;
            return e.onError = this.onErrorLog, e;
        }
    }
    const Gt = new vo;
    class To {
        atlasesCoords = Eo;
        textureLoader;
        gltfLoader;
        cubeTextureLoader;
        realmModel;
        noiseTexture;
        envMapTexture;
        terrainTypeMap;
        terrainShadowAo;
        grassDiffuse;
        sandNormal;
        grassNormal;
        waterNormal;
        waterLiliesTexture;
        waterLiliesAlphaTexture;
        flowerAtlas;
        stoneAtlas;
        canopyDiffuse;
        canopyNormal;
        barkDiffuse;
        barkNormal;
        axeDiffuse;
        axeEmissive;
        trunkDiffuse;
        trunkNormal;
        onePieceAtlas;
        kunaiDiffuse;
        kunaiMR;
        campfireDiffuse;
        fireSprites;
        footballDiffuse;
        leafDiffuse;
        constructor(e){
            this.textureLoader = new Jt(e);
            const t = new Xt;
            t.setDecoderPath("/draco/"), this.gltfLoader = new $t(e), this.gltfLoader.setDRACOLoader(t), this.cubeTextureLoader = new Qt(e);
        }
        async initAsync() {
            const e = await Promise.all([
                this.gltfLoader.loadAsync(Ks),
                u.cubeTextureLoader.loadAsync([
                    Ys,
                    Js,
                    Xs,
                    $s,
                    Qs,
                    eo
                ]),
                this.textureLoader.loadAsync(to),
                this.textureLoader.loadAsync(so),
                this.textureLoader.loadAsync(ao),
                this.textureLoader.loadAsync(no),
                this.textureLoader.loadAsync(oo),
                this.textureLoader.loadAsync(io),
                this.textureLoader.loadAsync(ro),
                this.textureLoader.loadAsync(lo),
                this.textureLoader.loadAsync(co),
                this.textureLoader.loadAsync(uo),
                this.textureLoader.loadAsync(ho),
                this.textureLoader.loadAsync(fo),
                this.textureLoader.loadAsync(go),
                this.textureLoader.loadAsync(mo),
                this.textureLoader.loadAsync(po),
                this.textureLoader.loadAsync(wo),
                this.textureLoader.loadAsync(yo),
                this.textureLoader.loadAsync(bo),
                this.textureLoader.loadAsync(So),
                this.textureLoader.loadAsync(Ao),
                this.textureLoader.loadAsync(xo),
                this.textureLoader.loadAsync(Mo),
                this.textureLoader.loadAsync(Io),
                this.textureLoader.loadAsync(Lo),
                this.textureLoader.loadAsync(_o),
                this.textureLoader.loadAsync(Po)
            ]);
            this.realmModel = e[0], this.envMapTexture = e[1], this.envMapTexture.colorSpace = Se, this.noiseTexture = e[2], this.terrainTypeMap = e[3], this.terrainTypeMap.flipY = !1, this.grassDiffuse = e[4], this.grassNormal = e[5], this.sandNormal = e[6], this.waterNormal = e[7], this.terrainShadowAo = e[8], this.terrainShadowAo.flipY = !1, this.waterLiliesTexture = e[9], this.waterLiliesTexture.flipY = !1, this.waterLiliesAlphaTexture = e[10], this.waterLiliesAlphaTexture.flipY = !1, this.flowerAtlas = e[11], this.flowerAtlas.flipY = !1, this.stoneAtlas = e[12], this.stoneAtlas.flipY = !1, this.canopyDiffuse = e[13], this.canopyDiffuse.flipY = !1, this.canopyNormal = e[14], this.canopyNormal.flipY = !1, this.barkDiffuse = e[15], this.barkDiffuse.flipY = !1, this.barkDiffuse.colorSpace = Se, this.barkNormal = e[16], this.barkNormal.flipY = !1, this.axeDiffuse = e[17], this.axeDiffuse.flipY = !1, this.axeEmissive = e[18], this.axeEmissive.flipY = !1, this.trunkDiffuse = e[19], this.trunkDiffuse.flipY = !1, this.trunkDiffuse.colorSpace = Se, this.trunkNormal = e[20], this.trunkNormal.flipY = !1, this.onePieceAtlas = e[21], this.onePieceAtlas.flipY = !1, this.kunaiDiffuse = e[22], this.kunaiDiffuse.flipY = !1, this.kunaiDiffuse.colorSpace = Se, this.kunaiMR = e[23], this.kunaiMR.flipY = !1, this.campfireDiffuse = e[24], this.campfireDiffuse.flipY = !1, this.campfireDiffuse.colorSpace = Se, this.fireSprites = e[25], this.footballDiffuse = e[26], this.footballDiffuse.colorSpace = Se, this.leafDiffuse = e[27], this.leafDiffuse.colorSpace = Se;
        }
    }
    const u = new To(Gt.manager);
    class Bo {
        panel;
        constructor(){
            this.panel = new ks({
                title: "Revo Realms"
            }), this.panel.hidden = !0, this.panel.element.parentElement?.classList.add("debug-panel");
        }
        setVisibility(e) {
            this.panel.hidden = !e;
        }
    }
    const ee = new Bo;
    class Co {
        stats;
        lastSecond = performance.now();
        drawCallsPanel;
        trianglesPanel;
        constructor(e){
            const t = new Bt({
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
            const o = this.stats.addPanel(new Bt.Panel(e, t, s));
            return o.update = (n)=>{
                const a = o.canvas.getContext("2d");
                if (!a) return;
                const { width: r, height: l } = o.canvas;
                a.clearRect(0, 0, r, l), a.fillStyle = s, a.fillRect(0, 0, r, l), a.fillStyle = t;
                const d = a.font;
                a.textAlign = "left", a.textBaseline = "top", a.fillText(o.name, 4, 4), a.font = "bold 20px Arial", a.textAlign = "center", a.textBaseline = "middle";
                const h = No.format(n);
                a.fillText(`${h}`, r / 2, l / 1.65), a.font = d;
            }, o;
        }
        updateCustomPanels() {
            const e = performance.now();
            if (e - this.lastSecond < 1e3) return;
            const { render: t } = he.renderer.info;
            this.drawCallsPanel.update(t.drawCalls, 0), this.trianglesPanel.update(t.triangles, 0), this.lastSecond = e;
        }
    }
    const No = new Intl.NumberFormat("en-US", {
        notation: "compact"
    }), Ro = [
        2,
        4,
        16,
        64
    ], F = new Gs.EventEmitter, Fo = (c)=>{
        let e = 0;
        F.on("update", (t)=>{
            e++, !(e < c) && (e = 0, F.emit(`update-throttle-${c}x`, t));
        });
    };
    Ro.forEach((c)=>Fo(c));
    class Uo extends es {
        scenePass;
        debugFolder = ee.panel.addFolder({
            title: "⭐️ Postprocessing",
            expanded: !1
        });
        constructor(e){
            super(e), this.scenePass = ts(L.scene, L.renderCamera);
            const t = this.makeGraph();
            this.outputNode = t, F.on("camera-changed", ()=>{
                this.scenePass.camera = L.renderCamera, this.scenePass.needsUpdate = !0;
            });
        }
        makeGraph() {
            this.outputColorTransform = !1;
            const e = this.scenePass.getTextureNode(), t = ss(e, .25, .15, 1);
            t.smoothWidth.value = .04, t._nMips = 2, this.debugFolder.addBinding(t.strength, "value", {
                label: "Bloom strength"
            }), this.debugFolder.addBinding(t.threshold, "value", {
                label: "Bloom threshold"
            });
            const s = e.add(t);
            return os(s);
        }
    }
    class Oo {
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
            const t = new ns({
                canvas: e,
                antialias: !0,
                trackTimestamp: this.IS_MONITORING_ENABLED,
                powerPreference: "high-performance",
                stencil: !1,
                depth: !0
            });
            t.shadowMap.enabled = !0, t.shadowMap.type = as, t.toneMapping = is, t.setClearColor(0, 1), t.toneMappingExposure = 1.5, this.renderer = t, this.monitoringManager = new Co(this.IS_MONITORING_ENABLED), ee.setVisibility(this.IS_DEBUGGING_ENABLED), F.on("resize", (s)=>{
                const o = Math.max(this.IS_POSTPROCESSING_ENABLED ? s.dpr * .75 : s.dpr, 1);
                t.setSize(s.width, s.height), t.setPixelRatio(o);
            });
        }
        async init() {
            L.init(), this.isWebGPU = !!await navigator.gpu?.requestAdapter(), this.postprocessingManager = new Uo(this.renderer), this.IS_MONITORING_ENABLED && await this.monitoringManager.stats.init(this.renderer);
        }
        async renderSceneAsync() {
            return this.IS_POSTPROCESSING_ENABLED ? this.postprocessingManager.renderAsync() : this.renderer.renderAsync(L.scene, L.renderCamera);
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
    const he = new Oo;
    class ko {
        scene;
        playerCamera;
        renderCamera;
        cameraHelper;
        controls;
        orbitControlsCamera;
        constructor(){
            const e = new rs;
            this.scene = e;
            const t = window.innerWidth, s = window.innerHeight, o = t / s, n = new ls(45, o, .01, 150);
            n.position.set(0, 5, 10), this.playerCamera = n, e.add(n), this.renderCamera = n, F.on("resize", (a)=>{
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
                !this.cameraHelper || !this.orbitControlsCamera || (this.renderCamera = t ? this.orbitControlsCamera : this.playerCamera, this.cameraHelper.visible = t, F.emit("camera-changed"));
            });
        }
        init() {}
        update() {
            this.controls?.enabled && this.controls.update();
        }
    }
    const L = new ko, Go = "/audio/ambient/ambient.mp3", Ho = "/audio/ambient/lake.mp3", zo = "/audio/collisions/hitWood.mp3", Wo = "/audio/collisions/hitStone.mp3";
    class Vo {
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
            this.audioLoader = new cs(e), this.audioListener = new ds, L.playerCamera.add(this.audioListener);
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
            const o = new us(this.audioListener);
            return o.setBuffer(e), o.setVolume(0), o.setLoop(s), o.userData.originalVolume = t, this.files.push(o), o;
        }
        newPositionalAudio(e, t = 1, s = !1, o = 1) {
            const n = new hs(this.audioListener);
            return n.setBuffer(e), n.setVolume(0), n.setLoop(s), n.userData.originalVolume = t, n.setMaxDistance(o), this.files.push(n), n;
        }
        async initAsync() {
            const e = await Promise.all([
                this.audioLoader.loadAsync(Go),
                this.audioLoader.loadAsync(Ho),
                this.audioLoader.loadAsync(zo),
                this.audioLoader.loadAsync(Wo)
            ]);
            this.ambient = this.newAudio(e[0], .05, !0), this.lake = this.newPositionalAudio(e[1], 1, !0, 10), this.hitWood = this.newAudio(e[2], 0, !1), this.hitStone = this.newAudio(e[3], 0, !1), this.isReady = !0, F.emit("audio-ready");
        }
    }
    const ne = new Vo(Gt.manager);
    var j = ((c)=>(c.Player = "Player", c.Terrain = "Terrain", c.Wood = "Wood", c.Stone = "Stone", c))(j || {});
    const Zo = ()=>({
            minImpactSq: 5,
            maxImpactSq: 400,
            minImpactVolume: .01,
            maxImpactVolume: .25
        }), ge = Zo();
    class jo {
        world;
        eventQueue;
        IS_DEBUGGING_ENABLED = !1;
        dummyVectorLinVel = new T;
        debugMesh;
        constructor(){
            this.IS_DEBUGGING_ENABLED && (this.debugMesh = this.createDebugMesh(), L.scene.add(this.debugMesh));
        }
        async initAsync() {
            return ms(()=>import("./@dimforge-CqaeYUkE.js").then(async (m)=>{
                    await m.__tla;
                    return m;
                }), []).then(()=>{
                this.world = new Hs({
                    x: 0,
                    y: -9.81,
                    z: 0
                }), this.eventQueue = new zs(!0);
            });
        }
        getColliderName(e) {
            return e?.parent?.()?.userData?.type;
        }
        impactToVolume(e) {
            const t = wt.mapLinear(e, ge.minImpactSq, ge.maxImpactSq, ge.minImpactVolume, ge.maxImpactVolume);
            return wt.clamp(t, ge.minImpactVolume, ge.maxImpactVolume);
        }
        onCollisionWithWood(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < ge.minImpactSq) return;
            const o = this.impactToVolume(s);
            ne.hitWood.setVolume(o), ne.hitWood.play();
        }
        onCollisionWithStone(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < ge.minImpactSq) return;
            const o = this.impactToVolume(s);
            ne.hitStone.setVolume(o), ne.hitStone.play();
        }
        handleCollisionSounds() {
            this.eventQueue.drainCollisionEvents((e, t, s)=>{
                if (ne.isMute) return;
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
            return new ps(new Lt, new fs);
        }
        updateDebugMesh() {
            if (!this.debugMesh) return;
            const e = this.world.debugRender();
            this.debugMesh.geometry.dispose(), this.debugMesh.geometry = new Lt, this.debugMesh.geometry.setPositions(e.vertices), this.debugMesh.computeLineDistances();
        }
        update() {
            this.updateDebugMesh(), this.world.step(this.eventQueue), ne.isReady && this.handleCollisionSounds();
        }
    }
    const B = new jo;
    class qo {
        constructor(){
            ("ontouchstart" in window || navigator.maxTouchPoints > 0) && document.body.classList.add("is-touch-device");
        }
        async initAsync() {
            await Promise.all([
                B.initAsync(),
                u.initAsync()
            ]), await he.init(), ne.initAsync();
        }
    }
    class Ko {
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
    const ce = new Ko;
    class Yo {
        isActive = !1;
        direction = {
            x: 0,
            y: 0
        };
        constructor(){
            const e = document.createElement("div");
            e.classList.add("joystick-zone"), document.body.appendChild(e);
            const t = js.create({
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
    const Ke = new Yo;
    class Jo {
        isForward() {
            return ce.isKeyPressed("KeyW") || ce.isKeyPressed("ArrowUp") || Ke.isForward();
        }
        isBackward() {
            return ce.isKeyPressed("KeyS") || ce.isKeyPressed("ArrowDown") || Ke.isBackward();
        }
        isLeftward() {
            return ce.isKeyPressed("KeyA") || ce.isKeyPressed("ArrowLeft") || Ke.isLeftward();
        }
        isRightward() {
            return ce.isKeyPressed("KeyD") || ce.isKeyPressed("ArrowRight") || Ke.isRightward();
        }
        isJumpPressed() {
            return ce.isKeyPressed("Space");
        }
    }
    const Re = new Jo, q = {
        LIGHT_POSITION_OFFSET: new T(10, 10, 10),
        directionalColor: new V(.85, .75, .7),
        directionalIntensity: .8,
        hemiSkyColor: new V(.6, .4, .5),
        hemiGroundColor: new V(.3, .2, .2),
        fogColor: new V(.29, .08, 0),
        fogDensity: .0046
    };
    class Xo {
        directionalLight;
        hemisphereLight;
        fog;
        sunDirection = q.LIGHT_POSITION_OFFSET.clone().normalize().negate();
        constructor(){
            this.directionalLight = this.setupDirectionalLighting(), L.scene.add(this.directionalLight), this.hemisphereLight = this.setupHemisphereLight(), L.scene.add(this.hemisphereLight), this.fog = this.setupFog(), F.on("update", ({ player: e })=>{
                this.directionalLight.position.copy(e.position).add(q.LIGHT_POSITION_OFFSET);
            }), this.debugLight();
        }
        get sunColor() {
            return this.directionalLight.color;
        }
        setupHemisphereLight() {
            const e = new gs;
            return e.color.copy(q.hemiSkyColor), e.groundColor.copy(q.hemiGroundColor), e.intensity = .3, e.position.copy(q.LIGHT_POSITION_OFFSET), e;
        }
        setupDirectionalLighting() {
            const e = new ws;
            e.intensity = q.directionalIntensity, e.color.copy(q.directionalColor), e.position.copy(q.LIGHT_POSITION_OFFSET), e.target = new ys, e.castShadow = !0, e.shadow.mapSize.set(64, 64);
            const t = 1;
            return e.shadow.intensity = .85, e.shadow.camera.left = -t, e.shadow.camera.right = t, e.shadow.camera.top = t, e.shadow.camera.bottom = -t, e.shadow.camera.near = .01, e.shadow.camera.far = 30, e.shadow.normalBias = .1, e.shadow.bias = -.001, e;
        }
        setupFog() {
            return new bs(q.fogColor, q.fogDensity);
        }
        getTerrainShadowFactor = g(([e = P(0)])=>I(u.terrainShadowAo, e).r);
        debugLight() {
            const e = ee.panel.addFolder({
                title: "💡 Light"
            });
            e.expanded = !1, e.addBinding(q.LIGHT_POSITION_OFFSET, "x", {
                label: "Sun position X"
            }), e.addBinding(q.LIGHT_POSITION_OFFSET, "z", {
                label: "Sun position Z"
            }), e.addBinding(q.LIGHT_POSITION_OFFSET, "y", {
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
    const Je = new Xo, Ht = new Ss, Ct = new Xe;
    F.on("update-throttle-16x", ()=>{
        Ct.multiplyMatrices(L.renderCamera.projectionMatrix, L.renderCamera.matrixWorldInverse), Ht.setFromProjectionMatrix(Ct);
    });
    const $o = (c)=>(c.geometry.boundingSphere || c.geometry.computeBoundingSphere(), Ht.intersectsObject(c)), Qo = g(([c])=>{});
    class en extends we {
        mainBuffer;
        constructor(e){
            let t, s, o = Qo;
            switch(super(new Rt, void 0, e.count), this.mainBuffer = Fe(e.count, "vec4"), this.mainBuffer.setPBO(!0), e.preset){
                case "custom":
                    t = e.material, s = e.onInit, o = e.onUpdate;
                    break;
                case "fire":
                    const r = tn(e, this.mainBuffer);
                    t = r.material, s = r.onInit, o = r.onUpdate;
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
            a && n?.onInit(({ renderer: r })=>{
                r.computeAsync(a);
            }), F.on("update", ()=>{
                $o(this) && he.renderer.computeAsync(n);
            });
        }
    }
    const tn = (c, e)=>{
        const { speed: t = .5, radius: s = 1, height: o = 1, lifetime: n = 1, scale: a = 1, detail: r = 4, coneFactor: l = 1 } = c, d = o * 1.5, h = n * .75, f = Fe(c.count, "float"), S = .95, y = g(([Ge])=>{
            const Le = G(A.add(12345)), fe = f.element(A), _e = _(S, Le);
            fe.assign(_e);
        }), x = g(([Ge])=>{
            const Le = Ge.element(A), fe = f.element(A), _e = G(A), be = C(n, h, fe), Pe = ae.mul(t).add(_e.mul(be)).mod(be).div(be), Ne = i(1).sub(i(1).sub(Pe).pow(2)), He = C(o, d, fe), De = Ne.mul(He), ze = G(A.add(7890)).mul(Ae), nt = G(A.add(5678)), at = i(1).sub(i(1).sub(nt).pow(2)), it = i(1).sub(Ne.mul(l)), rt = W(0, .35, Ne), lt = Me(ae.mul(.5)).mul(.05).add(1), ct = C(s * .25, s, rt).mul(it).mul(lt), dt = at.mul(ct), ut = _(.5, ze).mul(2).sub(1), We = ze.add(Pe.mul(Ae).mul(.05).mul(ut)), ht = C(1, .85, fe), Ve = _e.sub(.5).mul(.05).mul(Pe), mt = W(0, .75, Pe).mul(fe), Ze = dt.add(mt.mul(ht)), Vt = Ft(We.add(Ve)).mul(Ze), Zt = Me(We.add(Ve)).mul(Ze), It = De.div(He), jt = W(0, .5, It), qt = i(1).sub(W(.5, 1, It)), Kt = jt.mul(qt);
            Le.assign(k(Vt, De, Zt, Kt));
        }), b = new Ut;
        b.precision = "lowp", b.transparent = !0, b.depthWrite = !1, b.blending = As, b.blendEquation = xs, b.blendSrc = Ms, b.blendDst = Is;
        const O = e.element(A), H = f.element(A), U = G(A.add(9234)), z = G(A.add(33.87));
        b.positionNode = O.xyz;
        const X = i(1).sub(H.mul(.85)), $ = z.clamp(.25, 1);
        b.scaleNode = $.mul(O.w).mul(X).mul(a);
        const me = _(.5, U).mul(.5), Z = _(.5, z).mul(.5), le = R().mul(.5).add(P(me, Z)), se = I(u.fireSprites, le, r), Q = M(.72, .62, .08).mul(2).toConst(), K = M(1, .1, 0).mul(4).toConst(), pe = M(0).toConst(), Ie = C(o, d, H), Oe = W(0, 1, Ue.y.div(Ie)).pow(2), Qe = W(0, .25, Oe), et = C(Q, K, Qe), ke = W(.9, 1, Oe), Be = C(et, pe, ke), tt = i(1).sub(W(0, .85, Oe)), st = _(.65, z).mul(tt), Ce = i(.5).toConst(), ye = se.a.mul(st).mul(Ce);
        return b.colorNode = C(Be, K, H).mul(ye).mul(1.5), b.alphaTest = .1, b.opacityNode = O.w.mul(se.a).mul(Ce), {
            material: b,
            onInit: y,
            onUpdate: x
        };
    };
    class sn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("campfire");
            e.material = new Ls({
                map: u.campfireDiffuse
            });
            const t = new en({
                preset: "fire",
                count: 512,
                speed: .65,
                radius: .75,
                workGroupSize: 256
            });
            t.position.copy(e.position).setY(.25), L.scene.add(e, t);
            const s = ie.fixed().setTranslation(...e.position.toArray()).setRotation(e.quaternion).setUserData({
                type: j.Stone
            }), o = B.world.createRigidBody(s);
            e.geometry.computeBoundingSphere();
            const { radius: n } = e.geometry.boundingSphere, a = re.ball(n).setRestitution(.75);
            B.world.createCollider(a, o);
        }
    }
    class on extends J {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = I(u.trunkDiffuse, R());
            this.colorNode = e.mul(1.75), this.normalMap = u.trunkNormal;
        }
    }
    class nn extends J {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.map = u.axeDiffuse, this.emissiveMap = u.axeEmissive, this.emissiveIntensity = 35, this.emissive = new V("lightblue");
        }
    }
    class an {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("kratos_axe");
            e.material = new nn;
            const t = u.realmModel.scene.getObjectByName("tree_trunk");
            t.material = new on, L.scene.add(e, t);
            const s = u.realmModel.scene.getObjectByName("axe_collider"), o = ie.fixed().setTranslation(...s.position.toArray()).setRotation(s.quaternion).setUserData({
                type: j.Wood
            }), n = B.world.createRigidBody(o), a = s.geometry.boundingBox.max, r = re.cuboid(a.x, a.y, a.z).setRestitution(.75);
            B.world.createCollider(r, n);
            const l = u.realmModel.scene.getObjectByName("trunk_collider"), { x: d, y: h } = l.geometry.boundingBox.max, f = ie.fixed().setTranslation(...l.position.toArray()).setRotation(l.quaternion).setUserData({
                type: j.Wood
            }), S = B.world.createRigidBody(f), y = d, x = h / 2, b = re.capsule(x, y).setRestitution(.75);
            B.world.createCollider(b, S);
        }
    }
    class rn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("jojo_mask");
            e.material = new ln;
            const t = u.realmModel.scene.children.filter((n)=>n.name.startsWith("jojo_symbol")), s = new cn, o = new we(t[0].geometry, s, t.length);
            for(let n = 0; n < t.length; n++){
                const a = t[n];
                o.setMatrixAt(n, a.matrix);
            }
            L.scene.add(e, o);
        }
    }
    class ln extends J {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const { stoneDiffuse: e } = u.atlasesCoords.stones, t = v.computeAtlasUv(P(...e.scale), P(...e.offset), R()), s = I(u.stoneAtlas, t);
            this.colorNode = s;
        }
    }
    class cn extends J {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const e = _t("#eb5694"), t = _t("#9642D3");
            this.colorNode = C(t, e, R().y.mul(.5)).mul(.45);
            const s = ae.mul(20), o = Me(s.add(A)), n = _(0, o).mul(.25);
            this.positionNode = Ue.add(n);
        }
    }
    class dn extends _s {
        uScale = m(1);
        constructor(){
            super();
            const e = I(u.kunaiDiffuse, R());
            this.colorNode = e.mul(5);
            const t = I(u.kunaiMR, R());
            this.metalnessNode = t.b.mul(.75), this.roughnessNode = t.g;
        }
    }
    class un {
        constructor(){
            const e = u.realmModel.scene.children.filter(({ name: l })=>l.startsWith("kunai")), t = u.realmModel.scene.getObjectByName("base_kunai"), s = new dn, o = new we(t.geometry, s, e.length), { x: n, y: a, z: r } = t.geometry.boundingBox.max;
            e.forEach((l, d)=>{
                o.setMatrixAt(d, l.matrix);
                const h = ie.fixed().setTranslation(...l.position.toArray()).setRotation(l.quaternion).setUserData({
                    type: j.Wood
                }), f = B.world.createRigidBody(h), S = re.cuboid(n, a, r).setRestitution(.75);
                B.world.createCollider(S, f);
            }), L.scene.add(o);
        }
    }
    class hn extends J {
        constructor(){
            super(), this.map = u.onePieceAtlas, this.side = St;
        }
    }
    class mn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("one_piece_posters");
            e.material = new hn, L.scene.add(e);
        }
    }
    class pn {
        constructor(){
            new an, new mn, new rn, new un, new sn;
        }
    }
    const zt = {
        uBaseColor: m(new V),
        uRandom: m(0)
    };
    class fn extends J {
        _uniforms;
        constructor(e){
            super(), this._uniforms = {
                ...zt,
                ...e
            }, this.createMaterial();
        }
        setRandomSeed(e) {
            this._uniforms.uRandom.value = e;
        }
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = de(R().mul(2).add(this._uniforms.uRandom)), { stoneDiffuse: t, stoneNormalAo: s } = u.atlasesCoords.stones, o = v.computeAtlasUv(P(...t.scale), P(...t.offset), e), n = I(u.stoneAtlas, o);
            this.colorNode = n.mul(1.5);
            const a = v.computeAtlasUv(P(...s.scale), P(...s.offset), e), r = I(u.stoneAtlas, a);
            this.normalNode = new $e(r.rgb, i(.5)), this.aoNode = r.a;
        }
    }
    class gn {
        uniforms = zt;
        constructor(){
            const e = new fn(this.uniforms), t = u.realmModel.scene.children.filter(({ name: o })=>o.endsWith("_monument"));
            t.forEach((o, n)=>{
                const a = wt.seededRandom(n);
                o.material = e, o.receiveShadow = !0, o.onBeforeRender = (r, l, d, h, f)=>{
                    f.setRandomSeed(a);
                };
            }), L.scene.add(...t), u.realmModel.scene.children.filter(({ name: o })=>o.startsWith("monument_collider")).forEach((o)=>{
                const n = ie.fixed().setTranslation(...o.position.toArray()).setRotation(o.quaternion).setUserData({
                    type: j.Stone
                }), a = B.world.createRigidBody(n), r = .5 * o.scale.x, l = .5 * o.scale.y, d = .5 * o.scale.z, h = re.cuboid(r, l, d).setRestitution(.75);
                B.world.createCollider(h, a);
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
        uMinDist: m(1),
        uMaxDist: m(15),
        uSunDir: m(Je.sunDirection),
        uSunColor: m(Je.sunColor.clone()),
        uTworld: m(new T(1, 0, 0)),
        uBworld: m(new T(0, 0, -1)),
        uNworld: m(new T(0, 1, 0)),
        uHighlightsGlow: m(4),
        uHighlightFresnelInfluence: m(.35),
        uDepthDistance: m(20),
        uAbsorptionRGB: m(new T(.35, .1, .08)),
        uInscatterTint: m(new V(0, .09, .09)),
        uInscatterStrength: m(.85),
        uAbsorptionScale: m(10),
        uMinOpacity: m(.5),
        uIsWebGPU: m(1),
        uHighlightsSpread: m(.35),
        uDepthOpacityScale: m(.1),
        uHighlightsDepthOpacityScale: m(.05)
    };
    class wn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("water");
            e.material = new yn, e.renderOrder = 100, p.uTworld.value.transformDirection(e.matrixWorld).normalize(), p.uBworld.value.transformDirection(e.matrixWorld).normalize(), p.uNworld.value.transformDirection(e.matrixWorld).normalize(), p.uIsWebGPU.value = Number(he.isWebGPU);
            const s = e.geometry.boundingSphere;
            s.radius = s.radius * .75, L.scene.add(e), F.on("audio-ready", ()=>{
                e.add(ne.lake);
            });
        }
    }
    class yn extends Ot {
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
        sampleNormal = g(([e = P(0)])=>I(u.waterNormal, e).mul(2).sub(1).rgb.normalize());
        createMaterial() {
            this.precision = "lowp";
            const e = ae.mul(p.uSpeed), t = p.uNoiseScrollDir.mul(e), s = R().add(t).mul(p.uUvScale.mul(1.37)).fract(), o = this.sampleNormal(s), n = R().sub(t).mul(p.uUvScale.mul(.73)).fract(), a = this.sampleNormal(n), r = v.blendRNM(o, a), l = M(r.xy.mul(p.uNormalScale), r.z).normalize(), d = l.x.mul(p.uTworld).add(l.y.mul(p.uBworld)).add(l.z.mul(p.uNworld)).normalize(), h = Pt(pt).r, f = i(1).sub(p.uIsWebGPU), S = h.mul(2).sub(1).mul(f), y = h.mul(p.uIsWebGPU), x = S.add(y), b = Dt.element(3).element(2), O = Dt.element(2).element(2), H = b.div(x.add(O)), U = Ps.z.negate(), z = _(U, H), $ = H.sub(U).div(p.uDepthDistance).clamp(), me = C(p.uRefractionStrength, p.uRefractionStrength.mul(1.5), $), Z = l.xy.mul(me), te = pt.add(Z.mul(z)), le = Pt(te).r, se = le.mul(2).sub(1).mul(f), Q = le.mul(p.uIsWebGPU), K = se.add(Q), pe = b.div(K.add(O)), Ie = _(U, pe), Qe = pe.sub(U).div(p.uDepthDistance).clamp(), et = C(pt, te, Ie), ke = Ds(et).rgb, Be = Es(ft.sub(ue)), tt = Et(Be.negate(), d), xt = vs(u.envMapTexture, tt), st = gt(d, Be).clamp(), Ce = i(.02), ye = i(1).sub(st), Ge = ye.mul(ye).mul(ye).mul(ye).mul(ye), Le = Ce.add(i(1).sub(Ce).mul(Ge)), fe = Le.mul(p.uFresnelScale).clamp(), _e = p.uAbsorptionRGB.mul(p.uAbsorptionScale), be = C($, Qe, Ie), ot = Ts(_e.negate().mul(be)), Pe = ke.mul(ot), Ne = p.uInscatterTint.mul(i(1).sub(ot)).mul(p.uInscatterStrength), He = Pe.add(Ne), De = M(r.xy.mul(p.uHighlightsSpread), r.z).normalize(), ze = De.x.mul(p.uTworld).add(De.y.mul(p.uBworld)).add(De.z.mul(p.uNworld)).normalize(), nt = Et(p.uSunDir, ze), at = Ye(gt(nt, Be), 0), it = At(at, p.uShininess), rt = C(i(1), Le, p.uHighlightFresnelInfluence), lt = W(0, p.uHighlightsDepthOpacityScale, be), ct = p.uSunColor.mul(it.mul(p.uHighlightsGlow).mul(rt)).mul(lt), dt = gt(ue.xz.sub(ft.xz), ue.xz.sub(ft.xz)), ut = p.uMinDist.mul(p.uMinDist), Mt = p.uMaxDist.mul(p.uMaxDist), We = W(ut, Mt, dt).add(p.uMinOpacity).clamp(), ht = W(0, p.uDepthOpacityScale, be), Ve = We.mul(ht).clamp(), mt = C(He, xt, fe), Ze = C(ke, mt, Ve);
            this.colorNode = Ze.add(ct);
        }
    }
    const Nt = 20;
    class bn extends J {
        _noiseBuffer;
        constructor(){
            super(), this._noiseBuffer = Fe(Nt, "float"), this._noiseBuffer.setPBO(!0), he.renderer.computeAsync(this.computeInit), this.precision = "lowp", this.flatShading = !1;
            const e = G(A), t = this._noiseBuffer.element(A), s = _(.5, t), o = i(1).sub(s), n = de(R().mul(3.6).add(e)), a = de(R().mul(1.5).add(e)), r = n.mul(s).add(a.mul(o)), { stoneDiffuse: l, stoneNormalAo: d, stoneMossyDiffuse: h, stoneMossyNormalAo: f } = u.atlasesCoords.stones, S = P(...l.scale).mul(s), y = P(...h.scale).mul(o), x = S.add(y), b = P(...l.offset).mul(s), O = P(...h.offset).mul(o), H = b.add(O), U = v.computeAtlasUv(x, H, r);
            this.colorNode = I(u.stoneAtlas, U);
            const z = P(...d.scale).mul(s), X = P(...f.scale).mul(o), $ = z.add(X), me = P(...d.offset).mul(s), Z = P(...f.offset).mul(o), te = me.add(Z), le = v.computeAtlasUv($, te, r), se = I(u.stoneAtlas, le);
            this.normalNode = new $e(se.rgb, i(3)), this.normalScale = new Te(1, -1), this.aoNode = se.a;
        }
        computeInit = g(()=>{
            const e = this._noiseBuffer.element(A), t = P(G(A), G(A).mul(21.63)).fract(), s = I(u.noiseTexture, t);
            e.assign(s.r);
        })().compute(Nt);
    }
    class Sn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("stone"), t = u.realmModel.scene.children.filter(({ name: n })=>n.startsWith("stone_collider")), s = new bn, o = new we(e.geometry, s, t.length);
            o.receiveShadow = !0, t.forEach((n, a)=>{
                o.setMatrixAt(a, n.matrix);
                const r = ie.fixed().setTranslation(...n.position.toArray()).setRotation(n.quaternion).setUserData({
                    type: j.Stone
                }), l = B.world.createRigidBody(r);
                n.geometry.computeBoundingBox();
                const d = n.geometry.boundingBox.max.x * n.scale.x, h = re.ball(d).setRestitution(.75);
                B.world.createCollider(h, l);
            }), L.scene.add(o);
        }
    }
    const An = {
        uGrassTerrainColor: m(new V().setRGB(.74, .51, 0)),
        uWaterSandColor: m(new V().setRGB(.54, .39, .2)),
        uPathSandColor: m(new V().setRGB(.65, .49, .27))
    };
    class xn extends J {
        _uniforms = {
            ...An
        };
        constructor(){
            super(), this.createMaterial(), this.debugTerrain();
        }
        debugTerrain() {
            const e = ee.panel.addFolder({
                title: "⛰️ Terrain"
            });
            e.expanded = !1, e.addBinding(this._uniforms.uPathSandColor, "value", {
                label: "Path color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(this._uniforms.uWaterSandColor, "value", {
                label: "Water bed color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(this._uniforms.uGrassTerrainColor, "value", {
                label: "Grass terrain color",
                view: "color",
                color: {
                    type: "float"
                }
            });
        }
        computeCausticsDiffuse = g(([e = P(0, 0), t = i(0), s = M(0, 0, 0)])=>{
            const o = ae.mul(.15), n = e.mul(17), a = de(n.add(P(o, 0))), r = I(u.noiseTexture, a, 1).g, l = e.mul(33), d = de(l.add(P(0, o.negate()))), h = I(u.noiseTexture, d, 3).g, f = r.add(h), S = W(-1, 7.5, t), y = At(f, 3).mul(i(1).sub(S)), x = M(.6, .8, 1).mul(.5);
            return C(s, x, y);
        });
        computeWaterDiffuse = g(([e = i(0), t = P(0, 0)])=>{
            const s = i(8), o = i(.001), n = W(0, s.add(o), e), a = this._uniforms.uWaterSandColor, r = M(.35, .45, .55).mul(.65), l = this.computeCausticsDiffuse(t, e), d = W(0, 1.5, e), h = M(1, .9, .7).mul(.1).mul(d);
            return C(a, r, n).add(h).add(l);
        });
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = v.computeMapUvByPosition(ue.xz), t = yt(e), s = I(u.terrainShadowAo, R().clamp());
            this.aoNode = s.g;
            const o = I(u.terrainTypeMap, t, 2.5), n = o.g, a = o.b, l = i(1).sub(n).sub(a), d = I(u.sandNormal, de(t.mul(30))), h = de(t.mul(30)), S = I(u.grassNormal, h).dot(d).mul(.65), y = I(u.grassDiffuse, h), x = i(1).sub(y.a), b = this._uniforms.uGrassTerrainColor.mul(x).add(y).mul(n).mul(.85), O = this._uniforms.uPathSandColor.mul(1.2).mul(l), H = yt(ue.y.negate()), z = this.computeWaterDiffuse(H, t).mul(a), X = b.add(O.mul(S)).add(z.mul(S).mul(.5));
            this.colorNode = X.mul(s.r);
        }
    }
    class Mn {
        constructor(e){
            const t = this.createFloor();
            t.material = e, L.scene.add(t);
        }
        createFloor() {
            const e = u.realmModel.scene.getObjectByName("floor");
            return e.receiveShadow = !0, this.createFloorPhysics(), e;
        }
        getFloorDisplacementData() {
            const e = u.realmModel.scene.getObjectByName("heightfield"), t = e.geometry.attributes._displacement.array[0], s = e.geometry.attributes.position;
            e.geometry.boundingBox || e.geometry.computeBoundingBox();
            const o = e.geometry.boundingBox, n = s.count, a = Math.sqrt(n), r = o.max.x, l = new Float32Array(n);
            for(let d = 0; d < n; d++){
                const h = s.array[d * 3 + 0], f = s.array[d * 3 + 1], S = s.array[d * 3 + 2], y = Math.round((h / (r * 2) + .5) * (a - 1)), b = Math.round((S / (r * 2) + .5) * (a - 1)) + y * a;
                l[b] = f;
            }
            return {
                rowsCount: a,
                heights: l,
                displacement: t
            };
        }
        createFloorPhysics() {
            const e = this.getFloorDisplacementData(), { rowsCount: t, heights: s, displacement: o } = e, n = ie.fixed().setTranslation(0, -o, 0).setUserData({
                type: j.Terrain
            }), a = B.world.createRigidBody(n), r = re.heightfield(t - 1, t - 1, s, {
                x: Y.MAP_SIZE,
                y: 1,
                z: Y.MAP_SIZE
            }, Ws.FIX_INTERNAL_EDGES).setFriction(1).setRestitution(.2);
            B.world.createCollider(r, a);
        }
    }
    class In {
        outerFloor;
        kintoun;
        kintounPosition = new T;
        constructor(e){
            this.outerFloor = this.createOuterFloorVisual(), this.outerFloor.material = e, this.kintoun = this.createKintoun(), L.scene.add(this.outerFloor), F.on("update", this.update.bind(this));
        }
        createOuterFloorVisual() {
            const e = u.realmModel.scene.getObjectByName("outer_world");
            return e.receiveShadow = !0, e;
        }
        createKintoun() {
            const e = ie.kinematicPositionBased().setTranslation(0, -20, 0).setUserData({
                type: j.Terrain
            }), t = B.world.createRigidBody(e), s = 2, o = re.cuboid(s, Y.HALF_FLOOR_THICKNESS, s).setFriction(1).setRestitution(.2);
            return B.world.createCollider(o, t), t;
        }
        useKintoun(e) {
            this.kintounPosition.copy(e).setY(-Y.HALF_FLOOR_THICKNESS), this.kintoun.setTranslation(this.kintounPosition, !0);
        }
        update(e) {
            const { player: t } = e, s = Y.HALF_MAP_SIZE - Math.abs(t.position.x) < Y.KINTOUN_ACTIVATION_THRESHOLD, o = Y.HALF_MAP_SIZE - Math.abs(t.position.z) < Y.KINTOUN_ACTIVATION_THRESHOLD;
            (s || o) && this.useKintoun(t.position);
            const n = Y.MAP_SIZE, a = Math.abs(t.position.x), r = Math.sign(t.position.x), l = Math.abs(t.position.z), d = Math.sign(t.position.z), h = a > n ? a - n : 0, f = l > n ? l - n : 0;
            this.outerFloor.position.set(h * r, 0, f * d);
        }
    }
    class Ln {
        constructor(){
            const e = new xn;
            new Mn(e), new In(e);
        }
    }
    const _n = ()=>({
            BLADE_WIDTH: .1,
            BLADE_HEIGHT: 1.65,
            BLADE_BOUNDING_SPHERE_RADIUS: 1.65,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            BLADES_PER_SIDE: 512,
            COUNT: 512 * 512,
            SPACING: 150 / 512,
            WORKGROUP_SIZE: 256
        }), D = _n(), w = {
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
        uGlowColor: m(new V().setRGB(.39, .14, .02)),
        uBladeMaxBendAngle: m(Math.PI * .15),
        uWindStrength: m(.6),
        uBaseColor: m(new V().setRGB(.07, .07, 0)),
        uTipColor: m(new V().setRGB(.23, .11, .05)),
        uDelta: m(new Te(0, 0)),
        uGlowMul: m(3),
        uR0: m(20),
        uR1: m(75),
        uPMin: m(.05),
        uWindSpeed: m(.25)
    };
    class Pn {
        buffer;
        constructor(){
            this.buffer = Fe(D.COUNT, "vec4"), this.computeUpdate.onInit(({ renderer: e })=>{
                e.computeAsync(this.computeInit);
            });
        }
        get computeBuffer() {
            return this.buffer;
        }
        getYaw = g(([e = k(0)])=>v.unpackUnits(e.z, 0, 12, -Math.PI, Math.PI));
        getBend = g(([e = k(0)])=>v.unpackUnits(e.z, 12, 12, -Math.PI, Math.PI));
        getScale = g(([e = k(0)])=>v.unpackUnits(e.w, 0, 8, w.uBladeMinScale, w.uBladeMaxScale));
        getOriginalScale = g(([e = k(0)])=>v.unpackUnits(e.w, 8, 8, w.uBladeMinScale, w.uBladeMaxScale));
        getShadow = g(([e = k(0)])=>v.unpackFlag(e.w, 16));
        getVisibility = g(([e = k(0)])=>v.unpackFlag(e.w, 17));
        getGlow = g(([e = k(0)])=>v.unpackUnit(e.w, 18, 6));
        setYaw = g(([e = k(0), t = i(0)])=>(e.z = v.packUnits(e.z, 0, 12, t, -Math.PI, Math.PI), e));
        setBend = g(([e = k(0), t = i(0)])=>(e.z = v.packUnits(e.z, 12, 12, t, -Math.PI, Math.PI), e));
        setScale = g(([e = k(0), t = i(0)])=>(e.w = v.packUnits(e.w, 0, 8, t, w.uBladeMinScale, w.uBladeMaxScale), e));
        setOriginalScale = g(([e = k(0), t = i(0)])=>(e.w = v.packUnits(e.w, 8, 8, t, w.uBladeMinScale, w.uBladeMaxScale), e));
        setShadow = g(([e = k(0), t = i(0)])=>(e.w = v.packFlag(e.w, 16, t), e));
        setVisibility = g(([e = k(0), t = i(0)])=>(e.w = v.packFlag(e.w, 17, t), e));
        setGlow = g(([e = k(0), t = i(0)])=>(e.w = v.packUnit(e.w, 18, 6, t), e));
        computeInit = g(()=>{
            const e = this.buffer.element(A), t = xe(i(A).div(D.BLADES_PER_SIDE)), s = i(A).mod(D.BLADES_PER_SIDE), o = G(A.add(4321)), n = G(A.add(1234)), a = s.mul(D.SPACING).sub(D.TILE_HALF_SIZE).add(o.mul(D.SPACING * .5)), r = t.mul(D.SPACING).sub(D.TILE_HALF_SIZE).add(n.mul(D.SPACING * .5)), l = M(a, 0, r).xz.add(D.TILE_HALF_SIZE).div(D.TILE_SIZE).abs(), d = I(u.noiseTexture, l), h = d.r.sub(.5).mul(17).fract(), f = d.b.sub(.5).mul(13).fract();
            e.x = a.add(h), e.y = r.add(f);
            const S = d.b.sub(.5).mul(i(Math.PI * 2));
            e.assign(this.setYaw(e, S));
            const y = w.uBladeMaxScale.sub(w.uBladeMinScale), x = d.r.mul(y).add(w.uBladeMinScale);
            e.assign(this.setScale(e, x)), e.assign(this.setOriginalScale(e, x));
        })().compute(D.COUNT, [
            D.WORKGROUP_SIZE
        ]);
        computeStochasticKeep = g(([e = M(0)])=>{
            const t = e.x.sub(w.uPlayerPosition.x), s = e.z.sub(w.uPlayerPosition.z), o = t.mul(t).add(s.mul(s)), n = w.uR0, a = w.uR1, r = w.uPMin, l = n.mul(n), d = a.mul(a), h = bt(o.sub(l).div(Ye(d.sub(l), 1e-5)), 0, 1), f = C(1, r, h), S = G(i(A).mul(.73));
            return _(S, f);
        });
        computeVisibility = g(([e = M(0)])=>{
            const t = w.uCameraMatrix.mul(k(e, 1)), s = t.xyz.div(t.w), o = D.BLADE_BOUNDING_SPHERE_RADIUS, n = i(1);
            return _(n.negate().sub(o), s.x).mul(_(s.x, n.add(o))).mul(_(n.negate().sub(o), s.y)).mul(_(s.y, n.add(o))).mul(_(0, s.z)).mul(_(s.z, n));
        });
        computeBending = g(([e = i(0), t = M(0)])=>{
            const s = t.xz.add(ae.mul(w.uWindSpeed)).mul(.5).fract(), n = I(u.noiseTexture, s, 2).r.mul(w.uWindStrength);
            return e.add(n.sub(e).mul(.1));
        });
        computeAlpha = g(([e = M(0)])=>{
            const t = v.computeMapUvByPosition(e.xz), s = I(u.terrainTypeMap, t).g;
            return _(.25, s);
        });
        computeTrailScale = g(([e = i(0), t = i(0), s = i(0)])=>{
            const o = t.add(w.uTrailGrowthRate), n = i(1).sub(s), a = w.uTrailMinScale.mul(s).add(o.mul(n));
            return Cs(a, e);
        });
        computeTrailGlow = g(([e = i(0), t = i(0), s = i(0), o = i(0)])=>{
            const n = W(w.uGlowRadiusSquared, i(0), t), a = 100, r = xe(vt(w.uDelta.x).mul(a)), l = xe(vt(w.uDelta.y).mul(a)), d = _(1, r.add(l)), h = n.mul(i(1).sub(s)).mul(o), f = Ye(d, e).mul(h), S = f.mul(w.uGlowFadeIn), y = i(1).sub(f).mul(w.uGlowFadeOut), x = i(1).sub(d).mul(w.uGlowFadeOut).mul(e);
            return bt(e.add(S).sub(y).sub(x), 0, 1);
        });
        computeShadow = g(([e = M(0)])=>{
            const t = v.computeMapUvByPosition(e.xz), s = I(u.terrainShadowAo, t);
            return _(.65, s.r);
        });
        computeUpdate = g(()=>{
            const e = this.buffer.element(A), t = ve(e.x.sub(w.uDelta.x).add(D.TILE_HALF_SIZE), D.TILE_SIZE).sub(D.TILE_HALF_SIZE), s = ve(e.y.sub(w.uDelta.y).add(D.TILE_HALF_SIZE), D.TILE_SIZE).sub(D.TILE_HALF_SIZE), o = M(t, 0, s);
            e.x = t, e.y = s;
            const n = o.add(w.uPlayerPosition), a = this.computeStochasticKeep(n), r = this.computeVisibility(n).mul(a);
            e.assign(this.setVisibility(e, r)), kt(r, ()=>{
                const l = P(w.uDelta.x, w.uDelta.y), d = o.xz.sub(l), h = d.dot(d), f = _(.1, i(1).sub(w.uPlayerPosition.y)), S = _(h, w.uTrailRaiusSquared).mul(f), y = this.getScale(e), x = this.getOriginalScale(e), b = this.computeTrailScale(x, y, S);
                e.assign(this.setScale(e, b));
                const O = this.computeAlpha(n);
                e.assign(this.setVisibility(e, O));
                const H = this.getBend(e), U = this.computeBending(H, n);
                e.assign(this.setBend(e, U));
                const z = this.getGlow(e), X = this.computeTrailGlow(z, h, S, f);
                e.assign(this.setGlow(e, X));
                const $ = this.computeShadow(n);
                e.assign(this.setShadow(e, $));
            });
        })().compute(D.COUNT, [
            D.WORKGROUP_SIZE
        ]);
    }
    class Dn extends Ot {
        ssbo;
        constructor(e){
            super(), this.ssbo = e, this.createGrassMaterial();
        }
        computePosition = g(([e = i(0), t = i(0), s = i(0), o = i(0), n = i(0), a = i(0)])=>{
            const r = M(e, 0, t), l = o.mul(R().y), h = Tt(Ue, M(l, 0, 0)).mul(M(1, n, 1)), f = Tt(h, M(0, s, 0)), S = G(A).mul(Ae), y = Me(ae.mul(5).add(o).add(S)).mul(.1), x = R().y.mul(a), b = y.mul(x);
            return f.add(r).add(M(b));
        });
        computeDiffuseColor = g(([e = i(0), t = i(1)])=>{
            const s = C(w.uBaseColor, w.uTipColor, R().y), o = C(s, w.uGlowColor.mul(w.uGlowMul), e);
            return C(o.mul(.5), o, t);
        });
        createGrassMaterial() {
            this.precision = "lowp", this.side = St;
            const e = this.ssbo.computeBuffer.element(A), t = e.x, s = e.y, o = this.ssbo.getYaw(e), n = this.ssbo.getBend(e), a = this.ssbo.getScale(e), r = this.ssbo.getVisibility(e), l = this.ssbo.getGlow(e), d = this.ssbo.getShadow(e);
            Ns(r.equal(0)), this.positionNode = this.computePosition(t, s, o, n, a, l), this.opacityNode = r, this.alphaTest = .5, this.colorNode = this.computeDiffuseColor(l, d);
        }
    }
    class En {
        constructor(){
            const e = new Pn, t = this.createGeometry(3), s = new Dn(e), o = new we(t, s, D.COUNT);
            o.frustumCulled = !1, L.scene.add(o), F.on("update-throttle-2x", ({ player: n })=>{
                const a = n.position.x - o.position.x, r = n.position.z - o.position.z;
                w.uDelta.value.set(a, r), w.uPlayerPosition.value.copy(n.position), w.uCameraMatrix.value.copy(L.playerCamera.projectionMatrix).multiply(L.playerCamera.matrixWorldInverse), o.position.copy(n.position).setY(0), he.renderer.computeAsync(e.computeUpdate);
            }), this.debugGrass();
        }
        debugGrass() {
            const e = ee.panel.addFolder({
                title: "🌱 Grass",
                expanded: !1
            });
            e.addBinding(w.uTipColor, "value", {
                label: "Tip Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(w.uBaseColor, "value", {
                label: "Base Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(w.uGlowColor, "value", {
                label: "Glow Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(w.uWindStrength, "value", {
                label: "Wind strength",
                min: 0,
                max: Math.PI / 2,
                step: .1
            }), e.addBinding(w.uWindSpeed, "value", {
                label: "Wind speed",
                min: 0,
                max: 5,
                step: .01
            }), e.addBinding(w.uGlowMul, "value", {
                label: "Glow bloom",
                min: 1,
                max: 20,
                step: .01
            }), e.addBinding(w.uR0, "value", {
                label: "Inner ring",
                min: 0,
                max: D.TILE_SIZE,
                step: .1
            }), e.addBinding(w.uR1, "value", {
                label: "Outer ring",
                min: 0,
                max: D.TILE_SIZE,
                step: .1
            }), e.addBinding(w.uPMin, "value", {
                label: "P Min",
                min: 0,
                max: 1,
                step: .01
            });
        }
        createGeometry(e) {
            const t = Math.max(1, Math.floor(e)), s = D.BLADE_HEIGHT, o = D.BLADE_WIDTH * .5, n = t, a = n * 2 + 1, l = Math.max(0, n - 1) * 6 + 3, d = new Float32Array(a * 3), h = new Float32Array(a * 2), f = new Uint8Array(l), S = new Float32Array(l * 3), y = (Z)=>o * (1 - .7 * Z);
            let x = 0;
            for(let Z = 0; Z < n; Z++){
                const te = Z / t, le = te * s, se = y(te), Q = Z * 2, K = Q + 1;
                if (d[3 * Q + 0] = -se, d[3 * Q + 1] = le, d[3 * Q + 2] = 0, d[3 * K + 0] = se, d[3 * K + 1] = le, d[3 * K + 2] = 0, h[2 * Q + 0] = 0, h[2 * Q + 1] = te, h[2 * K + 0] = 1, h[2 * K + 1] = te, Z > 0) {
                    const pe = (Z - 1) * 2, Ie = pe + 1;
                    f[x++] = pe, f[x++] = Ie, f[x++] = K, f[x++] = pe, f[x++] = K, f[x++] = Q;
                }
            }
            const b = n * 2;
            d[3 * b + 0] = 0, d[3 * b + 1] = s, d[3 * b + 2] = 0, h[2 * b + 0] = .5, h[2 * b + 1] = 1;
            const O = (n - 1) * 2, H = O + 1;
            f[x++] = O, f[x++] = H, f[x++] = b;
            const U = new Bs, z = new je(d, 3);
            z.setUsage(qe), U.setAttribute("position", z);
            const X = new je(h, 2);
            X.setUsage(qe), U.setAttribute("uv", X);
            const $ = new je(f, 1);
            $.setUsage(qe), U.setIndex($);
            const me = new je(S, 3);
            return me.setUsage(qe), U.setAttribute("normal", me), U;
        }
    }
    const vn = ()=>({
            FLOWER_WIDTH: .5,
            FLOWER_HEIGHT: 1,
            BLADE_BOUNDING_SPHERE_RADIUS: 1,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            FLOWERS_PER_SIDE: 25,
            COUNT: 625,
            SPACING: 150 / 25
        }), N = vn();
    class Tn {
        flowerField;
        material;
        uniforms = {
            ...Wt,
            uDelta: m(new Te(0, 0)),
            uPlayerPosition: m(new T(0, 0, 0)),
            uCameraMatrix: m(new Xe)
        };
        constructor(){
            this.material = new Bn(this.uniforms), this.flowerField = new we(new Rt(1, 1), this.material, N.COUNT), L.scene.add(this.flowerField), F.on("update", this.updateAsync.bind(this));
        }
        async updateAsync(e) {
            const { player: t } = e, s = t.position.x - this.flowerField.position.x, o = t.position.z - this.flowerField.position.z;
            this.uniforms.uDelta.value.set(s, o), this.uniforms.uPlayerPosition.value.copy(t.position), this.uniforms.uCameraMatrix.value.copy(L.playerCamera.projectionMatrix).multiply(L.playerCamera.matrixWorldInverse), this.flowerField.position.copy(t.position).setY(0), this.material.updateAsync();
        }
    }
    const Wt = {
        uPlayerPosition: m(new T(0, 0, 0)),
        uCameraMatrix: m(new Xe),
        uDelta: m(new Te(0, 0))
    };
    class Bn extends Ut {
        _uniforms;
        _buffer1;
        constructor(e){
            super(), this._uniforms = {
                ...Wt,
                ...e
            }, this._buffer1 = Fe(N.COUNT, "vec4"), this._buffer1.setPBO(!0), this.computeUpdate.onInit(({ renderer: t })=>{
                t.computeAsync(this.computeInit);
            }), this.createMaterial();
        }
        computeInit = g(()=>{
            const e = this._buffer1.element(A), t = xe(i(A).div(N.FLOWERS_PER_SIDE)), s = i(A).mod(N.FLOWERS_PER_SIDE), o = G(A.add(4321)), n = G(A.add(1234)), a = s.mul(N.SPACING).sub(N.TILE_HALF_SIZE).add(o.mul(N.SPACING * .5)), r = t.mul(N.SPACING).sub(N.TILE_HALF_SIZE).add(n.mul(N.SPACING * .5)), l = M(a, 0, r).xz.add(N.TILE_HALF_SIZE).div(N.TILE_SIZE).abs(), h = I(u.noiseTexture, l).r, f = h.sub(.5).mul(100), S = h.clamp(.5, .75), y = h.sub(.5).mul(50);
            e.x = a.add(f), e.y = S, e.z = r.add(y);
        })().compute(N.COUNT);
        computeVisibility = g(([e = M(0)])=>{
            const t = this._uniforms.uCameraMatrix.mul(k(e, 1)), s = t.xyz.div(t.w), o = N.BLADE_BOUNDING_SPHERE_RADIUS, n = i(1);
            return _(n.negate().sub(o), s.x).mul(_(s.x, n.add(o))).mul(_(n.negate().sub(o), s.y)).mul(_(s.y, n.add(o))).mul(_(0, s.z)).mul(_(s.z, n));
        });
        computeAlpha = g(([e = M(0)])=>{
            const t = v.computeMapUvByPosition(e.xz);
            return I(u.terrainTypeMap, t).g;
        });
        computeUpdate = g(()=>{
            const e = this._buffer1.element(A), t = ve(e.x.sub(this._uniforms.uDelta.x).add(N.TILE_HALF_SIZE), N.TILE_SIZE).sub(N.TILE_HALF_SIZE), s = ve(e.z.sub(this._uniforms.uDelta.y).add(N.TILE_HALF_SIZE), N.TILE_SIZE).sub(N.TILE_HALF_SIZE);
            e.x = t, e.z = s;
            const n = M(e.x, 0, e.z).add(this._uniforms.uPlayerPosition), a = this.computeVisibility(n);
            e.w = a, kt(a, ()=>{
                e.w = this.computeAlpha(n);
            });
        })().compute(N.COUNT);
        createMaterial() {
            this.precision = "lowp";
            const e = this._buffer1.element(A), t = G(A.add(9234)), s = G(A.add(33.87)), o = ae.mul(2), n = Me(o.add(t.mul(100))).mul(.05);
            this.positionNode = e.xyz.add(M(n, 0, n)), this.scaleNode = t.mul(.2).add(.3);
            const a = _(.5, t).mul(.5), r = _(.5, s).mul(.5), d = R().mul(.5).add(P(a, r)), h = I(u.flowerAtlas, d);
            this.colorNode = h, this.opacityNode = e.w, this.alphaTest = .15;
        }
        async updateAsync() {
            he.renderer.computeAsync(this.computeUpdate);
        }
    }
    class Cn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("water_lilies");
            e.material = this.createMaterial(), L.scene.add(e);
        }
        createMaterial() {
            const e = new J;
            e.precision = "lowp", e.transparent = !0, e.map = u.waterLiliesTexture, e.alphaTest = .5, e.alphaMap = u.waterLiliesAlphaTexture;
            const t = ae.mul(5e-4), s = ue.x.mul(.1), o = I(u.noiseTexture, de(ue.xz.add(t).mul(s))).b.mul(.5), n = Me(o);
            return e.positionNode = Ue.add(n), e;
        }
    }
    class Nn extends J {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = de(R().mul(7)), t = I(u.barkDiffuse, e);
            this.colorNode = t.mul(2.5);
            const s = I(u.barkNormal, e);
            this.normalNode = new $e(s);
        }
    }
    const Ee = {
        uPrimaryColor: m(new V().setRGB(.889, .095, 0)),
        uSecondaryColor: m(new V().setRGB(1, .162, .009)),
        uMixFactor: m(.5)
    };
    class Rn extends J {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.transparent = !0, this.side = St;
            const e = v.computeMapUvByPosition(ue.xz), t = I(u.noiseTexture, e), s = I(u.canopyDiffuse, R()), o = C(Ee.uPrimaryColor, Ee.uSecondaryColor, Ee.uMixFactor);
            this.colorNode = k(C(s.rgb, o, t.b.mul(.4)).rgb, 1);
            const n = I(u.canopyNormal, R());
            this.normalNode = new $e(n, i(1.25)), this.normalScale = new Te(1, -1), this.opacityNode = _(.5, s.a), this.alphaTest = .1;
            const a = ae.mul(t.r).add(Rs).mul(7.5), r = Me(a).mul(.015), l = Ft(a.mul(.75)).mul(.01);
            this.positionNode = Ue.add(M(0, l, r));
        }
    }
    class Fn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("tree"), t = u.realmModel.scene.children.filter(({ name: y })=>y.startsWith("tree_collider")), s = new Nn, o = new Rn, [n, a] = e.children, r = new we(n.geometry, s, t.length);
            r.receiveShadow = !0;
            const l = new we(a.geometry, o, t.length), h = u.realmModel.scene.getObjectByName("base_tree_collider").geometry.boundingBox, f = h.max.x, S = h.max.y / 2;
            t.forEach((y, x)=>{
                r.setMatrixAt(x, y.matrix), l.setMatrixAt(x, y.matrix);
                const b = ie.fixed().setTranslation(...y.position.toArray()).setRotation(y.quaternion).setUserData({
                    type: j.Wood
                }), O = B.world.createRigidBody(b), H = f * y.scale.x, U = S * y.scale.y, z = re.capsule(U, H).setRestitution(.75);
                B.world.createCollider(z, O);
            }), L.scene.add(r, l), this.debugTrees();
        }
        debugTrees() {
            const e = ee.panel.addFolder({
                title: "🌳 Trees"
            });
            e.expanded = !1, e.addBinding(Ee.uPrimaryColor, "value", {
                label: "Primary Leaf Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(Ee.uSecondaryColor, "value", {
                label: "Seconary Leaf Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(Ee.uMixFactor, "value", {
                label: "Mix factor"
            });
        }
    }
    class Un {
        constructor(){
            new En, new Cn, new Tn, new Fn;
        }
    }
    const On = "/textures/hud/compass.webp", kn = "/textures/hud/compassArrow.webp";
    class Gn {
        constructor(){
            const e = document.createElement("div");
            e.classList.add("compass-container");
            const t = document.createElement("img");
            t.setAttribute("alt", "compass"), t.setAttribute("src", On), t.classList.add("compass"), e.appendChild(t);
            const s = document.createElement("img");
            s.setAttribute("alt", "arrow"), s.setAttribute("src", kn), s.classList.add("compass-arrow"), e.appendChild(s), document.body.appendChild(e);
            const o = Y.MAP_SIZE / 2;
            let n = 0;
            F.on("update-throttle-16x", ({ player: a })=>{
                const r = Math.abs(a.position.x) > o, l = Math.abs(a.position.z) > o, h = r || l ? .65 : 0;
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
    const Hn = ()=>Object.freeze({
            MAP_SIZE: 256,
            HALF_MAP_SIZE: 256 / 2,
            KINTOUN_ACTIVATION_THRESHOLD: 2,
            HALF_FLOOR_THICKNESS: .3,
            OUTER_MAP_SIZE: 256 * 3,
            OUTER_HALF_MAP_SIZE: 256 * 1.5
        }), Y = Hn();
    class zn {
        constructor(){
            new Gn, new Ln, new gn, new wn, new Un, new Sn, new pn;
        }
    }
    class Wn {
        pow2 = g(([e = i(0)])=>At(i(2), e));
        packF32 = g(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1), a = i(0)])=>{
            const r = oe(this.pow2(s), 1), l = oe(o, a).div(Ye(n, 1e-20)), d = bt(Fs(l), 0, r), h = this.pow2(t), f = this.pow2(s), S = xe(e.div(h)), y = ve(S, f).mul(h);
            return e.sub(y).add(d.mul(h));
        });
        unpackF32 = g(([e = i(0), t = i(0), s = i(8), o = i(1), n = i(0)])=>{
            const a = this.pow2(t), r = this.pow2(s), l = xe(e.div(a));
            return ve(l, r).mul(o).add(n);
        });
        packUnit = g(([e = i(0), t = i(0), s = i(8), o = i(0)])=>{
            const n = i(1).div(oe(this.pow2(s), 1));
            return this.packF32(e, t, s, o, n, i(0));
        });
        unpackUnit = g(([e = i(0), t = i(0), s = i(8)])=>{
            const o = i(1).div(oe(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, i(0));
        });
        packFlag = g(([e = i(0), t = i(0), s = i(0)])=>this.packF32(e, t, i(1), s, i(1), i(0)));
        unpackFlag = g(([e = i(0), t = i(0)])=>this.unpackF32(e, t, i(1), i(1), i(0)));
        packAngle = g(([e = i(0), t = i(0), s = i(9), o = i(0)])=>{
            const n = oe(this.pow2(s), 1), a = Ae.div(n), r = o.sub(Ae.mul(xe(o.div(Ae))));
            return this.packF32(e, t, s, r, a, i(0));
        });
        unpackAngle = g(([e = i(0), t = i(0), s = i(9)])=>{
            const o = Ae.div(oe(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, i(0));
        });
        packSigned = g(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1)])=>{
            const a = oe(this.pow2(s), 1), r = n.mul(2).div(a), l = n.negate();
            return this.packF32(e, t, s, o, r, l);
        });
        unpackSigned = g(([e = i(0), t = i(0), s = i(8), o = i(1)])=>{
            const n = o.mul(2).div(oe(this.pow2(s), 1)), a = o.negate();
            return this.unpackF32(e, t, s, n, a);
        });
        packUnits = g(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(0), a = i(1)])=>{
            const r = oe(this.pow2(s), 1), l = a.sub(n).div(r);
            return this.packF32(e, t, s, o, l, n);
        });
        unpackUnits = g(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1)])=>{
            const a = n.sub(o).div(oe(this.pow2(s), 1));
            return this.unpackF32(e, t, s, a, o);
        });
        computeMapUvByPosition = g(([e = P(0)])=>e.add(Y.HALF_MAP_SIZE).div(Y.MAP_SIZE));
        computeAtlasUv = g(([e = P(0), t = P(0), s = P(0)])=>s.mul(e).add(t));
        blendRNM = g(([e = M(0), t = M(0)])=>M(e.z.mul(t.x).add(e.x.mul(t.z)), e.z.mul(t.y).add(e.y.mul(t.z)), e.z.mul(t.z).sub(e.x.mul(t.x).add(e.y.mul(t.y)))).normalize());
        blendUDN = g(([e = M(0), t = M(0)])=>M(e.xy.add(t.xy), e.z.mul(t.z)).normalize());
    }
    const v = new Wn, Vn = ()=>({
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
        }), E = Vn();
    class Zn {
        mesh;
        rigidBody;
        smoothedCameraPosition = new T;
        desiredCameraPosition = new T;
        smoothedCameraTarget = new T;
        desiredTargetPosition = new T;
        yawInRadians = 0;
        prevYawInRadians = -1;
        yawQuaternion = new Us;
        newLinVel = new T;
        newAngVel = new T;
        torqueAxis = new T;
        forwardVec = new T;
        isOnGround = !1;
        jumpCount = 0;
        wasJumpHeld = !1;
        jumpBufferTimer = 0;
        rayOrigin = new T;
        ray = new Vs(this.rayOrigin, E.DOWN);
        constructor(){
            this.mesh = this.createCharacterMesh(), L.scene.add(this.mesh), Je.setTarget(this.mesh), this.rigidBody = B.world.createRigidBody(this.createRigidBodyDesc()), B.world.createCollider(this.createColliderDesc(), this.rigidBody), F.on("update", this.update.bind(this)), F.on("update-throttle-64x", this.resetPlayerPosition.bind(this)), this.debugPlayer();
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
            }, !1), this.rigidBody.setTranslation(E.PLAYER_INITIAL_POSITION, !0), this.mesh.position.copy(E.PLAYER_INITIAL_POSITION));
        }
        debugPlayer() {
            const e = ee.panel.addFolder({
                title: "🪩 Player",
                expanded: !1
            });
            e.addBinding(E.CAMERA_OFFSET, "y", {
                label: "Main camera height"
            }), e.addBinding(E.CAMERA_OFFSET, "z", {
                label: "Main camera distance"
            });
        }
        createCharacterMesh() {
            const e = u.realmModel.scene.getObjectByName("player");
            return e.material = new jn, e.castShadow = !0, e.position.copy(E.PLAYER_INITIAL_POSITION), e;
        }
        createRigidBodyDesc() {
            const { x: e, y: t, z: s } = E.PLAYER_INITIAL_POSITION;
            return ie.dynamic().setTranslation(e, t, s).setLinearDamping(E.LINEAR_DAMPING).setAngularDamping(E.ANGULAR_DAMPING).setUserData({
                type: j.Player
            });
        }
        createColliderDesc() {
            return re.ball(E.RADIUS).setRestitution(.6).setFriction(1).setMass(E.MASS).setActiveEvents(Zs.COLLISION_EVENTS);
        }
        update(e) {
            const { clock: t } = e, s = t.getDelta();
            this.prevYawInRadians !== this.yawInRadians && (this.yawQuaternion.setFromAxisAngle(E.UP, this.yawInRadians), this.prevYawInRadians = this.yawInRadians), this.updateVerticalMovement(s), this.updateHorizontalMovement(s), this.updateCameraPosition(s);
        }
        updateVerticalMovement(e) {
            const t = Re.isJumpPressed();
            this.isOnGround = this.checkIfGrounded(), this.isOnGround && (this.jumpCount = 0), t && !this.wasJumpHeld ? this.jumpBufferTimer = E.JUMP_BUFFER_DURATION_IN_SECONDS : this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - e), this.jumpBufferTimer > 0 && this.canJump() && (this.performJump(), this.jumpBufferTimer = 0);
            const o = this.rigidBody.linvel();
            this.handleJumpCut(t, o), this.handleFastFall(e, o, B.world.gravity.y), this.clampUpwardVelocity(o), this.rigidBody.setLinvel(o, !0), this.wasJumpHeld = t;
        }
        checkIfGrounded() {
            this.rayOrigin.copy(this.rigidBody.translation()), this.rayOrigin.y -= E.RADIUS + .01;
            const e = .2, t = B.world.castRay(this.ray, e, !0);
            return t ? t.timeOfImpact * e < .01 : !1;
        }
        canJump() {
            return this.isOnGround ? !0 : this.jumpCount < E.MAX_CONSECUTIVE_JUMPS;
        }
        performJump() {
            this.rigidBody.applyImpulse(E.JUMP_IMPULSE, !0), this.jumpCount += 1;
        }
        handleJumpCut(e, t) {
            !(!e && this.wasJumpHeld) || t.y <= 0 || (t.y *= E.JUMP_CUT_MULTIPLIER);
        }
        handleFastFall(e, t, s) {
            if (t.y >= 0) return;
            const o = E.FALL_MULTIPLIER * Math.abs(s) * e;
            t.y -= o;
        }
        clampUpwardVelocity(e) {
            e.y <= E.MAX_UPWARD_VELOCITY || (e.y = E.MAX_UPWARD_VELOCITY);
        }
        updateHorizontalMovement(e) {
            const t = Re.isForward(), s = Re.isBackward(), o = Re.isLeftward(), n = Re.isRightward(), a = 2;
            o && (this.yawInRadians += a * e), n && (this.yawInRadians -= a * e), this.forwardVec.copy(E.FORWARD).applyQuaternion(this.yawQuaternion), this.torqueAxis.crossVectors(E.UP, this.forwardVec).normalize(), this.newLinVel.copy(this.rigidBody.linvel()), this.newAngVel.copy(this.rigidBody.angvel());
            const r = E.LIN_VEL_STRENGTH * e, l = E.ANG_VEL_STRENGTH * e;
            t && (this.newLinVel.addScaledVector(this.forwardVec, r), this.newAngVel.addScaledVector(this.torqueAxis, l)), s && (this.newLinVel.addScaledVector(this.forwardVec, -r), this.newAngVel.addScaledVector(this.torqueAxis, -l)), this.rigidBody.setLinvel(this.newLinVel, !0), this.rigidBody.setAngvel(this.newAngVel, !0), this.syncMeshWithBody();
        }
        syncMeshWithBody() {
            this.mesh.position.copy(this.rigidBody.translation()), this.mesh.quaternion.copy(this.rigidBody.rotation());
        }
        updateCameraPosition(e) {
            this.desiredCameraPosition.copy(E.CAMERA_OFFSET).applyQuaternion(this.yawQuaternion).add(this.mesh.position);
            const t = E.CAMERA_LERP_FACTOR * e;
            this.smoothedCameraPosition.lerp(this.desiredCameraPosition, t), this.desiredTargetPosition.copy(this.mesh.position), this.desiredTargetPosition.y += 1, this.smoothedCameraTarget.lerp(this.desiredTargetPosition, t), L.playerCamera.position.copy(this.smoothedCameraPosition), L.playerCamera.lookAt(this.smoothedCameraTarget);
        }
        get position() {
            return this.mesh.position;
        }
        get yaw() {
            return this.yawInRadians;
        }
    }
    class jn extends J {
        constructor(){
            super(), this.createMaterial();
        }
        createMaterial() {
            this.flatShading = !1, this.castShadowNode = M(.6);
            const e = v.computeMapUvByPosition(ue.xz), t = yt(e), s = Je.getTerrainShadowFactor(t), o = I(u.footballDiffuse, R()).mul(1.5);
            this.colorNode = o.mul(s);
        }
    }
    const qn = [
        30,
        60,
        120,
        144,
        160,
        165,
        170,
        180,
        240
    ], Kn = (c)=>qn.reduce((e, t)=>Math.abs(t - c) < Math.abs(e - c) ? t : e), Yn = async ()=>new Promise((c)=>{
            const e = [];
            let t = performance.now(), s = t;
            function o(n) {
                if (e.push(n - t), t = n, n - s < 1e3) requestAnimationFrame(o);
                else {
                    e.sort((d, h)=>d - h);
                    const r = 1e3 / (e[Math.floor(e.length / 2)] || 16.667), l = Kn(r);
                    c(l);
                }
            }
            requestAnimationFrame(o);
        });
    class Jn {
        player;
        IS_CAP_FPS_ENABLED = !1;
        config = {
            halvenFPS: !1
        };
        constructor(){
            this.player = new Zn, new zn;
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
            const e = await Yn();
            this.config.halvenFPS = e > 120;
        }
        onResize() {
            const e = this.getSizes();
            F.emit("resize", e), this.updateRefreshRate();
        }
        async startLoop() {
            await this.updateRefreshRate(), this.debugGame();
            const t = {
                clock: new Os(!0),
                player: this.player
            };
            let s = !1;
            const o = ()=>{
                B.update(), this.config.halvenFPS ? s = !s : s = !1, (s || !this.config.halvenFPS) && (F.emit("update", t), he.renderAsync());
            }, n = qs(this.onResize.bind(this), 300);
            this.onResize(), new ResizeObserver(n).observe(document.body), he.renderer.setAnimationLoop(o);
        }
    }
    class Xn {
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
                n.stopPropagation(), await ne.toggleMute();
                const a = ne.isMute ? o : s;
                t.setAttribute("d", a);
            }), F.on("audio-ready", ()=>{
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
    const $n = new Xn, Qn = new qo;
    Qn.initAsync().then(()=>{
        $n.init(), new Jn().startLoop();
    });
});
