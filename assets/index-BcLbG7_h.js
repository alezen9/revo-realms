import { L as Kt, T as qt, D as Yt, G as Jt, C as Xt, S as ye, P as $t, p as Qt, b as es, r as ts, W as ss, a as os, A as ns, c as as, d as is, e as rs, f as ls, g as cs, h as ds, V as D, _ as us, M as Je, i as hs, j as ut, k as ms, l as W, H as ps, m as fs, O as gs, F as ws, n as f, t as x, v as E, o as ys, q as ke, I as pe, s as At, u as Te, w as k, x as A, y as L, z as C, B as ee, E as i, J as be, K as j, N as fe, Q as xt, R as O, U as Mt, X as bs, Y as Ss, Z as As, $ as xs, a0 as R, a1 as I, a2 as ve, a3 as Ms, a4 as $, a5 as ht, a6 as Ls, a7 as p, a8 as Qe, a9 as re, aa as Ge, ab as Le, ac as Lt, ad as mt, ae as Ke, af as pt, ag as Is, ah as _s, ai as qe, aj as X, ak as ft, al as Ps, am as Ee, an as Ye, ao as Oe, ap as Es, aq as Xe, ar as Ts, as as Re, at as Fe, au as Se, av as $e, aw as vs, ax as gt, ay as Me, az as It, aA as wt, aB as Ds, aC as Bs, aD as ae, aE as Cs, aF as Ns, aG as Rs } from "./three-oEvGoOXy.js";
import { P as Fs } from "./tweakpane-SMt8byX-.js";
import { S as yt } from "./stats-gl-C2M3amu4.js";
import { e as Us } from "./tseep-zr-hWxBz.js";
import { World as Os, EventQueue as ks, RigidBodyDesc as le, ColliderDesc as ce, HeightFieldFlags as Gs, Ray as Hs, ActiveEvents as zs, __tla as __tla_0 } from "./@dimforge-CqaeYUkE.js";
import { n as Ws } from "./nipplejs-BxsX8Mt3.js";
import { d as Vs } from "./lodash-es-BMmXVQ06.js";
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
    const Zs = "/models/realm.glb", js = "/textures/environment/px.webp", Ks = "/textures/environment/nx.webp", qs = "/textures/environment/py.webp", Ys = "/textures/environment/ny.webp", Js = "/textures/environment/pz.webp", Xs = "/textures/environment/nz.webp", $s = "/textures/noise/noise.webp", Qs = "/textures/realm/terrainType.webp", eo = "/textures/realm/sandNormal.webp", to = "/textures/realm/grassNormal.webp", so = "/textures/realm/grassDiffuse.webp", oo = "/textures/realm/waterNormal.webp", no = "/textures/realm/terrainShadowAo.webp", ao = "/textures/realm/waterLiliesDiffuse.webp", io = "/textures/realm/waterLiliesAlpha.webp", ro = "/textures/realm/flowerAtlas.webp", lo = "/textures/realm/stoneAtlas.webp", co = "/textures/realm/barkDiffuse.webp", uo = "/textures/realm/barkNormal.webp", ho = "/textures/realm/canopyDiffuse.webp", mo = "/textures/realm/canopyNormal.webp", po = "/textures/realm/axeDiffuse.webp", fo = "/textures/realm/axeEmissive.webp", go = "/textures/realm/trunkDiffuse.webp", wo = "/textures/realm/trunkNormal.webp", yo = "/textures/realm/onePieceAtlas.webp", bo = "/textures/realm/kunaiDiffuse.webp", So = "/textures/realm/kunaiMR.webp", Ao = "/textures/realm/campfireDiffuse.webp", xo = "/textures/realm/fireSprites.webp", Mo = "/textures/realm/footballDiffuse.webp", Lo = "/textures/realm/leafDiffuse.webp", Io = {
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
    }, _o = {
        stones: Io
    };
    class Po {
        manager;
        constructor(){
            this.manager = this.createLoadingManager();
        }
        onErrorLog(e) {
            console.log("There was an error loading " + e);
        }
        createLoadingManager() {
            const e = new Kt;
            return e.onError = this.onErrorLog, e;
        }
    }
    const _t = new Po;
    class Eo {
        atlasesCoords = _o;
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
            this.textureLoader = new qt(e);
            const t = new Yt;
            t.setDecoderPath("/draco/"), this.gltfLoader = new Jt(e), this.gltfLoader.setDRACOLoader(t), this.cubeTextureLoader = new Xt(e);
        }
        async initAsync() {
            const e = await Promise.all([
                this.gltfLoader.loadAsync(Zs),
                u.cubeTextureLoader.loadAsync([
                    js,
                    Ks,
                    qs,
                    Ys,
                    Js,
                    Xs
                ]),
                this.textureLoader.loadAsync($s),
                this.textureLoader.loadAsync(Qs),
                this.textureLoader.loadAsync(so),
                this.textureLoader.loadAsync(to),
                this.textureLoader.loadAsync(eo),
                this.textureLoader.loadAsync(oo),
                this.textureLoader.loadAsync(no),
                this.textureLoader.loadAsync(ao),
                this.textureLoader.loadAsync(io),
                this.textureLoader.loadAsync(ro),
                this.textureLoader.loadAsync(lo),
                this.textureLoader.loadAsync(ho),
                this.textureLoader.loadAsync(mo),
                this.textureLoader.loadAsync(co),
                this.textureLoader.loadAsync(uo),
                this.textureLoader.loadAsync(po),
                this.textureLoader.loadAsync(fo),
                this.textureLoader.loadAsync(go),
                this.textureLoader.loadAsync(wo),
                this.textureLoader.loadAsync(yo),
                this.textureLoader.loadAsync(bo),
                this.textureLoader.loadAsync(So),
                this.textureLoader.loadAsync(Ao),
                this.textureLoader.loadAsync(xo),
                this.textureLoader.loadAsync(Mo),
                this.textureLoader.loadAsync(Lo)
            ]);
            this.realmModel = e[0], this.envMapTexture = e[1], this.envMapTexture.colorSpace = ye, this.noiseTexture = e[2], this.terrainTypeMap = e[3], this.terrainTypeMap.flipY = !1, this.grassDiffuse = e[4], this.grassNormal = e[5], this.sandNormal = e[6], this.waterNormal = e[7], this.terrainShadowAo = e[8], this.terrainShadowAo.flipY = !1, this.waterLiliesTexture = e[9], this.waterLiliesTexture.flipY = !1, this.waterLiliesAlphaTexture = e[10], this.waterLiliesAlphaTexture.flipY = !1, this.flowerAtlas = e[11], this.flowerAtlas.flipY = !1, this.stoneAtlas = e[12], this.stoneAtlas.flipY = !1, this.canopyDiffuse = e[13], this.canopyDiffuse.flipY = !1, this.canopyNormal = e[14], this.canopyNormal.flipY = !1, this.barkDiffuse = e[15], this.barkDiffuse.flipY = !1, this.barkDiffuse.colorSpace = ye, this.barkNormal = e[16], this.barkNormal.flipY = !1, this.axeDiffuse = e[17], this.axeDiffuse.flipY = !1, this.axeEmissive = e[18], this.axeEmissive.flipY = !1, this.trunkDiffuse = e[19], this.trunkDiffuse.flipY = !1, this.trunkDiffuse.colorSpace = ye, this.trunkNormal = e[20], this.trunkNormal.flipY = !1, this.onePieceAtlas = e[21], this.onePieceAtlas.flipY = !1, this.kunaiDiffuse = e[22], this.kunaiDiffuse.flipY = !1, this.kunaiDiffuse.colorSpace = ye, this.kunaiMR = e[23], this.kunaiMR.flipY = !1, this.campfireDiffuse = e[24], this.campfireDiffuse.flipY = !1, this.campfireDiffuse.colorSpace = ye, this.fireSprites = e[25], this.footballDiffuse = e[26], this.footballDiffuse.colorSpace = ye, this.leafDiffuse = e[27], this.leafDiffuse.colorSpace = ye;
        }
    }
    const u = new Eo(_t.manager);
    class To {
        panel;
        constructor(){
            this.panel = new Fs({
                title: "Revo Realms"
            }), this.panel.hidden = !0, this.panel.element.parentElement?.classList.add("debug-panel");
        }
        setVisibility(e) {
            this.panel.hidden = !e;
        }
    }
    const te = new To;
    class vo {
        stats;
        lastSecond = performance.now();
        drawCallsPanel;
        trianglesPanel;
        constructor(e){
            const t = new yt({
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
            const o = this.stats.addPanel(new yt.Panel(e, t, s));
            return o.update = (n)=>{
                const a = o.canvas.getContext("2d");
                if (!a) return;
                const { width: r, height: l } = o.canvas;
                a.clearRect(0, 0, r, l), a.fillStyle = s, a.fillRect(0, 0, r, l), a.fillStyle = t;
                const d = a.font;
                a.textAlign = "left", a.textBaseline = "top", a.fillText(o.name, 4, 4), a.font = "bold 20px Arial", a.textAlign = "center", a.textBaseline = "middle";
                const h = Do.format(n);
                a.fillText(`${h}`, r / 2, l / 1.65), a.font = d;
            }, o;
        }
        updateCustomPanels() {
            const e = performance.now();
            if (e - this.lastSecond < 1e3) return;
            const { render: t } = ge.renderer.info;
            this.drawCallsPanel.update(t.drawCalls, 0), this.trianglesPanel.update(t.triangles, 0), this.lastSecond = e;
        }
    }
    const Do = new Intl.NumberFormat("en-US", {
        notation: "compact"
    }), Bo = [
        2,
        4,
        16,
        64
    ], F = new Us.EventEmitter, Co = (c)=>{
        let e = 0;
        F.on("update", (t)=>{
            e++, !(e < c) && (e = 0, F.emit(`update-throttle-${c}x`, t));
        });
    };
    Bo.forEach((c)=>Co(c));
    class No extends $t {
        scenePass;
        debugFolder = te.panel.addFolder({
            title: "⭐️ Postprocessing",
            expanded: !1
        });
        constructor(e){
            super(e), this.scenePass = Qt(M.scene, M.renderCamera);
            const t = this.makeGraph();
            this.outputNode = t, F.on("camera-changed", ()=>{
                this.scenePass.camera = M.renderCamera, this.scenePass.needsUpdate = !0;
            });
        }
        makeGraph() {
            this.outputColorTransform = !1;
            const e = this.scenePass.getTextureNode(), t = es(e, .25, .15, 1);
            t.smoothWidth.value = .04, t._nMips = 2, this.debugFolder.addBinding(t.strength, "value", {
                label: "Bloom strength"
            }), this.debugFolder.addBinding(t.threshold, "value", {
                label: "Bloom threshold"
            });
            const s = e.add(t);
            return ts(s);
        }
    }
    class Ro {
        renderer;
        canvas;
        prevFrame = null;
        monitoringManager;
        postprocessingManager;
        IS_POSTPROCESSING_ENABLED = !0;
        IS_MONITORING_ENABLED = !1;
        IS_DEBUGGING_ENABLED = !1;
        constructor(){
            const e = document.createElement("canvas");
            e.classList.add("revo-realms"), document.body.appendChild(e), this.canvas = e;
            const t = new ss({
                canvas: e,
                antialias: !0,
                trackTimestamp: this.IS_MONITORING_ENABLED,
                powerPreference: "high-performance",
                stencil: !1,
                depth: !0
            });
            t.shadowMap.enabled = !0, t.shadowMap.type = os, t.toneMapping = ns, t.setClearColor(0, 1), t.toneMappingExposure = 1.5, this.renderer = t, this.monitoringManager = new vo(this.IS_MONITORING_ENABLED), te.setVisibility(this.IS_DEBUGGING_ENABLED), F.on("resize", (s)=>{
                const o = Math.max(this.IS_POSTPROCESSING_ENABLED ? s.dpr * .75 : s.dpr, 1);
                t.setSize(s.width, s.height), t.setPixelRatio(o);
            });
        }
        async init() {
            M.init(), this.postprocessingManager = new No(this.renderer), this.IS_MONITORING_ENABLED && await this.monitoringManager.stats.init(this.renderer);
        }
        async renderSceneAsync() {
            return this.IS_POSTPROCESSING_ENABLED ? this.postprocessingManager.renderAsync() : this.renderer.renderAsync(M.scene, M.renderCamera);
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
    const ge = new Ro;
    class Fo {
        scene;
        playerCamera;
        renderCamera;
        cameraHelper;
        controls;
        orbitControlsCamera;
        constructor(){
            const e = new as;
            this.scene = e;
            const t = window.innerWidth, s = window.innerHeight, o = t / s, n = new is(45, o, .01, 150);
            n.position.set(0, 5, 10), this.playerCamera = n, e.add(n), this.renderCamera = n, F.on("resize", (a)=>{
                this.playerCamera.aspect = a.aspect, this.playerCamera.updateProjectionMatrix();
            });
        }
        debugScene() {
            if (!this.controls) return;
            te.panel.addFolder({
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
    const M = new Fo, Uo = "/audio/ambient/ambient.mp3", Oo = "/audio/ambient/lake.mp3", ko = "/audio/collisions/hitWood.mp3", Go = "/audio/collisions/hitStone.mp3";
    class Ho {
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
            this.audioLoader = new rs(e), this.audioListener = new ls, M.playerCamera.add(this.audioListener);
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
            const o = new cs(this.audioListener);
            return o.setBuffer(e), o.setVolume(0), o.setLoop(s), o.userData.originalVolume = t, this.files.push(o), o;
        }
        newPositionalAudio(e, t = 1, s = !1, o = 1) {
            const n = new ds(this.audioListener);
            return n.setBuffer(e), n.setVolume(0), n.setLoop(s), n.userData.originalVolume = t, n.setMaxDistance(o), this.files.push(n), n;
        }
        async initAsync() {
            const e = await Promise.all([
                this.audioLoader.loadAsync(Uo),
                this.audioLoader.loadAsync(Oo),
                this.audioLoader.loadAsync(ko),
                this.audioLoader.loadAsync(Go)
            ]);
            this.ambient = this.newAudio(e[0], .05, !0), this.lake = this.newPositionalAudio(e[1], 1, !0, 10), this.hitWood = this.newAudio(e[2], 0, !1), this.hitStone = this.newAudio(e[3], 0, !1), this.isReady = !0, F.emit("audio-ready");
        }
    }
    const ie = new Ho(_t.manager);
    var K = ((c)=>(c.Player = "Player", c.Terrain = "Terrain", c.Wood = "Wood", c.Stone = "Stone", c))(K || {});
    const zo = ()=>({
            minImpactSq: 5,
            maxImpactSq: 400,
            minImpactVolume: .01,
            maxImpactVolume: .25
        }), me = zo();
    class Wo {
        world;
        eventQueue;
        IS_DEBUGGING_ENABLED = !1;
        dummyVectorLinVel = new D;
        debugMesh;
        constructor(){
            this.IS_DEBUGGING_ENABLED && (this.debugMesh = this.createDebugMesh(), M.scene.add(this.debugMesh));
        }
        async initAsync() {
            return us(()=>import("./@dimforge-CqaeYUkE.js").then(async (m)=>{
                    await m.__tla;
                    return m;
                }), []).then(()=>{
                this.world = new Os({
                    x: 0,
                    y: -9.81,
                    z: 0
                }), this.eventQueue = new ks(!0);
            });
        }
        getColliderName(e) {
            return e?.parent?.()?.userData?.type;
        }
        impactToVolume(e) {
            const t = Je.mapLinear(e, me.minImpactSq, me.maxImpactSq, me.minImpactVolume, me.maxImpactVolume);
            return Je.clamp(t, me.minImpactVolume, me.maxImpactVolume);
        }
        onCollisionWithWood(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < me.minImpactSq) return;
            const o = this.impactToVolume(s);
            ie.hitWood.setVolume(o), ie.hitWood.play();
        }
        onCollisionWithStone(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < me.minImpactSq) return;
            const o = this.impactToVolume(s);
            ie.hitStone.setVolume(o), ie.hitStone.play();
        }
        handleCollisionSounds() {
            this.eventQueue.drainCollisionEvents((e, t, s)=>{
                if (ie.isMute) return;
                const o = this.world.getCollider(e), n = this.world.getCollider(t);
                if (!(this.getColliderName(o) === K.Player) || !s) return;
                switch(this.getColliderName(n)){
                    case K.Wood:
                        this.onCollisionWithWood(o);
                        break;
                    case K.Stone:
                        this.onCollisionWithStone(o);
                        break;
                }
            });
        }
        createDebugMesh() {
            return new hs(new ut, new ms);
        }
        updateDebugMesh() {
            if (!this.debugMesh) return;
            const e = this.world.debugRender();
            this.debugMesh.geometry.dispose(), this.debugMesh.geometry = new ut, this.debugMesh.geometry.setPositions(e.vertices), this.debugMesh.computeLineDistances();
        }
        update() {
            this.updateDebugMesh(), this.world.step(this.eventQueue), ie.isReady && this.handleCollisionSounds();
        }
    }
    const B = new Wo;
    class Vo {
        constructor(){
            ("ontouchstart" in window || navigator.maxTouchPoints > 0) && document.body.classList.add("is-touch-device");
        }
        async initAsync() {
            await Promise.all([
                B.initAsync(),
                u.initAsync()
            ]), await ge.init(), ie.initAsync();
        }
    }
    class Zo {
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
    const de = new Zo;
    class jo {
        isActive = !1;
        direction = {
            x: 0,
            y: 0
        };
        constructor(){
            const e = document.createElement("div");
            e.classList.add("joystick-zone"), document.body.appendChild(e);
            const t = Ws.create({
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
    const Ue = new jo;
    class Ko {
        isForward() {
            return de.isKeyPressed("KeyW") || de.isKeyPressed("ArrowUp") || Ue.isForward();
        }
        isBackward() {
            return de.isKeyPressed("KeyS") || de.isKeyPressed("ArrowDown") || Ue.isBackward();
        }
        isLeftward() {
            return de.isKeyPressed("KeyA") || de.isKeyPressed("ArrowLeft") || Ue.isLeftward();
        }
        isRightward() {
            return de.isKeyPressed("KeyD") || de.isKeyPressed("ArrowRight") || Ue.isRightward();
        }
        isJumpPressed() {
            return de.isKeyPressed("Space");
        }
    }
    const Pe = new Ko, q = {
        LIGHT_POSITION_OFFSET: new D(10, 10, 10),
        directionalColor: new W(.85, .75, .7),
        directionalIntensity: .8,
        hemiSkyColor: new W(.6, .4, .5),
        hemiGroundColor: new W(.3, .2, .2),
        fogColor: new W(.29, .08, 0),
        fogDensity: .0046
    };
    class qo {
        directionalLight;
        hemisphereLight;
        fog;
        sunDirection = q.LIGHT_POSITION_OFFSET.clone().normalize().negate();
        constructor(){
            this.directionalLight = this.setupDirectionalLighting(), M.scene.add(this.directionalLight), this.hemisphereLight = this.setupHemisphereLight(), M.scene.add(this.hemisphereLight), this.fog = this.setupFog(), F.on("update", ({ player: e })=>{
                this.directionalLight.position.copy(e.position).add(q.LIGHT_POSITION_OFFSET);
            }), this.debugLight();
        }
        setupHemisphereLight() {
            const e = new ps;
            return e.color.copy(q.hemiSkyColor), e.groundColor.copy(q.hemiGroundColor), e.intensity = .3, e.position.copy(q.LIGHT_POSITION_OFFSET), e;
        }
        setupDirectionalLighting() {
            const e = new fs;
            e.intensity = q.directionalIntensity, e.color.copy(q.directionalColor), e.position.copy(q.LIGHT_POSITION_OFFSET), e.target = new gs, e.castShadow = !0, e.shadow.mapSize.set(64, 64);
            const t = 1;
            return e.shadow.intensity = .85, e.shadow.camera.left = -t, e.shadow.camera.right = t, e.shadow.camera.top = t, e.shadow.camera.bottom = -t, e.shadow.camera.near = .01, e.shadow.camera.far = 30, e.shadow.normalBias = .1, e.shadow.bias = -.001, e;
        }
        setupFog() {
            return new ws(q.fogColor, q.fogDensity);
        }
        getTerrainShadowFactor = f(([e = E(0)])=>x(u.terrainShadowAo, e).r);
        debugLight() {
            const e = te.panel.addFolder({
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
    const et = new qo, Pt = new ys, bt = new ke;
    F.on("update-throttle-16x", ()=>{
        bt.multiplyMatrices(M.renderCamera.projectionMatrix, M.renderCamera.matrixWorldInverse), Pt.setFromProjectionMatrix(bt);
    });
    const Yo = (c)=>(c.geometry.boundingSphere || c.geometry.computeBoundingSphere(), Pt.intersectsObject(c)), Jo = f(([c])=>{});
    class Xo extends pe {
        mainBuffer;
        constructor(e){
            let t, s, o = Jo;
            switch(super(new At, void 0, e.count), this.mainBuffer = Te(e.count, "vec4"), this.mainBuffer.setPBO(!0), e.preset){
                case "custom":
                    t = e.material, s = e.onInit, o = e.onUpdate;
                    break;
                case "fire":
                    const r = $o(e, this.mainBuffer);
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
                Yo(this) && ge.renderer.computeAsync(n);
            });
        }
    }
    const $o = (c, e)=>{
        const { speed: t = .5, radius: s = 1, height: o = 1, lifetime: n = 1, scale: a = 1, detail: r = 4, coneFactor: l = 1 } = c, d = o * 1.5, h = n * .75, m = Te(c.count, "float"), y = .95, w = f(([ot])=>{
            const Ve = k(A.add(12345)), Ae = m.element(A), Ce = L(y, Ve);
            Ae.assign(Ce);
        }), b = f(([ot])=>{
            const Ve = ot.element(A), Ae = m.element(A), Ce = k(A), Ze = C(n, h, Ae), Ne = ee.mul(t).add(Ce.mul(Ze)).mod(Ze).div(Ze), je = i(1).sub(i(1).sub(Ne).pow(2)), nt = C(o, d, Ae), at = je.mul(nt), it = k(A.add(7890)).mul(be), Bt = k(A.add(5678)), Ct = i(1).sub(i(1).sub(Bt).pow(2)), Nt = i(1).sub(je.mul(l)), Rt = j(0, .35, je), Ft = fe(ee.mul(.5)).mul(.05).add(1), Ut = C(s * .25, s, Rt).mul(Nt).mul(Ft), Ot = Ct.mul(Ut), kt = L(.5, it).mul(2).sub(1), rt = it.add(Ne.mul(be).mul(.05).mul(kt)), Gt = C(1, .85, Ae), lt = Ce.sub(.5).mul(.05).mul(Ne), Ht = j(0, .75, Ne).mul(Ae), ct = Ot.add(Ht.mul(Gt)), zt = xt(rt.add(lt)).mul(ct), Wt = fe(rt.add(lt)).mul(ct), dt = at.div(nt), Vt = j(0, .5, dt), Zt = i(1).sub(j(.5, 1, dt)), jt = Vt.mul(Zt);
            Ve.assign(O(zt, at, Wt, jt));
        }), S = new Mt;
        S.precision = "lowp", S.transparent = !0, S.depthWrite = !1, S.blending = bs, S.blendEquation = Ss, S.blendSrc = As, S.blendDst = xs;
        const U = e.element(A), z = m.element(A), G = k(A.add(9234)), H = k(A.add(33.87));
        S.positionNode = U.xyz;
        const V = i(1).sub(z.mul(.85)), se = H.clamp(.25, 1);
        S.scaleNode = se.mul(U.w).mul(V).mul(a);
        const ue = L(.5, G).mul(.5), Z = L(.5, H).mul(.5), he = R().mul(.5).add(E(ue, Z)), ne = x(u.fireSprites, he, r), Q = I(.72, .62, .08).mul(2).toConst(), Y = I(1, .1, 0).mul(4).toConst(), we = I(0).toConst(), Ie = C(o, d, z), _e = j(0, 1, ve.y.div(Ie)).pow(2), He = j(0, .25, _e), ze = C(Q, Y, He), De = j(.9, 1, _e), Be = C(ze, we, De), We = i(1).sub(j(0, .85, _e)), vt = L(.65, H).mul(We), st = i(.5).toConst(), Dt = ne.a.mul(vt).mul(st);
        return S.colorNode = C(Be, Y, z).mul(Dt).mul(1.5), S.alphaTest = .1, S.opacityNode = U.w.mul(ne.a).mul(st), {
            material: S,
            onInit: w,
            onUpdate: b
        };
    };
    class Qo {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("campfire");
            e.material = new Ms({
                map: u.campfireDiffuse
            });
            const t = new Xo({
                preset: "fire",
                count: 512,
                speed: .65,
                radius: .75,
                workGroupSize: 256
            });
            t.position.copy(e.position).setY(.25), M.scene.add(e, t);
            const s = le.fixed().setTranslation(...e.position.toArray()).setRotation(e.quaternion).setUserData({
                type: K.Stone
            }), o = B.world.createRigidBody(s);
            e.geometry.computeBoundingSphere();
            const { radius: n } = e.geometry.boundingSphere, a = ce.ball(n).setRestitution(.75);
            B.world.createCollider(a, o);
        }
    }
    class en extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = x(u.trunkDiffuse, R());
            this.colorNode = e.mul(1.75), this.normalMap = u.trunkNormal;
        }
    }
    class tn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.map = u.axeDiffuse, this.emissiveMap = u.axeEmissive, this.emissiveIntensity = 35, this.emissive = new W("lightblue");
        }
    }
    class sn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("kratos_axe");
            e.material = new tn;
            const t = u.realmModel.scene.getObjectByName("tree_trunk");
            t.material = new en, M.scene.add(e, t);
            const s = u.realmModel.scene.getObjectByName("axe_collider"), o = le.fixed().setTranslation(...s.position.toArray()).setRotation(s.quaternion).setUserData({
                type: K.Wood
            }), n = B.world.createRigidBody(o), a = s.geometry.boundingBox.max, r = ce.cuboid(a.x, a.y, a.z).setRestitution(.75);
            B.world.createCollider(r, n);
            const l = u.realmModel.scene.getObjectByName("trunk_collider"), { x: d, y: h } = l.geometry.boundingBox.max, m = le.fixed().setTranslation(...l.position.toArray()).setRotation(l.quaternion).setUserData({
                type: K.Wood
            }), y = B.world.createRigidBody(m), w = d, b = h / 2, S = ce.capsule(b, w).setRestitution(.75);
            B.world.createCollider(S, y);
        }
    }
    class on {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("jojo_mask");
            e.material = new nn;
            const t = u.realmModel.scene.children.filter((n)=>n.name.startsWith("jojo_symbol")), s = new an, o = new pe(t[0].geometry, s, t.length);
            for(let n = 0; n < t.length; n++){
                const a = t[n];
                o.setMatrixAt(n, a.matrix);
            }
            M.scene.add(e, o);
        }
    }
    class nn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const { stoneDiffuse: e } = u.atlasesCoords.stones, t = v.computeAtlasUv(E(...e.scale), E(...e.offset), R()), s = x(u.stoneAtlas, t);
            this.colorNode = s;
        }
    }
    class an extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const e = ht("#eb5694"), t = ht("#9642D3");
            this.colorNode = C(t, e, R().y.mul(.5)).mul(.45);
            const s = ee.mul(20), o = fe(s.add(A)), n = L(0, o).mul(.25);
            this.positionNode = ve.add(n);
        }
    }
    class rn extends Ls {
        uScale = p(1);
        constructor(){
            super();
            const e = x(u.kunaiDiffuse, R());
            this.colorNode = e.mul(5);
            const t = x(u.kunaiMR, R());
            this.metalnessNode = t.b.mul(.75), this.roughnessNode = t.g;
        }
    }
    class ln {
        constructor(){
            const e = u.realmModel.scene.children.filter(({ name: l })=>l.startsWith("kunai")), t = u.realmModel.scene.getObjectByName("base_kunai"), s = new rn, o = new pe(t.geometry, s, e.length), { x: n, y: a, z: r } = t.geometry.boundingBox.max;
            e.forEach((l, d)=>{
                o.setMatrixAt(d, l.matrix);
                const h = le.fixed().setTranslation(...l.position.toArray()).setRotation(l.quaternion).setUserData({
                    type: K.Wood
                }), m = B.world.createRigidBody(h), y = ce.cuboid(n, a, r).setRestitution(.75);
                B.world.createCollider(y, m);
            }), M.scene.add(o);
        }
    }
    class cn extends $ {
        constructor(){
            super(), this.map = u.onePieceAtlas, this.side = Qe;
        }
    }
    class dn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("one_piece_posters");
            e.material = new cn, M.scene.add(e);
        }
    }
    class un {
        constructor(){
            new sn, new dn, new on, new ln, new Qo;
        }
    }
    const Et = {
        uBaseColor: p(new W),
        uRandom: p(0)
    };
    class hn extends $ {
        _uniforms;
        constructor(e){
            super(), this._uniforms = {
                ...Et,
                ...e
            }, this.createMaterial();
        }
        setRandomSeed(e) {
            this._uniforms.uRandom.value = e;
        }
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = re(R().mul(2).add(this._uniforms.uRandom)), { stoneDiffuse: t, stoneNormalAo: s } = u.atlasesCoords.stones, o = v.computeAtlasUv(E(...t.scale), E(...t.offset), e), n = x(u.stoneAtlas, o);
            this.colorNode = n.mul(1.5);
            const a = v.computeAtlasUv(E(...s.scale), E(...s.offset), e), r = x(u.stoneAtlas, a);
            this.normalNode = new Ge(r.rgb, i(.5)), this.aoNode = r.a;
        }
    }
    class mn {
        uniforms = Et;
        constructor(){
            const e = new hn(this.uniforms), t = u.realmModel.scene.children.filter(({ name: o })=>o.endsWith("_monument"));
            t.forEach((o, n)=>{
                const a = Je.seededRandom(n);
                o.material = e, o.receiveShadow = !0, o.onBeforeRender = (r, l, d, h, m)=>{
                    m.setRandomSeed(a);
                };
            }), M.scene.add(...t), u.realmModel.scene.children.filter(({ name: o })=>o.startsWith("monument_collider")).forEach((o)=>{
                const n = le.fixed().setTranslation(...o.position.toArray()).setRotation(o.quaternion).setUserData({
                    type: K.Stone
                }), a = B.world.createRigidBody(n), r = .5 * o.scale.x, l = .5 * o.scale.y, d = .5 * o.scale.z, h = ce.cuboid(r, l, d).setRestitution(.75);
                B.world.createCollider(h, a);
            }), this.debugMonuments();
        }
        debugMonuments() {
            const e = te.panel.addFolder({
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
    const _ = {
        uUvScale: p(1.7),
        uRefractionStrength: p(.01),
        uWaterColor: p(new W(0, .09, .09)),
        uFresnelScale: p(.075),
        uSpeed: p(.1),
        uNoiseScrollDir: p(new Le(.1, 0)),
        uShiness: p(700),
        uMinDist: p(10),
        uMaxDist: p(50),
        uFromSunDir: p(new D(0, -1, 0)),
        uTworld: p(new D(1, 0, 0)),
        uBworld: p(new D(0, 0, -1)),
        uNworld: p(new D(0, 1, 0)),
        uHighlightsFactor: p(2.5)
    };
    class pn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("water");
            e.material = new fn, e.renderOrder = 100, _.uFromSunDir.value.copy(et.sunDirection), _.uTworld.value.applyNormalMatrix(e.normalMatrix).normalize(), _.uBworld.value.applyNormalMatrix(e.normalMatrix).normalize(), _.uNworld.value.applyNormalMatrix(e.normalMatrix).normalize();
            const s = e.geometry.boundingSphere;
            s.radius = s.radius * .75, M.scene.add(e), F.on("audio-ready", ()=>{
                e.add(ie.lake);
            });
        }
    }
    class fn extends Lt {
        constructor(){
            super(), this.createMaterial(), this.debugWater();
        }
        debugWater() {
            const e = te.panel.addFolder({
                title: "🌊 Water",
                expanded: !1
            });
            e.addBinding(_.uSpeed, "value", {
                label: "Speed"
            }), e.addBinding(_.uUvScale, "value", {
                label: "UV scale"
            }), e.addBinding(_.uRefractionStrength, "value", {
                label: "Refraction strength"
            }), e.addBinding(_.uShiness, "value", {
                label: "Shiness"
            }), e.addBinding(_.uFresnelScale, "value", {
                label: "Fresnel scale"
            }), e.addBinding(_.uMinDist, "value", {
                label: "Opacity min dist"
            }), e.addBinding(_.uMaxDist, "value", {
                label: "Opacity max dist"
            }), e.addBinding(_.uWaterColor, "value", {
                label: "Water color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(_.uHighlightsFactor, "value", {
                label: "Highlights glow factor"
            });
        }
        createMaterial() {
            this.precision = "lowp";
            const e = ee.mul(_.uSpeed), t = _.uNoiseScrollDir.mul(e), s = R().add(t).mul(_.uUvScale.mul(1.7)).fract(), o = x(u.waterNormal, s).mul(2).sub(1), n = R().sub(t).mul(_.uUvScale.mul(1.3)).fract(), a = x(u.waterNormal, n).mul(2).sub(1), r = C(o, a, .5).rgb.normalize(), l = r.xy.mul(_.uRefractionStrength), d = r.x.mul(_.uTworld).add(r.y.mul(_.uBworld)).add(r.z.mul(_.uNworld)).normalize(), h = mt(Ke).r, m = pt.element(3).element(2), y = pt.element(2).element(2), w = m.div(h.add(y)), b = Is.z.negate(), S = L(b, w), U = Ke.add(l.mul(S)), z = mt(U).r, G = m.div(z.add(y)), H = L(b, G), V = _s(qe.sub(X)), se = ft(V.negate(), d).normalize(), ue = Ps(u.envMapTexture, se), Z = Ee(Ye(d, V), 0), oe = i(.02), he = oe.add(i(1).sub(oe).mul(Oe(i(1).sub(Z), 5))), ne = C(_.uWaterColor, ue, he.mul(_.uFresnelScale)), Q = C(Ke, U, H), Y = Es(Q).rgb, we = ft(_.uFromSunDir, d), Ie = Ee(Ye(we, V), 0), _e = Oe(Ie, _.uShiness), He = I(_e).mul(_.uHighlightsFactor), ze = Ye(X.xz.sub(qe.xz), X.xz.sub(qe.xz)), De = _.uMinDist, Be = _.uMaxDist, We = C(.05, .5, j(De.mul(De), Be.mul(Be), ze)), tt = C(Y, ne, We);
            this.colorNode = tt.add(He);
        }
    }
    const St = 20;
    class gn extends $ {
        _noiseBuffer;
        constructor(){
            super(), this._noiseBuffer = Te(St, "float"), this._noiseBuffer.setPBO(!0), ge.renderer.computeAsync(this.computeInit), this.precision = "lowp", this.flatShading = !1;
            const e = k(A), t = this._noiseBuffer.element(A), s = L(.5, t), o = i(1).sub(s), n = re(R().mul(3.6).add(e)), a = re(R().mul(1.5).add(e)), r = n.mul(s).add(a.mul(o)), { stoneDiffuse: l, stoneNormalAo: d, stoneMossyDiffuse: h, stoneMossyNormalAo: m } = u.atlasesCoords.stones, y = E(...l.scale).mul(s), w = E(...h.scale).mul(o), b = y.add(w), S = E(...l.offset).mul(s), U = E(...h.offset).mul(o), z = S.add(U), G = v.computeAtlasUv(b, z, r);
            this.colorNode = x(u.stoneAtlas, G);
            const H = E(...d.scale).mul(s), V = E(...m.scale).mul(o), se = H.add(V), ue = E(...d.offset).mul(s), Z = E(...m.offset).mul(o), oe = ue.add(Z), he = v.computeAtlasUv(se, oe, r), ne = x(u.stoneAtlas, he);
            this.normalNode = new Ge(ne.rgb, i(3)), this.normalScale = new Le(1, -1), this.aoNode = ne.a;
        }
        computeInit = f(()=>{
            const e = this._noiseBuffer.element(A), t = E(k(A), k(A).mul(21.63)).fract(), s = x(u.noiseTexture, t);
            e.assign(s.r);
        })().compute(St);
    }
    class wn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("stone"), t = u.realmModel.scene.children.filter(({ name: n })=>n.startsWith("stone_collider")), s = new gn, o = new pe(e.geometry, s, t.length);
            o.receiveShadow = !0, t.forEach((n, a)=>{
                o.setMatrixAt(a, n.matrix);
                const r = le.fixed().setTranslation(...n.position.toArray()).setRotation(n.quaternion).setUserData({
                    type: K.Stone
                }), l = B.world.createRigidBody(r);
                n.geometry.computeBoundingBox();
                const d = n.geometry.boundingBox.max.x * n.scale.x, h = ce.ball(d).setRestitution(.75);
                B.world.createCollider(h, l);
            }), M.scene.add(o);
        }
    }
    const yn = {
        uGrassTerrainColor: p(new W().setRGB(.74, .51, 0)),
        uWaterSandColor: p(new W().setRGB(.54, .39, .2)),
        uPathSandColor: p(new W().setRGB(.65, .49, .27))
    };
    class bn extends $ {
        _uniforms = {
            ...yn
        };
        constructor(){
            super(), this.createMaterial(), this.debugTerrain();
        }
        debugTerrain() {
            const e = te.panel.addFolder({
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
        computeCausticsDiffuse = f(([e = E(0, 0), t = i(0), s = I(0, 0, 0)])=>{
            const o = ee.mul(.15), n = e.mul(17), a = re(n.add(E(o, 0))), r = x(u.noiseTexture, a, 1).g, l = e.mul(33), d = re(l.add(E(0, o.negate()))), h = x(u.noiseTexture, d, 3).g, m = r.add(h), y = j(-1, 7.5, t), w = Oe(m, 3).mul(i(1).sub(y)), b = I(.6, .8, 1).mul(.5);
            return C(s, b, w);
        });
        computeWaterDiffuse = f(([e = i(0), t = E(0, 0)])=>{
            const s = i(8), o = i(.001), n = j(0, s.add(o), e), a = this._uniforms.uWaterSandColor, r = I(.35, .45, .55).mul(.65), l = this.computeCausticsDiffuse(t, e), d = j(0, 1.5, e), h = I(1, .9, .7).mul(.1).mul(d);
            return C(a, r, n).add(h).add(l);
        });
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = v.computeMapUvByPosition(X.xz), t = Xe(e), s = x(u.terrainShadowAo, R().clamp());
            this.aoNode = s.g;
            const o = x(u.terrainTypeMap, t, 2.5), n = o.g, a = o.b, l = i(1).sub(n).sub(a), d = x(u.sandNormal, re(t.mul(30))), h = re(t.mul(30)), y = x(u.grassNormal, h).dot(d).mul(.65), w = x(u.grassDiffuse, h), b = i(1).sub(w.a), S = this._uniforms.uGrassTerrainColor.mul(b).add(w).mul(n).mul(.85), U = this._uniforms.uPathSandColor.mul(1.2).mul(l), z = Xe(X.y.negate()), H = this.computeWaterDiffuse(z, t).mul(a), V = S.add(U.mul(y)).add(H.mul(y).mul(.5));
            this.colorNode = V.mul(s.r);
        }
    }
    class Sn {
        constructor(e){
            const t = this.createFloor();
            t.material = e, M.scene.add(t);
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
                const h = s.array[d * 3 + 0], m = s.array[d * 3 + 1], y = s.array[d * 3 + 2], w = Math.round((h / (r * 2) + .5) * (a - 1)), S = Math.round((y / (r * 2) + .5) * (a - 1)) + w * a;
                l[S] = m;
            }
            return {
                rowsCount: a,
                heights: l,
                displacement: t
            };
        }
        createFloorPhysics() {
            const e = this.getFloorDisplacementData(), { rowsCount: t, heights: s, displacement: o } = e, n = le.fixed().setTranslation(0, -o, 0).setUserData({
                type: K.Terrain
            }), a = B.world.createRigidBody(n), r = ce.heightfield(t - 1, t - 1, s, {
                x: J.MAP_SIZE,
                y: 1,
                z: J.MAP_SIZE
            }, Gs.FIX_INTERNAL_EDGES).setFriction(1).setRestitution(.2);
            B.world.createCollider(r, a);
        }
    }
    class An {
        outerFloor;
        kintoun;
        kintounPosition = new D;
        constructor(e){
            this.outerFloor = this.createOuterFloorVisual(), this.outerFloor.material = e, this.kintoun = this.createKintoun(), M.scene.add(this.outerFloor), F.on("update", this.update.bind(this));
        }
        createOuterFloorVisual() {
            const e = u.realmModel.scene.getObjectByName("outer_world");
            return e.receiveShadow = !0, e;
        }
        createKintoun() {
            const e = le.kinematicPositionBased().setTranslation(0, -20, 0).setUserData({
                type: K.Terrain
            }), t = B.world.createRigidBody(e), s = 2, o = ce.cuboid(s, J.HALF_FLOOR_THICKNESS, s).setFriction(1).setRestitution(.2);
            return B.world.createCollider(o, t), t;
        }
        useKintoun(e) {
            this.kintounPosition.copy(e).setY(-J.HALF_FLOOR_THICKNESS), this.kintoun.setTranslation(this.kintounPosition, !0);
        }
        update(e) {
            const { player: t } = e, s = J.HALF_MAP_SIZE - Math.abs(t.position.x) < J.KINTOUN_ACTIVATION_THRESHOLD, o = J.HALF_MAP_SIZE - Math.abs(t.position.z) < J.KINTOUN_ACTIVATION_THRESHOLD;
            (s || o) && this.useKintoun(t.position);
            const n = J.MAP_SIZE, a = Math.abs(t.position.x), r = Math.sign(t.position.x), l = Math.abs(t.position.z), d = Math.sign(t.position.z), h = a > n ? a - n : 0, m = l > n ? l - n : 0;
            this.outerFloor.position.set(h * r, 0, m * d);
        }
    }
    class xn {
        constructor(){
            const e = new bn;
            new Sn(e), new An(e);
        }
    }
    const Mn = ()=>({
            BLADE_WIDTH: .1,
            BLADE_HEIGHT: 1.65,
            BLADE_BOUNDING_SPHERE_RADIUS: 1.65,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            BLADES_PER_SIDE: 512,
            COUNT: 512 * 512,
            SPACING: 150 / 512,
            WORKGROUP_SIZE: 256
        }), P = Mn(), g = {
        uPlayerPosition: p(new D(0, 0, 0)),
        uCameraMatrix: p(new ke),
        uBladeMinScale: p(.5),
        uBladeMaxScale: p(1.25),
        uTrailGrowthRate: p(.004),
        uTrailMinScale: p(.25),
        uTrailRaius: p(.65),
        uTrailRaiusSquared: p(.65 * .65),
        uGlowRadius: p(2),
        uGlowRadiusSquared: p(4),
        uGlowFadeIn: p(.05),
        uGlowFadeOut: p(.01),
        uGlowColor: p(new W().setRGB(.39, .14, .02)),
        uBladeMaxBendAngle: p(Math.PI * .15),
        uWindStrength: p(.6),
        uBaseColor: p(new W().setRGB(.07, .07, 0)),
        uTipColor: p(new W().setRGB(.23, .11, .05)),
        uDelta: p(new Le(0, 0)),
        uGlowMul: p(3),
        uR0: p(20),
        uR1: p(75),
        uPMin: p(.05),
        uWindSpeed: p(.25)
    };
    class Ln {
        buffer;
        constructor(){
            this.buffer = Te(P.COUNT, "vec4"), this.computeUpdate.onInit(({ renderer: e })=>{
                e.computeAsync(this.computeInit);
            });
        }
        get computeBuffer() {
            return this.buffer;
        }
        getYaw = f(([e = O(0)])=>v.unpackUnits(e.z, 0, 12, -Math.PI, Math.PI));
        getBend = f(([e = O(0)])=>v.unpackUnits(e.z, 12, 12, -Math.PI, Math.PI));
        getScale = f(([e = O(0)])=>v.unpackUnits(e.w, 0, 8, g.uBladeMinScale, g.uBladeMaxScale));
        getOriginalScale = f(([e = O(0)])=>v.unpackUnits(e.w, 8, 8, g.uBladeMinScale, g.uBladeMaxScale));
        getShadow = f(([e = O(0)])=>v.unpackFlag(e.w, 16));
        getVisibility = f(([e = O(0)])=>v.unpackFlag(e.w, 17));
        getGlow = f(([e = O(0)])=>v.unpackUnit(e.w, 18, 6));
        setYaw = f(([e = O(0), t = i(0)])=>(e.z = v.packUnits(e.z, 0, 12, t, -Math.PI, Math.PI), e));
        setBend = f(([e = O(0), t = i(0)])=>(e.z = v.packUnits(e.z, 12, 12, t, -Math.PI, Math.PI), e));
        setScale = f(([e = O(0), t = i(0)])=>(e.w = v.packUnits(e.w, 0, 8, t, g.uBladeMinScale, g.uBladeMaxScale), e));
        setOriginalScale = f(([e = O(0), t = i(0)])=>(e.w = v.packUnits(e.w, 8, 8, t, g.uBladeMinScale, g.uBladeMaxScale), e));
        setShadow = f(([e = O(0), t = i(0)])=>(e.w = v.packFlag(e.w, 16, t), e));
        setVisibility = f(([e = O(0), t = i(0)])=>(e.w = v.packFlag(e.w, 17, t), e));
        setGlow = f(([e = O(0), t = i(0)])=>(e.w = v.packUnit(e.w, 18, 6, t), e));
        computeInit = f(()=>{
            const e = this.buffer.element(A), t = Se(i(A).div(P.BLADES_PER_SIDE)), s = i(A).mod(P.BLADES_PER_SIDE), o = k(A.add(4321)), n = k(A.add(1234)), a = s.mul(P.SPACING).sub(P.TILE_HALF_SIZE).add(o.mul(P.SPACING * .5)), r = t.mul(P.SPACING).sub(P.TILE_HALF_SIZE).add(n.mul(P.SPACING * .5)), l = I(a, 0, r).xz.add(P.TILE_HALF_SIZE).div(P.TILE_SIZE).abs(), d = x(u.noiseTexture, l), h = d.r.sub(.5).mul(17).fract(), m = d.b.sub(.5).mul(13).fract();
            e.x = a.add(h), e.y = r.add(m);
            const y = d.b.sub(.5).mul(i(Math.PI * 2));
            e.assign(this.setYaw(e, y));
            const w = g.uBladeMaxScale.sub(g.uBladeMinScale), b = d.r.mul(w).add(g.uBladeMinScale);
            e.assign(this.setScale(e, b)), e.assign(this.setOriginalScale(e, b));
        })().compute(P.COUNT, [
            P.WORKGROUP_SIZE
        ]);
        computeStochasticKeep = f(([e = I(0)])=>{
            const t = e.x.sub(g.uPlayerPosition.x), s = e.z.sub(g.uPlayerPosition.z), o = t.mul(t).add(s.mul(s)), n = g.uR0, a = g.uR1, r = g.uPMin, l = n.mul(n), d = a.mul(a), h = $e(o.sub(l).div(Ee(d.sub(l), 1e-5)), 0, 1), m = C(1, r, h), y = k(i(A).mul(.73));
            return L(y, m);
        });
        computeVisibility = f(([e = I(0)])=>{
            const t = g.uCameraMatrix.mul(O(e, 1)), s = t.xyz.div(t.w), o = P.BLADE_BOUNDING_SPHERE_RADIUS, n = i(1);
            return L(n.negate().sub(o), s.x).mul(L(s.x, n.add(o))).mul(L(n.negate().sub(o), s.y)).mul(L(s.y, n.add(o))).mul(L(0, s.z)).mul(L(s.z, n));
        });
        computeBending = f(([e = i(0), t = I(0)])=>{
            const s = t.xz.add(ee.mul(g.uWindSpeed)).mul(.5).fract(), n = x(u.noiseTexture, s, 2).r.mul(g.uWindStrength);
            return e.add(n.sub(e).mul(.1));
        });
        computeAlpha = f(([e = I(0)])=>{
            const t = v.computeMapUvByPosition(e.xz), s = x(u.terrainTypeMap, t).g;
            return L(.25, s);
        });
        computeTrailScale = f(([e = i(0), t = i(0), s = i(0)])=>{
            const o = t.add(g.uTrailGrowthRate), n = i(1).sub(s), a = g.uTrailMinScale.mul(s).add(o.mul(n));
            return vs(a, e);
        });
        computeTrailGlow = f(([e = i(0), t = i(0), s = i(0), o = i(0)])=>{
            const n = j(g.uGlowRadiusSquared, i(0), t), a = 100, r = Se(gt(g.uDelta.x).mul(a)), l = Se(gt(g.uDelta.y).mul(a)), d = L(1, r.add(l)), h = n.mul(i(1).sub(s)).mul(o), m = Ee(d, e).mul(h), y = m.mul(g.uGlowFadeIn), w = i(1).sub(m).mul(g.uGlowFadeOut), b = i(1).sub(d).mul(g.uGlowFadeOut).mul(e);
            return $e(e.add(y).sub(w).sub(b), 0, 1);
        });
        computeShadow = f(([e = I(0)])=>{
            const t = v.computeMapUvByPosition(e.xz), s = x(u.terrainShadowAo, t);
            return L(.65, s.r);
        });
        computeUpdate = f(()=>{
            const e = this.buffer.element(A), t = Me(e.x.sub(g.uDelta.x).add(P.TILE_HALF_SIZE), P.TILE_SIZE).sub(P.TILE_HALF_SIZE), s = Me(e.y.sub(g.uDelta.y).add(P.TILE_HALF_SIZE), P.TILE_SIZE).sub(P.TILE_HALF_SIZE), o = I(t, 0, s);
            e.x = t, e.y = s;
            const n = o.add(g.uPlayerPosition), a = this.computeStochasticKeep(n), r = this.computeVisibility(n).mul(a);
            e.assign(this.setVisibility(e, r)), It(r, ()=>{
                const l = E(g.uDelta.x, g.uDelta.y), d = o.xz.sub(l), h = d.dot(d), m = L(.1, i(1).sub(g.uPlayerPosition.y)), y = L(h, g.uTrailRaiusSquared).mul(m), w = this.getScale(e), b = this.getOriginalScale(e), S = this.computeTrailScale(b, w, y);
                e.assign(this.setScale(e, S));
                const U = this.computeAlpha(n);
                e.assign(this.setVisibility(e, U));
                const z = this.getBend(e), G = this.computeBending(z, n);
                e.assign(this.setBend(e, G));
                const H = this.getGlow(e), V = this.computeTrailGlow(H, h, y, m);
                e.assign(this.setGlow(e, V));
                const se = this.computeShadow(n);
                e.assign(this.setShadow(e, se));
            });
        })().compute(P.COUNT, [
            P.WORKGROUP_SIZE
        ]);
    }
    class In extends Lt {
        ssbo;
        constructor(e){
            super(), this.ssbo = e, this.createGrassMaterial();
        }
        computePosition = f(([e = i(0), t = i(0), s = i(0), o = i(0), n = i(0), a = i(0)])=>{
            const r = I(e, 0, t), l = o.mul(R().y), h = wt(ve, I(l, 0, 0)).mul(I(1, n, 1)), m = wt(h, I(0, s, 0)), y = k(A).mul(be), w = fe(ee.mul(5).add(o).add(y)).mul(.1), b = R().y.mul(a), S = w.mul(b);
            return m.add(r).add(I(S));
        });
        computeDiffuseColor = f(([e = i(0), t = i(1)])=>{
            const s = C(g.uBaseColor, g.uTipColor, R().y), o = C(s, g.uGlowColor.mul(g.uGlowMul), e);
            return C(o.mul(.5), o, t);
        });
        createGrassMaterial() {
            this.precision = "lowp", this.side = Qe;
            const e = this.ssbo.computeBuffer.element(A), t = e.x, s = e.y, o = this.ssbo.getYaw(e), n = this.ssbo.getBend(e), a = this.ssbo.getScale(e), r = this.ssbo.getVisibility(e), l = this.ssbo.getGlow(e), d = this.ssbo.getShadow(e);
            Ds(r.equal(0)), this.positionNode = this.computePosition(t, s, o, n, a, l), this.opacityNode = r, this.alphaTest = .5, this.colorNode = this.computeDiffuseColor(l, d);
        }
    }
    class _n {
        constructor(){
            const e = new Ln, t = this.createGeometry(3), s = new In(e), o = new pe(t, s, P.COUNT);
            o.frustumCulled = !1, M.scene.add(o), F.on("update-throttle-2x", ({ player: n })=>{
                const a = n.position.x - o.position.x, r = n.position.z - o.position.z;
                g.uDelta.value.set(a, r), g.uPlayerPosition.value.copy(n.position), g.uCameraMatrix.value.copy(M.playerCamera.projectionMatrix).multiply(M.playerCamera.matrixWorldInverse), o.position.copy(n.position).setY(0), ge.renderer.computeAsync(e.computeUpdate);
            }), this.debugGrass();
        }
        debugGrass() {
            const e = te.panel.addFolder({
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
                max: P.TILE_SIZE,
                step: .1
            }), e.addBinding(g.uR1, "value", {
                label: "Outer ring",
                min: 0,
                max: P.TILE_SIZE,
                step: .1
            }), e.addBinding(g.uPMin, "value", {
                label: "P Min",
                min: 0,
                max: 1,
                step: .01
            });
        }
        createGeometry(e) {
            const t = Math.max(1, Math.floor(e)), s = P.BLADE_HEIGHT, o = P.BLADE_WIDTH * .5, n = t, a = n * 2 + 1, l = Math.max(0, n - 1) * 6 + 3, d = new Float32Array(a * 3), h = new Float32Array(a * 2), m = new Uint8Array(l), y = new Float32Array(l * 3), w = (Z)=>o * (1 - .7 * Z);
            let b = 0;
            for(let Z = 0; Z < n; Z++){
                const oe = Z / t, he = oe * s, ne = w(oe), Q = Z * 2, Y = Q + 1;
                if (d[3 * Q + 0] = -ne, d[3 * Q + 1] = he, d[3 * Q + 2] = 0, d[3 * Y + 0] = ne, d[3 * Y + 1] = he, d[3 * Y + 2] = 0, h[2 * Q + 0] = 0, h[2 * Q + 1] = oe, h[2 * Y + 0] = 1, h[2 * Y + 1] = oe, Z > 0) {
                    const we = (Z - 1) * 2, Ie = we + 1;
                    m[b++] = we, m[b++] = Ie, m[b++] = Y, m[b++] = we, m[b++] = Y, m[b++] = Q;
                }
            }
            const S = n * 2;
            d[3 * S + 0] = 0, d[3 * S + 1] = s, d[3 * S + 2] = 0, h[2 * S + 0] = .5, h[2 * S + 1] = 1;
            const U = (n - 1) * 2, z = U + 1;
            m[b++] = U, m[b++] = z, m[b++] = S;
            const G = new Ts, H = new Re(d, 3);
            H.setUsage(Fe), G.setAttribute("position", H);
            const V = new Re(h, 2);
            V.setUsage(Fe), G.setAttribute("uv", V);
            const se = new Re(m, 1);
            se.setUsage(Fe), G.setIndex(se);
            const ue = new Re(y, 3);
            return ue.setUsage(Fe), G.setAttribute("normal", ue), G;
        }
    }
    const Pn = ()=>({
            FLOWER_WIDTH: .5,
            FLOWER_HEIGHT: 1,
            BLADE_BOUNDING_SPHERE_RADIUS: 1,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            FLOWERS_PER_SIDE: 25,
            COUNT: 625,
            SPACING: 150 / 25
        }), N = Pn();
    class En {
        flowerField;
        material;
        uniforms = {
            ...Tt,
            uDelta: p(new Le(0, 0)),
            uPlayerPosition: p(new D(0, 0, 0)),
            uCameraMatrix: p(new ke)
        };
        constructor(){
            this.material = new Tn(this.uniforms), this.flowerField = new pe(new At(1, 1), this.material, N.COUNT), M.scene.add(this.flowerField), F.on("update", this.updateAsync.bind(this));
        }
        async updateAsync(e) {
            const { player: t } = e, s = t.position.x - this.flowerField.position.x, o = t.position.z - this.flowerField.position.z;
            this.uniforms.uDelta.value.set(s, o), this.uniforms.uPlayerPosition.value.copy(t.position), this.uniforms.uCameraMatrix.value.copy(M.playerCamera.projectionMatrix).multiply(M.playerCamera.matrixWorldInverse), this.flowerField.position.copy(t.position).setY(0), this.material.updateAsync();
        }
    }
    const Tt = {
        uPlayerPosition: p(new D(0, 0, 0)),
        uCameraMatrix: p(new ke),
        uDelta: p(new Le(0, 0))
    };
    class Tn extends Mt {
        _uniforms;
        _buffer1;
        constructor(e){
            super(), this._uniforms = {
                ...Tt,
                ...e
            }, this._buffer1 = Te(N.COUNT, "vec4"), this._buffer1.setPBO(!0), this.computeUpdate.onInit(({ renderer: t })=>{
                t.computeAsync(this.computeInit);
            }), this.createMaterial();
        }
        computeInit = f(()=>{
            const e = this._buffer1.element(A), t = Se(i(A).div(N.FLOWERS_PER_SIDE)), s = i(A).mod(N.FLOWERS_PER_SIDE), o = k(A.add(4321)), n = k(A.add(1234)), a = s.mul(N.SPACING).sub(N.TILE_HALF_SIZE).add(o.mul(N.SPACING * .5)), r = t.mul(N.SPACING).sub(N.TILE_HALF_SIZE).add(n.mul(N.SPACING * .5)), l = I(a, 0, r).xz.add(N.TILE_HALF_SIZE).div(N.TILE_SIZE).abs(), h = x(u.noiseTexture, l).r, m = h.sub(.5).mul(100), y = h.clamp(.5, .75), w = h.sub(.5).mul(50);
            e.x = a.add(m), e.y = y, e.z = r.add(w);
        })().compute(N.COUNT);
        computeVisibility = f(([e = I(0)])=>{
            const t = this._uniforms.uCameraMatrix.mul(O(e, 1)), s = t.xyz.div(t.w), o = N.BLADE_BOUNDING_SPHERE_RADIUS, n = i(1);
            return L(n.negate().sub(o), s.x).mul(L(s.x, n.add(o))).mul(L(n.negate().sub(o), s.y)).mul(L(s.y, n.add(o))).mul(L(0, s.z)).mul(L(s.z, n));
        });
        computeAlpha = f(([e = I(0)])=>{
            const t = v.computeMapUvByPosition(e.xz);
            return x(u.terrainTypeMap, t).g;
        });
        computeUpdate = f(()=>{
            const e = this._buffer1.element(A), t = Me(e.x.sub(this._uniforms.uDelta.x).add(N.TILE_HALF_SIZE), N.TILE_SIZE).sub(N.TILE_HALF_SIZE), s = Me(e.z.sub(this._uniforms.uDelta.y).add(N.TILE_HALF_SIZE), N.TILE_SIZE).sub(N.TILE_HALF_SIZE);
            e.x = t, e.z = s;
            const n = I(e.x, 0, e.z).add(this._uniforms.uPlayerPosition), a = this.computeVisibility(n);
            e.w = a, It(a, ()=>{
                e.w = this.computeAlpha(n);
            });
        })().compute(N.COUNT);
        createMaterial() {
            this.precision = "lowp";
            const e = this._buffer1.element(A), t = k(A.add(9234)), s = k(A.add(33.87)), o = ee.mul(2), n = fe(o.add(t.mul(100))).mul(.05);
            this.positionNode = e.xyz.add(I(n, 0, n)), this.scaleNode = t.mul(.2).add(.3);
            const a = L(.5, t).mul(.5), r = L(.5, s).mul(.5), d = R().mul(.5).add(E(a, r)), h = x(u.flowerAtlas, d);
            this.colorNode = h, this.opacityNode = e.w, this.alphaTest = .15;
        }
        async updateAsync() {
            ge.renderer.computeAsync(this.computeUpdate);
        }
    }
    class vn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("water_lilies");
            e.material = this.createMaterial(), M.scene.add(e);
        }
        createMaterial() {
            const e = new $;
            e.precision = "lowp", e.transparent = !0, e.map = u.waterLiliesTexture, e.alphaTest = .5, e.alphaMap = u.waterLiliesAlphaTexture;
            const t = ee.mul(5e-4), s = X.x.mul(.1), o = x(u.noiseTexture, re(X.xz.add(t).mul(s))).b.mul(.5), n = fe(o);
            return e.positionNode = ve.add(n), e;
        }
    }
    class Dn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = re(R().mul(7)), t = x(u.barkDiffuse, e);
            this.colorNode = t.mul(2.5);
            const s = x(u.barkNormal, e);
            this.normalNode = new Ge(s);
        }
    }
    const xe = {
        uPrimaryColor: p(new W().setRGB(.889, .095, 0)),
        uSecondaryColor: p(new W().setRGB(1, .162, .009)),
        uMixFactor: p(.5)
    };
    class Bn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.transparent = !0, this.side = Qe;
            const e = v.computeMapUvByPosition(X.xz), t = x(u.noiseTexture, e), s = x(u.canopyDiffuse, R()), o = C(xe.uPrimaryColor, xe.uSecondaryColor, xe.uMixFactor);
            this.colorNode = O(C(s.rgb, o, t.b.mul(.4)).rgb, 1);
            const n = x(u.canopyNormal, R());
            this.normalNode = new Ge(n, i(1.25)), this.normalScale = new Le(1, -1), this.opacityNode = L(.5, s.a), this.alphaTest = .1;
            const a = ee.mul(t.r).add(Bs).mul(7.5), r = fe(a).mul(.015), l = xt(a.mul(.75)).mul(.01);
            this.positionNode = ve.add(I(0, l, r));
        }
    }
    class Cn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("tree"), t = u.realmModel.scene.children.filter(({ name: w })=>w.startsWith("tree_collider")), s = new Dn, o = new Bn, [n, a] = e.children, r = new pe(n.geometry, s, t.length);
            r.receiveShadow = !0;
            const l = new pe(a.geometry, o, t.length), h = u.realmModel.scene.getObjectByName("base_tree_collider").geometry.boundingBox, m = h.max.x, y = h.max.y / 2;
            t.forEach((w, b)=>{
                r.setMatrixAt(b, w.matrix), l.setMatrixAt(b, w.matrix);
                const S = le.fixed().setTranslation(...w.position.toArray()).setRotation(w.quaternion).setUserData({
                    type: K.Wood
                }), U = B.world.createRigidBody(S), z = m * w.scale.x, G = y * w.scale.y, H = ce.capsule(G, z).setRestitution(.75);
                B.world.createCollider(H, U);
            }), M.scene.add(r, l), this.debugTrees();
        }
        debugTrees() {
            const e = te.panel.addFolder({
                title: "🌳 Trees"
            });
            e.expanded = !1, e.addBinding(xe.uPrimaryColor, "value", {
                label: "Primary Leaf Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(xe.uSecondaryColor, "value", {
                label: "Seconary Leaf Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(xe.uMixFactor, "value", {
                label: "Mix factor"
            });
        }
    }
    class Nn {
        constructor(){
            new _n, new vn, new En, new Cn;
        }
    }
    const Rn = "/textures/hud/compass.webp", Fn = "/textures/hud/compassArrow.webp";
    class Un {
        constructor(){
            const e = document.createElement("div");
            e.classList.add("compass-container");
            const t = document.createElement("img");
            t.setAttribute("alt", "compass"), t.setAttribute("src", Rn), t.classList.add("compass"), e.appendChild(t);
            const s = document.createElement("img");
            s.setAttribute("alt", "arrow"), s.setAttribute("src", Fn), s.classList.add("compass-arrow"), e.appendChild(s), document.body.appendChild(e);
            const o = J.MAP_SIZE / 2;
            let n = 0;
            F.on("update-throttle-16x", ({ player: a })=>{
                const r = Math.abs(a.position.x) > o, l = Math.abs(a.position.z) > o, h = r || l ? .65 : 0;
                if (e.style.setProperty("--opacity", `${h}`), !h) return;
                const m = Math.atan2(-a.position.x, -a.position.z);
                n = this.unwrapAngle(n, m - a.yaw), s.style.setProperty("--yaw", `${-n}rad`);
            });
        }
        unwrapAngle(e, t) {
            const s = t - e;
            return e + ((s + Math.PI) % (2 * Math.PI) - Math.PI);
        }
    }
    const On = ()=>Object.freeze({
            MAP_SIZE: 256,
            HALF_MAP_SIZE: 256 / 2,
            KINTOUN_ACTIVATION_THRESHOLD: 2,
            HALF_FLOOR_THICKNESS: .3,
            OUTER_MAP_SIZE: 256 * 3,
            OUTER_HALF_MAP_SIZE: 256 * 1.5
        }), J = On();
    class kn {
        constructor(){
            new Un, new xn, new mn, new pn, new Nn, new wn, new un;
        }
    }
    class Gn {
        pow2 = f(([e = i(0)])=>Oe(i(2), e));
        packF32 = f(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1), a = i(0)])=>{
            const r = ae(this.pow2(s), 1), l = ae(o, a).div(Ee(n, 1e-20)), d = $e(Cs(l), 0, r), h = this.pow2(t), m = this.pow2(s), y = Se(e.div(h)), w = Me(y, m).mul(h);
            return e.sub(w).add(d.mul(h));
        });
        unpackF32 = f(([e = i(0), t = i(0), s = i(8), o = i(1), n = i(0)])=>{
            const a = this.pow2(t), r = this.pow2(s), l = Se(e.div(a));
            return Me(l, r).mul(o).add(n);
        });
        packUnit = f(([e = i(0), t = i(0), s = i(8), o = i(0)])=>{
            const n = i(1).div(ae(this.pow2(s), 1));
            return this.packF32(e, t, s, o, n, i(0));
        });
        unpackUnit = f(([e = i(0), t = i(0), s = i(8)])=>{
            const o = i(1).div(ae(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, i(0));
        });
        packFlag = f(([e = i(0), t = i(0), s = i(0)])=>this.packF32(e, t, i(1), s, i(1), i(0)));
        unpackFlag = f(([e = i(0), t = i(0)])=>this.unpackF32(e, t, i(1), i(1), i(0)));
        packAngle = f(([e = i(0), t = i(0), s = i(9), o = i(0)])=>{
            const n = ae(this.pow2(s), 1), a = be.div(n), r = o.sub(be.mul(Se(o.div(be))));
            return this.packF32(e, t, s, r, a, i(0));
        });
        unpackAngle = f(([e = i(0), t = i(0), s = i(9)])=>{
            const o = be.div(ae(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, i(0));
        });
        packSigned = f(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1)])=>{
            const a = ae(this.pow2(s), 1), r = n.mul(2).div(a), l = n.negate();
            return this.packF32(e, t, s, o, r, l);
        });
        unpackSigned = f(([e = i(0), t = i(0), s = i(8), o = i(1)])=>{
            const n = o.mul(2).div(ae(this.pow2(s), 1)), a = o.negate();
            return this.unpackF32(e, t, s, n, a);
        });
        packUnits = f(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(0), a = i(1)])=>{
            const r = ae(this.pow2(s), 1), l = a.sub(n).div(r);
            return this.packF32(e, t, s, o, l, n);
        });
        unpackUnits = f(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1)])=>{
            const a = n.sub(o).div(ae(this.pow2(s), 1));
            return this.unpackF32(e, t, s, a, o);
        });
        computeMapUvByPosition = f(([e = E(0)])=>e.add(J.HALF_MAP_SIZE).div(J.MAP_SIZE));
        computeAtlasUv = f(([e = E(0), t = E(0), s = E(0)])=>s.mul(e).add(t));
    }
    const v = new Gn, Hn = ()=>({
            JUMP_BUFFER_DURATION_IN_SECONDS: .2,
            MAX_CONSECUTIVE_JUMPS: 2,
            JUMP_CUT_MULTIPLIER: .25,
            FALL_MULTIPLIER: 2.75,
            MAX_UPWARD_VELOCITY: 6,
            LINEAR_DAMPING: .35,
            ANGULAR_DAMPING: .6,
            JUMP_IMPULSE: new D(0, 75, 0),
            LIN_VEL_STRENGTH: 35,
            ANG_VEL_STRENGTH: 25,
            RADIUS: .5,
            MASS: .5,
            PLAYER_INITIAL_POSITION: new D(0, 5, 0),
            CAMERA_OFFSET: new D(0, 11, 17),
            CAMERA_LERP_FACTOR: 7.5,
            UP: new D(0, 1, 0),
            DOWN: new D(0, -1, 0),
            FORWARD: new D(0, 0, -1)
        }), T = Hn();
    class zn {
        mesh;
        rigidBody;
        smoothedCameraPosition = new D;
        desiredCameraPosition = new D;
        smoothedCameraTarget = new D;
        desiredTargetPosition = new D;
        yawInRadians = 0;
        prevYawInRadians = -1;
        yawQuaternion = new Ns;
        newLinVel = new D;
        newAngVel = new D;
        torqueAxis = new D;
        forwardVec = new D;
        isOnGround = !1;
        jumpCount = 0;
        wasJumpHeld = !1;
        jumpBufferTimer = 0;
        rayOrigin = new D;
        ray = new Hs(this.rayOrigin, T.DOWN);
        constructor(){
            this.mesh = this.createCharacterMesh(), M.scene.add(this.mesh), et.setTarget(this.mesh), this.rigidBody = B.world.createRigidBody(this.createRigidBodyDesc()), B.world.createCollider(this.createColliderDesc(), this.rigidBody), F.on("update", this.update.bind(this)), F.on("update-throttle-64x", this.resetPlayerPosition.bind(this)), this.debugPlayer();
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
            }, !1), this.rigidBody.setTranslation(T.PLAYER_INITIAL_POSITION, !0), this.mesh.position.copy(T.PLAYER_INITIAL_POSITION));
        }
        debugPlayer() {
            const e = te.panel.addFolder({
                title: "🪩 Player",
                expanded: !1
            });
            e.addBinding(T.CAMERA_OFFSET, "y", {
                label: "Main camera height"
            }), e.addBinding(T.CAMERA_OFFSET, "z", {
                label: "Main camera distance"
            });
        }
        createCharacterMesh() {
            const e = u.realmModel.scene.getObjectByName("player");
            return e.material = new Wn, e.castShadow = !0, e.position.copy(T.PLAYER_INITIAL_POSITION), e;
        }
        createRigidBodyDesc() {
            const { x: e, y: t, z: s } = T.PLAYER_INITIAL_POSITION;
            return le.dynamic().setTranslation(e, t, s).setLinearDamping(T.LINEAR_DAMPING).setAngularDamping(T.ANGULAR_DAMPING).setUserData({
                type: K.Player
            });
        }
        createColliderDesc() {
            return ce.ball(T.RADIUS).setRestitution(.6).setFriction(1).setMass(T.MASS).setActiveEvents(zs.COLLISION_EVENTS);
        }
        update(e) {
            const { clock: t } = e, s = t.getDelta();
            this.prevYawInRadians !== this.yawInRadians && (this.yawQuaternion.setFromAxisAngle(T.UP, this.yawInRadians), this.prevYawInRadians = this.yawInRadians), this.updateVerticalMovement(s), this.updateHorizontalMovement(s), this.updateCameraPosition(s);
        }
        updateVerticalMovement(e) {
            const t = Pe.isJumpPressed();
            this.isOnGround = this.checkIfGrounded(), this.isOnGround && (this.jumpCount = 0), t && !this.wasJumpHeld ? this.jumpBufferTimer = T.JUMP_BUFFER_DURATION_IN_SECONDS : this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - e), this.jumpBufferTimer > 0 && this.canJump() && (this.performJump(), this.jumpBufferTimer = 0);
            const o = this.rigidBody.linvel();
            this.handleJumpCut(t, o), this.handleFastFall(e, o, B.world.gravity.y), this.clampUpwardVelocity(o), this.rigidBody.setLinvel(o, !0), this.wasJumpHeld = t;
        }
        checkIfGrounded() {
            this.rayOrigin.copy(this.rigidBody.translation()), this.rayOrigin.y -= T.RADIUS + .01;
            const e = .2, t = B.world.castRay(this.ray, e, !0);
            return t ? t.timeOfImpact * e < .01 : !1;
        }
        canJump() {
            return this.isOnGround ? !0 : this.jumpCount < T.MAX_CONSECUTIVE_JUMPS;
        }
        performJump() {
            this.rigidBody.applyImpulse(T.JUMP_IMPULSE, !0), this.jumpCount += 1;
        }
        handleJumpCut(e, t) {
            !(!e && this.wasJumpHeld) || t.y <= 0 || (t.y *= T.JUMP_CUT_MULTIPLIER);
        }
        handleFastFall(e, t, s) {
            if (t.y >= 0) return;
            const o = T.FALL_MULTIPLIER * Math.abs(s) * e;
            t.y -= o;
        }
        clampUpwardVelocity(e) {
            e.y <= T.MAX_UPWARD_VELOCITY || (e.y = T.MAX_UPWARD_VELOCITY);
        }
        updateHorizontalMovement(e) {
            const t = Pe.isForward(), s = Pe.isBackward(), o = Pe.isLeftward(), n = Pe.isRightward(), a = 2;
            o && (this.yawInRadians += a * e), n && (this.yawInRadians -= a * e), this.forwardVec.copy(T.FORWARD).applyQuaternion(this.yawQuaternion), this.torqueAxis.crossVectors(T.UP, this.forwardVec).normalize(), this.newLinVel.copy(this.rigidBody.linvel()), this.newAngVel.copy(this.rigidBody.angvel());
            const r = T.LIN_VEL_STRENGTH * e, l = T.ANG_VEL_STRENGTH * e;
            t && (this.newLinVel.addScaledVector(this.forwardVec, r), this.newAngVel.addScaledVector(this.torqueAxis, l)), s && (this.newLinVel.addScaledVector(this.forwardVec, -r), this.newAngVel.addScaledVector(this.torqueAxis, -l)), this.rigidBody.setLinvel(this.newLinVel, !0), this.rigidBody.setAngvel(this.newAngVel, !0), this.syncMeshWithBody();
        }
        syncMeshWithBody() {
            this.mesh.position.copy(this.rigidBody.translation()), this.mesh.quaternion.copy(this.rigidBody.rotation());
        }
        updateCameraPosition(e) {
            this.desiredCameraPosition.copy(T.CAMERA_OFFSET).applyQuaternion(this.yawQuaternion).add(this.mesh.position);
            const t = T.CAMERA_LERP_FACTOR * e;
            this.smoothedCameraPosition.lerp(this.desiredCameraPosition, t), this.desiredTargetPosition.copy(this.mesh.position), this.desiredTargetPosition.y += 1, this.smoothedCameraTarget.lerp(this.desiredTargetPosition, t), M.playerCamera.position.copy(this.smoothedCameraPosition), M.playerCamera.lookAt(this.smoothedCameraTarget);
        }
        get position() {
            return this.mesh.position;
        }
        get yaw() {
            return this.yawInRadians;
        }
    }
    class Wn extends $ {
        constructor(){
            super(), this.createMaterial();
        }
        createMaterial() {
            this.flatShading = !1, this.castShadowNode = I(.6);
            const e = v.computeMapUvByPosition(X.xz), t = Xe(e), s = et.getTerrainShadowFactor(t), o = x(u.noiseTexture, re(X.xz), 3).r, n = fe(ee.mul(2.5).add(o.mul(5))).mul(.05), a = i(-.45).add(n), r = i(1).sub(L(a, X.y)), l = i(1).sub(r), d = x(u.footballDiffuse, R()).mul(1.5), h = i(1).sub(j(-1.5, 1, X.y).mul(r)), m = C(I(1), I(.6, .8, 1).mul(.75), h), y = d.mul(m).mul(r), b = d.mul(l).add(y);
            this.colorNode = b.mul(s);
        }
    }
    const Vn = [
        30,
        60,
        120,
        144,
        160,
        165,
        170,
        180,
        240
    ], Zn = (c)=>Vn.reduce((e, t)=>Math.abs(t - c) < Math.abs(e - c) ? t : e), jn = async ()=>new Promise((c)=>{
            const e = [];
            let t = performance.now(), s = t;
            function o(n) {
                if (e.push(n - t), t = n, n - s < 1e3) requestAnimationFrame(o);
                else {
                    e.sort((d, h)=>d - h);
                    const r = 1e3 / (e[Math.floor(e.length / 2)] || 16.667), l = Zn(r);
                    c(l);
                }
            }
            requestAnimationFrame(o);
        });
    class Kn {
        player;
        ENABLE_CAP_FPS = !1;
        config = {
            halvenFPS: !1
        };
        constructor(){
            this.player = new zn, new kn, this.debugGame();
        }
        debugGame() {
            te.panel.addFolder({
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
            if (!this.ENABLE_CAP_FPS) return;
            const e = await jn();
            this.config.halvenFPS = e >= 120;
        }
        onResize() {
            const e = this.getSizes();
            F.emit("resize", e), this.updateRefreshRate();
        }
        async startLoop() {
            await this.updateRefreshRate();
            const t = {
                clock: new Rs(!0),
                player: this.player
            };
            let s = !1;
            const o = ()=>{
                B.update(), this.config.halvenFPS ? s = !s : s = !1, (s || !this.config.halvenFPS) && (F.emit("update", t), ge.renderAsync());
            }, n = Vs(this.onResize.bind(this), 300);
            this.onResize(), new ResizeObserver(n).observe(document.body), ge.renderer.setAnimationLoop(o);
        }
    }
    class qn {
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
                n.stopPropagation(), await ie.toggleMute();
                const a = ie.isMute ? o : s;
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
    const Yn = new qn, Jn = new Vo;
    Jn.initAsync().then(()=>{
        Yn.init(), new Kn().startLoop();
    });
});
