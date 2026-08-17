<script lang="ts">
	import { onMount } from "svelte"
	import { fade, slide } from "svelte/transition"
	import { eventsManager } from "../../systems"
	import type { MonitoringSnapshot, ResourceEntry } from "../../systems/EventsManager"

	const REVEAL = { duration: 220 }

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
	const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
	const secondsFormat = new Intl.NumberFormat("en-US", {
		style: "unit",
		unit: "second",
		unitDisplay: "narrow",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})

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
				<span class="value">{integerFormat.format(snapshot.fps.target)}</span>
			</span>
			<span class="cell">
				<span class="label">Refresh</span>
				<span class="value">{integerFormat.format(snapshot.fps.refreshHz)} Hz</span>
			</span>
			<span class="cell">
				<span class="label"># Late</span>
				<span class={["value", snapshot.fps.lateFrames === 0 ? "good" : "warn"]}>
					{integerFormat.format(snapshot.fps.lateFrames)}
				</span>
			</span>
		</div>

		<div class="row">
			<span class="category">GPU</span>
			<span class="cell">
				<span class="label">Usage</span>
				<span class={["value", gpu && budgetClass(gpu.averageMs, budgetMs)]}>
					{gpu ? formatMs(gpu.averageMs) : "-"}
				</span>
			</span>
			<span class="cell">
				<span class="label">Gap</span>
				<span class="value">{gpu ? formatMs(gpu.gapMs) : "-"}</span>
			</span>
			<span class="cell">
				<span class="label"># Tris</span>
				<span class="value">{formatCount(snapshot.sceneTriangles)}</span>
			</span>
			<span class="cell meta">
				<span class="label">Sampling</span>
				<span class="value">{secondsFormat.format(snapshot.sampleRateMs / 1000)}</span>
			</span>
		</div>

		{#if device}
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

			{#each device.largestResources as entry (entry.id)}
				<div class="row resource" transition:slide={REVEAL}>
					<span class="category"></span>
					<span class="resource-name">{describeEntry(entry)}</span>
					<span class="value">{formatBytes(entry.allocationInBytes)}</span>
				</div>
			{/each}
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
		width: 340px;
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
		grid-template-columns: 3rem repeat(4, minmax(0, 1fr));
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

	.meta {
		background: rgba(167, 154, 224, 0.25);
		padding: 0 0.24rem;
		margin: -0.35rem;
		padding: 0.35rem;
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

	.resource-name {
		grid-column: 2 / 5;
		color: rgba(177, 190, 169, 0.58);
		overflow: hidden;
		text-overflow: ellipsis;
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
