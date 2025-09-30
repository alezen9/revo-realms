import { L as qt, T as Yt, D as Jt, G as Xt, C as $t, S as be, P as Qt, p as es, b as ts, r as ss, W as os, a as ns, A as as, c as is, d as rs, e as ls, f as cs, g as ds, h as us, V as v, _ as hs, M as at, i as ms, j as gt, k as ps, l as V, H as fs, m as gs, O as ws, F as ys, n as f, t as M, v as P, o as bs, q as Ke, I as ge, s as _t, u as Ce, w as O, x, y as _, z as C, B as ne, E as i, J as Se, K as q, N as xe, Q as Pt, R as U, U as Et, X as Ss, Y as As, Z as xs, $ as Ms, a0 as R, a1 as I, a2 as Ne, a3 as Is, a4 as $, a5 as wt, a6 as Ls, a7 as m, a8 as lt, a9 as de, aa as qe, ab as De, ac as Dt, ad as yt, ae as st, af as bt, ag as _s, ah as Ps, ai as ot, aj as ue, ak as St, al as Es, am as nt, an as Ds, ao as Ze, ap as ct, aq as Ts, ar as it, as as vs, at as He, au as We, av as Ae, aw as rt, ax as Bs, ay as At, az as Ee, aA as Tt, aB as xt, aC as Cs, aD as Ns, aE as se, aF as Rs, aG as Fs, aH as Us } from "./three-Ce46RW1S.js";
import { P as Os } from "./tweakpane-SMt8byX-.js";
import { S as Mt } from "./stats-gl-C2M3amu4.js";
import { e as ks } from "./tseep-zr-hWxBz.js";
import { World as Gs, EventQueue as zs, RigidBodyDesc as ae, ColliderDesc as ie, HeightFieldFlags as Hs, Ray as Ws, ActiveEvents as Vs, __tla as __tla_0 } from "./@dimforge-CqaeYUkE.js";
import { n as Zs } from "./nipplejs-BxsX8Mt3.js";
import { d as js } from "./lodash-es-BMmXVQ06.js";
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
    const Ks = "/models/realm.glb", qs = "/textures/environment/px.webp", Ys = "/textures/environment/nx.webp", Js = "/textures/environment/py.webp", Xs = "/textures/environment/ny.webp", $s = "/textures/environment/pz.webp", Qs = "/textures/environment/nz.webp", eo = "/textures/noise/noise.webp", to = "/textures/realm/terrainType.webp", so = "/textures/realm/sandNormal.webp", oo = "/textures/realm/grassNormal.webp", no = "/textures/realm/grassDiffuse.webp", ao = "/textures/realm/waterNormal.webp", io = "/textures/realm/terrainShadowAo.webp", ro = "/textures/realm/waterLiliesDiffuse.webp", lo = "/textures/realm/waterLiliesAlpha.webp", co = "/textures/realm/flowerAtlas.webp", uo = "/textures/realm/stoneAtlas.webp", ho = "/textures/realm/barkDiffuse.webp", mo = "/textures/realm/barkNormal.webp", po = "/textures/realm/canopyDiffuse.webp", fo = "/textures/realm/canopyNormal.webp", go = "/textures/realm/axeDiffuse.webp", wo = "/textures/realm/axeEmissive.webp", yo = "/textures/realm/trunkDiffuse.webp", bo = "/textures/realm/trunkNormal.webp", So = "/textures/realm/onePieceAtlas.webp", Ao = "/textures/realm/kunaiDiffuse.webp", xo = "/textures/realm/kunaiMR.webp", Mo = "/textures/realm/campfireDiffuse.webp", Io = "/textures/realm/fireSprites.webp", Lo = "/textures/realm/footballDiffuse.webp", _o = "/textures/realm/leafDiffuse.webp", Po = {
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
            const e = new qt;
            return e.onError = this.onErrorLog, e;
        }
    }
    const vt = new Do;
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
            this.textureLoader = new Yt(e);
            const t = new Jt;
            t.setDecoderPath("/draco/"), this.gltfLoader = new Xt(e), this.gltfLoader.setDRACOLoader(t), this.cubeTextureLoader = new $t(e);
        }
        async initAsync() {
            const e = await Promise.all([
                this.gltfLoader.loadAsync(Ks),
                u.cubeTextureLoader.loadAsync([
                    qs,
                    Ys,
                    Js,
                    Xs,
                    $s,
                    Qs
                ]),
                this.textureLoader.loadAsync(eo),
                this.textureLoader.loadAsync(to),
                this.textureLoader.loadAsync(no),
                this.textureLoader.loadAsync(oo),
                this.textureLoader.loadAsync(so),
                this.textureLoader.loadAsync(ao),
                this.textureLoader.loadAsync(io),
                this.textureLoader.loadAsync(ro),
                this.textureLoader.loadAsync(lo),
                this.textureLoader.loadAsync(co),
                this.textureLoader.loadAsync(uo),
                this.textureLoader.loadAsync(po),
                this.textureLoader.loadAsync(fo),
                this.textureLoader.loadAsync(ho),
                this.textureLoader.loadAsync(mo),
                this.textureLoader.loadAsync(go),
                this.textureLoader.loadAsync(wo),
                this.textureLoader.loadAsync(yo),
                this.textureLoader.loadAsync(bo),
                this.textureLoader.loadAsync(So),
                this.textureLoader.loadAsync(Ao),
                this.textureLoader.loadAsync(xo),
                this.textureLoader.loadAsync(Mo),
                this.textureLoader.loadAsync(Io),
                this.textureLoader.loadAsync(Lo),
                this.textureLoader.loadAsync(_o)
            ]);
            this.realmModel = e[0], this.envMapTexture = e[1], this.envMapTexture.colorSpace = be, this.noiseTexture = e[2], this.terrainTypeMap = e[3], this.terrainTypeMap.flipY = !1, this.grassDiffuse = e[4], this.grassNormal = e[5], this.sandNormal = e[6], this.waterNormal = e[7], this.terrainShadowAo = e[8], this.terrainShadowAo.flipY = !1, this.waterLiliesTexture = e[9], this.waterLiliesTexture.flipY = !1, this.waterLiliesAlphaTexture = e[10], this.waterLiliesAlphaTexture.flipY = !1, this.flowerAtlas = e[11], this.flowerAtlas.flipY = !1, this.stoneAtlas = e[12], this.stoneAtlas.flipY = !1, this.canopyDiffuse = e[13], this.canopyDiffuse.flipY = !1, this.canopyNormal = e[14], this.canopyNormal.flipY = !1, this.barkDiffuse = e[15], this.barkDiffuse.flipY = !1, this.barkDiffuse.colorSpace = be, this.barkNormal = e[16], this.barkNormal.flipY = !1, this.axeDiffuse = e[17], this.axeDiffuse.flipY = !1, this.axeEmissive = e[18], this.axeEmissive.flipY = !1, this.trunkDiffuse = e[19], this.trunkDiffuse.flipY = !1, this.trunkDiffuse.colorSpace = be, this.trunkNormal = e[20], this.trunkNormal.flipY = !1, this.onePieceAtlas = e[21], this.onePieceAtlas.flipY = !1, this.kunaiDiffuse = e[22], this.kunaiDiffuse.flipY = !1, this.kunaiDiffuse.colorSpace = be, this.kunaiMR = e[23], this.kunaiMR.flipY = !1, this.campfireDiffuse = e[24], this.campfireDiffuse.flipY = !1, this.campfireDiffuse.colorSpace = be, this.fireSprites = e[25], this.footballDiffuse = e[26], this.footballDiffuse.colorSpace = be, this.leafDiffuse = e[27], this.leafDiffuse.colorSpace = be;
        }
    }
    const u = new To(vt.manager);
    class vo {
        panel;
        constructor(){
            this.panel = new Os({
                title: "Revo Realms"
            }), this.panel.hidden = !0, this.panel.element.parentElement?.classList.add("debug-panel");
        }
        setVisibility(e) {
            this.panel.hidden = !e;
        }
    }
    const ee = new vo;
    class Bo {
        stats;
        lastSecond = performance.now();
        drawCallsPanel;
        trianglesPanel;
        constructor(e){
            const t = new Mt({
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
            const o = this.stats.addPanel(new Mt.Panel(e, t, s));
            return o.update = (n)=>{
                const a = o.canvas.getContext("2d");
                if (!a) return;
                const { width: r, height: l } = o.canvas;
                a.clearRect(0, 0, r, l), a.fillStyle = s, a.fillRect(0, 0, r, l), a.fillStyle = t;
                const d = a.font;
                a.textAlign = "left", a.textBaseline = "top", a.fillText(o.name, 4, 4), a.font = "bold 20px Arial", a.textAlign = "center", a.textBaseline = "middle";
                const h = Co.format(n);
                a.fillText(`${h}`, r / 2, l / 1.65), a.font = d;
            }, o;
        }
        updateCustomPanels() {
            const e = performance.now();
            if (e - this.lastSecond < 1e3) return;
            const { render: t } = we.renderer.info;
            this.drawCallsPanel.update(t.drawCalls, 0), this.trianglesPanel.update(t.triangles, 0), this.lastSecond = e;
        }
    }
    const Co = new Intl.NumberFormat("en-US", {
        notation: "compact"
    }), No = [
        2,
        4,
        16,
        64
    ], F = new ks.EventEmitter, Ro = (c)=>{
        let e = 0;
        F.on("update", (t)=>{
            e++, !(e < c) && (e = 0, F.emit(`update-throttle-${c}x`, t));
        });
    };
    No.forEach((c)=>Ro(c));
    class Fo extends Qt {
        scenePass;
        debugFolder = ee.panel.addFolder({
            title: "⭐️ Postprocessing",
            expanded: !1
        });
        constructor(e){
            super(e), this.scenePass = es(L.scene, L.renderCamera);
            const t = this.makeGraph();
            this.outputNode = t, F.on("camera-changed", ()=>{
                this.scenePass.camera = L.renderCamera, this.scenePass.needsUpdate = !0;
            });
        }
        makeGraph() {
            this.outputColorTransform = !1;
            const e = this.scenePass.getTextureNode(), t = ts(e, .25, .15, 1);
            t.smoothWidth.value = .04, t._nMips = 2, this.debugFolder.addBinding(t.strength, "value", {
                label: "Bloom strength"
            }), this.debugFolder.addBinding(t.threshold, "value", {
                label: "Bloom threshold"
            });
            const s = e.add(t);
            return ss(s);
        }
    }
    class Uo {
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
            const t = new os({
                canvas: e,
                antialias: !0,
                trackTimestamp: this.IS_MONITORING_ENABLED,
                powerPreference: "high-performance",
                stencil: !1,
                depth: !0
            });
            t.shadowMap.enabled = !0, t.shadowMap.type = ns, t.toneMapping = as, t.setClearColor(0, 1), t.toneMappingExposure = 1.5, this.renderer = t, this.monitoringManager = new Bo(this.IS_MONITORING_ENABLED), ee.setVisibility(this.IS_DEBUGGING_ENABLED), F.on("resize", (s)=>{
                const o = Math.max(this.IS_POSTPROCESSING_ENABLED ? s.dpr * .75 : s.dpr, 1);
                t.setSize(s.width, s.height), t.setPixelRatio(o);
            });
        }
        async init() {
            L.init(), this.postprocessingManager = new Fo(this.renderer), this.IS_MONITORING_ENABLED && await this.monitoringManager.stats.init(this.renderer);
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
    const we = new Uo;
    class Oo {
        scene;
        playerCamera;
        renderCamera;
        cameraHelper;
        controls;
        orbitControlsCamera;
        constructor(){
            const e = new is;
            this.scene = e;
            const t = window.innerWidth, s = window.innerHeight, o = t / s, n = new rs(45, o, .01, 150);
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
    const L = new Oo, ko = "/audio/ambient/ambient.mp3", Go = "/audio/ambient/lake.mp3", zo = "/audio/collisions/hitWood.mp3", Ho = "/audio/collisions/hitStone.mp3";
    class Wo {
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
            this.audioLoader = new ls(e), this.audioListener = new cs, L.playerCamera.add(this.audioListener);
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
            const o = new ds(this.audioListener);
            return o.setBuffer(e), o.setVolume(0), o.setLoop(s), o.userData.originalVolume = t, this.files.push(o), o;
        }
        newPositionalAudio(e, t = 1, s = !1, o = 1) {
            const n = new us(this.audioListener);
            return n.setBuffer(e), n.setVolume(0), n.setLoop(s), n.userData.originalVolume = t, n.setMaxDistance(o), this.files.push(n), n;
        }
        async initAsync() {
            const e = await Promise.all([
                this.audioLoader.loadAsync(ko),
                this.audioLoader.loadAsync(Go),
                this.audioLoader.loadAsync(zo),
                this.audioLoader.loadAsync(Ho)
            ]);
            this.ambient = this.newAudio(e[0], .05, !0), this.lake = this.newPositionalAudio(e[1], 1, !0, 10), this.hitWood = this.newAudio(e[2], 0, !1), this.hitStone = this.newAudio(e[3], 0, !1), this.isReady = !0, F.emit("audio-ready");
        }
    }
    const oe = new Wo(vt.manager);
    var Z = ((c)=>(c.Player = "Player", c.Terrain = "Terrain", c.Wood = "Wood", c.Stone = "Stone", c))(Z || {});
    const Vo = ()=>({
            minImpactSq: 5,
            maxImpactSq: 400,
            minImpactVolume: .01,
            maxImpactVolume: .25
        }), fe = Vo();
    class Zo {
        world;
        eventQueue;
        IS_DEBUGGING_ENABLED = !1;
        dummyVectorLinVel = new v;
        debugMesh;
        constructor(){
            this.IS_DEBUGGING_ENABLED && (this.debugMesh = this.createDebugMesh(), L.scene.add(this.debugMesh));
        }
        async initAsync() {
            return hs(()=>import("./@dimforge-CqaeYUkE.js").then(async (m)=>{
                    await m.__tla;
                    return m;
                }), []).then(()=>{
                this.world = new Gs({
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
            const t = at.mapLinear(e, fe.minImpactSq, fe.maxImpactSq, fe.minImpactVolume, fe.maxImpactVolume);
            return at.clamp(t, fe.minImpactVolume, fe.maxImpactVolume);
        }
        onCollisionWithWood(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < fe.minImpactSq) return;
            const o = this.impactToVolume(s);
            oe.hitWood.setVolume(o), oe.hitWood.play();
        }
        onCollisionWithStone(e) {
            const t = e.parent()?.linvel();
            if (!t) return;
            this.dummyVectorLinVel.copy(t);
            const s = this.dummyVectorLinVel.lengthSq();
            if (s < fe.minImpactSq) return;
            const o = this.impactToVolume(s);
            oe.hitStone.setVolume(o), oe.hitStone.play();
        }
        handleCollisionSounds() {
            this.eventQueue.drainCollisionEvents((e, t, s)=>{
                if (oe.isMute) return;
                const o = this.world.getCollider(e), n = this.world.getCollider(t);
                if (!(this.getColliderName(o) === Z.Player) || !s) return;
                switch(this.getColliderName(n)){
                    case Z.Wood:
                        this.onCollisionWithWood(o);
                        break;
                    case Z.Stone:
                        this.onCollisionWithStone(o);
                        break;
                }
            });
        }
        createDebugMesh() {
            return new ms(new gt, new ps);
        }
        updateDebugMesh() {
            if (!this.debugMesh) return;
            const e = this.world.debugRender();
            this.debugMesh.geometry.dispose(), this.debugMesh.geometry = new gt, this.debugMesh.geometry.setPositions(e.vertices), this.debugMesh.computeLineDistances();
        }
        update() {
            this.updateDebugMesh(), this.world.step(this.eventQueue), oe.isReady && this.handleCollisionSounds();
        }
    }
    const B = new Zo;
    class jo {
        constructor(){
            ("ontouchstart" in window || navigator.maxTouchPoints > 0) && document.body.classList.add("is-touch-device");
        }
        async initAsync() {
            await Promise.all([
                B.initAsync(),
                u.initAsync()
            ]), await we.init(), oe.initAsync();
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
    class qo {
        isActive = !1;
        direction = {
            x: 0,
            y: 0
        };
        constructor(){
            const e = document.createElement("div");
            e.classList.add("joystick-zone"), document.body.appendChild(e);
            const t = Zs.create({
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
    const Ve = new qo;
    class Yo {
        isForward() {
            return ce.isKeyPressed("KeyW") || ce.isKeyPressed("ArrowUp") || Ve.isForward();
        }
        isBackward() {
            return ce.isKeyPressed("KeyS") || ce.isKeyPressed("ArrowDown") || Ve.isBackward();
        }
        isLeftward() {
            return ce.isKeyPressed("KeyA") || ce.isKeyPressed("ArrowLeft") || Ve.isLeftward();
        }
        isRightward() {
            return ce.isKeyPressed("KeyD") || ce.isKeyPressed("ArrowRight") || Ve.isRightward();
        }
        isJumpPressed() {
            return ce.isKeyPressed("Space");
        }
    }
    const Be = new Yo, K = {
        LIGHT_POSITION_OFFSET: new v(10, 10, 10),
        directionalColor: new V(.85, .75, .7),
        directionalIntensity: .8,
        hemiSkyColor: new V(.6, .4, .5),
        hemiGroundColor: new V(.3, .2, .2),
        fogColor: new V(.29, .08, 0),
        fogDensity: .0046
    };
    class Jo {
        directionalLight;
        hemisphereLight;
        fog;
        sunDirection = K.LIGHT_POSITION_OFFSET.clone().normalize().negate();
        constructor(){
            this.directionalLight = this.setupDirectionalLighting(), L.scene.add(this.directionalLight), this.hemisphereLight = this.setupHemisphereLight(), L.scene.add(this.hemisphereLight), this.fog = this.setupFog(), F.on("update", ({ player: e })=>{
                this.directionalLight.position.copy(e.position).add(K.LIGHT_POSITION_OFFSET);
            }), this.debugLight();
        }
        get sunColor() {
            return this.directionalLight.color;
        }
        setupHemisphereLight() {
            const e = new fs;
            return e.color.copy(K.hemiSkyColor), e.groundColor.copy(K.hemiGroundColor), e.intensity = .3, e.position.copy(K.LIGHT_POSITION_OFFSET), e;
        }
        setupDirectionalLighting() {
            const e = new gs;
            e.intensity = K.directionalIntensity, e.color.copy(K.directionalColor), e.position.copy(K.LIGHT_POSITION_OFFSET), e.target = new ws, e.castShadow = !0, e.shadow.mapSize.set(64, 64);
            const t = 1;
            return e.shadow.intensity = .85, e.shadow.camera.left = -t, e.shadow.camera.right = t, e.shadow.camera.top = t, e.shadow.camera.bottom = -t, e.shadow.camera.near = .01, e.shadow.camera.far = 30, e.shadow.normalBias = .1, e.shadow.bias = -.001, e;
        }
        setupFog() {
            return new ys(K.fogColor, K.fogDensity);
        }
        getTerrainShadowFactor = f(([e = P(0)])=>M(u.terrainShadowAo, e).r);
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
    const je = new Jo, Bt = new bs, It = new Ke;
    F.on("update-throttle-16x", ()=>{
        It.multiplyMatrices(L.renderCamera.projectionMatrix, L.renderCamera.matrixWorldInverse), Bt.setFromProjectionMatrix(It);
    });
    const Xo = (c)=>(c.geometry.boundingSphere || c.geometry.computeBoundingSphere(), Bt.intersectsObject(c)), $o = f(([c])=>{});
    class Qo extends ge {
        mainBuffer;
        constructor(e){
            let t, s, o = $o;
            switch(super(new _t, void 0, e.count), this.mainBuffer = Ce(e.count, "vec4"), this.mainBuffer.setPBO(!0), e.preset){
                case "custom":
                    t = e.material, s = e.onInit, o = e.onUpdate;
                    break;
                case "fire":
                    const r = en(e, this.mainBuffer);
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
                Xo(this) && we.renderer.computeAsync(n);
            });
        }
    }
    const en = (c, e)=>{
        const { speed: t = .5, radius: s = 1, height: o = 1, lifetime: n = 1, scale: a = 1, detail: r = 4, coneFactor: l = 1 } = c, d = o * 1.5, h = n * .75, p = Ce(c.count, "float"), A = .95, y = f(([Oe])=>{
            const Te = O(x.add(12345)), pe = p.element(x), Ie = _(A, Te);
            pe.assign(Ie);
        }), b = f(([Oe])=>{
            const Te = Oe.element(x), pe = p.element(x), Ie = O(x), ve = C(n, h, pe), Le = ne.mul(t).add(Ie.mul(ve)).mod(ve).div(ve), _e = i(1).sub(i(1).sub(Le).pow(2)), ke = C(o, d, pe), Ge = _e.mul(ke), ze = O(x.add(7890)).mul(Se), et = O(x.add(5678)), tt = i(1).sub(i(1).sub(et).pow(2)), Rt = i(1).sub(_e.mul(l)), Ft = q(0, .35, _e), Ut = xe(ne.mul(.5)).mul(.05).add(1), Ot = C(s * .25, s, Ft).mul(Rt).mul(Ut), kt = tt.mul(Ot), Gt = _(.5, ze).mul(2).sub(1), ht = ze.add(Le.mul(Se).mul(.05).mul(Gt)), zt = C(1, .85, pe), mt = Ie.sub(.5).mul(.05).mul(Le), Ht = q(0, .75, Le).mul(pe), pt = kt.add(Ht.mul(zt)), Wt = Pt(ht.add(mt)).mul(pt), Vt = xe(ht.add(mt)).mul(pt), ft = Ge.div(ke), Zt = q(0, .5, ft), jt = i(1).sub(q(.5, 1, ft)), Kt = Zt.mul(jt);
            Te.assign(U(Wt, Ge, Vt, Kt));
        }), S = new Et;
        S.precision = "lowp", S.transparent = !0, S.depthWrite = !1, S.blending = Ss, S.blendEquation = As, S.blendSrc = xs, S.blendDst = Ms;
        const k = e.element(x), G = p.element(x), z = O(x.add(9234)), H = O(x.add(33.87));
        S.positionNode = k.xyz;
        const j = i(1).sub(G.mul(.85)), te = H.clamp(.25, 1);
        S.scaleNode = te.mul(k.w).mul(j).mul(a);
        const re = _(.5, z).mul(.5), W = _(.5, H).mul(.5), me = R().mul(.5).add(P(re, W)), Y = M(u.fireSprites, me, r), Q = I(.72, .62, .08).mul(2).toConst(), J = I(1, .1, 0).mul(4).toConst(), ye = I(0).toConst(), Me = C(o, d, G), le = q(0, 1, Ne.y.div(Me)).pow(2), Ye = q(0, .25, le), Re = C(Q, J, Ye), Je = q(.9, 1, le), Xe = C(Re, ye, Je), Fe = i(1).sub(q(0, .85, le)), $e = _(.65, H).mul(Fe), Ue = i(.5).toConst(), Qe = Y.a.mul($e).mul(Ue);
        return S.colorNode = C(Xe, J, G).mul(Qe).mul(1.5), S.alphaTest = .1, S.opacityNode = k.w.mul(Y.a).mul(Ue), {
            material: S,
            onInit: y,
            onUpdate: b
        };
    };
    class tn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("campfire");
            e.material = new Is({
                map: u.campfireDiffuse
            });
            const t = new Qo({
                preset: "fire",
                count: 512,
                speed: .65,
                radius: .75,
                workGroupSize: 256
            });
            t.position.copy(e.position).setY(.25), L.scene.add(e, t);
            const s = ae.fixed().setTranslation(...e.position.toArray()).setRotation(e.quaternion).setUserData({
                type: Z.Stone
            }), o = B.world.createRigidBody(s);
            e.geometry.computeBoundingSphere();
            const { radius: n } = e.geometry.boundingSphere, a = ie.ball(n).setRestitution(.75);
            B.world.createCollider(a, o);
        }
    }
    class sn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = M(u.trunkDiffuse, R());
            this.colorNode = e.mul(1.75), this.normalMap = u.trunkNormal;
        }
    }
    class on extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.map = u.axeDiffuse, this.emissiveMap = u.axeEmissive, this.emissiveIntensity = 35, this.emissive = new V("lightblue");
        }
    }
    class nn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("kratos_axe");
            e.material = new on;
            const t = u.realmModel.scene.getObjectByName("tree_trunk");
            t.material = new sn, L.scene.add(e, t);
            const s = u.realmModel.scene.getObjectByName("axe_collider"), o = ae.fixed().setTranslation(...s.position.toArray()).setRotation(s.quaternion).setUserData({
                type: Z.Wood
            }), n = B.world.createRigidBody(o), a = s.geometry.boundingBox.max, r = ie.cuboid(a.x, a.y, a.z).setRestitution(.75);
            B.world.createCollider(r, n);
            const l = u.realmModel.scene.getObjectByName("trunk_collider"), { x: d, y: h } = l.geometry.boundingBox.max, p = ae.fixed().setTranslation(...l.position.toArray()).setRotation(l.quaternion).setUserData({
                type: Z.Wood
            }), A = B.world.createRigidBody(p), y = d, b = h / 2, S = ie.capsule(b, y).setRestitution(.75);
            B.world.createCollider(S, A);
        }
    }
    class an {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("jojo_mask");
            e.material = new rn;
            const t = u.realmModel.scene.children.filter((n)=>n.name.startsWith("jojo_symbol")), s = new ln, o = new ge(t[0].geometry, s, t.length);
            for(let n = 0; n < t.length; n++){
                const a = t[n];
                o.setMatrixAt(n, a.matrix);
            }
            L.scene.add(e, o);
        }
    }
    class rn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const { stoneDiffuse: e } = u.atlasesCoords.stones, t = T.computeAtlasUv(P(...e.scale), P(...e.offset), R()), s = M(u.stoneAtlas, t);
            this.colorNode = s;
        }
    }
    class ln extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !0;
            const e = wt("#eb5694"), t = wt("#9642D3");
            this.colorNode = C(t, e, R().y.mul(.5)).mul(.45);
            const s = ne.mul(20), o = xe(s.add(x)), n = _(0, o).mul(.25);
            this.positionNode = Ne.add(n);
        }
    }
    class cn extends Ls {
        uScale = m(1);
        constructor(){
            super();
            const e = M(u.kunaiDiffuse, R());
            this.colorNode = e.mul(5);
            const t = M(u.kunaiMR, R());
            this.metalnessNode = t.b.mul(.75), this.roughnessNode = t.g;
        }
    }
    class dn {
        constructor(){
            const e = u.realmModel.scene.children.filter(({ name: l })=>l.startsWith("kunai")), t = u.realmModel.scene.getObjectByName("base_kunai"), s = new cn, o = new ge(t.geometry, s, e.length), { x: n, y: a, z: r } = t.geometry.boundingBox.max;
            e.forEach((l, d)=>{
                o.setMatrixAt(d, l.matrix);
                const h = ae.fixed().setTranslation(...l.position.toArray()).setRotation(l.quaternion).setUserData({
                    type: Z.Wood
                }), p = B.world.createRigidBody(h), A = ie.cuboid(n, a, r).setRestitution(.75);
                B.world.createCollider(A, p);
            }), L.scene.add(o);
        }
    }
    class un extends $ {
        constructor(){
            super(), this.map = u.onePieceAtlas, this.side = lt;
        }
    }
    class hn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("one_piece_posters");
            e.material = new un, L.scene.add(e);
        }
    }
    class mn {
        constructor(){
            new nn, new hn, new an, new dn, new tn;
        }
    }
    const Ct = {
        uBaseColor: m(new V),
        uRandom: m(0)
    };
    class pn extends $ {
        _uniforms;
        constructor(e){
            super(), this._uniforms = {
                ...Ct,
                ...e
            }, this.createMaterial();
        }
        setRandomSeed(e) {
            this._uniforms.uRandom.value = e;
        }
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = de(R().mul(2).add(this._uniforms.uRandom)), { stoneDiffuse: t, stoneNormalAo: s } = u.atlasesCoords.stones, o = T.computeAtlasUv(P(...t.scale), P(...t.offset), e), n = M(u.stoneAtlas, o);
            this.colorNode = n.mul(1.5);
            const a = T.computeAtlasUv(P(...s.scale), P(...s.offset), e), r = M(u.stoneAtlas, a);
            this.normalNode = new qe(r.rgb, i(.5)), this.aoNode = r.a;
        }
    }
    class fn {
        uniforms = Ct;
        constructor(){
            const e = new pn(this.uniforms), t = u.realmModel.scene.children.filter(({ name: o })=>o.endsWith("_monument"));
            t.forEach((o, n)=>{
                const a = at.seededRandom(n);
                o.material = e, o.receiveShadow = !0, o.onBeforeRender = (r, l, d, h, p)=>{
                    p.setRandomSeed(a);
                };
            }), L.scene.add(...t), u.realmModel.scene.children.filter(({ name: o })=>o.startsWith("monument_collider")).forEach((o)=>{
                const n = ae.fixed().setTranslation(...o.position.toArray()).setRotation(o.quaternion).setUserData({
                    type: Z.Stone
                }), a = B.world.createRigidBody(n), r = .5 * o.scale.x, l = .5 * o.scale.y, d = .5 * o.scale.z, h = ie.cuboid(r, l, d).setRestitution(.75);
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
    const w = {
        uUvScale: m(2.7),
        uNormalScale: m(.5),
        uRefractionStrength: m(.01),
        uFresnelScale: m(.075),
        uSpeed: m(.1),
        uNoiseScrollDir: m(new De(.1, 0)),
        uShininess: m(300),
        uMinDist: m(1),
        uMaxDist: m(15),
        uSunDir: m(je.sunDirection),
        uSunColor: m(je.sunColor.clone()),
        uTworld: m(new v(1, 0, 0)),
        uBworld: m(new v(0, 0, -1)),
        uNworld: m(new v(0, 1, 0)),
        uHighlightsGlow: m(4),
        uHighlightFresnelInfluence: m(.35),
        uDepthDistance: m(20),
        uAbsorptionRGB: m(new v(.35, .1, .08)),
        uInscatterTint: m(new V(0, .09, .09)),
        uInscatterStrength: m(.85),
        uAbsorptionScale: m(10),
        uMinOpacity: m(.5)
    };
    class gn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("water");
            e.material = new wn, e.renderOrder = 100, w.uTworld.value.transformDirection(e.matrixWorld).normalize(), w.uBworld.value.transformDirection(e.matrixWorld).normalize(), w.uNworld.value.transformDirection(e.matrixWorld).normalize();
            const s = e.geometry.boundingSphere;
            s.radius = s.radius * .75, L.scene.add(e), F.on("audio-ready", ()=>{
                e.add(oe.lake);
            });
        }
    }
    class wn extends Dt {
        constructor(){
            super(), this.createMaterial(), this.debugWater();
        }
        debugWater() {
            const e = ee.panel.addFolder({
                title: "🌊 Water",
                expanded: !0
            }), t = e.addFolder({
                title: "Waves",
                expanded: !0
            });
            t.addBinding(w.uSpeed, "value", {
                label: "Speed"
            }), t.addBinding(w.uNormalScale, "value", {
                label: "Normal scale"
            }), t.addBinding(w.uUvScale, "value", {
                label: "UV scale"
            });
            const s = e.addFolder({
                title: "Highlights",
                expanded: !0
            });
            s.addBinding(w.uShininess, "value", {
                label: "Shininess"
            }), s.addBinding(w.uHighlightsGlow, "value", {
                label: "Glow"
            }), s.addBinding(w.uHighlightFresnelInfluence, "value", {
                label: "Fresnel influence"
            }), s.addBinding(w.uSunColor, "value", {
                label: "Sun color",
                view: "color",
                color: {
                    type: "float"
                }
            });
            const o = e.addFolder({
                title: "Reflections / Refraction",
                expanded: !0
            });
            o.addBinding(w.uRefractionStrength, "value", {
                label: "Refraction strength"
            }), o.addBinding(w.uFresnelScale, "value", {
                label: "Fresnel scale"
            });
            const n = e.addFolder({
                title: "Beer-Lambert",
                expanded: !0
            });
            n.addBinding(w.uInscatterStrength, "value", {
                label: "Inscatter strength"
            }), n.addBinding(w.uInscatterTint, "value", {
                label: "Inscatter tint",
                view: "color",
                color: {
                    type: "float"
                }
            }), n.addBinding(w.uAbsorptionRGB, "value", {
                label: "Absorption coeff"
            }), n.addBinding(w.uAbsorptionScale, "value", {
                label: "Absorption scale"
            });
            const a = e.addFolder({
                title: "General",
                expanded: !0
            });
            a.addBinding(w.uMinOpacity, "value", {
                label: "Min opacity"
            }), a.addBinding(w.uMinDist, "value", {
                label: "Min opacity distance"
            }), a.addBinding(w.uMaxDist, "value", {
                label: "Max opacity distance"
            }), a.addBinding(w.uDepthDistance, "value", {
                label: "Depth distance"
            });
        }
        sampleNormal = f(([e = P(0)])=>M(u.waterNormal, e).mul(2).sub(1).rgb.normalize());
        createMaterial() {
            this.precision = "lowp";
            const e = ne.mul(w.uSpeed), t = w.uNoiseScrollDir.mul(e), s = R().add(t).mul(w.uUvScale.mul(1.37)).fract(), o = this.sampleNormal(s), n = R().sub(t).mul(w.uUvScale.mul(.73)).fract(), a = this.sampleNormal(n), r = T.blendRNM(o, a), l = I(r.xy.mul(w.uNormalScale), r.z).normalize(), d = l.x.mul(w.uTworld).add(l.y.mul(w.uBworld)).add(l.z.mul(w.uNworld)).normalize(), h = yt(st).r, p = bt.element(3).element(2), A = bt.element(2).element(2), y = p.div(h.add(A)), b = _s.z.negate(), S = _(b, y), G = y.sub(b).div(w.uDepthDistance).clamp(), z = C(w.uRefractionStrength, w.uRefractionStrength.mul(1.5), G), H = l.xy.mul(z), j = st.add(H.mul(S)), te = yt(j).r, re = p.div(te.add(A)), W = _(b, re), me = re.sub(b).div(w.uDepthDistance).clamp(), Y = Ps(ot.sub(ue)), Q = St(Y.negate(), d), J = Es(u.envMapTexture, Q), ye = nt(d, Y).clamp(), Me = i(.02), le = i(1).sub(ye), Ye = le.mul(le).mul(le).mul(le).mul(le), Re = Me.add(i(1).sub(Me).mul(Ye)), Je = Re.mul(w.uFresnelScale).clamp(), Xe = C(st, j, W), Fe = Ds(Xe).rgb, dt = St(w.uSunDir, d), $e = Ze(nt(dt, Y), 0), Ue = ct($e, w.uShininess), Qe = C(i(1), Re, w.uHighlightFresnelInfluence), Oe = w.uSunColor.mul(Ue.mul(w.uHighlightsGlow).mul(Qe)), Te = nt(ue.xz.sub(ot.xz), ue.xz.sub(ot.xz)), pe = w.uMinDist.mul(w.uMinDist), Ie = w.uMaxDist.mul(w.uMaxDist), ve = q(pe, Ie, Te).add(w.uMinOpacity).clamp(), ut = w.uAbsorptionRGB.mul(w.uAbsorptionScale), Le = C(G, me, W), _e = Ts(ut.negate().mul(Le)), ke = Fe.mul(_e), Ge = w.uInscatterTint.mul(i(1).sub(_e)).mul(w.uInscatterStrength), ze = ke.add(Ge), et = C(ze, J, Je), tt = C(Fe, et, ve);
            this.colorNode = tt.add(Oe);
        }
    }
    const Lt = 20;
    class yn extends $ {
        _noiseBuffer;
        constructor(){
            super(), this._noiseBuffer = Ce(Lt, "float"), this._noiseBuffer.setPBO(!0), we.renderer.computeAsync(this.computeInit), this.precision = "lowp", this.flatShading = !1;
            const e = O(x), t = this._noiseBuffer.element(x), s = _(.5, t), o = i(1).sub(s), n = de(R().mul(3.6).add(e)), a = de(R().mul(1.5).add(e)), r = n.mul(s).add(a.mul(o)), { stoneDiffuse: l, stoneNormalAo: d, stoneMossyDiffuse: h, stoneMossyNormalAo: p } = u.atlasesCoords.stones, A = P(...l.scale).mul(s), y = P(...h.scale).mul(o), b = A.add(y), S = P(...l.offset).mul(s), k = P(...h.offset).mul(o), G = S.add(k), z = T.computeAtlasUv(b, G, r);
            this.colorNode = M(u.stoneAtlas, z);
            const H = P(...d.scale).mul(s), j = P(...p.scale).mul(o), te = H.add(j), re = P(...d.offset).mul(s), W = P(...p.offset).mul(o), he = re.add(W), me = T.computeAtlasUv(te, he, r), Y = M(u.stoneAtlas, me);
            this.normalNode = new qe(Y.rgb, i(3)), this.normalScale = new De(1, -1), this.aoNode = Y.a;
        }
        computeInit = f(()=>{
            const e = this._noiseBuffer.element(x), t = P(O(x), O(x).mul(21.63)).fract(), s = M(u.noiseTexture, t);
            e.assign(s.r);
        })().compute(Lt);
    }
    class bn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("stone"), t = u.realmModel.scene.children.filter(({ name: n })=>n.startsWith("stone_collider")), s = new yn, o = new ge(e.geometry, s, t.length);
            o.receiveShadow = !0, t.forEach((n, a)=>{
                o.setMatrixAt(a, n.matrix);
                const r = ae.fixed().setTranslation(...n.position.toArray()).setRotation(n.quaternion).setUserData({
                    type: Z.Stone
                }), l = B.world.createRigidBody(r);
                n.geometry.computeBoundingBox();
                const d = n.geometry.boundingBox.max.x * n.scale.x, h = ie.ball(d).setRestitution(.75);
                B.world.createCollider(h, l);
            }), L.scene.add(o);
        }
    }
    const Sn = {
        uGrassTerrainColor: m(new V().setRGB(.74, .51, 0)),
        uWaterSandColor: m(new V().setRGB(.54, .39, .2)),
        uPathSandColor: m(new V().setRGB(.65, .49, .27))
    };
    class An extends $ {
        _uniforms = {
            ...Sn
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
        computeCausticsDiffuse = f(([e = P(0, 0), t = i(0), s = I(0, 0, 0)])=>{
            const o = ne.mul(.15), n = e.mul(17), a = de(n.add(P(o, 0))), r = M(u.noiseTexture, a, 1).g, l = e.mul(33), d = de(l.add(P(0, o.negate()))), h = M(u.noiseTexture, d, 3).g, p = r.add(h), A = q(-1, 7.5, t), y = ct(p, 3).mul(i(1).sub(A)), b = I(.6, .8, 1).mul(.5);
            return C(s, b, y);
        });
        computeWaterDiffuse = f(([e = i(0), t = P(0, 0)])=>{
            const s = i(8), o = i(.001), n = q(0, s.add(o), e), a = this._uniforms.uWaterSandColor, r = I(.35, .45, .55).mul(.65), l = this.computeCausticsDiffuse(t, e), d = q(0, 1.5, e), h = I(1, .9, .7).mul(.1).mul(d);
            return C(a, r, n).add(h).add(l);
        });
        createMaterial() {
            this.precision = "lowp", this.flatShading = !1;
            const e = T.computeMapUvByPosition(ue.xz), t = it(e), s = M(u.terrainShadowAo, R().clamp());
            this.aoNode = s.g;
            const o = M(u.terrainTypeMap, t, 2.5), n = o.g, a = o.b, l = i(1).sub(n).sub(a), d = M(u.sandNormal, de(t.mul(30))), h = de(t.mul(30)), A = M(u.grassNormal, h).dot(d).mul(.65), y = M(u.grassDiffuse, h), b = i(1).sub(y.a), S = this._uniforms.uGrassTerrainColor.mul(b).add(y).mul(n).mul(.85), k = this._uniforms.uPathSandColor.mul(1.2).mul(l), G = it(ue.y.negate()), H = this.computeWaterDiffuse(G, t).mul(a), j = S.add(k.mul(A)).add(H.mul(A).mul(.5));
            this.colorNode = j.mul(s.r);
        }
    }
    class xn {
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
                const h = s.array[d * 3 + 0], p = s.array[d * 3 + 1], A = s.array[d * 3 + 2], y = Math.round((h / (r * 2) + .5) * (a - 1)), S = Math.round((A / (r * 2) + .5) * (a - 1)) + y * a;
                l[S] = p;
            }
            return {
                rowsCount: a,
                heights: l,
                displacement: t
            };
        }
        createFloorPhysics() {
            const e = this.getFloorDisplacementData(), { rowsCount: t, heights: s, displacement: o } = e, n = ae.fixed().setTranslation(0, -o, 0).setUserData({
                type: Z.Terrain
            }), a = B.world.createRigidBody(n), r = ie.heightfield(t - 1, t - 1, s, {
                x: X.MAP_SIZE,
                y: 1,
                z: X.MAP_SIZE
            }, Hs.FIX_INTERNAL_EDGES).setFriction(1).setRestitution(.2);
            B.world.createCollider(r, a);
        }
    }
    class Mn {
        outerFloor;
        kintoun;
        kintounPosition = new v;
        constructor(e){
            this.outerFloor = this.createOuterFloorVisual(), this.outerFloor.material = e, this.kintoun = this.createKintoun(), L.scene.add(this.outerFloor), F.on("update", this.update.bind(this));
        }
        createOuterFloorVisual() {
            const e = u.realmModel.scene.getObjectByName("outer_world");
            return e.receiveShadow = !0, e;
        }
        createKintoun() {
            const e = ae.kinematicPositionBased().setTranslation(0, -20, 0).setUserData({
                type: Z.Terrain
            }), t = B.world.createRigidBody(e), s = 2, o = ie.cuboid(s, X.HALF_FLOOR_THICKNESS, s).setFriction(1).setRestitution(.2);
            return B.world.createCollider(o, t), t;
        }
        useKintoun(e) {
            this.kintounPosition.copy(e).setY(-X.HALF_FLOOR_THICKNESS), this.kintoun.setTranslation(this.kintounPosition, !0);
        }
        update(e) {
            const { player: t } = e, s = X.HALF_MAP_SIZE - Math.abs(t.position.x) < X.KINTOUN_ACTIVATION_THRESHOLD, o = X.HALF_MAP_SIZE - Math.abs(t.position.z) < X.KINTOUN_ACTIVATION_THRESHOLD;
            (s || o) && this.useKintoun(t.position);
            const n = X.MAP_SIZE, a = Math.abs(t.position.x), r = Math.sign(t.position.x), l = Math.abs(t.position.z), d = Math.sign(t.position.z), h = a > n ? a - n : 0, p = l > n ? l - n : 0;
            this.outerFloor.position.set(h * r, 0, p * d);
        }
    }
    class In {
        constructor(){
            const e = new An;
            new xn(e), new Mn(e);
        }
    }
    const Ln = ()=>({
            BLADE_WIDTH: .1,
            BLADE_HEIGHT: 1.65,
            BLADE_BOUNDING_SPHERE_RADIUS: 1.65,
            TILE_SIZE: 150,
            TILE_HALF_SIZE: 150 / 2,
            BLADES_PER_SIDE: 512,
            COUNT: 512 * 512,
            SPACING: 150 / 512,
            WORKGROUP_SIZE: 256
        }), E = Ln(), g = {
        uPlayerPosition: m(new v(0, 0, 0)),
        uCameraMatrix: m(new Ke),
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
        uDelta: m(new De(0, 0)),
        uGlowMul: m(3),
        uR0: m(20),
        uR1: m(75),
        uPMin: m(.05),
        uWindSpeed: m(.25)
    };
    class _n {
        buffer;
        constructor(){
            this.buffer = Ce(E.COUNT, "vec4"), this.computeUpdate.onInit(({ renderer: e })=>{
                e.computeAsync(this.computeInit);
            });
        }
        get computeBuffer() {
            return this.buffer;
        }
        getYaw = f(([e = U(0)])=>T.unpackUnits(e.z, 0, 12, -Math.PI, Math.PI));
        getBend = f(([e = U(0)])=>T.unpackUnits(e.z, 12, 12, -Math.PI, Math.PI));
        getScale = f(([e = U(0)])=>T.unpackUnits(e.w, 0, 8, g.uBladeMinScale, g.uBladeMaxScale));
        getOriginalScale = f(([e = U(0)])=>T.unpackUnits(e.w, 8, 8, g.uBladeMinScale, g.uBladeMaxScale));
        getShadow = f(([e = U(0)])=>T.unpackFlag(e.w, 16));
        getVisibility = f(([e = U(0)])=>T.unpackFlag(e.w, 17));
        getGlow = f(([e = U(0)])=>T.unpackUnit(e.w, 18, 6));
        setYaw = f(([e = U(0), t = i(0)])=>(e.z = T.packUnits(e.z, 0, 12, t, -Math.PI, Math.PI), e));
        setBend = f(([e = U(0), t = i(0)])=>(e.z = T.packUnits(e.z, 12, 12, t, -Math.PI, Math.PI), e));
        setScale = f(([e = U(0), t = i(0)])=>(e.w = T.packUnits(e.w, 0, 8, t, g.uBladeMinScale, g.uBladeMaxScale), e));
        setOriginalScale = f(([e = U(0), t = i(0)])=>(e.w = T.packUnits(e.w, 8, 8, t, g.uBladeMinScale, g.uBladeMaxScale), e));
        setShadow = f(([e = U(0), t = i(0)])=>(e.w = T.packFlag(e.w, 16, t), e));
        setVisibility = f(([e = U(0), t = i(0)])=>(e.w = T.packFlag(e.w, 17, t), e));
        setGlow = f(([e = U(0), t = i(0)])=>(e.w = T.packUnit(e.w, 18, 6, t), e));
        computeInit = f(()=>{
            const e = this.buffer.element(x), t = Ae(i(x).div(E.BLADES_PER_SIDE)), s = i(x).mod(E.BLADES_PER_SIDE), o = O(x.add(4321)), n = O(x.add(1234)), a = s.mul(E.SPACING).sub(E.TILE_HALF_SIZE).add(o.mul(E.SPACING * .5)), r = t.mul(E.SPACING).sub(E.TILE_HALF_SIZE).add(n.mul(E.SPACING * .5)), l = I(a, 0, r).xz.add(E.TILE_HALF_SIZE).div(E.TILE_SIZE).abs(), d = M(u.noiseTexture, l), h = d.r.sub(.5).mul(17).fract(), p = d.b.sub(.5).mul(13).fract();
            e.x = a.add(h), e.y = r.add(p);
            const A = d.b.sub(.5).mul(i(Math.PI * 2));
            e.assign(this.setYaw(e, A));
            const y = g.uBladeMaxScale.sub(g.uBladeMinScale), b = d.r.mul(y).add(g.uBladeMinScale);
            e.assign(this.setScale(e, b)), e.assign(this.setOriginalScale(e, b));
        })().compute(E.COUNT, [
            E.WORKGROUP_SIZE
        ]);
        computeStochasticKeep = f(([e = I(0)])=>{
            const t = e.x.sub(g.uPlayerPosition.x), s = e.z.sub(g.uPlayerPosition.z), o = t.mul(t).add(s.mul(s)), n = g.uR0, a = g.uR1, r = g.uPMin, l = n.mul(n), d = a.mul(a), h = rt(o.sub(l).div(Ze(d.sub(l), 1e-5)), 0, 1), p = C(1, r, h), A = O(i(x).mul(.73));
            return _(A, p);
        });
        computeVisibility = f(([e = I(0)])=>{
            const t = g.uCameraMatrix.mul(U(e, 1)), s = t.xyz.div(t.w), o = E.BLADE_BOUNDING_SPHERE_RADIUS, n = i(1);
            return _(n.negate().sub(o), s.x).mul(_(s.x, n.add(o))).mul(_(n.negate().sub(o), s.y)).mul(_(s.y, n.add(o))).mul(_(0, s.z)).mul(_(s.z, n));
        });
        computeBending = f(([e = i(0), t = I(0)])=>{
            const s = t.xz.add(ne.mul(g.uWindSpeed)).mul(.5).fract(), n = M(u.noiseTexture, s, 2).r.mul(g.uWindStrength);
            return e.add(n.sub(e).mul(.1));
        });
        computeAlpha = f(([e = I(0)])=>{
            const t = T.computeMapUvByPosition(e.xz), s = M(u.terrainTypeMap, t).g;
            return _(.25, s);
        });
        computeTrailScale = f(([e = i(0), t = i(0), s = i(0)])=>{
            const o = t.add(g.uTrailGrowthRate), n = i(1).sub(s), a = g.uTrailMinScale.mul(s).add(o.mul(n));
            return Bs(a, e);
        });
        computeTrailGlow = f(([e = i(0), t = i(0), s = i(0), o = i(0)])=>{
            const n = q(g.uGlowRadiusSquared, i(0), t), a = 100, r = Ae(At(g.uDelta.x).mul(a)), l = Ae(At(g.uDelta.y).mul(a)), d = _(1, r.add(l)), h = n.mul(i(1).sub(s)).mul(o), p = Ze(d, e).mul(h), A = p.mul(g.uGlowFadeIn), y = i(1).sub(p).mul(g.uGlowFadeOut), b = i(1).sub(d).mul(g.uGlowFadeOut).mul(e);
            return rt(e.add(A).sub(y).sub(b), 0, 1);
        });
        computeShadow = f(([e = I(0)])=>{
            const t = T.computeMapUvByPosition(e.xz), s = M(u.terrainShadowAo, t);
            return _(.65, s.r);
        });
        computeUpdate = f(()=>{
            const e = this.buffer.element(x), t = Ee(e.x.sub(g.uDelta.x).add(E.TILE_HALF_SIZE), E.TILE_SIZE).sub(E.TILE_HALF_SIZE), s = Ee(e.y.sub(g.uDelta.y).add(E.TILE_HALF_SIZE), E.TILE_SIZE).sub(E.TILE_HALF_SIZE), o = I(t, 0, s);
            e.x = t, e.y = s;
            const n = o.add(g.uPlayerPosition), a = this.computeStochasticKeep(n), r = this.computeVisibility(n).mul(a);
            e.assign(this.setVisibility(e, r)), Tt(r, ()=>{
                const l = P(g.uDelta.x, g.uDelta.y), d = o.xz.sub(l), h = d.dot(d), p = _(.1, i(1).sub(g.uPlayerPosition.y)), A = _(h, g.uTrailRaiusSquared).mul(p), y = this.getScale(e), b = this.getOriginalScale(e), S = this.computeTrailScale(b, y, A);
                e.assign(this.setScale(e, S));
                const k = this.computeAlpha(n);
                e.assign(this.setVisibility(e, k));
                const G = this.getBend(e), z = this.computeBending(G, n);
                e.assign(this.setBend(e, z));
                const H = this.getGlow(e), j = this.computeTrailGlow(H, h, A, p);
                e.assign(this.setGlow(e, j));
                const te = this.computeShadow(n);
                e.assign(this.setShadow(e, te));
            });
        })().compute(E.COUNT, [
            E.WORKGROUP_SIZE
        ]);
    }
    class Pn extends Dt {
        ssbo;
        constructor(e){
            super(), this.ssbo = e, this.createGrassMaterial();
        }
        computePosition = f(([e = i(0), t = i(0), s = i(0), o = i(0), n = i(0), a = i(0)])=>{
            const r = I(e, 0, t), l = o.mul(R().y), h = xt(Ne, I(l, 0, 0)).mul(I(1, n, 1)), p = xt(h, I(0, s, 0)), A = O(x).mul(Se), y = xe(ne.mul(5).add(o).add(A)).mul(.1), b = R().y.mul(a), S = y.mul(b);
            return p.add(r).add(I(S));
        });
        computeDiffuseColor = f(([e = i(0), t = i(1)])=>{
            const s = C(g.uBaseColor, g.uTipColor, R().y), o = C(s, g.uGlowColor.mul(g.uGlowMul), e);
            return C(o.mul(.5), o, t);
        });
        createGrassMaterial() {
            this.precision = "lowp", this.side = lt;
            const e = this.ssbo.computeBuffer.element(x), t = e.x, s = e.y, o = this.ssbo.getYaw(e), n = this.ssbo.getBend(e), a = this.ssbo.getScale(e), r = this.ssbo.getVisibility(e), l = this.ssbo.getGlow(e), d = this.ssbo.getShadow(e);
            Cs(r.equal(0)), this.positionNode = this.computePosition(t, s, o, n, a, l), this.opacityNode = r, this.alphaTest = .5, this.colorNode = this.computeDiffuseColor(l, d);
        }
    }
    class En {
        constructor(){
            const e = new _n, t = this.createGeometry(3), s = new Pn(e), o = new ge(t, s, E.COUNT);
            o.frustumCulled = !1, L.scene.add(o), F.on("update-throttle-2x", ({ player: n })=>{
                const a = n.position.x - o.position.x, r = n.position.z - o.position.z;
                g.uDelta.value.set(a, r), g.uPlayerPosition.value.copy(n.position), g.uCameraMatrix.value.copy(L.playerCamera.projectionMatrix).multiply(L.playerCamera.matrixWorldInverse), o.position.copy(n.position).setY(0), we.renderer.computeAsync(e.computeUpdate);
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
                max: E.TILE_SIZE,
                step: .1
            }), e.addBinding(g.uR1, "value", {
                label: "Outer ring",
                min: 0,
                max: E.TILE_SIZE,
                step: .1
            }), e.addBinding(g.uPMin, "value", {
                label: "P Min",
                min: 0,
                max: 1,
                step: .01
            });
        }
        createGeometry(e) {
            const t = Math.max(1, Math.floor(e)), s = E.BLADE_HEIGHT, o = E.BLADE_WIDTH * .5, n = t, a = n * 2 + 1, l = Math.max(0, n - 1) * 6 + 3, d = new Float32Array(a * 3), h = new Float32Array(a * 2), p = new Uint8Array(l), A = new Float32Array(l * 3), y = (W)=>o * (1 - .7 * W);
            let b = 0;
            for(let W = 0; W < n; W++){
                const he = W / t, me = he * s, Y = y(he), Q = W * 2, J = Q + 1;
                if (d[3 * Q + 0] = -Y, d[3 * Q + 1] = me, d[3 * Q + 2] = 0, d[3 * J + 0] = Y, d[3 * J + 1] = me, d[3 * J + 2] = 0, h[2 * Q + 0] = 0, h[2 * Q + 1] = he, h[2 * J + 0] = 1, h[2 * J + 1] = he, W > 0) {
                    const ye = (W - 1) * 2, Me = ye + 1;
                    p[b++] = ye, p[b++] = Me, p[b++] = J, p[b++] = ye, p[b++] = J, p[b++] = Q;
                }
            }
            const S = n * 2;
            d[3 * S + 0] = 0, d[3 * S + 1] = s, d[3 * S + 2] = 0, h[2 * S + 0] = .5, h[2 * S + 1] = 1;
            const k = (n - 1) * 2, G = k + 1;
            p[b++] = k, p[b++] = G, p[b++] = S;
            const z = new vs, H = new He(d, 3);
            H.setUsage(We), z.setAttribute("position", H);
            const j = new He(h, 2);
            j.setUsage(We), z.setAttribute("uv", j);
            const te = new He(p, 1);
            te.setUsage(We), z.setIndex(te);
            const re = new He(A, 3);
            return re.setUsage(We), z.setAttribute("normal", re), z;
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
        }), N = Dn();
    class Tn {
        flowerField;
        material;
        uniforms = {
            ...Nt,
            uDelta: m(new De(0, 0)),
            uPlayerPosition: m(new v(0, 0, 0)),
            uCameraMatrix: m(new Ke)
        };
        constructor(){
            this.material = new vn(this.uniforms), this.flowerField = new ge(new _t(1, 1), this.material, N.COUNT), L.scene.add(this.flowerField), F.on("update", this.updateAsync.bind(this));
        }
        async updateAsync(e) {
            const { player: t } = e, s = t.position.x - this.flowerField.position.x, o = t.position.z - this.flowerField.position.z;
            this.uniforms.uDelta.value.set(s, o), this.uniforms.uPlayerPosition.value.copy(t.position), this.uniforms.uCameraMatrix.value.copy(L.playerCamera.projectionMatrix).multiply(L.playerCamera.matrixWorldInverse), this.flowerField.position.copy(t.position).setY(0), this.material.updateAsync();
        }
    }
    const Nt = {
        uPlayerPosition: m(new v(0, 0, 0)),
        uCameraMatrix: m(new Ke),
        uDelta: m(new De(0, 0))
    };
    class vn extends Et {
        _uniforms;
        _buffer1;
        constructor(e){
            super(), this._uniforms = {
                ...Nt,
                ...e
            }, this._buffer1 = Ce(N.COUNT, "vec4"), this._buffer1.setPBO(!0), this.computeUpdate.onInit(({ renderer: t })=>{
                t.computeAsync(this.computeInit);
            }), this.createMaterial();
        }
        computeInit = f(()=>{
            const e = this._buffer1.element(x), t = Ae(i(x).div(N.FLOWERS_PER_SIDE)), s = i(x).mod(N.FLOWERS_PER_SIDE), o = O(x.add(4321)), n = O(x.add(1234)), a = s.mul(N.SPACING).sub(N.TILE_HALF_SIZE).add(o.mul(N.SPACING * .5)), r = t.mul(N.SPACING).sub(N.TILE_HALF_SIZE).add(n.mul(N.SPACING * .5)), l = I(a, 0, r).xz.add(N.TILE_HALF_SIZE).div(N.TILE_SIZE).abs(), h = M(u.noiseTexture, l).r, p = h.sub(.5).mul(100), A = h.clamp(.5, .75), y = h.sub(.5).mul(50);
            e.x = a.add(p), e.y = A, e.z = r.add(y);
        })().compute(N.COUNT);
        computeVisibility = f(([e = I(0)])=>{
            const t = this._uniforms.uCameraMatrix.mul(U(e, 1)), s = t.xyz.div(t.w), o = N.BLADE_BOUNDING_SPHERE_RADIUS, n = i(1);
            return _(n.negate().sub(o), s.x).mul(_(s.x, n.add(o))).mul(_(n.negate().sub(o), s.y)).mul(_(s.y, n.add(o))).mul(_(0, s.z)).mul(_(s.z, n));
        });
        computeAlpha = f(([e = I(0)])=>{
            const t = T.computeMapUvByPosition(e.xz);
            return M(u.terrainTypeMap, t).g;
        });
        computeUpdate = f(()=>{
            const e = this._buffer1.element(x), t = Ee(e.x.sub(this._uniforms.uDelta.x).add(N.TILE_HALF_SIZE), N.TILE_SIZE).sub(N.TILE_HALF_SIZE), s = Ee(e.z.sub(this._uniforms.uDelta.y).add(N.TILE_HALF_SIZE), N.TILE_SIZE).sub(N.TILE_HALF_SIZE);
            e.x = t, e.z = s;
            const n = I(e.x, 0, e.z).add(this._uniforms.uPlayerPosition), a = this.computeVisibility(n);
            e.w = a, Tt(a, ()=>{
                e.w = this.computeAlpha(n);
            });
        })().compute(N.COUNT);
        createMaterial() {
            this.precision = "lowp";
            const e = this._buffer1.element(x), t = O(x.add(9234)), s = O(x.add(33.87)), o = ne.mul(2), n = xe(o.add(t.mul(100))).mul(.05);
            this.positionNode = e.xyz.add(I(n, 0, n)), this.scaleNode = t.mul(.2).add(.3);
            const a = _(.5, t).mul(.5), r = _(.5, s).mul(.5), d = R().mul(.5).add(P(a, r)), h = M(u.flowerAtlas, d);
            this.colorNode = h, this.opacityNode = e.w, this.alphaTest = .15;
        }
        async updateAsync() {
            we.renderer.computeAsync(this.computeUpdate);
        }
    }
    class Bn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("water_lilies");
            e.material = this.createMaterial(), L.scene.add(e);
        }
        createMaterial() {
            const e = new $;
            e.precision = "lowp", e.transparent = !0, e.map = u.waterLiliesTexture, e.alphaTest = .5, e.alphaMap = u.waterLiliesAlphaTexture;
            const t = ne.mul(5e-4), s = ue.x.mul(.1), o = M(u.noiseTexture, de(ue.xz.add(t).mul(s))).b.mul(.5), n = xe(o);
            return e.positionNode = Ne.add(n), e;
        }
    }
    class Cn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1;
            const e = de(R().mul(7)), t = M(u.barkDiffuse, e);
            this.colorNode = t.mul(2.5);
            const s = M(u.barkNormal, e);
            this.normalNode = new qe(s);
        }
    }
    const Pe = {
        uPrimaryColor: m(new V().setRGB(.889, .095, 0)),
        uSecondaryColor: m(new V().setRGB(1, .162, .009)),
        uMixFactor: m(.5)
    };
    class Nn extends $ {
        constructor(){
            super(), this.precision = "lowp", this.flatShading = !1, this.transparent = !0, this.side = lt;
            const e = T.computeMapUvByPosition(ue.xz), t = M(u.noiseTexture, e), s = M(u.canopyDiffuse, R()), o = C(Pe.uPrimaryColor, Pe.uSecondaryColor, Pe.uMixFactor);
            this.colorNode = U(C(s.rgb, o, t.b.mul(.4)).rgb, 1);
            const n = M(u.canopyNormal, R());
            this.normalNode = new qe(n, i(1.25)), this.normalScale = new De(1, -1), this.opacityNode = _(.5, s.a), this.alphaTest = .1;
            const a = ne.mul(t.r).add(Ns).mul(7.5), r = xe(a).mul(.015), l = Pt(a.mul(.75)).mul(.01);
            this.positionNode = Ne.add(I(0, l, r));
        }
    }
    class Rn {
        constructor(){
            const e = u.realmModel.scene.getObjectByName("tree"), t = u.realmModel.scene.children.filter(({ name: y })=>y.startsWith("tree_collider")), s = new Cn, o = new Nn, [n, a] = e.children, r = new ge(n.geometry, s, t.length);
            r.receiveShadow = !0;
            const l = new ge(a.geometry, o, t.length), h = u.realmModel.scene.getObjectByName("base_tree_collider").geometry.boundingBox, p = h.max.x, A = h.max.y / 2;
            t.forEach((y, b)=>{
                r.setMatrixAt(b, y.matrix), l.setMatrixAt(b, y.matrix);
                const S = ae.fixed().setTranslation(...y.position.toArray()).setRotation(y.quaternion).setUserData({
                    type: Z.Wood
                }), k = B.world.createRigidBody(S), G = p * y.scale.x, z = A * y.scale.y, H = ie.capsule(z, G).setRestitution(.75);
                B.world.createCollider(H, k);
            }), L.scene.add(r, l), this.debugTrees();
        }
        debugTrees() {
            const e = ee.panel.addFolder({
                title: "🌳 Trees"
            });
            e.expanded = !1, e.addBinding(Pe.uPrimaryColor, "value", {
                label: "Primary Leaf Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(Pe.uSecondaryColor, "value", {
                label: "Seconary Leaf Color",
                view: "color",
                color: {
                    type: "float"
                }
            }), e.addBinding(Pe.uMixFactor, "value", {
                label: "Mix factor"
            });
        }
    }
    class Fn {
        constructor(){
            new En, new Bn, new Tn, new Rn;
        }
    }
    const Un = "/textures/hud/compass.webp", On = "/textures/hud/compassArrow.webp";
    class kn {
        constructor(){
            const e = document.createElement("div");
            e.classList.add("compass-container");
            const t = document.createElement("img");
            t.setAttribute("alt", "compass"), t.setAttribute("src", Un), t.classList.add("compass"), e.appendChild(t);
            const s = document.createElement("img");
            s.setAttribute("alt", "arrow"), s.setAttribute("src", On), s.classList.add("compass-arrow"), e.appendChild(s), document.body.appendChild(e);
            const o = X.MAP_SIZE / 2;
            let n = 0;
            F.on("update-throttle-16x", ({ player: a })=>{
                const r = Math.abs(a.position.x) > o, l = Math.abs(a.position.z) > o, h = r || l ? .65 : 0;
                if (e.style.setProperty("--opacity", `${h}`), !h) return;
                const p = Math.atan2(-a.position.x, -a.position.z);
                n = this.unwrapAngle(n, p - a.yaw), s.style.setProperty("--yaw", `${-n}rad`);
            });
        }
        unwrapAngle(e, t) {
            const s = t - e;
            return e + ((s + Math.PI) % (2 * Math.PI) - Math.PI);
        }
    }
    const Gn = ()=>Object.freeze({
            MAP_SIZE: 256,
            HALF_MAP_SIZE: 256 / 2,
            KINTOUN_ACTIVATION_THRESHOLD: 2,
            HALF_FLOOR_THICKNESS: .3,
            OUTER_MAP_SIZE: 256 * 3,
            OUTER_HALF_MAP_SIZE: 256 * 1.5
        }), X = Gn();
    class zn {
        constructor(){
            new kn, new In, new fn, new gn, new Fn, new bn, new mn;
        }
    }
    class Hn {
        pow2 = f(([e = i(0)])=>ct(i(2), e));
        packF32 = f(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1), a = i(0)])=>{
            const r = se(this.pow2(s), 1), l = se(o, a).div(Ze(n, 1e-20)), d = rt(Rs(l), 0, r), h = this.pow2(t), p = this.pow2(s), A = Ae(e.div(h)), y = Ee(A, p).mul(h);
            return e.sub(y).add(d.mul(h));
        });
        unpackF32 = f(([e = i(0), t = i(0), s = i(8), o = i(1), n = i(0)])=>{
            const a = this.pow2(t), r = this.pow2(s), l = Ae(e.div(a));
            return Ee(l, r).mul(o).add(n);
        });
        packUnit = f(([e = i(0), t = i(0), s = i(8), o = i(0)])=>{
            const n = i(1).div(se(this.pow2(s), 1));
            return this.packF32(e, t, s, o, n, i(0));
        });
        unpackUnit = f(([e = i(0), t = i(0), s = i(8)])=>{
            const o = i(1).div(se(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, i(0));
        });
        packFlag = f(([e = i(0), t = i(0), s = i(0)])=>this.packF32(e, t, i(1), s, i(1), i(0)));
        unpackFlag = f(([e = i(0), t = i(0)])=>this.unpackF32(e, t, i(1), i(1), i(0)));
        packAngle = f(([e = i(0), t = i(0), s = i(9), o = i(0)])=>{
            const n = se(this.pow2(s), 1), a = Se.div(n), r = o.sub(Se.mul(Ae(o.div(Se))));
            return this.packF32(e, t, s, r, a, i(0));
        });
        unpackAngle = f(([e = i(0), t = i(0), s = i(9)])=>{
            const o = Se.div(se(this.pow2(s), 1));
            return this.unpackF32(e, t, s, o, i(0));
        });
        packSigned = f(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1)])=>{
            const a = se(this.pow2(s), 1), r = n.mul(2).div(a), l = n.negate();
            return this.packF32(e, t, s, o, r, l);
        });
        unpackSigned = f(([e = i(0), t = i(0), s = i(8), o = i(1)])=>{
            const n = o.mul(2).div(se(this.pow2(s), 1)), a = o.negate();
            return this.unpackF32(e, t, s, n, a);
        });
        packUnits = f(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(0), a = i(1)])=>{
            const r = se(this.pow2(s), 1), l = a.sub(n).div(r);
            return this.packF32(e, t, s, o, l, n);
        });
        unpackUnits = f(([e = i(0), t = i(0), s = i(8), o = i(0), n = i(1)])=>{
            const a = n.sub(o).div(se(this.pow2(s), 1));
            return this.unpackF32(e, t, s, a, o);
        });
        computeMapUvByPosition = f(([e = P(0)])=>e.add(X.HALF_MAP_SIZE).div(X.MAP_SIZE));
        computeAtlasUv = f(([e = P(0), t = P(0), s = P(0)])=>s.mul(e).add(t));
        blendRNM = f(([e = I(0), t = I(0)])=>I(e.z.mul(t.x).add(e.x.mul(t.z)), e.z.mul(t.y).add(e.y.mul(t.z)), e.z.mul(t.z).sub(e.x.mul(t.x).add(e.y.mul(t.y)))).normalize());
        blendUDN = f(([e = I(0), t = I(0)])=>I(e.xy.add(t.xy), e.z.mul(t.z)).normalize());
    }
    const T = new Hn, Wn = ()=>({
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
        }), D = Wn();
    class Vn {
        mesh;
        rigidBody;
        smoothedCameraPosition = new v;
        desiredCameraPosition = new v;
        smoothedCameraTarget = new v;
        desiredTargetPosition = new v;
        yawInRadians = 0;
        prevYawInRadians = -1;
        yawQuaternion = new Fs;
        newLinVel = new v;
        newAngVel = new v;
        torqueAxis = new v;
        forwardVec = new v;
        isOnGround = !1;
        jumpCount = 0;
        wasJumpHeld = !1;
        jumpBufferTimer = 0;
        rayOrigin = new v;
        ray = new Ws(this.rayOrigin, D.DOWN);
        constructor(){
            this.mesh = this.createCharacterMesh(), L.scene.add(this.mesh), je.setTarget(this.mesh), this.rigidBody = B.world.createRigidBody(this.createRigidBodyDesc()), B.world.createCollider(this.createColliderDesc(), this.rigidBody), F.on("update", this.update.bind(this)), F.on("update-throttle-64x", this.resetPlayerPosition.bind(this)), this.debugPlayer();
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
            }, !1), this.rigidBody.setTranslation(D.PLAYER_INITIAL_POSITION, !0), this.mesh.position.copy(D.PLAYER_INITIAL_POSITION));
        }
        debugPlayer() {
            const e = ee.panel.addFolder({
                title: "🪩 Player",
                expanded: !1
            });
            e.addBinding(D.CAMERA_OFFSET, "y", {
                label: "Main camera height"
            }), e.addBinding(D.CAMERA_OFFSET, "z", {
                label: "Main camera distance"
            });
        }
        createCharacterMesh() {
            const e = u.realmModel.scene.getObjectByName("player");
            return e.material = new Zn, e.castShadow = !0, e.position.copy(D.PLAYER_INITIAL_POSITION), e;
        }
        createRigidBodyDesc() {
            const { x: e, y: t, z: s } = D.PLAYER_INITIAL_POSITION;
            return ae.dynamic().setTranslation(e, t, s).setLinearDamping(D.LINEAR_DAMPING).setAngularDamping(D.ANGULAR_DAMPING).setUserData({
                type: Z.Player
            });
        }
        createColliderDesc() {
            return ie.ball(D.RADIUS).setRestitution(.6).setFriction(1).setMass(D.MASS).setActiveEvents(Vs.COLLISION_EVENTS);
        }
        update(e) {
            const { clock: t } = e, s = t.getDelta();
            this.prevYawInRadians !== this.yawInRadians && (this.yawQuaternion.setFromAxisAngle(D.UP, this.yawInRadians), this.prevYawInRadians = this.yawInRadians), this.updateVerticalMovement(s), this.updateHorizontalMovement(s), this.updateCameraPosition(s);
        }
        updateVerticalMovement(e) {
            const t = Be.isJumpPressed();
            this.isOnGround = this.checkIfGrounded(), this.isOnGround && (this.jumpCount = 0), t && !this.wasJumpHeld ? this.jumpBufferTimer = D.JUMP_BUFFER_DURATION_IN_SECONDS : this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - e), this.jumpBufferTimer > 0 && this.canJump() && (this.performJump(), this.jumpBufferTimer = 0);
            const o = this.rigidBody.linvel();
            this.handleJumpCut(t, o), this.handleFastFall(e, o, B.world.gravity.y), this.clampUpwardVelocity(o), this.rigidBody.setLinvel(o, !0), this.wasJumpHeld = t;
        }
        checkIfGrounded() {
            this.rayOrigin.copy(this.rigidBody.translation()), this.rayOrigin.y -= D.RADIUS + .01;
            const e = .2, t = B.world.castRay(this.ray, e, !0);
            return t ? t.timeOfImpact * e < .01 : !1;
        }
        canJump() {
            return this.isOnGround ? !0 : this.jumpCount < D.MAX_CONSECUTIVE_JUMPS;
        }
        performJump() {
            this.rigidBody.applyImpulse(D.JUMP_IMPULSE, !0), this.jumpCount += 1;
        }
        handleJumpCut(e, t) {
            !(!e && this.wasJumpHeld) || t.y <= 0 || (t.y *= D.JUMP_CUT_MULTIPLIER);
        }
        handleFastFall(e, t, s) {
            if (t.y >= 0) return;
            const o = D.FALL_MULTIPLIER * Math.abs(s) * e;
            t.y -= o;
        }
        clampUpwardVelocity(e) {
            e.y <= D.MAX_UPWARD_VELOCITY || (e.y = D.MAX_UPWARD_VELOCITY);
        }
        updateHorizontalMovement(e) {
            const t = Be.isForward(), s = Be.isBackward(), o = Be.isLeftward(), n = Be.isRightward(), a = 2;
            o && (this.yawInRadians += a * e), n && (this.yawInRadians -= a * e), this.forwardVec.copy(D.FORWARD).applyQuaternion(this.yawQuaternion), this.torqueAxis.crossVectors(D.UP, this.forwardVec).normalize(), this.newLinVel.copy(this.rigidBody.linvel()), this.newAngVel.copy(this.rigidBody.angvel());
            const r = D.LIN_VEL_STRENGTH * e, l = D.ANG_VEL_STRENGTH * e;
            t && (this.newLinVel.addScaledVector(this.forwardVec, r), this.newAngVel.addScaledVector(this.torqueAxis, l)), s && (this.newLinVel.addScaledVector(this.forwardVec, -r), this.newAngVel.addScaledVector(this.torqueAxis, -l)), this.rigidBody.setLinvel(this.newLinVel, !0), this.rigidBody.setAngvel(this.newAngVel, !0), this.syncMeshWithBody();
        }
        syncMeshWithBody() {
            this.mesh.position.copy(this.rigidBody.translation()), this.mesh.quaternion.copy(this.rigidBody.rotation());
        }
        updateCameraPosition(e) {
            this.desiredCameraPosition.copy(D.CAMERA_OFFSET).applyQuaternion(this.yawQuaternion).add(this.mesh.position);
            const t = D.CAMERA_LERP_FACTOR * e;
            this.smoothedCameraPosition.lerp(this.desiredCameraPosition, t), this.desiredTargetPosition.copy(this.mesh.position), this.desiredTargetPosition.y += 1, this.smoothedCameraTarget.lerp(this.desiredTargetPosition, t), L.playerCamera.position.copy(this.smoothedCameraPosition), L.playerCamera.lookAt(this.smoothedCameraTarget);
        }
        get position() {
            return this.mesh.position;
        }
        get yaw() {
            return this.yawInRadians;
        }
    }
    class Zn extends $ {
        constructor(){
            super(), this.createMaterial();
        }
        createMaterial() {
            this.flatShading = !1, this.castShadowNode = I(.6);
            const e = T.computeMapUvByPosition(ue.xz), t = it(e), s = je.getTerrainShadowFactor(t), o = M(u.footballDiffuse, R()).mul(1.5);
            this.colorNode = o.mul(s);
        }
    }
    const jn = [
        30,
        60,
        120,
        144,
        160,
        165,
        170,
        180,
        240
    ], Kn = (c)=>jn.reduce((e, t)=>Math.abs(t - c) < Math.abs(e - c) ? t : e), qn = async ()=>new Promise((c)=>{
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
    class Yn {
        player;
        ENABLE_CAP_FPS = !1;
        config = {
            halvenFPS: !1
        };
        constructor(){
            this.player = new Vn, new zn, this.debugGame();
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
            if (!this.ENABLE_CAP_FPS) return;
            const e = await qn();
            this.config.halvenFPS = e >= 120;
        }
        onResize() {
            const e = this.getSizes();
            F.emit("resize", e), this.updateRefreshRate();
        }
        async startLoop() {
            await this.updateRefreshRate();
            const t = {
                clock: new Us(!0),
                player: this.player
            };
            let s = !1;
            const o = ()=>{
                B.update(), this.config.halvenFPS ? s = !s : s = !1, (s || !this.config.halvenFPS) && (F.emit("update", t), we.renderAsync());
            }, n = js(this.onResize.bind(this), 300);
            this.onResize(), new ResizeObserver(n).observe(document.body), we.renderer.setAnimationLoop(o);
        }
    }
    class Jn {
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
                n.stopPropagation(), await oe.toggleMute();
                const a = oe.isMute ? o : s;
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
    const Xn = new Jn, $n = new jo;
    $n.initAsync().then(()=>{
        Xn.init(), new Yn().startLoop();
    });
});
