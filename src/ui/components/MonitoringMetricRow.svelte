<script lang="ts">
	import { untrack } from "svelte"
	import type { MonitoringMetricSnapshot } from "../../systems/MonitoringManager"
	import MonitoringSparkline from "./MonitoringSparkline.svelte"

	const HISTORY_SIZE = 24

	let {
		metric,
		updatedAt,
	}: { metric: MonitoringMetricSnapshot; updatedAt: number } = $props()
	let history = $state<(number | null)[]>(Array(HISTORY_SIZE).fill(null))
	let lastUpdatedAt = 0

	const getSeverity = (value: number) => {
		const warnAt = metric.warnAt
		const dangerAt = metric.dangerAt
		if (warnAt === undefined || dangerAt === undefined) return "normal"

		if (value >= dangerAt) return "danger"
		if (value >= warnAt) return "warning"
		return "normal"
	}

	$effect(() => {
		const value = metric.value
		const hasHistory = metric.hasHistory
		const currentUpdatedAt = updatedAt

		if (!hasHistory) {
			history = Array(HISTORY_SIZE).fill(null)
			lastUpdatedAt = currentUpdatedAt
			return
		}

		if (currentUpdatedAt === lastUpdatedAt) return
		lastUpdatedAt = currentUpdatedAt

		history = untrack(() => {
			const nextHistory = history.slice(1)
			nextHistory.push(value)
			return nextHistory
		})
	})
</script>

<div class:has-history={metric.hasHistory} class="metric">
	<span class="metric-label">{metric.label}</span>
	<span
		class:danger={getSeverity(metric.value) === "danger"}
		class:warning={getSeverity(metric.value) === "warning"}
		class="metric-value"
	>
		{metric.formattedValue}
	</span>
	{#if metric.hasHistory}
		<MonitoringSparkline
			values={history}
			chartMin={metric.chartMin}
			chartMax={metric.chartMax}
			warnAt={metric.warnAt}
			dangerAt={metric.dangerAt}
		/>
	{/if}
</div>

<style>
	.metric {
		display: grid;
		grid-template-columns: minmax(7rem, 1fr) 5.5rem;
		align-items: center;
		gap: 0.55rem;
		min-height: 1rem;
	}

	.metric.has-history {
		grid-template-columns: minmax(7rem, 1fr) 5.5rem 4rem;
	}

	.metric-label {
		color: rgba(230, 240, 232, 0.62);
	}

	.metric-value {
		justify-self: end;
		width: 100%;
		text-align: right;
		color: rgba(241, 248, 241, 0.95);
		font-variant-numeric: tabular-nums;
	}

	.metric-value.warning {
		color: rgba(255, 180, 84, 0.95);
	}

	.metric-value.danger {
		color: rgba(255, 92, 92, 0.96);
	}

</style>
