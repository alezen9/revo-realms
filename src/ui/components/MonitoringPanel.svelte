<script lang="ts">
	import { onMount } from "svelte"
	import { fade, slide } from "svelte/transition"
	import { eventsManager } from "../../systems"
	import type { MonitoringSnapshot, ResourceEntry } from "../../systems/EventsManager"

	const REVEAL = { duration: 220 }
	const LEADERBOARD_ROWS = [0, 1, 2, 3, 4] as const

	let snapshot = $state<MonitoringSnapshot | null>(null)

	const msFormat = new Intl.NumberFormat("en-US", {
		style: "unit",
		unit: "millisecond",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
	const kilobyteFormat = new Intl.NumberFormat("en-US", {
		style: "unit",
		unit: "kilobyte",
		maximumFractionDigits: 0,
	})
	const megabyteFormat = new Intl.NumberFormat("en-US", {
		style: "unit",
		unit: "megabyte",
		maximumFractionDigits: 0,
	})
	const countFormat = new Intl.NumberFormat("en-US", {
		notation: "compact",
		maximumFractionDigits: 1,
	})
	const rateFormat = new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	})
	const ratioFormat = new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 3,
	})
	const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

	const formatMs = (value: number) => msFormat.format(value)

	const formatCount = (value: number) => countFormat.format(value)

	const formatBytes = (value: number) => {
		const megabytes = value / 1024 ** 2
		if (megabytes < 1) return kilobyteFormat.format(value / 1024)
		return megabyteFormat.format(megabytes)
	}

	const describeEntry = (entry: ResourceEntry) => {
		const samples = entry.sampleCount && entry.sampleCount > 1 ? ` x${entry.sampleCount}` : ""
		if (entry.label) return `${entry.label}${samples}`
		if (entry.kind === "buffer") return "unlabelled buffer"
		return `${entry.format} ${entry.width}x${entry.height}${samples}`
	}

	const budgetClass = (value: number, budget: number) => {
		if (value <= budget) return "good"
		if (value <= budget * 1.25) return "warn"
		return "bad"
	}

	onMount(() => {
		const unsubscribe = eventsManager.on("engine-monitoring-update", value => {
			snapshot = value
		})

		return () => {
			unsubscribe()
		}
	})
</script>

