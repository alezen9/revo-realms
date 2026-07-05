<script lang="ts">
	import { onMount } from "svelte"
	import { monitoringManager } from "../../systems"
	import type { MonitoringSnapshot } from "../../systems/MonitoringManager"
	import MonitoringMetricRow from "./MonitoringMetricRow.svelte"

	let snapshot: MonitoringSnapshot = $state({ groups: [], updatedAt: 0 })

	onMount(() => {
		if (!monitoringManager) return
		return monitoringManager.subscribe(nextSnapshot => {
			snapshot = nextSnapshot
		})
	})
</script>

{#if monitoringManager && snapshot.groups.length > 0}
	<aside class="monitoring-overlay" aria-label="Monitoring overlay">
		{#each snapshot.groups as group}
			<section class="monitoring-group">
				<h2>{group.name}</h2>
				<div class="metrics">
					{#each group.metrics as metric (metric.id)}
						<MonitoringMetricRow {metric} updatedAt={snapshot.updatedAt} />
					{/each}
				</div>
			</section>
		{/each}
	</aside>
{/if}

<style>
	.monitoring-overlay {
		position: fixed;
		left: 0.75rem;
		bottom: 0.75rem;
		display: grid;
		gap: 0.5rem;
		min-width: 16rem;
		padding: 0.65rem;
		border: 1px solid rgba(195, 219, 205, 0.22);
		border-radius: 0.35rem;
		color: rgba(230, 240, 232, 0.88);
		background: rgba(7, 12, 9, 0.72);
		backdrop-filter: blur(6px);
		font-family:
			"SFMono-Regular", "Cascadia Code", "Liberation Mono", Menlo, monospace;
		font-size: 0.7rem;
		line-height: 1;
		pointer-events: none;
		z-index: 20;
	}

	.monitoring-group {
		display: grid;
		gap: 0.35rem;
	}

	h2 {
		color: rgba(183, 247, 255, 0.78);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	.metrics {
		display: grid;
		gap: 0.25rem;
	}

</style>
