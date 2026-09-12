<script lang="ts">
	import { onMount } from "svelte"
	import { fade } from "svelte/transition"
	import { eventsManager } from "../../systems"
	import type { MonitoringSnapshot, ResourceEntry } from "../../systems/EventsManager"

	const REVEAL = { duration: 220 }
	const RANK_ROWS = [0, 1, 2] as const

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
	const shortCountFormat = new Intl.NumberFormat("en-US", {
		notation: "compact",
		maximumFractionDigits: 0,
	})
	const rateFormat = new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	})
	const ratioFormat = new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
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

	const paceClass = (value: number, budget: number) => {
		if (value <= budget * 1.05) return "good"
		if (value <= budget * 1.25) return "warn"
		return "bad"
	}

	const headroomClass = (value: number, budget: number) => {
		if (value <= budget * 0.75) return "good"
		if (value <= budget) return "warn"
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
	{@const gpuElapsedMs = gpu ? gpu.averageMs + gpu.gapAverageMs : null}
	{@const isOnTarget = snapshot.fps.live >= snapshot.fps.target * 0.95}
	<div class="revo-monitor" transition:fade={REVEAL}>
		<header>
			<span class="title">MONITORING</span>
			<span class="hz">{integerFormat.format(snapshot.fps.refreshHz)} Hz</span>
		</header>

		<section>
			<span class="category">Frames</span>
			<div class="metrics">
				<span class="cell">
					<span class="label">Current</span>
					<span class={["value", isOnTarget ? "good" : "warn"]}>
						{rateFormat.format(snapshot.fps.live)}
					</span>
				</span>
				<span class="cell">
					<span class="label">Target</span>
					<span class="value">{rateFormat.format(snapshot.fps.target)}</span>
				</span>
				<span class="cell">
					<span class="label">P99</span>
					<span class={["value", paceClass(frame.intervalP99Ms, budgetMs)]}>
						{formatMs(frame.intervalP99Ms)}
					</span>
				</span>
				<span class="cell">
					<span class="label">Missed</span>
					<span class={["value", snapshot.fps.missedFrames === 0 ? "good" : "warn"]}>
						{integerFormat.format(snapshot.fps.missedFrames)}
					</span>
				</span>
			</div>
		</section>

		<section>
			<span class="category">GPU</span>
			<div class="metrics">
				<span class="cell">
					<span class="label">Elapsed</span>
					<span class={["value", gpuElapsedMs != null && headroomClass(gpuElapsedMs, budgetMs)]}>
						{gpuElapsedMs != null ? formatMs(gpuElapsedMs) : "-"}
					</span>
				</span>
				<span class="cell">
					<span class="label">Headroom</span>
					<span class={["value", gpuElapsedMs != null && headroomClass(gpuElapsedMs, budgetMs)]}>
						{gpuElapsedMs != null ? formatMs(budgetMs - gpuElapsedMs) : "-"}
					</span>
				</span>
				<span class="cell">
					<span class="label">Render</span>
					<span class="value">{gpu ? formatMs(gpu.renderAverageMs) : "-"}</span>
				</span>
				<span class="cell">
					<span class="label">Compute</span>
					<span class="value">{gpu ? formatMs(gpu.computeAverageMs) : "-"}</span>
				</span>
			</div>
		</section>

		{#if grass}
			<section>
				<span class="category">Grass</span>
				<div class="metrics">
					<span class="cell">
						<span class="label">Drawn</span>
						<span class="value">
							{shortCountFormat.format(grass.rendered)}
							<span class="aside">/{formatCount(grass.total)}</span>
						</span>
					</span>
					<span class="cell">
						<span class="label">Compute</span>
						<span class="value">
							{gpu?.grassComputeAverageMs != null ? formatMs(gpu.grassComputeAverageMs) : "-"}
						</span>
					</span>
					<span class="cell wide">
						<span class="label">Levels</span>
						<span class="value">
							{grass.renderedPerLod.map(count => Math.round(count / 1000)).join("/")}
							<span class="aside">K</span>
						</span>
					</span>
				</div>
			</section>
		{/if}

		<section>
			<span class="category">Physics</span>
			<div class="metrics">
				<span class="cell">
					<span class="label">Rate</span>
					<span class="value">
						{rateFormat.format(physics.rate)}
						<span class="aside">Hz</span>
					</span>
				</span>
				<span class="cell">
					<span class="label">Max steps</span>
					<span class="value">{integerFormat.format(physics.maxSteps)}</span>
				</span>
				<span class="cell">
					<span class="label">Catch-up</span>
					<span class={["value", physics.catchUpSteps > 0 && "warn"]}>
						{integerFormat.format(physics.catchUpSteps)}
					</span>
				</span>
				<span class="cell">
					<span class="label">Dropped</span>
					<span class={["value", physics.discardedMs > 0 && "warn"]}>
						{formatMs(physics.discardedMs)}
					</span>
				</span>
			</div>
		</section>

		<section>
			<span class="category">Output</span>
			<div class="metrics">
				<span class="cell wide">
					<span class="label">Resolution</span>
					<span class="value">
						{output.width}x{output.height}
						<span class="aside">@{ratioFormat.format(output.pixelRatio)}</span>
					</span>
				</span>
				<span class="cell">
					<span class="label">Draws</span>
					<span class="value">{device ? integerFormat.format(device.drawCallCount) : "-"}</span>
				</span>
				<span class="cell">
					<span class="label">Pass peak</span>
					<span class="value">
						{device ? integerFormat.format(device.passCountPeak) : "-"}
					</span>
				</span>
			</div>
		</section>

		{#if device}
			<section>
				<span class="category">Memory</span>
				<div class="metrics">
					<span class="cell">
						<span class="label">Live</span>
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
			</section>
		{/if}

		{#if (gpu?.slowestPasses.length ?? 0) > 0}
			<section class="ranked">
				<span class="category">Slowest</span>
				<div class="rows">
					{#each RANK_ROWS as rank (rank)}
						{@const pass = gpu?.slowestPasses[rank]}
						{#if pass}
							<div class="row">
								<span class="name">{pass.label}</span>
								<span class="value">{formatMs(pass.averageMs)}</span>
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/if}

		{#if device && device.largestResources.length > 0}
			{@const resource = device.largestResources[0]}
			<section class="ranked">
				<span class="category">Largest</span>
				<div class="rows">
					<div class="row">
						<span class="name">{describeEntry(resource)}</span>
						<span class="value">{formatBytes(resource.allocationInBytes)}</span>
					</div>
				</div>
			</section>
		{/if}
	</div>
{/if}

<style>
	.revo-monitor {
		position: fixed;
		left: 0.5rem;
		bottom: 0.5rem;
		z-index: 20;
		width: 21rem;
		max-width: calc(100vw - 1rem);
		display: grid;
		border: 1px solid rgba(218, 229, 211, 0.16);
		border-radius: 4px;
		background: rgb(9, 13, 10);
		color: rgba(242, 247, 238, 0.9);
		font:
			10px/1.1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			"Liberation Mono", monospace;
		font-variant-numeric: tabular-nums;
		pointer-events: auto;
	}

	header {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		min-height: 1.5rem;
		padding: 0 0.5rem;
		border-bottom: 1px solid rgba(218, 229, 211, 0.16);
	}

	.title {
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.hz {
		color: rgba(177, 190, 169, 0.7);
	}

	section {
		display: grid;
		grid-template-columns: 3.25rem minmax(0, 1fr);
		gap: 0.4rem;
		padding: 0.3rem 0.5rem;
	}

	section + section {
		border-top: 1px solid rgba(218, 229, 211, 0.08);
	}

	.category {
		align-self: start;
		padding-top: 0.1rem;
		color: rgba(177, 190, 169, 0.62);
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.35rem 0.4rem;
		min-width: 0;
	}

	.cell {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.cell.wide {
		grid-column: span 2;
	}

	.label {
		color: rgba(177, 190, 169, 0.55);
		line-height: 1;
		white-space: nowrap;
	}

	.value {
		color: rgba(242, 247, 238, 0.88);
		line-height: 1;
		white-space: nowrap;
	}

	.aside {
		color: rgba(177, 190, 169, 0.5);
	}

	.rows {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: baseline;
	}

	.name {
		color: rgba(177, 190, 169, 0.62);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
