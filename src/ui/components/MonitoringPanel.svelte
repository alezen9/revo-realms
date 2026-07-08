<script lang="ts">
	import { flip } from "svelte/animate"
	import { onMount } from "svelte"
	import { eventsManager } from "../../systems"
	import type { MonitoringSnapshot } from "../../systems/EventsManager"

	type TraceSample = {
		id: number
		value: number
	}

	let snapshot = $state<MonitoringSnapshot | null>(null)
	let fpsTrace = $state<TraceSample[]>([])
	let frameTrace = $state<TraceSample[]>([])
	let traceId = 0

	const TRACE_LENGTH = 10
	const FPS_TRACE_HEADROOM = 50
	const FRAME_TRACE_HEADROOM = 1.5

	const formatDecimal = (value: number, digits = 1) => {
		return value.toFixed(digits)
	}

	const formatInteger = (value: number) => {
		return Math.round(value).toString()
	}

	const formatCompact = (value: number) => {
		return Intl.NumberFormat("en-US", {
			notation: "compact",
			maximumFractionDigits: 1,
		}).format(value)
	}

	const fpsClass = (value: number, effective: number) => {
		if (value >= effective * 0.95) return "good"
		if (value >= effective * 0.85) return "warn"
		return "bad"
	}

	const frameClass = (value: number, budget: number) => {
		if (value <= budget) return "good"
		if (value <= budget * 1.25) return "warn"
		return "bad"
	}

	const fpsHeight = (value: number, refreshHz: number) => {
		if (refreshHz <= 0) return 0
		return Math.min(100, (value / (refreshHz + FPS_TRACE_HEADROOM)) * 100)
	}

	const frameHeight = (value: number, refreshHz: number) => {
		if (refreshHz <= 0) return 0
		const displayFrameBudget = 1000 / refreshHz
		return Math.min(
			100,
			(value / (displayFrameBudget * 2 + FRAME_TRACE_HEADROOM)) * 100,
		)
	}

	const addTraceValue = (trace: TraceSample[], value: number) => {
		traceId++
		return [...trace, { id: traceId, value }].slice(-TRACE_LENGTH)
	}

	onMount(() => {
		const unsubscribe = eventsManager.on("engine-monitoring-update", value => {
			snapshot = value
			fpsTrace = addTraceValue(fpsTrace, value.fps.current)
			frameTrace = addTraceValue(frameTrace, value.frame.averageMs)
		})

		return () => {
			unsubscribe()
		}
	})
</script>