{#if snapshot}
	{@const device = snapshot.device}
	{@const gpu = device?.gpu}
	{@const grass = snapshot.grass}
	{@const budgetMs = snapshot.frameBudgetMs}
	{@const frame = snapshot.frame}
	{@const physics = snapshot.physics}
	{@const output = snapshot.output}
	<div class="revo-monitor" aria-hidden="true" transition:fade={REVEAL}>
		<div class="row">
			<span class="category">FRAMES</span>
			<span class="cell">
				<span class="label">Current</span>
				<span class={["value", snapshot.fps.live >= snapshot.fps.target * 0.95 ? "good" : "warn"]}>
					{rateFormat.format(snapshot.fps.live)}
				</span>
			</span>
			<span class="cell">
				<span class="label">Target</span>
				<span class="value">{rateFormat.format(snapshot.fps.target)}</span>
			</span>
			<span class="cell">
				<span class="label">Refresh</span>
				<span class="value">{integerFormat.format(snapshot.fps.refreshHz)} Hz</span>
			</span>
			<span class="cell">
				<span class="label"># Missed</span>
				<span class={["value", snapshot.fps.missedFrames === 0 ? "good" : "warn"]}>
					{integerFormat.format(snapshot.fps.missedFrames)}
				</span>
			</span>
			<span class="cell">
				<span class="label">Budget</span>
				<span class="value">{formatMs(budgetMs)}</span>
			</span>
		</div>

		<div class="row">
			<span class="category">TIMING</span>
			<span class="cell">
				<span class="label">Average</span>
				<span class="value">{formatMs(frame.intervalAverageMs)}</span>
			</span>
			<span class="cell">
				<span class="label">P95</span>
				<span class="value">{formatMs(frame.intervalP95Ms)}</span>
			</span>
			<span class="cell">
				<span class="label">P99</span>
				<span class="value">{formatMs(frame.intervalP99Ms)}</span>
			</span>
			<span class="cell">
				<span class="label">Maximum</span>
				<span class="value">{formatMs(frame.intervalMaxMs)}</span>
			</span>
		</div>

		<div class="row">
			<span class="category">GPU</span>
			<span class="cell">
				<span class="label">Total</span>
				<span class={["value", gpu && budgetClass(gpu.averageMs, budgetMs)]}>
					{gpu ? formatMs(gpu.averageMs) : "-"}
				</span>
			</span>
			<span class="cell">
				<span class="label">Render sum</span>
				<span class="value">{gpu ? formatMs(gpu.renderAverageMs) : "-"}</span>
			</span>
			<span class="cell">
				<span class="label">Compute sum</span>
				<span class="value">{gpu ? formatMs(gpu.computeAverageMs) : "-"}</span>
			</span>
			<span class="cell">
				<span class="label">Gap</span>
				<span class="value">{gpu ? formatMs(gpu.gapAverageMs) : "-"}</span>
			</span>
			<span class="cell">
				<span class="label">Headroom</span>
				<span class={["value", gpu && budgetClass(gpu.averageMs, budgetMs)]}>
					{gpu ? formatMs(budgetMs - gpu.averageMs) : "-"}
				</span>
			</span>
		</div>

		<div class="row">
			<span class="category">PHYSICS</span>
			<span class="cell">
				<span class="label">Rate</span>
				<span class="value">{rateFormat.format(physics.rate)} Hz</span>
			</span>
			<span class="cell">
				<span class="label">Max steps</span>
				<span class="value">{integerFormat.format(physics.maxSteps)}</span>
			</span>
			<span class="cell">
				<span class="label">Discarded</span>
				<span class={["value", physics.discardedMs > 0 && "warn"]}>
					{formatMs(physics.discardedMs)}
				</span>
			</span>
			<span class="cell">
				<span class="label">Remainder</span>
				<span class="value">{formatMs(physics.remainderMs)}</span>
			</span>
		</div>

		<div class="row">
			<span class="category">SCENE</span>
			<span class="cell">
				<span class="label">Output</span>
				<span class="value">{output.width}x{output.height}</span>
			</span>
			<span class="cell">
				<span class="label">DPR</span>
				<span class="value">{ratioFormat.format(output.pixelRatio)}</span>
			</span>
			<span class="cell">
				<span class="label"># Tris</span>
				<span class="value">{formatCount(snapshot.sceneTriangles)}</span>
			</span>
			<span class="cell">
				<span class="label"># Draws</span>
				<span class="value">{device ? integerFormat.format(device.drawCallCount) : "-"}</span>
			</span>
		</div>

		{#if device}
			<div class="row" transition:slide={REVEAL}>
				<span class="category">WORK</span>
				<span class="cell">
					<span class="label">Render passes</span>
					<span class="value">{integerFormat.format(device.renderPassCount)}</span>
				</span>
				<span class="cell">
					<span class="label">Compute passes</span>
					<span class="value">{integerFormat.format(device.computePassCount)}</span>
				</span>
				<span class="cell">
					<span class="label">Dispatches</span>
					<span class="value">{integerFormat.format(device.computeDispatchCount)}</span>
				</span>
				<span class="cell">
					<span class="label">Submissions</span>
					<span class="value">{integerFormat.format(device.gpuSubmissionCount)}</span>
				</span>
			</div>

			<div class="row" transition:slide={REVEAL}>
				<span class="category">MEMORY</span>
				<span class="cell">
					<span class="label">Current</span>
					<span class="value">{formatBytes(device.liveBytes)}</span>
				</span>
				<span class="cell">
					<span class="label">Peak</span>
					<span class="value">{formatBytes(device.peakBytes)}</span>
				</span>
				<span class="cell">
					<span class="label">Textures</span>
					<span class="value">{formatBytes(device.textureBytes)}</span>
				</span>
				<span class="cell">
					<span class="label">Buffers</span>
					<span class="value">{formatBytes(device.bufferBytes)}</span>
				</span>
			</div>

			{#if (gpu?.slowestPasses.length ?? 0) > 0 || device.largestResources.length > 0}
				<div class="row leaderboard" transition:slide={REVEAL}>
					<span class="category">RANK</span>
					<span class="leaderboard-title">SLOWEST PASSES</span>
					<span></span>
					<span class="leaderboard-title">LARGEST RESOURCES</span>
					<span></span>
				</div>
				{#each LEADERBOARD_ROWS as rank (rank)}
					{@const pass = gpu?.slowestPasses[rank]}
					{@const resource = device.largestResources[rank]}
					{#if pass || resource}
						<div class="row leaderboard" transition:slide={REVEAL}>
							<span class="category">#{rank + 1}</span>
							<span class="leaderboard-name">{pass?.label ?? ""}</span>
							<span class="value">{pass ? formatMs(pass.averageMs) : ""}</span>
							<span class="leaderboard-name">
								{resource ? describeEntry(resource) : ""}
							</span>
							<span class="value">
								{resource ? formatBytes(resource.allocationInBytes) : ""}
							</span>
						</div>
					{/if}
				{/each}
			{/if}
		{/if}

		{#if grass}
			<div class="row" transition:slide={REVEAL}>
				<span class="category">GRASS</span>
				<span class="cell">
					<span class="label"># Visible</span>
					<span class="value">{formatCount(grass.rendered)}</span>
				</span>
				<span class="cell">
					<span class="label"># Total</span>
					<span class="value">{formatCount(grass.total)}</span>
				</span>
				<span class="cell">
					<span class="label"># Tris</span>
					<span class="value">{formatCount(grass.renderedTriangles)}</span>
				</span>
				<span class="cell"></span>
			</div>
			<div class="row" transition:slide={REVEAL}>
				<span class="category"></span>
				{#each grass.renderedPerLod as bladeCount, lod (lod)}
					<span class="cell">
						<span class="label"># LOD {lod}</span>
						<span class="value">{formatCount(bladeCount)}</span>
					</span>
				{/each}
				<span class="cell">
					<span class="label">Segments</span>
					<span class="value">{grass.segmentsPerLod.join("/")}</span>
				</span>
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
		width: 600px;
		max-width: calc(100vw - 1rem);
		display: grid;
		border: 1px solid rgba(218, 229, 211, 0.16);
		border-radius: 4px;
		background: rgba(9, 13, 10);
		color: rgba(242, 247, 238, 0.9);
		font:
			10px/1.15 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			"Liberation Mono", monospace;
		pointer-events: none;
	}

	.row {
		display: grid;
		grid-template-columns: 3rem repeat(5, minmax(0, 1fr));
		gap: 0.25rem;
		align-items: end;
		padding: 0.35rem;
		white-space: nowrap;
	}

	.row:nth-child(odd) {
		background: rgba(255, 255, 255, 0.028);
	}

	.category {
		align-self: end;
		color: rgba(177, 190, 169, 0.68);
		font-weight: 700;
	}

	.cell {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
		align-content: end;
	}

	.label {
		color: rgba(177, 190, 169, 0.58);
		font-size: 1em;
		line-height: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.value {
		color: rgba(242, 247, 238, 0.86);
		font-size: 1.05em;
		line-height: 1;
	}

	.leaderboard {
		grid-template-columns: 3rem minmax(0, 1.7fr) 4.6rem minmax(0, 1.7fr) 4.6rem;
	}

	.leaderboard-title,
	.leaderboard-name {
		color: rgba(177, 190, 169, 0.58);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.leaderboard-title {
		font-weight: 700;
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
</style>
