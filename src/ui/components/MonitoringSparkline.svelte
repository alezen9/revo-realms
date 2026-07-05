<script lang="ts">
	let {
		values,
		chartMin = 0,
		chartMax = 1,
		warnAt,
		dangerAt,
	}: {
		values: (number | null)[]
		chartMin?: number
		chartMax?: number
		warnAt?: number
		dangerAt?: number
	} = $props()

	const getSeverity = (value: number | null) => {
		if (value === null) return "empty"
		if (warnAt === undefined || dangerAt === undefined) return "normal"

		if (value >= dangerAt) return "danger"
		if (value >= warnAt) return "warning"
		return "normal"
	}

	const getBars = () => {
		const min = Number.isFinite(chartMin) ? chartMin : 0
		const max = Number.isFinite(chartMax) && chartMax > min ? chartMax : 1
		const range = max - min

		return values.map(value => {
			if (value === null) return null
			const clampedValue = Math.min(max, Math.max(min, value))
			return ((clampedValue - min) / range) * 100
		})
	}
</script>

<div class="sparkline" aria-hidden="true">
	{#each getBars() as height, idx}
		<span
			class:empty={height === null}
			class:warning={getSeverity(values[idx]) === "warning"}
			class:danger={getSeverity(values[idx]) === "danger"}
			style:height={height === null ? "0%" : `${Math.max(10, height)}%`}
		></span>
	{/each}
</div>

<style>
	.sparkline {
		justify-self: end;
		align-self: center;
		display: flex;
		align-items: end;
		gap: 1px;
		width: 4rem;
		height: 1em;
		overflow: hidden;
	}

	span {
		flex: 1 1 1px;
		min-width: 1px;
		background: rgba(126, 219, 148, 0.78);
		transition: height 260ms ease-out;
	}

	span.empty {
		background: transparent;
	}

	span.warning {
		background: rgba(255, 180, 84, 0.8);
	}

	span.danger {
		background: rgba(255, 92, 92, 0.9);
	}
</style>