{#if snapshot}
	<div class="revo-monitor" aria-hidden="true">
		<div class="row">
			<span class="category">FPS</span>
			<span class="metric">
				<span class="metric-label">Current</span>
				<span class={["metric-value", fpsClass(snapshot.fps.current, snapshot.fps.effective)]}>
					{formatDecimal(snapshot.fps.current)}
				</span>
			</span>
			<span class="metric">
				<span class="metric-label">Effective</span>
				<span class="metric-value">{formatInteger(snapshot.fps.effective)}</span>
			</span>
			<span class="metric">
				<span class="metric-label">Target</span>
				<span class="metric-value">{formatInteger(snapshot.fps.target)}</span>
			</span>
			<span class="metric">
				<span class="trace trace-full">
					{#each fpsTrace as sample (sample.id)}
						<i
							animate:flip={{ duration: 180 }}
							class={fpsClass(sample.value, snapshot.fps.effective)}
							style={`--height: ${fpsHeight(sample.value, snapshot.sync.refreshHz)}%;`}
						></i>
					{/each}
				</span>
			</span>
		</div>
		<div class="row">
			<span class="category">FRAME</span>
			<span class="metric">
				<span class="metric-label">Average</span>
				<span class="metric-value">{formatDecimal(snapshot.frame.averageMs, 2)} ms</span>
			</span>
			<span class="metric">
				<span class="metric-label">Budget</span>
				<span class="metric-value">{formatDecimal(snapshot.frame.budgetMs, 2)} ms</span>
			</span>
			<span class="metric">
				<span class="metric-label">Late</span>
				<span class="metric-value">{snapshot.frame.lateFrames}</span>
			</span>
			<span class="metric">
				<span class="trace trace-full">
					{#each frameTrace as sample (sample.id)}
						<i
							animate:flip={{ duration: 180 }}
							class={frameClass(sample.value, snapshot.frame.budgetMs)}
							style={`--height: ${frameHeight(sample.value, snapshot.sync.refreshHz)}%;`}
						></i>
					{/each}
				</span>
			</span>
		</div>
		<div class="row">
			<span class="category">SYNC</span>
			<span class="metric">
				<span class="metric-label">Display</span>
				<span class="metric-value">{formatInteger(snapshot.sync.refreshHz)} Hz</span>
			</span>
			<span class="metric">
				<span class="metric-label">Divisor</span>
				<span class="metric-value">{snapshot.sync.divisor}</span>
			</span>
			<span class="metric">
				<span class="metric-label">Alpha</span>
				<span class="metric-value">{formatDecimal(snapshot.sync.alpha, 2)}</span>
			</span>
			<span class="metric"></span>
		</div>
		<div class="row">
			<span class="category">PHYSICS</span>
			<span class="metric">
				<span class="metric-label">Rate</span>
				<span class="metric-value">{formatDecimal(snapshot.physics.rate)}/s</span>
			</span>
			<span class="metric"></span>
			<span class="metric"></span>
			<span class="metric"></span>
		</div>
		<div class="row">
			<span class="category">RENDER</span>
			<span class="metric">
				<span class="metric-label"># Calls</span>
				<span class="metric-value">{formatInteger(snapshot.render.calls)}</span>
			</span>
			<span class="metric">
				<span class="metric-label"># Tris</span>
				<span class="metric-value">{formatCompact(snapshot.render.triangles)}</span>
			</span>
			<span class="metric"></span>
			<span class="metric"></span>
		</div>
		{#if snapshot.render.grass}
			<div class="row">
				<span class="category">GRASS</span>
				<span class="metric">
					<span class="metric-label">Rendered</span>
					<span class="metric-value">{formatCompact(snapshot.render.grass.rendered)}</span>
				</span>
				<span class="metric">
					<span class="metric-label">Total</span>
					<span class="metric-value">{formatCompact(snapshot.render.grass.total)}</span>
				</span>
				<span class="metric">
					<span class="metric-label">Segments</span>
					<span class="metric-value">{snapshot.render.grass.segments}</span>
				</span>
				<span class="metric"></span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.revo-monitor {
		position: fixed;
		left: 0.5rem;
		bottom: 0.5rem;
		z-index: 20;
		width: 340px;
		max-width: calc(100vw - 1rem);
		padding: 0;
		display: grid;
		gap: 0;
		border: 1px solid rgba(218, 229, 211, 0.16);
		border-radius: 4px;
		background: rgba(9, 13, 10, 0.78);
		color: rgba(242, 247, 238, 0.9);
		font:
			11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			"Liberation Mono", monospace;
		letter-spacing: 0;
		pointer-events: none;
		backdrop-filter: blur(3px);
	}

	.row {
		display: grid;
		grid-template-columns: 3.7rem repeat(3, 4.15rem) minmax(0, 1fr);
		gap: 0.24rem;
		align-items: end;
		min-height: 1.58rem;
		padding: 0.18rem 0.34rem;
		white-space: nowrap;
	}

	.row:nth-child(odd) {
		background: rgba(255, 255, 255, 0.028);
	}

	.category {
		align-self: end;
		padding-bottom: 0.02rem;
		color: rgba(177, 190, 169, 0.68);
		font-weight: 700;
	}

	.metric {
		display: grid;
		gap: 0.12rem;
		min-width: 0;
		min-height: 1.22rem;
		align-content: end;
	}

	.metric-label {
		color: rgba(177, 190, 169, 0.58);
		font-size: 0.78em;
		line-height: 1;
	}

	.metric-value {
		color: rgba(242, 247, 238, 0.86);
		font-size: 1.03em;
		line-height: 1;
	}

	.good {
		color: rgb(114, 210, 128);
	}

	.warn {
		color: rgb(232, 164, 72);
	}

	.bad {
		color: rgb(236, 92, 82);
	}

	.trace {
		height: 0.85rem;
		display: flex;
		justify-content: flex-end;
		align-items: end;
		gap: 1px;
		overflow: hidden;
	}

	.trace-full {
		height: 100%;
		min-height: 1.22rem;
	}

	.trace i {
		flex: 0 0 0.34rem;
		width: 0.34rem;
		height: var(--height);
		min-height: 1px;
		border-radius: 1px 1px 0 0;
		background: currentColor;
		opacity: 0.88;
		transform-origin: bottom;
		transition:
			height 140ms linear,
			color 140ms linear;
	}
</style>
