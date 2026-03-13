<script lang="ts">
	let { size = "1em" }: { size?: string } = $props()
</script>

<svg
	viewBox="0 0 16 16"
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	stroke-width=".64"
	preserveAspectRatio="xMidYMid meet"
	width={size}
	height={size}
>
	<g transform="rotate(90 8 8)">
		<path
			d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5"
		/>
	</g>
</svg>
