import { L as Zt, T as jt, D as Kt, G as qt, C as Yt, S as ye, P as Jt, p as Xt, b as $t, r as Qt, W as es, a as ts, A as ss, c as os, d as ns, e as as, f as is, g as rs, h as cs, V as v, _ as ls, M as Ke, i as ds, j as ct, k as us, l as z, H as hs, m as ms, O as ps, F as fs, n as p, t as x, v as E, o as gs, q as Oe, I as pe, s as yt, u as Pe, w as k, x as A, y as I, z as B, B as ee, E as i, J as be, K as Z, N as fe, Q as bt, R as U, U as St, X as ws, Y as ys, Z as bs, $ as Ss, a0 as R, a1 as L, a2 as Te, a3 as As, a4 as $, a5 as lt, a6 as xs, a7 as g, a8 as Je, a9 as ae, aa as ke, ab as Ie, ac as At, ad as dt, ae as Ze, af as ut, ag as Ms, ah as Is, ai as je, aj as X, ak as Ls, al as _s, am as Es, an as Ps, ao as Ts, ap as Ds, aq as vs, ar as Ue, as as ht, at as Xe, au as qe, av as Bs, aw as Ne, ax as Re, ay as Se, az as Ye, aA as Cs, aB as mt, aC as Me, aD as xt, aE as pt, aF as Ns, aG as Rs, aH as oe, aI as Fs, aJ as Us, aK as Os } from "./three-IcZ-FWSC.js";
import { P as ks } from "./tweakpane-SMt8byX-.js";
import { S as ft } from "./stats-gl-C2M3amu4.js";
import { e as Gs } from "./tseep-zr-hWxBz.js";
import { World as Hs, EventQueue as Ws, RigidBodyDesc as ie, ColliderDesc as re, HeightFieldFlags as zs, Ray as Vs, ActiveEvents as Zs, __tla as __tla_0 } from "./@dimforge-CqaeYUkE.js";
import { n as js } from "./nipplejs-BxsX8Mt3.js";
import { d as Ks } from "./lodash-es-BMmXVQ06.js";
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
    const qs = "/models/realm.glb", Ys = "/textures/environment/px.webp", Js = "/textures/environment/nx.webp", Xs = "/textures/environment/py.webp", $s = "/textures/environment/ny.webp", Qs = "/textures/environment/pz.webp", eo = "/textures/environment/nz.webp", to = "/textures/noise/noise.webp", so = "/textures/realm/terrainType.webp", oo = "/textures/realm/sandNormal.webp", no = "/textures/realm/grassNormal.webp", ao = "/textures/realm/grassDiffuse.webp", io = "/textures/realm/waterNormal.webp", ro = "/textures/realm/terrainShadowAo.webp", co = "/textures/realm/waterLiliesDiffuse.webp", lo = "/textures/realm/waterLiliesAlpha.webp", uo = "/textures/realm/flowerAtlas.webp", ho = "/textures/realm/stoneAtlas.webp", mo = "/textures/realm/barkDiffuse.webp", po = "/textures/realm/barkNormal.webp", fo = "/textures/realm/canopyDiffuse.webp", go = "/textures/realm/canopyNormal.webp", wo = "/textures/realm/axeDiffuse.webp", yo = "/textures/realm/axeEmissive.webp", bo = "/textures/realm/trunkDiffuse.webp", So = "/textures/realm/trunkNormal.webp", Ao = "/textures/realm/onePieceAtlas.webp", xo = "/textures/realm/kunaiDiffuse.webp", Mo = "/textures/realm/kunaiMR.webp", Io = "/textures/realm/campfireDiffuse.webp", Lo = "/textures/realm/fireSprites.webp", _o = "/textures/realm/footballDiffuse.webp", Eo = "/textures/realm/leafDiffuse.webp", Po = {
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
    }, To = {
        stones: Po
    };
    class Do {
        manager;
        constructor(){
            this.manager = this.createLoadingManager();
        }
        onErrorLog(e) {
            console.log("There was an error loading " + e);
        }
        createLoadingManager() {
            const e = new Zt;
            return e.onError = this.onErrorLog, e;
        }
    }
    const Mt = new Do;
    class vo {
        atlasesCoords = To;
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
            this.textureLoader = new jt(e);
            const t = new Kt;
            t.setDecoderPath("/draco/"), this.gltfLoader = new qt(e), this.gltfLoader.setDRACOLoader(t), this.cubeTextureLoader = new Yt(e);
        }
        async initAsync() {
            const e = await Promise.all([
                this.gltfLoader.loadAsync(qs),
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
                this.textureLoader.loadAsync(co),
                this.textureLoader.loadAsync(lo),
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
                this.textureLoader.loadAsync(Eo)
            ]);
            this.realmModel = e[0], this.envMapTexture = e[1], this.envMapTexture.colorSpace = ye, this.envMapTexture.generateMipmaps = !1, this.noiseTexture = e[2], this.terrainTypeMap = e[3], this.terrainTypeMap.flipY = !1, this.grassDiffuse = e[4], this.grassNormal = e[5], this.sandNormal = e[6], this.waterNormal = e[7], this.terrainShadowAo = e[8], this.terrainShadowAo.flipY = !1, this.waterLiliesTexture = e[9], this.waterLiliesTexture.flipY = !1, this.waterLiliesAlphaTexture = e[10], this.waterLiliesAlphaTexture.flipY = !1, this.flowerAtlas = e[11], this.flowerAtlas.flipY = !1, this.stoneAtlas = e[12], this.stoneAtlas.flipY = !1, this.canopyDiffuse = e[13], this.canopyDiffuse.flipY = !1, this.canopyNormal = e[14], this.canopyNormal.flipY = !1, this.barkDiffuse = e[15], this.barkDiffuse.flipY = !1, this.barkDiffuse.colorSpace = ye, this.barkNormal = e[16], this.barkNormal.flipY = !1, this.axeDiffuse = e[17], this.axeDiffuse.flipY = !1, this.axeEmissive = e[18], this.axeEmissive.flipY = !1, this.trunkDiffuse = e[19], this.trunkDiffuse.flipY = !1, this.trunkDiffuse.colorSpace = ye, this.trunkNormal = e[20], this.trunkNormal.flipY = !1, this.onePieceAtlas = e[21], this.onePieceAtlas.flipY = !1, this.kunaiDiffuse = e[22], this.kunaiDiffuse.flipY = !1, this.kunaiDiffuse.colorSpace = ye, this.kunaiMR = e[23], this.kunaiMR.flipY = !1, this.campfireDiffuse = e[24], this.campfireDiffuse.flipY = !1, this.campfireDiffuse.colorSpace = ye, this.fireSprites = e[25], this.footballDiffuse = e[26], this.footballDiffuse.colorSpace = ye, this.leafDiffuse = e[27], this.leafDiffuse.colorSpace = ye;
        }
    }
    const u = new vo(Mt.manager);
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
    const ce = new Bo;
    class Co {
        stats;
        lastSecond = performance.now();
        drawCallsPanel;
        trianglesPanel;
        constructor(e){
            const t = new ft({
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
            const o = this.stats.addPanel(new ft.Panel(e, t, s));
            return o.update = (n)=>{
                const a = o.canvas.getContext("2d");
                if (!a) return;
                const { width: r, height: c } = o.canvas;
                a.clearRect(0, 0, r, c), a.fillStyle = s, a.fillRect(0, 0, r, c), a.fillStyle = t;
                const d = a.font;
                a.textAlign = "left", a.textBaseline = "top", a.fillText(o.name, 4, 4), a.font = "bold 20px Arial", a.textAlign = "center", a.textBaseline = "middle";
                const h = No.format(n);
                a.fillText(`${h}`, r / 2, c / 1.65), a.font = d;
            }, o;
        }
        updateCustomPanels() {
            const e = performance.now();
            if (e - this.lastSecond < 1e3) return;
            const { render: t } = ge.renderer.info;
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
    ], F = new Gs.EventEmitter, Fo = (l)=>{
        let e = 0;
        F.on("update", (t)=>{
            e++, !(e < l) && (e = 0, F.emit(`update-throttle-${l}x`, t));
        });
    };
    Ro.forEach((l)=>Fo(l));
    class Uo extends Jt {
        scenePass;
        debugFolder = ce.panel.addFolder({
            title: "⭐️ Postprocessing",
            expanded: !1
        });
        constructor(e){
            super(e), this.scenePass = Xt(M.scene, M.renderCamera);
            const t = this.makeGraph();
            this.outputNode = t, F.on("camera-changed", ()=>{
                this.scenePass.camera = M.renderCamera, this.scenePass.needsUpdate = !0;
            });
        }
        makeGraph() {
            this.outputColorTransform = !1;
            const e = this.scenePass.getTextureNode(), t = $t(e, .25, .15, 1);
            t.smoothWidth.value = .04, t._nMips = 2, this.debugFolder.addBinding(t.strength, "value", {
                label: "Bloom strength"
            }), this.debugFolder.addBinding(t.threshold, "value", {
                label: "Bloom threshold"
            });
            const s = e.add(t);
            return Qt(s);
        }
    }
    class Oo {
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
            const t = new es({
                canvas: e,
                antialias: !0,
                trackTimestamp: this.IS_MONITORING_ENABLED,
                powerPreference: "high-performance",
                stencil: !1,
                depth: !0
            });
            t.shadowMap.enabled = !0, t.shadowMap.type = ts, t.toneMapping = ss, t.setClearColor(0, 1), t.toneMappingExposure = 1.5, this.renderer = t, this.monitoringManager = new Co(this.IS_MONITORING_ENABLED), ce.setVisibility(this.IS_DEBUGGING_ENABLED), F.on("resize", (s)=>{
                const o = Math.max(this.IS_POSTPROCESSING_ENABLED ? s.dpr * .75 : s.dpr, 1);
                t.setSize(s.width, s.height), t.setPixelRatio(o);
            });
        }
        async init() {
            M.init(), this.postprocessingManager = new Uo(this.renderer), this.IS_MONITORING_ENABLED && await this.monitoringManager.stats.init(this.renderer);
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
    const ge = new Oo;
    class ko {
        scene;
        playerCamera;
        renderCamera;
        cameraHelper;
        controls;
        orbitControlsCamera;
        constructor(){
            const e = new os;
            this.scene = e;
            const t = window.innerWidth, s = window.innerHeight, o = t / s, n = new ns(45, o, .01, 150);
            n.position.set(0, 5, 10), this.playerCamera = n, e.add(n), this.renderCamera = n, F.on("resize", (a)=>{
                this.playerCamera.aspect = a.aspect, this.playerCamera.updateProjectionMatrix();
            });
        }
        debugScene() {
            if (!this.controls) return;
            ce.panel.addFolder({
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
    const M = new ko, Go = "/audio/ambient/ambient.mp3", Ho = "/audio/ambient/lake.mp3", Wo = "/audio/collisions/hitWood.mp3", zo = "/audio/collisions/hitStone.mp3";
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
            this.audioLoader = new as(e), this.audioListener = new is, M.playerCamera.add(this.audioListener);
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
            const o = new rs(this.audioListener);
            return o.setBuffer(e), o.setVolume(0), o.setLoop(s), o.userData.originalVolume = t, this.files.push(o), o;
        }
        newPositionalAudio(e, t = 1, s = !1, o = 1) {
            const n = new cs(this.audioListener);
            return n.setBuffer(e), n.setVolume(0), n.setLoop(s), n.userData.originalVolume = t, n.setMaxDistance(o), this.files.push(n), n;
        }
        async initAsync() {
            const e = await Promise.all([
                this.audioLoader.loadAsync(Go),
                this.audioLoader.loadAsync(Ho),
                this.audioLoader.loadAsync(Wo),
                this.audioLoader.loadAsync(zo)
            ]);
            this.ambient = this.newAudio(e[0], .05, !0), this.lake = this.newPositionalAudio(e[1], 1, !0, 10), this.hitWood = this.newAudio(e[2], 0, !1), this.hitStone = this.newAudio(e[3], 0, !1), this.isReady = !0, F.emit("audio-ready");
        }
    }
    const ne = new Vo(Mt.manager);
    var j = ((l)=>(l.Player = "Player", l.Terrain = "Terrain", l.Wood = "Wood", l.Stone = "Stone", l))(j || {});
    const Zo = ()=>({
            minImpactSq: 5,
            maxImpactSq: 400,
            minImpactVolume: .01,
            maxImpactVolume: .25
        }), me = Zo();
    class jo {
        world;
        eventQueue;
        IS_DEBUGGING_ENABLED = !1;
        dummyVectorLinVel = new v;
        debugMesh;
        constructor(){
            this.IS_DEBUGGING_ENABLED && (this.debugMesh = this.createDebugMesh(), M.scene.add(this.debugMesh));
        }
        async initAsync() {
            return ls(()=>import("./@dimforge-CqaeYUkE.js").then(async (m)=>{
                    await m.__tla;
                    return m;
                }), []).then(()=>{
                this.world = new Hs({
                    x: 0,
                    y: -9.81,
                    z: 0
                }), this.eventQueue = new Ws(!0);
            });
        }
        getColliderName(e) {
            return e?.parent?.()?.userData?.type;
        }
        impactToVolume(e) {
            const t = Ke.mapLinear(e, me.minImpactSq, me.maxImpactSq, me.minImpactVolume, me.maxImpactVolume);
            return Ke.clamp(t, me.minImpactVolume, me.maxImpactVolume);
        }
        onCollisionWithWood(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < me.minImpactSq) return;
            const o = this.impactToVolume(s);
            ne.hitWood.setVolume(o), ne.hitWood.play();
        }
        onCollisionWithStone(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < me.minImpactSq) return;
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
            return new ds(new ct, new us);
        }
        updateDebugMesh() {
            if (!this.debugMesh) return;
            const e = this.world.debugRender();
            this.debugMesh.geometry.dispose(), this.debugMesh.geometry = new ct, this.debugMesh.geometry.setPositions(e.vertices), this.debugMesh.computeLineDistances();
        }
        update() {
            this.updateDebugMesh(), this.world.step(this.eventQueue), ne.isReady && this.handleCollisionSounds();
        }
    }
    const D = new jo;
    class Ko {
        constructor(){
            ("ontouchstart" in window || navigator.maxTouchPoints > 0) && document.body.classList.add("is-touch-device");
        }
        async initAsync() {
            await ge.init(), ne.initAsync(), await Promise.all([
                D.initAsync(),
                u.initAsync()
            ]);
        }
    }
    class qo {
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
    const de = new qo;
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
    const Fe = new Yo;
    class Jo {
        isForward() {
            return de.isKeyPressed("KeyW") || de.isKeyPressed("ArrowUp") || Fe.isForward();
        }
        isBackward() {
            return de.isKeyPressed("KeyS") || de.isKeyPressed("ArrowDown") || Fe.isBackward();
        }
        isLeftward() {
            return de.isKeyPressed("KeyA") || de.isKeyPressed("ArrowLeft") || Fe.isLeftward();
        }
        isRightward() {
            return de.isKeyPressed("KeyD") || de.isKeyPressed("ArrowRight") || Fe.isRightward();
        }
        isJumpPressed() {
            return de.isKeyPressed("Space");
        }
    }
    const Ee = new Jo, q = {
        LIGHT_POSITION_OFFSET: new v(10, 10, 10),
        directionalColor: new z(.85, .75, .7),
        directionalIntensity: .8,
        hemiSkyColor: new z(.6, .4, .5),
        hemiGroundColor: new z(.3, .2, .2),
        fogColor: new z(.29, .08, 0),
        fogDensity: .0046
    };
    class Xo {
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
            const e = new hs;
            return e.color.copy(q.hemiSkyColor), e.groundColor.copy(q.hemiGroundColor), e.intensity = .3, e.position.copy(q.LIGHT_POSITION_OFFSET), e;
        }
        setupDirectionalLighting() {
            const e = new ms;
            e.intensity = q.directionalIntensity, e.color.copy(q.directionalColor), e.position.copy(q.LIGHT_POSITION_OFFSET), e.target = new ps, e.castShadow = !0, e.shadow.mapSize.set(64, 64);
            const t = 1;
            return e.shadow.intensity = .85, e.shadow.camera.left = -t, e.shadow.camera.right = t, e.shadow.camera.top = t, e.shadow.camera.bottom = -t, e.shadow.camera.near = .01, e.shadow.camera.far = 30, e.shadow.normalBias = .1, e.shadow.bias = -.001, e;
        }
        setupFog() {
            return new fs(q.fogColor, q.fogDensity);
        }
        getTerrainShadowFactor = p(([e = E(0)])=>x(u.terrainShadowAo, e).r);
        debugLight() {
            const e = ce.panel.addFolder({
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
    const $e = new Xo, It = new gs, gt = new Oe;
    F.on("update-throttle-16x", ()=>{
        gt.multiplyMatrices(M.renderCamera.projectionMatrix, M.renderCamera.matrixWorldInverse), It.setFromProjectionMatrix(gt);
    });
    const $o = (l)=>(l.geometry.boundingSphere || l.geometry.computeBoundingSphere(), It.intersectsObject(l)), Qo = p(([l])=>{});
    class en extends pe {
        mainBuffer;
        constructor(e){
            let t, s, o = Qo;
            switch(super(new yt, void 0, e.count), this.mainBuffer = Pe(e.count, "vec4"), this.mainBuffer.setPBO(!0), e.preset){
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
                $o(this) && ge.renderer.computeAsync(n);
            });
        }
    }
    const tn = (l, e)=>{
        const { speed: t = .5, radius: s = 1, height: o = 1, lifetime: n = 1, scale: a = 1, detail: r = 4, coneFactor: c = 1 } = l, d = o * 1.5, h = n * .75, m = Pe(l.count, "float"), b = .95, w = p(([et])=>{
            const We = k(A.add(12345)), Ae = m.element(A), Be = I(b, We);
            Ae.assign(Be);
        }), S = p(([et])=>{
            const We = et.element(A), Ae = m.element(A), Be = k(A), ze = B(n, h, Ae), Ce = ee.mul(t).add(Be.mul(ze)).mod(ze).div(ze), Ve = i(1).sub(i(1).sub(Ce).pow(2)), tt = B(o, d, Ae), st = Ve.mul(tt), ot = k(A.add(7890)).mul(be), Dt = k(A.add(5678)), vt = i(1).sub(i(1).sub(Dt).pow(2)), Bt = i(1).sub(Ve.mul(c)), Ct = Z(0, .35, Ve), Nt = fe(ee.mul(.5)).mul(.05).add(1), Rt = B(s * .25, s, Ct).mul(Bt).mul(Nt), Ft = vt.mul(Rt), Ut = I(.5, ot).mul(2).sub(1), nt = ot.add(Ce.mul(be).mul(.05).mul(Ut)), Ot = B(1, .85, Ae), at = Be.sub(.5).mul(.05).mul(Ce), kt = Z(0, .75, Ce).mul(Ae), it = Ft.add(kt.mul(Ot)), Gt = bt(nt.add(at)).mul(it), Ht = fe(nt.add(at)).mul(it), rt = st.div(tt), Wt = Z(0, .5, rt), zt = i(1).sub(Z(.5, 1, rt)), Vt = Wt.mul(zt);
            We.assign(U(Gt, st, Ht, Vt));
        }), y = new St;
        y.precision = "lowp", y.transparent = !0, y.depthWrite = !1, y.blending = ws, y.blendEquation = ys, y.blendSrc = bs, y.blendDst = Ss;
        const O = e.element(A), W = m.element(A), G = k(A.add(9234)), H = k(A.add(33.87));
        y.positionNode = O.xyz;
        const K = i(1).sub(W.mul(.85)), te = H.clamp(.25, 1);
        y.scaleNode = te.mul(O.w).mul(K).mul(a);
        const ue = I(.5, G).mul(.5), V = I(.5, H).mul(.5), he = R().mul(.5).add(E(ue, V)), se = x(u.fireSprites, he, r), Q = L(.72, .62, .08).mul(2).toConst(), Y = L(1, .1, 0).mul(4).toConst(), we = L(0).toConst(), Le = B(o, d, W), _e = Z(0, 1, Te.y.div(Le)).pow(2), De = Z(0, .25, _e), ve = B(Q, Y, De), Ge = Z(.9, 1, _e), He = B(ve, we, Ge), Et = i(1).sub(Z(0, .85, _e)), Pt = I(.65, H).mul(Et), Qe = i(.5).toConst(), Tt = se.a.mul(Pt).mul(Qe);
        return y.colorNode = B(He, Y, W).mul(Tt).mul(1.5), y.alphaTest = .1, y.opacityNode = O.w.mul(se.a).mul(Qe), {
            material: y,
            onInit: w,
            onUpdate: S
        };
    };
    class sn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("campfire");
            e.material = new As({
                map: u.campfireDiffuse
            });
            const t = new en({
                preset: "fire",
                count: 512,
                speed: .65,
                radius: .75,
                workGroupSize: 256
            });
            t.position.copy(e.position).setY(.25), M.scene.add(e, t);
            const s = ie.fixed().setTranslation(...e.position.toArray()).setRotation(e.quaternion).setUserData({
                type: j.Stone
            }), o = D.world.createRigidBody(s);
            e.geometry.computeBoundingSphere();
            const { radius: n } = e.geometry.boundingSphere, a = re.ball(n).setRestitution(.75);
            D.world.createCollider(a, o);
        }
    }
    class on extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = x(u.trunkDiffuse, R());
            this.colorNode = e.mul(1.75), this.normalMap = u.trunkNormal;
        }
    }
    class nn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.map = u.axeDiffuse, this.emissiveMap = u.axeEmissive, this.emissiveIntensity = 35, this.emissive = new z("lightblue");
        }
    }
    class an {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("kratos_axe");
            e.material = new nn;
            const t = u.realmModel.scene.getObjectByName("tree_trunk");
            t.material = new on, M.scene.add(e, t);
            const s = u.realmModel.scene.getObjectByName("axe_collider"), o = ie.fixed().setTranslation(...s.position.toArray()).setRotation(s.quaternion).setUserData({
                type: j.Wood
            }), n = D.world.createRigidBody(o), a = s.geometry.boundingBox.max, r = re.cuboid(a.x, a.y, a.z).setRestitution(.75);
            D.world.createCollider(r, n);
            const c = u.realmModel.scene.getObjectByName("trunk_collider"), { x: d, y: h } = c.geometry.boundingBox.max, m = ie.fixed().setTranslation(...c.position.toArray()).setRotation(c.quaternion).setUserData({
                type: j.Wood
            }), b = D.world.createRigidBody(m), w = d, S = h / 2, y = re.capsule(S, w).setRestitution(.75);
            D.world.createCollider(y, b);
        }
    }
    class rn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("jojo_mask");
            e.material = new cn;
            const t = u.realmModel.scene.children.filter((n)=>n.name.startsWith("jojo_symbol")), s = new ln, o = new pe(t[0].geometry, s, t.length);
            for(let n = 0; n < t.length; n++){
                const a = t[n];
                o.setMatrixAt(n, a.matrix);
            }
            M.scene.add(e, o);
        }
    }
    class cn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const { stoneDiffuse: e } = u.atlasesCoords.stones, t = T.computeAtlasUv(E(...e.scale), E(...e.offset), R()), s = x(u.stoneAtlas, t);
            this.colorNode = s;
        }
    }
    class ln extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const e = lt("#eb5694"), t = lt("#9642D3");
            this.colorNode = B(t, e, R().y.mul(.5)).mul(.45);
            const s = ee.mul(20), o = fe(s.add(A)), n = I(0, o).mul(.25);
            this.positionNode = Te.add(n);
        }
    }
    class dn extends xs {
        uScale = g(1);
        constructor(){
            super();
            const e = x(u.kunaiDiffuse, R());
            this.colorNode = e.mul(5);
            const t = x(u.kunaiMR, R());
            this.metalnessNode = t.b.mul(.75), this.roughnessNode = t.g;
        }
    }
    class un {
        constructor(){
            const e = u.realmModel.scene.children.filter(({ name: c })=>c.startsWith("kunai")), t = u.realmModel.scene.getObjectByName("base_kunai"), s = new dn, o = new pe(t.geometry, s, e.length), { x: n, y: a, z: r } = t.geometry.boundingBox.max;
            e.forEach((c, d)=>{
                o.setMatrixAt(d, c.matrix);
                const h = ie.fixed().setTranslation(...c.position.toArray()).setRotation(c.quaternion).setUserData({
                    type: j.Wood
                }), m = D.world.createRigidBody(h), b = re.cuboid(n, a, r).setRestitution(.75);
                D.world.createCollider(b, m);
            }), M.scene.add(o);
        }
    }
    class hn extends $ {
        constructor(){
            super(), this.map = u.onePieceAtlas, this.side = Je;
        }
    }
    class mn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("one_piece_posters");
            e.material = new hn, M.scene.add(e);
        }
    }
    class pn {
        constructor(){
            new an, new mn, new rn, new un, new sn;
        }
    }
    const Lt = {
        uBaseColor: g(new z),
        uRandom: g(0)
    };
    class fn extends $ {
        _uniforms;
        constructor(e){
            super(), this._uniforms = {
                ...Lt,
                ...e
            }, this.createMaterial();
        }
        setRandomSeed(e) {
            this._uniforms.uRandom.value = e;
        }
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = ae(R().mul(2).add(this._uniforms.uRandom)), { stoneDiffuse: t, stoneNormalAo: s } = u.atlasesCoords.stones, o = T.computeAtlasUv(E(...t.scale), E(...t.offset), e), n = x(u.stoneAtlas, o);
            this.colorNode = n.mul(1.5);
            const a = T.computeAtlasUv(E(...s.scale), E(...s.offset), e), r = x(u.stoneAtlas, a);
            this.normalNode = new ke(r.rgb, i(.5)), this.aoNode = r.a;
        }
    }
    class gn {
        uniforms = Lt;
        constructor(){
            const e = new fn(this.uniforms), t = u.realmModel.scene.children.filter(({ name: o })=>o.endsWith("_monument"));
            t.forEach((o, n)=>{
                const a = Ke.seededRandom(n);
                o.material = e, o.receiveShadow = !0, o.onBeforeRender = (r, c, d, h, m)=>{
                    m.setRandomSeed(a);
                };
            }), M.scene.add(...t), u.realmModel.scene.children.filter(({ name: o })=>o.startsWith("monument_collider")).forEach((o)=>{
                const n = ie.fixed().setTranslation(...o.position.toArray()).setRotation(o.quaternion).setUserData({
                    type: j.Stone
                }), a = D.world.createRigidBody(n), r = .5 * o.scale.x, c = .5 * o.scale.y, d = .5 * o.scale.z, h = re.cuboid(r, c, d).setRestitution(.75);
                D.world.createCollider(h, a);
            }), this.debugMonuments();
        }
        debugMonuments() {
            const e = ce.panel.addFolder({
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
    const N = {
        uUvScale: g(3),
        uRefractionStrength: g(.02),
        uWaterColor: g(new z(0, .09, .09)),
        uFresnelScale: g(.075),
        uSpeed: g(.1),
        uNoiseScrollDir: g(new Ie(.1, 0)),
        uShiness: g(400),
        uMinDist: g(10),
        uMaxDist: g(50),
        uFromSunDir: g(new v(0, -1, 0))
    };
    class wn {
        constructor(){
            N.uFromSunDir.value.copy($e.sunDirection);
            const e = u.realmModel.scene.getObjectByName("water");
            e.material = new yn, e.renderOrder = 100;
            const s = e.geometry.boundingSphere;
            s.radius = s.radius * .75, M.scene.add(e), F.on("audio-ready", ()=>{
                e.add(ne.lake);
            });
        }
    }
    class yn extends At {
        constructor(){
            super(), this.createMaterial(), this.debugWater();
        }
        debugWater() {
            const e = ce.panel.addFolder({
                title: "🌊 Water",
                expanded: !1
            });
            e.addBinding(N.uSpeed, "value", {
                label: "Speed"
            }), e.addBinding(N.uUvScale, "value", {
                label: "UV scale"
            }), e.addBinding(N.uRefractionStrength, "value", {
                label: "Refraction strength"
            }), e.addBinding(N.uShiness, "value", {
                label: "Shiness"
            }), e.addBinding(N.uFresnelScale, "value", {
                label: "Fresnel scale"
            }), e.addBinding(N.uMinDist, "value", {
                label: "Opacity min dist"
            }), e.addBinding(N.uMaxDist, "value", {
                label: "Opacity max dist"
            }), e.addBinding(N.uWaterColor, "value", {
                label: "Water color",
                view: "color",
                color: {
                    type: "float"
                }
            });
        }
        createMaterial() {
            this.precision = "lowp";
            const e = ee.mul(N.uSpeed), t = N.uNoiseScrollDir.mul(e), s = R().add(t).mul(N.uUvScale).fract(), o = x(u.waterNormal, s).mul(2).sub(1), n = R().sub(t).mul(N.uUvScale).fract(), a = x(u.waterNormal, n).mul(2).sub(1), r = o.add(a).rgb.normalize(), c = r.xy.mul(N.uRefractionStrength), d = dt(Ze, 3).r, h = ut.element(3).element(2), m = ut.element(2).element(2), b = h.div(d.add(m)), w = Ms.z.negate(), S = I(w, b), y = Ze.add(c.mul(S)), O = dt(y, 3).r, W = h.div(O.add(m)), G = I(w, W), H = Is(je.sub(X)), K = Ls.add(r).normalize(), te = _s(u.envMapTexture, K, 3), ue = Es(Ps(i(1).sub(K))), V = N.uFresnelScale.mul(ue), le = B(N.uWaterColor, te, V), he = B(Ze, y, G), se = Ts(he, Ds(3)).rgb, Q = vs(N.uFromSunDir, r.rbg), Y = Ue(ht(Q, H), 0), we = Xe(Y, N.uShiness), Le = L(we), _e = ht(X.xz.sub(je.xz), X.xz.sub(je.xz)), De = N.uMinDist, ve = N.uMaxDist, Ge = B(.05, .5, Z(De.mul(De), ve.mul(ve), _e)), He = B(se, le, Ge);
            this.colorNode = He.add(Le);
        }
    }
    const wt = 20;
    class bn extends $ {
        _noiseBuffer;
        constructor(){
            super(), this._noiseBuffer = Pe(wt, "float"), this._noiseBuffer.setPBO(!0), ge.renderer.computeAsync(this.computeInit), this.precision = "lowp", this.flatShading = !1;
            const e = k(A), t = this._noiseBuffer.element(A), s = I(.5, t), o = i(1).sub(s), n = ae(R().mul(3.6).add(e)), a = ae(R().mul(1.5).add(e)), r = n.mul(s).add(a.mul(o)), { stoneDiffuse: c, stoneNormalAo: d, stoneMossyDiffuse: h, stoneMossyNormalAo: m } = u.atlasesCoords.stones, b = E(...c.scale).mul(s), w = E(...h.scale).mul(o), S = b.add(w), y = E(...c.offset).mul(s), O = E(...h.offset).mul(o), W = y.add(O), G = T.computeAtlasUv(S, W, r);
            this.colorNode = x(u.stoneAtlas, G);
            const H = E(...d.scale).mul(s), K = E(...m.scale).mul(o), te = H.add(K), ue = E(...d.offset).mul(s), V = E(...m.offset).mul(o), le = ue.add(V), he = T.computeAtlasUv(te, le, r), se = x(u.stoneAtlas, he);
            this.normalNode = new ke(se.rgb, i(3)), this.normalScale = new Ie(1, -1), this.aoNode = se.a;
        }
        computeInit = p(()=>{
            const e = this._noiseBuffer.element(A), t = E(k(A), k(A).mul(21.63)).fract(), s = x(u.noiseTexture, t);
            e.assign(s.r);
        })().compute(wt);
    }
    class Sn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("stone"), t = u.realmModel.scene.children.filter(({ name: n })=>n.startsWith("stone_collider")), s = new bn, o = new pe(e.geometry, s, t.length);
            o.receiveShadow = !0, t.forEach((n, a)=>{
                o.setMatrixAt(a, n.matrix);
                const r = ie.fixed().setTranslation(...n.position.toArray()).setRotation(n.quaternion).setUserData({
                    type: j.Stone
                }), c = D.world.createRigidBody(r);
                n.geometry.computeBoundingBox();
                const d = n.geometry.boundingBox.max.x * n.scale.x, h = re.ball(d).setRestitution(.75);
                D.world.createCollider(h, c);
            }), M.scene.add(o);
        }
    }
    const An = {
        uGrassTerrainColor: g(new z().setRGB(.74, .51, 0)),
        uWaterSandColor: g(new z().setRGB(.54, .39, .2)),
        uPathSandColor: g(new z().setRGB(.65, .49, .27))
    };
    class xn extends $ {
        _uniforms = {
            ...An
        };
        constructor(){
            super(), this.createMaterial(), this.debugTerrain();
        }
        debugTerrain() {
            const e = ce.panel.addFolder({
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
        computeCausticsDiffuse = p(([e = E(0, 0), t = i(0), s = L(0, 0, 0)])=>{
            const o = ee.mul(.15), n = e.mul(17), a = ae(n.add(E(o, 0))), r = x(u.noiseTexture, a, 1).g, c = e.mul(33), d = ae(c.add(E(0, o.negate()))), h = x(u.noiseTexture, d, 3).g, m = r.add(h), b = Z(-1, 7.5, t), w = Xe(m, 3).mul(i(1).sub(b)), S = L(.6, .8, 1).mul(.5);
            return B(s, S, w);
        });
        computeWaterDiffuse = p(([e = i(0), t = E(0, 0)])=>{
            const s = i(8), o = i(.001), n = Z(0, s.add(o), e), a = this._uniforms.uWaterSandColor, r = L(.35, .45, .55).mul(.65), c = this.computeCausticsDiffuse(t, e), d = Z(0, 1.5, e), h = L(1, .9, .7).mul(.1).mul(d);
            return B(a, r, n).add(h).add(c);
        });
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = T.computeMapUvByPosition(X.xz), t = qe(e), s = x(u.terrainShadowAo, R().clamp());
            this.aoNode = s.g;
            const o = x(u.terrainTypeMap, t, 2.5), n = o.g, a = o.b, c = i(1).sub(n).sub(a), d = x(u.sandNormal, ae(t.mul(30))), h = ae(t.mul(30)), b = x(u.grassNormal, h).dot(d).mul(.65), w = x(u.grassDiffuse, h), S = i(1).sub(w.a), y = this._uniforms.uGrassTerrainColor.mul(S).add(w).mul(n).mul(.85), O = this._uniforms.uPathSandColor.mul(1.2).mul(c), W = qe(X.y.negate()), H = this.computeWaterDiffuse(W, t).mul(a), K = y.add(O.mul(b)).add(H.mul(b).mul(.5));
            this.colorNode = K.mul(s.r);
        }
    }
    class Mn {
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
            const o = e.geometry.boundingBox, n = s.count, a = Math.sqrt(n), r = o.max.x, c = new Float32Array(n);
            for(let d = 0; d < n; d++){
                const h = s.array[d * 3 + 0], m = s.array[d * 3 + 1], b = s.array[d * 3 + 2], w = Math.round((h / (r * 2) + .5) * (a - 1)), y = Math.round((b / (r * 2) + .5) * (a - 1)) + w * a;
                c[y] = m;
            }
            return {
                rowsCount: a,
                heights: c,
                displacement: t
            };
        }
        createFloorPhysics() {
            const e = this.getFloorDisplacementData(), { rowsCount: t, heights: s, displacement: o } = e, n = ie.fixed().setTranslation(0, -o, 0).setUserData({
                type: j.Terrain
            }), a = D.world.createRigidBody(n), r = re.heightfield(t - 1, t - 1, s, {
                x: J.MAP_SIZE,
                y: 1,
                z: J.MAP_SIZE
            }, zs.FIX_INTERNAL_EDGES).setFriction(1).setRestitution(.2);
            D.world.createCollider(r, a);
        }
    }
    class In {
        outerFloor;
        kintoun;
        kintounPosition = new v;
        constructor(e){
            this.outerFloor = this.createOuterFloorVisual(), this.outerFloor.material = e, this.kintoun = this.createKintoun(), M.scene.add(this.outerFloor), F.on("update", this.update.bind(this));
        }
        createOuterFloorVisual() {
            const e = u.realmModel.scene.getObjectByName("outer_world");
            return e.receiveShadow = !0, e;
        }
        createKintoun() {
            const e = ie.kinematicPositionBased().setTranslation(0, -20, 0).setUserData({
                type: j.Terrain
            }), t = D.world.createRigidBody(e), s = 2, o = re.cuboid(s, J.HALF_FLOOR_THICKNESS, s).setFriction(1).setRestitution(.2);
            return D.world.createCollider(o, t), t;
        }
        useKintoun(e) {
            this.kintounPosition.copy(e).setY(-J.HALF_FLOOR_THICKNESS), this.kintoun.setTranslation(this.kintounPosition, !0);
        }
        update(e) {
            const { player: t } = e, s = J.HALF_MAP_SIZE - Math.abs(t.position.x) < J.KINTOUN_ACTIVATION_THRESHOLD, o = J.HALF_MAP_SIZE - Math.abs(t.position.z) < J.KINTOUN_ACTIVATION_THRESHOLD;
            (s || o) && this.useKintoun(t.position);
            const n = J.MAP_SIZE, a = Math.abs(t.position.x), r = Math.sign(t.position.x), c = Math.abs(t.position.z), d = Math.sign(t.position.z), h = a > n ? a - n : 0, m = c > n ? c - n : 0;
            this.outerFloor.position.set(h * r, 0, m * d);
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
            BLADE_HEIGHT: 1.45,
            BLADE_BOUNDING_SPHERE_RADIUS: 1.45,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            BLADES_PER_SIDE: 512,
            COUNT: 512 * 512,
            SPACING: 150 / 512,
            WORKGROUP_SIZE: 256
        }), _ = _n(), f = {
        uPlayerPosition: g(new v(0, 0, 0)),
        uCameraMatrix: g(new Oe),
        uBladeMinScale: g(.5),
        uBladeMaxScale: g(1.25),
        uTrailGrowthRate: g(.004),
        uTrailMinScale: g(.25),
        uTrailRaius: g(.65),
        uTrailRaiusSquared: g(.65 * .65),
        uGlowRadius: g(2),
        uGlowRadiusSquared: g(4),
        uGlowFadeIn: g(.05),
        uGlowFadeOut: g(.01),
        uGlowColor: g(new z().setRGB(.39, .14, .02)),
        uBladeMaxBendAngle: g(Math.PI * .15),
        uWindStrength: g(.6),
        uBaseColor: g(new z().setRGB(.07, .07, 0)),
        uTipColor: g(new z().setRGB(.23, .11, .05)),
        uDelta: g(new Ie(0, 0)),
        uGlowMul: g(3),
        uR0: g(40),
        uR1: g(65),
        uPMin: g(.22),
        uWindSpeed: g(.25)
    };
    class En {
        buffer;
        constructor(){
            this.buffer = Pe(_.COUNT, "vec4"), this.computeUpdate.onInit(({ renderer: e })=>{
                e.computeAsync(this.computeInit);
            });
        }
        get computeBuffer() {
            return this.buffer;
        }
        getYaw = p(([e = U(0)])=>T.unpackUnits(e.z, 0, 12, -Math.PI, Math.PI));
        getBend = p(([e = U(0)])=>T.unpackUnits(e.z, 12, 12, -Math.PI, Math.PI));
        getScale = p(([e = U(0)])=>T.unpackUnits(e.w, 0, 8, f.uBladeMinScale, f.uBladeMaxScale));
        getOriginalScale = p(([e = U(0)])=>T.unpackUnits(e.w, 8, 8, f.uBladeMinScale, f.uBladeMaxScale));
        getShadow = p(([e = U(0)])=>T.unpackFlag(e.w, 16));
        getVisibility = p(([e = U(0)])=>T.unpackFlag(e.w, 17));
        getGlow = p(([e = U(0)])=>T.unpackUnit(e.w, 18, 6));
        setYaw = p(([e = U(0), t = i(0)])=>(e.z = T.packUnits(e.z, 0, 12, t, -Math.PI, Math.PI), e));
        setBend = p(([e = U(0), t = i(0)])=>(e.z = T.packUnits(e.z, 12, 12, t, -Math.PI, Math.PI), e));
        setScale = p(([e = U(0), t = i(0)])=>(e.w = T.packUnits(e.w, 0, 8, t, f.uBladeMinScale, f.uBladeMaxScale), e));
        setOriginalScale = p(([e = U(0), t = i(0)])=>(e.w = T.packUnits(e.w, 8, 8, t, f.uBladeMinScale, f.uBladeMaxScale), e));
        setShadow = p(([e = U(0), t = i(0)])=>(e.w = T.packFlag(e.w, 16, t), e));
        setVisibility = p(([e = U(0), t = i(0)])=>(e.w = T.packFlag(e.w, 17, t), e));
        setGlow = p(([e = U(0), t = i(0)])=>(e.w = T.packUnit(e.w, 18, 6, t), e));
        computeInit = p(()=>{
            const e = this.buffer.element(A), t = Se(i(A).div(_.BLADES_PER_SIDE)), s = i(A).mod(_.BLADES_PER_SIDE), o = k(A.add(4321)), n = k(A.add(1234)), a = s.mul(_.SPACING).sub(_.TILE_HALF_SIZE).add(o.mul(_.SPACING * .5)), r = t.mul(_.SPACING).sub(_.TILE_HALF_SIZE).add(n.mul(_.SPACING * .5)), c = L(a, 0, r).xz.add(_.TILE_HALF_SIZE).div(_.TILE_SIZE).abs(), d = x(u.noiseTexture, c), h = d.r.sub(.5).mul(17).fract(), m = d.b.sub(.5).mul(13).fract();
            e.x = a.add(h), e.y = r.add(m);
            const b = d.b.sub(.5).mul(i(Math.PI * 2));
            e.assign(this.setYaw(e, b));
            const w = f.uBladeMaxScale.sub(f.uBladeMinScale), S = d.r.mul(w).add(f.uBladeMinScale);
            e.assign(this.setScale(e, S)), e.assign(this.setOriginalScale(e, S));
        })().compute(_.COUNT, [
            _.WORKGROUP_SIZE
        ]);
        computeStochasticKeep = p(([e = L(0)])=>{
            const t = e.x.sub(f.uPlayerPosition.x), s = e.z.sub(f.uPlayerPosition.z), o = t.mul(t).add(s.mul(s)), n = f.uR0, a = f.uR1, r = f.uPMin, c = n.mul(n), d = a.mul(a), h = Ye(o.sub(c).div(Ue(d.sub(c), 1e-5)), 0, 1), m = B(1, r, h), b = k(i(A).mul(.73));
            return I(b, m);
        });
        computeVisibility = p(([e = L(0)])=>{
            const t = f.uCameraMatrix.mul(U(e, 1)), s = t.xyz.div(t.w), o = _.BLADE_BOUNDING_SPHERE_RADIUS, n = i(1);
            return I(n.negate().sub(o), s.x).mul(I(s.x, n.add(o))).mul(I(n.negate().sub(o), s.y)).mul(I(s.y, n.add(o))).mul(I(0, s.z)).mul(I(s.z, n));
        });
        computeBending = p(([e = i(0), t = L(0)])=>{
            const s = t.xz.add(ee.mul(f.uWindSpeed)).mul(.5).fract(), n = x(u.noiseTexture, s, 2).r.mul(f.uWindStrength);
            return e.add(n.sub(e).mul(.1));
        });
        computeAlpha = p(([e = L(0)])=>{
            const t = T.computeMapUvByPosition(e.xz), s = x(u.terrainTypeMap, t).g;
            return I(.25, s);
        });
        computeTrailScale = p(([e = i(0), t = i(0), s = i(0)])=>{
            const o = t.add(f.uTrailGrowthRate), n = i(1).sub(s), a = f.uTrailMinScale.mul(s).add(o.mul(n));
            return Cs(a, e);
        });
        computeTrailGlow = p(([e = i(0), t = i(0), s = i(0), o = i(0)])=>{
            const n = Z(f.uGlowRadiusSquared, i(0), t), a = 100, r = Se(mt(f.uDelta.x).mul(a)), c = Se(mt(f.uDelta.y).mul(a)), d = I(1, r.add(c)), h = n.mul(i(1).sub(s)).mul(o), m = Ue(d, e).mul(h), b = m.mul(f.uGlowFadeIn), w = i(1).sub(m).mul(f.uGlowFadeOut), S = i(1).sub(d).mul(f.uGlowFadeOut).mul(e);
            return Ye(e.add(b).sub(w).sub(S), 0, 1);
        });
        computeShadow = p(([e = L(0)])=>{
            const t = T.computeMapUvByPosition(e.xz), s = x(u.terrainShadowAo, t);
            return I(.65, s.r);
        });
        computeUpdate = p(()=>{
            const e = this.buffer.element(A), t = Me(e.x.sub(f.uDelta.x).add(_.TILE_HALF_SIZE), _.TILE_SIZE).sub(_.TILE_HALF_SIZE), s = Me(e.y.sub(f.uDelta.y).add(_.TILE_HALF_SIZE), _.TILE_SIZE).sub(_.TILE_HALF_SIZE), o = L(t, 0, s);
            e.x = t, e.y = s;
            const n = o.add(f.uPlayerPosition), a = this.computeStochasticKeep(n), r = this.computeVisibility(n).mul(a);
            e.assign(this.setVisibility(e, r)), xt(r, ()=>{
                const c = E(f.uDelta.x, f.uDelta.y), d = o.xz.sub(c), h = d.dot(d), m = I(.1, i(1).sub(f.uPlayerPosition.y)), b = I(h, f.uTrailRaiusSquared).mul(m), w = this.getScale(e), S = this.getOriginalScale(e), y = this.computeTrailScale(S, w, b);
                e.assign(this.setScale(e, y));
                const O = this.computeAlpha(n);
                e.assign(this.setVisibility(e, O));
                const W = this.getBend(e), G = this.computeBending(W, n);
                e.assign(this.setBend(e, G));
                const H = this.getGlow(e), K = this.computeTrailGlow(H, h, b, m);
                e.assign(this.setGlow(e, K));
                const te = this.computeShadow(n);
                e.assign(this.setShadow(e, te));
            });
        })().compute(_.COUNT, [
            _.WORKGROUP_SIZE
        ]);
    }
    class Pn extends At {
        ssbo;
        constructor(e){
            super(), this.ssbo = e, this.createGrassMaterial();
        }
        computePosition = p(([e = i(0), t = i(0), s = i(0), o = i(0), n = i(0), a = i(0)])=>{
            const r = L(e, 0, t), c = o.mul(R().y), h = pt(Te, L(c, 0, 0)).mul(L(1, n, 1)), m = pt(h, L(0, s, 0)), b = k(A).mul(be), w = fe(ee.mul(5).add(o).add(b)).mul(.1), S = R().y.mul(a), y = w.mul(S);
            return m.add(r).add(L(y));
        });
        computeDiffuseColor = p(([e = i(0), t = i(1)])=>{
            const s = B(f.uBaseColor, f.uTipColor, R().y), o = B(s, f.uGlowColor.mul(f.uGlowMul), e);
            return B(o.mul(.5), o, t);
        });
        createGrassMaterial() {
            this.precision = "lowp", this.side = Je;
            const e = this.ssbo.computeBuffer.element(A), t = e.x, s = e.y, o = this.ssbo.getYaw(e), n = this.ssbo.getBend(e), a = this.ssbo.getScale(e), r = this.ssbo.getVisibility(e), c = this.ssbo.getGlow(e), d = this.ssbo.getShadow(e);
            Ns(r.equal(0)), this.positionNode = this.computePosition(t, s, o, n, a, c), this.opacityNode = r, this.alphaTest = .5, this.colorNode = this.computeDiffuseColor(c, d);
        }
    }
    class Tn {
        constructor(){
            const e = new En, t = this.createGeometry(3), s = new Pn(e), o = new pe(t, s, _.COUNT);
            o.frustumCulled = !1, M.scene.add(o), F.on("update-throttle-2x", ({ player: n })=>{
                const a = n.position.x - o.position.x, r = n.position.z - o.position.z;
                f.uDelta.value.set(a, r), f.uPlayerPosition.value.copy(n.position), f.uCameraMatrix.value.copy(M.playerCamera.projectionMatrix).multiply(M.playerCamera.matrixWorldInverse), o.position.copy(n.position).setY(0), ge.renderer.computeAsync(e.computeUpdate);
            }), this.debugGrass();
        }
        debugGrass() {
            const e = ce.panel.addFolder({
                title: "🌱 Grass",
                expanded: !1
            });
            e.addBinding(f.uTipColor, "value", {
                label: "Tip Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(f.uBaseColor, "value", {
                label: "Base Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(f.uGlowColor, "value", {
                label: "Glow Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(f.uWindStrength, "value", {
                label: "Wind strength",
                min: 0,
                max: Math.PI / 2,
                step: .1
            }), e.addBinding(f.uWindSpeed, "value", {
                label: "Wind speed",
                min: 0,
                max: 5,
                step: .01
            }), e.addBinding(f.uGlowMul, "value", {
                label: "Glow bloom",
                min: 1,
                max: 20,
                step: .01
            }), e.addBinding(f.uR0, "value", {
                label: "Inner ring",
                min: 0,
                max: _.TILE_SIZE,
                step: .1
            }), e.addBinding(f.uR1, "value", {
                label: "Outer ring",
                min: 0,
                max: _.TILE_SIZE,
                step: .1
            }), e.addBinding(f.uPMin, "value", {
                label: "P Min",
                min: 0,
                max: 1,
                step: .01
            });
        }
        createGeometry(e) {
            const t = Math.max(1, Math.floor(e)), s = _.BLADE_HEIGHT, o = _.BLADE_WIDTH * .5, n = t, a = n * 2 + 1, c = Math.max(0, n - 1) * 6 + 3, d = new Float32Array(a * 3), h = new Float32Array(a * 2), m = new Uint8Array(c), b = new Float32Array(0), w = (V)=>o * (1 - .7 * V);
            let S = 0;
            for(let V = 0; V < n; V++){
                const le = V / t, he = le * s, se = w(le), Q = V * 2, Y = Q + 1;
                if (d[3 * Q + 0] = -se, d[3 * Q + 1] = he, d[3 * Q + 2] = 0, d[3 * Y + 0] = se, d[3 * Y + 1] = he, d[3 * Y + 2] = 0, h[2 * Q + 0] = 0, h[2 * Q + 1] = le, h[2 * Y + 0] = 1, h[2 * Y + 1] = le, V > 0) {
                    const we = (V - 1) * 2, Le = we + 1;
                    m[S++] = we, m[S++] = Le, m[S++] = Y, m[S++] = we, m[S++] = Y, m[S++] = Q;
                }
            }
            const y = n * 2;
            d[3 * y + 0] = 0, d[3 * y + 1] = s, d[3 * y + 2] = 0, h[2 * y + 0] = .5, h[2 * y + 1] = 1;
            const O = (n - 1) * 2, W = O + 1;
            m[S++] = O, m[S++] = W, m[S++] = y;
            const G = new Bs, H = new Ne(d, 3);
            H.setUsage(Re), G.setAttribute("position", H);
            const K = new Ne(h, 2);
            K.setUsage(Re), G.setAttribute("uv", K);
            const te = new Ne(m, 1);
            te.setUsage(Re), G.setIndex(te);
            const ue = new Ne(b, 3);
            return ue.setUsage(Re), G.setAttribute("normal", ue), G;
        }
    }
    const Dn = ()=>({
            FLOWER_WIDTH: .5,
            FLOWER_HEIGHT: 1,
            BLADE_BOUNDING_SPHERE_RADIUS: 1,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            FLOWERS_PER_SIDE: 25,
            COUNT: 625,
            SPACING: 150 / 25
        }), C = Dn();
    class vn {
        flowerField;
        material;
        uniforms = {
            ..._t,
            uDelta: g(new Ie(0, 0)),
            uPlayerPosition: g(new v(0, 0, 0)),
            uCameraMatrix: g(new Oe)
        };
        constructor(){
            this.material = new Bn(this.uniforms), this.flowerField = new pe(new yt(1, 1), this.material, C.COUNT), M.scene.add(this.flowerField), F.on("update", this.updateAsync.bind(this));
        }
        async updateAsync(e) {
            const { player: t } = e, s = t.position.x - this.flowerField.position.x, o = t.position.z - this.flowerField.position.z;
            this.uniforms.uDelta.value.set(s, o), this.uniforms.uPlayerPosition.value.copy(t.position), this.uniforms.uCameraMatrix.value.copy(M.playerCamera.projectionMatrix).multiply(M.playerCamera.matrixWorldInverse), this.flowerField.position.copy(t.position).setY(0), this.material.updateAsync();
        }
    }
    const _t = {
        uPlayerPosition: g(new v(0, 0, 0)),
        uCameraMatrix: g(new Oe),
        uDelta: g(new Ie(0, 0))
    };
    class Bn extends St {
        _uniforms;
        _buffer1;
        constructor(e){
            super(), this._uniforms = {
                ..._t,
                ...e
            }, this._buffer1 = Pe(C.COUNT, "vec4"), this._buffer1.setPBO(!0), this.computeUpdate.onInit(({ renderer: t })=>{
                t.computeAsync(this.computeInit);
            }), this.createMaterial();
        }
        computeInit = p(()=>{
            const e = this._buffer1.element(A), t = Se(i(A).div(C.FLOWERS_PER_SIDE)), s = i(A).mod(C.FLOWERS_PER_SIDE), o = k(A.add(4321)), n = k(A.add(1234)), a = s.mul(C.SPACING).sub(C.TILE_HALF_SIZE).add(o.mul(C.SPACING * .5)), r = t.mul(C.SPACING).sub(C.TILE_HALF_SIZE).add(n.mul(C.SPACING * .5)), c = L(a, 0, r).xz.add(C.TILE_HALF_SIZE).div(C.TILE_SIZE).abs(), h = x(u.noiseTexture, c).r, m = h.sub(.5).mul(100), b = h.clamp(.5, .75), w = h.sub(.5).mul(50);
            e.x = a.add(m), e.y = b, e.z = r.add(w);
        })().compute(C.COUNT);
        computeVisibility = p(([e = L(0)])=>{
            const t = this._uniforms.uCameraMatrix.mul(U(e, 1)), s = t.xyz.div(t.w), o = C.BLADE_BOUNDING_SPHERE_RADIUS, n = i(1);
            return I(n.negate().sub(o), s.x).mul(I(s.x, n.add(o))).mul(I(n.negate().sub(o), s.y)).mul(I(s.y, n.add(o))).mul(I(0, s.z)).mul(I(s.z, n));
        });
        computeAlpha = p(([e = L(0)])=>{
            const t = T.computeMapUvByPosition(e.xz);
            return x(u.terrainTypeMap, t).g;
        });
        computeUpdate = p(()=>{
            const e = this._buffer1.element(A), t = Me(e.x.sub(this._uniforms.uDelta.x).add(C.TILE_HALF_SIZE), C.TILE_SIZE).sub(C.TILE_HALF_SIZE), s = Me(e.z.sub(this._uniforms.uDelta.y).add(C.TILE_HALF_SIZE), C.TILE_SIZE).sub(C.TILE_HALF_SIZE);
            e.x = t, e.z = s;
            const n = L(e.x, 0, e.z).add(this._uniforms.uPlayerPosition), a = this.computeVisibility(n);
            e.w = a, xt(a, ()=>{
                e.w = this.computeAlpha(n);
            });
        })().compute(C.COUNT);
        createMaterial() {
            this.precision = "lowp";
            const e = this._buffer1.element(A), t = k(A.add(9234)), s = k(A.add(33.87)), o = ee.mul(2), n = fe(o.add(t.mul(100))).mul(.05);
            this.positionNode = e.xyz.add(L(n, 0, n)), this.scaleNode = t.mul(.2).add(.3);
            const a = I(.5, t).mul(.5), r = I(.5, s).mul(.5), d = R().mul(.5).add(E(a, r)), h = x(u.flowerAtlas, d);
            this.colorNode = h, this.opacityNode = e.w, this.alphaTest = .15;
        }
        async updateAsync() {
            ge.renderer.computeAsync(this.computeUpdate);
        }
    }
    class Cn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("water_lilies");
            e.material = this.createMaterial(), M.scene.add(e);
        }
        createMaterial() {
            const e = new $;
            e.precision = "lowp", e.transparent = !0, e.map = u.waterLiliesTexture, e.alphaTest = .5, e.alphaMap = u.waterLiliesAlphaTexture;
            const t = ee.mul(5e-4), s = X.x.mul(.1), o = x(u.noiseTexture, ae(X.xz.add(t).mul(s))).b.mul(.5), n = fe(o);
            return e.positionNode = Te.add(n), e;
        }
    }
    class Nn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = ae(R().mul(7)), t = x(u.barkDiffuse, e);
            this.colorNode = t.mul(2.5);
            const s = x(u.barkNormal, e);
            this.normalNode = new ke(s);
        }
    }
    const xe = {
        uPrimaryColor: g(new z().setRGB(.889, .095, 0)),
        uSecondaryColor: g(new z().setRGB(1, .162, .009)),
        uMixFactor: g(.5)
    };
    class Rn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.transparent = !0, this.side = Je;
            const e = T.computeMapUvByPosition(X.xz), t = x(u.noiseTexture, e), s = x(u.canopyDiffuse, R()), o = B(xe.uPrimaryColor, xe.uSecondaryColor, xe.uMixFactor);
            this.colorNode = U(B(s.rgb, o, t.b.mul(.4)).rgb, 1);
            const n = x(u.canopyNormal, R());
            this.normalNode = new ke(n, i(1.25)), this.normalScale = new Ie(1, -1), this.opacityNode = I(.5, s.a), this.alphaTest = .1;
            const a = ee.mul(t.r).add(Rs).mul(7.5), r = fe(a).mul(.015), c = bt(a.mul(.75)).mul(.01);
            this.positionNode = Te.add(L(0, c, r));
        }
    }
    class Fn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("tree"), t = u.realmModel.scene.children.filter(({ name: w })=>w.startsWith("tree_collider")), s = new Nn, o = new Rn, [n, a] = e.children, r = new pe(n.geometry, s, t.length);
            r.receiveShadow = !0;
            const c = new pe(a.geometry, o, t.length), h = u.realmModel.scene.getObjectByName("base_tree_collider").geometry.boundingBox, m = h.max.x, b = h.max.y / 2;
            t.forEach((w, S)=>{
                r.setMatrixAt(S, w.matrix), c.setMatrixAt(S, w.matrix);
                const y = ie.fixed().setTranslation(...w.position.toArray()).setRotation(w.quaternion).setUserData({
                    type: j.Wood
                }), O = D.world.createRigidBody(y), W = m * w.scale.x, G = b * w.scale.y, H = re.capsule(G, W).setRestitution(.75);
                D.world.createCollider(H, O);
            }), M.scene.add(r, c), this.debugTrees();
        }
        debugTrees() {
            const e = ce.panel.addFolder({
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
    class Un {
        constructor(){
            new Tn, new Cn, new vn, new Fn;
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
            const o = J.MAP_SIZE / 2;
            let n = 0;
            F.on("update-throttle-16x", ({ player: a })=>{
                const r = Math.abs(a.position.x) > o, c = Math.abs(a.position.z) > o, h = r || c ? .65 : 0;
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
    const Hn = ()=>Object.freeze({
            MAP_SIZE: 256,
            HALF_MAP_SIZE: 256 / 2,
            KINTOUN_ACTIVATION_THRESHOLD: 2,
            HALF_FLOOR_THICKNESS: .3,
            OUTER_MAP_SIZE: 256 * 3,
            OUTER_HALF_MAP_SIZE: 256 * 1.5
        }), J = Hn();
    class Wn {
        constructor(){
            new Gn, new Ln, new gn, new wn, new Un, new Sn, new pn;
        }
    }
    class zn {
        pow2 = p(([e = i(0)])=>Xe(i(2), e));
        packF32 = p(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1), a = i(0)])=>{
            const r = oe(this.pow2(s), 1), c = oe(o, a).div(Ue(n, 1e-20)), d = Ye(Fs(c), 0, r), h = this.pow2(t), m = this.pow2(s), b = Se(e.div(h)), w = Me(b, m).mul(h);
            return e.sub(w).add(d.mul(h));
        });
        unpackF32 = p(([e = i(0), t = i(0), s = i(8), o = i(1), n = i(0)])=>{
            const a = this.pow2(t), r = this.pow2(s), c = Se(e.div(a));
            return Me(c, r).mul(o).add(n);
        });
        packUnit = p(([e = i(0), t = i(0), s = i(8), o = i(0)])=>{
            const n = i(1).div(oe(this.pow2(s), 1));
            return this.packF32(e, t, s, o, n, i(0));
        });
        unpackUnit = p(([e = i(0), t = i(0), s = i(8)])=>{
            const o = i(1).div(oe(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, i(0));
        });
        packFlag = p(([e = i(0), t = i(0), s = i(0)])=>this.packF32(e, t, i(1), s, i(1), i(0)));
        unpackFlag = p(([e = i(0), t = i(0)])=>this.unpackF32(e, t, i(1), i(1), i(0)));
        packAngle = p(([e = i(0), t = i(0), s = i(9), o = i(0)])=>{
            const n = oe(this.pow2(s), 1), a = be.div(n), r = o.sub(be.mul(Se(o.div(be))));
            return this.packF32(e, t, s, r, a, i(0));
        });
        unpackAngle = p(([e = i(0), t = i(0), s = i(9)])=>{
            const o = be.div(oe(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, i(0));
        });
        packSigned = p(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1)])=>{
            const a = oe(this.pow2(s), 1), r = n.mul(2).div(a), c = n.negate();
            return this.packF32(e, t, s, o, r, c);
        });
        unpackSigned = p(([e = i(0), t = i(0), s = i(8), o = i(1)])=>{
            const n = o.mul(2).div(oe(this.pow2(s), 1)), a = o.negate();
            return this.unpackF32(e, t, s, n, a);
        });
        packUnits = p(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(0), a = i(1)])=>{
            const r = oe(this.pow2(s), 1), c = a.sub(n).div(r);
            return this.packF32(e, t, s, o, c, n);
        });
        unpackUnits = p(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1)])=>{
            const a = n.sub(o).div(oe(this.pow2(s), 1));
            return this.unpackF32(e, t, s, a, o);
        });
        computeMapUvByPosition = p(([e = E(0)])=>e.add(J.HALF_MAP_SIZE).div(J.MAP_SIZE));
        computeAtlasUv = p(([e = E(0), t = E(0), s = E(0)])=>s.mul(e).add(t));
    }
    const T = new zn, Vn = ()=>({
            JUMP_BUFFER_DURATION_IN_SECONDS: .2,
            MAX_CONSECUTIVE_JUMPS: 2,
            JUMP_CUT_MULTIPLIER: .25,
            FALL_MULTIPLIER: 2.75,
            MAX_UPWARD_VELOCITY: 6,
            LINEAR_DAMPING: .35,
            ANGULAR_DAMPING: .6,
            JUMP_IMPULSE: new v(0, 75, 0),
            LIN_VEL_STRENGTH: 35,
            ANG_VEL_STRENGTH: 25,
            RADIUS: .5,
            MASS: .5,
            PLAYER_INITIAL_POSITION: new v(0, 5, 0),
            CAMERA_OFFSET: new v(0, 11, 17),
            CAMERA_LERP_FACTOR: 7.5,
            UP: new v(0, 1, 0),
            DOWN: new v(0, -1, 0),
            FORWARD: new v(0, 0, -1)
        }), P = Vn();
    class Zn {
        mesh;
        rigidBody;
        smoothedCameraPosition = new v;
        desiredCameraPosition = new v;
        smoothedCameraTarget = new v;
        desiredTargetPosition = new v;
        yawInRadians = 0;
        prevYawInRadians = -1;
        yawQuaternion = new Us;
        newLinVel = new v;
        newAngVel = new v;
        torqueAxis = new v;
        forwardVec = new v;
        isOnGround = !1;
        jumpCount = 0;
        wasJumpHeld = !1;
        jumpBufferTimer = 0;
        rayOrigin = new v;
        ray = new Vs(this.rayOrigin, P.DOWN);
        constructor(){
            this.mesh = this.createCharacterMesh(), M.scene.add(this.mesh), $e.setTarget(this.mesh), this.rigidBody = D.world.createRigidBody(this.createRigidBodyDesc()), D.world.createCollider(this.createColliderDesc(), this.rigidBody), F.on("update", this.update.bind(this)), F.on("update-throttle-64x", this.resetPlayerPosition.bind(this)), this.debugPlayer();
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
            }, !1), this.rigidBody.setTranslation(P.PLAYER_INITIAL_POSITION, !0), this.mesh.position.copy(P.PLAYER_INITIAL_POSITION));
        }
        debugPlayer() {
            const e = ce.panel.addFolder({
                title: "🪩 Player",
                expanded: !1
            });
            e.addBinding(P.CAMERA_OFFSET, "y", {
                label: "Main camera height"
            }), e.addBinding(P.CAMERA_OFFSET, "z", {
                label: "Main camera distance"
            });
        }
        createCharacterMesh() {
            const e = u.realmModel.scene.getObjectByName("player");
            return e.material = new jn, e.castShadow = !0, e.position.copy(P.PLAYER_INITIAL_POSITION), e;
        }
        createRigidBodyDesc() {
            const { x: e, y: t, z: s } = P.PLAYER_INITIAL_POSITION;
            return ie.dynamic().setTranslation(e, t, s).setLinearDamping(P.LINEAR_DAMPING).setAngularDamping(P.ANGULAR_DAMPING).setUserData({
                type: j.Player
            });
        }
        createColliderDesc() {
            return re.ball(P.RADIUS).setRestitution(.6).setFriction(1).setMass(P.MASS).setActiveEvents(Zs.COLLISION_EVENTS);
        }
        update(e) {
            const { clock: t } = e, s = t.getDelta();
            this.prevYawInRadians !== this.yawInRadians && (this.yawQuaternion.setFromAxisAngle(P.UP, this.yawInRadians), this.prevYawInRadians = this.yawInRadians), this.updateVerticalMovement(s), this.updateHorizontalMovement(s), this.updateCameraPosition(s);
        }
        updateVerticalMovement(e) {
            const t = Ee.isJumpPressed();
            this.isOnGround = this.checkIfGrounded(), this.isOnGround && (this.jumpCount = 0), t && !this.wasJumpHeld ? this.jumpBufferTimer = P.JUMP_BUFFER_DURATION_IN_SECONDS : this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - e), this.jumpBufferTimer > 0 && this.canJump() && (this.performJump(), this.jumpBufferTimer = 0);
            const o = this.rigidBody.linvel();
            this.handleJumpCut(t, o), this.handleFastFall(e, o, D.world.gravity.y), this.clampUpwardVelocity(o), this.rigidBody.setLinvel(o, !0), this.wasJumpHeld = t;
        }
        checkIfGrounded() {
            this.rayOrigin.copy(this.rigidBody.translation()), this.rayOrigin.y -= P.RADIUS + .01;
            const e = .2, t = D.world.castRay(this.ray, e, !0);
            return t ? t.timeOfImpact * e < .01 : !1;
        }
        canJump() {
            return this.isOnGround ? !0 : this.jumpCount < P.MAX_CONSECUTIVE_JUMPS;
        }
        performJump() {
            this.rigidBody.applyImpulse(P.JUMP_IMPULSE, !0), this.jumpCount += 1;
        }
        handleJumpCut(e, t) {
            !(!e && this.wasJumpHeld) || t.y <= 0 || (t.y *= P.JUMP_CUT_MULTIPLIER);
        }
        handleFastFall(e, t, s) {
            if (t.y >= 0) return;
            const o = P.FALL_MULTIPLIER * Math.abs(s) * e;
            t.y -= o;
        }
        clampUpwardVelocity(e) {
            e.y <= P.MAX_UPWARD_VELOCITY || (e.y = P.MAX_UPWARD_VELOCITY);
        }
        updateHorizontalMovement(e) {
            const t = Ee.isForward(), s = Ee.isBackward(), o = Ee.isLeftward(), n = Ee.isRightward(), a = 2;
            o && (this.yawInRadians += a * e), n && (this.yawInRadians -= a * e), this.forwardVec.copy(P.FORWARD).applyQuaternion(this.yawQuaternion), this.torqueAxis.crossVectors(P.UP, this.forwardVec).normalize(), this.newLinVel.copy(this.rigidBody.linvel()), this.newAngVel.copy(this.rigidBody.angvel());
            const r = P.LIN_VEL_STRENGTH * e, c = P.ANG_VEL_STRENGTH * e;
            t && (this.newLinVel.addScaledVector(this.forwardVec, r), this.newAngVel.addScaledVector(this.torqueAxis, c)), s && (this.newLinVel.addScaledVector(this.forwardVec, -r), this.newAngVel.addScaledVector(this.torqueAxis, -c)), this.rigidBody.setLinvel(this.newLinVel, !0), this.rigidBody.setAngvel(this.newAngVel, !0), this.syncMeshWithBody();
        }
        syncMeshWithBody() {
            this.mesh.position.copy(this.rigidBody.translation()), this.mesh.quaternion.copy(this.rigidBody.rotation());
        }
        updateCameraPosition(e) {
            this.desiredCameraPosition.copy(P.CAMERA_OFFSET).applyQuaternion(this.yawQuaternion).add(this.mesh.position);
            const t = P.CAMERA_LERP_FACTOR * e;
            this.smoothedCameraPosition.lerp(this.desiredCameraPosition, t), this.desiredTargetPosition.copy(this.mesh.position), this.desiredTargetPosition.y += 1, this.smoothedCameraTarget.lerp(this.desiredTargetPosition, t), M.playerCamera.position.copy(this.smoothedCameraPosition), M.playerCamera.lookAt(this.smoothedCameraTarget);
        }
        get position() {
            return this.mesh.position;
        }
        get yaw() {
            return this.yawInRadians;
        }
    }
    class jn extends $ {
        constructor(){
            super(), this.createMaterial();
        }
        createMaterial() {
            this.flatShading = !1, this.castShadowNode = L(.6);
            const e = T.computeMapUvByPosition(X.xz), t = qe(e), s = $e.getTerrainShadowFactor(t), o = x(u.noiseTexture, ae(X.xz), 3).r, n = fe(ee.mul(2.5).add(o.mul(5))).mul(.05), a = i(-.45).add(n), r = i(1).sub(I(a, X.y)), c = i(1).sub(r), d = x(u.footballDiffuse, R()).mul(1.5), h = i(1).sub(Z(-1.5, 1, X.y).mul(r)), m = B(L(1), L(.6, .8, 1).mul(.75), h), b = d.mul(m).mul(r), S = d.mul(c).add(b);
            this.colorNode = S.mul(s);
        }
    }
    class Kn {
        player;
        constructor(){
            this.player = new Zn, new Wn;
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
        onResize() {
            const e = this.getSizes();
            F.emit("resize", e);
        }
        async startLoop() {
            const t = {
                clock: new Os(!0),
                player: this.player
            }, s = async ()=>{
                D.update(), F.emit("update", t), ge.renderAsync();
            }, o = Ks(this.onResize.bind(this), 300);
            this.onResize(), new ResizeObserver(o).observe(document.body), ge.renderer.setAnimationLoop(s);
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
            t.addEventListener("click", (c)=>{
                switch(c.stopPropagation(), c.target?.id){
                    case "credits-dialog":
                    case "close-dialog-btn":
                        t.close();
                        break;
                }
            }), e.addEventListener("click", (c)=>{
                c.stopPropagation(), t.showModal();
            });
            const n = "aleksandar.d.gjoreski@gmail.com", a = document.createElement("a");
            a.setAttribute("href", `mailto:${n}`), a.innerText = n, document.getElementById("email-placeholder")?.appendChild(a);
        }
    }
    const Yn = new qn, Jn = new Ko;
    Jn.initAsync().then(()=>{
        Yn.init(), new Kn().startLoop();
    });
});
